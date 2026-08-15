"""
BGM 函数视图的权限测试。

重点关注 bgm_create_characters：写入全局 IP / Character 目录必须仅限管理员，
普通用户与匿名请求必须被拒绝（前端隐藏入口不代表服务端安全边界）。
"""
from django.urls import reverse
from rest_framework.test import APIClient

from django.test import TestCase

from apps.goods.models import Character, IP
from apps.users.models import Role, User


class BGMCreateCharactersPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("bgm-create-characters")

        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")

        self.admin = User.objects.create(username="bgm_admin", role=self.admin_role)
        self.user = User.objects.create(username="bgm_user", role=self.user_role)

    def _payload(self):
        return {
            "characters": [
                {
                    "ip_name": "权限测试作品",
                    "character_name": "权限测试角色",
                }
            ]
        }

    def test_anonymous_request_is_forbidden(self):
        # DRF 函数视图未携带认证器上下文时，匿名请求被权限层拒绝为 403
        response = self.client.post(self.url, data=self._payload(), format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(IP.objects.filter(name="权限测试作品").exists())
        self.assertFalse(Character.objects.filter(name="权限测试角色").exists())

    def test_normal_user_is_forbidden(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, data=self._payload(), format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(IP.objects.filter(name="权限测试作品").exists())
        self.assertFalse(Character.objects.filter(name="权限测试角色").exists())

    def test_admin_can_create_catalog_entries(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, data=self._payload(), format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 1)
        self.assertTrue(IP.objects.filter(name="权限测试作品").exists())
        self.assertTrue(
            Character.objects.filter(
                ip__name="权限测试作品",
                name="权限测试角色",
            ).exists()
        )
