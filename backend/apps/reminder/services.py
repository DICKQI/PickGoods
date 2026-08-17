"""预购尾款提醒的通知生成逻辑（惰性同步、幂等）。

设计约定：
- 提醒窗口：预计补款月份首日往前推 SOON_LEAD_DAYS 天；
- 同一预购同一类型仅生成一条“活跃”通知（配合模型唯一约束）；
- 取消 / 延期时，旧提醒被标记为 is_stale（已过期）并置为已读；
- GET 列表接口零副作用，惰性同步只由 unread-count 轮询与预购写操作触发。
"""
from __future__ import annotations

import datetime

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Notification, Preorder, PreorderDelayRecord

#: 进入「即将补款」提醒窗口的提前天数（按月粒度）
SOON_LEAD_DAYS_MONTH = 30
#: 进入「即将补款」提醒窗口的提前天数（按季度粒度，提前量更大）
SOON_LEAD_DAYS_QUARTER = 45

_REMIND_TYPES = (Notification.TYPE_SOON, Notification.TYPE_DUE)


def _lead_days(preorder: Preorder) -> int:
    if preorder.time_granularity == Preorder.GRANULARITY_QUARTER:
        return SOON_LEAD_DAYS_QUARTER
    return SOON_LEAD_DAYS_MONTH


def _month_text(day: datetime.date) -> str:
    return f"{day.year}年{day.month}月"


def _quarter_text(day: datetime.date) -> str:
    return f"{day.year}年第一季度" if day.month <= 3 else (
        f"{day.year}年第二季度" if day.month <= 6 else (
            f"{day.year}年第三季度" if day.month <= 9 else f"{day.year}年第四季度"
        )
    )


def _period_text(preorder: Preorder) -> str:
    if preorder.time_granularity == Preorder.GRANULARITY_QUARTER:
        return _quarter_text(preorder.estimated_month)
    return _month_text(preorder.estimated_month)


def _build_content(preorder: Preorder, ntype: str) -> tuple[str, str]:
    """按类型构建通知标题与正文。"""
    period = _period_text(preorder)
    if ntype == Notification.TYPE_SOON:
        days = (preorder.estimated_month - timezone.localdate()).days
        return (
            f"《{preorder.name}》即将补款",
            f"预计 {period} 补尾款，距离预计补款期还有 {days} 天，请留意平台补款通知。",
        )
    if ntype == Notification.TYPE_DUE:
        return (
            f"《{preorder.name}》已到补款期",
            f"已到预计补款期（{period}），请及时完成补款，避免订单被取消。",
        )
    if ntype == Notification.TYPE_CANCELLED:
        return (
            f"《{preorder.name}》已取消补款",
            "已取消补款登记，相关提醒已失效。",
        )
    if ntype == Notification.TYPE_CONVERTED:
        return (
            f"《{preorder.name}》已转正为谷子",
            "可在谷子编辑页补充图片与信息。",
        )
    raise ValueError(f"unknown notification type: {ntype}")


def _period_text_for(day: datetime.date, granularity: str) -> str:
    if granularity == Preorder.GRANULARITY_QUARTER:
        return _quarter_text(day)
    return _month_text(day)


def _build_delayed_content(
    preorder: Preorder,
    from_month: datetime.date,
    from_granularity: str,
    reason: str,
) -> tuple[str, str]:
    """构建「已延期」通知标题与正文（原时间→新时间）。"""
    return (
        f"《{preorder.name}》已延期",
        f"因{reason}，预计补款时间由 {_period_text_for(from_month, from_granularity)} "
        f"调整为 {_period_text(preorder)}。",
    )


def mark_preorder_delayed_notifications_stale(preorder: Preorder) -> int:
    """将预购的活跃「已延期」通知标记为已过期（再次延期时调用，满足唯一约束）。"""
    return Notification.objects.filter(
        user=preorder.user,
        preorder=preorder,
        type=Notification.TYPE_DELAYED,
        is_stale=False,
    ).update(is_stale=True, is_read=True)


def create_delayed_notification(
    preorder: Preorder,
    from_month: datetime.date,
    from_granularity: str,
    reason: str,
) -> Notification:
    """生成一条「已延期」通知（每次延期新建一条，前置置旧通知过期）。"""
    title, message = _build_delayed_content(preorder, from_month, from_granularity, reason)
    return Notification.objects.create(
        user=preorder.user,
        preorder=preorder,
        type=Notification.TYPE_DELAYED,
        title=title,
        message=message,
    )


@transaction.atomic
def delay_preorder(
    preorder: Preorder,
    to_month: datetime.date,
    reason: str = "厂家跳票",
    note: str = "",
) -> Preorder:
    """顺延预购补款时间（厂家跳票），记录历史并重新同步提醒。

    事务内锁定并重新读取预购，状态、当前时间、延期历史和计数均以锁定行
    为准。to_month 已由请求序列化器按当前粒度起点归一化。
    """
    preorder = Preorder.objects.select_for_update().get(pk=preorder.pk)
    if preorder.status != Preorder.STATUS_PENDING:
        raise ValidationError({"detail": "仅待补款状态的预购可延期"})
    if to_month <= preorder.estimated_month:
        raise ValidationError(
            {"to_month": "延期后的时间必须晚于当前预计补款时间"}
        )

    from_month = preorder.estimated_month
    granularity = preorder.time_granularity
    PreorderDelayRecord.objects.create(
        preorder=preorder,
        from_month=from_month,
        to_month=to_month,
        from_granularity=granularity,
        to_granularity=granularity,
        reason=reason,
        note=note or "",
    )
    preorder.estimated_month = to_month
    preorder.delay_count += 1
    preorder.save(update_fields=["estimated_month", "delay_count", "updated_at"])
    # 旧 soon/due 提醒置过期，按新时间重新生成（新时间若已进窗口立即生成）
    mark_preorder_notifications_stale(preorder)
    sync_preorder(preorder)
    # 「已延期」通知：先过期上一条活跃记录（满足唯一约束），再新建
    mark_preorder_delayed_notifications_stale(preorder)
    create_delayed_notification(preorder, from_month, granularity, reason)
    return preorder

def sync_preorder(preorder: Preorder) -> bool:
    """为单个待补款预购生成到期提醒（幂等）。返回是否新建了通知。"""
    if preorder.status != Preorder.STATUS_PENDING:
        return False
    today = timezone.localdate()
    window_start = preorder.estimated_month - datetime.timedelta(days=_lead_days(preorder))
    if today >= preorder.estimated_month:
        ntype = Notification.TYPE_DUE
    elif today >= window_start:
        ntype = Notification.TYPE_SOON
    else:
        return False
    title, message = _build_content(preorder, ntype)
    _, created = Notification.objects.get_or_create(
        user=preorder.user,
        preorder=preorder,
        type=ntype,
        is_stale=False,
        defaults={"title": title, "message": message},
    )
    return created


def sync_due_notifications(user) -> int:
    """同步某用户所有待补款预购的到期提醒。返回新建数量。"""
    created = 0
    queryset = Preorder.objects.filter(user=user, status=Preorder.STATUS_PENDING)
    for preorder in queryset:
        if sync_preorder(preorder):
            created += 1
    return created


def mark_preorder_notifications_stale(preorder: Preorder) -> int:
    """将预购的活跃提醒通知标记为已过期（取消 / 延期时调用）。"""
    return Notification.objects.filter(
        user=preorder.user,
        preorder=preorder,
        type__in=_REMIND_TYPES,
        is_stale=False,
    ).update(is_stale=True, is_read=True)


def mark_preorder_notifications_read(preorder: Preorder) -> int:
    """将预购的活跃提醒通知标记为已读（补款 / 转正后调用）。"""
    return Notification.objects.filter(
        user=preorder.user,
        preorder=preorder,
        type__in=_REMIND_TYPES,
        is_stale=False,
    ).update(is_read=True)


def notify_status_change(preorder: Preorder, ntype: str) -> Notification:
    """生成一条状态变化通知（已取消 / 已转正），幂等。"""
    title, message = _build_content(preorder, ntype)
    notification, _ = Notification.objects.get_or_create(
        user=preorder.user,
        preorder=preorder,
        type=ntype,
        is_stale=False,
        defaults={"title": title, "message": message},
    )
    return notification
