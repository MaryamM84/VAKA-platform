
from django.test import SimpleTestCase
from django.urls import reverse


class HealthCheckTests(SimpleTestCase):

    def test_health_endpoint_returns_200(self):
        response = self.client.get(
            reverse("health-check")
        )

        self.assertEqual(response.status_code, 200)

    def test_health_endpoint_returns_ok(self):
        response = self.client.get(
            reverse("health-check")
        )

        self.assertEqual(
            response.json(),
            {"status": "ok"}
        )
