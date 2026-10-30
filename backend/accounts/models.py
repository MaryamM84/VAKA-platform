import uuid

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.db.models import Q


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

    full_name = models.CharField(max_length=160, blank=True,default="")

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
        return self.account_status == self.AccountStatus.ACTIVE

    class Meta:
        db_table = "users"
        constraints = [
            models.UniqueConstraint(
                fields=["email"],
                condition=Q(email__isnull=False),
                name="users_email_not_null_unique",
            ),
            models.CheckConstraint(
                condition=Q(account_status__in=[
                    "ACTIVE",
                    "SUSPENDED",
                    "DELETED",
                ]),
                name="users_valid_account_status",
            ),
        ]

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