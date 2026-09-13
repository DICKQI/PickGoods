from __future__ import annotations

import hashlib
import io
import logging
import threading
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageOps, UnidentifiedImageError

from .config import (
    MAX_IMAGE_BYTES,
    MAX_IMAGE_PIXELS,
    MODEL_EMBEDDING_DIM,
    MODEL_INPUT_SIZE,
    MODEL_SHA256,
    MODEL_SIZE,
    QUERY_CROP_RATIOS,
    get_model_path,
    get_model_threads,
)
from .exceptions import InvalidImageError, ModelUnavailableError

logger = logging.getLogger(__name__)

_engine = None
_engine_lock = threading.Lock()


@dataclass(frozen=True)
class ImageFingerprint:
    phash: str
    embedding: np.ndarray


@dataclass(frozen=True)
class QueryFeatures:
    phash: str
    embeddings: np.ndarray
    patch_embeddings: tuple[np.ndarray, ...] = ()
    variant_names: tuple[str, ...] = ()


def decode_image(image_bytes: bytes) -> Image.Image:
    """安全解码图片、修正 EXIF 方向，并在透明图上铺白底。"""
    if not image_bytes:
        raise InvalidImageError("图片内容为空")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise InvalidImageError("图片大小不能超过 10MB")

    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise InvalidImageError("图片像素数不能超过 2000 万")
            source.load()
            image = ImageOps.exif_transpose(source)
            if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
                rgba = image.convert("RGBA")
                background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                image = Image.alpha_composite(background, rgba).convert("RGB")
            else:
                image = image.convert("RGB")
            return image.copy()
    except InvalidImageError:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImageError("图片无法解码或格式不受支持") from exc


@lru_cache(maxsize=1)
def _dct_basis(size: int = 32, low_frequency_size: int = 8) -> np.ndarray:
    positions = np.arange(size, dtype=np.float64)
    frequencies = np.arange(low_frequency_size, dtype=np.float64)[:, None]
    basis = np.cos(np.pi * (2 * positions + 1) * frequencies / (2 * size))
    basis[0] *= 1 / np.sqrt(2)
    return basis


def compute_phash(image: Image.Image) -> str:
    """使用 8×8 DCT 低频系数生成 64 位感知哈希。"""
    gray = ImageOps.grayscale(image).resize((32, 32), Image.Resampling.LANCZOS)
    pixels = np.asarray(gray, dtype=np.float64)
    basis = _dct_basis()
    coefficients = basis @ pixels @ basis.T
    values = coefficients.reshape(-1)
    median = float(np.median(values[1:]))
    bits = np.flatnonzero(values > median)
    result = 0
    for bit in bits:
        result |= 1 << int(bit)
    return f"{result:016x}"


def hamming_distance(left: str, right: str) -> int:
    if len(left) != 16 or len(right) != 16:
        raise ValueError("pHash 必须是 16 位十六进制字符串")
    return (int(left, 16) ^ int(right, 16)).bit_count()


def _center_square_crop(image: Image.Image, ratio: float) -> Image.Image:
    width, height = image.size
    side = max(1, int(round(min(width, height) * ratio)))
    left = max(0, (width - side) // 2)
    top = max(0, (height - side) // 2)
    return image.crop((left, top, left + side, top + side))


def _circle_edge_support(
    edges: np.ndarray,
    center_x: float,
    center_y: float,
    radius: float,
) -> float:
    angles = np.linspace(0, 2 * np.pi, 180, endpoint=False)
    supported = 0
    height, width = edges.shape
    for angle in angles:
        hit = False
        for offset in (-2, -1, 0, 1, 2):
            x = int(round(center_x + (radius + offset) * np.cos(angle)))
            y = int(round(center_y + (radius + offset) * np.sin(angle)))
            if 0 <= x < width and 0 <= y < height and edges[y, x]:
                hit = True
                break
        if hit:
            supported += 1
    return supported / len(angles)


def _detect_query_circle(image: Image.Image):
    """检测近圆形主体，返回原图坐标系中的圆心和半径。"""
    max_side = max(image.size)
    scale = min(1.0, 512 / max_side)
    working_size = (
        max(1, int(round(image.width * scale))),
        max(1, int(round(image.height * scale))),
    )
    working = image.resize(working_size, Image.Resampling.LANCZOS) if scale < 1 else image
    array = np.asarray(working)
    gray = cv2.cvtColor(array, cv2.COLOR_RGB2GRAY)
    gray = cv2.medianBlur(gray, 5)
    edges = cv2.Canny(gray, 80, 180)
    min_side = min(working_size)
    min_radius = max(8, int(round(min_side * 0.20)))
    max_radius = max(min_radius + 1, int(round(min_side * 0.62)))

    candidates = []
    for threshold in (70, 60, 50):
        circles = cv2.HoughCircles(
            gray,
            cv2.HOUGH_GRADIENT,
            dp=1.2,
            minDist=max(20, int(round(min_side * 0.25))),
            param1=100,
            param2=threshold,
            minRadius=min_radius,
            maxRadius=max_radius,
        )
        if circles is None:
            continue
        for center_x, center_y, radius in np.asarray(circles[0], dtype=np.float32):
            margin_x = min_side * 0.18
            margin_y = min_side * 0.18
            if not (
                margin_x <= center_x <= working_size[0] - margin_x
                and margin_y <= center_y <= working_size[1] - margin_y
            ):
                continue
            support = _circle_edge_support(edges, center_x, center_y, radius)
            if support >= 0.45:
                candidates.append((support, center_x, center_y, radius))
        if candidates:
            break

    if not candidates:
        return None
    _, center_x, center_y, radius = max(candidates, key=lambda item: item[0])
    inverse_scale = 1 / scale
    return (
        int(round(center_x * inverse_scale)),
        int(round(center_y * inverse_scale)),
        int(round(radius * inverse_scale)),
    )


def _mask_circle_background(image: Image.Image, circle) -> Image.Image:
    center_x, center_y, radius = circle
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).ellipse(
        (
            center_x - radius,
            center_y - radius,
            center_x + radius,
            center_y + radius,
        ),
        fill=255,
    )
    return Image.composite(image, Image.new("RGB", image.size, (255, 255, 255)), mask)


def _query_variants(image: Image.Image) -> tuple[tuple[str, ...], list[Image.Image]]:
    names = [f"center_{ratio:g}" for ratio in QUERY_CROP_RATIOS]
    variants = [_center_square_crop(image, ratio) for ratio in QUERY_CROP_RATIOS]
    circle = _detect_query_circle(image)
    if circle is not None:
        names.append("circle_white")
        variants.append(_mask_circle_background(image, circle))
    return tuple(names), variants


def _preprocess(image: Image.Image, crop_ratio: float) -> np.ndarray:
    cropped = _center_square_crop(image, crop_ratio)
    resized = cropped.resize(
        (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE),
        Image.Resampling.BICUBIC,
    )
    array = np.asarray(resized, dtype=np.float32) / 255.0
    mean = np.asarray((0.485, 0.456, 0.406), dtype=np.float32)
    std = np.asarray((0.229, 0.224, 0.225), dtype=np.float32)
    array = (array - mean) / std
    return np.transpose(array, (2, 0, 1))


def _normalize_rows(vectors: np.ndarray) -> np.ndarray:
    vectors = np.asarray(vectors, dtype=np.float32)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.maximum(norms, 1e-12)


def _validate_model_file(path) -> None:
    if not path.is_file():
        raise ModelUnavailableError("图片匹配模型尚未安装")
    if path.stat().st_size != MODEL_SIZE:
        raise ModelUnavailableError("图片匹配模型文件大小不完整")

    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != MODEL_SHA256:
        raise ModelUnavailableError("图片匹配模型校验失败")


class _DinoV2Engine:
    def __init__(self):
        try:
            import onnxruntime as ort
        except ImportError as exc:
            raise ModelUnavailableError("ONNX Runtime 未安装") from exc

        model_path = get_model_path()
        _validate_model_file(model_path)

        options = ort.SessionOptions()
        options.intra_op_num_threads = get_model_threads()
        options.inter_op_num_threads = 1
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        options.log_severity_level = 3
        try:
            self.session = ort.InferenceSession(
                str(model_path),
                sess_options=options,
                providers=["CPUExecutionProvider"],
            )
        except Exception as exc:  # noqa: BLE001 - ORT 错误类型不稳定
            raise ModelUnavailableError("图片匹配模型加载失败") from exc

        self.input_name = self.session.get_inputs()[0].name
        output_shape = self.session.get_outputs()[0].shape
        if len(output_shape) != 3 or output_shape[-1] != MODEL_EMBEDDING_DIM:
            raise ModelUnavailableError("图片匹配模型输出维度不符合预期")

    def embed_tokens(
        self,
        images: Iterable[Image.Image],
    ) -> tuple[np.ndarray, np.ndarray]:
        tensors = [
            _preprocess(image, 1.0)
            for image in images
        ]
        if not tensors:
            return (
                np.empty((0, MODEL_EMBEDDING_DIM), dtype=np.float32),
                np.empty((0, 0, MODEL_EMBEDDING_DIM), dtype=np.float32),
            )
        batch = np.stack(tensors, axis=0)
        try:
            output = self.session.run(None, {self.input_name: batch})[0]
        except Exception as exc:  # noqa: BLE001
            logger.exception("DINOv2 推理失败")
            raise ModelUnavailableError("图片匹配模型推理失败") from exc

        if output.ndim != 3 or output.shape[0] != len(tensors):
            raise ModelUnavailableError("图片匹配模型输出不符合预期")
        cls_tokens = np.asarray(output[:, 0, :], dtype=np.float32)
        patch_tokens = np.asarray(output[:, 1:, :], dtype=np.float32)
        normalized_patches = _normalize_rows(
            patch_tokens.reshape(-1, patch_tokens.shape[-1])
        ).reshape(patch_tokens.shape)
        return _normalize_rows(cls_tokens), normalized_patches

    def embed(self, images: Iterable[Image.Image]) -> np.ndarray:
        cls_tokens, _ = self.embed_tokens(images)
        return cls_tokens


def _get_engine() -> _DinoV2Engine:
    global _engine
    if _engine is not None:
        return _engine
    with _engine_lock:
        if _engine is None:
            _engine = _DinoV2Engine()
    return _engine


def extract_main_fingerprint(image: Image.Image) -> ImageFingerprint:
    embedding = _get_engine().embed([image])[0]
    return ImageFingerprint(phash=compute_phash(image), embedding=embedding)


def extract_query_features(image: Image.Image) -> QueryFeatures:
    names, variants = _query_variants(image)
    embeddings, patches = _get_engine().embed_tokens(variants)
    return QueryFeatures(
        phash=compute_phash(image),
        embeddings=embeddings,
        patch_embeddings=tuple(patches),
        variant_names=names,
    )


def reset_engine_cache() -> None:
    """仅供测试或模型热更新后清空进程内缓存。"""
    global _engine
    with _engine_lock:
        _engine = None
