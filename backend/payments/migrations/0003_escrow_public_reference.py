from django.db import migrations, models
import payments.models


def populate_escrow_public_references(apps, schema_editor):
    EscrowReservation = apps.get_model("payments", "EscrowReservation")
    database = schema_editor.connection.alias

    reservation_ids = list(
        EscrowReservation.objects.using(database)
        .filter(public_reference__isnull=True)
        .order_by("created_at", "reservation_id")
        .values_list("reservation_id", flat=True)
    )

    for reservation_id in reservation_ids:
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                "SELECT nextval('payments_escrow_public_reference_seq')"
            )
            sequence_value = cursor.fetchone()[0]
        EscrowReservation.objects.using(database).filter(
            reservation_id=reservation_id
        ).update(public_reference=f"ESC-{sequence_value:06d}")


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0002_commission_and_deposit_foundation"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE SEQUENCE payments_escrow_public_reference_seq "
                "START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1"
            ),
            reverse_sql="DROP SEQUENCE payments_escrow_public_reference_seq",
        ),
        migrations.AddField(
            model_name="escrowreservation",
            name="public_reference",
            field=models.CharField(
                blank=True,
                editable=False,
                max_length=16,
                null=True,
                unique=True,
            ),
        ),
        migrations.RunPython(
            populate_escrow_public_references,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="escrowreservation",
            name="public_reference",
            field=models.CharField(
                default=payments.models.generate_escrow_public_reference,
                editable=False,
                max_length=16,
                unique=True,
            ),
        ),
    ]
