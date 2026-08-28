"""
谷子主图形状分类器。

分类只判断商品主体的几何外轮廓，不根据图片内容中的装饰图案判断形状。
对无法稳定提取单一主体的图片返回 ``unknown``，避免把艺术内容误认为圆形。
"""
import io
import logging
import math
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

SHAPE_TYPES = ("round", "square", "rectangle", "unknown")

_MAX_SIDE = 640
_MAX_PIXELS = 20_000_000
_MIN_CANDIDATE_AREA_RATIO = 0.025
_MAX_CANDIDATE_AREA_RATIO = 0.92
_MIN_RECTANGULARITY = 0.68
_MIN_ACCEPTED_SCORE = 0.62
_MIN_SCORE_MARGIN = 0.10
_MORPH_KERNEL = (5, 5)


@dataclass(frozen=True)
class _ShapeCandidate:
    contour: np.ndarray
    area_ratio: float
    aspect_ratio: float
    rectangularity: float
    circularity: float
    convexity: float
    hull_rectangularity: float
    hull_circularity: float
    center_distance: float
    center_x_ratio: float
    center_y_ratio: float
    touches_border: bool


def _preprocess(image_bytes: bytes) -> Optional[tuple[np.ndarray, Optional[np.ndarray]]]:
    """解码图片，修正 EXIF 方向并保留有意义的 alpha 通道。"""
    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            if source.width * source.height > _MAX_PIXELS:
                logger.info("图片像素数超过分类上限: %s", source.size)
                return None
            source.load()

            image = ImageOps.exif_transpose(source)
            alpha = None
            if "A" in image.getbands():
                alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
                # 全透明/全不透明 alpha 没有额外的主体信息。
                if int(alpha.min()) == 255 or int(alpha.max()) == 0:
                    alpha = None

            rgb = image.convert("RGB")
            width, height = rgb.size
            long_side = max(width, height)
            if long_side > _MAX_SIDE:
                scale = _MAX_SIDE / long_side
                width = max(1, int(round(width * scale)))
                height = max(1, int(round(height * scale)))
                rgb = rgb.resize((width, height), Image.Resampling.LANCZOS)
                if alpha is not None:
                    alpha = cv2.resize(alpha, (width, height), interpolation=cv2.INTER_AREA)

            arr = np.asarray(rgb)
            bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
            return bgr, alpha
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as exc:
        logger.debug("图片解码失败: %s", exc)
        return None


def _gray_variants(gray: np.ndarray) -> list[np.ndarray]:
    """提供轻度去噪和对比度增强版本，避免依赖单一阈值。"""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    equalized = cv2.equalizeHist(gray)
    enhanced = cv2.GaussianBlur(equalized, (5, 5), 0)
    return [blurred, enhanced]


def _close_mask(mask: np.ndarray) -> np.ndarray:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, _MORPH_KERNEL)
    return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)


def _candidate_from_contour(
    contour: np.ndarray,
    image_shape: tuple[int, int],
) -> Optional[_ShapeCandidate]:
    height, width = image_shape
    image_area = float(height * width)
    area = float(cv2.contourArea(contour))
    area_ratio = area / image_area if image_area else 0.0
    if not (_MIN_CANDIDATE_AREA_RATIO <= area_ratio <= _MAX_CANDIDATE_AREA_RATIO):
        return None

    perimeter = float(cv2.arcLength(contour, True))
    if perimeter <= 0:
        return None

    rect = cv2.minAreaRect(contour)
    rect_width, rect_height = rect[1]
    short_side, long_side = sorted((float(rect_width), float(rect_height)))
    if short_side <= 1:
        return None
    aspect_ratio = long_side / short_side
    rotated_rect_area = short_side * long_side
    rectangularity = area / rotated_rect_area if rotated_rect_area else 0.0
    if rectangularity < _MIN_RECTANGULARITY:
        return None

    hull = cv2.convexHull(contour)
    hull_area = float(cv2.contourArea(hull))
    convexity = area / hull_area if hull_area else 0.0
    circularity = float(4.0 * math.pi * area / (perimeter * perimeter))
    hull_perimeter = float(cv2.arcLength(hull, True))
    hull_rectangularity = hull_area / rotated_rect_area if rotated_rect_area else 0.0
    hull_circularity = (
        float(4.0 * math.pi * hull_area / (hull_perimeter * hull_perimeter))
        if hull_perimeter > 0
        else 0.0
    )

    moments = cv2.moments(contour)
    if moments["m00"]:
        cx = moments["m10"] / moments["m00"]
        cy = moments["m01"] / moments["m00"]
    else:
        cx, cy = width / 2.0, height / 2.0
    diagonal = math.hypot(width, height)
    center_distance = math.hypot(cx - width / 2.0, cy - height / 2.0) / diagonal

    x, y, w, h = cv2.boundingRect(contour)
    touches_border = x <= 1 or y <= 1 or x + w >= width - 1 or y + h >= height - 1
    return _ShapeCandidate(
        contour=contour,
        area_ratio=area_ratio,
        aspect_ratio=aspect_ratio,
        rectangularity=rectangularity,
        circularity=min(1.0, circularity),
        convexity=min(1.0, convexity),
        hull_rectangularity=min(1.0, hull_rectangularity),
        hull_circularity=min(1.0, hull_circularity),
        center_distance=center_distance,
        center_x_ratio=cx / width if width else 0.5,
        center_y_ratio=cy / height if height else 0.5,
        touches_border=touches_border,
    )


def _find_candidates(mask: np.ndarray) -> list[_ShapeCandidate]:
    mask = _close_mask(mask)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for contour in contours:
        candidate = _candidate_from_contour(contour, mask.shape[:2])
        if candidate is not None:
            candidates.append(candidate)
    candidates.sort(key=lambda item: (item.area_ratio, -item.center_distance), reverse=True)
    return candidates[:8]


def _build_masks(bgr: np.ndarray, alpha: Optional[np.ndarray]) -> list[np.ndarray]:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    masks: list[np.ndarray] = []

    if alpha is not None:
        masks.append(np.where(alpha >= 32, 255, 0).astype(np.uint8))

    for variant in _gray_variants(gray):
        edges = cv2.Canny(variant, 40, 120)
        masks.append(edges)
        _, threshold = cv2.threshold(variant, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        masks.extend((threshold, cv2.bitwise_not(threshold)))

    # 彩色商品与近似白底的灰度差异很小时，饱和度边界通常更稳定。
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    saturation = cv2.GaussianBlur(hsv[:, :, 1], (5, 5), 0)
    _, saturation_mask = cv2.threshold(saturation, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    masks.append(saturation_mask)
    return masks


def _select_candidates(bgr: np.ndarray, alpha: Optional[np.ndarray]) -> list[_ShapeCandidate]:
    all_candidates = [candidate for mask in _build_masks(bgr, alpha) for candidate in _find_candidates(mask)]
    if not all_candidates:
        return []

    # 多个掩码得到同一主体时只保留几何最稳定的候选；内部图案通常面积更小或不居中。
    def stability_score(item: _ShapeCandidate) -> float:
        # 边缘掩码通常比二值掩码更贴近真实外轮廓；面积最大的掩码可能只是整张
        # 艺术图的背景区域，因此不能单纯按面积选择。
        geometry = max(item.circularity, item.rectangularity)
        area_quality = 1.0 if 0.06 <= item.area_ratio <= 0.82 else 0.75
        return (
            0.45 * geometry
            + 0.25 * item.convexity
            + 0.20 * area_quality
            + 0.10 * max(0.0, 1.0 - item.center_distance / 0.45)
        )

    all_candidates.sort(key=stability_score, reverse=True)
    selected: list[_ShapeCandidate] = []
    for candidate in all_candidates:
        if any(
            abs(candidate.area_ratio - other.area_ratio) < 0.12
            and abs(candidate.aspect_ratio - other.aspect_ratio) < 0.25
            and math.hypot(
                candidate.center_x_ratio - other.center_x_ratio,
                candidate.center_y_ratio - other.center_y_ratio,
            ) < 0.12
            for other in selected
        ):
            continue
        selected.append(candidate)
        if len(selected) == 4:
            break
    return selected


def _quality(candidate: _ShapeCandidate) -> float:
    center_quality = max(0.0, 1.0 - candidate.center_distance / 0.45)
    border_quality = 0.72 if candidate.touches_border else 1.0
    area_quality = 1.0 if 0.06 <= candidate.area_ratio <= 0.82 else 0.75
    return max(0.0, min(1.0, center_quality * border_quality * area_quality * candidate.convexity))


def _shape_scores(candidate: _ShapeCandidate) -> dict[str, float]:
    quality = _quality(candidate)
    aspect = candidate.aspect_ratio
    square_aspect = max(0.0, 1.0 - abs(aspect - 1.0) / 0.22)
    rectangle_aspect = max(0.0, min(1.0, (aspect - 1.0) / 0.75))
    rectangle_quality = max(0.0, min(1.0, (candidate.rectangularity - 0.68) / 0.25))
    circle_aspect = max(0.0, 1.0 - abs(aspect - 1.0) / 0.35)
    circle_roundness = max(0.0, min(1.0, (candidate.circularity - 0.68) / 0.25))

    return {
        "round": quality * (0.60 * circle_roundness + 0.25 * circle_aspect + 0.15 * candidate.convexity),
        "square": quality * (0.55 * square_aspect + 0.35 * rectangle_quality + 0.10 * (1.0 - circle_roundness)),
        "rectangle": quality * (0.55 * rectangle_aspect + 0.35 * rectangle_quality + 0.10 * (1.0 - square_aspect)),
    }


def _border_frame_support(candidate: _ShapeCandidate, label: str) -> float:
    """评估贴边主体是否仍保留稳定的方形/长方形凸包。"""
    if not candidate.touches_border or candidate.center_distance > 0.12:
        return 0.0

    area_support = 1.0 if candidate.area_ratio <= 0.90 else 0.5
    if label == "rectangle":
        if candidate.hull_rectangularity < 0.88 or candidate.hull_circularity > 0.92:
            return 0.0
        aspect_support = max(0.0, min(1.0, (candidate.aspect_ratio - 1.20) / 0.45))
        hull_support = max(0.0, min(1.0, (candidate.hull_rectangularity - 0.88) / 0.12))
        non_round_support = max(0.0, min(1.0, (0.92 - candidate.hull_circularity) / 0.18))
        return area_support * (
            0.40 * hull_support
            + 0.30 * aspect_support
            + 0.20 * non_round_support
            + 0.10 * candidate.convexity
        )

    if label == "square":
        if candidate.hull_rectangularity < 0.84 or candidate.hull_circularity > 0.96:
            return 0.0
        aspect_support = max(0.0, 1.0 - abs(candidate.aspect_ratio - 1.0) / 0.18)
        hull_support = max(0.0, min(1.0, (candidate.hull_rectangularity - 0.84) / 0.12))
        non_round_support = max(0.0, min(1.0, (0.96 - candidate.hull_circularity) / 0.18))
        return area_support * (
            0.40 * aspect_support
            + 0.30 * hull_support
            + 0.20 * non_round_support
            + 0.10 * candidate.convexity
        )

    return 0.0


def _classify_candidates(candidates: list[_ShapeCandidate]) -> Optional[dict]:
    if not candidates:
        return {"shape_type": "unknown", "confidence": 0.0}

    scored_candidates = []
    for candidate in candidates:
        scores = _shape_scores(candidate)
        label, score = max(scores.items(), key=lambda item: item[1])
        ranked = sorted(scores.values(), reverse=True)
        margin = ranked[0] - ranked[1]
        scored_candidates.append((label, score, margin, candidate))

    # 只接受几何特征一致的主体，避免某个掩码的偶然边缘覆盖大多数结果。
    label_counts: dict[str, int] = {}
    for label, _, _, _ in scored_candidates:
        label_counts[label] = label_counts.get(label, 0) + 1
    label, count = max(label_counts.items(), key=lambda item: item[1])
    matching = [item for item in scored_candidates if item[0] == label]
    best = max(matching, key=lambda item: (item[1], item[2], item[3].area_ratio))
    _, score, margin, candidate = best
    border_support = _border_frame_support(candidate, label)

    if count == 1 and len(scored_candidates) > 1:
        return {"shape_type": "unknown", "confidence": round(min(score, 0.59), 2)}
    if score < _MIN_ACCEPTED_SCORE and border_support < 0.48:
        return {"shape_type": "unknown", "confidence": round(min(score, 0.59), 2)}
    if margin < _MIN_SCORE_MARGIN:
        return {"shape_type": "unknown", "confidence": round(min(score, 0.59), 2)}

    # 椭圆/圆角异形的圆度通常不足以支持 round；长宽比也不能单独把它当 rectangle。
    if label == "round" and (candidate.circularity < 0.76 or candidate.aspect_ratio > 1.20):
        return {"shape_type": "unknown", "confidence": round(min(score, 0.59), 2)}
    if (
        label in {"square", "rectangle"}
        and candidate.rectangularity < 0.74
        and border_support < 0.48
    ):
        return {"shape_type": "unknown", "confidence": round(min(score, 0.59), 2)}

    score = max(score, 0.65 + 0.15 * border_support)
    confidence = min(0.98, 0.55 + 0.35 * score + 0.10 * min(1.0, margin / 0.35))
    return {"shape_type": label, "confidence": round(float(confidence), 2)}


def classify_goods_image(image_bytes: bytes) -> Optional[dict]:
    """
    对谷子主图进行形状分类。

    返回 ``None`` 仅表示图片无法解码；可解码但没有稳定几何主体时返回
    ``{"shape_type": "unknown", "confidence": 0.0}``。
    ``round`` 是历史兼容值，表示圆形。
    """
    prepared = _preprocess(image_bytes)
    if prepared is None:
        return None
    bgr, alpha = prepared
    candidates = _select_candidates(bgr, alpha)
    return _classify_candidates(candidates)
