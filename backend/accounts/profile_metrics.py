from offers.models import Bid, BidStatus
from tasks.choices import TaskStatus


ACTIVE_EXECUTOR_TASK_STATUSES = (
    TaskStatus.ASSIGNED,
    TaskStatus.IN_PROGRESS,
    TaskStatus.SUBMITTED,
    TaskStatus.APPROVED,
    TaskStatus.DISPUTED,
    TaskStatus.CANCELLATION_REVIEW,
)


def get_executor_profile_metrics(*, profile):
    if profile is None:
        return {
            "completed_tasks_count": 0,
            "active_tasks_count": 0,
            "average_rating": None,
            "rating_count": None,
        }

    completed_tasks_count = (
        Bid.objects.filter(
            executor_profile=profile,
            status=BidStatus.ACCEPTED,
            task__status=TaskStatus.COMPLETED,
        )
        .values("task_id")
        .distinct()
        .count()
    )
    active_tasks_count = (
        Bid.objects.filter(
            executor_profile=profile,
            status=BidStatus.ACCEPTED,
            task__status__in=ACTIVE_EXECUTOR_TASK_STATUSES,
        )
        .values("task_id")
        .distinct()
        .count()
    )

    return {
        "completed_tasks_count": completed_tasks_count,
        "active_tasks_count": active_tasks_count,
        # The reviews app has no rating model yet; do not fabricate values.
        "average_rating": None,
        "rating_count": None,
    }
