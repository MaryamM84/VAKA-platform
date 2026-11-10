from django.db import migrations


ROLE_DATA = [
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
]


def seed_core_roles(apps, schema_editor):

    Role = apps.get_model("accounts", "Role")
    db_alias = schema_editor.connection.alias

    for code, name, description in ROLE_DATA:

        Role.objects.using(db_alias).get_or_create(
            code=code,
            defaults={
                "name": name,
                "description": description,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_seed_admin_role"),
    ]

    operations = [
        migrations.RunPython(
            seed_core_roles,
            migrations.RunPython.noop,
        ),
    ]