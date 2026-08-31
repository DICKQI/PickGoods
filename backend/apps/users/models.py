from __future__ import annotations

from django.contrib.auth.hashers import check_password, make_password
from django.db import models


class Role(models.Model):
    name = models.CharField(max_length=50, unique=True, db_index=True, verbose_name="角色名")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "角色"
        verbose_name_plural = "角色"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.name


class User(models.Model):
    ACCOUNT_TYPE_COLLECTOR = "collector"
    ACCOUNT_TYPE_CLUB = "club"
    ACCOUNT_TYPE_CHOICES = (
        (ACCOUNT_TYPE_COLLECTOR, "吃谷人"),
        (ACCOUNT_TYPE_CLUB, "社团"),
    )
    APPROVAL_PENDING = "pending"
    APPROVAL_APPROVED = "approved"
    APPROVAL_STATUS_CHOICES = (
        (APPROVAL_PENDING, "审批中"),
        (APPROVAL_APPROVED, "已审批"),
    )
    username = models.CharField(max_length=150, unique=True, db_index=True, verbose_name="用户名")
    password = models.CharField(max_length=255, verbose_name="密码哈希")
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="users",
        verbose_name="角色",
    )
    account_type = models.CharField(
        max_length=20,
        choices=ACCOUNT_TYPE_CHOICES,
        default=ACCOUNT_TYPE_COLLECTOR,
        db_index=True,
        verbose_name="业务身份",
    )
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default=APPROVAL_APPROVED,
        db_index=True,
        verbose_name="审批状态",
    )
    is_active = models.BooleanField(default=True, verbose_name="是否启用")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "用户"
        verbose_name_plural = "用户"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.username

    @property
    def is_authenticated(self) -> bool:
        # DRF's IsAuthenticated relies on this.
        return True

    def set_password(self, raw_password: str) -> None:
        self.password = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.password)


class Club(models.Model):
    """社团公开资料，与社团账号一对一关联。"""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="club_profile",
        verbose_name="社团账号",
    )
    name = models.CharField(max_length=200, unique=True, db_index=True, verbose_name="社团名称")
    avatar = models.ImageField(upload_to="clubs/avatars/", null=True, blank=True, verbose_name="社团头像")
    description = models.TextField(blank=True, default="", verbose_name="社团简介")
    announcement = models.TextField(blank=True, default="", verbose_name="社团公告")
    contact_name = models.CharField(max_length=100, blank=True, default="", verbose_name="联系人")
    contact_phone = models.CharField(max_length=50, blank=True, default="", verbose_name="联系电话")
    contact_email = models.EmailField(blank=True, default="", verbose_name="联系邮箱")
    taobao_url = models.URLField(max_length=500, null=True, blank=True, default=None, verbose_name="淘宝链接")
    xiaohongshu_url = models.URLField(max_length=500, null=True, blank=True, default=None, verbose_name="小红书链接")
    weidian_url = models.URLField(max_length=500, null=True, blank=True, default=None, verbose_name="微店链接")
    store_links = models.JSONField(default=list, blank=True, verbose_name="店铺链接")
    address = models.CharField(max_length=300, blank=True, default="", verbose_name="地址")
    business_hours = models.CharField(max_length=200, blank=True, default="", verbose_name="营业时间")
    application_reason = models.TextField(blank=True, default="", verbose_name="申请理由")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "社团"
        verbose_name_plural = "社团"
        ordering = ["name", "id"]

    def __str__(self):
        return self.name


class ClubFavorite(models.Model):
    """吃谷人对公开社团的私有收藏书签。"""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="club_favorites",
        verbose_name="收藏用户",
    )
    club = models.ForeignKey(
        Club,
        on_delete=models.CASCADE,
        related_name="favorite_users",
        verbose_name="社团",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="收藏时间")

    class Meta:
        verbose_name = "社团收藏"
        verbose_name_plural = "社团收藏"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "club"], name="unique_user_club_favorite"),
        ]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["club", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} 收藏 {self.club.name}"


class Permission(models.Model):
    """
    预留：细粒度权限表。当前版本主要按 Role + policy 控制。
    """

    code = models.CharField(max_length=100, unique=True, db_index=True, verbose_name="权限编码")
    name = models.CharField(max_length=100, verbose_name="权限名称")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "权限"
        verbose_name_plural = "权限"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.code

