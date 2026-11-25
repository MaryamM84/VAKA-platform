import json

from django.http import Http404, HttpResponse, JsonResponse
from django.test import Client, SimpleTestCase, override_settings
from django.urls import path

from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    Throttled,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from config.api_errors import error_payload
from tasks.lifecycle.errors import TaskTransitionConflict


# ------------------------------------------------------------
# 1. Test-only views
# ------------------------------------------------------------

class ErrorView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, kind):
        if kind == "validation":
            raise ValidationError({
                "title": ["This field is required."],
                "password": ["secret-value-must-not-escape"],
            })

        if kind == "nested":
            raise ValidationError({
                "items": [
                    {"duration": ["Must be positive."]}
                ]
            })

        if kind == "forbidden":
            raise PermissionDenied("You may not do this.")

        if kind == "missing":
            raise NotFound("That record does not exist.")

        if kind == "method":
            return Response(
                {"detail": "Method not allowed."},
                status=405,
            )

        if kind == "conflict":
            raise TaskTransitionConflict(
                source="ASSIGNED",
                target="COMPLETED",
                reason="Illegal step.",
            )

        if kind == "throttled":
            raise Throttled(wait=10)

        if kind == "failure":
            raise RuntimeError(
                "SELECT password FROM private_table; token=secret"
            )

        if kind == "unsafe400":
            raise ValidationError({
                "detail": (
                    "C:\\internal\\users\\private.py "
                    "SELECT * FROM users"
                )
            })

        if kind == "django_validation":
            from django.core.exceptions import (
                ValidationError as DjangoValidationError,
            )
            raise DjangoValidationError({
                "city": ["Invalid city."]
            })

        if kind == "already_wrapped":
            return Response({
                "error": {
                    "code": "custom_error",
                    "message": "Known error.",
                    "details": [],
                }
            }, status=409)

        return Response({"ok": True})


class UnauthenticatedView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = []

    def get(self, request):
        raise NotAuthenticated()


class UnauthorizedView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = []

    def get(self, request):
        raise AuthenticationFailed("Not authorized.")


class LegacyView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        return Response({
            "email": ["This field is required."]
        }, status=400)


class ParserView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        _ = request.data
        return Response({"ok": True})


def django_404(request):
    raise Http404("C:\\internal\\sensitive.txt")


def django_500(request):
    raise RuntimeError(
        "SELECT password FROM private_table; secret=hidden"
    )


def raw_500(request):
    return HttpResponse(
        "/var/private/file.py secret=hidden",
        status=500,
    )


def health(request):
    return JsonResponse({"status": "ok"})


def outside_api_error(request):
    return JsonResponse({
        "detail": "legacy outside api"
    }, status=400)


# These URLs are only used during testing.
urlpatterns = [
    path(
        "api/test/errors/<str:kind>/",
        ErrorView.as_view(),
        name="api-test-errors",
    ),
    path(
        "api/test/unauthenticated/",
        UnauthenticatedView.as_view(),
        name="api-test-unauthenticated",
    ),
    path(
        "api/test/auth-failed/",
        UnauthorizedView.as_view(),
        name="api-test-auth-failed",
    ),
    path(
        "api/test/legacy/",
        LegacyView.as_view(),
        name="api-test-legacy",
    ),
    path(
        "api/test/parser/",
        ParserView.as_view(),
        name="api-test-parser",
    ),
    path(
        "api/test/django-404/",
        django_404,
        name="api-test-django-404",
    ),
    path(
        "api/test/django-500/",
        django_500,
        name="api-test-django-500",
    ),
    path(
        "api/test/raw-500/",
        raw_500,
        name="api-test-raw-500",
    ),
    path(
        "api/health/",
        health,
        name="api-test-health",
    ),
    path(
        "outside-error/",
        outside_api_error,
        name="non-api-error",
    ),
]


# ------------------------------------------------------------
# 2. Tests
# ------------------------------------------------------------

@override_settings(
    ROOT_URLCONF=__name__,
    ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"],
)
class GlobalAPIErrorHandlerTests(SimpleTestCase):

    def setUp(self):
        self.client = Client()

    def assert_envelope(
        self,
        response,
        expected_status,
        expected_code=None,
    ):
        self.assertEqual(response.status_code, expected_status)
        self.assertTrue(
            response["Content-Type"].startswith("application/json")
        )

        payload = response.json()

        self.assertEqual(set(payload), {"error"})
        self.assertEqual(
            set(payload["error"]),
            {"code", "message", "details"},
        )

        self.assertIsInstance(payload["error"]["code"], str)
        self.assertIsInstance(payload["error"]["message"], str)
        self.assertIsInstance(payload["error"]["details"], list)

        if expected_code is not None:
            self.assertEqual(
                payload["error"]["code"],
                expected_code,
            )

        return payload["error"]

    # Test 1
    def test_validation_400_fields_and_private_data_redaction(self):
        response = self.client.get(
            "/api/test/errors/validation/"
        )
        error = self.assert_envelope(
            response, 400, "validation_error"
        )

        self.assertIn({
            "field": "title",
            "message": "This field is required.",
        }, error["details"])

        self.assertIn({
            "field": "password",
            "message": "Invalid value.",
        }, error["details"])

        self.assertNotIn(
            "secret-value-must-not-escape",
            response.content.decode(),
        )
        self.assertEqual(
            response["Cache-Control"],
            "no-store",
        )

    # Test 2
    def test_nested_validation_fields_are_flattened(self):
        error = self.assert_envelope(
            self.client.get("/api/test/errors/nested/"),
            400,
        )

        self.assertIn({
            "field": "items.duration",
            "message": "Must be positive.",
        }, error["details"])

    # Test 3
    def test_401_missing_token(self):
        self.assert_envelope(
            self.client.get("/api/test/unauthenticated/"),
            401,
            "not_authenticated",
        )

    # Test 4
    def test_401_invalid_authentication(self):
        self.assert_envelope(
            self.client.get("/api/test/auth-failed/"),
            401,
            "authentication_failed",
        )

    # Test 5
    def test_403_permission(self):
        self.assert_envelope(
            self.client.get("/api/test/errors/forbidden/"),
            403,
            "permission_denied",
        )

    # Test 6
    def test_404_drf_not_found(self):
        self.assert_envelope(
            self.client.get("/api/test/errors/missing/"),
            404,
            "not_found",
        )

    # Test 7
    def test_404_unmatched_django_url_is_json(self):
        with override_settings(DEBUG=False):
            self.assert_envelope(
                self.client.get(
                    "/api/this-route-does-not-exist/"
                ),
                404,
                "not_found",
            )

    # Test 8
    def test_404_django_view_is_json_and_safe(self):
        response = self.client.get(
            "/api/test/django-404/"
        )
        self.assert_envelope(
            response, 404, "not_found"
        )
        self.assertNotIn(
            "internal",
            response.content.decode(),
        )

    # Test 9
    def test_405_is_normalized(self):
        self.assert_envelope(
            self.client.get("/api/test/errors/method/"),
            405,
            "method_not_allowed",
        )

    # Test 10
    def test_409_domain_conflict_code_and_metadata(self):
        error = self.assert_envelope(
            self.client.get("/api/test/errors/conflict/"),
            409,
            "invalid_task_transition",
        )

        fields = {
            detail["field"]: detail["message"]
            for detail in error["details"]
        }

        self.assertEqual(
            fields["from_status"], "ASSIGNED"
        )
        self.assertEqual(
            fields["to_status"], "COMPLETED"
        )

    # Test 11
    def test_429_throttling(self):
        self.assert_envelope(
            self.client.get("/api/test/errors/throttled/"),
            429,
            "throttled",
        )

    # Test 12
    def test_500_unhandled_drf_exception_has_safe_log(self):
        with override_settings(DEBUG=False):
            with self.assertLogs(
                "vaka.api_errors",
                level="ERROR",
            ) as logged:
                response = self.client.get(
                    "/api/test/errors/failure/"
                )

        error = self.assert_envelope(
            response, 500, "internal_server_error"
        )

        self.assertEqual(error["details"], [])

        wire = response.content.decode()

        for secret in (
            "SELECT",
            "password",
            "private_table",
            "token=secret",
            "RuntimeError",
            "Traceback",
        ):
            self.assertNotIn(secret, wire)

        diagnostics = "\n".join(logged.output)

        self.assertIn("RuntimeError", diagnostics)
        self.assertIn("api-test-errors", diagnostics)

        self.assertNotIn("SELECT", diagnostics)
        self.assertNotIn("private_table", diagnostics)
        self.assertNotIn("token=secret", diagnostics)

    # Test 13
    def test_500_outside_drf_django_exception_safe(self):
        client = Client(raise_request_exception=False)

        with override_settings(DEBUG=False):
            response = client.get(
                "/api/test/django-500/"
            )

        self.assert_envelope(
            response, 500, "internal_server_error"
        )

        for secret in (
            "SELECT",
            "private_table",
            "secret=hidden",
            "Traceback",
        ):
            self.assertNotIn(
                secret,
                response.content.decode(),
            )

    # Test 14
    def test_500_manually_returned_html_is_safe(self):
        response = self.client.get(
            "/api/test/raw-500/"
        )

        self.assert_envelope(
            response, 500, "internal_server_error"
        )

        self.assertNotIn(
            "secret",
            response.content.decode(),
        )

    # Test 15
    def test_manual_400_response_is_normalized(self):
        response = self.client.post(
            "/api/test/legacy/",
            data=json.dumps({}),
            content_type="application/json",
        )

        error = self.assert_envelope(
            response, 400, "validation_error"
        )

        self.assertEqual(
            error["details"],
            [{
                "field": "email",
                "message": "This field is required.",
            }],
        )

        # Existing DRF .data behavior remains available.
        self.assertIn("email", response.data)

    # Test 16
    def test_invalid_json_parser_error(self):
        response = self.client.post(
            "/api/test/parser/",
            data="{bad",
            content_type="application/json",
        )

        self.assert_envelope(
            response, 400, "parse_error"
        )

    # Test 17
    def test_unsafe_400_message_is_redacted(self):
        response = self.client.get(
            "/api/test/errors/unsafe400/"
        )

        self.assert_envelope(response, 400)

        body = response.content.decode()

        self.assertNotIn("internal", body)
        self.assertNotIn("SELECT", body)

    # Test 18
    def test_django_validation_error_converted_to_api_400(self):
        response = self.client.get(
            "/api/test/errors/django_validation/"
        )

        error = self.assert_envelope(
            response, 400, "validation_error"
        )

        self.assertIn({
            "field": "city",
            "message": "Invalid city.",
        }, error["details"])

    # Test 19
    def test_already_wrapped_conflict_not_nested(self):
        self.assert_envelope(
            self.client.get(
                "/api/test/errors/already_wrapped/"
            ),
            409,
            "custom_error",
        )

    # Test 20
    def test_success_responses_are_not_changed(self):
        response = self.client.get("/api/health/")

        self.assertEqual(
            response.json(),
            {"status": "ok"},
        )

        response = self.client.get(
            "/api/test/errors/ok/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"ok": True},
        )

    # Test 21
    def test_non_api_legacy_error_is_not_changed(self):
        response = self.client.get(
            "/outside-error/"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"detail": "legacy outside api"},
        )

    # Test 22
    def test_5xx_payload_is_always_generic(self):
        with self.assertLogs(
            "vaka.api_errors",
            level="ERROR",
        ):
            response = self.client.get(
                "/api/test/raw-500/"
            )

        self.assertEqual(
            response.json(),
            error_payload(500),
        )

    # Test 23
    def test_no_secret_or_raw_body_logging_in_exception_handler(self):
        from config.exception_handler import (
            log_unhandled_api_exception,
        )

        try:
            raise RuntimeError(
                "secret=hidden FROM accounts WHERE password"
            )
        except RuntimeError as exc:
            with self.assertLogs(
                "vaka.api_errors",
                level="ERROR",
            ) as log:
                log_unhandled_api_exception(
                    exc,
                    {"request": None},
                )

        msg = "\n".join(log.output)

        self.assertIn("RuntimeError", msg)
        self.assertNotIn("secret=hidden", msg)
        self.assertNotIn("password", msg)

    # Test 24
    def test_error_detail_list_length_is_bounded(self):
        payload = error_payload(
            400,
            {"field": ["invalid"] * 100},
        )

        self.assertLessEqual(
            len(payload["error"]["details"]),
            30,
        )
