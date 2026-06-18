"""
谷子品类图片分类器：利用 OpenCV 形状检测区分圆形吧唧 vs 矩形卡片。
"""
import io
import logging
from typing import Optional

import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

_CIRCLE_MIN_RADIUS_RATIO = 0.15
_CIRCLE_MAX_RADIUS_RATIO = 0.48
_CIRCLE_DP = 1.2
_CIRCLE_MIN_DIST_RATIO = 0.5
_CIRCLE_PARAM1 = 80
_CIRCLE_PARAM2 = 35

_CONTOUR_MIN_AREA_RATIO = 0.02
_RECT_EPSILON_RATIO = 0.03
_RECTANGULARITY_THRESHOLD = 0.80
_RECTANGLE_DOMINANT_CONFIDENCE = 0.95

_MAX_SIDE = 512
_BLUR_KERNEL = (5, 5)
_CANNY_LOW = 40
_CANNY_HIGH = 120


def _pick_stronger_detection(*detections: tuple[int, float]) -> tuple[int, float]:
    """在多种预处理结果中选择更可靠的一组检测结果。"""
    return max(detections, key=lambda item: (item[1], item[0]))


def _preprocess(image_bytes: bytes) -> Optional[np.ndarray]:
    """将图片字节转换为 OpenCV BGR 格式灰度图，缩放并去噪。"""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img.load()
            if img.mode != 'RGB':
                img = img.convert('RGB')
            width, height = img.size
            long_side = max(width, height)
            if long_side > _MAX_SIDE:
                scale = _MAX_SIDE / long_side
                width = max(1, int(width * scale))
                height = max(1, int(height * scale))
                img = img.resize((width, height), Image.Resampling.LANCZOS)
            arr = np.array(img)
            bgr = arr[:, :, ::-1].copy()
    except (UnidentifiedImageError, OSError, Exception) as e:
        logger.debug(f"图片解码失败: {e}")
        return None
    return bgr


def _prepare_gray_variants(gray: np.ndarray) -> list[np.ndarray]:
    """生成原始灰度和增强对比度灰度，兼顾普通图与低对比图。"""
    blurred = cv2.GaussianBlur(gray, _BLUR_KERNEL, 0)
    equalized = cv2.equalizeHist(gray)
    enhanced = cv2.GaussianBlur(equalized, _BLUR_KERNEL, 0)
    return [blurred, enhanced]


def _detect_circles(gray: np.ndarray) -> tuple[int, float]:
    """检测图中圆形。返回 (圆数量, 平均置信度)。"""
    height, width = gray.shape[:2]
    short_side = min(height, width)
    min_radius = int(short_side * _CIRCLE_MIN_RADIUS_RATIO)
    max_radius = int(short_side * _CIRCLE_MAX_RADIUS_RATIO)
    min_dist = int(short_side * _CIRCLE_MIN_DIST_RATIO)

    if min_radius < 10:
        min_radius = 10
    if max_radius <= min_radius:
        return 0, 0.0

    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=_CIRCLE_DP,
        minDist=min_dist,
        param1=_CIRCLE_PARAM1,
        param2=_CIRCLE_PARAM2,
        minRadius=min_radius,
        maxRadius=max_radius,
    )

    if circles is None or len(circles) == 0:
        return 0, 0.0

    circles = np.uint16(np.around(circles[0]))
    count = len(circles)
    avg_conf = min(1.0, count * 0.4 + 0.1)
    return count, avg_conf


def _detect_rectangles(gray: np.ndarray) -> tuple[int, float]:
    """检测图中矩形。返回 (矩形数量, 平均置信度)。"""
    height, width = gray.shape[:2]
    img_area = height * width
    min_area = img_area * _CONTOUR_MIN_AREA_RATIO

    edged = cv2.Canny(gray, _CANNY_LOW, _CANNY_HIGH)
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    rect_count = 0
    confidences = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue

        approx = cv2.approxPolyDP(cnt, _RECT_EPSILON_RATIO * perimeter, True)
        vertices = len(approx)

        if vertices == 4:
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / float(h) if h > 0 else 0
            rect_area_ratio = area / (w * h) if w * h > 0 else 0

            if rect_area_ratio >= _RECTANGULARITY_THRESHOLD and 0.25 <= aspect_ratio <= 4.0:
                rect_count += 1
                confidences.append(min(1.0, rect_area_ratio))

    avg_conf = float(np.mean(confidences)) if confidences else 0.0
    return rect_count, avg_conf


def classify_goods_image(image_bytes: bytes) -> Optional[dict]:
    """
    对谷子主图进行形状分类。

    参数:
        image_bytes: 图片二进制数据

    返回:
        None — 无法识别或图片格式错误
        或
        {
            "shape_type": "round" | "rectangle",
            "confidence": 0.0 ~ 1.0,
        }
    """
    bgr = _preprocess(image_bytes)
    if bgr is None:
        return None

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray_variants = _prepare_gray_variants(gray)
    circle_count, circle_conf = _pick_stronger_detection(
        *(_detect_circles(variant) for variant in gray_variants)
    )
    rect_count, rect_conf = _pick_stronger_detection(
        *(_detect_rectangles(variant) for variant in gray_variants)
    )

    if circle_count > 0 and rect_count > 0:
        # 色纸/卡片内经常有人物头发、装饰圆弧等圆形内容；强矩形外框应优先代表商品外形。
        if rect_conf >= _RECTANGLE_DOMINANT_CONFIDENCE:
            return {"shape_type": "rectangle", "confidence": round(float(rect_conf), 2)}
        if circle_conf >= rect_conf:
            return {"shape_type": "round", "confidence": round(float(circle_conf), 2)}
        else:
            return {"shape_type": "rectangle", "confidence": round(float(rect_conf), 2)}

    if circle_count > 0:
        return {"shape_type": "round", "confidence": round(float(circle_conf), 2)}

    if rect_count > 0:
        return {"shape_type": "rectangle", "confidence": round(float(rect_conf), 2)}

    return None
