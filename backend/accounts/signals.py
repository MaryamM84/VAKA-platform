
from django.db.models.signals import post_migrate
from django.dispatch import receiver


CORE_ROLES = (
    (
        "EMPLOYER",
        "Employer",
        "Can create and manage own tasks.",
    ),
    (
        "EXECUTOR",
        "Executor",
        "Can submit bids after verification approval.",
    ),
    (
        "ADMIN",
        "Platform Administrator",
        "Can manage platform operations.",
    ),
    (
        "ARBITER",
        "Platform Arbiter",
        "Can review disputes.",
    ),
)


@receiver(
    post_migrate,
    dispatch_uid="accounts.ensure_core_roles",
)
def ensure_core_roles(sender, using, **kwargs):

    if sender.label != "accounts":
        return

    from .models import Role

    for code, name, description in CORE_ROLES:

        Role.objects.using(using).get_or_create(
            code=code,
            defaults={
                "name": name,
                "description": description,
            },
        )
