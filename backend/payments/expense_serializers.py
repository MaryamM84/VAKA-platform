"""Input and public response contracts for receipted expense claims."""

from django.urls import reverse
from rest_framework import serializers

from .expense_models import ExpenseClaim, ExpenseReceipt
from .expense_receipts import MAX_RECEIPTS, validated_receipt


class StrictExpenseSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError("Expected a form or JSON object.")
        unexpected = set(data.keys()) - set(self.fields.keys())
        if unexpected:
            raise serializers.ValidationError({
                field: "Unexpected input field." for field in sorted(unexpected)
            })
        return super().to_internal_value(data)


class ExpenseClaimCreateSerializer(StrictExpenseSerializer):
    amount_irr = serializers.IntegerField(min_value=1, max_value=2**63 - 1)
    description = serializers.CharField(min_length=1, max_length=2000, trim_whitespace=True)
    receipts = serializers.ListField(
        child=serializers.FileField(allow_empty_file=False),
        min_length=1, max_length=MAX_RECEIPTS, allow_empty=False,
    )

    def validate_receipts(self, value):
        return [validated_receipt(file) for file in value]


class ExpenseRejectSerializer(StrictExpenseSerializer):
    reason = serializers.CharField(min_length=1, max_length=1000, trim_whitespace=True)


class ExpenseReceiptReadSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ExpenseReceipt
        fields = ["receipt_id", "mime_type", "size_bytes", "url"]

    def get_url(self, receipt):
        claim = receipt.claim
        url = reverse("expense-claim-receipt", kwargs={
            "task_id": claim.task_id,
            "claim_id": claim.pk,
            "receipt_id": receipt.pk,
        })
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class ExpenseClaimReadSerializer(serializers.ModelSerializer):
    receipts = ExpenseReceiptReadSerializer(many=True, read_only=True)

    class Meta:
        model = ExpenseClaim
        fields = [
            "claim_id", "task_id", "executor_profile_id", "amount_irr",
            "currency_code", "description", "status", "created_at", "reviewed_at",
            "rejection_reason", "receipts",
        ]
        read_only_fields = fields
