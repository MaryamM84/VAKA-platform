
"""Central DRF exception handling and minimal, non-sensitive diagnostics."""

import logging
import traceback

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler, set_rollback

from .api_errors import error_payload


logger = logging.getLogger("vaka.api_errors")


def _safe_route(context):
    request = context.get("request")
    match = getattr(request, "resolver_match", None)

    # Use URL name, not raw URLs with IDs or private data.
    return getattr(match, "url_name", None) or "unresolved"


def log_unhandled_api_exception(exc, context):
    frames = traceback.extract_tb(exc.__traceback__)
    origin = (
        f"{frames[-1].name}:{frames[-1].lineno}"
        if frames
        else "unknown"
    )

    # Never log exception messages, SQL, tokens or request bodies.
    logger.error(
        "Unhandled API exception type=%s route=%s origin=%s",
        type(exc).__name__,
        _safe_route(context),
        origin,
    )


def custom_exception_handler(exc, context):
    """Handle DRF exceptions using the shared error contract.

    The middleware added in the next step will normalize
    the final HTTP response body.
    """

    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, "message_dict"):
            exc = ValidationError(exc.message_dict)
        else:
            exc = ValidationError(exc.messages)

    response = drf_exception_handler(exc, context)

    if response is not None:
        response._api_error_payload = error_payload(
            response.status_code,
            response.data,
            exception=exc,
        )
        return response

    # Unexpected exception: log safely and return a generic response.
    log_unhandled_api_exception(exc, context)

    set_rollback()

    response = Response(
        {"detail": "An unexpected server error occurred."},
        status=500,
    )

    response._api_error_payload = error_payload(500)
    response._api_exception_logged = True

    return response
