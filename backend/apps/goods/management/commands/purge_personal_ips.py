"""清理用户自建的个人 IP（回滚个人 IP 功能时使用）。

个人 IP 是 ``IP.user`` 非空的行。回滚代码前需要先决定这些数据怎么处理：

- 直接删掉（默认）：``python manage.py purge_personal_ips --apply``
- 先把谷子改挂到某只官方 IP，再删：``--apply --reassign <官方IP id>``
- 连谷子一起删（危险，需显式开启）：``--apply --delete-goods``

不加 ``--apply`` 时是**干跑**：只打印清单与计划，不写库。

注意顺序：本命令必须在 ``migrate goods 0053``（反向迁移）**之前**执行，
否则把 ``unique=True`` 加回 ``IP.name`` 时，多用户同名行会失败。
"""
from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.goods.models import IP


class Command(BaseCommand):
    help = "清理用户自建的个人 IP（回滚个人 IP 功能前先执行本命令）"

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="真正执行删除；不加时只做干跑（打印清单与计划）",
        )
        parser.add_argument(
            "--reassign",
            type=int,
            default=None,
            metavar="IP_ID",
            help="把个人 IP 下的谷子改挂到该官方 IP 后再删除该个人 IP",
        )
        parser.add_argument(
            "--delete-goods",
            action="store_true",
            help="允许连同谷子一起删除（默认跳过带谷子的个人 IP，避免误删用户资产）",
        )

    def handle(self, *args, **options):
        apply_changes = bool(options["apply"])
        reassign_id = options["reassign"]
        delete_goods = bool(options["delete_goods"])

        personal_ips = list(
            IP.objects.filter(user__isnull=False)
            .select_related("user")
            .order_by("id")
        )
        if not personal_ips:
            self.stdout.write("没有个人 IP，无需清理。")
            return

        target_ip = None
        if reassign_id is not None:
            target_ip = IP.objects.filter(pk=reassign_id, user__isnull=True).first()
            if target_ip is None:
                raise CommandError(f"--reassign {reassign_id} 不是已存在的官方 IP")

        self.stdout.write(
            f"发现 {len(personal_ips)} 个个人 IP"
            + ("" if apply_changes else "（干跑，不写库）")
            + "："
        )

        deleted = skipped = reassigned_goods = removed_goods = deleted_chars = 0

        for ip in personal_ips:
            goods_qs = ip.goods.all()
            goods_count = goods_qs.count()
            char_count = ip.characters.count()
            owner = getattr(ip.user, "username", ip.user_id)

            if goods_count and not delete_goods and target_ip is None:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"  跳过 ip={ip.id} name={ip.name} owner={owner} "
                        f"goods={goods_count} characters={char_count}"
                        "  ← 有谷子；可用 --reassign <官方IP id> 或 --delete-goods"
                    )
                )
                continue

            action = "删除"
            if goods_count and delete_goods:
                action = "连谷子删除"
            elif goods_count and target_ip is not None:
                action = f"谷子改挂到 ip={target_ip.id} 后删除"

            self.stdout.write(
                f"  {action} ip={ip.id} name={ip.name} owner={owner} "
                f"goods={goods_count} characters={char_count}"
            )
            if not apply_changes:
                continue

            with transaction.atomic():
                if goods_count and delete_goods:
                    removed_goods += goods_qs.count()
                    goods_qs.delete()
                elif goods_count and target_ip is not None:
                    reassigned_goods += goods_qs.update(ip=target_ip)
                deleted_chars += char_count
                ip.delete()
            deleted += 1

        summary = (
            f"personal_ips={len(personal_ips)} deleted={deleted} "
            f"skipped_with_goods={skipped} reassigned_goods={reassigned_goods} "
            f"deleted_goods={removed_goods} deleted_characters={deleted_chars}"
        )
        if apply_changes:
            self.stdout.write(self.style.SUCCESS(summary))
        else:
            self.stdout.write(f"[干跑] {summary}（加 --apply 才会真正执行）")
