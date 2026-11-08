"""安全事件审计测试：认证埋点、异常处理器、Django Admin 桥接。"""

from __future__ import annotations

from types import SimpleNamespace

from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory, TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.admin_api.models import AdminAuditLog
from apps.users.models import Role, User


class AuthEventAuditTestCase(TestCase):
    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(
            username="audit_login_user",
            role=self.user_role,
            is_active=True,
        )
        self.user.set_password("correctpass")
        self.user.save()
        self.client = APIClient()

    def _security_logs(self, action: str):
        return AdminAuditLog.objects.filter(
            log_type=AdminAuditLog.LOG_TYPE_SECURITY, action=action
        )

    def test_successful_login_is_recorded(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "audit_login_user", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = self._security_logs("auth.login").latest("id")
        self.assertEqual(log.outcome, AdminAuditLog.OUTCOME_SUCCESS)
        self.assertEqual(log.actor_id, self.user.pk)
        self.assertEqual(log.status_code, 200)

    def test_wrong_password_records_failure_without_leaking_password(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "audit_login_user", "password": "wrongpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        log = self._security_logs("auth.login").latest("id")
        self.assertEqual(log.outcome, AdminAuditLog.OUTCOME_FAILURE)
        self.assertEqual(log.changes["reason"], "bad_credentials")
        self.assertNotIn("wrongpass", str(log.changes))

    def test_unknown_username_is_recorded_with_snapshot_name(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "ghost_user", "password": "whatever"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        log = self._security_logs("auth.login").latest("id")
        self.assertIsNone(log.actor_id)
        self.assertEqual(log.actor_username, "ghost_user")

    def test_inactive_account_records_failure(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        response = self.client.post(
            "/api/auth/login/",
            {"username": "audit_login_user", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        log = self._security_logs("auth.login").latest("id")
        self.assertEqual(log.changes["reason"], "inactive")
        self.assertEqual(log.status_code, 403)

    def test_pending_club_account_records_failure(self):
        club = User.objects.create(
            username="pending_club",
            role=self.user_role,
            is_active=True,
            account_type=User.ACCOUNT_TYPE_CLUB,
            approval_status=User.APPROVAL_PENDING,
        )
        club.set_password("correctpass")
        club.save()
        response = self.client.post(
            "/api/auth/login/",
            {"username": "pending_club", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        log = self._security_logs("auth.login").latest("id")
        self.assertEqual(log.changes["reason"], "pending_approval")

    def test_logout_is_recorded(self):
        self.client.force_authenticate(self.user)
        response = self.client.delete("/api/auth/logout/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self._security_logs("auth.logout").count(), 1)

    def test_password_change_is_recorded(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            "/api/auth/me/",
            {"current_password": "correctpass", "new_password": "brandnewpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = self._security_logs("auth.password_change").latest("id")
        self.assertTrue(log.changes["revoked_tokens"])
        self.assertNotIn("brandnewpass", str(log.changes))

    def test_username_change_is_recorded(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            "/api/auth/me/",
            {"username": "renamed_user", "current_password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = self._security_logs("auth.username_change").latest("id")
        self.assertEqual(log.changes["before"]["username"], "audit_login_user")
        self.assertEqual(log.changes["after"]["username"], "renamed_user")


class PermissionDeniedAuditTestCase(TestCase):
    def setUp(self):
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.plain = User.objects.create(
            username="plain_denied", role=self.user_role, is_active=True
        )
        self.client = APIClient()

    def test_non_admin_hitting_admin_api_is_recorded(self):
        self.client.force_authenticate(self.plain)
        response = self.client.get("/api/admin/audit-logs/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        log = AdminAuditLog.objects.filter(
            log_type=AdminAuditLog.LOG_TYPE_SECURITY,
            action="security.permission_denied",
        ).latest("id")
        self.assertEqual(log.outcome, AdminAuditLog.OUTCOME_FAILURE)
        self.assertEqual(log.status_code, 403)
        self.assertEqual(log.path, "/api/admin/audit-logs/")
        self.assertEqual(log.actor_id, self.plain.pk)

    def test_unauthenticated_request_is_recorded(self):
        response = self.client.get("/api/goods/")
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
        expected = (
            "security.unauthenticated"
            if response.status_code == 401
            else "security.permission_denied"
        )
        self.assertTrue(
            AdminAuditLog.objects.filter(
                log_type=AdminAuditLog.LOG_TYPE_SECURITY,
                action=expected,
            ).exists()
        )

    def test_exception_handler_never_breaks_response(self):
        from unittest.mock import patch

        with patch(
            "apps.admin_api.services.record_security_event",
            side_effect=RuntimeError("audit down"),
        ):
            self.client.force_authenticate(self.plain)
            response = self.client.get("/api/admin/audit-logs/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class DjangoAdminBridgeTestCase(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_admin_site_log_change_creates_audit_row(self):
        from django.contrib.admin.options import ModelAdmin
        from django.contrib.auth.models import User as DjangoUser

        from apps.admin_api.admin import AdminAuditLogAdmin

        # /admin/ 用的是 auth.User，需要真实行才能写入 django_admin_log
        django_user = DjangoUser.objects.create_superuser(
            username="django_superuser", password="x", email="a@example.com"
        )

        site = AdminSite()
        model_admin = AdminAuditLogAdmin(AdminAuditLog, site)
        request = self.factory.post("/admin/")
        request.user = django_user

        target = SimpleNamespace(pk=7, _meta=SimpleNamespace(
            app_label="goods", model_name="goods", verbose_name="谷子"
        ))
        target.__str__ = lambda: "测试谷子"

        ModelAdmin.log_change(model_admin, request, target, "修改了名称")

        log = AdminAuditLog.objects.filter(
            resource_type="django_admin", action="django_admin.change"
        ).latest("id")
        self.assertIsNone(log.actor_id)
        self.assertEqual(log.actor_username, "django_superuser")
        self.assertEqual(log.resource_id, "7")
        self.assertIn("goods.goods", log.changes["model"])
