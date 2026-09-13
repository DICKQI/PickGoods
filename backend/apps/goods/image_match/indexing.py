from __future__ import annotations

import logging
from uuid import UUID

import numpy as np

from apps.goods.models import Goods, GoodsImageFingerprint

from .config import ALGORITHM_VERSION
from .features import decode_image, extract_main_fingerprint

logger = logging.getLogger(__name__)


def _resolve_goods(goods_or_id) -> Goods | None:
    if isinstance(goods_or_id, Goods):
        return goods_or_id
    if isinstance(goods_or_id, UUID):
        return Goods.objects.filter(pk=goods_or_id).first()
    return Goods.objects.filter(pk=goods_or_id).first()


def refresh_goods_image_fingerprint(goods_or_id, *, force: bool = False) -> bool:
    """
    重建单个谷子主图指纹。

    返回 True 表示写入或更新了指纹；False 表示无主图或已有同版本结果。
    """
    goods = _resolve_goods(goods_or_id)
    if goods is None:
        return False

    if not goods.main_photo:
        GoodsImageFingerprint.objects.filter(goods=goods).delete()
        return False

    source_name = goods.main_photo.name
    existing = GoodsImageFingerprint.objects.filter(goods=goods).first()
    if (
        not force
        and existing is not None
        and existing.algorithm_version == ALGORITHM_VERSION
        and existing.source_name == source_name
    ):
        return False

    try:
        with goods.main_photo.open("rb") as source:
            image_bytes = source.read()
    except (OSError, ValueError):
        logger.exception("读取谷子主图失败: goods=%s path=%s", goods.pk, source_name)
        raise

    image = decode_image(image_bytes)
    fingerprint = extract_main_fingerprint(image)
    embedding = np.asarray(fingerprint.embedding, dtype=np.float32)
    if embedding.ndim != 1 or embedding.size == 0:
        raise ValueError("主图指纹向量维度不合法")

    GoodsImageFingerprint.objects.update_or_create(
        goods=goods,
        defaults={
            "phash": fingerprint.phash,
            "embedding": embedding.astype("<f4", copy=False).tobytes(),
            "embedding_dim": int(embedding.size),
            "algorithm_version": ALGORITHM_VERSION,
            "source_name": source_name,
        },
    )
    return True


def schedule_fingerprint_refresh(goods_id, *, force: bool = False) -> None:
    """信号回调入口：索引失败只记录日志，不影响主业务事务。"""
    try:
        refresh_goods_image_fingerprint(goods_id, force=force)
    except Exception:  # noqa: BLE001 - 索引属于可修复派生数据
        logger.exception("刷新谷子主图指纹失败: goods=%s", goods_id)
