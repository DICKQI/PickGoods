from django.db import transaction
from rest_framework import serializers

from core.jwt import build_access_payload, encode_hs256

from .models import Club, Role, User
from .club_serializers import normalize_store_links


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=6, max_length=128, write_only=True)
    account_type = serializers.ChoiceField(choices=User.ACCOUNT_TYPE_CHOICES, default=User.ACCOUNT_TYPE_COLLECTOR)
    application_reason = serializers.CharField(required=False, allow_blank=True, write_only=True)
    club_profile = serializers.DictField(required=False, write_only=True)

    def validate_username(self, value: str) -> str:
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("username 不能为空")
        if User.objects.filter(username=v).exists():
            raise serializers.ValidationError("username 已存在")
        return v

    def validate(self, attrs):
        if attrs.get("account_type") == User.ACCOUNT_TYPE_CLUB:
            profile = attrs.get("club_profile") or {}
            club_name = str(profile.get("name") or "").strip()
            if not club_name:
                raise serializers.ValidationError({"club_profile": {"name": "社团名称不能为空"}})
            if Club.objects.filter(name=club_name).exists():
                raise serializers.ValidationError({"club_profile": {"name": "社团名称已存在"}})
            profile["name"] = club_name
            try:
                profile["store_links"] = normalize_store_links(profile.get("store_links"))
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"club_profile": {"store_links": exc.detail}})
            attrs["club_profile"] = profile
            reason = str(attrs.get("application_reason") or "").strip()
            if not reason:
                raise serializers.ValidationError({"application_reason": "社团申请理由不能为空"})
            attrs["application_reason"] = reason
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        username = validated_data["username"]
        password = validated_data["password"]
        account_type = validated_data.get("account_type", User.ACCOUNT_TYPE_COLLECTOR)
        application_reason = validated_data.pop("application_reason", "")
        club_profile = validated_data.pop("club_profile", {}) or {}

        role, _ = Role.objects.get_or_create(name="User")
        user = User(
            username=username,
            role=role,
            account_type=account_type,
            approval_status=(User.APPROVAL_PENDING if account_type == User.ACCOUNT_TYPE_CLUB else User.APPROVAL_APPROVED),
            is_active=(account_type != User.ACCOUNT_TYPE_CLUB),
        )
        user.set_password(password)
        user.save()
        if account_type == User.ACCOUNT_TYPE_CLUB:
            profile = {
                "description": club_profile.get("description", ""),
                "announcement": club_profile.get("announcement", ""),
                "contact_name": club_profile.get("contact_name", ""),
                "contact_phone": club_profile.get("contact_phone", ""),
                "contact_email": club_profile.get("contact_email", ""),
                "store_links": club_profile.get("store_links", []),
                "address": club_profile.get("address", ""),
                "business_hours": club_profile.get("business_hours", ""),
            }
            Club.objects.create(
                user=user,
                name=str(club_profile.get("name") or "").strip(),
                application_reason=application_reason,
                **profile,
            )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)


class UserMeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    role = serializers.CharField()
    account_type = serializers.CharField()
    approval_status = serializers.CharField()
    club = serializers.DictField(allow_null=True, required=False)


class TokenResponseSerializer(serializers.Serializer):
    access_token = serializers.CharField()
    token_type = serializers.CharField()
    expires_in = serializers.IntegerField()


def build_token_response(*, user: User, secret: str, ttl_seconds: int) -> dict:
    payload = build_access_payload(user_id=user.id, ttl_seconds=ttl_seconds)
    token = encode_hs256(payload, secret=secret)
    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": int(ttl_seconds),
    }

