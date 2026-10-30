import uuid
from django.conf import settings
from django.db import models
from django.db.models import F, Q

from .choices import TaskSkillSource, TaskStatus
from .fields import (
    CurrencyCodeField,
    PostGISGeographyPointField,
)

class TaskCategory(models.Model):
    category_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent_category = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True,
        related_name="children",
    )
    name = models.CharField(max_length=120)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "task_categories"

    def __str__(self):
        return self.name


class Skill(models.Model):
    skill_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(
        TaskCategory, on_delete=models.PROTECT, null=True, blank=True,
        related_name="skills",
    )
    name = models.CharField(max_length=120)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "skills"
        constraints = [
            models.UniqueConstraint(
                fields=["category", "name"],
                name="uq_skills_category_name",
            ),
        ]

    def __str__(self):
        return self.name


class Task(models.Model):
    task_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employer_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="created_tasks",
    )
    category = models.ForeignKey(
        TaskCategory, on_delete=models.PROTECT,
        related_name="tasks",
    )
    reposted_from_task = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True,
        related_name="reposted_tasks",
    )
    title = models.CharField(max_length=180)
    description = models.TextField()
    status = models.CharField(
        max_length=24, choices=TaskStatus.choices, default=TaskStatus.DRAFT,
    )
    estimated_duration_minutes = models.SmallIntegerField()
    wage_budget_amount = models.BigIntegerField()
    currency_code = CurrencyCodeField(default="IRR")
    item_cost_cap_amount = models.BigIntegerField(null=True, blank=True)
    receipt_required = models.BooleanField(default=False)
    execution_window_start_at = models.DateTimeField()
    execution_window_end_at = models.DateTimeField()
    deadline_at = models.DateTimeField(null=True, blank=True)
    proposal_deadline_at = models.DateTimeField()
    delivery_criteria = models.TextField()
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    version = models.IntegerField(default=1)

    class Meta:
        db_table = "tasks"
        constraints = [
            models.CheckConstraint(
                condition=Q(estimated_duration_minutes__gte=1)
                & Q(estimated_duration_minutes__lte=300),
                name="ck_tasks_duration_1_300",
            ),
            models.CheckConstraint(
                condition=Q(wage_budget_amount__gte=0),
                name="ck_tasks_wage_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(item_cost_cap_amount__isnull=True)
                | Q(item_cost_cap_amount__gte=0),
                name="ck_tasks_item_cap_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(execution_window_end_at__gt=F("execution_window_start_at")),
                name="ck_tasks_execution_window_order",
            ),
            models.CheckConstraint(
                condition=Q(status__in=TaskStatus.values),
                name="ck_tasks_status_valid",
            ),
        ]

    def __str__(self):
        return self.title


class TaskAttachment(models.Model):
    attachment_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name="attachments",
    )
    uploaded_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="uploaded_task_attachments",
    )
    storage_key = models.TextField()
    file_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120)
    size_bytes = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "task_attachments"


class TaskStatusHistory(models.Model):
    history_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        Task, on_delete=models.PROTECT, related_name="status_history",
    )
    from_status = models.CharField(
        max_length=24, choices=TaskStatus.choices,
        null=True, blank=True,
    )
    to_status = models.CharField(max_length=24, choices=TaskStatus.choices)
    changed_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="task_status_changes",
    )
    reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "task_status_history"
        constraints = [
            models.CheckConstraint(
                condition=Q(from_status__isnull=True)
                | Q(from_status__in=TaskStatus.values),
                name="ck_task_history_from_status_valid",
            ),
            models.CheckConstraint(
                condition=Q(to_status__in=TaskStatus.values),
                name="ck_task_history_to_status_valid",
            ),
        ]


class TaskRequiredSkill(models.Model):
    pk = models.CompositePrimaryKey("task_id", "skill_id")
    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name="required_skills",
    )
    skill = models.ForeignKey(
        Skill, on_delete=models.PROTECT, related_name="required_by_tasks",
    )
    importance = models.SmallIntegerField()
    source = models.CharField(max_length=20, choices=TaskSkillSource.choices)

    class Meta:
        db_table = "task_required_skills"
        constraints = [
            models.CheckConstraint(
                condition=Q(source__in=TaskSkillSource.values),
                name="ck_task_required_skill_source_valid",
            ),
        ]


class TaskLocation(models.Model):
    task_location_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="locations",
    )
    location_type = models.CharField(max_length=20)
    stop_order = models.SmallIntegerField()

    city = models.CharField(max_length=100)
    region = models.CharField(max_length=120)

    approximate_point = PostGISGeographyPointField()
    exact_point = PostGISGeographyPointField(
        null=True,
        blank=True,
    )

    exact_address_ciphertext = models.BinaryField(
        null=True,
        blank=True,
    )
    location_notes = models.TextField(
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "task_locations"
        ordering = ["stop_order", "task_location_id"]

class PriceEstimate(models.Model):
    price_estimate_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    requested_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="requested_price_estimates",
    )

    task = models.ForeignKey(
        Task,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="price_estimates",
    )

    category = models.ForeignKey(
        TaskCategory,
        on_delete=models.PROTECT,
        related_name="price_estimates",
    )

    estimated_duration_minutes = models.SmallIntegerField()

    difficulty_level = models.SmallIntegerField(
        null=True,
        blank=True,
    )

    approximate_point = PostGISGeographyPointField(
        null=True,
        blank=True,
    )

    suggested_min_amount = models.BigIntegerField()

    suggested_max_amount = models.BigIntegerField()

    model_version = models.CharField(
        max_length=80,
    )

    feature_snapshot = models.JSONField()

    explanation = models.TextField()

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        db_table = "price_estimates"

        constraints = [
            models.CheckConstraint(
                condition=Q(
                    suggested_min_amount__lte=F(
                        "suggested_max_amount"
                    )
                ),
                name="ck_price_estimates_range_order",
            ),
            models.CheckConstraint(
                condition=(
                    Q(estimated_duration_minutes__gte=1)
                    & Q(estimated_duration_minutes__lte=300)
                ),
                name="ck_price_estimates_duration_1_300",
            ),
        ]
