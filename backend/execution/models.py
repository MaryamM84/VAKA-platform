"""Persistent, immutable executor updates and final delivery evidence.

Task status is owned by tasks.lifecycle, never by these models.
"""
import uuid

from django.db import models
from django.db.models import Q


class TaskProgressReport(models.Model):
    report_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        "tasks.Task", on_delete=models.PROTECT, related_name="progress_reports",
    )
    executor_profile = models.ForeignKey(
        "accounts.ExecutorProfile", on_delete=models.PROTECT,
        related_name="progress_reports",
    )
    progress_percent = models.PositiveSmallIntegerField()
    description = models.TextField()
    on_schedule = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "task_progress_reports"
        ordering = ["-created_at", "-report_id"]
        indexes = [
            models.Index(fields=["task", "-created_at"], name="exec_report_task_time_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(progress_percent__in=[25, 50, 75, 100]),
                name="ck_exec_report_progress_steps",
            ),
        ]


class TaskDelivery(models.Model):
    """One final submitted delivery per task, with server-issued evidence ID."""

    delivery_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.OneToOneField(
        "tasks.Task", on_delete=models.PROTECT, related_name="delivery",
    )
    executor_profile = models.ForeignKey(
        "accounts.ExecutorProfile", on_delete=models.PROTECT,
        related_name="submitted_deliveries",
    )
    summary = models.TextField()
    evidence_urls = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "task_deliveries"
