from django.urls import path

from .views import (
    WalletDepositView,
    WalletSummaryView,
    WalletTransactionDetailView,
    WalletTransactionListView,
)


app_name = "payments"

urlpatterns = [
    path("summary/", WalletSummaryView.as_view(), name="wallet-summary"),
    path("transactions/", WalletTransactionListView.as_view(), name="wallet-transactions"),
    path(
        "transactions/<uuid:transaction_id>/",
        WalletTransactionDetailView.as_view(),
        name="wallet-transaction-detail",
    ),
    path("deposit/", WalletDepositView.as_view(), name="wallet-deposit"),
]
