
"""Pagination configuration for public task discovery endpoints."""

from rest_framework.pagination import PageNumberPagination


class TaskDiscoveryPagination(PageNumberPagination):
    """Return discoverable tasks in pages of at most 50 items."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50
    page_query_param = "page"
