from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.goods.models import GoodsImageMatchAttempt


class Command(BaseCommand):
    help = "清理过期谷子图片识别元数据；查询图片本身从未落盘。"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=180,
            help="保留天数，默认 180 天",
        )

    def handle(self, *args, **options):
        days = max(1, int(options["days"]))
        cutoff = timezone.now() - timedelta(days=days)
        deleted, _ = GoodsImageMatchAttempt.objects.filter(
            created_at__lt=cutoff
        ).delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"已清理 {deleted} 条创建于 {cutoff.isoformat()} 之前的识别元数据"
            )
        )
