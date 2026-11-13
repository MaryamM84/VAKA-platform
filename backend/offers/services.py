
from django.db import IntegrityError, transaction
from django.utils import timezone

from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.exceptions import NotFound

from accounts.models import ExecutorProfile, UserRole
from tasks.models import Task
from tasks.choices import TaskStatus

from .models import Bid, BidStatus, BidStatusHistory

BIGINT_MAX = (2 ** 63) - 1


def submit_bid(
    *,
    user,
    task,
    proposed_wage_amount,
    proposed_duration_minutes,
    message,
    expires_at=None,
):
    """
    Submit a bid for an open task.

    Business rules:
    - User must be active and verified.
    - User must have EXECUTOR role.
    - Executor profile must be APPROVED and ACTIVE.
    - Executors cannot bid on their own tasks.
    - Task must be OPEN and before proposal deadline.
    - Only one bid per executor per task.
    - Bid and initial status history are created atomically.
    """

    # 1. Authentication and account validation
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication is required.")

    if not user.is_active:
        raise PermissionDenied(
            "Your account must be active and phone-verified."
        )

    # 2. Executor role validation
    has_executor_role = UserRole.objects.filter(
        user_id=user.pk,
        role__code="EXECUTOR",
    ).exists()

    if not has_executor_role:
        raise PermissionDenied(
            "You must have the EXECUTOR role to submit a bid."
        )

    # 3. Validate basic input constraints
    if not isinstance(proposed_wage_amount, int) or isinstance(
        proposed_wage_amount, bool
    ):
        raise ValidationError({
            "proposed_wage_amount": "A valid integer is required."
        })

    if not 0 <= proposed_wage_amount <= BIGINT_MAX:
        raise ValidationError({
            "proposed_wage_amount": "The proposed amount is invalid."
        })

    if (
        not isinstance(proposed_duration_minutes, int)
        or isinstance(proposed_duration_minutes, bool)
        or not 1 <= proposed_duration_minutes <= 300
    ):
        raise ValidationError({
            "proposed_duration_minutes": (
                "Duration must be between 1 and 300 minutes."
            )
        })

    if not isinstance(message, str) or not message.strip():
        raise ValidationError({
            "message": "A non-empty message is required."
        })

    now = timezone.now()

    if expires_at is not None and expires_at <= now:
        raise ValidationError({
            "expires_at": "Expiration must be in the future."
        })

    profile = None

    try:
        with transaction.atomic():

            # 4. Lock and validate executor profile
            profile = (
                ExecutorProfile.objects
                .select_for_update()
                .get(user_id=user.pk)
            )

            if (
                profile.verification_status
                != ExecutorProfile.VerificationStatus.APPROVED
            ):
                raise PermissionDenied(
                    "Your executor profile has not been approved."
                )

            if profile.profile_status != "ACTIVE":
                raise PermissionDenied(
                    "Your executor profile is not active."
                )

            # 5. Lock task to prevent concurrent bid submissions
            locked_task = (
                Task.objects
                .select_for_update()
                .get(task_id=task.pk)
            )

            # 6. Prevent bidding on own task
            if locked_task.employer_user_id == user.pk:
                raise PermissionDenied(
                    "You cannot submit a bid for your own task."
                )

            # 7. Task status validation
            if locked_task.status != TaskStatus.OPEN:
                raise ValidationError({
                    "task_id": "This task is not open for bidding."
                })

            # 8. Proposal deadline validation
            if locked_task.proposal_deadline_at <= now:
                raise ValidationError({
                    "task_id": "The proposal deadline has passed."
                })

            # 9. Bid expiration cannot exceed task proposal deadline
            if (
                expires_at is not None
                and expires_at > locked_task.proposal_deadline_at
            ):
                raise ValidationError({
                    "expires_at": (
                        "Bid expiration cannot exceed the task proposal deadline."
                    )
                })

            # 10. Prevent duplicate bids, including withdrawn/rejected bids
            existing_bid = Bid.objects.filter(
                task_id=locked_task.task_id,
                executor_profile_id=profile.executor_profile_id,
            ).exists()

            if existing_bid:
                raise ValidationError({
                    "task_id": (
                        "You have already submitted a bid for this task."
                    )
                })

            # 11. Create bid
            bid = Bid.objects.create(
                task=locked_task,
                executor_profile=profile,
                proposed_wage_amount=proposed_wage_amount,
                proposed_duration_minutes=proposed_duration_minutes,
                message=message.strip(),
                expires_at=expires_at,
                status=BidStatus.ACTIVE,
            )

            # 12. Record initial status history
            BidStatusHistory.objects.create(
                bid=bid,
                from_status=None,
                to_status=BidStatus.ACTIVE,
                changed_by_user=user,
                reason="Initial bid submission",
            )

            return bid

    except ExecutorProfile.DoesNotExist:
        raise PermissionDenied(
            "Executor profile does not exist."
        )

    except Task.DoesNotExist:
        raise ValidationError({
            "task_id": "The selected task does not exist."
        })

    except IntegrityError:
        # Database-level unique constraints protect against
        # duplicate submissions even in concurrent requests.
        if profile is not None and Bid.objects.filter(
            task_id=task.pk,
            executor_profile_id=profile.executor_profile_id,
        ).exists():
            raise ValidationError({
                "task_id": (
                    "You have already submitted a bid for this task."
                )
            })

        raise


def _get_executor_profile_for_bids(user, require_approved=False):
    """
    Resolve the authenticated user's executor profile.
    """

    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication is required.")

    if not user.is_active:
        raise PermissionDenied("Your account is not active.")

    has_executor_role = UserRole.objects.filter(
        user_id=user.pk,
        role__code="EXECUTOR",
    ).exists()

    if not has_executor_role:
        raise PermissionDenied(
            "Only executors can access their bids."
        )

    try:
        profile = ExecutorProfile.objects.get(user_id=user.pk)
    except ExecutorProfile.DoesNotExist:
        raise PermissionDenied(
            "Executor profile does not exist."
        )

    if require_approved:
        if (
            profile.verification_status
            != ExecutorProfile.VerificationStatus.APPROVED
        ):
            raise PermissionDenied(
                "Your executor profile is not approved."
            )

        if profile.profile_status != "ACTIVE":
            raise PermissionDenied(
                "Your executor profile is not active."
            )

    return profile


def get_executor_bids(*, user):
    """
    Return all bids belonging to the authenticated executor.
    """

    profile = _get_executor_profile_for_bids(user)

    return (
        Bid.objects
        .filter(executor_profile=profile)
        .select_related("task__employer_user")
        .order_by("-created_at")
    )


def get_executor_bid_detail(*, user, bid_id):
    """
    Return one bid only if it belongs to the authenticated executor.
    """

    profile = _get_executor_profile_for_bids(user)

    try:
        return (
            Bid.objects
            .select_related("task__employer_user")
            .get(
                bid_id=bid_id,
                executor_profile=profile,
            )
        )
    except Bid.DoesNotExist:
        raise NotFound("Bid not found.")


def update_executor_bid(*, user, bid_id, validated_data):
    """
    Update an executor's own bid before it is accepted.

    The task and bid are locked to prevent concurrent updates
    and conflicts with the employer's bid acceptance operation.
    """

    profile = _get_executor_profile_for_bids(
        user,
        require_approved=True,
    )

    try:
        initial_bid = Bid.objects.only("task_id").get(
            bid_id=bid_id,
            executor_profile=profile,
        )
    except Bid.DoesNotExist:
        raise NotFound("Bid not found.")

    now = timezone.now()

    with transaction.atomic():

        try:
            task = (
                Task.objects
                .select_for_update()
                .get(task_id=initial_bid.task_id)
            )
        except Task.DoesNotExist:
            raise NotFound("Task not found.")

        try:
            bid = (
                Bid.objects
                .select_for_update()
                .get(
                    bid_id=bid_id,
                    executor_profile=profile,
                )
            )
        except Bid.DoesNotExist:
            raise NotFound("Bid not found.")

        if bid.status != BidStatus.ACTIVE:
            raise ValidationError({
                "bid": "This bid can no longer be edited."
            })

        if task.status != TaskStatus.OPEN:
            raise ValidationError({
                "task": "This task is no longer open for bidding."
            })

        if task.proposal_deadline_at <= now:
            raise ValidationError({
                "task": "The proposal deadline has passed."
            })

        if bid.expires_at is not None and bid.expires_at <= now:
            raise ValidationError({
                "expires_at": "This bid has expired."
            })

        effective_expiration = validated_data.get(
            "expires_at",
            bid.expires_at,
        )

        if (
            effective_expiration is not None
            and effective_expiration > task.proposal_deadline_at
        ):
            raise ValidationError({
                "expires_at": (
                    "Bid expiration cannot exceed the task "
                    "proposal deadline."
                )
            })

        for field, value in validated_data.items():
            setattr(bid, field, value)

        bid.save()

        return bid





def _require_employer_for_bids(user):
    """Ensure that the authenticated user is an active employer."""

    from accounts.models import UserRole

    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication is required.")

    if not user.is_active:
        raise PermissionDenied("Your account is not active.")

    if not UserRole.objects.filter(
        user_id=user.pk,
        role__code="EMPLOYER",
    ).exists():
        raise PermissionDenied(
            "Only employers can access received bids."
        )


def get_employer_bids(*, user):
    """Get all bids received for the employer's tasks."""

    from .models import Bid

    _require_employer_for_bids(user)

    return (
        Bid.objects
        .filter(task__employer_user_id=user.pk)
        .select_related(
            "task",
            "executor_profile",
            "executor_profile__user",
        )
        .order_by("-created_at")
    )


def get_employer_task_bids(*, user, task_id):
    """Get bids for a specific task owned by the employer."""

    from tasks.models import Task
    from .models import Bid

    _require_employer_for_bids(user)

    task_exists = Task.objects.filter(
        pk=task_id,
        employer_user_id=user.pk,
    ).exists()

    if not task_exists:
        raise NotFound("Task not found.")

    return (
        Bid.objects
        .filter(
            task_id=task_id,
            task__employer_user_id=user.pk,
        )
        .select_related(
            "task",
            "executor_profile",
            "executor_profile__user",
        )
        .order_by("-created_at")
    )


def get_employer_bid_detail(*, user, bid_id):
    """Get bid details only if its task belongs to the employer."""

    from .models import Bid

    _require_employer_for_bids(user)

    bid = (
        Bid.objects
        .filter(
            bid_id=bid_id,
            task__employer_user_id=user.pk,
        )
        .select_related(
            "task",
            "executor_profile",
            "executor_profile__user",
        )
        .first()
    )

    if bid is None:
        raise NotFound("Bid not found.")

    return bid


