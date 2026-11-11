"""Index the approximate PostGIS geography point for radius searches."""

from django.contrib.postgres.indexes import GistIndex
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("tasks", "0004_merge_20261108_1457"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="tasklocation",
            index=GistIndex(
                fields=["approximate_point"],
                name="taskloc_approx_gist",
            ),
        ),
    ]
