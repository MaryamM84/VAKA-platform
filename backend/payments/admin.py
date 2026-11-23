from django.contrib import admin

from .models import (
    EscrowReservation,
    IdempotencyRecord,
    Wallet,
    WalletTransaction,
)


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = (
        "wallet_id",
        "user",
        "currency_code",
        "available_balance",
        "reserved_balance",
        "display_total_balance",
        "updated_at",
    )
    search_fields = ("wallet_id", "user__phone", "user__full_name")
    readonly_fields = (
        "wallet_id",
        "available_balance",
        "reserved_balance",
        "created_at",
        "updated_at",
    )

    @admin.display(description="Total balance")
    def display_total_balance(self, obj):
        return obj.total_balance


@admin.register(EscrowReservation)
class EscrowReservationAdmin(admin.ModelAdmin):
    list_display = (
        "reservation_id",
        "task",
        "bid",
        "wallet",
        "amount",
        "currency_code",
        "status",
        "created_at",
    )
    list_filter = ("status", "currency_code")
    search_fields = ("reservation_id", "operation_reference", "idempotency_key")
    readonly_fields = tuple(field.name for field in EscrowReservation._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_staff


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "transaction_id",
        "wallet",
        "transaction_type",
        "direction",
        "amount",
        "currency_code",
        "created_at",
    )
    list_filter = ("transaction_type", "direction", "currency_code")
    search_fields = ("transaction_id", "operation_reference", "idempotency_key")
    readonly_fields = tuple(field.name for field in WalletTransaction._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_staff


@admin.register(IdempotencyRecord)
class IdempotencyRecordAdmin(admin.ModelAdmin):
    list_display = (
        "idempotency_record_id",
        "user",
        "operation_type",
        "idempotency_key",
        "status",
        "created_at",
        "completed_at",
    )
    list_filter = ("operation_type", "status")
    search_fields = ("idempotency_record_id", "user__phone", "idempotency_key")
    readonly_fields = tuple(field.name for field in IdempotencyRecord._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_staff
