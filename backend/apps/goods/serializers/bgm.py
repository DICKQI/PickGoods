"""
BGM API 相关的序列化器
"""
from rest_framework import serializers


class BGMSearchRequestSerializer(serializers.Serializer):
    """BGM搜索IP角色请求序列化器"""
    ip_name = serializers.CharField(
        max_length=200,
        required=True,
        help_text="IP作品名称，例如：崩坏：星穹铁道"
    )
    subject_type = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="作品类型筛选：1=书籍, 2=动画, 3=音乐, 4=游戏, 6=三次元。不传则搜索所有类型"
    )


class BGMCharacterSerializer(serializers.Serializer):
    """BGM角色信息序列化器（用于搜索接口返回）"""
    # BGM 角色 ID。历史接口可能不带，故可选；同步流程依赖它做精确匹配
    id = serializers.IntegerField(required=False, allow_null=True, help_text="BGM角色ID")
    name = serializers.CharField(help_text="角色名称")
    relation = serializers.CharField(required=False, allow_blank=True, help_text="角色关系，如：主角、配角、客串")
    avatar = serializers.CharField(required=False, allow_blank=True, help_text="角色头像URL")


class BGMSearchResponseSerializer(serializers.Serializer):
    """BGM搜索IP角色响应序列化器"""
    ip_name = serializers.CharField(help_text="IP作品名称")
    characters = BGMCharacterSerializer(many=True, help_text="角色列表")


class BGMCreateCharacterRequestSerializer(serializers.Serializer):
    """BGM创建角色请求序列化器"""
    ip_name = serializers.CharField(
        max_length=100,
        required=True,
        help_text="IP作品名称"
    )
    character_name = serializers.CharField(
        max_length=100,
        required=True,
        help_text="角色名称"
    )
    subject_type = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="作品类型：1=书籍, 2=动画, 3=音乐, 4=游戏, 6=三次元/特摄。可选，创建IP时使用"
    )
    avatar = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="角色头像URL。可以是BGM返回的头像URL（如 https://lain.bgm.tv/pic/crt/l/xx/xx/12345.jpg）或其他外部URL。可选"
    )
    bgm_subject_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="BGM作品ID，可选。提供后将持久化以支持后续增量同步"
    )
    bgm_character_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="BGM角色ID，可选。提供后将持久化以支持后续增量同步"
    )


class BGMCreateCharactersRequestSerializer(serializers.Serializer):
    """BGM批量创建角色请求序列化器"""
    characters = BGMCreateCharacterRequestSerializer(
        many=True,
        required=True,
        help_text="角色列表，每个角色包含ip_name和character_name"
    )


# ==================== 新增：两步式搜索相关序列化器 ====================

class BGMSubjectSerializer(serializers.Serializer):
    """BGM作品信息序列化器"""
    id = serializers.IntegerField(help_text="BGM作品ID")
    name = serializers.CharField(help_text="作品原名")
    name_cn = serializers.CharField(allow_blank=True, help_text="作品中文名")
    type = serializers.IntegerField(help_text="作品类型代码：1=书籍, 2=动画, 3=音乐, 4=游戏, 6=三次元/特摄")
    type_name = serializers.CharField(help_text="作品类型名称")
    image = serializers.CharField(allow_blank=True, help_text="作品封面图URL")


class BGMSearchSubjectsRequestSerializer(serializers.Serializer):
    """搜索IP作品列表请求序列化器"""
    keyword = serializers.CharField(
        max_length=200,
        required=True,
        help_text="搜索关键词，例如：崩坏"
    )
    subject_type = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="作品类型筛选：1=书籍, 2=动画, 3=音乐, 4=游戏, 6=三次元。不传则搜索所有类型"
    )


class BGMSearchSubjectsResponseSerializer(serializers.Serializer):
    """搜索IP作品列表响应序列化器"""
    subjects = BGMSubjectSerializer(many=True, help_text="作品列表")


class BGMGetCharactersBySubjectIdRequestSerializer(serializers.Serializer):
    """根据BGM作品ID获取角色请求序列化器"""
    subject_id = serializers.IntegerField(
        required=True,
        help_text="BGM作品ID"
    )


class BGMGetCharactersBySubjectIdResponseSerializer(serializers.Serializer):
    """根据BGM作品ID获取角色响应序列化器"""
    subject_id = serializers.IntegerField(help_text="BGM作品ID")
    subject_name = serializers.CharField(help_text="作品名称")
    characters = BGMCharacterSerializer(many=True, help_text="角色列表")


# ==================== 增量同步：预览 / 应用 ====================

class BGMSyncPreviewRequestSerializer(serializers.Serializer):
    """从 BGM 同步预览请求

    - 若该 IP 已经记录了 bgm_subject_id，可以不传 subject_id（服务端使用已绑定值）；
    - 历史 IP 首次同步时通过弹窗内手动搜索后传入 subject_id 完成回填。
    """
    subject_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="可选。若 IP 尚未绑定 BGM 作品，则必须提供，并会在 apply 阶段持久化"
    )


class BGMSyncDiffItemSerializer(serializers.Serializer):
    """同步预览中的单条角色 diff 项"""
    action = serializers.ChoiceField(
        choices=[
            ("new", "新增"),                  # BGM 上有而本地没有
            ("link_by_name", "按名字回填ID"),  # 本地存在同名角色但 bgm_character_id 为空
            ("matched", "已关联无变更"),       # 已经按 ID 匹配，本地存在
            ("local_only", "本地独有"),        # 本地存在但 BGM 上没有对应（按策略不处理）
            ("skipped_duplicate", "BGM重复"),  # BGM 返回了多条同名角色，仅第一条生效
        ],
        help_text="该角色在同步中的处理动作"
    )
    bgm_character_id = serializers.IntegerField(required=False, allow_null=True)
    name = serializers.CharField()
    relation = serializers.CharField(required=False, allow_blank=True)
    avatar = serializers.CharField(required=False, allow_blank=True)
    local_character_id = serializers.IntegerField(required=False, allow_null=True)


class BGMSyncPreviewResponseSerializer(serializers.Serializer):
    """同步预览响应"""
    ip_id = serializers.IntegerField(help_text="本地 IP ID")
    ip_name = serializers.CharField(help_text="本地 IP 名称")
    bgm_subject_id = serializers.IntegerField(help_text="本次同步使用的 BGM subject_id")
    bgm_subject_name = serializers.CharField(help_text="BGM 上的作品名称")
    bgm_subject_type = serializers.IntegerField(
        required=False, allow_null=True, help_text="BGM 上的作品类型代码"
    )
    subject_type_will_update = serializers.BooleanField(
        help_text="apply 时是否会更新本地 subject_type"
    )
    will_link_subject = serializers.BooleanField(
        help_text="apply 时是否会首次写入 bgm_subject_id"
    )
    items = BGMSyncDiffItemSerializer(many=True)
    summary = serializers.DictField(
        help_text="统计：new / link_by_name / matched / local_only / skipped_duplicate 各自数量"
    )


class BGMSyncApplyItemSerializer(serializers.Serializer):
    """apply 阶段用户在前端勾选的待执行项

    仅 new / link_by_name 两类需要用户确认；matched 项可忽略，local_only 不处理。
    """
    action = serializers.ChoiceField(choices=[("new", "新增"), ("link_by_name", "按名字回填ID")])
    bgm_character_id = serializers.IntegerField(required=False, allow_null=True)
    name = serializers.CharField()
    avatar = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    local_character_id = serializers.IntegerField(required=False, allow_null=True)


class BGMSyncApplyRequestSerializer(serializers.Serializer):
    """同步应用请求"""
    subject_id = serializers.IntegerField(
        required=False, allow_null=True,
        help_text="可选。若 IP 尚未绑定 BGM 作品，必须传入，apply 时持久化"
    )
    items = BGMSyncApplyItemSerializer(
        many=True,
        help_text="用户确认要执行的差异项列表（new / link_by_name）"
    )
    update_subject_type = serializers.BooleanField(
        required=False, default=True,
        help_text="是否同步 BGM 的 subject_type 到本地（仅当本地为空或不同时生效）"
    )


class BGMSyncApplyResponseSerializer(serializers.Serializer):
    """同步应用响应"""
    ip_id = serializers.IntegerField()
    bgm_subject_id = serializers.IntegerField()
    created_count = serializers.IntegerField(help_text="新增角色数")
    linked_count = serializers.IntegerField(help_text="按名字回填 bgm_character_id 的角色数")
    subject_linked = serializers.BooleanField(help_text="本次是否完成 bgm_subject_id 首次绑定")
    subject_type_updated = serializers.BooleanField(help_text="本次是否更新了 subject_type")
    last_synced_at = serializers.DateTimeField(allow_null=True)
    details = serializers.ListField(child=serializers.DictField(), help_text="每条执行结果明细")
