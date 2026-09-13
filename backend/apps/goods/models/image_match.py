from uuid import uuid4

from django.db import models


class GoodsImageFingerprint(models.Model):
    """谷子主图的感知哈希与视觉向量索引。"""

    goods = models.OneToOneField(
        "goods.Goods",
        on_delete=models.CASCADE,
        related_name="image_fingerprint",
        primary_key=True,
        verbose_name="谷子",
    )
    phash = models.CharField(max_length=16, db_index=True, verbose_name="感知哈希")
    embedding = models.BinaryField(verbose_name="视觉向量")
    embedding_dim = models.PositiveSmallIntegerField(default=384, verbose_name="向量维度")
    algorithm_version = models.CharField(
        max_length=64,
        db_index=True,
        verbose_name="算法版本",
    )
    source_name = models.CharField(max_length=500, verbose_name="源主图路径")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "谷子主图指纹"
        verbose_name_plural = "谷子主图指纹"
        ordering = ["goods_id"]
        indexes = [
            models.Index(fields=["algorithm_version", "goods"]),
        ]

    def __str__(self) -> str:
        return f"{self.goods_id} - {self.algorithm_version}"


class GoodsImageMatchAttempt(models.Model):
    """一次图片匹配的匿名分数元数据，不保存用户上传的查询图。"""

    FEEDBACK_NONE = "none"
    FEEDBACK_CONFIRMED = "confirmed"
    FEEDBACK_REJECTED = "rejected"
    FEEDBACK_CHOICES = (
        (FEEDBACK_NONE, "未反馈"),
        (FEEDBACK_CONFIRMED, "确认命中"),
        (FEEDBACK_REJECTED, "均不匹配"),
    )

    DECISION_MATCHED = "matched"
    DECISION_CANDIDATES = "candidates"
    DECISION_NOT_FOUND = "not_found"
    DECISION_CHOICES = (
        (DECISION_MATCHED, "高置信匹配"),
        (DECISION_CANDIDATES, "相似候选"),
        (DECISION_NOT_FOUND, "未找到"),
    )

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="识别记录ID",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="goods_image_match_attempts",
        db_index=True,
        verbose_name="用户",
    )
    decision = models.CharField(
        max_length=20,
        choices=DECISION_CHOICES,
        verbose_name="识别结论",
    )
    algorithm_version = models.CharField(max_length=64, verbose_name="算法版本")
    top_score = models.FloatField(null=True, blank=True, verbose_name="最高相似度")
    top_margin = models.FloatField(null=True, blank=True, verbose_name="领先幅度")
    candidate_results = models.JSONField(
        default=list,
        blank=True,
        verbose_name="候选结果",
        help_text="仅保存商品ID、分数和置信度，不保存查询图片。",
    )
    feedback = models.CharField(
        max_length=20,
        choices=FEEDBACK_CHOICES,
        default=FEEDBACK_NONE,
        db_index=True,
        verbose_name="用户反馈",
    )
    confirmed_goods = models.ForeignKey(
        "goods.Goods",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="image_match_confirmations",
        verbose_name="确认命中的谷子",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "谷子图片识别记录"
        verbose_name_plural = "谷子图片识别记录"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["feedback", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} - {self.decision} - {self.created_at}"
