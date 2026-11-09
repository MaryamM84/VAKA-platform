from django.urls import path

from .profile_views import MyProfileView


app_name = "profile"

urlpatterns = [
    path("me/",MyProfileView.as_view(),name="my-profile",),
    
]