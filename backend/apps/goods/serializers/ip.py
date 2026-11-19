"""
IP作品相关的序列化器
"""
from django.db import IntegrityError
from django.db.models import Count
from rest_framework import serializers

from core.permissions import is_admin

from ..cover_cache import delete_cover_file
from ..feature_flags import personal_ip_enabled
from ..models import IP, IPKeyword
from .fields import IPCoverField, IsPersonalField, KeywordsField


def ip_list_queryset():
    """列表与嵌套展示用的 IP queryset：注解角色数并预取关键词。

    ``IPSimpleSerializer`` 同时序列化 ``character_count``（未注解时逐行
    ``obj.characters.count()``）和 ``keywords``（未预取时逐行查询），二者都会
    产生 N+1。凡是用 ``IPSimpleSerializer`` 做 ``many=True`` 的视图，都应通过
    ``Prefetch("ip", queryset=ip_list_queryset())`` 使用这里的结果。

    注意：调用方**不能**同时 ``select_related("ip")``。Django 会用 JOIN 出来的
    实例覆盖 prefetch 结果，注解随之丢失，N+1 静默回到原状。
    """
    return IP.objects.annotate(
        character_count=Count("characters", distinct=True)
    ).prefetch_related("keywords")


class IPKeywordSerializer(serializers.ModelSerializer):
    """IP关键词序列化器"""

    class Meta:
        model = IPKeyword
        fields = ("id", "value")


class IPSimpleSerializer(serializers.ModelSerializer):
    """IP简单序列化器（用于列表和嵌套显示）"""

    keywords = IPKeywordSerializer(many=True, read_only=True, help_text="IP关键词列表")
    cover_image = IPCoverField(
        read_only=True,
        help_text="作品封面绝对地址（服务器托管）；为空时前端用作品首字占位",
    )
    character_count = serializers.SerializerMethodField(help_text="该IP下的角色数量")
    user_id = serializers.IntegerField(
        read_only=True,
        allow_null=True,
        help_text="归属用户ID；为空表示管理员维护的官方全局IP",
    )
    is_personal = serializers.SerializerMethodField(help_text="是否为用户自建的个人IP")

    class Meta:
        model = IP
        fields = ("id", "name", "subject_type", "order", "keywords", "character_count",
                  "bgm_subject_id", "last_synced_at", "cover_image", "cover_checked_at",
                  "user_id", "is_personal")

    def get_character_count(self, obj):
        """统计IP下的角色数量"""
        # 如果使用了annotate预计算，直接使用结果
        if hasattr(obj, 'character_count'):
            return obj.character_count
        # 否则查询数据库
        return obj.characters.count()

    def get_is_personal(self, obj) -> bool:
        return obj.user_id is not None


class IPDetailSerializer(serializers.ModelSerializer):
    """IP详情序列化器（用于创建和更新，支持关键词操作）

    归属（``IP.user``）由本序列化器决定，视图层不再介入：

    - 普通账号：只能创建归自己的个人 IP；
    - 管理员：默认创建官方全局 IP，显式传 is_personal=true 时创建归自己的个人 IP
      （管理员账号本身也是普通用户，可以把作品收在自己名下）；
    - 归属只在**新建**时生效，更新不会改变归属；
    - ``bgm_subject_id`` 只允许管理员写入。

    ``cover_image`` 写入时外链一律由后端下载转存到服务器（见 ``cover_cache``），
    读取时输出绝对 URL，客户端不再直连 Bangumi CDN。
    """

    keywords = KeywordsField(required=False, allow_null=True, help_text="关键词列表，例如：['星铁', '崩铁', 'HSR']")
    cover_image = IPCoverField(
        help_text="作品封面：外链会在保存时下载转存到服务器，也可传 /media/ 相对路径；传空字符串或 null 表示清除",
    )
    is_personal = IsPersonalField(
        help_text="写：仅管理员新建时有效，true=创建归自己的个人作品；读：该作品是否为个人作品",
    )
    user_id = serializers.IntegerField(
        read_only=True,
        allow_null=True,
        help_text="归属用户ID；为空表示官方全局IP",
    )

    class Meta:
        model = IP
        fields = ("id", "name", "subject_type", "order", "keywords",
                  "bgm_subject_id", "last_synced_at", "cover_image",
                  "user_id", "is_personal")
        extra_kwargs = {
            # 名称唯一性按归属域判定，统一由 validate_name 给出友好文案；
            # 关掉 DRF 依据条件唯一约束自动生成的通用校验（它无法区分域）。
            "name": {"validators": []},
        }

    def validate_name(self, value):
        """按归属域校验名称唯一性（与数据库条件唯一约束保持一致）。

        - 官方域（user 为空）：全局唯一；
        - 个人域：同一用户内唯一；
        - 普通账号不得占用官方名称，避免列表/筛选里出现两个同名作品。
        """
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("作品全称不能为空")

        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return name

        instance = self.instance
        exclude_pk = instance.pk if instance is not None else None

        def exists(**filters):
            qs = IP.objects.filter(**filters)
            if exclude_pk is not None:
                qs = qs.exclude(pk=exclude_pk)
            return qs.exists()

        if is_admin(user):
            owner_id = getattr(instance, "user_id", None)
            if owner_id is None and instance is None and self._wants_personal():
                # 管理员新建个人作品：按「自己名下个人域」校验
                owner_id = user.id
            if owner_id is not None:
                # 管理员维护个人 IP：在该用户域内校验，同时仍然不允许占用官方
                # 名称——否则会破坏「个人 IP 不得与官方同名」的不变量，前台列表
                # 里会出现两个同名作品。
                if exists(user__isnull=True, name=name):
                    raise serializers.ValidationError("该名称的官方作品已存在")
                if exists(user_id=owner_id, name=name):
                    message = (
                        "你已创建过同名作品"
                        if owner_id == getattr(user, "id", None)
                        else "该用户已有同名作品"
                    )
                    raise serializers.ValidationError(message)
                return name
            if exists(user__isnull=True, name=name):
                raise serializers.ValidationError("该名称的官方作品已存在")
            return name

        if IP.objects.filter(user__isnull=True, name=name).exists():
            raise serializers.ValidationError("已存在同名官方 IP，请直接使用")
        if exists(user=user, name=name):
            raise serializers.ValidationError("你已创建过同名作品")
        return name

    def _wants_personal(self) -> bool:
        """本次请求是否要建个人作品（只在新建时才有意义）。"""
        if self.instance is not None:
            return self.instance.user_id is not None
        data = self.initial_data or {}
        try:
            return bool(data.get("is_personal"))
        except Exception:  # pragma: no cover - initial_data 异常时按官方处理
            return False

    def validate(self, attrs):
        """归属开关校验：只有新建时生效，且个人作品开关关闭时不允许创建。"""
        user = getattr(self.context.get("request"), "user", None)

        if self.instance is not None:
            # 更新不改归属，忽略请求体里的 is_personal
            attrs.pop("is_personal", None)
            return attrs

        if attrs.get("is_personal") and not is_admin(user):
            # 普通账号恒为个人作品，不认这个字段
            attrs["is_personal"] = False

        if attrs.get("is_personal") and not personal_ip_enabled():
            raise serializers.ValidationError(
                {"is_personal": "个人作品功能当前已关闭，暂时只能创建官方作品"}
            )
        return attrs

    def create(self, validated_data):
        """创建IP时确定归属并创建关键词"""
        keywords_data = validated_data.pop("keywords", [])
        wants_personal = bool(validated_data.pop("is_personal", False))
        user = getattr(self.context.get("request"), "user", None)

        if is_admin(user):
            # 管理员默认写官方域；显式 is_personal=true 时收在自己名下
            validated_data["user"] = user if wants_personal else None
        else:
            # 普通账号只能建个人 IP，且不允许直接写 BGM 绑定
            validated_data["user"] = user
            validated_data.pop("bgm_subject_id", None)
            validated_data.pop("last_synced_at", None)
        try:
            ip = IP.objects.create(**validated_data)
        except IntegrityError as exc:  # 并发下的兜底：唯一约束冲突
            raise serializers.ValidationError({"name": f"同名作品已存在（{exc}）"}) from exc

        # 创建关键词
        if keywords_data:
            for keyword_value in keywords_data:
                if keyword_value and keyword_value.strip():  # 忽略空字符串
                    IPKeyword.objects.get_or_create(ip=ip, value=keyword_value.strip())

        return ip

    def update(self, instance, validated_data):
        """更新IP时同步更新关键词"""
        keywords_data = validated_data.pop("keywords", None)

        # 更新IP基本信息
        instance.name = validated_data.get("name", instance.name)
        # 更新 subject_type（如果提供了）
        if "subject_type" in validated_data:
            instance.subject_type = validated_data.get("subject_type")
        if "order" in validated_data:
            instance.order = validated_data.get("order", instance.order)
        # 更新封面（空字符串/null 视为清除，回落到首字占位）；换图后清掉旧文件
        stale_cover = None
        if "cover_image" in validated_data:
            new_cover = validated_data.get("cover_image") or None
            old_cover = instance.cover_image
            instance.cover_image = new_cover
            if old_cover and old_cover != new_cover:
                stale_cover = old_cover
        try:
            instance.save()
        except IntegrityError as exc:  # 并发下的兜底：唯一约束冲突
            raise serializers.ValidationError({"name": f"同名作品已存在（{exc}）"}) from exc
        if stale_cover:
            delete_cover_file(stale_cover)

        # 如果提供了keywords字段，则更新关键词
        if keywords_data is not None:
            # 获取当前关键词值集合
            existing_keywords = set(instance.keywords.values_list("value", flat=True))
            new_keywords = {kw.strip() for kw in keywords_data if kw and kw.strip()}

            # 删除不再存在的关键词
            to_delete = existing_keywords - new_keywords
            if to_delete:
                instance.keywords.filter(value__in=to_delete).delete()

            # 添加新关键词
            to_add = new_keywords - existing_keywords
            for keyword_value in to_add:
                IPKeyword.objects.get_or_create(ip=instance, value=keyword_value)

        return instance


class IPOrderItemSerializer(serializers.Serializer):
    """IP作品排序项序列化器（用于批量更新排序）"""

    id = serializers.IntegerField(help_text="IP作品ID")
    order = serializers.IntegerField(help_text="排序值，值越小越靠前")


class IPBatchUpdateOrderSerializer(serializers.Serializer):
    """批量更新IP作品排序序列化器"""

    items = IPOrderItemSerializer(
        many=True,
        required=True,
        help_text="IP作品排序项列表，每个项包含id和order字段",
    )

    def validate_items(self, value):
        """验证items列表"""
        if not value:
            raise serializers.ValidationError("items列表不能为空")

        ids = [item["id"] for item in value]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("items列表中不能有重复的IP作品ID")

        return value
