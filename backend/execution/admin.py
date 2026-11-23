from django.contrib import admin

from .models import TaskDelivery, TaskProgressReport


@admin.register(TaskProgressReport)
class TaskProgressReportAdmin(admin.ModelAdmin):
    list_display = ("report_id", "task", "executor_profile", "progress_percent", "on_schedule", "created_at")
    search_fields = ("task__title", "executor_profile__user__phone")
    list_filter = ("progress_percent", "on_schedule")
    readonly_fields = ("report_id", "task", "executor_profile", "progress_percent", "description", "on_schedule", "created_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(TaskDelivery)
class TaskDeliveryAdmin(admin.ModelAdmin):
    list_display = ("delivery_id", "task", "executor_profile", "created_at")
    search_fields = ("task__title", "executor_profile__user__phone")
    readonly_fields = ("delivery_id", "task", "executor_profile", "summary", "evidence_urls", "created_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
