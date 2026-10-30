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

    def test_swagger_ui_is_available(self):
        response = self.client.get(reverse("swagger-ui"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "swagger-ui")
