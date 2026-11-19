"""Run periodically via cron/Celery scheduler; safe to run repeatedly."""
from django.core.management.base import BaseCommand
from tasks.lifecycle.expiry import expire_open_tasks


class Command(BaseCommand):
    help = "Expire overdue OPEN tasks and their ACTIVE bids (no money released)."

    def handle(self, *args, **options):
        count = expire_open_tasks()
        self.stdout.write(self.style.SUCCESS(f"Expired {count} task(s)."))
