import uuid

from django.db import migrations, models
from django.db.models.functions import Lower
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0011_seed_core_roles"),
    ]

    operations = [
        migrations.AddField(
            model_name="executorprofile",
            name="covers_entire_city",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="WorkerServiceNeighborhood",
            fields=[
                ("neighborhood_id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("executor_profile", models.ForeignKey(
                    to="accounts.executorprofile",
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="service_neighborhoods",
                )),
            ],
            options={
                "db_table": "executor_service_neighborhoods",
                "ordering": ["name", "neighborhood_id"],
            },
        ),
        migrations.AddConstraint(
            model_name="workerserviceneighborhood",
            constraint=models.UniqueConstraint(
                Lower("name"), "executor_profile", name="uq_executor_neighborhood_ci"
            ),
        ),
    ]
