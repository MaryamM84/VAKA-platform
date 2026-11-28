from rest_framework import serializers

from .models import (
    Wallet,
    WalletDeposit,
    WalletTransaction,
    WalletTransactionType,
)


class WalletSummarySerializer(serializers.ModelSerializer):
    total_balance = serializers.IntegerField(read_only=True)

    class Meta:
        model = Wallet
        fields = (
            "wallet_id",
            "currency_code",
            "total_balance",
            "available_balance",
            "reserved_balance",
            "updated_at",
        )
        read_only_fields = fields


class WalletTransactionSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="transaction_type", read_only=True)
    status = serializers.CharField(read_only=True)
    task_id = serializers.UUIDField(read_only=True, allow_null=True)
    title = serializers.SerializerMethodField()

    class Meta:
        model = WalletTransaction
        fields = (
            "transaction_id",
            "type",
            "direction",
            "amount",
            "currency_code",
            "status",
            "title",
            "description",
            "task_id",
            "created_at",
        )
        read_only_fields = fields

    def get_title(self, obj):
        titles = {
            WalletTransactionType.DEPOSIT: "Wallet deposit",
            WalletTransactionType.ESCROW_RESERVATION: "Escrow reservation",
            WalletTransactionType.ESCROW_RELEASE: "Escrow release",
            WalletTransactionType.ESCROW_REFUND: "Escrow refund",
            WalletTransactionType.PLATFORM_FEE: "Platform service fee",
            WalletTransactionType.WITHDRAWAL: "Wallet withdrawal",
            WalletTransactionType.WITHDRAWAL_FEE: "Withdrawal fee",
        }
        return titles.get(obj.transaction_type, "Wallet transaction")


class WalletDepositRequestSerializer(serializers.Serializer):
    amount = serializers.IntegerField(min_value=1, max_value=(2**63) - 1)


class WalletDepositResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletDeposit
        fields = (
            "deposit_id",
            "status",
            "amount",
            "currency_code",
            "payment_url",
            "expires_at",
        )
        read_only_fields = fields
