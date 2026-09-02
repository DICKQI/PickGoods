from __future__ import annotations

import hashlib
import math
from collections import defaultdict
from datetime import datetime

from django.db.models import Count, Max
from django.utils import timezone

from apps.goods.models import Category, ClubCatalogItem, ClubGoodsOrigin, Goods

from .models import ClubFavorite, User


CONTENT_WEIGHTS = {
    "ip": 0.55,
    "character": 0.30,
    "category": 0.15,
}
PERSONALIZED_WEIGHTS = {
    "content": 0.50,
    "direct": 0.20,
    "popularity": 0.15,
    "freshness": 0.10,
    "activity": 0.05,
}
COLD_START_WEIGHTS = {
    "popularity": 0.50,
    "freshness": 0.30,
    "activity": 0.20,
}
RECOMMENDATION_TEMPERATURE = 0.35
FRESHNESS_HALF_LIFE_DAYS = 30.0
IMPORT_SATURATION_COUNT = 5


FeatureVector = dict[int, float]


def _viewer_can_personalize(viewer) -> bool:
    return bool(
        getattr(viewer, "is_authenticated", False)
        and getattr(viewer, "is_active", False)
        and getattr(viewer, "approval_status", None) == User.APPROVAL_APPROVED
        and getattr(viewer, "account_type", None) == User.ACCOUNT_TYPE_COLLECTOR
    )


def _quantity_weight(quantity: int) -> float:
    return 1.0 + min(math.log2(max(quantity, 1)), 2.0)


def _add_category_signal(
    vector: FeatureVector,
    category_id: int | None,
    weight: float,
    parents: dict[int, int | None],
) -> None:
    current = category_id
    decay = 1.0
    visited: set[int] = set()
    while current is not None and current not in visited:
        visited.add(current)
        vector[current] = vector.get(current, 0.0) + weight * decay
        current = parents.get(current)
        decay *= 0.5


def _cosine_similarity(left: FeatureVector, right: FeatureVector) -> float:
    if not left or not right:
        return 0.0
    shared = left.keys() & right.keys()
    dot_product = sum(left[key] * right[key] for key in shared)
    if dot_product <= 0:
        return 0.0
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot_product / (left_norm * right_norm)


def _normalize_log_counts(counts: dict[int, int], club_ids: list[int]) -> dict[int, float]:
    maximum = max((counts.get(club_id, 0) for club_id in club_ids), default=0)
    if maximum <= 0:
        return {club_id: 0.0 for club_id in club_ids}
    denominator = math.log1p(maximum)
    return {
        club_id: math.log1p(counts.get(club_id, 0)) / denominator
        for club_id in club_ids
    }


def _build_user_vectors(
    viewer,
    category_parents: dict[int, int | None],
) -> tuple[FeatureVector, FeatureVector, FeatureVector]:
    ip_vector: FeatureVector = {}
    character_vector: FeatureVector = {}
    category_vector: FeatureVector = {}
    goods_rows = list(
        Goods.objects.filter(user=viewer)
        .exclude(status="draft")
        .values_list("id", "ip_id", "category_id", "quantity")
    )
    if not goods_rows:
        return ip_vector, character_vector, category_vector

    weights_by_goods = {
        goods_id: _quantity_weight(quantity)
        for goods_id, _, _, quantity in goods_rows
    }
    for goods_id, ip_id, category_id, _ in goods_rows:
        weight = weights_by_goods[goods_id]
        ip_vector[ip_id] = ip_vector.get(ip_id, 0.0) + weight
        _add_category_signal(category_vector, category_id, weight, category_parents)

    characters_by_goods: dict[object, list[int]] = defaultdict(list)
    for goods_id, character_id in (
        Goods.objects.filter(id__in=weights_by_goods)
        .values_list("id", "characters__id")
        .exclude(characters__id__isnull=True)
    ):
        characters_by_goods[goods_id].append(character_id)
    for goods_id, character_ids in characters_by_goods.items():
        divided_weight = weights_by_goods[goods_id] / len(character_ids)
        for character_id in character_ids:
            character_vector[character_id] = character_vector.get(character_id, 0.0) + divided_weight

    return ip_vector, character_vector, category_vector


def _build_club_vectors(
    club_ids: list[int],
    category_parents: dict[int, int | None],
) -> tuple[
    dict[int, FeatureVector],
    dict[int, FeatureVector],
    dict[int, FeatureVector],
    dict[int, int],
    dict[int, datetime],
]:
    listed = ClubCatalogItem.objects.filter(
        club_id__in=club_ids,
        publication_status=ClubCatalogItem.PUBLICATION_LISTED,
    )
    ip_vectors: dict[int, FeatureVector] = defaultdict(dict)
    character_vectors: dict[int, FeatureVector] = defaultdict(dict)
    category_vectors: dict[int, FeatureVector] = defaultdict(dict)

    for row in listed.values("club_id", "ip_id").annotate(total=Count("id")):
        ip_vectors[row["club_id"]][row["ip_id"]] = float(row["total"])
    for row in listed.values("club_id", "category_id").annotate(total=Count("id")):
        _add_category_signal(
            category_vectors[row["club_id"]],
            row["category_id"],
            float(row["total"]),
            category_parents,
        )
    for row in (
        listed.exclude(characters__id__isnull=True)
        .values("club_id", "characters__id")
        .annotate(total=Count("id", distinct=True))
    ):
        character_vectors[row["club_id"]][row["characters__id"]] = float(row["total"])

    activity_counts: dict[int, int] = {}
    latest_listed_at: dict[int, datetime] = {}
    for row in listed.values("club_id").annotate(total=Count("id"), latest=Max("created_at")):
        activity_counts[row["club_id"]] = row["total"]
        if row["latest"] is not None:
            latest_listed_at[row["club_id"]] = row["latest"]

    return ip_vectors, character_vectors, category_vectors, activity_counts, latest_listed_at


def _collect_popularity(club_ids: list[int]) -> dict[int, int]:
    popularity: dict[int, int] = defaultdict(int)
    valid_collectors = {
        "user__is_active": True,
        "user__approval_status": User.APPROVAL_APPROVED,
        "user__account_type": User.ACCOUNT_TYPE_COLLECTOR,
    }
    for row in (
        ClubFavorite.objects.filter(club_id__in=club_ids, **valid_collectors)
        .values("club_id")
        .annotate(total=Count("user_id", distinct=True))
    ):
        popularity[row["club_id"]] += row["total"]

    for row in (
        ClubGoodsOrigin.objects.filter(
            source_item__club_id__in=club_ids,
            collector__is_active=True,
            collector__approval_status=User.APPROVAL_APPROVED,
            collector__account_type=User.ACCOUNT_TYPE_COLLECTOR,
            personal_goods__isnull=False,
        )
        .values("source_item__club_id")
        .annotate(total=Count("collector_id", distinct=True))
    ):
        popularity[row["source_item__club_id"]] += row["total"]
    return popularity


def _collect_direct_signals(viewer, club_ids: list[int]) -> tuple[set[int], dict[int, int]]:
    if not _viewer_can_personalize(viewer):
        return set(), {}
    favorites = set(
        ClubFavorite.objects.filter(user=viewer, club_id__in=club_ids).values_list("club_id", flat=True)
    )
    imports = {
        row["source_item__club_id"]: row["total"]
        for row in (
            ClubGoodsOrigin.objects.filter(
                collector=viewer,
                source_item__club_id__in=club_ids,
                personal_goods__isnull=False,
            )
            .values("source_item__club_id")
            .annotate(total=Count("source_item_id", distinct=True))
        )
    }
    return favorites, imports


def calculate_club_recommendation_scores(
    candidate_ids: list[int],
    viewer,
    *,
    now: datetime | None = None,
) -> tuple[dict[int, float], bool]:
    club_ids = list(dict.fromkeys(candidate_ids))
    if not club_ids:
        return {}, False
    reference_time = now or timezone.now()
    category_parents = dict(Category.objects.values_list("id", "parent_id"))
    (
        club_ip_vectors,
        club_character_vectors,
        club_category_vectors,
        activity_counts,
        latest_listed_at,
    ) = _build_club_vectors(club_ids, category_parents)

    popularity = _normalize_log_counts(_collect_popularity(club_ids), club_ids)
    activity = _normalize_log_counts(activity_counts, club_ids)
    freshness = {
        club_id: (
            2 ** (
                -max(0.0, (reference_time - latest_listed_at[club_id]).total_seconds())
                / 86400.0
                / FRESHNESS_HALF_LIFE_DAYS
            )
            if club_id in latest_listed_at
            else 0.0
        )
        for club_id in club_ids
    }

    can_personalize = _viewer_can_personalize(viewer)
    if can_personalize:
        user_ip, user_characters, user_categories = _build_user_vectors(viewer, category_parents)
        favorites, imports = _collect_direct_signals(viewer, club_ids)
    else:
        user_ip, user_characters, user_categories = {}, {}, {}
        favorites, imports = set(), {}
    has_personal_signals = bool(user_ip or user_characters or user_categories or favorites or imports)

    scores: dict[int, float] = {}
    for club_id in club_ids:
        if has_personal_signals:
            content_score = (
                CONTENT_WEIGHTS["ip"] * _cosine_similarity(user_ip, club_ip_vectors.get(club_id, {}))
                + CONTENT_WEIGHTS["character"]
                * _cosine_similarity(user_characters, club_character_vectors.get(club_id, {}))
                + CONTENT_WEIGHTS["category"]
                * _cosine_similarity(user_categories, club_category_vectors.get(club_id, {}))
            )
            import_score = min(imports.get(club_id, 0) / IMPORT_SATURATION_COUNT, 1.0)
            direct_score = 0.5 * float(club_id in favorites) + 0.5 * import_score
            score = (
                PERSONALIZED_WEIGHTS["content"] * content_score
                + PERSONALIZED_WEIGHTS["direct"] * direct_score
                + PERSONALIZED_WEIGHTS["popularity"] * popularity[club_id]
                + PERSONALIZED_WEIGHTS["freshness"] * freshness[club_id]
                + PERSONALIZED_WEIGHTS["activity"] * activity[club_id]
            )
        else:
            score = (
                COLD_START_WEIGHTS["popularity"] * popularity[club_id]
                + COLD_START_WEIGHTS["freshness"] * freshness[club_id]
                + COLD_START_WEIGHTS["activity"] * activity[club_id]
            )
        scores[club_id] = min(max(score, 0.0), 1.0)
    return scores, has_personal_signals


def rank_club_ids(candidate_ids: list[int], viewer, seed: str) -> list[int]:
    club_ids = list(dict.fromkeys(candidate_ids))
    scores, _ = calculate_club_recommendation_scores(club_ids, viewer)
    viewer_id = getattr(viewer, "pk", None)
    viewer_key = str(viewer_id) if viewer_id is not None else "anonymous"

    def priority(club_id: int) -> tuple[float, int]:
        digest = hashlib.sha256(f"{seed}:{viewer_key}:{club_id}".encode("utf-8")).digest()
        uniform = (int.from_bytes(digest[:8], "big") + 1) / ((1 << 64) + 1)
        weight = math.exp(scores.get(club_id, 0.0) / RECOMMENDATION_TEMPERATURE)
        return -math.log(uniform) / weight, club_id

    return sorted(club_ids, key=priority)
