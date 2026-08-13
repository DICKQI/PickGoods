"""预购尾款提醒的通知生成逻辑（惰性同步、幂等）。

设计约定：
- 提醒窗口：预计补款月份首日往前推 SOON_LEAD_DAYS 天；
- 同一预购同一类型仅生成一条“活跃”通知（配合模型唯一约束）；
- 预计月份修改 / 取消时，旧提醒被标记为 is_stale（已过期）并置为已读；
- GET 列表接口零副作用，惰性同步只由 unread-count 轮询与预购写操作触发。
"""
from __future__ import annotations

import datetime

from django.utils import timezone

from .models import Notification, Preorder

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
    """将预购的活跃提醒通知标记为已过期（预计月份修改 / 取消时调用）。"""
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
