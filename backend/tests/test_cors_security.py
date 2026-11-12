
from django.test import SimpleTestCase, override_settings


@override_settings(
    CORS_ALLOWED_ORIGINS=["http://localhost:3000"]
)
class CORSSecurityTests(SimpleTestCase):

    def test_allowed_origin(self):
        response = self.client.get(
            "/api/health/",
            HTTP_ORIGIN="http://localhost:3000",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get("Access-Control-Allow-Origin"),
            "http://localhost:3000",
        )

    def test_disallowed_origin(self):
        response = self.client.get(
            "/api/health/",
            HTTP_ORIGIN="https://untrusted.example",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(
            response.get("Access-Control-Allow-Origin")
        )

    def test_allowed_preflight(self):
        response = self.client.options(
            "/api/health/",
            HTTP_ORIGIN="http://localhost:3000",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get("Access-Control-Allow-Origin"),
            "http://localhost:3000",
        )
