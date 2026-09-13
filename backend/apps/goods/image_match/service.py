from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable

import numpy as np

from apps.goods.models import Goods, GoodsImageFingerprint, GoodsImageMatchAttempt

from .config import (
    ALGORITHM_VERSION,
    CANDIDATE_LIMIT,
    ELIGIBLE_STATUSES,
    MATCH_PIPELINE_VERSION,
    get_candidate_min_score,
    get_embedding_match_min,
    get_match_margin_min,
    get_patch_top_k,
    get_patch_weight,
    get_phash_distance_max,
    get_rerank_limit,
)
from .exceptions import ModelUnavailableError
from .features import (
    decode_image,
    extract_query_features,
    hamming_distance,
    _get_engine,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MatchCandidate:
    goods: Goods
    score: float
    confidence: str
    phash_distance: int
    coarse_score: float | None = None
    patch_score: float | None = None


@dataclass(frozen=True)
class MatchOutcome:
    decision: str
    match: MatchCandidate | None
    candidates: tuple[MatchCandidate, ...]
    top_score: float | None
    top_margin: float | None
    algorithm_version: str = MATCH_PIPELINE_VERSION


@dataclass(frozen=True)
class _RankedFingerprint:
    fingerprint: GoodsImageFingerprint
    score: float
    phash_distance: int
    best_variant_index: int = 0
    coarse_score: float | None = None
    patch_score: float | None = None


def confidence_for_score(score: float) -> str:
    if score >= 0.94:
        return "high"
    if score >= 0.88:
        return "medium"
    return "low"


def _eligible_fingerprints(user) -> list[GoodsImageFingerprint]:
    queryset = (
        GoodsImageFingerprint.objects.filter(
            goods__user=user,
            goods__status__in=ELIGIBLE_STATUSES,
            algorithm_version=ALGORITHM_VERSION,
        )
        .exclude(goods__main_photo="")
        .exclude(goods__main_photo__isnull=True)
        .select_related(
            "goods",
            "goods__ip",
            "goods__category",
            "goods__location",
            "goods__theme",
        )
        .prefetch_related("goods__characters")
    )
    fingerprints = list(queryset)
    return [
        fingerprint
        for fingerprint in fingerprints
        if fingerprint.source_name == fingerprint.goods.main_photo.name
    ]


def _embedding_matrix(
    fingerprints: Iterable[GoodsImageFingerprint],
) -> tuple[list[GoodsImageFingerprint], np.ndarray]:
    valid: list[GoodsImageFingerprint] = []
    vectors: list[np.ndarray] = []
    for fingerprint in fingerprints:
        raw = fingerprint.embedding
        if isinstance(raw, memoryview):
            raw = raw.tobytes()
        vector = np.frombuffer(raw, dtype="<f4")
        if vector.size != fingerprint.embedding_dim or vector.size == 0:
            logger.warning(
                "跳过维度不合法的主图指纹: goods=%s expected=%s actual=%s",
                fingerprint.goods_id,
                fingerprint.embedding_dim,
                vector.size,
            )
            continue
        vector = np.asarray(vector, dtype=np.float32)
        norm = float(np.linalg.norm(vector))
        if not np.isfinite(norm) or norm <= 1e-12:
            continue
        valid.append(fingerprint)
        vectors.append(vector / norm)
    if not valid:
        return [], np.empty((0, 0), dtype=np.float32)
    return valid, np.stack(vectors, axis=0)


def _candidate_from_ranked(item: _RankedFingerprint) -> MatchCandidate:
    return MatchCandidate(
        goods=item.fingerprint.goods,
        score=round(float(item.score), 4),
        confidence=confidence_for_score(item.score),
        phash_distance=item.phash_distance,
        coarse_score=(
            round(float(item.coarse_score), 4)
            if item.coarse_score is not None
            else None
        ),
        patch_score=(
            round(float(item.patch_score), 4)
            if item.patch_score is not None
            else None
        ),
    )


def _patch_similarity(
    query_patches: np.ndarray,
    candidate_patches: np.ndarray,
    *,
    top_k: int,
) -> float:
    query = np.asarray(query_patches, dtype=np.float32)
    candidate = np.asarray(candidate_patches, dtype=np.float32)
    if query.ndim != 2 or candidate.ndim != 2 or query.shape[1] != candidate.shape[1]:
        raise ValueError("patch 特征维度不一致")
    query = _normalize_matrix(query)
    candidate = _normalize_matrix(candidate)
    best_matches = (query @ candidate.T).max(axis=1)
    count = min(max(1, top_k), best_matches.size)
    top_matches = np.partition(best_matches, -count)[-count:]
    return float(np.mean(top_matches))


def _normalize_matrix(matrix: np.ndarray) -> np.ndarray:
    matrix = np.asarray(matrix, dtype=np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix / np.maximum(norms, 1e-12)


def _rerank_candidates(query, ranked: list[_RankedFingerprint]) -> list[_RankedFingerprint]:
    limit = get_rerank_limit()
    if (
        limit <= 0
        or not query.patch_embeddings
        or not query.variant_names
    ):
        return ranked

    head = ranked[:limit]
    images = []
    image_positions = []
    for position, item in enumerate(head):
        photo = getattr(item.fingerprint.goods, "main_photo", None)
        if not photo or not photo.name:
            continue
        try:
            with photo.open("rb") as source:
                images.append(decode_image(source.read()))
                image_positions.append(position)
        except Exception:  # noqa: BLE001 - 单张索引图损坏时保留粗排结果
            logger.warning(
                "局部特征重排读取主图失败: goods=%s path=%s",
                item.fingerprint.goods_id,
                photo.name,
                exc_info=True,
            )
    if not images:
        return ranked

    try:
        _, candidate_patches = _get_engine().embed_tokens(images)
    except ModelUnavailableError:
        raise
    except Exception:  # noqa: BLE001
        logger.exception("局部特征重排推理失败，回退到整图向量")
        return ranked

    weight = get_patch_weight()
    reranked = list(head)
    patch_by_position = {
        position: candidate_patches[index]
        for index, position in enumerate(image_positions)
    }
    for position, item in enumerate(head):
        patches = patch_by_position.get(position)
        if patches is None:
            continue
        query_index = item.best_variant_index
        if not 0 <= query_index < len(query.patch_embeddings):
            continue
        try:
            patch_score = _patch_similarity(
                query.patch_embeddings[query_index],
                patches,
                top_k=get_patch_top_k(),
            )
        except ValueError:
            logger.warning(
                "局部特征维度不一致: goods=%s",
                item.fingerprint.goods_id,
            )
            continue
        combined_score = (1 - weight) * item.score + weight * patch_score
        reranked[position] = _RankedFingerprint(
            fingerprint=item.fingerprint,
            score=combined_score,
            phash_distance=item.phash_distance,
            best_variant_index=item.best_variant_index,
            coarse_score=item.score,
            patch_score=patch_score,
        )

    reranked.extend(ranked[limit:])
    return sorted(
        reranked,
        key=lambda item: (-item.score, item.phash_distance, str(item.fingerprint.goods_id)),
    )


def match_goods_image(user, image_bytes: bytes) -> MatchOutcome:
    """在当前用户的在馆/出街主图中查找同款候选。"""
    image = decode_image(image_bytes)
    fingerprints = _eligible_fingerprints(user)
    if not fingerprints:
        return MatchOutcome(
            decision=GoodsImageMatchAttempt.DECISION_NOT_FOUND,
            match=None,
            candidates=(),
            top_score=None,
            top_margin=None,
        )

    query = extract_query_features(image)
    valid, matrix = _embedding_matrix(fingerprints)
    if not valid or matrix.size == 0:
        return MatchOutcome(
            decision=GoodsImageMatchAttempt.DECISION_NOT_FOUND,
            match=None,
            candidates=(),
            top_score=None,
            top_margin=None,
        )
    if query.embeddings.ndim != 2 or query.embeddings.shape[1] != matrix.shape[1]:
        raise ModelUnavailableError("查询图片向量与索引维度不一致")

    query_matrix = np.asarray(query.embeddings, dtype=np.float32)
    norms = np.linalg.norm(query_matrix, axis=1, keepdims=True)
    query_matrix = query_matrix / np.maximum(norms, 1e-12)
    scores_by_variant = matrix @ query_matrix.T
    coarse_scores = np.max(scores_by_variant, axis=1)
    best_variant_indices = np.argmax(scores_by_variant, axis=1)

    coarse_ranked = sorted(
        (
            _RankedFingerprint(
                fingerprint=fingerprint,
                score=float(score),
                phash_distance=hamming_distance(query.phash, fingerprint.phash),
                best_variant_index=int(best_variant_index),
                coarse_score=float(score),
            )
            for fingerprint, score, best_variant_index in zip(
                valid,
                coarse_scores,
                best_variant_indices,
                strict=True,
            )
        ),
        key=lambda item: (-item.score, item.phash_distance, str(item.fingerprint.goods_id)),
    )
    if not coarse_ranked:
        return MatchOutcome(
            decision=GoodsImageMatchAttempt.DECISION_NOT_FOUND,
            match=None,
            candidates=(),
            top_score=None,
            top_margin=None,
        )

    phash_matches = [
        item
        for item in coarse_ranked
        if item.phash_distance <= get_phash_distance_max()
    ]
    if phash_matches:
        matched = min(
            phash_matches,
            key=lambda item: (
                item.phash_distance,
                -item.score,
                str(item.fingerprint.goods_id),
            ),
        )
        others = [
            item
            for item in coarse_ranked
            if (
                item.fingerprint.goods_id != matched.fingerprint.goods_id
                and item.score >= get_candidate_min_score()
            )
        ]
        top_margin = (
            float(coarse_ranked[0].score - coarse_ranked[1].score)
            if len(coarse_ranked) > 1
            else 1.0
        )
        return MatchOutcome(
            decision=GoodsImageMatchAttempt.DECISION_MATCHED,
            match=_candidate_from_ranked(matched),
            candidates=tuple(
                _candidate_from_ranked(item)
                for item in others[:CANDIDATE_LIMIT]
            ),
            top_score=round(float(matched.score), 4),
            top_margin=round(top_margin, 4),
        )

    ranked = _rerank_candidates(query, coarse_ranked)
    top_score = float(ranked[0].score)
    top_margin = (
        float(ranked[0].score - ranked[1].score)
        if len(ranked) > 1
        else 1.0
    )

    if top_score >= get_embedding_match_min() and top_margin >= get_match_margin_min():
        matched = ranked[0]
        return MatchOutcome(
            decision=GoodsImageMatchAttempt.DECISION_MATCHED,
            match=_candidate_from_ranked(matched),
            candidates=tuple(
                _candidate_from_ranked(item)
                for item in ranked[1:]
                if item.score >= get_candidate_min_score()
            )[:CANDIDATE_LIMIT],
            top_score=round(top_score, 4),
            top_margin=round(top_margin, 4),
        )

    candidate_items = [
        item
        for item in ranked
        if item.score >= get_candidate_min_score()
    ][:CANDIDATE_LIMIT]
    if candidate_items:
        return MatchOutcome(
            decision=GoodsImageMatchAttempt.DECISION_CANDIDATES,
            match=None,
            candidates=tuple(_candidate_from_ranked(item) for item in candidate_items),
            top_score=round(top_score, 4),
            top_margin=round(top_margin, 4),
        )

    return MatchOutcome(
        decision=GoodsImageMatchAttempt.DECISION_NOT_FOUND,
        match=None,
        candidates=(),
        top_score=round(top_score, 4),
        top_margin=round(top_margin, 4),
    )
