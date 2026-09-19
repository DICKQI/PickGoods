from __future__ import annotations

import django_filters
from django.db.models import Q

from apps.goods.models import Category, Character, Goods, GoodsCraft, IP, Theme
from apps.users.models import User

from .models import AdminAuditLog


class AdminUserFilter(django_filters.FilterSet):
    created_at__gte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
    )
    created_at__lte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
    )

    class Meta:
        model = User
        fields = (
            "role",
            "account_type",
            "approval_status",
            "is_active",
            "created_at__gte",
            "created_at__lte",
        )


class AdminGoodsFilter(django_filters.FilterSet):
    category = django_filters.NumberFilter(method="filter_category_tree")
    has_main_photo = django_filters.BooleanFilter(method="filter_has_main_photo")
    purchase_date__gte = django_filters.DateFilter(
        field_name="purchase_date",
        lookup_expr="gte",
    )
    purchase_date__lte = django_filters.DateFilter(
        field_name="purchase_date",
        lookup_expr="lte",
    )
    created_at__gte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
    )
    created_at__lte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
    )
    character = django_filters.ModelMultipleChoiceFilter(
        field_name="characters",
        queryset=Character.objects.all(),
        conjoined=False,
    )

    class Meta:
        model = Goods
        fields = (
            "user",
            "ip",
            "category",
            "theme",
            "status",
            "is_official",
            "has_main_photo",
            "character",
            "purchase_date__gte",
            "purchase_date__lte",
            "created_at__gte",
            "created_at__lte",
        )

    def filter_category_tree(self, queryset, name, value):
        if not value:
            return queryset
        try:
            category = Category.objects.get(pk=value)
        except Category.DoesNotExist:
            return queryset.none()

        ids: list[int] = []

        def walk(node: Category) -> None:
            ids.append(node.pk)
            for child in node.children.all():
                walk(child)

        category = Category.objects.prefetch_related("children").get(pk=category.pk)
        walk(category)
        return queryset.filter(category_id__in=ids)

    def filter_has_main_photo(self, queryset, name, value):
        if value is True:
            return queryset.exclude(main_photo="")
        if value is False:
            return queryset.filter(Q(main_photo="") | Q(main_photo__isnull=True))
        return queryset


class AdminIPFilter(django_filters.FilterSet):
    is_bgm_bound = django_filters.BooleanFilter(method="filter_is_bgm_bound")
    has_characters = django_filters.BooleanFilter(method="filter_has_characters")
    created_at__gte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
    )
    created_at__lte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
    )

    class Meta:
        model = IP
        fields = (
            "subject_type",
            "is_bgm_bound",
            "has_characters",
            "created_at__gte",
            "created_at__lte",
        )

    def filter_has_characters(self, queryset, name, value):
        return queryset.filter(characters__isnull=not value).distinct()

    def filter_is_bgm_bound(self, queryset, name, value):
        return queryset.filter(bgm_subject_id__isnull=not value)


class AdminCharacterFilter(django_filters.FilterSet):
    is_bgm_bound = django_filters.BooleanFilter(method="filter_is_bgm_bound")
    created_at__gte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
    )
    created_at__lte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
    )

    class Meta:
        model = Character
        fields = (
            "ip",
            "gender",
            "is_bgm_bound",
            "created_at__gte",
            "created_at__lte",
        )

    def filter_is_bgm_bound(self, queryset, name, value):
        return queryset.filter(bgm_character_id__isnull=not value)


class AdminThemeFilter(django_filters.FilterSet):
    created_at__gte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
    )
    created_at__lte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
    )

    class Meta:
        model = Theme
        fields = ("user", "created_at__gte", "created_at__lte")


class AdminGoodsCraftFilter(django_filters.FilterSet):
    created_at__gte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
    )
    created_at__lte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
    )

    class Meta:
        model = GoodsCraft
        fields = ("is_active", "created_at__gte", "created_at__lte")


class AdminCategoryFilter(django_filters.FilterSet):
    class Meta:
        model = Category
        fields = {
            "parent": ("exact", "isnull"),
            "shape_type": ("exact", "in"),
        }


class AdminAuditLogFilter(django_filters.FilterSet):
    actor = django_filters.NumberFilter(field_name="actor_id")
    created_at__gte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
    )
    created_at__lte = django_filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
    )

    class Meta:
        model = AdminAuditLog
        fields = (
            "actor",
            "action",
            "resource_type",
            "resource_id",
            "created_at__gte",
            "created_at__lte",
        )
