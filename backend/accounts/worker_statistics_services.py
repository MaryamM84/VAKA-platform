from offers.models import Bid, BidStatus
from tasks.choices import TaskStatus

from .models import ExecutorProfile


def get_worker_statistics(*, user):
    """Return defensible metrics only; unavailable domain concepts stay null.

    Eight equal-weight profile checks are an initial UI contract, not a
    regulatory or verification-completion score. Revisit with the frontend.
    """
    profile = ExecutorProfile.objects.filter(user=user).first()

    submitted_bids = 0
    completed_tasks = 0
    if profile is not None:
        submitted_bids = Bid.objects.filter(executor_profile=profile).count()
        completed_tasks = (
            Bid.objects.filter(
                executor_profile=profile,
                status=BidStatus.ACCEPTED,
                task__status=TaskStatus.COMPLETED,
            )
            .values("task_id")
            .distinct()
            .count()
        )

    has_skills = bool(profile and profile.worker_skills.exists())
    has_preferences = bool(profile and (
        profile.work_interests or profile.preferred_categories.exists()
    ))
    has_area = bool(profile and (
        profile.covers_entire_city
        or profile.service_neighborhoods.exists()
        or (
            profile.service_area_latitude is not None
            and profile.service_area_longitude is not None
            and profile.service_area_radius_km is not None
        )
    ))
    checks = [
        bool(user.full_name.strip()),
        bool(user.email),
        bool(user.avatar_key),
        bool(profile and profile.bio and profile.bio.strip()),
        has_skills,
        has_preferences,
        bool(profile and profile.service_area_city.strip()),
        has_area,
    ]
    completed_checks = sum(checks)
    percentage = int((completed_checks * 100 / len(checks)) + 0.5)

    return {
        "average_rating": None,  # No reviews/ratings model yet.
        "completed_tasks_count": completed_tasks,  # Accepted bid + completed task.
        "received_offers_count": None,  # Workers submit bids; they do not receive them.
        "submitted_bids_count": submitted_bids,
        "profile_completion_percent": percentage,
    }
