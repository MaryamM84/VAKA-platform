
from django.urls import path

from .views import (
    BidSubmissionView,
    MyBidsListView,
    MyBidDetailView,
)


app_name = "offers"

urlpatterns = [
    path(
        "bids/",
        BidSubmissionView.as_view(),
        name="bid-submit",
    ),

    path(
        "my_bids/",
        MyBidsListView.as_view(),
        name="my-bids",
    ),

    path(
        "bids/<uuid:bid_id>/",
        MyBidDetailView.as_view(),
        name="my-bid-detail",
    ),
]
