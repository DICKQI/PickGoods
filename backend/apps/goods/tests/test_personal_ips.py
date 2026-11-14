"""
个人 IP（用户自建、仅本人可见）的作用域与权限测试。

覆盖：
1. IP 列表 / 详情的可见性（官方 + 本人 / 他人不可见）；
2. 写权限（官方 IP 只读、本人私有可写、管理员全权、社团账号拒绝）；
3. 名称与 BGM 绑定的归属域唯一性；
4. 角色随 IP 的作用域与写权限；
5. 删除仍有谷子的作品返回 409；
6. 平台热度只统计官方 IP；
7. 个人 Bangumi Token 的强制要求与请求头来源；
8. ``PERSONAL_IP_ENABLED`` 开关（T0 回滚）；
9. ``purge_personal_ips`` 回滚命令。
"""
from unittest import mock

import requests
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.goods.models import Category, Character, Goods, IP
from apps.users.models import Role, User

IPS_URL = "/api/ips/"
CHARACTERS_URL = "/api/characters/"


class _FakeResponse:
    """替身响应：只实现 bgm_service 需要的方法。"""

    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.exceptions.HTTPError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


class PersonalIPTestBase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")

        self.admin = User.objects.create(username="ip_admin", role=self.admin_role)
        self.alice = User.objects.create(username="ip_alice", role=self.user_role)
        self.bob = User.objects.create(username="ip_bob", role=self.user_role)
        self.club = User.objects.create(
            username="ip_club",
            role=self.user_role,
            account_type=User.ACCOUNT_TYPE_CLUB,
        )
        self.official = IP.objects.create(name="官方作品", subject_type=4)

    def as_user(self, user):
        self.client.force_authenticate(user=user)

    def create_ip(self, user, name, **extra):
        self.as_user(user)
        payload = {"name": name, **extra}
        return self.client.post(IPS_URL, payload, format="json")


class IPVisibilityTests(PersonalIPTestBase):
    def test_collector_creates_personal_ip(self):
        response = self.create_ip(self.alice, "爱丽丝专属作品", subject_type=2)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["user_id"], self.alice.id)
        self.assertTrue(response.data["is_personal"])

        ip = IP.objects.get(name="爱丽丝专属作品")
        self.assertEqual(ip.user_id, self.alice.id)

    def test_list_only_returns_official_and_own_ips(self):
        IP.objects.create(name="爱丽丝作品", user=self.alice)
        IP.objects.create(name="鲍勃作品", user=self.bob)

        self.as_user(self.alice)
        response = self.client.get(IPS_URL)
        self.assertEqual(response.status_code, 200)
        names = {item["name"] for item in response.data}
        self.assertEqual(names, {"官方作品", "爱丽丝作品"})

    def test_other_users_cannot_retrieve_personal_ip(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)

        self.as_user(self.bob)
        self.assertEqual(self.client.get(f"{IPS_URL}{personal.id}/").status_code, 404)
        self.assertEqual(
            self.client.get(f"{IPS_URL}{personal.id}/characters/").status_code, 404
        )

    def test_owner_can_retrieve_personal_ip(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        self.as_user(self.alice)
        response = self.client.get(f"{IPS_URL}{personal.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user_id"], self.alice.id)

    def test_admin_sees_everything(self):
        IP.objects.create(name="爱丽丝作品", user=self.alice)
        IP.objects.create(name="鲍勃作品", user=self.bob)
        self.as_user(self.admin)
        names = {item["name"] for item in self.client.get(IPS_URL).data}
        self.assertEqual(names, {"官方作品", "爱丽丝作品", "鲍勃作品"})

    def test_search_does_not_leak_personal_ips(self):
        IP.objects.create(name="爱丽丝限定作品", user=self.alice)
        self.as_user(self.bob)
        response = self.client.get(IPS_URL, {"search": "爱丽丝限定"})
        self.assertEqual(response.data, [])


class IPWritePermissionTests(PersonalIPTestBase):
    def test_collector_cannot_modify_official_ip(self):
        self.as_user(self.alice)
        response = self.client.patch(
            f"{IPS_URL}{self.official.id}/", {"name": "改名"}, format="json"
        )
        self.assertEqual(response.status_code, 403)
        self.official.refresh_from_db()
        self.assertEqual(self.official.name, "官方作品")

    def test_collector_cannot_delete_official_ip(self):
        self.as_user(self.alice)
        self.assertEqual(
            self.client.delete(f"{IPS_URL}{self.official.id}/").status_code, 403
        )
        self.assertTrue(IP.objects.filter(pk=self.official.pk).exists())

    def test_collector_can_update_and_delete_own_ip(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        self.as_user(self.alice)
        patched = self.client.patch(
            f"{IPS_URL}{personal.id}/",
            {"name": "爱丽丝作品二", "subject_type": 2},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        personal.refresh_from_db()
        self.assertEqual(personal.name, "爱丽丝作品二")

        self.assertEqual(
            self.client.delete(f"{IPS_URL}{personal.id}/").status_code, 204
        )
        self.assertFalse(IP.objects.filter(pk=personal.pk).exists())

    def test_collector_cannot_touch_other_users_personal_ip(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        self.as_user(self.bob)
        self.assertEqual(
            self.client.patch(
                f"{IPS_URL}{personal.id}/", {"name": "偷改"}, format="json"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(f"{IPS_URL}{personal.id}/").status_code, 404
        )

    def test_admin_can_modify_personal_and_official_ips(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        self.as_user(self.admin)
        self.assertEqual(
            self.client.patch(
                f"{IPS_URL}{personal.id}/", {"name": "管理员改名"}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.patch(
                f"{IPS_URL}{self.official.id}/", {"name": "官方改名"}, format="json"
            ).status_code,
            200,
        )

    def test_club_account_cannot_create_ip(self):
        self.as_user(self.club)
        response = self.client.post(IPS_URL, {"name": "社团作品"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_create_or_list(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(
            self.client.post(IPS_URL, {"name": "匿名作品"}, format="json").status_code,
            403,
        )
        self.assertEqual(self.client.get(IPS_URL).status_code, 403)

    def test_drag_order_endpoint_stays_admin_only(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        self.as_user(self.alice)
        response = self.client.post(
            f"{IPS_URL}batch-update-order/",
            {"items": [{"id": personal.id, "order": 5}]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


class IPNameAndBGMBindingTests(PersonalIPTestBase):
    def test_personal_ip_cannot_shadow_official_name(self):
        response = self.create_ip(self.alice, "官方作品")
        self.assertEqual(response.status_code, 400)
        self.assertIn("已存在同名官方 IP", str(response.data))
        self.assertEqual(IP.objects.filter(name="官方作品").count(), 1)

    def test_same_owner_cannot_repeat_name(self):
        self.assertEqual(self.create_ip(self.alice, "重名作品").status_code, 201)
        second = self.create_ip(self.alice, "重名作品")
        self.assertEqual(second.status_code, 400)
        self.assertIn("你已创建过同名作品", str(second.data))

    def test_different_owners_can_use_same_name(self):
        self.assertEqual(self.create_ip(self.alice, "同名作品").status_code, 201)
        self.assertEqual(self.create_ip(self.bob, "同名作品").status_code, 201)
        self.assertEqual(IP.objects.filter(name="同名作品").count(), 2)

    def test_two_users_can_bind_same_bgm_subject(self):
        IP.objects.filter(pk=self.official.pk).update(bgm_subject_id=4242)

        alice_ip = IP.objects.create(name="爱丽丝作品", user=self.alice)
        bob_ip = IP.objects.create(name="鲍勃作品", user=self.bob)
        # 个人域按用户唯一：同一 subject 可以被多个用户各自绑定
        alice_ip.bgm_subject_id = 4242
        alice_ip.save(update_fields=["bgm_subject_id"])
        bob_ip.bgm_subject_id = 4242
        bob_ip.save(update_fields=["bgm_subject_id"])

        self.assertEqual(
            IP.objects.filter(bgm_subject_id=4242).count(),
            3,
        )

    def test_bgm_subject_still_unique_inside_official_domain(self):
        from django.db import IntegrityError, transaction

        self.official.bgm_subject_id = 777
        self.official.save(update_fields=["bgm_subject_id"])
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                IP.objects.create(name="官方作品二", bgm_subject_id=777)


class IPDeleteGuardTests(PersonalIPTestBase):
    def test_delete_ip_with_goods_returns_409(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        category = Category.objects.create(name="吧唧")
        Goods.objects.create(
            name="爱丽丝谷子", user=self.alice, ip=personal, category=category
        )

        self.as_user(self.alice)
        response = self.client.delete(f"{IPS_URL}{personal.id}/")
        self.assertEqual(response.status_code, 409)
        self.assertIn("1 件谷子", response.data["detail"])
        self.assertTrue(IP.objects.filter(pk=personal.pk).exists())

    def test_delete_ip_without_goods_succeeds(self):
        personal = IP.objects.create(name="空作品", user=self.alice)
        Character.objects.create(ip=personal, name="空角色")
        self.as_user(self.alice)
        self.assertEqual(
            self.client.delete(f"{IPS_URL}{personal.id}/").status_code, 204
        )
        self.assertFalse(Character.objects.filter(ip_id=personal.pk).exists())


class CharacterScopeTests(PersonalIPTestBase):
    def test_collector_can_create_character_under_own_ip(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        self.as_user(self.alice)
        response = self.client.post(
            CHARACTERS_URL,
            {"name": "爱丽丝角色", "ip_id": personal.id, "gender": "female"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(
            Character.objects.filter(ip=personal, name="爱丽丝角色").exists()
        )

    def test_collector_cannot_create_character_under_official_ip(self):
        self.as_user(self.alice)
        response = self.client.post(
            CHARACTERS_URL,
            {"name": "越权角色", "ip_id": self.official.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Character.objects.filter(name="越权角色").exists())

    def test_collector_cannot_create_character_under_other_personal_ip(self):
        personal = IP.objects.create(name="鲍勃作品", user=self.bob)
        self.as_user(self.alice)
        response = self.client.post(
            CHARACTERS_URL,
            {"name": "越权角色", "ip_id": personal.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Character.objects.filter(name="越权角色").exists())

    def test_character_list_excludes_other_users_private_characters(self):
        own = IP.objects.create(name="爱丽丝作品", user=self.alice)
        other = IP.objects.create(name="鲍勃作品", user=self.bob)
        Character.objects.create(ip=own, name="爱丽丝角色")
        Character.objects.create(ip=other, name="鲍勃角色")
        Character.objects.create(ip=self.official, name="官方角色")

        self.as_user(self.alice)
        names = {item["name"] for item in self.client.get(CHARACTERS_URL).data}
        self.assertEqual(names, {"爱丽丝角色", "官方角色"})

    def test_collector_cannot_delete_official_character(self):
        official_character = Character.objects.create(ip=self.official, name="官方角色")
        self.as_user(self.alice)
        response = self.client.delete(f"{CHARACTERS_URL}{official_character.id}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Character.objects.filter(pk=official_character.pk).exists())

    def test_collector_can_delete_own_character(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        own_character = Character.objects.create(ip=personal, name="爱丽丝角色")
        self.as_user(self.alice)
        self.assertEqual(
            self.client.delete(f"{CHARACTERS_URL}{own_character.id}/").status_code,
            204,
        )
        self.assertFalse(Character.objects.filter(pk=own_character.pk).exists())

    def test_collector_cannot_move_character_into_official_ip(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        own_character = Character.objects.create(ip=personal, name="爱丽丝角色")
        self.as_user(self.alice)
        response = self.client.patch(
            f"{CHARACTERS_URL}{own_character.id}/",
            {"name": "爱丽丝角色", "ip_id": self.official.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        own_character.refresh_from_db()
        self.assertEqual(own_character.ip_id, personal.id)

    def test_other_users_character_is_404(self):
        other = IP.objects.create(name="鲍勃作品", user=self.bob)
        other_character = Character.objects.create(ip=other, name="鲍勃角色")
        self.as_user(self.alice)
        self.assertEqual(
            self.client.get(f"{CHARACTERS_URL}{other_character.id}/").status_code, 404
        )
        self.assertEqual(
            self.client.get(f"{CHARACTERS_URL}{other_character.id}/stats/").status_code,
            404,
        )


class StatsScopingTests(PersonalIPTestBase):
    def test_platform_heat_ignores_personal_ips(self):
        category = Category.objects.create(name="吧唧")
        official_character = Character.objects.create(ip=self.official, name="官方角色")
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        personal_character = Character.objects.create(ip=personal, name="爱丽丝角色")
        Goods.objects.create(
            name="官方谷子", user=self.alice, ip=self.official, category=category
        )
        Goods.objects.create(
            name="个人谷子", user=self.alice, ip=personal, category=category
        )

        self.as_user(self.alice)
        official_stats = self.client.get(
            f"{CHARACTERS_URL}{official_character.id}/stats/"
        )
        self.assertEqual(official_stats.status_code, 200)
        self.assertEqual(official_stats.data["ip_heat"]["platform_heat"]["total_ips"], 1)

        personal_stats = self.client.get(
            f"{CHARACTERS_URL}{personal_character.id}/stats/"
        )
        self.assertEqual(personal_stats.status_code, 200)
        # 个人 IP 只出现在"我的热度"里，平台上没有任何对手
        self.assertEqual(personal_stats.data["ip_heat"]["platform_heat"]["total_ips"], 1)
        self.assertEqual(personal_stats.data["ip_heat"]["my_heat"]["total_ips"], 2)


class PersonalBGMTokenUsageTests(PersonalIPTestBase):
    def _search_subjects(self, user, keyword="崩坏"):
        self.as_user(user)
        return self.client.post(
            "/api/bgm/search-subjects/", {"keyword": keyword}, format="json"
        )

    def test_search_requires_personal_token_for_collector(self):
        response = self._search_subjects(self.alice)
        self.assertEqual(response.status_code, 400)
        self.assertIn("请先在个人中心", response.data["detail"])
        self.assertEqual(response.data.get("code"), "bgm_token_missing")

    @mock.patch("apps.goods.bgm_service.requests.get")
    def test_search_uses_own_token_in_authorization_header(self, mock_get):
        mock_get.return_value = _FakeResponse(
            {
                "list": [
                    {
                        "id": 100,
                        "name": "Honkai",
                        "name_cn": "崩坏",
                        "type": 4,
                        "images": {"large": "https://img/1.jpg"},
                    }
                ]
            }
        )
        User.objects.filter(pk=self.alice.pk).update(bgm_access_token="alice-token")
        self.alice.refresh_from_db()

        response = self._search_subjects(self.alice)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            mock_get.call_args.kwargs["headers"]["Authorization"], "Bearer alice-token"
        )

    @mock.patch("apps.goods.bgm_service.requests.get")
    def test_admin_without_personal_token_falls_back_to_server_token(self, mock_get):
        mock_get.return_value = _FakeResponse({"list": []})
        with mock.patch("apps.goods.bgm_service.ACCESS_TOKEN", "server-token"):
            response = self._search_subjects(self.admin)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            mock_get.call_args.kwargs["headers"]["Authorization"], "Bearer server-token"
        )

    @mock.patch("apps.goods.bgm_service.requests.post")
    def test_fetch_cover_uses_owner_token(self, mock_post):
        # 封面解析走 v0 搜索（POST /v0/search/subjects）
        mock_post.return_value = _FakeResponse({"data": []})
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        User.objects.filter(pk=self.alice.pk).update(bgm_access_token="alice-token")
        self.alice.refresh_from_db()

        self.as_user(self.alice)
        response = self.client.post(f"{IPS_URL}{personal.id}/fetch-cover/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            mock_post.call_args.kwargs["headers"]["Authorization"], "Bearer alice-token"
        )

    def test_fetch_cover_requires_token_for_collector(self):
        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        self.as_user(self.alice)
        response = self.client.post(f"{IPS_URL}{personal.id}/fetch-cover/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("code"), "bgm_token_missing")

    def test_collector_cannot_fetch_cover_of_official_ip(self):
        self.as_user(self.alice)
        response = self.client.post(f"{IPS_URL}{self.official.id}/fetch-cover/")
        self.assertEqual(response.status_code, 403)

    def test_collector_cannot_trigger_bgm_sync_on_official_ip(self):
        self.as_user(self.alice)
        response = self.client.post(
            f"{IPS_URL}{self.official.id}/bgm-preview/",
            {"subject_id": 123},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


class PersonalIPFeatureFlagTests(PersonalIPTestBase):
    @override_settings(PERSONAL_IP_ENABLED=False)
    def test_flag_off_hides_personal_ips_from_everyone(self):
        IP.objects.create(name="爱丽丝作品", user=self.alice)

        self.as_user(self.alice)
        names = {item["name"] for item in self.client.get(IPS_URL).data}
        self.assertEqual(names, {"官方作品"})

        self.as_user(self.admin)
        names = {item["name"] for item in self.client.get(IPS_URL).data}
        self.assertEqual(names, {"官方作品"})

    @override_settings(PERSONAL_IP_ENABLED=False)
    def test_flag_off_blocks_collector_writes(self):
        self.as_user(self.alice)
        response = self.client.post(IPS_URL, {"name": "关闭后作品"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(IP.objects.filter(name="关闭后作品").exists())

        personal = IP.objects.create(name="爱丽丝作品", user=self.alice)
        self.assertEqual(
            self.client.patch(
                f"{IPS_URL}{personal.id}/", {"name": "改不了"}, format="json"
            ).status_code,
            403,
        )

    @override_settings(PERSONAL_IP_ENABLED=False)
    def test_flag_off_keeps_admin_working(self):
        self.as_user(self.admin)
        response = self.client.post(IPS_URL, {"name": "官方新作品"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(IP.objects.get(name="官方新作品").user_id)


class PurgePersonalIPsCommandTests(PersonalIPTestBase):
    def setUp(self):
        super().setUp()
        self.alice_ip = IP.objects.create(name="爱丽丝作品", user=self.alice)
        self.bob_ip = IP.objects.create(name="鲍勃作品", user=self.bob)
        Character.objects.create(ip=self.alice_ip, name="爱丽丝角色")
        self.category = Category.objects.create(name="吧唧")
        Goods.objects.create(
            name="鲍勃谷子", user=self.bob, ip=self.bob_ip, category=self.category
        )

    def _run(self, *args, **kwargs):
        from io import StringIO

        out = StringIO()
        call_command("purge_personal_ips", *args, stdout=out, **kwargs)
        return out.getvalue()

    def test_dry_run_does_not_delete(self):
        output = self._run()
        self.assertIn("[干跑]", output)
        self.assertEqual(IP.objects.filter(user__isnull=False).count(), 2)
        self.assertTrue(IP.objects.filter(pk=self.alice_ip.pk).exists())

    def test_apply_skips_ips_with_goods(self):
        self._run("--apply")
        self.assertFalse(IP.objects.filter(pk=self.alice_ip.pk).exists())
        self.assertTrue(IP.objects.filter(pk=self.bob_ip.pk).exists())

    def test_reassign_moves_goods_then_deletes(self):
        self._run("--apply", "--reassign", self.official.id)
        self.assertFalse(IP.objects.filter(user__isnull=False).exists())
        self.assertEqual(
            Goods.objects.filter(ip=self.official).count(), 1
        )

    def test_apply_is_idempotent(self):
        self._run("--apply", "--delete-goods")
        self.assertEqual(IP.objects.filter(user__isnull=False).count(), 0)
        output = self._run("--apply")
        self.assertIn("没有个人 IP", output)

    def test_reassign_requires_official_target(self):
        from django.core.management.base import CommandError

        with self.assertRaises(CommandError):
            self._run("--apply", "--reassign", self.alice_ip.id)
