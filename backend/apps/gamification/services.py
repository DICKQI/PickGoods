from __future__ import annotations

import logging
import json
from hashlib import sha256
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone

from apps.goods.models import (
    ClubGoodsImportEvent,
    ClubGoodsOrigin,
    Goods,
    Showcase,
    ShowcaseGoods,
)
from apps.reminder.models import Preorder
from apps.users.models import Club, User

from .constants import ELIGIBLE_GOODS_STATUSES, PAID_PREORDER_STATUSES
from .models import (
    Achievement,
    AchievementSet,
    GamificationConfig,
    MetricEvent,
    MetricSourceState,
    MetricSyncFailure,
    Reward,
    RuleCondition,
    RuleGroup,
    UserAchievement,
    UserEquippedReward,
    UserReward,
    PublicBadgeSelection,
)

logger = logging.getLogger(__name__)

CLUB_METRICS = {
    RuleCondition.METRIC_CLUB_GOODS_QUANTITY,
    RuleCondition.METRIC_CLUB_SPEND_AMOUNT,
}

SLOT_REWARD_TYPES = {
    UserEquippedReward.SLOT_PROFILE_FRAME: Reward.TYPE_PROFILE_FRAME,
    UserEquippedReward.SLOT_PROFILE_CARD_SKIN: Reward.TYPE_PROFILE_CARD_SKIN,
    UserEquippedReward.SLOT_DEFAULT_SHOWCASE_THEME: Reward.TYPE_SHOWCASE_THEME,
    UserEquippedReward.SLOT_DEFAULT_SHOWCASE_EFFECT: Reward.TYPE_SHOWCASE_EFFECT,
}


def _clear_sync_failure(source_type: str, source_id: str) -> None:
    MetricSyncFailure.objects.filter(
        source_type=source_type,
        source_id=source_id,
        resolved_at__isnull=True,
    ).update(resolved_at=timezone.now())


def _spend_components(user) -> list[dict]:
    """Return order-independent, non-overlapping canonical spend components."""
    goods_queryset = (
        Goods.objects.filter(user=user, status__in=ELIGIBLE_GOODS_STATUSES)
        .select_related("preorder_source", "ip", "category")
        .prefetch_related("characters")
    )
    preorders = (
        Preorder.objects.filter(user=user, status__in=PAID_PREORDER_STATUSES)
        .select_related("goods", "goods__ip", "goods__category")
        .prefetch_related("goods__characters")
    )
    components = []
    for goods in goods_queryset:
        preorder = getattr(goods, "preorder_source", None)
        if preorder is not None and preorder.status in PAID_PREORDER_STATUSES:
            continue
        amount = _as_decimal(goods.quantity) * _as_decimal(goods.price)
        if amount > 0:
            goods_event_time = (
                goods.gamification_spend_changed_at
                or goods.updated_at
                or goods.created_at
            )
            components.append(
                {
                    "source_id": f"goods:{goods.id}",
                    "amount": amount,
                    "metadata": _goods_metadata(goods),
                    "source_candidates": [
                        {"amount": amount, "occurred_at": goods_event_time}
                    ],
                }
            )

    for preorder in preorders:
        preorder_amount = _as_decimal(preorder.deposit_amount) + _as_decimal(preorder.balance_amount)
        goods = getattr(preorder, "goods", None)
        if goods is not None and goods.status in ELIGIBLE_GOODS_STATUSES:
            goods_amount = _as_decimal(goods.quantity) * _as_decimal(goods.price)
            amount = max(preorder_amount, goods_amount)
            metadata = _goods_metadata(goods)
            goods_event_time = (
                goods.gamification_spend_changed_at
                or goods.updated_at
                or goods.created_at
            )
        else:
            amount = preorder_amount
            metadata = {
                "preorder_id": str(preorder.id),
                "name": preorder.name,
            }
            goods_event_time = None
        if amount > 0:
            preorder_event_time = (
                preorder.gamification_spend_changed_at
                or preorder.paid_at
                or preorder.updated_at
            )
            candidates = [
                {"amount": preorder_amount, "occurred_at": preorder_event_time}
            ]
            if goods is not None and goods.status in ELIGIBLE_GOODS_STATUSES:
                candidates.append(
                    {"amount": goods_amount, "occurred_at": goods_event_time}
                )
            components.append(
                {
                    "source_id": f"preorder:{preorder.id}",
                    "amount": amount,
                    "metadata": metadata,
                    "source_candidates": candidates,
                }
            )
    return sorted(components, key=lambda item: item["source_id"])


def _component_event_time(component: dict, before: Decimal):
    candidates = [
        candidate
        for candidate in component["source_candidates"]
        if candidate["amount"] > before and candidate["occurred_at"] is not None
    ]
    if not candidates:
        return None
    winner = min(
        candidates,
        key=lambda candidate: (-candidate["amount"], candidate["occurred_at"]),
    )
    return winner["occurred_at"]


def sync_user_spend_components(
    user,
    *,
    emit_events: bool | None = None,
    occurred_at=None,
) -> None:
    if not _is_initialized():
        return
    if emit_events is None:
        emit_events = is_feature_enabled()
    events_created = False

    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        for component in _spend_components(user):
            state, created = MetricSourceState.objects.select_for_update().get_or_create(
                source_type="spend_component",
                source_id=component["source_id"],
                defaults={"user": user},
            )
            if created:
                existing_total = sum(
                    MetricEvent.objects.filter(
                        user=user,
                        event_type=MetricEvent.EVENT_SPEND_AMOUNT,
                        source_type="spend_component",
                        source_id=component["source_id"],
                    ).values_list("amount", flat=True),
                    Decimal("0.00"),
                )
                state.accrued_spend = existing_total
            should_emit = bool(emit_events)
            observed_spend = max(state.observed_spend, component["amount"])
            if should_emit and observed_spend > state.accrued_spend:
                before = state.accrued_spend
                metadata = {
                    **component["metadata"],
                    "before": str(before),
                    "after": str(observed_spend),
                }
                created_event = _create_event(
                    user=user,
                    event_type=MetricEvent.EVENT_SPEND_AMOUNT,
                    amount=observed_spend - before,
                    source_type="spend_component",
                    source_id=component["source_id"],
                    metadata=metadata,
                    occurred_at=(
                        _component_event_time(component, before)
                        or occurred_at
                        or timezone.now()
                    ),
                )
                events_created = events_created or created_event is not None
                state.accrued_spend = observed_spend
            else:
                state.accrued_spend = observed_spend
            state.observed_spend = observed_spend
            state.last_seen_at = timezone.now()
            state.user = user
            state.save()

    if events_created:
        evaluate_user(user)


def is_feature_enabled() -> bool:
    if not getattr(settings, "GAMIFICATION_ENABLED", False):
        return False
    config = GamificationConfig.objects.filter(pk=1, rollout_at__isnull=False).first()
    return config is not None


def _is_initialized() -> bool:
    return GamificationConfig.objects.filter(pk=1, rollout_at__isnull=False).exists()


def _as_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value))


def _event_key(
    source_type: str,
    source_id,
    metric: str,
    before,
    after,
    occurrence_key: str | None = None,
) -> str:
    base = f"{source_type}:{source_id}:{metric}:{before}->{after}"
    return f"{base}@{occurrence_key}" if occurrence_key else base


def _create_event(
    *,
    user,
    event_type: str,
    amount: Decimal,
    source_type: str,
    source_id: str,
    metadata: dict,
    occurred_at=None,
    occurrence_key: str | None = None,
) -> MetricEvent | None:
    event, created = MetricEvent.objects.get_or_create(
        idempotency_key=_event_key(
            source_type,
            source_id,
            event_type,
            metadata.get("before"),
            metadata.get("after"),
            occurrence_key,
        ),
        defaults={
            "user": user,
            "event_type": event_type,
            "amount": amount,
            "source_type": source_type,
            "source_id": source_id,
            "metadata": metadata,
            "occurred_at": occurred_at or timezone.now(),
        },
    )
    return event if created else None


def _goods_metadata(goods: Goods, *, before=None, after=None) -> dict:
    characters = list(goods.characters.values_list("id", "ip_id"))
    return {
        "goods_id": str(goods.id),
        "name": goods.name,
        "ip_id": goods.ip_id,
        "character_ids": [char_id for char_id, _ip_id in characters],
        "character_ip_ids": {str(char_id): ip_id for char_id, ip_id in characters},
        "category_id": goods.category_id,
        "is_official": goods.is_official,
        "before": str(before) if before is not None else None,
        "after": str(after) if after is not None else None,
    }


def _metadata_scope_hash(metadata: dict) -> str:
    scope = {
        "ip_id": metadata.get("ip_id"),
        "character_ids": sorted(metadata.get("character_ids") or []),
        "category_id": metadata.get("category_id"),
        "is_official": bool(metadata.get("is_official")),
    }
    return sha256(json.dumps(scope, sort_keys=True, default=str).encode("utf-8")).hexdigest()


def sync_goods_source(
    goods_id,
    *,
    emit_events: bool | None = None,
    occurred_at=None,
) -> None:
    if not _is_initialized():
        return
    goods = (
        Goods.objects.select_related("ip", "category", "preorder_source")
        .prefetch_related("characters")
        .filter(pk=goods_id)
        .first()
    )
    if goods is None:
        return

    if emit_events is None:
        emit_events = is_feature_enabled()
    config = GamificationConfig.load()
    eligible = goods.status in ELIGIBLE_GOODS_STATUSES
    current_quantity = _as_decimal(goods.quantity if eligible else 0)
    current_metadata = _goods_metadata(goods)
    current_scope_hash = _metadata_scope_hash(current_metadata)

    with transaction.atomic():
        User.objects.select_for_update().get(pk=goods.user_id)
        state, created = MetricSourceState.objects.select_for_update().get_or_create(
            source_type="goods",
            source_id=str(goods.id),
            defaults={"user": goods.user},
        )
        if state.user_id != goods.user_id:
            state.user = goods.user

        force_baseline = created and goods.created_at <= config.rollout_at
        should_emit = bool(emit_events and not force_baseline)
        observed_quantity = max(state.observed_quantity, current_quantity)
        events_created = False
        quantity_event_created = False

        if should_emit:
            qty_before = state.accrued_quantity
            if observed_quantity > qty_before:
                metadata = _goods_metadata(goods, before=qty_before, after=observed_quantity)
                created_event = _create_event(
                    user=goods.user,
                    event_type=MetricEvent.EVENT_GOODS_QUANTITY,
                    amount=observed_quantity - qty_before,
                    source_type="goods",
                    source_id=str(goods.id),
                    metadata=metadata,
                    occurred_at=(
                        goods.gamification_quantity_changed_at
                        or occurred_at
                        or goods.updated_at
                        or goods.created_at
                    ),
                )
                events_created = events_created or created_event is not None
                quantity_event_created = created_event is not None
                state.accrued_quantity = observed_quantity
                state.scope_hash = current_scope_hash
        else:
            state.accrued_quantity = observed_quantity

        state.observed_quantity = observed_quantity
        if not state.scope_hash:
            missing_scope_hash = True
            state.scope_hash = current_scope_hash
        else:
            missing_scope_hash = False
        state.last_seen_at = timezone.now()
        state.save()

        if (
            should_emit
            and state.accrued_quantity > 0
            and not quantity_event_created
            and (missing_scope_hash or state.scope_hash != current_scope_hash)
        ):
            scope_metadata = {
                **current_metadata,
                "before": str(state.accrued_quantity),
                "after": f"scope:{_metadata_scope_hash(current_metadata)}",
            }
            created_event = _create_event(
                user=goods.user,
                event_type=MetricEvent.EVENT_SCOPE_REFRESH,
                amount=Decimal("0.00"),
                source_type="goods",
                source_id=str(goods.id),
                metadata=scope_metadata,
                occurred_at=(
                    goods.gamification_scope_changed_at
                    or occurred_at
                    or timezone.now()
                ),
                occurrence_key=(
                    goods.gamification_scope_changed_at.isoformat()
                    if goods.gamification_scope_changed_at
                    else None
                ),
            )
            events_created = events_created or created_event is not None
            state.scope_hash = current_scope_hash
            state.save(update_fields=["scope_hash", "updated_at"])

    if events_created:
        evaluate_user(goods.user)
    sync_user_spend_components(
        goods.user,
        emit_events=emit_events,
        occurred_at=occurred_at,
    )
    if emit_events:
        unresolved = MetricSyncFailure.objects.filter(
            source_type="goods",
            source_id=str(goods.id),
            resolved_at__isnull=True,
        ).exists()
        if unresolved:
            evaluate_user(goods.user, force=True)
        _clear_sync_failure("goods", str(goods.id))


def sync_preorder_source(
    preorder_id,
    *,
    emit_events: bool | None = None,
    occurred_at=None,
) -> None:
    if not _is_initialized():
        return
    preorder = (
        Preorder.objects.select_related("user", "goods", "goods__ip", "goods__category")
        .prefetch_related("goods__characters")
        .filter(pk=preorder_id)
        .first()
    )
    if preorder is None:
        return

    config = GamificationConfig.load()
    if emit_events is None:
        emit_events = is_feature_enabled()
    current_spend = Decimal("0.00")
    if preorder.status in PAID_PREORDER_STATUSES:
        current_spend = _as_decimal(preorder.deposit_amount) + _as_decimal(preorder.balance_amount)

    with transaction.atomic():
        User.objects.select_for_update().get(pk=preorder.user_id)
        state, _created = MetricSourceState.objects.select_for_update().get_or_create(
            source_type="preorder",
            source_id=str(preorder.id),
            defaults={"user": preorder.user},
        )
        observed_spend = max(state.observed_spend, current_spend)
        state.accrued_spend = observed_spend
        state.observed_spend = observed_spend
        state.last_seen_at = timezone.now()
        state.user = preorder.user
        state.save()

    sync_user_spend_components(
        preorder.user,
        emit_events=emit_events,
        occurred_at=occurred_at or preorder.paid_at or preorder.updated_at,
    )
    if emit_events:
        unresolved = MetricSyncFailure.objects.filter(
            source_type="preorder",
            source_id=str(preorder.id),
            resolved_at__isnull=True,
        ).exists()
        if unresolved:
            evaluate_user(preorder.user, force=True)
        _clear_sync_failure("preorder", str(preorder.id))


def _valid_altar_goods(showcase: Showcase) -> list[Goods]:
    if showcase.character_id is None:
        return []
    return list(
        Goods.objects.filter(
            showcases__showcase=showcase,
            characters=showcase.character,
            status__in=ELIGIBLE_GOODS_STATUSES,
            quantity__gt=0,
        )
        .select_related("ip", "category")
        .prefetch_related("characters")
        .distinct()
    )


def sync_showcase_altar(
    showcase_id,
    *,
    emit_events: bool | None = None,
    occurred_at=None,
) -> None:
    if not _is_initialized():
        return
    showcase = (
        Showcase.objects.select_related("user", "character", "character__ip")
        .filter(pk=showcase_id)
        .first()
    )
    if showcase is None:
        return
    goods_items = _valid_altar_goods(showcase) if showcase.character_id is not None else []
    is_valid = showcase.character_id is not None and len(goods_items) >= 3

    config = GamificationConfig.load()
    if emit_events is None:
        emit_events = is_feature_enabled()
    # One showcase is one altar lifecycle. Changing its primary character must not
    # inflate progress by repeatedly switching roles.
    source_id = str(showcase.id)
    valid_since = showcase.gamification_valid_since
    ip_ids = {str(item.ip_id) for item in goods_items}
    category_ids = {item.category_id for item in goods_items}
    is_official_values = {bool(item.is_official) for item in goods_items}
    metadata = {
        "showcase_id": str(showcase.id),
        "character_id": showcase.character_id,
        "character_name": showcase.character.name if showcase.character_id else None,
        "ip_id": showcase.character.ip_id if showcase.character_id else None,
        "ip_ids": sorted(ip_ids),
        "category_ids": sorted(category_ids),
        "is_official_values": sorted(is_official_values),
        "goods_count": len(goods_items),
        "before": "0",
        "after": "1",
        "items": [
            {
                "goods_id": str(item.id),
                "ip_id": item.ip_id,
                "character_ids": list(item.characters.values_list("id", flat=True)),
                "category_id": item.category_id,
                "is_official": item.is_official,
            }
            for item in goods_items
        ],
    }

    with transaction.atomic():
        User.objects.select_for_update().get(pk=showcase.user_id)
        locked_showcase = Showcase.objects.select_for_update().only(
            "gamification_valid_since"
        ).get(pk=showcase.pk)
        valid_since = locked_showcase.gamification_valid_since
        if is_valid and valid_since is None:
            valid_since = occurred_at or timezone.now()
            locked_showcase.gamification_valid_since = valid_since
            locked_showcase.save(
                update_fields=["gamification_valid_since", "updated_at"]
            )
        state, created = MetricSourceState.objects.select_for_update().get_or_create(
            source_type="showcase_altar",
            source_id=source_id,
            defaults={"user": showcase.user},
        )
        force_baseline = created and showcase.created_at <= config.rollout_at
        should_emit = bool(emit_events and is_valid and not force_baseline)
        created_event = None
        if should_emit and state.accrued_quantity < 1:
            created_event = _create_event(
                user=showcase.user,
                event_type=MetricEvent.EVENT_VALID_ALTAR,
                amount=Decimal("1.00"),
                source_type="showcase_altar",
                source_id=source_id,
                metadata=metadata,
                occurred_at=valid_since or occurred_at or timezone.now(),
            )
            state.accrued_quantity = Decimal("1.00")
            state.observed_quantity = max(state.observed_quantity, Decimal("1.00"))
            state.last_seen_at = timezone.now()
            state.user = showcase.user
            state.save()
        else:
            if is_valid:
                state.accrued_quantity = max(state.accrued_quantity, Decimal("1.00"))
                state.observed_quantity = max(state.observed_quantity, Decimal("1.00"))
            state.last_seen_at = timezone.now()
            state.user = showcase.user
            state.save()
    if should_emit and created_event is not None:
        evaluate_user(showcase.user)
    if emit_events:
        unresolved = MetricSyncFailure.objects.filter(
            source_type="showcase_altar",
            source_id=str(showcase.id),
            resolved_at__isnull=True,
        ).exists()
        if unresolved:
            evaluate_user(showcase.user, force=True)
        _clear_sync_failure("showcase_altar", str(showcase.id))


def _event_metadata_matches(metadata: dict, filters: dict) -> bool:
    entries = metadata.get("items") or [metadata]
    for entry in entries:
        if _event_entry_matches(entry, filters):
            return True
    return False


def _event_entry_matches(entry: dict, filters: dict) -> bool:
    catalog_item_ids = {str(value) for value in filters.get("catalog_item_ids", [])}
    if catalog_item_ids and str(entry.get("goods_id", "")) not in catalog_item_ids:
        return False

    ip_ids = {int(value) for value in filters.get("ip_ids", [])}
    if ip_ids and entry.get("ip_id") not in ip_ids:
        return False

    character_ids = {int(value) for value in filters.get("character_ids", [])}
    if character_ids:
        entry_characters = {int(value) for value in entry.get("character_ids", [])}
        if not (entry_characters & character_ids):
            return False

    category_ids = {int(value) for value in filters.get("category_ids", [])}
    if category_ids and entry.get("category_id") not in category_ids:
        return False

    theme_ids = {int(value) for value in filters.get("theme_ids", [])}
    if theme_ids and entry.get("theme_id") not in theme_ids:
        return False

    official_values = filters.get("is_official")
    if official_values not in (None, []) and bool(entry.get("is_official")) not in set(official_values):
        return False
    return True


def _matching_entries(metadata: dict, filters: dict) -> list[dict]:
    entries = metadata.get("items") or [metadata]
    return [entry for entry in entries if _event_entry_matches(entry, filters)]


def _club_import_metadata(event: ClubGoodsImportEvent) -> dict:
    snapshot = event.source_snapshot or {}
    ip = snapshot.get("ip") or {}
    category = snapshot.get("category") or {}
    theme = snapshot.get("theme") or {}
    return {
        "goods_id": str(snapshot.get("id") or ""),
        "ip_id": ip.get("id"),
        "category_id": category.get("id"),
        "theme_id": theme.get("id"),
        "character_ids": [
            item.get("id")
            for item in snapshot.get("characters", [])
            if item.get("id") is not None
        ],
        "is_official": bool(snapshot.get("is_official")),
        "public_price": snapshot.get("public_price"),
        "quantity_added": event.quantity_added,
        "effective_at": event.effective_at,
    }


def _events_for_condition(condition: RuleCondition, *, user, starts_at, ends_at):
    event_types = {
        RuleCondition.METRIC_GOODS_QUANTITY: [MetricEvent.EVENT_GOODS_QUANTITY],
        RuleCondition.METRIC_VALID_ALTARS: [MetricEvent.EVENT_VALID_ALTAR],
        RuleCondition.METRIC_SPEND_AMOUNT: [MetricEvent.EVENT_SPEND_AMOUNT],
        RuleCondition.METRIC_DISTINCT_IP_COUNT: [
            MetricEvent.EVENT_GOODS_QUANTITY,
            MetricEvent.EVENT_SCOPE_REFRESH,
        ],
        RuleCondition.METRIC_DISTINCT_CHARACTER_COUNT: [
            MetricEvent.EVENT_GOODS_QUANTITY,
            MetricEvent.EVENT_SCOPE_REFRESH,
        ],
    }.get(condition.metric, [])
    if not event_types:
        return MetricEvent.objects.none()
    return MetricEvent.objects.filter(
        user=user,
        event_type__in=event_types,
        occurred_at__gte=starts_at,
        occurred_at__lte=ends_at,
    ).order_by("occurred_at", "id")


def evaluate_condition(condition: RuleCondition, *, user, starts_at, ends_at, club=None) -> dict:
    if condition.metric in CLUB_METRICS:
        if club is None:
            matching = []
        else:
            club_events = (
                ClubGoodsImportEvent.objects.filter(
                    origin__collector=user,
                    origin__club=club,
                    effective_at__isnull=False,
                    effective_at__gte=starts_at,
                    effective_at__lte=ends_at,
                )
                .select_related("origin")
                .select_related("origin__personal_goods")
                .order_by("effective_at", "id")
            )
            matching = []
            for event in club_events:
                metadata = _club_import_metadata(event)
                if (
                    _event_entry_matches(
                        metadata,
                        condition.filters or {},
                    )
                ):
                    matching.append(event)
    else:
        events = list(
            _events_for_condition(
                condition,
                user=user,
                starts_at=starts_at,
                ends_at=ends_at,
            )
        )
        matching = [
            event
            for event in events
            if _event_metadata_matches(
                event.metadata or {},
                condition.filters or {},
            )
        ]

    if condition.metric == RuleCondition.METRIC_GOODS_QUANTITY:
        current = sum((_as_decimal(event.amount) for event in matching), Decimal("0.00"))
    elif condition.metric == RuleCondition.METRIC_SPEND_AMOUNT:
        current = sum((_as_decimal(event.amount) for event in matching), Decimal("0.00"))
    elif condition.metric == RuleCondition.METRIC_CLUB_GOODS_QUANTITY:
        current = sum(
            (Decimal(event.quantity_added) for event in matching),
            Decimal("0.00"),
        )
    elif condition.metric == RuleCondition.METRIC_CLUB_SPEND_AMOUNT:
        current = sum(
            (
                _as_decimal(_club_import_metadata(event)["public_price"])
                * Decimal(event.quantity_added)
                for event in matching
            ),
            Decimal("0.00"),
        )
    elif condition.metric == RuleCondition.METRIC_VALID_ALTARS:
        current = Decimal(
            len(
                {
                    str(event.metadata.get("character_id"))
                    for event in matching
                    if event.metadata.get("character_id") is not None
                }
            )
        )
    elif condition.metric == RuleCondition.METRIC_DISTINCT_IP_COUNT:
        selected_ip_ids = {int(value) for value in (condition.filters or {}).get("ip_ids", [])}
        current = Decimal(
            len(
                {
                    int(entry["ip_id"])
                    for event in matching
                    for entry in _matching_entries(event.metadata or {}, condition.filters or {})
                    if entry.get("ip_id") is not None
                    and (not selected_ip_ids or int(entry["ip_id"]) in selected_ip_ids)
                }
            )
        )
    else:
        selected_character_ids = {
            int(value) for value in (condition.filters or {}).get("character_ids", [])
        }
        current = Decimal(
            len(
                {
                    int(character_id)
                    for event in matching
                    for entry in _matching_entries(event.metadata or {}, condition.filters or {})
                    for character_id in entry.get("character_ids", [])
                    if character_id is not None
                    and (
                        not selected_character_ids
                        or int(character_id) in selected_character_ids
                    )
                }
            )
        )

    threshold = _as_decimal(condition.threshold)
    return {
        "id": condition.id,
        "metric": condition.metric,
        "label": condition.get_metric_display(),
        "current": float(current),
        "target": float(threshold),
        "satisfied": current >= threshold,
        "filters": condition.filters or {},
    }


def _range_for_achievement(achievement: Achievement):
    if achievement.set.club_id:
        starts_at = achievement.first_published_at or timezone.now()
        if achievement.set.starts_at:
            starts_at = max(starts_at, achievement.set.starts_at)
        ends_at = (
            achievement.set.ends_at
            if achievement.set.is_limited and achievement.set.ends_at
            else timezone.now()
        )
        return starts_at, ends_at
    config = GamificationConfig.load()
    starts_at = achievement.set.starts_at or config.rollout_at
    ends_at = achievement.set.ends_at if achievement.set.is_limited and achievement.set.ends_at else timezone.now()
    return starts_at, ends_at


def evaluate_achievement(user, achievement: Achievement) -> dict:
    starts_at, ends_at = _range_for_achievement(achievement)
    club = achievement.set.club
    groups = []
    condition_results = []
    for group in achievement.rule_groups.all():
        results = [
            evaluate_condition(
                condition,
                user=user,
                starts_at=starts_at,
                ends_at=ends_at,
                club=club,
            )
            for condition in group.conditions.all()
        ]
        if group.operator == RuleGroup.OPERATOR_ANY:
            group_satisfied = any(item["satisfied"] for item in results)
        else:
            group_satisfied = bool(results) and all(item["satisfied"] for item in results)
        groups.append(
            {
                "id": group.id,
                "operator": group.operator,
                "satisfied": group_satisfied,
                "conditions": results,
            }
        )
        condition_results.extend(results)

    if achievement.root_operator == Achievement.OPERATOR_ANY:
        unlocked = any(item["satisfied"] for item in groups)
    else:
        unlocked = bool(groups) and all(item["satisfied"] for item in groups)
    percent = (
        Decimal(sum(1 for item in condition_results if item["satisfied"]))
        / Decimal(len(condition_results))
        * Decimal("100")
        if condition_results
        else Decimal("0.00")
    )
    progress = {
        "root_operator": achievement.root_operator,
        "groups": groups,
        "satisfied_conditions": sum(1 for item in condition_results if item["satisfied"]),
        "total_conditions": len(condition_results),
    }

    with transaction.atomic():
        state, _ = UserAchievement.objects.select_for_update().get_or_create(
            user=user,
            achievement=achievement,
        )
        state.progress = progress
        state.progress_percent = percent
        if unlocked and state.status == UserAchievement.STATUS_LOCKED:
            state.status = UserAchievement.STATUS_UNLOCKED
            state.unlocked_at = timezone.now()
            state.unseen = True
        state.save()
    return {
        "achievement": achievement,
        "state": state,
        "progress": progress,
    }


def evaluate_user(user, *, force: bool = False, club=None) -> list[dict]:
    if (not force and not is_feature_enabled()) or getattr(user, "account_type", None) != "collector":
        return []
    achievements = Achievement.objects.filter(is_active=True, set__is_active=True)
    if club is None:
        achievements = achievements.filter(set__club__isnull=True)
    else:
        achievements = achievements.filter(set__club=club)
    achievements = (
        achievements
        .select_related("set")
        .prefetch_related(
            Prefetch("rule_groups", queryset=RuleGroup.objects.prefetch_related("conditions")),
            "rewards",
        )
        .order_by("set__order", "order", "id")
    )
    return [evaluate_achievement(user, achievement) for achievement in achievements]


def sync_club_import_event(event_id) -> None:
    if not is_feature_enabled():
        return
    event = (
        ClubGoodsImportEvent.objects.select_related(
            "origin",
            "origin__collector",
            "origin__club",
            "origin__personal_goods",
        )
        .filter(pk=event_id)
        .first()
    )
    if (
        event is None
        or event.origin.collector is None
        or event.origin.club is None
        or event.origin.collector.account_type != User.ACCOUNT_TYPE_COLLECTOR
    ):
        _clear_sync_failure("club_import", str(event_id))
        return
    try:
        evaluate_user(event.origin.collector, club=event.origin.club)
    except Exception:
        logger.exception("Unable to evaluate club gamification import")
        raise
    _clear_sync_failure("club_import", str(event_id))


def sync_goods_club_sources(goods_id) -> None:
    goods = (
        Goods.objects.select_related("user")
        .filter(pk=goods_id)
        .first()
    )
    if goods is None:
        return
    origins = (
        ClubGoodsOrigin.objects.filter(personal_goods_id=goods_id)
        .select_related("collector", "club")
        .distinct()
    )
    if goods.status in ELIGIBLE_GOODS_STATUSES and goods.gamification_eligible_since:
        ClubGoodsImportEvent.objects.filter(
            origin__personal_goods_id=goods_id,
            effective_at__isnull=True,
        ).update(effective_at=goods.gamification_eligible_since)
    if not is_feature_enabled():
        return
    for origin in origins:
        if (
            origin.collector is None
            or origin.club is None
            or origin.collector.account_type != User.ACCOUNT_TYPE_COLLECTOR
        ):
            continue
        evaluate_user(origin.collector, club=origin.club)


def publish_club_achievements(club) -> int:
    if not is_feature_enabled():
        return 0
    collector_ids = (
        ClubGoodsImportEvent.objects.filter(
            origin__club=club,
            origin__collector__account_type=User.ACCOUNT_TYPE_COLLECTOR,
            origin__collector__is_active=True,
        )
        .values_list("origin__collector_id", flat=True)
        .distinct()
    )
    evaluated = 0
    for user in User.objects.filter(id__in=collector_ids).iterator():
        evaluate_user(user, club=club)
        evaluated += 1
    return evaluated


def reconcile_club_achievements() -> int:
    """Materialize active club achievements for every participating collector."""
    if not is_feature_enabled():
        return 0
    pairs = (
        ClubGoodsOrigin.objects.filter(
            club__isnull=False,
            club__deleted_at__isnull=True,
            collector__isnull=False,
            collector__account_type=User.ACCOUNT_TYPE_COLLECTOR,
            collector__is_active=True,
        )
        .values_list("club_id", "collector_id")
        .distinct()
    )
    users_by_club: dict[int, set[int]] = {}
    for club_id, collector_id in pairs:
        users_by_club.setdefault(club_id, set()).add(collector_id)

    evaluated = 0
    for club_id, user_ids in users_by_club.items():
        club = Club.objects.filter(pk=club_id, deleted_at__isnull=True).first()
        if club is None:
            continue
        for user in User.objects.filter(id__in=user_ids, is_active=True).iterator():
            evaluate_user(user, club=club, force=True)
            evaluated += 1
    return evaluated


def claim_achievement(user, achievement_id: int) -> tuple[UserAchievement, list[UserReward]]:
    with transaction.atomic():
        state = (
            UserAchievement.objects.select_for_update()
            .select_related(
                "achievement",
                "achievement__set",
                "achievement__set__club",
            )
            .get(
                user=user,
                achievement_id=achievement_id,
            )
        )
        if state.status == UserAchievement.STATUS_LOCKED:
            raise ValueError("成就尚未解锁")
        rewards = list(state.achievement.rewards.all())
        if state.status != UserAchievement.STATUS_CLAIMED:
            for reward in rewards:
                UserReward.objects.get_or_create(
                    user=user,
                    reward=reward,
                    defaults={"source_achievement": state.achievement},
                )
            state.status = UserAchievement.STATUS_CLAIMED
            state.claimed_at = timezone.now()
            state.unseen = False
            state.save(update_fields=["status", "claimed_at", "unseen", "updated_at"])
        grants = list(
            UserReward.objects.filter(user=user, reward__in=rewards)
            .select_related("reward", "reward__club")
            .prefetch_related("reward__assets")
            .order_by("id")
        )
    return state, grants


def equip_reward(user, slot: str, reward_id: int | None):
    if slot not in SLOT_REWARD_TYPES:
        raise ValueError("未知装备槽位")
    if reward_id is None:
        UserEquippedReward.objects.filter(user=user, slot=slot).delete()
        return None
    reward = Reward.objects.get(pk=reward_id)
    if reward.reward_type != SLOT_REWARD_TYPES[slot]:
        raise ValueError("奖励类型与槽位不匹配")
    if not UserReward.objects.filter(user=user, reward=reward).exists():
        raise ValueError("尚未拥有该奖励")
    equipment, _ = UserEquippedReward.objects.update_or_create(
        user=user,
        slot=slot,
        defaults={"reward": reward},
    )
    return equipment


def set_public_badges(user, reward_ids: list[int]) -> list[PublicBadgeSelection]:
    unique_ids = list(dict.fromkeys(int(value) for value in reward_ids))
    if len(unique_ids) > 3:
        raise ValueError("最多选择 3 枚公开徽章")
    rewards = list(
        Reward.objects.filter(
            id__in=unique_ids,
            reward_type=Reward.TYPE_BADGE,
            is_active=True,
            user_grants__user=user,
        ).distinct()
    )
    if len(rewards) != len(unique_ids):
        raise ValueError("包含未拥有或非徽章奖励")
    reward_map = {reward.id: reward for reward in rewards}
    with transaction.atomic():
        PublicBadgeSelection.objects.filter(user=user).delete()
        selections = [
            PublicBadgeSelection.objects.create(user=user, reward=reward_map[reward_id], order=index)
            for index, reward_id in enumerate(unique_ids)
        ]
    return selections


def mark_achievements_seen(user) -> int:
    return UserAchievement.objects.filter(user=user, unseen=True).update(unseen=False)


def public_badges_for_user(user_id: int):
    from .access import public_badge_queryset

    return public_badge_queryset(user_id)


def initialize_baseline(rollout_at, *, dry_run: bool = False) -> dict:
    if timezone.is_naive(rollout_at):
        rollout_at = timezone.make_aware(rollout_at, timezone.get_current_timezone())
    counts = {
        "goods": Goods.objects.count(),
        "preorders": Preorder.objects.count(),
        "showcases": Showcase.objects.filter(character__isnull=False).count(),
    }
    if dry_run:
        return counts
    GamificationConfig.objects.get_or_create(pk=1)
    with transaction.atomic():
        existing = GamificationConfig.objects.select_for_update().filter(
            pk=1,
            initialized_at__isnull=False,
        ).first()
        if existing is not None:
            raise ValueError("游戏化基线已经初始化；如需重建请先备份并显式清空配置。")
        config = GamificationConfig.load()
        config.rollout_at = rollout_at
        config.initialized_at = timezone.now()
        config.save(update_fields=["rollout_at", "initialized_at", "updated_at"])
        # 预购先建立基线，转正谷子才能稳定扣除同一笔已计入消费。
        for preorder_id in Preorder.objects.values_list("id", flat=True).iterator():
            sync_preorder_source(preorder_id, emit_events=False)
        for goods_id in Goods.objects.values_list("id", flat=True).iterator():
            sync_goods_source(goods_id, emit_events=False)
        for showcase_id in Showcase.objects.values_list("id", flat=True).iterator():
            sync_showcase_altar(
                showcase_id,
                emit_events=False,
                occurred_at=config.rollout_at,
            )
        from apps.users.models import User

        for user in User.objects.filter(account_type="collector", is_active=True).iterator():
            evaluate_user(user, force=True)
        reconcile_club_achievements()
    return counts


def _reward(code: str, name: str, reward_type: str, *, rarity=Reward.RARITY_COMMON, preset_key="", order=0) -> Reward:
    reward, _ = Reward.objects.update_or_create(
        code=code,
        defaults={
            "name": name,
            "reward_type": reward_type,
            "rarity": rarity,
            "preset_key": preset_key,
            "order": order,
            "is_active": True,
        },
    )
    return reward


def _achievement(
    *,
    code: str,
    name: str,
    achievement_set: AchievementSet,
    conditions: list[dict],
    rewards: list[Reward],
    order: int,
    is_limited: bool = False,
) -> Achievement:
    achievement, _ = Achievement.objects.update_or_create(
        code=code,
        defaults={
            "name": name,
            "set": achievement_set,
            "root_operator": Achievement.OPERATOR_ALL,
            "is_active": True,
            "is_limited": is_limited,
            "order": order,
        },
    )
    achievement.rule_groups.all().delete()
    group = RuleGroup.objects.create(achievement=achievement, operator=RuleGroup.OPERATOR_ALL, order=0)
    for index, condition in enumerate(conditions):
        RuleCondition.objects.create(group=group, order=index, **condition)
    achievement.rewards.set(rewards)
    return achievement


def seed_defaults() -> dict:
    collection = AchievementSet.objects.update_or_create(
        code="collection-trail",
        defaults={
            "name": "收藏足迹",
            "description": "记录每一件来到身边的谷子。",
            "badge_label": "永久",
            "is_limited": False,
            "is_active": True,
            "order": 10,
        },
    )[0]
    altars = AchievementSet.objects.update_or_create(
        code="character-altars",
        defaults={
            "name": "角色痛柜",
            "description": "为喜欢的角色建起专属陈列。",
            "badge_label": "永久",
            "is_limited": False,
            "is_active": True,
            "order": 20,
        },
    )[0]
    spending = AchievementSet.objects.update_or_create(
        code="spending-trail",
        defaults={
            "name": "消费轨迹",
            "description": "每一笔投入都构成收藏故事。",
            "badge_label": "永久",
            "is_limited": False,
            "is_active": True,
            "order": 30,
        },
    )[0]
    compound = AchievementSet.objects.update_or_create(
        code="collector-challenge",
        defaults={
            "name": "藏家挑战",
            "description": "跨维度完成更完整的收藏积累。",
            "badge_label": "综合",
            "is_limited": False,
            "is_active": True,
            "order": 40,
        },
    )[0]

    order = 100

    def badge(code, name, rarity=Reward.RARITY_COMMON):
        nonlocal order
        value = _reward(code, name, Reward.TYPE_BADGE, rarity=rarity, preset_key=code, order=order)
        order += 10
        return value

    sticker_hundred = _reward(
        "journal-sticker-hundred",
        "百谷印记",
        Reward.TYPE_JOURNAL_STICKER_PACK,
        rarity=Reward.RARITY_EPIC,
        preset_key="hundred-goods",
        order=210,
    )
    frame_star = _reward(
        "profile-frame-star-orbit",
        "星轨",
        Reward.TYPE_PROFILE_FRAME,
        rarity=Reward.RARITY_EPIC,
        preset_key="star-orbit",
        order=220,
    )
    effect_galaxy = _reward(
        "showcase-effect-galaxy",
        "星河流转",
        Reward.TYPE_SHOWCASE_EFFECT,
        rarity=Reward.RARITY_LEGENDARY,
        preset_key="galaxy-flow",
        order=230,
    )
    theme_cream = _reward(
        "showcase-theme-cream",
        "奶油展台",
        Reward.TYPE_SHOWCASE_THEME,
        rarity=Reward.RARITY_RARE,
        preset_key="cream-stage",
        order=240,
    )
    journal_warm = _reward(
        "journal-background-sakura-grid",
        "樱色格纸",
        Reward.TYPE_JOURNAL_BACKGROUND,
        rarity=Reward.RARITY_RARE,
        preset_key="sakura-grid",
        order=250,
    )
    card_neon = _reward(
        "profile-card-neon",
        "霓虹收藏卡",
        Reward.TYPE_PROFILE_CARD_SKIN,
        rarity=Reward.RARITY_EPIC,
        preset_key="neon-dream",
        order=260,
    )
    effect_glow = _reward(
        "showcase-effect-soft-glow",
        "柔光呼吸",
        Reward.TYPE_SHOWCASE_EFFECT,
        rarity=Reward.RARITY_RARE,
        preset_key="soft-glow",
        order=270,
    )
    frame_crown = _reward(
        "profile-frame-crown",
        "璀璨王冠",
        Reward.TYPE_PROFILE_FRAME,
        rarity=Reward.RARITY_LEGENDARY,
        preset_key="radiant-crown",
        order=280,
    )
    stickers_coins = _reward(
        "journal-sticker-coins",
        "金币票据",
        Reward.TYPE_JOURNAL_STICKER_PACK,
        rarity=Reward.RARITY_RARE,
        preset_key="coins-tickets",
        order=290,
    )
    card_ledger = _reward(
        "profile-card-collection-ledger",
        "收藏年鉴",
        Reward.TYPE_PROFILE_CARD_SKIN,
        rarity=Reward.RARITY_EPIC,
        preset_key="collection-ledger",
        order=300,
    )
    theme_night = _reward(
        "showcase-theme-night-museum",
        "暗夜博物馆",
        Reward.TYPE_SHOWCASE_THEME,
        rarity=Reward.RARITY_EPIC,
        preset_key="night-museum",
        order=310,
    )
    effect_gold = _reward(
        "showcase-effect-gold-fall",
        "金色落屑",
        Reward.TYPE_SHOWCASE_EFFECT,
        rarity=Reward.RARITY_LEGENDARY,
        preset_key="gold-fall",
        order=320,
    )

    collection_items = [
        (1, badge("collection-1", "初谷"), []),
        (10, badge("collection-10", "十谷"), []),
        (50, badge("collection-50", "百谷藏家", Reward.RARITY_RARE), [sticker_hundred]),
        (100, badge("collection-100", "满柜星辰", Reward.RARITY_EPIC), [frame_star]),
        (300, badge("collection-300", "千谷传说", Reward.RARITY_LEGENDARY), [effect_galaxy]),
    ]
    altar_items = [
        (1, badge("altar-1", "初见痛柜"), [theme_cream]),
        (3, badge("altar-3", "三厨鼎立", Reward.RARITY_RARE), [journal_warm]),
        (5, badge("altar-5", "五角守望", Reward.RARITY_EPIC), [card_neon, effect_glow]),
        (10, badge("altar-10", "十全厨力", Reward.RARITY_LEGENDARY), [frame_crown]),
    ]
    spend_items = [
        (100, badge("spend-100", "入坑起点"), []),
        (500, badge("spend-500", "五百同行", Reward.RARITY_RARE), [stickers_coins]),
        (2000, badge("spend-2000", "两千珍藏", Reward.RARITY_EPIC), [card_ledger]),
        (5000, badge("spend-5000", "五千星河", Reward.RARITY_EPIC), [theme_night]),
        (10000, badge("spend-10000", "万元藏家", Reward.RARITY_LEGENDARY), [effect_gold]),
    ]

    for index, (threshold, badge_reward, extras) in enumerate(collection_items):
        _achievement(
            code=f"collection-{threshold}",
            name=f"收藏足迹·{threshold}件",
            achievement_set=collection,
            conditions=[
                {
                    "metric": RuleCondition.METRIC_GOODS_QUANTITY,
                    "threshold": Decimal(threshold),
                    "filters": {},
                }
            ],
            rewards=[badge_reward, *extras],
            order=(index + 1) * 10,
        )
    for index, (threshold, badge_reward, extras) in enumerate(altar_items):
        _achievement(
            code=f"altar-{threshold}",
            name=f"角色痛柜·{threshold}角",
            achievement_set=altars,
            conditions=[
                {
                    "metric": RuleCondition.METRIC_VALID_ALTARS,
                    "threshold": Decimal(threshold),
                    "filters": {},
                }
            ],
            rewards=[badge_reward, *extras],
            order=(index + 1) * 10,
        )
    for index, (threshold, badge_reward, extras) in enumerate(spend_items):
        _achievement(
            code=f"spend-{threshold}",
            name=f"消费轨迹·{threshold}元",
            achievement_set=spending,
            conditions=[
                {
                    "metric": RuleCondition.METRIC_SPEND_AMOUNT,
                    "threshold": Decimal(threshold),
                    "filters": {},
                }
            ],
            rewards=[badge_reward, *extras],
            order=(index + 1) * 10,
        )

    versatile = badge("collector-versatile", "全能藏家", Reward.RARITY_LEGENDARY)
    _achievement(
        code="collector-versatile",
        name="全能藏家",
        achievement_set=compound,
        conditions=[
            {
                "metric": RuleCondition.METRIC_GOODS_QUANTITY,
                "threshold": Decimal("50"),
                "filters": {},
            },
            {
                "metric": RuleCondition.METRIC_VALID_ALTARS,
                "threshold": Decimal("3"),
                "filters": {},
            },
            {
                "metric": RuleCondition.METRIC_SPEND_AMOUNT,
                "threshold": Decimal("1000"),
                "filters": {},
            },
        ],
        rewards=[versatile, card_ledger],
        order=10,
    )
    return {
        "sets": AchievementSet.objects.count(),
        "achievements": Achievement.objects.count(),
        "rewards": Reward.objects.count(),
    }
