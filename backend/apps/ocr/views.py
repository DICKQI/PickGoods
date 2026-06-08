"""
OCR 识别接口：接收图片，返回结构化字段。
"""
import hashlib
import io
import logging
import threading

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes, throttle_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from apps.goods.models import Category, Character, IP
from .parser import parse_ocr_items, parse_ocr_results, match_metadata

logger = logging.getLogger(__name__)


class OcrRateThrottle(SimpleRateThrottle):
    """Per-user throttle for expensive OCR recognition requests."""

    scope = 'ocr'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


# PaddleOCR 全局单例（懒加载，线程安全）
_ocr_instance = None
_ocr_lock = threading.Lock()

# Taobao order screenshots are usually tall phone screenshots. Cropping the
# status/nav/footer chrome and downscaling before detection cuts CPU time a lot.
_TALL_SCREENSHOT_RATIO = 1.6
_SCREENSHOT_MIN_HEIGHT = 1600
_SCREENSHOT_CROP_TOP_RATIO = 0.10
_SCREENSHOT_CROP_BOTTOM_RATIO = 0.99
_OCR_MAX_SIDE = 1280


def _get_ocr():
    """获取或初始化 PaddleOCR 实例。"""
    global _ocr_instance
    if _ocr_instance is not None:
        return _ocr_instance

    with _ocr_lock:
        if _ocr_instance is not None:
            return _ocr_instance
        try:
            from paddleocr import PaddleOCR
            _ocr_instance = PaddleOCR(lang='ch', ocr_version='PP-OCRv4',
                                          use_textline_orientation=False,
                                          use_doc_orientation_classify=False,
                                          use_doc_unwarping=False,
                                          text_det_limit_side_len=1280,
                                          text_recognition_batch_size=16)
            logger.info("PaddleOCR 模型加载完成")
        except Exception as e:
            logger.error(f"PaddleOCR 初始化失败: {e}")
            raise
    return _ocr_instance


def _prepare_and_run_ocr(image_bytes: bytes) -> list[dict]:
    """预处理图片并执行 OCR，全程在内存中完成，无磁盘 I/O。"""
    with Image.open(io.BytesIO(image_bytes)) as img:
        img.load()
        image = ImageOps.exif_transpose(img)
        if image.mode != 'RGB':
            image = image.convert('RGB')

    width, height = image.size
    if height >= _SCREENSHOT_MIN_HEIGHT and height / max(width, 1) >= _TALL_SCREENSHOT_RATIO:
        top = int(height * _SCREENSHOT_CROP_TOP_RATIO)
        bottom = int(height * _SCREENSHOT_CROP_BOTTOM_RATIO)
        if bottom - top >= _SCREENSHOT_MIN_HEIGHT // 2:
            image = image.crop((0, top, width, bottom))

    width, height = image.size
    long_side = max(width, height)
    if long_side > _OCR_MAX_SIDE:
        scale = _OCR_MAX_SIDE / long_side
        image = image.resize(
            (max(1, int(width * scale)), max(1, int(height * scale))),
            Image.Resampling.LANCZOS,
        )

    # PIL RGB → numpy BGR（PaddleOCR 默认 BGR 格式）
    img_array = np.array(image)[:, :, ::-1].copy()

    ocr = _get_ocr()
    result = ocr.predict(img_array)

    if not result:
        return []

    lines = []
    for page in result:
        rec_texts = page.get('rec_texts', [])
        rec_scores = page.get('rec_scores', [])
        rec_boxes = page.get('rec_boxes', [])
        for i, text in enumerate(rec_texts):
            score = rec_scores[i] if i < len(rec_scores) else 1.0
            box = rec_boxes[i] if i < len(rec_boxes) else None
            if text and score > 0.3:
                if hasattr(box, 'tolist'):
                    box = box.tolist()
                lines.append({'text': text, 'score': float(score), 'box': box})

    return lines


def _load_metadata():
    """加载 IP / 角色 / 品类元数据用于匹配（60秒缓存）。"""
    cache_key = 'ocr_metadata_cache'
    cached = cache.get(cache_key)
    if cached:
        return cached

    ips = list(IP.objects.values_list('id', 'name'))
    from apps.goods.models import IPKeyword
    for kw in IPKeyword.objects.select_related('ip').all():
        ips.append((kw.ip_id, kw.value))

    characters = list(
        Character.objects.select_related('ip')
        .values_list('id', 'name', 'ip_id', 'ip__name')
    )
    categories = list(
        Category.objects.values_list('id', 'name', 'path_name')
    )
    data = (ips, characters, categories)
    cache.set(cache_key, data, timeout=60)
    return data


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
@throttle_classes([OcrRateThrottle])
def recognize(request):
    """
    订单截图 OCR 识别接口。

    入参：multipart/form-data，字段名 `image`（图片文件，最大 10MB）。
          可选 `confidence_threshold`（float，默认 0.0），用于过滤低置信度匹配。

    返回：
    ```json
    {
        "name": "商品名",
        "price": "12.50",
        "quantity": 1,
        "purchase_date": "2025-06-01",
        "is_official": true,
        "shop_name": "店铺名",
        "raw_text": "全部OCR文本",
        "suggestions": {
            "ip": {"id": 1, "name": "原神", "confidence": 0.85} | null,
            "characters": [{"id": 5, "name": "甘雨", "confidence": 0.88}],
            "category": {"id": 3, "name": "吧唧", "confidence": 0.76} | null
        }
    }
    ```
    """
    image_file = request.FILES.get('image')
    if not image_file:
        return Response(
            {'detail': '请通过 form-data 提供 image 文件'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 文件大小限制 10MB
    max_size = 10 * 1024 * 1024
    if image_file.size > max_size:
        return Response(
            {'detail': f'图片大小不能超过 {max_size // 1024 // 1024}MB'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 检查 OCR 结果缓存（仅缓存推理结果，阈值过滤每次重算）
    image_bytes = image_file.read()
    cache_key = 'ocr:entries:' + hashlib.sha256(image_bytes).hexdigest()
    ocr_entries = cache.get(cache_key)

    if ocr_entries is None:
        try:
            ocr_entries = _prepare_and_run_ocr(image_bytes)
        except (UnidentifiedImageError, OSError):
            return Response(
                {'detail': '无法识别为有效图片，请确认文件格式正确'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.exception("OCR 识别失败")
            return Response(
                {'detail': f'OCR 识别失败: {str(e)}', 'raw_text': ''},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        if ocr_entries:
            cache.set(cache_key, ocr_entries, timeout=300)

    if not ocr_entries:
        return Response(
            {'detail': '未能从图片中识别到文字，请确认图片清晰且包含文字'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ocr_lines = [entry['text'] for entry in ocr_entries]
    raw_text = '\n'.join(ocr_lines)
    items = parse_ocr_items(ocr_entries)
    if not items:
        parsed = parse_ocr_results(ocr_lines)
        if parsed:
            parsed['source_lines'] = ocr_lines
            parsed['warnings'] = ['未能可靠拆分多个商品，已按单条结果返回']
            items = [parsed]

    if not items:
        return Response(
            {'detail': '未能从图片中解析到商品条目，请确认截图包含淘宝商品列表'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 元数据匹配
    try:
        ips, chars, cats = _load_metadata()
    except Exception as e:
        logger.warning(f"元数据加载失败: {e}")
        ips, chars, cats = [], [], []

    for item in items:
        try:
            item['suggestions'] = match_metadata(item.get('name'), ips, chars, cats)
        except Exception as e:
            logger.warning(f"元数据匹配失败: {e}")
            item['suggestions'] = {'ip': None, 'characters': [], 'category': None}

    # 置信度阈值过滤
    try:
        confidence_threshold = float(request.data.get('confidence_threshold', 0.0))
    except (TypeError, ValueError):
        confidence_threshold = 0.0

    if confidence_threshold > 0.0:
        for item in items:
            s = item.get('suggestions')
            if not s:
                continue
            if s.get('ip') and s['ip']['confidence'] < confidence_threshold:
                s['ip'] = None
            s['characters'] = [c for c in s.get('characters', []) if c['confidence'] >= confidence_threshold]
            if s.get('category') and s['category']['confidence'] < confidence_threshold:
                s['category'] = None

    first = items[0]

    return Response({
        'name': first.get('name'),
        'price': first.get('price'),
        'quantity': first.get('quantity', 1),
        'purchase_date': first.get('purchase_date'),
        'is_official': first.get('is_official', True),
        'shop_name': first.get('shop_name'),
        'raw_text': raw_text,
        'suggestions': first.get('suggestions', {'ip': None, 'characters': [], 'category': None}),
        'items': items,
    })
