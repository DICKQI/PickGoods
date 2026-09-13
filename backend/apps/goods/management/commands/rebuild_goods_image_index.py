from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from apps.goods.image_match import ModelUnavailableError, refresh_goods_image_fingerprint
from apps.goods.models import Goods, GoodsImageFingerprint


class Command(BaseCommand):
    help = "重建谷子在馆/出街主图的视觉匹配指纹。"

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, help="仅重建指定用户")
        parser.add_argument(
            "--force",
            action="store_true",
            help="即使已有同版本指纹也重新计算",
        )

    def handle(self, *args, **options):
        queryset = (
            Goods.objects.filter(status__in=("in_cabinet", "outdoor"))
            .exclude(Q(main_photo="") | Q(main_photo__isnull=True))
            .select_related("user")
            .order_by("user_id", "id")
        )
        user_id = options.get("user_id")
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        total = queryset.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("没有符合条件的主图需要建立索引"))
            return

        if options["force"]:
            GoodsImageFingerprint.objects.filter(goods__in=queryset).delete()

        self.stdout.write(f"开始重建 {total} 个谷子主图指纹...")
        created = 0
        failures = []
        for index, goods in enumerate(queryset.iterator(chunk_size=100), start=1):
            try:
                if refresh_goods_image_fingerprint(goods, force=options["force"]):
                    created += 1
            except ModelUnavailableError as exc:
                raise CommandError(str(exc)) from exc
            except Exception as exc:  # noqa: BLE001 - 单张坏图不应中断全量任务
                failures.append((goods.pk, str(exc)))
                self.stderr.write(
                    self.style.ERROR(f"[失败] {goods.pk} {goods.name}: {exc}")
                )
            if index % 100 == 0 or index == total:
                self.stdout.write(f"进度 {index}/{total}")

        if failures:
            raise CommandError(
                f"索引重建完成但有 {len(failures)} 张主图失败；"
                "请根据上方错误修复后重试"
            )
        self.stdout.write(
            self.style.SUCCESS(f"索引重建完成：{created} 个指纹已更新")
        )
