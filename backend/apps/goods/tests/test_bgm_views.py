"""
BGM 函数视图的权限测试。

重点关注 bgm_create_characters 的归属规则：
- 管理员 → 写入/复用官方 IP（``IP.user`` 为空）；
- 收藏者（collector）→ 只能写入自己的个人 IP；
- 社团账号与匿名请求 → 一律拒绝（前端隐藏入口不代表服务端安全边界）。
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
        self.club_user = User.objects.create(
            username="bgm_club",
            role=self.user_role,
            account_type=User.ACCOUNT_TYPE_CLUB,
        )

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

    def test_collector_creates_entries_under_own_personal_ip(self):
        """收藏者可以导入，但落库的 IP 必须归自己（个人 IP），不能污染官方目录。"""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, data=self._payload(), format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 1)

        ip = IP.objects.get(name="权限测试作品")
        self.assertEqual(ip.user_id, self.user.id)
        self.assertTrue(
            Character.objects.filter(ip=ip, name="权限测试角色").exists()
        )
        # 官方域里没有同名 IP
        self.assertFalse(IP.objects.filter(name="权限测试作品", user__isnull=True).exists())

    def test_collector_reuses_own_personal_ip(self):
        """同一个账号再次导入同名作品时复用已有的个人 IP，不会报无法创建。"""
        self.client.force_authenticate(user=self.user)
        self.client.post(self.url, data=self._payload(), format="json")
        response = self.client.post(
            self.url,
            data={
                "characters": [
                    {"ip_name": "权限测试作品", "character_name": "第二个角色"}
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(IP.objects.filter(name="权限测试作品").count(), 1)
        self.assertEqual(IP.objects.get(name="权限测试作品").characters.count(), 2)

    def test_collector_cannot_shadow_official_name(self):
        """官方已有同名 IP 时，普通账号导入被拒绝并给出可操作提示。"""
        IP.objects.create(name="权限测试作品")
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, data=self._payload(), format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 0)
        detail = response.data["details"][0]
        self.assertEqual(detail["status"], "error")
        self.assertIn("已存在同名官方 IP", detail["error"])
        self.assertFalse(IP.objects.filter(name="权限测试作品", user=self.user).exists())

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

    def test_admin_does_not_attach_to_users_personal_ip(self):
        """管理员导入同名作品时不会挂到用户的个人 IP 上（官方域独立）。"""
        IP.objects.create(name="权限测试作品", user=self.user)
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, data=self._payload(), format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(IP.objects.filter(name="权限测试作品").count(), 2)
        official = IP.objects.get(name="权限测试作品", user__isnull=True)
        self.assertTrue(Character.objects.filter(ip=official).exists())

