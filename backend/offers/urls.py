from django.urls import path

from .views import (
    BidSubmissionView,
    MyBidDetailView,
    EmployerBidsListView,
    EmployerTaskBidsListView,
    EmployerBidDetailView,
)


app_name = "offers"

urlpatterns = [
    path(
        "bids/",
        BidSubmissionView.as_view(),
        name="bid-submit",
    ),

    path(
        "bids/<uuid:bid_id>/",
        MyBidDetailView.as_view(),
        name="my-bid-detail",
    ),
    

    path(
        "employer/bids/",
        EmployerBidsListView.as_view(),
        name="employer-bids-list",
    ),

    path(
        "employer/tasks/<uuid:task_id>/bids/",
        EmployerTaskBidsListView.as_view(),
        name="employer-task-bids-list",
    ),

    path(
        "employer/bids/<uuid:bid_id>/",
        EmployerBidDetailView.as_view(),
        name="employer-bid-detail",
    ),

]
