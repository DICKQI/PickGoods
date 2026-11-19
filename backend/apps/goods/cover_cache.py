"""IP 作品封面的服务端托管（下载 → 轻量优化 → 落盘 → 对外绝对 URL）。

背景：封面历史上直接存 Bangumi CDN 的外链（https://lain.bgm.tv/...），图片由
**浏览器**去第三方站点拉取，于是客户端网络一旦访问不了 BGM CDN，页面就只剩首字
占位。这里把所有封面统一转存到 MEDIA_ROOT/ips/covers/，前端只加载本站后端
（:8000 的 /media/ 由 Django 提供）地址，彻底不依赖客户端出网。

**清晰度优先**：与 goods.utils.compress_image（压到 300KB、会缩图）不同，封面
不做激进压缩——原图 ≤1MB 且最长边 ≤2400px 时按字节原样保存；需要重编码时
**保持分辨率**、质量 92；只有仍然 >1.5MB 才等比缩到最长边 2000px，且最短边
不低于 1200px，质量绝不低于 85。这样才能在各种卡片比例、2x/3x 屏下都不发虚。
"""
from __future__ import annotations

import io
import logging
from urllib.parse import urlparse
from uuid import uuid4

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, UnidentifiedImageError

from . import bgm_service

logger = logging.getLogger(__name__)

#: 封面文件的存放目录（相对 MEDIA_ROOT）
COVER_SUBDIR = "ips/covers"

#: 下载体积硬上限，超过直接判定失败（防止误抓大文件）
MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024
#: 小于这个体积且尺寸不大时，按字节原样保存，零损失
PASSTHROUGH_BYTES = 1024 * 1024
#: 允许落到磁盘的最大体积（超过才考虑缩图）
MAX_STORED_BYTES = int(1.5 * 1024 * 1024)
#: 尺寸上限/下限（只在不缩就存不下时启用，且绝不小于 MIN_EDGE）
MAX_EDGE = 2000
MIN_EDGE = 1200
#: 原样保存判定用的最长边阈值（略高于 MAX_EDGE）
PASSTHROUGH_EDGE = 2400
#: 重编码质量，从高到低尝试；不降到 85 以下，保证清晰
RECOMPRESS_QUALITIES = (92, 90, 88, 85)
#: (连接, 读取) 超时
DOWNLOAD_TIMEOUT = (5, 25)

_CONTENT_TYPE_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/pjpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/bmp": "bmp",
}
_PIL_FORMAT_EXT = {
    "JPEG": "jpg",
    "MPO": "jpg",
    "PNG": "png",
    "WEBP": "webp",
    "GIF": "gif",
    "AVIF": "avif",
    "BMP": "bmp",
}
_ALLOWED_EXT = set(_CONTENT_TYPE_EXT.values())


class CoverCacheError(Exception):
    """封面下载/解析失败。属于「没有结论」的失败，调用方应允许稍后重试。"""


def is_remote_url(value) -> bool:
    """是否是 http(s) 外链。"""
    if not isinstance(value, str):
        return False
    lowered = value.strip().lower()
    return lowered.startswith("http://") or lowered.startswith("https://")


def is_media_path(value) -> bool:
    """是否已经是本站 /media/ 相对路径。"""
    if not isinstance(value, str):
        return False
    return value.strip().startswith(settings.MEDIA_URL)


def media_url_for(path) -> str:
    """把存储相对路径格式化成 /media/...。"""
    if not path:
        return ""
    text = str(path)
    if text.startswith(settings.MEDIA_URL):
        return text
    return settings.MEDIA_URL + text.lstrip("/")


def _ext_from_url(url) -> str:
    if not isinstance(url, str):
        return ""
    parts = urlparse(url).path.rsplit(".", 1)
    if len(parts) == 2:
        ext = parts[1].lower()
        if ext in _ALLOWED_EXT:
            return ext
    return ""


def download_image(url):
    """下载图片，返回 (原始字节, content-type)；失败抛 CoverCacheError。"""
    if not is_remote_url(url):
        raise CoverCacheError("不是有效的图片地址")

    try:
        response = requests.get(
            url,
            headers={
                "User-Agent": bgm_service.USER_AGENT,
                "Accept": "image/*,*/*;q=0.8",
            },
            stream=True,
            timeout=DOWNLOAD_TIMEOUT,
        )
    except requests.exceptions.RequestException as exc:
        raise CoverCacheError("下载失败：" + str(exc)) from exc

    try:
        status_code = getattr(response, "status_code", 200)
        if status_code != 200:
            raise CoverCacheError("下载失败：HTTP " + str(status_code))

        headers = getattr(response, "headers", {}) or {}
        content_type = (headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if content_type and not content_type.startswith("image/"):
            raise CoverCacheError("链接返回的不是图片（" + content_type + "）")

        buffer = bytearray()
        for chunk in response.iter_content(64 * 1024):
            if not chunk:
                continue
            buffer.extend(chunk)
            if len(buffer) > MAX_DOWNLOAD_BYTES:
                raise CoverCacheError("图片体积过大，已放弃转存")
        if not buffer:
            raise CoverCacheError("图片内容为空")
        return bytes(buffer), content_type
    except requests.exceptions.RequestException as exc:
        raise CoverCacheError("下载失败：" + str(exc)) from exc
    finally:
        close = getattr(response, "close", None)
        if callable(close):
            try:
                close()
            except Exception:
                pass


def _encode(image, pil_format, quality):
    """按原格式重编码（不改变分辨率）。失败返回 None。"""
    if pil_format == "GIF":
        # 动图重编码会丢帧，交给上层原样保存
        return None

    frame = image
    fmt = pil_format if pil_format in ("JPEG", "PNG", "WEBP") else "JPEG"
    if fmt == "JPEG" and frame.mode not in ("RGB", "L"):
        frame = frame.convert("RGB")

    output = io.BytesIO()
    try:
        if fmt == "JPEG":
            frame.save(output, format="JPEG", quality=quality, optimize=True, progressive=True)
        elif fmt == "WEBP":
            frame.save(output, format="WEBP", quality=quality, method=6)
        else:
            frame.save(output, format="PNG", optimize=True)
    except (OSError, ValueError):
        return None
    return output.getvalue()


def optimize_cover(raw, content_type="", url=""):
    """在「不糊」的前提下把封面体积压到可接受范围，返回 (字节, 扩展名)。

    1. 原图 ≤1MB 且最长边 ≤2400px → 原样返回（零损失，最常见路径）；
    2. 否则保持分辨率按原格式 quality 92 重编码，落盘 ≤1.5MB 即可；
    3. 仍然过大时才等比缩到最长边 2000px（最短边 ≥1200px），质量不低于 85；
    4. PIL 打不开的格式（如 AVIF）不做任何处理，原样保存。
    """
    ext = _CONTENT_TYPE_EXT.get(content_type, "")
    size = len(raw)

    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        logger.info("封面格式无法解析，按原样保存（%s bytes）", size)
        return raw, ext or _ext_from_url(url) or "jpg"

    pil_format = (image.format or "").upper()
    ext = ext or _PIL_FORMAT_EXT.get(pil_format, "") or _ext_from_url(url) or "jpg"

    width, height = image.size
    longest = max(width, height)

    if size <= PASSTHROUGH_BYTES and longest <= PASSTHROUGH_EDGE:
        return raw, ext

    best = raw
    for quality in RECOMPRESS_QUALITIES:
        candidate = _encode(image, pil_format, quality)
        if candidate is None:
            return raw, ext
        if len(candidate) < len(best):
            best = candidate
        if len(candidate) <= MAX_STORED_BYTES:
            return candidate, ext

    # 分辨率不变还压不下去：等比缩小，但守住下限（宁可大一点也不糊）
    if longest <= MAX_EDGE:
        return best, ext

    scale = MAX_EDGE / longest
    shortest = min(width, height)
    if shortest * scale < MIN_EDGE:
        scale = MIN_EDGE / shortest
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    resized = image.resize(new_size, Image.Resampling.LANCZOS)

    for quality in RECOMPRESS_QUALITIES:
        candidate = _encode(resized, pil_format, quality)
        if candidate is None:
            return best, ext
        if len(candidate) <= MAX_STORED_BYTES:
            return candidate, ext
        best = candidate
    return best, ext


def store_cover(raw, ext="jpg") -> str:
    """落盘并返回 /media/ips/covers/xxx.ext。"""
    suffix = (ext or "jpg").lstrip(".").lower()
    if suffix not in _ALLOWED_EXT:
        suffix = "jpg"
    name = COVER_SUBDIR + "/" + uuid4().hex + "." + suffix
    saved_path = default_storage.save(name, ContentFile(raw))
    return media_url_for(saved_path)


def cache_cover_from_url(url) -> str:
    """下载外链封面并转存到本站媒体目录，返回 /media/... 路径。"""
    raw, content_type = download_image(url)
    optimized, ext = optimize_cover(raw, content_type, url=url)
    return store_cover(optimized, ext)


def try_cache_cover(url):
    """尽力而为版本：失败只记日志并返回 None（供 BGM 导入/补齐等非致命路径使用）。"""
    if not url:
        return None
    try:
        return cache_cover_from_url(url)
    except CoverCacheError as exc:
        logger.warning("封面转存失败 %s：%s", url, exc)
        return None
    except Exception as exc:
        logger.warning("封面转存异常 %s：%s", url, exc)
        return None


def _existing_media_path(url) -> str:
    """本站媒体绝对 URL → 收敛成 /media/...，避免同一张图反复下载。"""
    path = urlparse(url).path or ""
    if not path.startswith(settings.MEDIA_URL):
        return ""
    relative = path[len(settings.MEDIA_URL):]
    try:
        if default_storage.exists(relative):
            return path
    except Exception:
        return ""
    return ""


def normalize_cover_input(value):
    """把请求体里的封面值规整成库里存的形式。

    - None / 空字符串 → None（清除，前端回落首字占位）；
    - /media/... → 原样（已在服务器上）；
    - 本站媒体绝对 URL → 收敛成 /media/...；
    - 其它 http(s) 外链 → 下载并转存，返回 /media/...；
    - 其它形式 → 抛 CoverCacheError。
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.startswith(settings.MEDIA_URL):
        return text
    if is_remote_url(text):
        hosted = _existing_media_path(text)
        if hosted:
            return hosted
        return cache_cover_from_url(text)
    raise CoverCacheError("封面需要是 http(s) 图片链接")


def absolute_cover_url(request, value):
    """对外输出：相对媒体路径补成绝对 URL（nginx 不服务 /media/，必须绝对）。"""
    if not value:
        return None
    text = str(value)
    if is_remote_url(text):
        return text
    if request is None:
        return text
    return request.build_absolute_uri(media_url_for(text))


def delete_cover_file(value) -> None:
    """删除本站托管的封面文件（尽力而为，且只动 ips/covers/ 下的文件）。"""
    if not value:
        return
    text = str(value).strip()
    if not text or is_remote_url(text):
        return
    if text.startswith(settings.MEDIA_URL):
        relative = text[len(settings.MEDIA_URL):]
    else:
        relative = text.lstrip("/")
    if not relative.startswith(COVER_SUBDIR + "/"):
        return
    try:
        if default_storage.exists(relative):
            default_storage.delete(relative)
    except Exception as exc:
        logger.warning("清理旧封面失败 %s：%s", relative, exc)
