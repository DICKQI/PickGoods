"""BGM 函数视图的权限测试。

2026-11 起「从 Bangumi 导入」收敛为管理员专属：

- 管理员 → 写入/复用**官方** IP（IP.user 为空）；
- 收藏者（collector）→ 403（个人账号不能再从 BGM 导入，只能手工建自己的作品）；
- 社团账号与匿名请求 → 一律拒绝（前端隐藏入口不代表服务端安全边界）。

附带的封面行为：导入时带的 BGM 封面会先转存到本站媒体目录，再写入 IP。
"""
import io
import shutil
import tempfile
from unittest.mock import patch

from django.core.files.storage import default_storage
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from apps.goods.models import Character, IP
from apps.users.models import Role, User


def _jpeg_bytes(width=600, height=800):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (90, 120, 180)).save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


class _FakeImageResponse:
    """requests.get 的替身，返回一张可解码的 JPEG。"""

    status_code = 200

    def __init__(self):
        self.headers = {"Content-Type": "image/jpeg"}
        self.body = _jpeg_bytes()

    def iter_content(self, chunk_size=8192):
        for start in range(0, len(self.body), chunk_size):
            yield self.body[start:start + chunk_size]

    def close(self):
        pass


class BGMCreateCharactersPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("bgm-create-characters")

        self.media_root = tempfile.mkdtemp(prefix="pickgoods-bgm-covers-")
        override = override_settings(MEDIA_ROOT=self.media_root)
        override.enable()
        self.addCleanup(override.disable)
        self.addCleanup(shutil.rmtree, self.media_root, True)

        patcher = patch("apps.goods.cover_cache.requests.get", return_value=_FakeImageResponse())
        patcher.start()
        self.addCleanup(patcher.stop)

        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")

        self.admin = User.objects.create(username="bgm_admin", role=self.admin_role)
        self.user = User.objects.create(username="bgm_user", role=self.user_role)
        self.club_user = User.objects.create(
            username="bgm_club",
            role=self.user_role,
            account_type=User.ACCOUNT_TYPE_CLUB,
        )

    def _payload(self, cover_image=None):
        character = {
            "ip_name": "权限测试作品",
            "character_name": "权限测试角色",
        }
        if cover_image:
            character["cover_image"] = cover_image
        return {"characters": [character]}

    def test_anonymous_request_is_forbidden(self):
        # DRF 函数视图未携带认证器上下文时，匿名请求被权限层拒绝为 403
        response = self.client.post(self.url, data=self._payload(), format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(IP.objects.filter(name="权限测试作品").exists())
        self.assertFalse(Character.objects.filter(name="权限测试角色").exists())

    def test_collector_cannot_import_from_bgm(self):
        """个人账号（collector）不再允许从 Bangumi 导入 IP，且不留下任何数据。"""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, data=self._payload(), format="json")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(IP.objects.filter(name="权限测试作品").exists())
        self.assertFalse(Character.objects.filter(name="权限测试角色").exists())

    def test_collector_cannot_import_into_own_personal_ip(self):
        """即便本人已有同名个人 IP，导入接口对个人账号同样关闭。"""
        IP.objects.create(name="权限测试作品", user=self.user)
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.url, data=self._payload(), format="json")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Character.objects.filter(name="权限测试角色").count(), 0)

    def test_club_account_is_forbidden(self):
        self.client.force_authenticate(user=self.club_user)
        response = self.client.post(self.url, data=self._payload(), format="json")
        self.assertEqual(response.status_code, 403)

    def test_admin_can_create_catalog_entries(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, data=self._payload(), format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 1)
        ip = IP.objects.get(name="权限测试作品")
        self.assertIsNone(ip.user_id)
        self.assertTrue(
            Character.objects.filter(
                ip__name="权限测试作品",
                name="权限测试角色",
            ).exists()
        )

    def test_admin_import_stores_cover_on_server(self):
        """导入带的封面必须转存到本站媒体目录，库里不保留 BGM 外链。"""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            self.url,
            data=self._payload(cover_image="https://lain.bgm.tv/pic/cover/l/d2/c9/360097_z4dYA.jpg"),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        ip = IP.objects.get(name="权限测试作品")
        self.assertTrue(ip.cover_image.startswith("/media/ips/covers/"), ip.cover_image)
        self.assertTrue(default_storage.exists(ip.cover_image[len("/media/"):]))

    def test_admin_does_not_attach_to_users_personal_ip(self):
        """管理员导入同名作品时不会挂到用户的个人 IP 上（官方域独立）。"""
        IP.objects.create(name="权限测试作品", user=self.user)
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, data=self._payload(), format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(IP.objects.filter(name="权限测试作品").count(), 2)
        official = IP.objects.get(name="权限测试作品", user__isnull=True)
        self.assertTrue(Character.objects.filter(ip=official).exists())
