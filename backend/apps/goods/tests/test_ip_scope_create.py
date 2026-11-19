"""前台「新建 IP」的归属选择测试（管理员可选官方 / 个人）。

规则：

- 管理员：默认创建官方全局 IP；显式 is_personal=true 时创建归自己的个人作品；
- 普通账号：恒为个人作品（请求里的 is_personal 被忽略）；
- 个人作品开关关闭（PERSONAL_IP_ENABLED=0）时，管理员也不能建个人作品；
- 归属只在新建时生效，更新不改变归属；
- 名称唯一性按归属域判定（个人作品不得与官方同名）。
"""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.admin_api.models import AdminAuditLog
from apps.goods.models import IP
from apps.users.models import Role, User

IPS_URL = "/api/ips/"


class IPScopeCreateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(username="scope_admin", role=self.admin_role)
        self.alice = User.objects.create(username="scope_alice", role=self.user_role)

    def _post(self, user, **payload):
        self.client.force_authenticate(user=user)
        return self.client.post(IPS_URL, data=payload, format="json")

    def test_admin_creates_official_ip_by_default(self):
        response = self._post(self.admin, name="官方新作")

        self.assertEqual(response.status_code, 201, response.data)
        ip = IP.objects.get(name="官方新作")
        self.assertIsNone(ip.user_id)
        self.assertEqual(response.data["user_id"], None)
        self.assertFalse(response.data["is_personal"])

    def test_admin_can_create_personal_ip(self):
        response = self._post(self.admin, name="管理员私藏", is_personal=True)

        self.assertEqual(response.status_code, 201, response.data)
        ip = IP.objects.get(name="管理员私藏")
        self.assertEqual(ip.user_id, self.admin.id)
        self.assertTrue(response.data["is_personal"])
        self.assertEqual(response.data["user_id"], self.admin.id)

    def test_admin_personal_ip_is_visible_only_to_its_owner(self):
        self._post(self.admin, name="管理员私藏", is_personal=True)

        self.client.force_authenticate(user=self.admin)
        admin_names = [row["name"] for row in self.client.get(IPS_URL).data]
        self.assertIn("管理员私藏", admin_names)

        self.client.force_authenticate(user=self.alice)
        alice_names = [row["name"] for row in self.client.get(IPS_URL).data]
        self.assertNotIn("管理员私藏", alice_names)

    def test_collector_is_always_personal_even_when_asking_official(self):
        """普通账号传 is_personal=false 也只会得到自己的个人作品。"""
        response = self._post(self.alice, name="爱丽丝作品", is_personal=False)

        self.assertEqual(response.status_code, 201, response.data)
        ip = IP.objects.get(name="爱丽丝作品")
        self.assertEqual(ip.user_id, self.alice.id)
        self.assertTrue(response.data["is_personal"])

    @override_settings(PERSONAL_IP_ENABLED="0")
    def test_personal_scope_is_rejected_when_flag_disabled(self):
        response = self._post(self.admin, name="停用期私藏", is_personal=True)

        self.assertEqual(response.status_code, 400)
        self.assertIn("is_personal", response.data)
        self.assertFalse(IP.objects.filter(name="停用期私藏").exists())

    def test_admin_personal_name_cannot_shadow_official(self):
        IP.objects.create(name="官方作品")

        response = self._post(self.admin, name="官方作品", is_personal=True)

        self.assertEqual(response.status_code, 400)
        self.assertIn("官方作品已存在", str(response.data))
        self.assertFalse(IP.objects.filter(name="官方作品", user=self.admin).exists())

    def test_admin_personal_duplicate_name_is_rejected(self):
        IP.objects.create(name="管理员私藏", user=self.admin)

        response = self._post(self.admin, name="管理员私藏", is_personal=True)

        self.assertEqual(response.status_code, 400)
        self.assertIn("同名作品", str(response.data))

    def test_official_name_may_match_someone_elses_personal_ip(self):
        """官方域与个人域独立：他人个人作品同名不阻塞官方建档。"""
        IP.objects.create(name="撞名作品", user=self.alice)

        response = self._post(self.admin, name="撞名作品")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(IP.objects.filter(name="撞名作品", user__isnull=True).exists())

    def test_update_does_not_change_scope(self):
        ip = IP.objects.create(name="管理员私藏", user=self.admin)
        detail_url = f"{IPS_URL}{ip.id}/"

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            detail_url, data={"name": "改名后私藏", "is_personal": False}, format="json"
        )

        self.assertEqual(response.status_code, 200, response.data)
        ip.refresh_from_db()
        self.assertEqual(ip.name, "改名后私藏")
        self.assertEqual(ip.user_id, self.admin.id)

    def test_create_is_audited_with_scope(self):
        self._post(self.admin, name="管理员私藏", is_personal=True)

        log = AdminAuditLog.objects.filter(action="ip.create").latest("id")
        self.assertIn("个人", log.summary)
        self.assertTrue(log.changes["personal"])

        self._post(self.admin, name="官方新作")
        log = AdminAuditLog.objects.filter(action="ip.create").latest("id")
        self.assertIn("官方", log.summary)
        self.assertFalse(log.changes["personal"])
