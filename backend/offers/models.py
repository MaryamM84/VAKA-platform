
import uuid

from django.db import models
from django.db.models import Q
from django.conf import settings

class BidStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    ACCEPTED = "ACCEPTED", "Accepted"
    REJECTED = "REJECTED", "Rejected"
    WITHDRAWN = "WITHDRAWN", "Withdrawn"
    EXPIRED = "EXPIRED", "Expired"


class Bid(models.Model):

    bid_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    task = models.ForeignKey(
        "tasks.Task",
        on_delete=models.PROTECT,
        related_name="bids",
    )

    executor_profile = models.ForeignKey(
        "accounts.ExecutorProfile",
        on_delete=models.PROTECT,
        related_name="bids",
    )

    proposed_wage_amount = models.BigIntegerField()

    proposed_duration_minutes = models.SmallIntegerField()

    message = models.TextField()

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=16,
        choices=BidStatus.choices,
        default=BidStatus.ACTIVE,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bids"

        constraints = [

            # One bid per executor for each task
            models.UniqueConstraint(
                fields=["task", "executor_profile"],
                name="uq_bids_task_executor",
            ),

            # Only one accepted bid per task
            models.UniqueConstraint(
                fields=["task"],
                condition=Q(status=BidStatus.ACCEPTED),
                name="uq_bids_one_accepted_per_task",
            ),

            # Composite uniqueness required by the ERD
            # for the future Assignment relationship
            models.UniqueConstraint(
                fields=["bid_id", "task"],
                name="uq_bids_bid_task",
            ),

            # Proposed wage cannot be negative
            models.CheckConstraint(
                condition=Q(proposed_wage_amount__gte=0),
                name="ck_bids_wage_nonnegative",
            ),

            # Proposed duration must be between 1 and 300
            models.CheckConstraint(
                condition=(
                    Q(proposed_duration_minutes__gte=1)
                    & Q(proposed_duration_minutes__lte=300)
                ),
                name="ck_bids_duration_1_300",
            ),

            # Valid bid statuses
            models.CheckConstraint(
                condition=Q(status__in=BidStatus.values),
                name="ck_bids_status_valid",
            ),
        ]

    def __str__(self):
        return (
            f"Bid {self.bid_id} | "
            f"Task {self.task_id} | "
            f"Executor {self.executor_profile_id}"
        )


class BidStatusHistory(models.Model):

    bid_history_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    bid = models.ForeignKey(
        Bid,
        on_delete=models.PROTECT,
        related_name="status_history",
    )

    from_status = models.CharField(
        max_length=16,
        choices=BidStatus.choices,
        null=True,
        blank=True,
    )

    to_status = models.CharField(
        max_length=16,
        choices=BidStatus.choices,
    )

    changed_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bid_status_changes",
    )

    reason = models.TextField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        db_table = "bid_status_history"

        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(from_status__isnull=True)
                    | Q(from_status__in=BidStatus.values)
                ),
                name="ck_bid_history_from_status",
            ),

            models.CheckConstraint(
                condition=Q(to_status__in=BidStatus.values),
                name="ck_bid_history_to_status",
            ),
        ]

        ordering = ["created_at"]

    def __str__(self):
        return f"{self.bid_id}: {self.from_status} -> {self.to_status}"

