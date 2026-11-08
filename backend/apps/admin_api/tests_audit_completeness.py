"""操作日志完整性测试：只追加语义、新字段、过滤与安全事件。"""

from __future__ import annotations

from types import SimpleNamespace

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.admin_api.models import AdminAuditLog
from apps.admin_api.services import (
    audit_admin_action,
    normalize_resource_ids,
    record_admin_action,
    record_security_event,
)
from apps.users.models import Role, User


def _request(user=None, *, path="/api/test/", method="POST", meta=None):
    payload = {"REMOTE_ADDR": "127.0.0.1"}
    payload.update(meta or {})
    return SimpleNamespace(user=user, META=payload, path=path, method=method)


class AppendOnlyAuditTestCase(TestCase):
    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="Admin")
        self.admin = User.objects.create(
            username="append_admin", role=self.role, is_active=True
        )

    def test_queryset_update_and_delete_are_rejected(self):
        log = record_admin_action(
            _request(self.admin),
            action="test.create",
            resource_type="test",
            resource_id=1,
            summary="create",
        )
        with self.assertRaises(RuntimeError):
            AdminAuditLog.objects.filter(pk=log.pk).update(summary="tampered")
        with self.assertRaises(RuntimeError):
            AdminAuditLog.objects.filter(pk=log.pk).delete()
        with self.assertRaises(RuntimeError):
            log.delete()
        with self.assertRaises(RuntimeError):
            log.summary = "tampered"
            log.save()

        # all_objects 仍可用于保留期清理等维护操作
        self.assertEqual(AdminAuditLog.all_objects.filter(pk=log.pk).count(), 1)
        AdminAuditLog.all_objects.filter(pk=log.pk).update(summary="maintenance")
        log.refresh_from_db()
        self.assertEqual(log.summary, "maintenance")

    def test_admin_site_cannot_delete_audit_rows(self):
        from django.contrib.admin.sites import site

        model_admin = site._registry[AdminAuditLog]
        self.assertFalse(model_admin.has_add_permission(_request(self.admin)))
        self.assertFalse(model_admin.has_change_permission(_request(self.admin)))
        self.assertFalse(model_admin.has_delete_permission(_request(self.admin)))


class AuditRichContextTestCase(TestCase):
    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="Admin")
        self.admin = User.objects.create(
            username="context_admin", role=self.role, is_active=True
        )
        self.subject = User.objects.create(
            username="context_subject", role=self.role, is_active=True
        )

    def test_record_captures_request_context_and_snapshot_username(self):
        log = record_admin_action(
            _request(
                self.admin,
                path="/api/admin/users/2/",
                method="PATCH",
                meta={
                    "HTTP_X_REQUEST_ID": "req-123",
                    "HTTP_USER_AGENT": "pytest-agent",
                },
            ),
            action="user.update",
            resource_type="user",
            resource_id=self.subject.pk,
            summary="更新用户",
            changes={"is_active": False},
            subject_user=self.subject,
        )
        log.refresh_from_db()
        self.assertEqual(log.actor_username, "context_admin")
        self.assertEqual(log.subject_user_id, self.subject.pk)
        self.assertEqual(log.http_method, "PATCH")
        self.assertEqual(log.path, "/api/admin/users/2/")
        self.assertEqual(log.request_id, "req-123")
        self.assertEqual(log.user_agent, "pytest-agent")
        self.assertEqual(log.ip_address, "127.0.0.1")
        self.assertEqual(log.log_type, AdminAuditLog.LOG_TYPE_BUSINESS)
        self.assertEqual(log.outcome, AdminAuditLog.OUTCOME_SUCCESS)

    def test_actor_username_survives_actor_deletion(self):
        log = record_admin_action(
            _request(self.admin),
            action="user.update",
            resource_type="user",
            resource_id=1,
            summary="快照测试",
        )
        self.admin.delete()
        log.refresh_from_db()
        self.assertIsNone(log.actor_id)
        self.assertEqual(log.actor_username, "context_admin")

    def test_normalize_resource_ids(self):
        self.assertEqual(normalize_resource_ids([1, 2, 3]), ",1,2,3,")
        self.assertEqual(normalize_resource_ids(["1", "1", " 2 "]), ",1,2,")
        self.assertEqual(normalize_resource_ids([]), "")
        self.assertEqual(normalize_resource_ids(None), "")
        # 幂等：已规范化的字符串再次传入不会按字符拆分
        self.assertEqual(normalize_resource_ids(",1,2,3,"), ",1,2,3,")

    def test_sensitive_keys_are_redacted_but_filenames_are_kept(self):
        log = record_admin_action(
            _request(self.admin),
            action="goods.image_upload",
            resource_type="goods",
            resource_id="g-1",
            summary="上传主图",
            changes={
                "filename": "cover.jpg",
                "avatar": "users/avatars/a.png",
                "password": "secret",
                "nested": {"csrf_token": "abc", "count": 2},
            },
        )
        log.refresh_from_db()
        self.assertEqual(log.changes["filename"], "cover.jpg")
        self.assertEqual(log.changes["avatar"], "users/avatars/a.png")
        self.assertEqual(log.changes["password"], "[REDACTED]")
        self.assertEqual(log.changes["nested"]["csrf_token"], "[REDACTED]")
        self.assertEqual(log.changes["nested"]["count"], 2)

    def test_audit_admin_action_skips_non_admin(self):
        plain_role, _ = Role.objects.get_or_create(name="User")
        plain = User.objects.create(
            username="plain_user", role=plain_role, is_active=True
        )
        result = audit_admin_action(
            _request(plain),
            action="location.node_create",
            resource_type="location",
            resource_id=1,
            summary="普通用户操作",
        )
        self.assertIsNone(result)
        self.assertEqual(AdminAuditLog.objects.count(), 0)

    def test_security_event_is_tagged(self):
        log = record_security_event(
            _request(None),
            action="auth.login",
            summary="登录失败",
            actor_username="ghost",
            changes={"reason": "bad_credentials"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        log.refresh_from_db()
        self.assertEqual(log.log_type, AdminAuditLog.LOG_TYPE_SECURITY)
        self.assertEqual(log.outcome, AdminAuditLog.OUTCOME_FAILURE)
        self.assertEqual(log.actor_username, "ghost")
        self.assertIsNone(log.actor_id)
        self.assertEqual(log.status_code, 400)


class AuditQueryApiTestCase(TestCase):
    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="Admin")
        self.admin = User.objects.create(
            username="query_admin", role=self.role, is_active=True
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_related_resource_matches_bulk_resource_ids(self):
        record_admin_action(
            _request(self.admin),
            action="goods.bulk_status",
            resource_type="goods",
            resource_id=None,
            summary="批量修改谷子",
            changes={"ids": ["g-1", "g-2"]},
            resource_ids=normalize_resource_ids(["g-1", "g-2"]),
        )
        record_admin_action(
            _request(self.admin),
            action="goods.update",
            resource_type="goods",
            resource_id="g-3",
            summary="单条更新",
        )

        bulk = self.client.get("/api/admin/audit-logs/?related_resource=g-2")
        self.assertEqual(bulk.status_code, status.HTTP_200_OK)
        self.assertEqual(bulk.json()["count"], 1)

        single = self.client.get("/api/admin/audit-logs/?related_resource=g-3")
        self.assertEqual(single.json()["count"], 1)

        # 子串不应误命中（g-1 不能匹配 g-10）
        record_admin_action(
            _request(self.admin),
            action="goods.update",
            resource_type="goods",
            resource_id="g-10",
            summary="另一条",
        )
        exact = self.client.get("/api/admin/audit-logs/?related_resource=g-1")
        self.assertEqual(exact.json()["count"], 1)

    def test_log_type_and_outcome_filters(self):
        record_security_event(
            _request(self.admin),
            action="security.permission_denied",
            summary="越权",
            status_code=status.HTTP_403_FORBIDDEN,
        )
        record_admin_action(
            _request(self.admin),
            action="user.create",
            resource_type="user",
            resource_id=1,
            summary="创建用户",
        )

        security_only = self.client.get("/api/admin/audit-logs/?log_type=security")
        self.assertEqual(security_only.json()["count"], 1)

        failures = self.client.get("/api/admin/audit-logs/?outcome=failure")
        self.assertEqual(failures.json()["count"], 1)

    def test_serializer_exposes_new_fields(self):
        record_admin_action(
            _request(self.admin, path="/api/admin/users/", method="POST"),
            action="user.create",
            resource_type="user",
            resource_id=1,
            summary="创建用户",
            changes={"username": "new"},
        )
        payload = self.client.get("/api/admin/audit-logs/").json()["results"][0]
        for field in (
            "display_actor",
            "actor_username",
            "log_type",
            "outcome",
            "resource_ids",
            "http_method",
            "path",
            "status_code",
            "request_id",
            "user_agent",
            "subject_user_id",
            "subject_username",
        ):
            self.assertIn(field, payload)
        self.assertEqual(payload["display_actor"], "query_admin")
        self.assertEqual(payload["http_method"], "POST")

    def test_export_includes_new_columns(self):
        record_admin_action(
            _request(self.admin),
            action="user.create",
            resource_type="user",
            resource_id=1,
            summary="创建用户",
        )
        response = self.client.get("/api/admin/exports/audit-logs/")
        content = b"".join(response.streaming_content).decode("utf-8-sig")
        self.assertIn("类型", content)
        self.assertIn("结果", content)
        self.assertIn("归属用户", content)
        self.assertIn("请求路径", content)
