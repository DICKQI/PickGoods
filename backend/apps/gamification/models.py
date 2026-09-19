from __future__ import annotations

from decimal import Decimal

from django.db import models


class GamificationConfig(models.Model):
    """Singleton runtime configuration for the gamification rollout."""

    rollout_at = models.DateTimeField(null=True, blank=True, verbose_name="累计起点")
    initialized_at = models.DateTimeField(null=True, blank=True, verbose_name="基线初始化时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "游戏化配置"
        verbose_name_plural = "游戏化配置"

    def save(self, *args, **kwargs):
        self.pk = 1
        return super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "GamificationConfig":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self) -> str:
        return "游戏化配置"


class Reward(models.Model):
    TYPE_BADGE = "BADGE"
    TYPE_PROFILE_FRAME = "PROFILE_FRAME"
    TYPE_PROFILE_CARD_SKIN = "PROFILE_CARD_SKIN"
    TYPE_JOURNAL_STICKER_PACK = "JOURNAL_STICKER_PACK"
    TYPE_JOURNAL_BACKGROUND = "JOURNAL_BACKGROUND"
    TYPE_SHOWCASE_THEME = "SHOWCASE_THEME"
    TYPE_SHOWCASE_EFFECT = "SHOWCASE_EFFECT"

    TYPE_CHOICES = (
        (TYPE_BADGE, "成就徽章"),
        (TYPE_PROFILE_FRAME, "头像框"),
        (TYPE_PROFILE_CARD_SKIN, "收藏卡皮肤"),
        (TYPE_JOURNAL_STICKER_PACK, "手帐贴纸包"),
        (TYPE_JOURNAL_BACKGROUND, "手帐背景"),
        (TYPE_SHOWCASE_THEME, "痛柜主题"),
        (TYPE_SHOWCASE_EFFECT, "痛柜效果"),
    )

    RARITY_COMMON = "common"
    RARITY_RARE = "rare"
    RARITY_EPIC = "epic"
    RARITY_LEGENDARY = "legendary"
    RARITY_CHOICES = (
        (RARITY_COMMON, "普通"),
        (RARITY_RARE, "稀有"),
        (RARITY_EPIC, "史诗"),
        (RARITY_LEGENDARY, "限定"),
    )

    code = models.SlugField(max_length=80, unique=True, db_index=True, verbose_name="奖励编码")
    club = models.ForeignKey(
        "users.Club",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="gamification_rewards",
        db_index=True,
        verbose_name="所属社团",
        help_text="为空表示平台奖励。",
    )
    name = models.CharField(max_length=100, verbose_name="奖励名称")
    description = models.TextField(blank=True, default="", verbose_name="奖励说明")
    reward_type = models.CharField(max_length=40, choices=TYPE_CHOICES, db_index=True, verbose_name="奖励类型")
    rarity = models.CharField(max_length=20, choices=RARITY_CHOICES, default=RARITY_COMMON, verbose_name="稀有度")
    asset = models.ImageField(upload_to="gamification/rewards/", null=True, blank=True, verbose_name="图片素材")
    preset_key = models.CharField(
        max_length=80,
        blank=True,
        default="",
        verbose_name="前端预设编码",
        help_text="主题、效果、皮肤和背景使用已注册的 preset_key。",
    )
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="是否启用")
    order = models.IntegerField(default=0, db_index=True, verbose_name="排序值")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "游戏化奖励"
        verbose_name_plural = "游戏化奖励"
        ordering = ["order", "id"]
        indexes = [
            models.Index(fields=["club", "is_active"]),
        ]

    def __str__(self) -> str:
        return self.name


class RewardAsset(models.Model):
    reward = models.ForeignKey(
        Reward,
        on_delete=models.CASCADE,
        related_name="assets",
        verbose_name="所属奖励",
    )
    name = models.CharField(max_length=100, verbose_name="素材名称")
    image = models.ImageField(upload_to="gamification/stickers/", verbose_name="素材图片")
    order = models.IntegerField(default=0, db_index=True, verbose_name="排序值")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "奖励素材"
        verbose_name_plural = "奖励素材"
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["reward", "name"], name="unique_reward_asset_name"),
        ]

    def __str__(self) -> str:
        return f"{self.reward.name} - {self.name}"


class AchievementSet(models.Model):
    code = models.SlugField(max_length=80, unique=True, db_index=True, verbose_name="系列编码")
    club = models.ForeignKey(
        "users.Club",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="gamification_sets",
        db_index=True,
        verbose_name="所属社团",
        help_text="为空表示平台成就系列。",
    )
    name = models.CharField(max_length=100, verbose_name="系列名称")
    description = models.TextField(blank=True, default="", verbose_name="系列说明")
    badge_label = models.CharField(max_length=30, blank=True, default="", verbose_name="系列标签")
    starts_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name="开始时间")
    ends_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name="结束时间")
    is_limited = models.BooleanField(default=False, db_index=True, verbose_name="是否限时")
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="是否启用")
    order = models.IntegerField(default=0, db_index=True, verbose_name="排序值")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "成就系列"
        verbose_name_plural = "成就系列"
        ordering = ["order", "id"]
        indexes = [
            models.Index(fields=["club", "is_active"]),
        ]

    def __str__(self) -> str:
        return self.name


class Achievement(models.Model):
    OPERATOR_ALL = "ALL"
    OPERATOR_ANY = "ANY"
    OPERATOR_CHOICES = (
        (OPERATOR_ALL, "全部满足"),
        (OPERATOR_ANY, "任一满足"),
    )

    code = models.SlugField(max_length=100, unique=True, db_index=True, verbose_name="成就编码")
    set = models.ForeignKey(
        AchievementSet,
        on_delete=models.CASCADE,
        related_name="achievements",
        verbose_name="所属系列",
    )
    name = models.CharField(max_length=100, verbose_name="成就名称")
    description = models.TextField(blank=True, default="", verbose_name="成就说明")
    root_operator = models.CharField(
        max_length=10,
        choices=OPERATOR_CHOICES,
        default=OPERATOR_ALL,
        verbose_name="根规则",
    )
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="是否启用")
    is_limited = models.BooleanField(default=False, db_index=True, verbose_name="是否限定")
    order = models.IntegerField(default=0, db_index=True, verbose_name="排序值")
    first_published_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="首次发布时间",
        help_text="社团成就首次实际可见的时间；统计起点不早于该时间。",
    )
    rewards = models.ManyToManyField(Reward, related_name="achievements", blank=True, verbose_name="奖励")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "成就"
        verbose_name_plural = "成就"
        ordering = ["set__order", "order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["set", "name"], name="unique_achievement_name_in_set"),
        ]

    def __str__(self) -> str:
        return self.name


class RuleGroup(models.Model):
    OPERATOR_ALL = Achievement.OPERATOR_ALL
    OPERATOR_ANY = Achievement.OPERATOR_ANY
    OPERATOR_CHOICES = Achievement.OPERATOR_CHOICES

    achievement = models.ForeignKey(
        Achievement,
        on_delete=models.CASCADE,
        related_name="rule_groups",
        verbose_name="所属成就",
    )
    operator = models.CharField(max_length=10, choices=OPERATOR_CHOICES, default=OPERATOR_ALL, verbose_name="组规则")
    order = models.IntegerField(default=0, db_index=True, verbose_name="排序值")

    class Meta:
        verbose_name = "规则组"
        verbose_name_plural = "规则组"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.achievement.name} 条件组 {self.order}"


class RuleCondition(models.Model):
    METRIC_GOODS_QUANTITY = "GOODS_QUANTITY"
    METRIC_VALID_ALTARS = "VALID_ALTARS"
    METRIC_SPEND_AMOUNT = "SPEND_AMOUNT"
    METRIC_DISTINCT_IP_COUNT = "DISTINCT_IP_COUNT"
    METRIC_DISTINCT_CHARACTER_COUNT = "DISTINCT_CHARACTER_COUNT"
    METRIC_CLUB_GOODS_QUANTITY = "CLUB_GOODS_QUANTITY"
    METRIC_CLUB_SPEND_AMOUNT = "CLUB_SPEND_AMOUNT"

    METRIC_CHOICES = (
        (METRIC_GOODS_QUANTITY, "新增谷子件数"),
        (METRIC_VALID_ALTARS, "有效角色痛柜数"),
        (METRIC_SPEND_AMOUNT, "累计消费金额"),
        (METRIC_DISTINCT_IP_COUNT, "去重 IP 数"),
        (METRIC_DISTINCT_CHARACTER_COUNT, "去重角色数"),
        (METRIC_CLUB_GOODS_QUANTITY, "社团商品导入件数"),
        (METRIC_CLUB_SPEND_AMOUNT, "社团商品累计公开价"),
    )

    group = models.ForeignKey(
        RuleGroup,
        on_delete=models.CASCADE,
        related_name="conditions",
        verbose_name="所属规则组",
    )
    metric = models.CharField(max_length=40, choices=METRIC_CHOICES, db_index=True, verbose_name="统计指标")
    threshold = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="目标值")
    filters = models.JSONField(default=dict, blank=True, verbose_name="筛选条件")
    order = models.IntegerField(default=0, db_index=True, verbose_name="排序值")

    class Meta:
        verbose_name = "规则条件"
        verbose_name_plural = "规则条件"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.get_metric_display()} ≥ {self.threshold}"


class MetricEvent(models.Model):
    EVENT_GOODS_QUANTITY = RuleCondition.METRIC_GOODS_QUANTITY
    EVENT_SPEND_AMOUNT = RuleCondition.METRIC_SPEND_AMOUNT
    EVENT_VALID_ALTAR = RuleCondition.METRIC_VALID_ALTARS
    EVENT_SCOPE_REFRESH = "SCOPE_REFRESH"

    EVENT_CHOICES = (
        (EVENT_GOODS_QUANTITY, "谷子件数事件"),
        (EVENT_SPEND_AMOUNT, "消费金额事件"),
        (EVENT_VALID_ALTAR, "有效痛柜事件"),
        (EVENT_SCOPE_REFRESH, "维度刷新事件"),
    )

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="gamification_events",
        db_index=True,
        verbose_name="所属用户",
    )
    event_type = models.CharField(max_length=40, choices=EVENT_CHOICES, db_index=True, verbose_name="事件类型")
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"), verbose_name="事件数值")
    source_type = models.CharField(max_length=40, db_index=True, verbose_name="来源类型")
    source_id = models.CharField(max_length=100, db_index=True, verbose_name="来源 ID")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="事件快照")
    occurred_at = models.DateTimeField(db_index=True, verbose_name="发生时间")
    idempotency_key = models.CharField(max_length=180, unique=True, verbose_name="幂等键")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="记录时间")

    class Meta:
        verbose_name = "指标事件"
        verbose_name_plural = "指标事件"
        ordering = ["-occurred_at", "-id"]
        indexes = [
            models.Index(fields=["user", "event_type", "occurred_at"]),
            models.Index(fields=["user", "occurred_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} {self.event_type} {self.amount}"


class MetricSourceState(models.Model):
    source_type = models.CharField(max_length=40, db_index=True, verbose_name="来源类型")
    source_id = models.CharField(max_length=100, db_index=True, verbose_name="来源 ID")
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="gamification_source_states",
        db_index=True,
        verbose_name="所属用户",
    )
    observed_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    accrued_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    observed_spend = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    accrued_spend = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    scope_hash = models.CharField(max_length=64, blank=True, default="")
    last_seen_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "指标来源状态"
        verbose_name_plural = "指标来源状态"
        constraints = [
            models.UniqueConstraint(
                fields=["source_type", "source_id"],
                name="unique_gamification_source_state",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "source_type"]),
        ]

    def __str__(self) -> str:
        return f"{self.source_type}:{self.source_id}"


class MetricSyncFailure(models.Model):
    source_type = models.CharField(max_length=40, db_index=True, verbose_name="来源类型")
    source_id = models.CharField(max_length=100, db_index=True, verbose_name="来源 ID")
    error_message = models.TextField(verbose_name="错误信息")
    attempts = models.PositiveIntegerField(default=1, verbose_name="失败次数")
    last_attempt_at = models.DateTimeField(auto_now=True, verbose_name="最近尝试时间")
    resolved_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name="恢复时间")

    class Meta:
        verbose_name = "指标同步失败"
        verbose_name_plural = "指标同步失败"
        constraints = [
            models.UniqueConstraint(
                fields=["source_type", "source_id"],
                name="unique_gamification_sync_failure",
            ),
        ]
        ordering = ["resolved_at", "-last_attempt_at", "id"]

    def __str__(self) -> str:
        return f"{self.source_type}:{self.source_id}"


class UserAchievement(models.Model):
    STATUS_LOCKED = "locked"
    STATUS_UNLOCKED = "unlocked"
    STATUS_CLAIMED = "claimed"
    STATUS_CHOICES = (
        (STATUS_LOCKED, "未解锁"),
        (STATUS_UNLOCKED, "可领取"),
        (STATUS_CLAIMED, "已领取"),
    )

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="gamification_achievements",
        db_index=True,
        verbose_name="用户",
    )
    achievement = models.ForeignKey(
        Achievement,
        on_delete=models.CASCADE,
        related_name="user_states",
        verbose_name="成就",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_LOCKED, db_index=True)
    progress = models.JSONField(default=dict, blank=True, verbose_name="进度快照")
    progress_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    unlocked_at = models.DateTimeField(null=True, blank=True, db_index=True)
    claimed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    unseen = models.BooleanField(default=False, db_index=True, verbose_name="未读解锁")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "用户成就"
        verbose_name_plural = "用户成就"
        constraints = [
            models.UniqueConstraint(fields=["user", "achievement"], name="unique_user_achievement"),
        ]
        ordering = ["achievement__set__order", "achievement__order", "id"]

    def __str__(self) -> str:
        return f"{self.user_id} - {self.achievement.name}"


class UserReward(models.Model):
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="gamification_rewards",
        db_index=True,
        verbose_name="用户",
    )
    reward = models.ForeignKey(
        Reward,
        on_delete=models.CASCADE,
        related_name="user_grants",
        verbose_name="奖励",
    )
    source_achievement = models.ForeignKey(
        Achievement,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reward_grants",
        verbose_name="来源成就",
    )
    granted_at = models.DateTimeField(auto_now_add=True, verbose_name="领取时间")

    class Meta:
        verbose_name = "用户奖励"
        verbose_name_plural = "用户奖励"
        constraints = [
            models.UniqueConstraint(fields=["user", "reward"], name="unique_user_reward"),
        ]
        ordering = ["reward__order", "id"]

    def __str__(self) -> str:
        return f"{self.user_id} - {self.reward.name}"


class UserEquippedReward(models.Model):
    SLOT_PROFILE_FRAME = "PROFILE_FRAME"
    SLOT_PROFILE_CARD_SKIN = "PROFILE_CARD_SKIN"
    SLOT_DEFAULT_SHOWCASE_THEME = "DEFAULT_SHOWCASE_THEME"
    SLOT_DEFAULT_SHOWCASE_EFFECT = "DEFAULT_SHOWCASE_EFFECT"
    SLOT_CHOICES = (
        (SLOT_PROFILE_FRAME, "头像框"),
        (SLOT_PROFILE_CARD_SKIN, "收藏卡皮肤"),
        (SLOT_DEFAULT_SHOWCASE_THEME, "默认痛柜主题"),
        (SLOT_DEFAULT_SHOWCASE_EFFECT, "默认痛柜效果"),
    )

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="gamification_equipment",
        db_index=True,
        verbose_name="用户",
    )
    slot = models.CharField(max_length=40, choices=SLOT_CHOICES, db_index=True, verbose_name="装备槽位")
    reward = models.ForeignKey(
        Reward,
        on_delete=models.CASCADE,
        related_name="equipped_by",
        verbose_name="奖励",
    )
    equipped_at = models.DateTimeField(auto_now=True, verbose_name="装备时间")

    class Meta:
        verbose_name = "用户装备"
        verbose_name_plural = "用户装备"
        constraints = [
            models.UniqueConstraint(fields=["user", "slot"], name="unique_user_reward_slot"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} - {self.slot}"


class PublicBadgeSelection(models.Model):
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="public_badge_selections",
        db_index=True,
        verbose_name="用户",
    )
    reward = models.ForeignKey(
        Reward,
        on_delete=models.CASCADE,
        related_name="public_selections",
        verbose_name="徽章",
    )
    order = models.PositiveSmallIntegerField(default=0, verbose_name="展示顺序")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "公开徽章选择"
        verbose_name_plural = "公开徽章选择"
        constraints = [
            models.UniqueConstraint(fields=["user", "reward"], name="unique_public_badge_reward"),
            models.UniqueConstraint(fields=["user", "order"], name="unique_public_badge_order"),
        ]
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.user_id} - {self.reward.name}"
