
from django.test import TestCase

from accounts.models import Role


class CoreRoleSeedTests(TestCase):

    def test_all_core_roles_are_seeded(self):

        expected_roles = {
            "EMPLOYER",
            "EXECUTOR",
            "ADMIN",
            "ARBITER",
        }

        actual_roles = set(
            Role.objects.filter(
                code__in=expected_roles,
            ).values_list(
                "code",
                flat=True,
            )
        )

        self.assertEqual(
            actual_roles,
            expected_roles,
        )
