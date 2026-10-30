"""Django admin configuration for task categories and skills."""

from django.contrib import admin

from .models import Skill, TaskCategory


@admin.register(TaskCategory)
class TaskCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "parent_category",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    ordering = ("name",)
    autocomplete_fields = ("parent_category",)


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
    )
    list_filter = ("category",)
    search_fields = ("name", "description", "category__name")
    ordering = ("category__name", "name")
    autocomplete_fields = ("category",)
