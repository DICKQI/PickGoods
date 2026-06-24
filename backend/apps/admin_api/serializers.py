from __future__ import annotations

from django.db import transaction
from rest_framework import serializers

from apps.users.models import Role, User


class AdminRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("id", "name", "created_at")


class AdminUserSerializer(serializers.ModelSerializer):
    """列表 / 详情：不含密码。"""

    role = AdminRoleSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "role",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(min_length=6, max_length=128, write_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source="role",
        write_only=True,
    )

    class Meta:
        model = User
        fields = ("username", "password", "role_id")

    def validate_username(self, value: str) -> str:
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("username 不能为空")
        if User.objects.filter(username=v).exists():
            raise serializers.ValidationError("username 已存在")
        return v

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source="role",
        required=False,
        allow_null=False,
    )
    password = serializers.CharField(
        min_length=6,
        max_length=128,
        write_only=True,
        required=False,
        allow_blank=False,
    )

    class Meta:
        model = User
        fields = ("role_id", "is_active", "password")

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


# ==================== BGM 自动同步 ====================

from apps.goods.models import (  # noqa: E402
    BGMSyncJob,
    BGMSyncJobItem,
    BGMSyncSettings,
)


class BGMSyncSettingsSerializer(serializers.ModelSerializer):
    """BGM 自动同步全局配置（单例）。"""

    bound_ip_count = serializers.SerializerMethodField(help_text="已绑定 bgm_subject_id 的 IP 数量")

    class Meta:
        model = BGMSyncSettings
        fields = (
            "auto_sync_enabled",
            "frequency",
            "last_run_at",
            "next_run_at",
            "concurrency_limit",
            "request_interval_ms",
            "updated_at",
            "bound_ip_count",
        )
        read_only_fields = ("last_run_at", "next_run_at", "updated_at", "bound_ip_count")

    def get_bound_ip_count(self, obj):
        from apps.goods.models import IP
        return IP.objects.filter(bgm_subject_id__isnull=False).count()

    def update(self, instance, validated_data):
        """同步 next_run_at 与 auto_sync_enabled 的状态：
        - 关闭自动同步 → 清空 next_run_at，避免 UI 显示过期/无效的下次时间；
        - 重新开启 → 立即排一次（next_run_at 设为当前时间，下个 tick 触发）；
        - frequency 调整时如果之前开启状态，按新频率重算 next_run_at。
        """
        from apps.goods.bgm_auto_sync import compute_next_run_at
        from django.utils import timezone

        prev_enabled = instance.auto_sync_enabled
        prev_frequency = instance.frequency
        instance = super().update(instance, validated_data)

        new_enabled = instance.auto_sync_enabled
        new_frequency = instance.frequency
        changed_fields = []

        if not new_enabled:
            # 关闭：清空下次执行时间，保持 UI 与调度器一致。
            if instance.next_run_at is not None:
                instance.next_run_at = None
                changed_fields.append("next_run_at")
        else:
            if not prev_enabled:
                # 从关闭切换到开启：让调度器在下个 tick 立即触发一次。
                instance.next_run_at = timezone.now()
                changed_fields.append("next_run_at")
            elif new_frequency != prev_frequency and instance.last_run_at is not None:
                # 频率变更：按新频率从 last_run_at 重新推算。
                instance.next_run_at = compute_next_run_at(
                    new_frequency, instance.last_run_at
                )
                changed_fields.append("next_run_at")

        if changed_fields:
            instance.save(update_fields=changed_fields + ["updated_at"])
        return instance


class BGMSyncJobListSerializer(serializers.ModelSerializer):
    """任务历史列表（不含 items 明细）。"""

    triggered_by = serializers.CharField(source="triggered_by.username", read_only=True, default=None)
    duration_ms = serializers.SerializerMethodField()

    class Meta:
        model = BGMSyncJob
        fields = (
            "id",
            "trigger",
            "status",
            "started_at",
            "finished_at",
            "triggered_by",
            "total_ips",
            "success_count",
            "failed_count",
            "skipped_count",
            "created_total",
            "linked_total",
            "duration_ms",
            "error_message",
        )

    def get_duration_ms(self, obj):
        if obj.finished_at and obj.started_at:
            return int((obj.finished_at - obj.started_at).total_seconds() * 1000)
        return None


class BGMSyncJobItemSerializer(serializers.ModelSerializer):
    """单 IP 同步明细。"""

    class Meta:
        model = BGMSyncJobItem
        fields = (
            "id",
            "ip",
            "ip_name_snapshot",
            "bgm_subject_id",
            "status",
            "created_count",
            "linked_count",
            "subject_type_updated",
            "error_message",
            "duration_ms",
            "created_at",
        )


class BGMSyncJobDetailSerializer(BGMSyncJobListSerializer):
    """任务详情（含 items 概要统计，明细分页单独接口取）。"""

    class Meta(BGMSyncJobListSerializer.Meta):
        fields = BGMSyncJobListSerializer.Meta.fields
