
from django.db import migrations


def create_admin_role(apps, schema_editor):

    Role = apps.get_model("accounts", "Role")

    db_alias = schema_editor.connection.alias

    Role.objects.using(db_alias).get_or_create(
        code="ADMIN",
        defaults={
            "name": "Platform Administrator",
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        (
            "accounts",
            "0009_alter_workerverificationdocument_file",
        ),
    ]

    operations = [
        migrations.RunPython(
            create_admin_role,
            migrations.RunPython.noop,
        ),
    ]
