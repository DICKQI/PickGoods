from uuid import uuid4

from django.db import models
from django.utils import timezone


class IP(models.Model):
    """
    作品来源表，例如：崩坏：星穹铁道
    """

    name = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        verbose_name="作品名",
    )
    
    # 作品类型：1=书籍, 2=动画, 3=音乐, 4=游戏, 6=三次元/特摄
    SUBJECT_TYPE_CHOICES = (
        (1, "书籍"),
        (2, "动画"),
        (3, "音乐"),
        (4, "游戏"),
        (6, "三次元/特摄"),
    )
    subject_type = models.IntegerField(
        choices=SUBJECT_TYPE_CHOICES,
        null=True,
        blank=True,
        verbose_name="作品类型",
        help_text="1=书籍, 2=动画, 3=音乐, 4=游戏, 6=三次元/特摄",
    )
    
    order = models.IntegerField(
        default=0,
        verbose_name="排序值",
        help_text="控制IP作品的展示顺序，值越小越靠前",
    )

    # BGM 关联：用于增量同步精确匹配。Nullable，保持对历史数据零影响。
    bgm_subject_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        unique=True,
        verbose_name="BGM作品ID",
        help_text="bangumi.tv 对应作品的 subject_id，用于增量更新精确匹配",
    )
    last_synced_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="最近一次BGM同步时间",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        null=True,
        blank=True,
        verbose_name="创建时间",
    )

    class Meta:
        verbose_name = "IP作品"
        verbose_name_plural = "IP作品"
        ordering = ["order", "id"]

    def __str__(self):
        return self.name


class IPKeyword(models.Model):
    """
    IP 多关键词 / 别名表，例如：星铁、崩铁、HSR 等。
    """

    ip = models.ForeignKey(
        IP,
        on_delete=models.CASCADE,
        related_name="keywords",
        verbose_name="所属作品",
    )
    value = models.CharField(
        max_length=50,
        db_index=True,
        verbose_name="关键词",
        help_text="IP 的别名或搜索关键字，例如：星铁、崩铁、HSR",
    )

    class Meta:
        verbose_name = "IP关键词"
        verbose_name_plural = "IP关键词"
        unique_together = ("ip", "value")

    def __str__(self):
        return f"{self.ip.name} - {self.value}"


class Character(models.Model):
    """
    角色表，例如：流萤
    """

    ip = models.ForeignKey(
        IP,
        on_delete=models.CASCADE,
        related_name="characters",
        verbose_name="所属作品",
    )
    name = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="角色名",
    )
    avatar = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        verbose_name="角色头像",
        help_text="角色头像路径或URL。可以是服务器内的相对路径（如 characters/xxx.jpg）或外部URL（如 https://example.com/avatar.jpg）",
    )

    # BGM 关联：用于增量同步精确匹配。Nullable，保持对历史数据零影响。
    bgm_character_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="BGM角色ID",
        help_text="bangumi.tv 对应角色的 character_id，用于增量更新精确匹配",
    )

    GENDER_CHOICES = (
        ("male", "男"),
        ("female", "女"),
        ("other", "其他"),
    )
    gender = models.CharField(
        max_length=10,
        choices=GENDER_CHOICES,
        default="other",
        verbose_name="角色性别",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        null=True,
        blank=True,
        verbose_name="创建时间",
    )

    class Meta:
        verbose_name = "角色"
        verbose_name_plural = "角色"
        unique_together = ("ip", "name")
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.ip.name} - {self.name}"


class Category(models.Model):
    """
    品类表，例如：吧唧、色纸、立牌、挂件
    采用自关联设计，支持无限级层级。
    """

    name = models.CharField(max_length=50, verbose_name="类型名")
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="父级品类",
    )
    path_name = models.CharField(
        max_length=200,
        db_index=True,
        null=True,
        blank=True,
        verbose_name="完整路径",
        help_text="冗余字段，例如：周边/吧唧/圆形吧唧",
    )
    color_tag = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        verbose_name="颜色标签",
        help_text="用于UI展示的颜色标识，例如：#FF5733",
    )
    shape_type = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        verbose_name="形状类型",
        help_text="用于图片自动分类：round（圆形吧唧类）/ rectangle（方形卡片类）",
    )
    order = models.IntegerField(
        default=0,
        verbose_name="排序值",
        help_text="控制同级节点的展示顺序，值越小越靠前",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        null=True,
        blank=True,
        verbose_name="创建时间",
    )

    class Meta:
        verbose_name = "品类"
        verbose_name_plural = "品类"
        ordering = ["order", "id"]

    def __str__(self):
        return self.path_name or self.name


class Theme(models.Model):
    """
    主题表，例如：夏日主题、节日主题、限定主题等
    """

    name = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="主题名称",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="themes",
        db_index=True,
        verbose_name="所属用户",
    )
    DESCRIPTION_DEFAULT = (
        "店铺：\n"
        "工艺：\n"
        "画师：\n"
        "主题："
    )
    description = models.TextField(
        null=True,
        blank=True,
        default=DESCRIPTION_DEFAULT,
        verbose_name="主题描述",
        help_text="主题的详细描述信息",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        null=True,
        blank=True,
        verbose_name="创建时间",
    )

    class Meta:
        verbose_name = "主题"
        verbose_name_plural = "主题"
        ordering = ["created_at"]
        unique_together = ("user", "name")

    def __str__(self):
        return self.name


class ThemeImage(models.Model):
    """
    主题附加图片表，例如：海报、物料细节等。
    """

    theme = models.ForeignKey(
        Theme,
        on_delete=models.CASCADE,
        related_name="images",
        verbose_name="所属主题",
    )
    image = models.ImageField(
        upload_to="themes/extra/",
        verbose_name="主题附加图片",
    )
    label = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="图片标签",
        help_text="如：海报、物料细节",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        null=True,
        blank=True,
        verbose_name="创建时间",
    )

    class Meta:
        verbose_name = "主题附加图片"
        verbose_name_plural = "主题附加图片"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.theme.name} - {self.label or '附加图'}"


class ThemeTemplate(models.Model):
    """
    Default goods fields captured from a theme creation flow.
    """

    theme = models.OneToOneField(
        Theme,
        on_delete=models.CASCADE,
        related_name="template",
        verbose_name="关联主题",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="theme_templates",
        db_index=True,
        verbose_name="所属用户",
    )
    name = models.CharField(
        max_length=200,
        verbose_name="谷子名称",
    )
    ip = models.ForeignKey(
        IP,
        on_delete=models.PROTECT,
        related_name="theme_templates",
        verbose_name="IP作品",
    )
    characters = models.ManyToManyField(
        Character,
        related_name="theme_templates",
        blank=True,
        verbose_name="角色",
    )
    purchase_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="入手日期",
    )
    is_official = models.BooleanField(
        default=False,
        verbose_name="是否官谷",
    )
    notes = models.TextField(
        null=True,
        blank=True,
        verbose_name="备注",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "主题模板"
        verbose_name_plural = "主题模板"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.theme.name} template"


class Goods(models.Model):
    """
    谷子核心表，关联 IP / 角色 / 品类 / 主题 以及 物理位置 StorageNode。
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="资产ID",
    )

    name = models.CharField(
        max_length=200,
        db_index=True,
        verbose_name="谷子名称",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="goods",
        db_index=True,
        verbose_name="所属用户",
    )

    # 多维关联
    ip = models.ForeignKey(
        IP,
        on_delete=models.PROTECT,
        related_name="goods",
        verbose_name="IP作品",
    )
    theme = models.ForeignKey(
        Theme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goods",
        verbose_name="主题",
        help_text="谷子所属主题，例如：夏日主题、节日主题等",
    )
    characters = models.ManyToManyField(
        Character,
        related_name="goods",
        verbose_name="角色",
        help_text="可关联多个角色，例如双人立牌可以关联流萤和花火",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="goods",
        verbose_name="品类",
    )
    location = models.ForeignKey(
        "location.StorageNode",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goods",
        verbose_name="物理位置",
    )

    # 资产细节
    main_photo = models.ImageField(
        upload_to="goods/main/",
        null=True,
        blank=True,
        verbose_name="主图",
    )
    quantity = models.PositiveIntegerField(default=1, verbose_name="数量")
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="购入单价",
    )
    purchase_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="入手时间",
    )
    is_official = models.BooleanField(
        default=True,
        verbose_name="是否官谷",
    )

    STATUS_CHOICES = (
        ("draft", "草稿"),
        ("in_cabinet", "在馆"),
        ("outdoor", "出街中"),
        ("sold", "已售出"),
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="in_cabinet",
        verbose_name="状态",
    )

    notes = models.TextField(
        null=True,
        blank=True,
        verbose_name="备注",
    )

    # 自定义排序字段：值越小越靠前，默认0
    order = models.BigIntegerField(
        default=0,
        db_index=True,
        verbose_name="自定义排序值",
        help_text="值越小越靠前，默认0",
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "谷子"
        verbose_name_plural = "谷子"
        # 默认排序：先按自定义顺序值从小到大，其次按创建时间倒序（保证新建未手动排序的谷子有稳定顺序）
        ordering = ["order", "-created_at"]
        indexes = [
            models.Index(fields=["location"]),
            models.Index(fields=["user", "location"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return self.name


class GuziImage(models.Model):
    """
    谷子补充图片表，例如背板细节、瑕疵点等。
    """

    guzi = models.ForeignKey(
        Goods,
        on_delete=models.CASCADE,
        related_name="additional_photos",
        verbose_name="关联谷子",
    )
    image = models.ImageField(
        upload_to="goods/extra/",
        verbose_name="补充图片",
    )
    label = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="图片标签",
        help_text="如：背板细节、瑕疵点",
    )

    class Meta:
        verbose_name = "谷子补充图片"
        verbose_name_plural = "谷子补充图片"

    def __str__(self):
        return f"{self.guzi.name} - {self.label or '补充图'}"


class Showcase(models.Model):
    """
    展柜模型，用于自定义展示谷子。
    用户可以创建多个展柜，每个展柜可以包含多个分类（归纳）。
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="展柜ID",
    )
    name = models.CharField(
        max_length=200,
        db_index=True,
        verbose_name="展柜名称",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="showcases",
        db_index=True,
        verbose_name="所属用户",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="展柜描述",
    )
    cover_image = models.ImageField(
        upload_to="showcases/covers/",
        null=True,
        blank=True,
        verbose_name="封面图片",
    )
    order = models.BigIntegerField(
        default=0,
        db_index=True,
        verbose_name="排序值",
        help_text="值越小越靠前，默认0",
    )
    is_public = models.BooleanField(
        default=True,
        verbose_name="是否公开",
        help_text="预留字段，用于未来扩展",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "展柜"
        verbose_name_plural = "展柜"
        ordering = ["order", "-created_at"]

    def __str__(self):
        return self.name


class ShowcaseGoods(models.Model):
    """
    展柜谷子关联模型，用于将谷子添加到展柜中。
    同一谷子在同一展柜中只能出现一次。
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="关联ID",
    )
    showcase = models.ForeignKey(
        Showcase,
        on_delete=models.CASCADE,
        related_name="showcase_goods",
        verbose_name="所属展柜",
    )
    goods = models.ForeignKey(
        Goods,
        on_delete=models.CASCADE,
        related_name="showcases",
        verbose_name="关联谷子",
        help_text="删除谷子时自动从展柜中移除",
    )
    order = models.BigIntegerField(
        default=0,
        db_index=True,
        verbose_name="排序值",
        help_text="用于在分类内排序，值越小越靠前",
    )
    notes = models.TextField(
        null=True,
        blank=True,
        verbose_name="备注",
        help_text="在展柜中的特殊说明",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "展柜谷子关联"
        verbose_name_plural = "展柜谷子关联"
        ordering = ["order", "-created_at"]
        unique_together = ("showcase", "goods")

    def __str__(self):
        return f"{self.showcase.name} - {self.goods.name}"


# ==================== BGM 自动同步 ====================


class JournalBook(models.Model):
    """
    Editable scrapbook that can contain multiple journal pages.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="手帐本ID",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="journal_books",
        db_index=True,
        verbose_name="所属用户",
    )
    title = models.CharField(max_length=200, db_index=True, verbose_name="手帐标题")
    description = models.TextField(null=True, blank=True, verbose_name="手帐描述")
    cover_image = models.ImageField(
        upload_to="journals/covers/",
        null=True,
        blank=True,
        verbose_name="手帐封面",
    )
    order = models.BigIntegerField(default=0, db_index=True, verbose_name="排序值")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "手帐本"
        verbose_name_plural = "手帐本"
        ordering = ["order", "-updated_at"]

    def __str__(self):
        return self.title


def default_journal_page_content():
    return {"version": 2, "layers": []}


class JournalPage(models.Model):
    """
    One editable canvas page inside a scrapbook.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="手帐页ID",
    )
    book = models.ForeignKey(
        JournalBook,
        on_delete=models.CASCADE,
        related_name="pages",
        verbose_name="所属手帐本",
    )
    title = models.CharField(max_length=200, default="第 1 页", verbose_name="页面标题")
    page_no = models.PositiveIntegerField(default=1, db_index=True, verbose_name="页码")
    width = models.PositiveIntegerField(default=1080, verbose_name="画布宽度")
    height = models.PositiveIntegerField(default=1440, verbose_name="画布高度")
    background = models.CharField(max_length=50, default="#fffaf0", verbose_name="背景")
    background_style = models.CharField(max_length=20, default="plain", verbose_name="背景样式")
    content = models.JSONField(default=default_journal_page_content, verbose_name="图层内容")
    revision = models.PositiveIntegerField(default=1, verbose_name="内容修订号")
    share_token = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        unique=True,
        db_index=True,
        verbose_name="公开分享令牌",
    )
    preview_image = models.ImageField(
        upload_to="journals/previews/",
        null=True,
        blank=True,
        verbose_name="页面预览图",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "手帐页"
        verbose_name_plural = "手帐页"
        ordering = ["page_no", "created_at"]
        unique_together = ("book", "page_no")

    def __str__(self):
        return f"{self.book.title} - {self.title}"


class JournalPageVersion(models.Model):
    """
    Saved snapshot of a journal page for rollback.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="手帐页版本ID",
    )
    page = models.ForeignKey(
        JournalPage,
        on_delete=models.CASCADE,
        related_name="versions",
        verbose_name="所属手帐页",
    )
    version_no = models.PositiveIntegerField(db_index=True, verbose_name="版本号")
    content = models.JSONField(default=default_journal_page_content, verbose_name="图层内容")
    preview_image = models.ImageField(
        upload_to="journals/version_previews/",
        null=True,
        blank=True,
        verbose_name="版本预览图",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "手帐页版本"
        verbose_name_plural = "手帐页版本"
        ordering = ["-version_no"]
        unique_together = ("page", "version_no")

    def __str__(self):
        return f"{self.page.title} v{self.version_no}"


class BGMSyncSettings(models.Model):
    """全局 BGM 自动同步配置（单例：pk 固定为 1）。

    通过 ``BGMSyncSettings.get_solo()`` 获取唯一实例。
    """

    FREQUENCY_CHOICES = (
        ("daily", "每天"),
        ("every_3_days", "每3天"),
        ("weekly", "每周"),
    )

    auto_sync_enabled = models.BooleanField(
        default=False,
        verbose_name="自动同步开关",
        help_text="生产环境默认关闭。开启后调度器会按 frequency 周期触发同步。",
    )
    frequency = models.CharField(
        max_length=20,
        choices=FREQUENCY_CHOICES,
        default="weekly",
        verbose_name="同步频率",
    )
    last_run_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="上次执行时间",
    )
    next_run_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="下次执行时间",
        help_text="由调度器根据 last_run_at + frequency 自动计算",
    )
    concurrency_limit = models.IntegerField(
        default=1,
        verbose_name="并发上限",
        help_text="预留字段；当前实现为串行同步",
    )
    request_interval_ms = models.IntegerField(
        default=1500,
        verbose_name="IP 间请求间隔(ms)",
        help_text="礼貌地避免对 BGM API 过快请求",
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    updated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="最近修改人",
    )

    class Meta:
        verbose_name = "BGM 同步配置"
        verbose_name_plural = "BGM 同步配置"

    def __str__(self):
        return f"BGMSyncSettings(enabled={self.auto_sync_enabled}, freq={self.frequency})"

    @classmethod
    def get_solo(cls) -> "BGMSyncSettings":
        """获取唯一配置实例（不存在则按默认值创建）。"""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class BGMSyncJob(models.Model):
    """一次 BGM 自动/手动同步任务的总记录（任务级审计）。"""

    TRIGGER_CHOICES = (
        ("scheduled", "定时调度"),
        ("manual", "手动触发"),
    )
    STATUS_CHOICES = (
        ("running", "执行中"),
        ("succeeded", "全部成功"),
        ("partial", "部分成功"),
        ("failed", "失败"),
        ("cancelled", "已取消"),
    )

    trigger = models.CharField(
        max_length=20,
        choices=TRIGGER_CHOICES,
        db_index=True,
        verbose_name="触发方式",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="running",
        db_index=True,
        verbose_name="任务状态",
    )
    started_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="开始时间")
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name="结束时间")
    triggered_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bgm_sync_jobs",
        verbose_name="触发人",
        help_text="手动触发时填，定时为 null",
    )
    total_ips = models.IntegerField(default=0, verbose_name="处理 IP 总数")
    success_count = models.IntegerField(default=0, verbose_name="成功数")
    failed_count = models.IntegerField(default=0, verbose_name="失败数")
    skipped_count = models.IntegerField(default=0, verbose_name="跳过数")
    created_total = models.IntegerField(default=0, verbose_name="新增角色合计")
    linked_total = models.IntegerField(default=0, verbose_name="回填 ID 合计")
    error_message = models.TextField(
        null=True,
        blank=True,
        verbose_name="顶层错误摘要",
        help_text="仅记录任务级别异常，单 IP 失败明细见 items",
    )

    class Meta:
        verbose_name = "BGM 同步任务"
        verbose_name_plural = "BGM 同步任务"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["trigger", "started_at"]),
            models.Index(fields=["status", "started_at"]),
        ]

    def __str__(self):
        return f"BGMSyncJob#{self.id}({self.trigger}/{self.status})"


class BGMSyncJobItem(models.Model):
    """单 IP 在某次同步任务中的明细。IP 删除后保留快照，便于审计。"""

    STATUS_CHOICES = (
        ("success", "成功"),
        ("no_change", "无变更"),
        ("skipped_unbound", "未绑定，跳过"),
        ("error", "失败"),
    )

    job = models.ForeignKey(
        BGMSyncJob,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="所属任务",
    )
    ip = models.ForeignKey(
        IP,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bgm_sync_items",
        verbose_name="对应 IP",
    )
    ip_name_snapshot = models.CharField(
        max_length=100,
        verbose_name="IP 名称快照",
        help_text="冗余保存，IP 被删除后仍可看名字",
    )
    bgm_subject_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="BGM 作品 ID 快照",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        db_index=True,
        verbose_name="处理结果",
    )
    created_count = models.IntegerField(default=0, verbose_name="本次新增角色数")
    linked_count = models.IntegerField(default=0, verbose_name="本次回填 ID 数")
    subject_type_updated = models.BooleanField(default=False, verbose_name="是否更新 subject_type")
    error_message = models.TextField(null=True, blank=True, verbose_name="错误信息")
    duration_ms = models.IntegerField(default=0, verbose_name="耗时(ms)")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="记录时间")

    class Meta:
        verbose_name = "BGM 同步明细"
        verbose_name_plural = "BGM 同步明细"
        ordering = ["id"]
        indexes = [
            models.Index(fields=["job", "status"]),
        ]

    def __str__(self):
        return f"JobItem(job={self.job_id}, ip={self.ip_name_snapshot}, status={self.status})"
