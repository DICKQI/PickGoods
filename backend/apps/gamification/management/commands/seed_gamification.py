from django.core.management.base import BaseCommand

from apps.gamification.services import seed_defaults


class Command(BaseCommand):
    help = "幂等写入默认成就系列、阶梯、条件与奖励。"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        if options["dry_run"]:
            self.stdout.write("[dry-run] 将写入默认成就系列、阶梯、条件与奖励")
            return
        counts = seed_defaults()
        self.stdout.write(
            self.style.SUCCESS(
                f"默认配置完成：系列 {counts['sets']}，成就 {counts['achievements']}，奖励 {counts['rewards']}"
            )
        )
