from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from types import SimpleNamespace

from apps.goods.models import Category, Character, Goods, GoodsCraft, IP
from apps.users.models import Role, User

from .models import AdminAuditLog, AdminAuditRetry
from .services import (
    purge_admin_audit_logs,
    record_admin_action,
    retry_admin_audit_queue,
)


class AdminUserViewSetTestCase(TestCase):
    """admin_api — AdminUserViewSet CRUD + 权限"""

    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(
            username="admin1", role=self.admin_role, is_active=True
        )
        self.admin.set_password("adminpass")
        self.admin.save()
        self.normal_user = User.objects.create(
            username="normal1", role=self.user_role, is_active=True
        )
        self.normal_user.set_password("userpass")
        self.normal_user.save()
        self.client = APIClient()

    def test_normal_user_cannot_list_users(self):
        self.client.force_authenticate(user=self.normal_user)
        response = self.client.get("/api/admin/users/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_users(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        self.assertGreaterEqual(len(items), 2)

    def test_admin_can_create_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/admin/users/",
            {
                "username": "newuser",
                "password": "newpass123",
                "role_id": self.user_role.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["username"], "newuser")
        self.assertNotIn("password", data)  # password not exposed

    def test_admin_can_create_goods_for_selected_collector(self):
        ip = IP.objects.create(name="Admin Create IP")
        category = Category.objects.create(
            name="Admin Create Category",
            path_name="Admin Create Category",
        )
        character = Character.objects.create(name="Admin Create Character", ip=ip)
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            "/api/goods/",
            {
                "name": "Admin assigned goods",
                "user_id": self.normal_user.id,
                "ip_id": ip.id,
                "category_id": category.id,
                "character_ids": [character.id],
                "quantity": 1,
                "status": "in_cabinet",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Goods.objects.filter(
                name="Admin assigned goods",
                user=self.normal_user,
            ).exists()
        )

    def test_admin_create_duplicate_username(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/admin/users/",
            {
                "username": "normal1",  # already exists
                "password": "newpass123",
                "role_id": self.user_role.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_retrieve_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/admin/users/{self.normal_user.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["username"], "normal1")

    def test_admin_can_update_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/admin/users/{self.normal_user.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.normal_user.refresh_from_db()
        self.assertFalse(self.normal_user.is_active)

    def test_admin_can_update_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/admin/users/{self.normal_user.id}/",
            {"password": "newsecurepass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.normal_user.refresh_from_db()
        self.assertTrue(self.normal_user.check_password("newsecurepass"))

    def test_unauthenticated_cannot_access(self):
        response = self.client.get("/api/admin/users/")
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )


class AdminRoleViewSetTestCase(TestCase):
    """admin_api — AdminRoleViewSet"""

    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(
            username="adminrole", role=self.admin_role, is_active=True
        )
        self.client = APIClient()

    def test_admin_can_list_roles(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/roles/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        role_names = {r["name"] for r in items}
        self.assertIn("Admin", role_names)
        self.assertIn("User", role_names)

    def test_normal_user_cannot_list_roles(self):
        normal = User.objects.create(
            username="norole", role=self.user_role, is_active=True
        )
        self.client.force_authenticate(user=normal)
        response = self.client.get("/api/admin/roles/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AdminGoodsCraftViewSetTestCase(TestCase):
    """admin_api - GoodsCraft CRUD + permissions"""

    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(
            username="craft_admin", role=self.admin_role, is_active=True
        )
        self.normal_user = User.objects.create(
            username="craft_user", role=self.user_role, is_active=True
        )
        self.client = APIClient()

    def test_normal_user_cannot_list_goods_crafts(self):
        self.client.force_authenticate(user=self.normal_user)
        response = self.client.get("/api/admin/goods-crafts/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_access_goods_crafts(self):
        response = self.client.get("/api/admin/goods-crafts/")
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_admin_can_create_goods_craft(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/admin/goods-crafts/",
            {"name": "烫金", "order": 20, "is_active": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["name"], "烫金")
        self.assertEqual(data["order"], 20)
        self.assertTrue(data["is_active"])
        self.assertTrue(GoodsCraft.objects.filter(name="烫金").exists())

    def test_admin_can_search_update_and_delete_goods_craft(self):
        GoodsCraft.objects.create(name="镭射", order=30)
        craft = GoodsCraft.objects.create(name="烫银", order=10)
        self.client.force_authenticate(user=self.admin)

        search_response = self.client.get("/api/admin/goods-crafts/?search=烫")
        self.assertEqual(search_response.status_code, status.HTTP_200_OK)
        results = search_response.json()["results"]
        self.assertEqual([item["name"] for item in results], ["烫银"])

        update_response = self.client.patch(
            f"/api/admin/goods-crafts/{craft.id}/",
            {"name": "烫金", "order": 5, "is_active": False},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        craft.refresh_from_db()
        self.assertEqual(craft.name, "烫金")
        self.assertEqual(craft.order, 5)
        self.assertFalse(craft.is_active)

        delete_response = self.client.delete(f"/api/admin/goods-crafts/{craft.id}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(GoodsCraft.objects.filter(id=craft.id).exists())

    def test_admin_rejects_blank_and_duplicate_goods_craft_names(self):
        GoodsCraft.objects.create(name="珠光")
        self.client.force_authenticate(user=self.admin)

        blank_response = self.client.post(
            "/api/admin/goods-crafts/",
            {"name": "   "},
            format="json",
        )
        self.assertEqual(blank_response.status_code, status.HTTP_400_BAD_REQUEST)

        duplicate_response = self.client.post(
            "/api/admin/goods-crafts/",
            {"name": "珠光"},
            format="json",
        )
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)


class AdminOverviewAndAuditTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(
            username="overview_admin",
            role=self.admin_role,
            is_active=True,
        )
        self.user = User.objects.create(
            username="overview_user",
            role=self.user_role,
            is_active=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_overview_returns_operational_stats_and_audit(self):
        ip = IP.objects.create(name="Overview IP")
        category = Category.objects.create(name="Overview Category", path_name="Overview Category")
        goods = Goods.objects.create(
            name="Overview goods",
            user=self.user,
            ip=ip,
            category=category,
            status="in_cabinet",
        )
        record_admin_action(
            SimpleNamespace(user=self.admin, META={}),
            action="test.manual",
            resource_type="test",
            resource_id=1,
            summary="manual audit",
        )
        response = self.client.get("/api/admin/overview/?range=30d")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertGreaterEqual(payload["stats"]["users"]["total"], 2)
        self.assertGreaterEqual(payload["stats"]["goods"]["total"], 1)
        self.assertEqual(payload["recent_audits"][0]["summary"], "manual audit")

    def test_audit_log_filters_and_non_admin_permission(self):
        AdminAuditLog.objects.create(
            actor=self.admin,
            action="user.update",
            resource_type="user",
            resource_id=str(self.user.pk),
            summary="update user",
            changes={"is_active": False},
        )
        response = self.client.get("/api/admin/audit-logs/?action=user.update")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 1)

        self.client.force_authenticate(self.user)
        denied = self.client.get("/api/admin/audit-logs/")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_audit_sanitizes_sensitive_values(self):
        record_admin_action(
            SimpleNamespace(user=self.admin, META={}),
            action="user.update",
            resource_type="user",
            resource_id=self.user.pk,
            summary="password update",
            changes={"password": "secret", "nested": {"token": "abc"}},
        )
        latest = AdminAuditLog.objects.latest("id")
        self.assertEqual(latest.changes["password"], "[REDACTED]")
        self.assertEqual(latest.changes["nested"]["token"], "[REDACTED]")

    def test_audit_failure_is_queued_and_retried(self):
        with patch.object(
            AdminAuditLog.objects,
            "create",
            side_effect=RuntimeError("audit unavailable"),
        ):
            record_admin_action(
                SimpleNamespace(user=self.admin, META={}),
                action="user.update",
                resource_type="user",
                resource_id=self.user.pk,
                summary="queued audit",
                changes={"safe": "value"},
            )

        task = AdminAuditRetry.objects.get(resolved_at__isnull=True)
        self.assertEqual(task.attempts, 0)
        self.assertEqual(task.payload["summary"], "queued audit")
        self.assertEqual(retry_admin_audit_queue(), 1)
        task.refresh_from_db()
        self.assertIsNotNone(task.resolved_at)
        self.assertTrue(
            AdminAuditLog.objects.filter(summary="queued audit").exists()
        )
        task.resolved_at = None
        task.save(update_fields=["resolved_at", "updated_at"])
        self.assertEqual(retry_admin_audit_queue(), 1)
        self.assertEqual(
            AdminAuditLog.objects.filter(summary="queued audit").count(),
            1,
        )

    def test_audit_retention_cleanup(self):
        old = AdminAuditLog.objects.create(
            actor=self.admin,
            action="old.action",
            resource_type="test",
            summary="old",
        )
        AdminAuditLog.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=366)
        )
        self.assertEqual(purge_admin_audit_logs(365), 1)


class AdminBulkActionTestCase(TestCase):
    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(
            username="bulk_admin",
            role=self.admin_role,
            is_active=True,
        )
        self.user = User.objects.create(
            username="bulk_user",
            role=self.user_role,
            is_active=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_bulk_user_disable_is_atomic_and_audited(self):
        response = self.client.post(
            "/api/admin/users/bulk-action/",
            {"ids": [self.user.pk], "action": "disable"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertTrue(
            AdminAuditLog.objects.filter(action="user.bulk_disable").exists()
        )

    def test_cannot_disable_self_or_last_admin(self):
        response = self.client.post(
            "/api/admin/users/bulk-action/",
            {"ids": [self.admin.pk], "action": "disable"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_bulk_goods_status(self):
        ip = IP.objects.create(name="Bulk IP")
        category = Category.objects.create(name="Bulk Category", path_name="Bulk Category")
        goods = Goods.objects.create(
            name="Bulk goods",
            user=self.user,
            ip=ip,
            category=category,
            status="in_cabinet",
        )
        response = self.client.post(
            "/api/admin/goods/bulk-action/",
            {
                "ids": [str(goods.pk)],
                "action": "status",
                "status": "sold",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        goods.refresh_from_db()
        self.assertEqual(goods.status, "sold")

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_bulk_goods_status_runs_gamification_lifecycle(self):
        from apps.gamification.models import (
            GamificationConfig,
            MetricEvent,
        )

        GamificationConfig.objects.create(
            pk=1,
            rollout_at=timezone.now() - timedelta(minutes=1),
        )
        ip = IP.objects.create(name="Bulk Gamification IP")
        category = Category.objects.create(
            name="Bulk Gamification Category",
            path_name="Bulk Gamification Category",
        )
        goods = Goods.objects.create(
            name="Bulk gamification goods",
            user=self.user,
            ip=ip,
            category=category,
            status="draft",
            quantity=2,
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/admin/goods/bulk-action/",
                {
                    "ids": [str(goods.pk)],
                    "action": "status",
                    "status": "in_cabinet",
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            MetricEvent.objects.filter(
                user=self.user,
                event_type=MetricEvent.EVENT_GOODS_QUANTITY,
            ).get().amount,
            Decimal("2.00"),
        )


class AdminExportTestCase(TestCase):
    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(
            username="export_admin",
            role=self.admin_role,
            is_active=True,
        )
        self.user = User.objects.create(
            username="=FORMULA",
            role=self.user_role,
            is_active=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_user_export_uses_bom_and_csv_injection_protection(self):
        response = self.client.get("/api/admin/exports/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = b"".join(response.streaming_content).decode("utf-8-sig")
        self.assertTrue(content.startswith("ID,用户名"))
        self.assertIn("'=FORMULA", content)
        self.assertTrue(
            AdminAuditLog.objects.filter(action="export.create").exists()
        )

    def test_unknown_export_resource_returns_404(self):
        response = self.client.get("/api/admin/exports/unknown/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_goods_craft_export_uses_list_filters(self):
        GoodsCraft.objects.create(
            name="Enabled Craft",
            is_active=True,
        )
        GoodsCraft.objects.create(
            name="Disabled Craft",
            is_active=False,
        )

        response = self.client.get(
            "/api/admin/exports/goods-crafts/?is_active=false"
        )
        content = b"".join(response.streaming_content).decode("utf-8-sig")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Disabled Craft", content)
        self.assertNotIn("Enabled Craft", content)

    def test_export_rejects_more_than_limit(self):
        from unittest.mock import patch

        with patch("apps.admin_api.exports.EXPORT_MAX_ROWS", 1):
            response = self.client.get("/api/admin/exports/users/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
