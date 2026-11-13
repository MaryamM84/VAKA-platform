"""Smoke tests for the generated OpenAPI schema and API documentation."""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class APISchemaTests(APITestCase):
    def test_openapi_schema_is_available(self):
        response = self.client.get(reverse("schema"), {"format": "json"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schema = response.json()
        self.assertIn("/api/tasks/", schema["paths"])
        self.assertIn("/api/task-categories/", schema["paths"])
        self.assertIn("/api/skills/", schema["paths"])
        self.assertIn("/api/profile/me/", schema["paths"])
        self.assertIn("/api/profile/me/avatar/", schema["paths"])
        self.assertIn("/api/profiles/{profile_id}/", schema["paths"])
        self.assertIn("/api/profile/me/skills/", schema["paths"])
        self.assertIn("/api/profile/me/skills/{worker_skill_id}/", schema["paths"])
        self.assertIn("/api/profile/me/preferences/", schema["paths"])
        self.assertIn("/api/profile/me/service-area/", schema["paths"])
        self.assertIn("/api/profile/me/availability/",schema["paths"],)
        self.assertIn("/api/profile/me/availability/{availability_id}/",schema["paths"],)

    def test_swagger_ui_is_available(self):
        response = self.client.get(reverse("swagger-ui"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "swagger-ui")

    def test_worker_coverage_and_statistics_are_documented(self):
        response = self.client.get(reverse("schema"), {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        paths = response.json()["paths"]
        for path in (
            "/api/profile/me/statistics/",
            "/api/profile/me/service-area/neighborhoods/",
            "/api/profile/me/service-area/neighborhoods/{neighborhood_id}/",
        ):
            with self.subTest(path=path):
                self.assertIn(path, paths)
    def test_frontend_gap_endpoints_are_documented(self):
        response = self.client.get(
            reverse("schema"),
            {"format": "json"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        paths = response.json()["paths"]

        expected_paths = [
            "/api/offers/bids/",
            "/api/offers/employer/bids/{bid_id}/accept/",
            "/api/offers/employer/bids/{bid_id}/reject/",
            "/api/tasks/{task_id}/",
            "/api/tasks/{task_id}/cancel/",
            "/api/profile/me/",
            "/api/profile/me/avatar/",
            "/api/profiles/{profile_id}/",
        ]

        for path in expected_paths:
            with self.subTest(path=path):
                self.assertIn(path, paths)

        self.assertIn(
            "patch",
            paths["/api/tasks/{task_id}/"],
        )

        self.assertIn(
            "post",
            paths["/api/tasks/{task_id}/cancel/"],
        )

        self.assertIn(
            "post",
            paths[
                "/api/offers/employer/bids/{bid_id}/accept/"
            ],
        )

        self.assertIn(
            "post",
            paths[
                "/api/offers/employer/bids/{bid_id}/reject/"
            ],
        )
