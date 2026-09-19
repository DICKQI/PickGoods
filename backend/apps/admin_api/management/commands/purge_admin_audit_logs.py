from django.core.management.base import BaseCommand

from apps.admin_api.services import purge_admin_audit_logs


class Command(BaseCommand):
    help = "删除超过保留期的管理员操作日志"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=365,
            help="保留天数，默认 365",
        )

    def handle(self, *args, **options):
        days = max(1, options["days"])
        deleted = purge_admin_audit_logs(days)
        self.stdout.write(
            self.style.SUCCESS(
                f"已清理 {deleted} 条超过 {days} 天的管理员操作日志"
            )
        )
