"""把历史 IP 封面的外链转存到本站媒体目录（一次性/可重跑的数据迁移命令）。

背景：封面历史上直接存 Bangumi CDN 外链，图片由浏览器去第三方站点拉取，客户端
访问不了 BGM CDN 就只剩首字占位。新版写入路径已经全部转存，但老数据仍在库里：

    python manage.py cache_ip_covers            # 干跑：只统计要处理的条目
    python manage.py cache_ip_covers --apply    # 真正下载并回写

常用参数：

- ``--limit N``：本次最多处理 N 条（分批跑，避免一次请求过久）；
- ``--ids 1,2,3``：只处理指定 IP；
- ``--force``：连已经托管的 /media/ 封面也重新下载（一般不需要）。

失败的条目会打印原因（多为服务器出网/代理问题），修好后直接重跑即可，成功
的条目不会重复处理。
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.goods.cover_cache import CoverCacheError, cache_cover_from_url, is_remote_url
from apps.goods.models import IP


class Command(BaseCommand):
    help = "把 IP 封面的外链转存到本站媒体目录（/media/ips/covers/）"

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="真正下载并回写；不加时只做干跑统计",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="本次最多处理多少条（默认全部）",
        )
        parser.add_argument(
            "--ids",
            default="",
            help="只处理这些 IP id，逗号分隔",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="连已托管的 /media/ 封面也重新下载（默认跳过）",
        )

    def handle(self, *args, **options):
        apply_changes = bool(options["apply"])
        force = bool(options["force"])
        limit = options["limit"]

        queryset = IP.objects.all().order_by("id")
        ids = [
            int(part)
            for part in str(options.get("ids") or "").replace(" ", "").split(",")
            if part
        ]
        if ids:
            queryset = queryset.filter(pk__in=ids)

        candidates = []
        for ip in queryset.only("id", "name", "cover_image", "user_id"):
            cover = (ip.cover_image or "").strip()
            if not cover:
                continue
            if is_remote_url(cover) or (force and cover.startswith("/media/")):
                candidates.append(ip)

        total = len(candidates)
        if limit and limit > 0:
            candidates = candidates[:limit]

        self.stdout.write(
            f"待转存封面的 IP：{total} 个"
            + (f"（本次处理前 {len(candidates)} 个）" if limit else "")
            + ("" if apply_changes else "（干跑，不写库）")
        )
        if not candidates:
            self.stdout.write("没有需要转存的封面。")
            return

        updated = failed = 0
        for ip in candidates:
            old_value = (ip.cover_image or "").strip()
            if not apply_changes:
                self.stdout.write(f"  [dry-run] #{ip.id} {ip.name}: {old_value}")
                continue
            try:
                new_value = cache_cover_from_url(old_value)
            except CoverCacheError as exc:
                failed += 1
                self.stderr.write(f"  [fail] #{ip.id} {ip.name}: {exc}")
                continue
            except Exception as exc:
                failed += 1
                self.stderr.write(f"  [fail] #{ip.id} {ip.name}: {exc}")
                continue

            ip.cover_image = new_value
            ip.save(update_fields=["cover_image"])
            updated += 1
            self.stdout.write(f"  [ok] #{ip.id} {ip.name}: {new_value}")

        if apply_changes:
            self.stdout.write(
                self.style.SUCCESS(
                    f"完成：成功 {updated} 个，失败 {failed} 个，剩余 {max(0, total - len(candidates))} 个待处理"
                )
            )
            if failed:
                self.stdout.write("失败通常是服务器出网/代理问题，修好后重跑本命令即可（成功的不会重复处理）。")
