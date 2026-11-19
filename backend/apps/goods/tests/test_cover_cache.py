"""封面托管模块 cover_cache 的测试（全程不联网）。

重点保证两件事：

1. 外链一律落到本站媒体目录，库里只存 /media/... 路径；
2. **清晰度优先**：默认按字节原样保存，需要重编码时保持分辨率，
   只有体积实在过大（>1.5MB 且最长边 >2000px）才等比缩小，且最短边不小于 1200px。
"""
import io
import shutil
import tempfile
from unittest.mock import patch

from django.core.files.storage import default_storage
from django.test import TestCase, override_settings
from PIL import Image

from apps.goods import cover_cache


def make_image(width=900, height=1200, mode="RGB", noise=False):
    """生成测试用图片字节。noise=True 时体积显著变大（用于压缩路径）。"""
    if noise:
        image = Image.effect_noise((width, height), 48).convert("RGB")
    else:
        image = Image.new(mode, (width, height), (120, 140, 200))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=95)
    return buffer.getvalue()


class FakeImageResponse:
    """requests.get 的替身（模拟真实图片响应）。"""

    def __init__(self, body=None, content_type="image/jpeg", status_code=200):
        self.status_code = status_code
        self.headers = {"Content-Type": content_type}
        self.body = body if body is not None else make_image()
        self.closed = False

    def iter_content(self, chunk_size=8192):
        for start in range(0, len(self.body), chunk_size):
            yield self.body[start:start + chunk_size]

    def close(self):
        self.closed = True


class CoverCacheTestBase(TestCase):
    def setUp(self):
        super().setUp()
        self.media_root = tempfile.mkdtemp(prefix="pickgoods-cover-tests-")
        override = override_settings(MEDIA_ROOT=self.media_root)
        override.enable()
        self.addCleanup(override.disable)
        self.addCleanup(shutil.rmtree, self.media_root, True)

        self.response = FakeImageResponse()
        patcher = patch("apps.goods.cover_cache.requests.get", side_effect=self._fake_get)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _fake_get(self, url, **kwargs):
        if isinstance(self.response, Exception):
            raise self.response
        return self.response

    def stored_path(self, value):
        self.assertTrue(str(value).startswith("/media/ips/covers/"), value)
        return str(value)[len("/media/"):]

    def read_stored(self, value):
        with default_storage.open(self.stored_path(value), "rb") as handle:
            return handle.read()


class OptimizeCoverTests(CoverCacheTestBase):
    def test_small_cover_is_kept_byte_identical(self):
        raw = make_image(900, 1200)
        optimized, ext = cover_cache.optimize_cover(raw, "image/jpeg", "https://x/a.jpg")

        self.assertEqual(optimized, raw)
        self.assertEqual(ext, "jpg")

    def test_reencode_keeps_resolution(self):
        raw = make_image(1400, 2000, noise=True)
        self.assertGreater(len(raw), cover_cache.PASSTHROUGH_BYTES)

        optimized, _ext = cover_cache.optimize_cover(raw, "image/jpeg")

        with Image.open(io.BytesIO(optimized)) as result:
            self.assertEqual(result.size, (1400, 2000))
        self.assertLessEqual(len(optimized), cover_cache.MAX_STORED_BYTES)

    def test_huge_cover_is_downscaled_but_stays_sharp(self):
        raw = make_image(2600, 3400, noise=True)

        optimized, _ext = cover_cache.optimize_cover(raw, "image/jpeg")

        with Image.open(io.BytesIO(optimized)) as result:
            longest = max(result.size)
            shortest = min(result.size)
        self.assertLessEqual(longest, cover_cache.MAX_EDGE)
        self.assertGreaterEqual(shortest, cover_cache.MIN_EDGE)
        self.assertLessEqual(len(optimized), cover_cache.MAX_STORED_BYTES)

    def test_unparsable_payload_is_stored_as_is(self):
        raw = b"not-a-real-image"
        optimized, ext = cover_cache.optimize_cover(raw, "image/avif", "https://x/a.avif")

        self.assertEqual(optimized, raw)
        self.assertEqual(ext, "avif")


class DownloadCoverTests(CoverCacheTestBase):
    def test_cache_cover_from_url_stores_local_file(self):
        stored = cover_cache.cache_cover_from_url("https://lain.bgm.tv/pic/cover/l/a.jpg")

        self.assertTrue(stored.startswith("/media/ips/covers/"))
        self.assertGreater(len(self.read_stored(stored)), 0)

    def test_non_image_content_type_is_rejected(self):
        self.response = FakeImageResponse(body=b"<html>", content_type="text/html")

        with self.assertRaises(cover_cache.CoverCacheError):
            cover_cache.cache_cover_from_url("https://example.com/cover.jpg")

    def test_http_error_is_rejected(self):
        self.response = FakeImageResponse(status_code=404)

        with self.assertRaises(cover_cache.CoverCacheError):
            cover_cache.cache_cover_from_url("https://example.com/cover.jpg")

    def test_connection_error_is_rejected(self):
        import requests

        self.response = requests.exceptions.ConnectionError("boom")

        with self.assertRaises(cover_cache.CoverCacheError):
            cover_cache.cache_cover_from_url("https://example.com/cover.jpg")

    def test_try_cache_cover_swallows_failures(self):
        import requests

        self.response = requests.exceptions.ConnectionError("boom")

        self.assertIsNone(cover_cache.try_cache_cover("https://example.com/cover.jpg"))
        self.assertIsNone(cover_cache.try_cache_cover(""))

    def test_oversized_download_is_aborted(self):
        self.response = FakeImageResponse(body=b"x" * (cover_cache.MAX_DOWNLOAD_BYTES + 1))

        with self.assertRaises(cover_cache.CoverCacheError):
            cover_cache.cache_cover_from_url("https://example.com/cover.jpg")


class NormalizeCoverInputTests(CoverCacheTestBase):
    def test_empty_values_become_none(self):
        self.assertIsNone(cover_cache.normalize_cover_input(None))
        self.assertIsNone(cover_cache.normalize_cover_input("   "))

    def test_media_path_is_kept(self):
        self.assertEqual(
            cover_cache.normalize_cover_input("/media/ips/covers/a.jpg"),
            "/media/ips/covers/a.jpg",
        )

    def test_remote_url_is_downloaded(self):
        stored = cover_cache.normalize_cover_input("https://lain.bgm.tv/pic/cover/l/a.jpg")

        self.assertTrue(stored.startswith("/media/ips/covers/"))

    def test_absolute_url_of_local_file_is_collapsed_without_download(self):
        stored = cover_cache.cache_cover_from_url("https://lain.bgm.tv/pic/cover/l/a.jpg")
        absolute = "http://192.168.3.150:8000" + stored

        with patch("apps.goods.cover_cache.cache_cover_from_url") as downloader:
            self.assertEqual(cover_cache.normalize_cover_input(absolute), stored)
            downloader.assert_not_called()

    def test_invalid_value_is_rejected(self):
        with self.assertRaises(cover_cache.CoverCacheError):
            cover_cache.normalize_cover_input("covers/a.jpg")


class AbsoluteCoverUrlTests(CoverCacheTestBase):
    def test_relative_path_becomes_absolute_with_request(self):
        request = type("R", (), {"build_absolute_uri": lambda self, url: "http://host:8000" + url})()

        self.assertEqual(
            cover_cache.absolute_cover_url(request, "/media/ips/covers/a.jpg"),
            "http://host:8000/media/ips/covers/a.jpg",
        )

    def test_remote_url_is_passed_through(self):
        self.assertEqual(
            cover_cache.absolute_cover_url(None, "https://lain.bgm.tv/a.jpg"),
            "https://lain.bgm.tv/a.jpg",
        )

    def test_empty_value_returns_none(self):
        self.assertIsNone(cover_cache.absolute_cover_url(None, None))

    def test_without_request_returns_relative_path(self):
        self.assertEqual(
            cover_cache.absolute_cover_url(None, "/media/ips/covers/a.jpg"),
            "/media/ips/covers/a.jpg",
        )


class DeleteCoverFileTests(CoverCacheTestBase):
    def test_deletes_only_local_cover_files(self):
        stored = cover_cache.cache_cover_from_url("https://lain.bgm.tv/pic/cover/l/a.jpg")
        relative = self.stored_path(stored)
        self.assertTrue(default_storage.exists(relative))

        cover_cache.delete_cover_file(stored)
        self.assertFalse(default_storage.exists(relative))

    def test_ignores_remote_and_unrelated_paths(self):
        cover_cache.delete_cover_file("https://lain.bgm.tv/a.jpg")
        cover_cache.delete_cover_file("/media/goods/main/a.jpg")
        cover_cache.delete_cover_file(None)
