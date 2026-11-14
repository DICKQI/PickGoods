"""IP 作品封面（Bangumi 条目封面图）解析与批量补齐。

封面来源（按优先级）：

1. 已绑定 ``bgm_subject_id``：``GET /v0/subjects/{id}`` 返回的 ``images``；
2. 未绑定：``POST /v0/search/subjects`` 按作品名搜索，**只接受名称精确匹配**的候选，
   并且不会回写 ``bgm_subject_id``（避免唯一约束冲突与误绑定，绑定仍由
   「从 BGM 更新」弹窗/K 增量同步负责）。

节流：每次尝试（命中或未命中）都会写入 ``IP.cover_checked_at``，
前端据此避免对同一个 IP 反复请求 BGM。
"""
from __future__ import annotations

import time
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from . import bgm_service
from .models import IP

# 默认参数：老 IP 首次进入页面时每次最多补 20 条，避免单个请求过久
DEFAULT_LIMIT = 20
MAX_LIMIT = 50
# 未命中（BGM 确实没有这个条目）的 IP 默认 7 天内不再重试
DEFAULT_STALE_DAYS = 7
# 相邻两次 BGM 请求之间的间隔，尊重 BGM 未公开的频率限制
DEFAULT_SLEEP_SECONDS = 0.25

STATUS_UPDATED = "updated"
STATUS_NO_MATCH = "no_match"
STATUS_ERROR = "error"

# 归一化作品名时忽略的字符（中英文标点/空白/连接符）
_IGNORED_NAME_CHARS = set(
    " \t\n\r\u3000\u00a0"
    ":：;；·・.,，。!！?？\"'“”‘’"
    "()（）[]【】{}<>《》"
    "-—_~～&+/\\|*#"
)


class _DefaultBGMService:
    """把 bgm_service 的模块函数包成可注入的服务对象（便于测试替换）。"""

    @staticmethod
    def get_subject_info(subject_id):
        return bgm_service.get_subject_info(subject_id)

    @staticmethod
    def search_subject_candidates(keyword, subject_type=None, limit=10):
        return bgm_service.search_subject_candidates(keyword, subject_type, limit=limit)


def default_service():
    return _DefaultBGMService()


def normalize_subject_name(value):
    """归一化作品名用于精确匹配：去空白与中英文标点、忽略大小写。"""
    if not isinstance(value, str):
        return ""
    return "".join(ch for ch in value.casefold() if ch not in _IGNORED_NAME_CHARS)


def resolve_ip_cover(ip, *, service=None):
    """解析单个 IP 的封面。

    Args:
        ip: ``IP`` 实例
        service: 可选服务对象，需提供 ``get_subject_info`` / ``search_subject_candidates``

    Returns:
        tuple(str | None, str, str): ``(封面 URL, 状态, 失败原因)``，
        状态取值见 ``STATUS_*``；不抛异常，网络/解析问题统一记为 ``error``。
    """
    service = service or default_service()

    try:
        if ip.bgm_subject_id:
            info = service.get_subject_info(ip.bgm_subject_id) or {}
            cover = bgm_service.pick_cover_url(info.get("images"))
            if cover:
                return cover, STATUS_UPDATED, ""
            return None, STATUS_NO_MATCH, "BGM 条目没有封面图"

        target = normalize_subject_name(ip.name)
        if not target:
            return None, STATUS_NO_MATCH, "作品名为空，无法匹配"

        candidates = service.search_subject_candidates(ip.name, ip.subject_type) or []
        for candidate in candidates:
            names = {
                normalize_subject_name(candidate.get("name")),
                normalize_subject_name(candidate.get("name_cn")),
            }
            if target not in names:
                continue
            cover = bgm_service.pick_cover_url(candidate.get("images"))
            if cover:
                return cover, STATUS_UPDATED, ""
        return None, STATUS_NO_MATCH, "BGM 搜索未找到同名条目"
    except Exception as exc:  # noqa: BLE001 - 单条失败不应该中断整批补齐
        return None, STATUS_ERROR, str(exc)


def refresh_ip_cover(ip, *, force=True, service=None, now=None):
    """解析并保存单个 IP 的封面（供「从 Bangumi 取封面」使用）。

    Returns:
        tuple(str | None, str, str): ``(最终封面 URL, 状态, 失败原因)``
    """
    now = now or timezone.now()
    cover, status, reason = resolve_ip_cover(ip, service=service)

    update_fields = ["cover_checked_at"]
    ip.cover_checked_at = now
    if cover and (force or not ip.cover_image):
        ip.cover_image = cover
        update_fields.append("cover_image")
    ip.save(update_fields=update_fields)

    if status == STATUS_UPDATED and not cover:
        # 命中但被已有封面挡住（force=False 的场景）
        return ip.cover_image, STATUS_NO_MATCH, "本地已有封面，未覆盖"
    return (ip.cover_image if cover else None), status, reason


def _cover_missing_q():
    return Q(cover_image__isnull=True) | Q(cover_image="")


def _stale_q(stale_before):
    return Q(cover_checked_at__isnull=True) | Q(cover_checked_at__lt=stale_before)


def backfill_ip_covers(
    *,
    ids=None,
    force=False,
    limit=DEFAULT_LIMIT,
    stale_days=DEFAULT_STALE_DAYS,
    sleep_seconds=DEFAULT_SLEEP_SECONDS,
    service=None,
    now=None,
):
    """批量补齐缺失的封面。

    候选集：
      - 传入 ``ids`` 时只处理这些 IP；
      - ``force=False`` 时只处理「没有封面」且「``cover_checked_at`` 为空或已过期」的 IP；
      - ``force=True`` 时不看封面与时间，直接重算（会覆盖已有封面）。

    Args:
        ids (Iterable[int] | None): 指定 IP id
        force (bool): 是否强制重算并覆盖
        limit (int): 本次最多处理多少条（1..50）
        stale_days (int): 未命中后多少天内不再重试
        sleep_seconds (float): 相邻两次 BGM 请求的间隔
        service: 可注入的 BGM 服务对象
        now: 可注入的当前时间（测试用）

    Returns:
        dict: ``{updated, checked, skipped, items, failed, remaining}``
    """
    now = now or timezone.now()
    service = service or default_service()
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = DEFAULT_LIMIT
    limit = max(1, min(limit, MAX_LIMIT))

    stale_before = now - timedelta(days=stale_days)

    skipped = 0
    queryset = IP.objects.all()
    if ids:
        requested_ids = set()
        for pk in ids:
            try:
                requested_ids.add(int(pk))
            except (TypeError, ValueError):
                continue
        existing = set(IP.objects.filter(id__in=requested_ids).values_list("id", flat=True))
        skipped = len(requested_ids - existing)
        queryset = queryset.filter(id__in=existing)

    if not force:
        queryset = queryset.filter(_cover_missing_q()).filter(_stale_q(stale_before))

    queryset = queryset.order_by("order", "id")
    total_candidates = queryset.count()
    batch = list(queryset[:limit])

    updated = 0
    checked = 0
    items = []
    failed = []

    for index, ip in enumerate(batch):
        if index and sleep_seconds:
            time.sleep(sleep_seconds)

        cover, status, reason = resolve_ip_cover(ip, service=service)

        update_fields = ["cover_checked_at"]
        ip.cover_checked_at = now
        if cover and (force or not ip.cover_image):
            ip.cover_image = cover
            update_fields.append("cover_image")
            updated += 1

        try:
            ip.save(update_fields=update_fields)
        except Exception as exc:  # noqa: BLE001 - 单条落库失败不影响整批
            failed.append({"id": ip.id, "name": ip.name, "reason": str(exc)})
            continue

        checked += 1
        items.append({"id": ip.id, "name": ip.name, "cover_image": ip.cover_image})
        if status != STATUS_UPDATED:
            failed.append({"id": ip.id, "name": ip.name, "reason": reason or status})

    remaining = 0 if force else max(0, total_candidates - len(batch))

    return {
        "updated": updated,
        "checked": checked,
        "skipped": skipped,
        "items": items,
        "failed": failed,
        "remaining": remaining,
    }
