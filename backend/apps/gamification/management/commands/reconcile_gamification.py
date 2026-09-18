from django.core.management.base import BaseCommand

from apps.goods.models import Goods, Showcase
from apps.reminder.models import Preorder
from apps.gamification.models import MetricEvent

from apps.gamification.services import (
    GamificationConfig,
    evaluate_user,
    sync_goods_source,
    sync_preorder_source,
    sync_showcase_altar,
)


class Command(BaseCommand):
    help = "按来源高水位幂等修复游戏化事件和成就状态。"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--baseline-only", action="store_true")

    def handle(self, *args, **options):
        config = GamificationConfig.load()
        if config.rollout_at is None:
            self.stderr.write(self.style.WARNING("未初始化累计起点，先执行 initialize_gamification。"))
            return
        if options["dry_run"]:
            self.stdout.write(
                "[dry-run] "
                f"将检查谷子 {Goods.objects.count()}、预购 {Preorder.objects.count()}、"
                f"展柜 {Showcase.objects.count()}"
            )
            return
        emit_events = not options["baseline_only"]
        user_ids = set(MetricEvent.objects.values_list("user_id", flat=True).distinct())
        for preorder_id in Preorder.objects.values_list("id", flat=True).iterator():
            preorder = Preorder.objects.only("user_id").get(pk=preorder_id)
            user_ids.add(preorder.user_id)
            sync_preorder_source(preorder_id, emit_events=emit_events)
        for goods_id in Goods.objects.values_list("id", flat=True).iterator():
            goods = Goods.objects.only("user_id").get(pk=goods_id)
            user_ids.add(goods.user_id)
            sync_goods_source(goods_id, emit_events=emit_events)
        for showcase_id in Showcase.objects.filter(character__isnull=False).values_list("id", flat=True).iterator():
            showcase = Showcase.objects.only("user_id").get(pk=showcase_id)
            user_ids.add(showcase.user_id)
            sync_showcase_altar(showcase_id, emit_events=emit_events)
        if emit_events:
            from apps.users.models import User

            for user in User.objects.filter(id__in=user_ids, account_type="collector").iterator():
                evaluate_user(user, force=True)
        self.stdout.write(self.style.SUCCESS("游戏化数据修复完成。"))
