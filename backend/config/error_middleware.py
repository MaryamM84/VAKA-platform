
"""Wire-level error envelope, including DRF and non-DRF /api/ responses.

A few legacy views return Response(..., status=4xx) directly rather than
raising APIException. DRF's EXCEPTION_HANDLER never sees such responses.
This middleware normalizes all API HTTP errors without touching success bodies.
"""

import json
import logging

from django.core.exceptions import PermissionDenied, SuspiciousOperation
from django.http import Http404, JsonResponse

from .api_errors import error_payload
from .exception_handler import log_unhandled_api_exception


logger = logging.getLogger("vaka.api_errors")


class APIErrorEnvelopeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def process_exception(self, request, exception):
        """Handle unexpected Django view errors without Django's debug page/log.

        This applies only to /api/ routes not already handled by DRF. Known
        framework errors keep their original status via Django's usual path.
        """
        if not request.path.startswith("/api/"):
            return None

        if isinstance(
            exception,
            (Http404, PermissionDenied, SuspiciousOperation),
        ):
            return None

        log_unhandled_api_exception(
            exception,
            {"request": request},
        )

        response = JsonResponse(
            error_payload(500),
            status=500,
        )
        response._api_exception_logged = True
        return response

    def __call__(self, request):
        response = self.get_response(request)

        if (
            not request.path.startswith("/api/")
            or response.status_code < 400
        ):
            return response

        if response.streaming:
            # Do not consume streaming responses.
            return response

        payload = getattr(
            response,
            "_api_error_payload",
            None,
        )

        if payload is None:
            source = None
            content_type = response.get("Content-Type", "")

            if "json" in content_type.lower():
                try:
                    if len(response.content) <= 64 * 1024:
                        source = json.loads(response.content)
                except (
                    UnicodeDecodeError,
                    ValueError,
                    TypeError,
                ):
                    pass

            payload = error_payload(
                response.status_code,
                source,
            )

        if (
            response.status_code >= 500
            and not getattr(
                response,
                "_api_exception_logged",
                False,
            )
        ):
            match = getattr(
                request,
                "resolver_match",
                None,
            )

            logger.error(
                "API server-error response status=%s route=%s",
                response.status_code,
                getattr(match, "url_name", None)
                or "unresolved",
            )

        # Replace the HTTP response body with the canonical error envelope.
        response.content = json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")

        response["Content-Type"] = "application/json; charset=utf-8"
        response["Cache-Control"] = "no-store"

        if response.has_header("Content-Length"):
            response["Content-Length"] = str(
                len(response.content)
            )

        return response
