import uuid

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.db.models import F, Q
from .storage import private_verification_storage


class UserManager(BaseUserManager):
    def create_user(self, phone, full_name="", password=None, **extra_fields):
        if not phone:
            raise ValueError("Phone number is required.")

        phone = phone.strip()
        if not phone:
            raise ValueError("Phone number is required.")

        user = self.model(
            phone=phone,
            full_name=full_name or "",
            **extra_fields,
        )

        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser):

    class AccountStatus(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"
        DELETED = "DELETED", "Deleted"

    user_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    phone = models.CharField(max_length=32, unique=True)

    phone_verified_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    email = models.EmailField(
        max_length=254,
        null=True,
        blank=True,
    )

    password = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_column="password_hash",
    )

    full_name = models.CharField(
        max_length=160,
        blank=True,
        default="",
    )

    avatar_key = models.TextField(
        null=True,
        blank=True,
    )

    account_status = models.CharField(
        max_length=16,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    last_login = models.DateTimeField(
        null=True,
        blank=True,
        db_column="last_login_at",
    )

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    @property
    def is_active(self):
        return (
            self.account_status == self.AccountStatus.ACTIVE
            and self.phone_verified_at is not None
        )

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.phone


class Role(models.Model):

    role_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=80)

    description = models.TextField(
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "roles"

    def __str__(self):
        return self.code


class UserRole(models.Model):

    pk = models.CompositePrimaryKey(
        "user_id",
        "role_id",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )

    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )

    assigned_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_roles",
    )

    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_roles"

    def __str__(self):
        return f"{self.user_id} - {self.role.code}"


class ExecutorProfile(models.Model):

    class VerificationStatus(models.TextChoices):
        NOT_SUBMITTED = "NOT_SUBMITTED", "Not submitted"
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    executor_profile_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="executor_profile",
    )

    bio = models.TextField(
        null=True,
        blank=True,
    )

    work_interests = models.JSONField(
        default=list,
        blank=True,
    )

    preferred_categories = models.ManyToManyField(
        "tasks.TaskCategory",
        blank=True,
        related_name="preferred_by_executors",
    )

    service_area_city = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    service_area_region = models.CharField(
        max_length=120,
        blank=True,
        default="",
    )

    service_area_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )

    service_area_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )

    service_area_radius_km = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
    )

    availability_timezone = models.CharField(
        max_length=64,
        default="UTC",
    )

    application_submitted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.NOT_SUBMITTED,
    )

    profile_status = models.CharField(
        max_length=16,
        default="ACTIVE",
    )

    reviewed_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_executor_profiles",
    )

    approved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    rejection_reason = models.TextField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "executor_profiles"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (
                        Q(service_area_latitude__isnull=True)
                        & Q(service_area_longitude__isnull=True)
                        & Q(service_area_radius_km__isnull=True)
                    )
                    |
                    (
                        Q(service_area_latitude__isnull=False)
                        & Q(service_area_longitude__isnull=False)
                        & Q(service_area_radius_km__isnull=False)
                    )
                ),
                name="ck_executor_area_complete",
            ),
            models.CheckConstraint(
                condition=(
                    Q(service_area_latitude__isnull=True)
                    |
                    Q(
                        service_area_latitude__gte=-90,
                        service_area_latitude__lte=90,
                    )
                ),
                name="ck_executor_area_latitude",
            ),
            models.CheckConstraint(
                condition=(
                    Q(service_area_longitude__isnull=True)
                    |
                    Q(
                        service_area_longitude__gte=-180,
                        service_area_longitude__lte=180,
                    )
                ),
                name="ck_executor_area_longitude",
            ),
            models.CheckConstraint(
                condition=Q(
                    verification_status__in=[
                        "NOT_SUBMITTED",
                        "PENDING",
                        "APPROVED",
                        "REJECTED",
                    ]
                ),
                name="ck_executor_profile_verification_status",
            ),
        ]

    def __str__(self):
        return f"ExecutorProfile: {self.user_id}"


class WorkerSkill(models.Model):
    class ProficiencyLevel(models.TextChoices):
        BEGINNER = "BEGINNER", "Beginner"
        INTERMEDIATE = "INTERMEDIATE", "Intermediate"
        ADVANCED = "ADVANCED", "Advanced"
        EXPERT = "EXPERT", "Expert"

    worker_skill_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    executor_profile = models.ForeignKey(
        ExecutorProfile,
        on_delete=models.CASCADE,
        related_name="worker_skills",
    )

    skill = models.ForeignKey(
        "tasks.Skill",
        on_delete=models.PROTECT,
        related_name="worker_profiles",
    )

    proficiency_level = models.CharField(
        max_length=16,
        choices=ProficiencyLevel.choices,
        default=ProficiencyLevel.BEGINNER,
    )

    experience_years = models.PositiveSmallIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "worker_skills"
        constraints = [
            models.UniqueConstraint(
                fields=["executor_profile", "skill"],
                name="uq_worker_profile_skill",
            ),
            models.CheckConstraint(
                condition=Q(experience_years__lte=60),
                name="ck_worker_skill_experience",
            ),
        ]

    def __str__(self):
        return f"{self.executor_profile.user_id} - {self.skill.name}"


class WorkerAvailability(models.Model):
    class Weekday(models.IntegerChoices):
        SATURDAY = 0, "Saturday"
        SUNDAY = 1, "Sunday"
        MONDAY = 2, "Monday"
        TUESDAY = 3, "Tuesday"
        WEDNESDAY = 4, "Wednesday"
        THURSDAY = 5, "Thursday"
        FRIDAY = 6, "Friday"

    availability_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    executor_profile = models.ForeignKey(
        ExecutorProfile,
        on_delete=models.CASCADE,
        related_name="availability_slots",
    )

    weekday = models.PositiveSmallIntegerField(
        choices=Weekday.choices,
    )

    start_time = models.TimeField()
    end_time = models.TimeField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "worker_availability"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "executor_profile",
                    "weekday",
                    "start_time",
                    "end_time",
                ],
                name="uq_worker_availability_slot",
            ),
            models.CheckConstraint(
                condition=Q(start_time__lt=F("end_time")),
                name="ck_worker_availability_time",
            ),
        ]

    def __str__(self):
        return f"{self.executor_profile.user_id} - {self.weekday}"


class WorkerVerificationDocument(models.Model):
    document_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    executor_profile = models.ForeignKey(
        ExecutorProfile,
        on_delete=models.CASCADE,
        related_name="verification_documents",
    )

    document_type = models.CharField(max_length=40)

    file = models.FileField(
        upload_to="private/worker-verification/%Y/%m/",
        storage=private_verification_storage,
    )

    original_file_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120)
    size_bytes = models.PositiveBigIntegerField()

    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "worker_verification_documents"

    def __str__(self):
        return f"{self.executor_profile.user_id} - {self.document_type}"


class OTPChallenge(models.Model):

    class Purpose(models.TextChoices):
        REGISTER = "REGISTER", "Register"
        LOGIN = "LOGIN", "Login"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="otp_challenges",
    )

    purpose = models.CharField(
        max_length=10,
        choices=Purpose.choices,
    )

    code_hash = models.CharField(max_length=64)

    expires_at = models.DateTimeField()

    last_sent_at = models.DateTimeField()

    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "otp_challenges"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "purpose"],
                name="unique_user_otp_purpose",
            ),
        ]