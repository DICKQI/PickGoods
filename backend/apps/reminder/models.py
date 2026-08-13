from __future__ import annotations

from uuid import uuid4

from django.db import models


class Preorder(models.Model):
    """手办预购登记（外部平台下单付定金，等待补尾款）。"""

    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_CANCELLED = "cancelled"
    STATUS_CONVERTED = "converted"

    STATUS_CHOICES = (
        (STATUS_PENDING, "待补款"),
        (STATUS_PAID, "已补款"),
        (STATUS_CANCELLED, "已取消"),
        (STATUS_CONVERTED, "已转正"),
    )

    GRANULARITY_MONTH = "month"
    GRANULARITY_QUARTER = "quarter"

    GRANULARITY_CHOICES = (
        (GRANULARITY_MONTH, "按月"),
        (GRANULARITY_QUARTER, "按季度"),
    )

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="预购ID",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="preorders",
        db_index=True,
        verbose_name="所属用户",
    )
    name = models.CharField(
        max_length=200,
        db_index=True,
        verbose_name="手办名称",
    )
    platform = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="下单平台",
        help_text="例如：淘宝、天猫、京东、拼多多、代购等",
    )
    shop_name = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="店铺名称",
    )
    order_no = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="订单号",
    )
    deposit_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="定金金额",
    )
    balance_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="尾款金额",
        help_text="未知可留空",
    )
    estimated_month = models.DateField(
        db_index=True,
        verbose_name="预计补款时间",
        help_text="时间粒度起点：按月存当月 1 日，按季度存季度首月 1 日",
    )
    time_granularity = models.CharField(
        max_length=10,
        choices=GRANULARITY_CHOICES,
        default=GRANULARITY_MONTH,
        verbose_name="时间粒度",
        help_text="month=按具体月份补款；quarter=按季度补款（estimated_month 存季度首月）",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
        verbose_name="状态",
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="补款时间",
    )
    goods = models.OneToOneField(
        "goods.Goods",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="preorder_source",
        verbose_name="转正后的谷子",
    )
    notes = models.TextField(
        null=True,
        blank=True,
        verbose_name="备注",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "预购登记"
        verbose_name_plural = "预购登记"
        ordering = ["estimated_month", "created_at"]

    def __str__(self) -> str:
        return self.name


class Notification(models.Model):
    """站内通知（尾款提醒等）。"""

    TYPE_SOON = "preorder_soon"
    TYPE_DUE = "preorder_due"
    TYPE_CANCELLED = "preorder_cancelled"
    TYPE_CONVERTED = "preorder_converted"

    TYPE_CHOICES = (
        (TYPE_SOON, "即将补款"),
        (TYPE_DUE, "已到补款期"),
        (TYPE_CANCELLED, "已取消补款"),
        (TYPE_CONVERTED, "已转正"),
    )

    id = models.BigAutoField(primary_key=True, verbose_name="通知ID")
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
        verbose_name="接收用户",
    )
    type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        verbose_name="通知类型",
    )
    title = models.CharField(max_length=100, verbose_name="标题")
    message = models.TextField(verbose_name="内容")
    preorder = models.ForeignKey(
        "reminder.Preorder",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
        db_index=True,
        verbose_name="关联预购",
    )
    is_read = models.BooleanField(default=False, db_index=True, verbose_name="是否已读")
    is_stale = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="是否已过期",
        help_text="预计月份修改或取消后置 True，界面置灰展示",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "通知"
        verbose_name_plural = "通知"
        ordering = ["-created_at", "-id"]
        constraints = [
            # 条件唯一索引：仅约束“活跃”通知（is_stale=False）唯一；
            # 过期通知可累积为历史（若把 is_stale 纳入约束范围，连续改期
            # 置过期时会与历史过期记录冲突，触发 IntegrityError）
            models.UniqueConstraint(
                fields=["user", "preorder", "type"],
                name="unique_active_user_preorder_notification_type",
                condition=models.Q(is_stale=False),
            ),
        ]

    def __str__(self) -> str:
        return f"[{self.get_type_display()}] {self.title}"
