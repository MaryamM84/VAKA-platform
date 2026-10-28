from django.db import models


class TaskStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    OPEN = "OPEN", "Open"
    FUNDING_PENDING = "FUNDING_PENDING", "Funding pending"
    ASSIGNED = "ASSIGNED", "Assigned"
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    SUBMITTED = "SUBMITTED", "Submitted"
    APPROVED = "APPROVED", "Approved"
    DISPUTED = "DISPUTED", "Disputed"
    CANCELLATION_REVIEW = "CANCELLATION_REVIEW", "Cancellation review"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"
    EXPIRED = "EXPIRED", "Expired"


class TaskSkillSource(models.TextChoices):
    MANUAL = "MANUAL", "Manual"
    AI = "AI", "AI"
