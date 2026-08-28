from django.db import models


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
    SHAPE_TYPE_CHOICES = (
        ("round", "圆形"),
        ("square", "正方形"),
        ("rectangle", "长方形"),
    )

    shape_type = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        choices=SHAPE_TYPE_CHOICES,
        verbose_name="形状类型",
        help_text="用于图片自动分类：round（圆形）/ square（正方形）/ rectangle（长方形）",
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


class GoodsCraft(models.Model):
    """
    Goods craft dictionary for quick-filling the craft line in notes.

    This model is intentionally not related to Goods. Frontend users select a
    craft only to write plain text into Goods.notes.
    """

    name = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        verbose_name="谷子工艺名称",
    )
    order = models.IntegerField(
        default=0,
        db_index=True,
        verbose_name="排序值",
        help_text="值越小越靠前",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="是否启用",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "谷子工艺"
        verbose_name_plural = "谷子工艺"
        ordering = ["order", "id"]

    def __str__(self):
        return self.name
