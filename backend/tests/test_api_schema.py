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
