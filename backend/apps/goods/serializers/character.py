"""角色相关的序列化器"""
from rest_framework import serializers

from ..models import Character, IP
from ..scoping import writable_ip_queryset
from .fields import AvatarField
from .ip import IPSimpleSerializer


class ScopedIPField(serializers.PrimaryKeyRelatedField):
    """角色可挂载的 IP 作用域。

    - 管理员：任意 IP（含官方与用户的个人 IP）；
    - 普通账号：只允许挂到自己的个人 IP 上（官方 IP 的角色仍由管理员维护）。

    作用域外的 IP 会以 "invalid pk" 形式返回 400，避免 500 或越权写入。
    """

    def get_queryset(self):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return super().get_queryset().none()
        return writable_ip_queryset(user)


class CharacterSimpleSerializer(serializers.ModelSerializer):
    ip = IPSimpleSerializer(read_only=True)
    ip_id = ScopedIPField(
        queryset=IP.objects.all(),
        source="ip",
        write_only=True,
        required=True,
        help_text="所属IP作品ID：管理员可挂任意 IP，普通账号只能挂自己的个人 IP",
    )
    avatar = AvatarField(
        required=False,
        allow_null=True,
        help_text="角色头像。可以是文件上传（multipart/form-data）或URL字符串（如 https://example.com/avatar.jpg）",
    )

    class Meta:
        model = Character
        fields = ("id", "name", "ip", "ip_id", "avatar", "gender", "bgm_character_id")
