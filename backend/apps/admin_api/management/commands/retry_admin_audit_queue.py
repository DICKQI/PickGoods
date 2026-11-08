from django.core.management.base import BaseCommand

from apps.admin_api.services import retry_admin_audit_queue


class Command(BaseCommand):
    help = (
        "手动排空管理员审计补偿队列。"
        "APScheduler 未启用时（例如日志里出现 APScheduler not installed），"
        "可用本命令配合定时任务补偿。"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=200,
            help="单次最多处理的补偿任务数，默认 200",
        )

    def handle(self, *args, **options):
        limit = max(1, int(options["limit"]))
        resolved = retry_admin_audit_queue(limit)
        self.stdout.write(
            self.style.SUCCESS(f"已补偿写入 {resolved} 条审计记录")
        )
