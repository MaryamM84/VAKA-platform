"""Executor progress reports and immutable submitted delivery evidence."""
import uuid

import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0014_workerverificationidentity"),
        ("tasks", "0007_task_urgency"),
    ]

    operations = [
        migrations.CreateModel(
            name="TaskProgressReport",
            fields=[
                ("report_id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("progress_percent", models.PositiveSmallIntegerField()),
                ("description", models.TextField()),
                ("on_schedule", models.BooleanField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("executor_profile", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="progress_reports", to="accounts.executorprofile",
                )),
                ("task", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="progress_reports", to="tasks.task",
                )),
            ],
            options={
                "db_table": "task_progress_reports",
                "ordering": ["-created_at", "-report_id"],
                "indexes": [models.Index(fields=["task", "-created_at"], name="exec_report_task_time_idx")],
            },
        ),
        migrations.AddConstraint(
            model_name="taskprogressreport",
            constraint=models.CheckConstraint(
                condition=Q(progress_percent__in=[25, 50, 75, 100]),
                name="ck_exec_report_progress_steps",
            ),
        ),
        migrations.CreateModel(
            name="TaskDelivery",
            fields=[
                ("delivery_id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("summary", models.TextField()),
                ("evidence_urls", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("executor_profile", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="submitted_deliveries", to="accounts.executorprofile",
                )),
                ("task", models.OneToOneField(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="delivery", to="tasks.task",
                )),
            ],
            options={"db_table": "task_deliveries"},
        ),
    ]
