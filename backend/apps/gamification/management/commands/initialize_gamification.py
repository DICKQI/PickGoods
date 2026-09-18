from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.gamification.services import initialize_baseline


class Command(BaseCommand):
    help = "冻结现有谷子、预购和角色痛柜基线，并记录游戏化累计起点。"

    def add_arguments(self, parser):
        parser.add_argument(
            "--at",
            help="ISO 8601 累计起点；省略时使用当前时间。",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        raw_at = options.get("at")
        if raw_at:
            try:
                rollout_at = datetime.fromisoformat(raw_at.replace("Z", "+00:00"))
            except ValueError as exc:
                raise CommandError("--at 必须是 ISO 8601 时间") from exc
        else:
            rollout_at = timezone.now()
        try:
            counts = initialize_baseline(rollout_at, dry_run=options["dry_run"])
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        prefix = "[dry-run] " if options["dry_run"] else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}基线完成：谷子 {counts['goods']}，预购 {counts['preorders']}，"
                f"角色痛柜来源 {counts['showcases']}，起点 {rollout_at.isoformat()}"
            )
        )
