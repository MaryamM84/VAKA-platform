from django.contrib import admin

from .models import (
    EscrowReservation,
    IdempotencyRecord,
    Wallet,
    WalletDeposit,
    WalletTransaction,
)


class ReadOnlyFinanceAdmin(admin.ModelAdmin):
    """Finance records are inspected in Admin but changed only by services."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Wallet)
class WalletAdmin(ReadOnlyFinanceAdmin):
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
    readonly_fields = tuple(field.name for field in Wallet._meta.fields)

    @admin.display(description="Total balance")
    def display_total_balance(self, obj):
        return obj.total_balance


@admin.register(EscrowReservation)
class EscrowReservationAdmin(ReadOnlyFinanceAdmin):
    list_display = (
        "reservation_id",
        "task",
        "bid",
        "wallet",
        "amount",
        "platform_fee_amount",
        "platform_fee_rate_bps",
        "fee_payer",
        "status",
        "created_at",
    )
    list_filter = ("status", "currency_code", "fee_payer")
    search_fields = ("reservation_id", "operation_reference", "idempotency_key")
    readonly_fields = tuple(field.name for field in EscrowReservation._meta.fields)


@admin.register(WalletTransaction)
class WalletTransactionAdmin(ReadOnlyFinanceAdmin):
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


@admin.register(IdempotencyRecord)
class IdempotencyRecordAdmin(ReadOnlyFinanceAdmin):
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


@admin.register(WalletDeposit)
class WalletDepositAdmin(ReadOnlyFinanceAdmin):
    list_display = (
        "deposit_id",
        "wallet",
        "amount",
        "currency_code",
        "provider",
        "status",
        "created_at",
    )
    list_filter = ("provider", "status", "currency_code")
    search_fields = ("deposit_id", "provider_reference", "idempotency_key")
    readonly_fields = tuple(field.name for field in WalletDeposit._meta.fields)
