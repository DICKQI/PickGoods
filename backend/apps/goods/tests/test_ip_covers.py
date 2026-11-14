"""IP 作品封面（Bangumi 条目封面图）相关测试。

覆盖：

1. ``pick_cover_url`` / ``normalize_image_url`` 的取值优先级与 https 归一；
2. ``resolve_ip_cover`` 在「已绑定 subject_id」「按名称精确匹配」「未命中」「请求异常」下的行为；
3. ``backfill_ip_covers`` 的节流、force、limit、失败隔离与 remaining 语义；
4. ``/api/ips/fetch-covers/`` 与 ``/api/ips/{id}/fetch-cover/`` 的权限与返回结构；
5. 序列化器暴露 ``cover_image`` / ``cover_checked_at``，且可通过 PATCH 写入与清除。

测试全程不联网：BGM 侧通过注入假 service 替代。
"""
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.goods.bgm_service import normalize_image_url, pick_cover_url
from apps.goods.ip_cover import (
    STATUS_ERROR,
    STATUS_NO_MATCH,
    STATUS_UPDATED,
    backfill_ip_covers,
    normalize_subject_name,
    refresh_ip_cover,
    resolve_ip_cover,
)
from apps.goods.models import IP
from apps.users.models import Role, User


class FakeBGMService:
    """可编程的 BGM 服务替身：记录调用并支持注入异常。"""

    def __init__(self, subject_images=None, candidates=None, subject_error=None, search_error=None):
        self.subject_images = subject_images or {}
        self.candidates = candidates or {}
        self.subject_error = subject_error
        self.search_error = search_error
        self.subject_calls = []
        self.search_calls = []

    def get_subject_info(self, subject_id):
        self.subject_calls.append(subject_id)
        if self.subject_error:
            raise self.subject_error
        return {"id": subject_id, "images": self.subject_images.get(subject_id, {})}

    def search_subject_candidates(self, keyword, subject_type=None, limit=10):
        self.search_calls.append((keyword, subject_type))
        if self.search_error:
            raise self.search_error
        return self.candidates.get(keyword, [])


def cover_images(url="https://lain.bgm.tv/pic/cover/l/d2/c9/360097_z4dYA.jpg"):
    return {"large": url, "common": url, "medium": url, "grid": url, "small": url}


class CoverUrlTests(TestCase):
    def test_pick_cover_url_prefers_large(self):
        images = {
            "large": "https://lain.bgm.tv/large.jpg",
            "common": "https://lain.bgm.tv/common.jpg",
            "grid": "https://lain.bgm.tv/grid.jpg",
        }
        self.assertEqual(pick_cover_url(images), "https://lain.bgm.tv/large.jpg")

    def test_pick_cover_url_falls_back_when_large_missing(self):
        images = {"common": "https://lain.bgm.tv/common.jpg", "grid": ""}
        self.assertEqual(pick_cover_url(images), "https://lain.bgm.tv/common.jpg")

    def test_pick_cover_url_normalizes_legacy_http_url(self):
        images = {"large": "http://lain.bgm.tv/pic/cover/l/d2/c9/360097_z4dYA.jpg"}
        self.assertEqual(
            pick_cover_url(images),
            "https://lain.bgm.tv/pic/cover/l/d2/c9/360097_z4dYA.jpg",
        )

    def test_pick_cover_url_returns_none_for_empty_payload(self):
        self.assertIsNone(pick_cover_url({}))
        self.assertIsNone(pick_cover_url(None))
        self.assertIsNone(pick_cover_url({"large": ""}))

    def test_normalize_image_url_keeps_foreign_hosts_untouched(self):
        self.assertEqual(
            normalize_image_url("https://example.com/a.jpg"),
            "https://example.com/a.jpg",
        )
        self.assertEqual(normalize_image_url("//lain.bgm.tv/a.jpg"), "https://lain.bgm.tv/a.jpg")
        self.assertEqual(normalize_image_url(None), "")


class NormalizeSubjectNameTests(TestCase):
    def test_ignores_width_case_and_punctuation(self):
        self.assertEqual(
            normalize_subject_name("崩坏：星穹铁道"),
            normalize_subject_name("崩坏: 星穹铁道"),
        )
        self.assertEqual(normalize_subject_name("Fate/stay night"), normalize_subject_name("fate stay night"))

    def test_empty_input(self):
        self.assertEqual(normalize_subject_name(None), "")
        self.assertEqual(normalize_subject_name("  "), "")


class ResolveIpCoverTests(TestCase):
    def test_bound_subject_uses_subject_images(self):
        ip = IP.objects.create(name="崩坏：星穹铁道", bgm_subject_id=360097)
        service = FakeBGMService(subject_images={360097: cover_images()})

        cover, cover_status, reason = resolve_ip_cover(ip, service=service)

        self.assertEqual(cover, cover_images()["large"])
        self.assertEqual(cover_status, STATUS_UPDATED)
        self.assertEqual(reason, "")
        self.assertEqual(service.subject_calls, [360097])
        self.assertEqual(service.search_calls, [])

    def test_bound_subject_without_images_is_no_match(self):
        ip = IP.objects.create(name="无封面作品", bgm_subject_id=999)
        service = FakeBGMService(subject_images={999: {}})

        cover, cover_status, _reason = resolve_ip_cover(ip, service=service)

        self.assertIsNone(cover)
        self.assertEqual(cover_status, STATUS_NO_MATCH)

    def test_unbound_uses_exact_name_match(self):
        ip = IP.objects.create(name="崩坏：星穹铁道", subject_type=4)
        service = FakeBGMService(
            candidates={
                "崩坏：星穹铁道": [
                    {"id": 1, "name": "崩壊：スターレイル", "name_cn": "崩坏：星穹铁道", "images": cover_images()},
                    {"id": 2, "name": "别的东西", "name_cn": "别的作品", "images": cover_images()},
                ]
            }
        )

        cover, cover_status, _reason = resolve_ip_cover(ip, service=service)

        self.assertEqual(cover, cover_images()["large"])
        self.assertEqual(cover_status, STATUS_UPDATED)
        self.assertEqual(service.search_calls, [("崩坏：星穹铁道", 4)])
        # 解析封面不允许改写绑定关系
        ip.refresh_from_db()
        self.assertIsNone(ip.bgm_subject_id)

    def test_unbound_rejects_fuzzy_candidates(self):
        ip = IP.objects.create(name="黑执事")
        service = FakeBGMService(
            candidates={
                "黑执事": [
                    {"id": 3, "name": "黒執事II", "name_cn": "黑执事II", "images": cover_images()},
                ]
            }
        )

        cover, cover_status, reason = resolve_ip_cover(ip, service=service)

        self.assertIsNone(cover)
        self.assertEqual(cover_status, STATUS_NO_MATCH)
        self.assertIn("未找到同名条目", reason)

    def test_unbound_without_candidates_is_no_match(self):
        ip = IP.objects.create(name="没有条目的作品")
        service = FakeBGMService(candidates={})

        cover, cover_status, _reason = resolve_ip_cover(ip, service=service)

        self.assertIsNone(cover)
        self.assertEqual(cover_status, STATUS_NO_MATCH)

    def test_service_error_is_reported_not_raised(self):
        ip = IP.objects.create(name="崩坏：星穹铁道", bgm_subject_id=360097)
        service = FakeBGMService(subject_error=RuntimeError("BGM timeout"))

        cover, cover_status, reason = resolve_ip_cover(ip, service=service)

        self.assertIsNone(cover)
        self.assertEqual(cover_status, STATUS_ERROR)
        self.assertIn("BGM timeout", reason)


class BackfillIpCoversTests(TestCase):
    def setUp(self):
        self.now = timezone.now()

    def _service(self, candidates=None, subject_images=None):
        return FakeBGMService(candidates=candidates or {}, subject_images=subject_images or {})

    def test_skips_recently_checked_ip_without_cover(self):
        ip = IP.objects.create(
            name="刚检查过的作品",
            cover_checked_at=self.now - timedelta(days=1),
        )
        service = self._service(candidates={"刚检查过的作品": [{"id": 1, "name": "刚检查过的作品", "images": cover_images()}]})

        result = backfill_ip_covers(service=service, now=self.now, sleep_seconds=0, limit=10)

        self.assertEqual(result["checked"], 0)
        self.assertEqual(result["updated"], 0)
        self.assertEqual(service.search_calls, [])
        ip.refresh_from_db()
        self.assertIsNone(ip.cover_image)

    def test_retries_stale_ip_and_updates_cover(self):
        ip = IP.objects.create(
            name="崩坏：星穹铁道",
            subject_type=4,
            cover_checked_at=self.now - timedelta(days=30),
        )
        service = self._service(
            candidates={
                "崩坏：星穹铁道": [
                    {"id": 1, "name": "崩坏：星穹铁道", "name_cn": "崩坏：星穹铁道", "images": cover_images()},
                ]
            }
        )

        result = backfill_ip_covers(service=service, now=self.now, sleep_seconds=0, limit=10)

        self.assertEqual(result["checked"], 1)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(result["failed"], [])
        self.assertEqual(result["remaining"], 0)
        ip.refresh_from_db()
        self.assertEqual(ip.cover_image, cover_images()["large"])
        self.assertEqual(ip.cover_checked_at, self.now)
        self.assertEqual(result["items"], [{"id": ip.id, "name": ip.name, "cover_image": cover_images()["large"]}])

    def test_no_match_still_records_checked_at(self):
        ip = IP.objects.create(name="没有条目的作品")
        service = self._service()

        result = backfill_ip_covers(service=service, now=self.now, sleep_seconds=0, limit=10)

        self.assertEqual(result["updated"], 0)
        self.assertEqual(result["checked"], 1)
        self.assertEqual(len(result["failed"]), 1)
        ip.refresh_from_db()
        self.assertIsNone(ip.cover_image)
        self.assertEqual(ip.cover_checked_at, self.now)

    def test_existing_cover_is_not_overwritten_without_force(self):
        ip = IP.objects.create(
            name="已有封面作品",
            cover_image="https://lain.bgm.tv/manual.jpg",
            cover_checked_at=self.now - timedelta(days=30),
        )
        service = self._service(candidates={"已有封面作品": [{"id": 1, "name": "已有封面作品", "images": cover_images()}]})

        result = backfill_ip_covers(service=service, now=self.now, sleep_seconds=0, limit=10)

        self.assertEqual(result["checked"], 0)
        self.assertEqual(service.search_calls, [])
        ip.refresh_from_db()
        self.assertEqual(ip.cover_image, "https://lain.bgm.tv/manual.jpg")

    def test_force_overwrites_existing_cover(self):
        ip = IP.objects.create(name="崩坏：星穹铁道", cover_image="https://lain.bgm.tv/old.jpg")
        service = self._service(
            candidates={
                "崩坏：星穹铁道": [{"id": 1, "name": "崩坏：星穹铁道", "images": cover_images()}],
            }
        )

        result = backfill_ip_covers(
            ids=[ip.id], force=True, service=service, now=self.now, sleep_seconds=0, limit=10
        )

        self.assertEqual(result["updated"], 1)
        self.assertEqual(result["remaining"], 0)
        ip.refresh_from_db()
        self.assertEqual(ip.cover_image, cover_images()["large"])

    def test_limit_bounds_work_and_reports_remaining(self):
        for index in range(3):
            IP.objects.create(name=f"作品{index}")
        service = self._service(
            candidates={
                "作品0": [{"id": 1, "name": "作品0", "images": cover_images()}],
                "作品1": [{"id": 2, "name": "作品1", "images": cover_images()}],
                "作品2": [{"id": 3, "name": "作品2", "images": cover_images()}],
            }
        )

        result = backfill_ip_covers(service=service, now=self.now, sleep_seconds=0, limit=2)

        self.assertEqual(result["checked"], 2)
        self.assertEqual(result["updated"], 2)
        self.assertEqual(result["remaining"], 1)

    def test_limit_is_clamped_to_at_least_one(self):
        IP.objects.create(name="作品0")
        IP.objects.create(name="作品1")
        service = self._service(
            candidates={
                "作品0": [{"id": 1, "name": "作品0", "images": cover_images()}],
                "作品1": [{"id": 2, "name": "作品1", "images": cover_images()}],
            }
        )

        result = backfill_ip_covers(service=service, now=self.now, sleep_seconds=0, limit=0)

        self.assertEqual(result["checked"], 1)
        self.assertEqual(result["remaining"], 1)

    def test_failure_is_isolated_so_other_ips_still_update(self):
        IP.objects.create(name="坏作品", bgm_subject_id=111)
        good = IP.objects.create(name="好作品")
        service = FakeBGMService(
            candidates={"好作品": [{"id": 2, "name": "好作品", "images": cover_images()}]},
            subject_error=RuntimeError("boom"),
        )

        result = backfill_ip_covers(service=service, now=self.now, sleep_seconds=0, limit=10)

        self.assertEqual(result["checked"], 2)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(len(result["failed"]), 1)
        self.assertEqual(result["failed"][0]["name"], "坏作品")
        good.refresh_from_db()
        self.assertEqual(good.cover_image, cover_images()["large"])

    def test_unknown_ids_are_counted_as_skipped(self):
        ip = IP.objects.create(name="作品0")
        service = self._service(candidates={"作品0": [{"id": 1, "name": "作品0", "images": cover_images()}]})

        result = backfill_ip_covers(
            ids=[ip.id, 999999], service=service, now=self.now, sleep_seconds=0, limit=10
        )

        self.assertEqual(result["skipped"], 1)
        self.assertEqual(result["updated"], 1)


class RefreshIpCoverTests(TestCase):
    def test_refresh_saves_resolved_cover(self):
        ip = IP.objects.create(name="崩坏：星穹铁道", bgm_subject_id=360097)
        service = FakeBGMService(subject_images={360097: cover_images()})

        cover, cover_status, _reason = refresh_ip_cover(ip, service=service)

        self.assertEqual(cover, cover_images()["large"])
        self.assertEqual(cover_status, STATUS_UPDATED)
        ip.refresh_from_db()
        self.assertEqual(ip.cover_image, cover_images()["large"])
        self.assertIsNotNone(ip.cover_checked_at)


class IPCoverApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(username="cover_admin", role=admin_role)
        self.user = User.objects.create(username="cover_user", role=user_role)
        self.list_url = reverse("ips-fetch-covers")

    def test_anonymous_cannot_fetch_covers(self):
        response = self.client.post(self.list_url, data={}, format="json")
        self.assertIn(response.status_code, (401, 403))

    def test_normal_user_cannot_fetch_covers(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.list_url, data={}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_normal_user_cannot_fetch_single_cover(self):
        ip = IP.objects.create(name="崩坏：星穹铁道")
        self.client.force_authenticate(user=self.user)
        response = self.client.post(reverse("ips-fetch-cover", args=[ip.id]), data={}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_admin_batch_fetch_returns_summary(self):
        ip = IP.objects.create(name="崩坏：星穹铁道")
        service = FakeBGMService(
            candidates={"崩坏：星穹铁道": [{"id": 1, "name": "崩坏：星穹铁道", "images": cover_images()}]}
        )
        self.client.force_authenticate(user=self.admin)

        with patch("apps.goods.ip_cover.default_service", return_value=service):
            response = self.client.post(self.list_url, data={"limit": 5}, format="json")

        self.assertEqual(response.status_code, 200)
        payload = response.data
        self.assertEqual(payload["updated"], 1)
        self.assertEqual(payload["checked"], 1)
        self.assertEqual(payload["remaining"], 0)
        self.assertEqual(payload["skipped"], 0)
        self.assertEqual(payload["items"][0]["id"], ip.id)
        ip.refresh_from_db()
        self.assertEqual(ip.cover_image, cover_images()["large"])

    def test_ids_must_be_a_list(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.list_url, data={"ids": 1}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_admin_single_fetch_returns_cover(self):
        ip = IP.objects.create(name="崩坏：星穹铁道", bgm_subject_id=360097)
        service = FakeBGMService(subject_images={360097: cover_images()})
        self.client.force_authenticate(user=self.admin)

        with patch("apps.goods.ip_cover.default_service", return_value=service):
            response = self.client.post(reverse("ips-fetch-cover", args=[ip.id]), data={}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["cover_image"], cover_images()["large"])
        self.assertEqual(response.data["status"], STATUS_UPDATED)
        self.assertTrue(response.data["resolved"])


class IPCoverSerializerTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.admin = User.objects.create(username="cover_serializer_admin", role=admin_role)
        self.client.force_authenticate(user=self.admin)
        self.ip = IP.objects.create(name="崩坏：星穹铁道")

    def test_list_exposes_cover_fields(self):
        response = self.client.get(reverse("ips-list"))
        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.data if item["id"] == self.ip.id)
        self.assertIn("cover_image", row)
        self.assertIn("cover_checked_at", row)

    def test_patch_writes_and_clears_cover(self):
        detail_url = reverse("ips-detail", args=[self.ip.id])

        response = self.client.patch(
            detail_url, data={"cover_image": "https://lain.bgm.tv/manual.jpg"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.ip.refresh_from_db()
        self.assertEqual(self.ip.cover_image, "https://lain.bgm.tv/manual.jpg")

        response = self.client.patch(detail_url, data={"cover_image": ""}, format="json")
        self.assertEqual(response.status_code, 200)
        self.ip.refresh_from_db()
        self.assertIsNone(self.ip.cover_image)
