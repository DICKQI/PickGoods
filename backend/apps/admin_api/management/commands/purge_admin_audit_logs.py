from django.core.management.base import BaseCommand

from apps.admin_api.services import purge_admin_audit_logs


class Command(BaseCommand):
    help = "删除超过保留期的管理员操作日志"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="保留天数；省略时使用 settings.ADMIN_AUDIT_RETENTION_DAYS（默认 365）",
        )

    def handle(self, *args, **options):
        days = options["days"]
        deleted = purge_admin_audit_logs(days)
        effective = days if days is not None else "settings.ADMIN_AUDIT_RETENTION_DAYS"
        self.stdout.write(
            self.style.SUCCESS(
                f"已清理 {deleted} 条超过 {effective} 天的管理员操作日志"
            )
        )
