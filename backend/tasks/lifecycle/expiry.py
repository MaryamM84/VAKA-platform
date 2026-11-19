"""Safe scheduler hook for expiring still-open tasks, FS §7.2 & BR-10.

Call `manage.py expire_open_tasks` periodically from a real scheduler.
No financial records are altered or funds released by this process.
"""
from django.db import transaction
from django.utils import timezone
from offers.models import Bid, BidStatus, BidStatusHistory
from tasks.choices import TaskStatus
from tasks.models import Task
from .engine import transition_task_locked


def expire_open_tasks():
    now = timezone.now()
    task_ids = list(Task.objects.filter(
        status=TaskStatus.OPEN, published_at__isnull=False,
        deleted_at__isnull=True, proposal_deadline_at__lte=now,
    ).values_list("pk", flat=True))
    changed = 0
    for task_id in task_ids:
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=task_id)
            if (
                task.status != TaskStatus.OPEN
                or task.deleted_at is not None
                or task.proposal_deadline_at > timezone.now()
            ):
                continue
            bids = list(Bid.objects.select_for_update().filter(
                task=task, status=BidStatus.ACTIVE,
            ).order_by("bid_id"))
            transition_task_locked(
                task=task, target=TaskStatus.EXPIRED,
                event="proposal_deadline_elapsed", actor=None,
                reason="Proposal deadline elapsed",
            )
            for bid in bids:
                old = bid.status
                bid.status = BidStatus.EXPIRED
                bid.save(update_fields=["status", "updated_at"])
                BidStatusHistory.objects.create(
                    bid=bid, from_status=old, to_status=BidStatus.EXPIRED,
                    reason="Task proposal deadline elapsed",
                )
            changed += 1
    return changed
