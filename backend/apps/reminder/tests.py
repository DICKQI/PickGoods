from __future__ import annotations

import datetime
from decimal import Decimal
from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.goods.models import Category, Character, Goods, IP, Theme
from apps.users.models import Role, User

from .models import Notification, Preorder
from .services import sync_due_notifications

# 测试用固定“今天”（所有边界用例围绕该日期）
TODAY = datetime.date(2026, 6, 1)


def make_user(username: str) -> User:
    role, _ = Role.objects.get_or_create(name="User")
    return User.objects.create(username=username, role=role)


def preorder_payload(**overrides) -> dict:
    payload = {
        "name": "流萤手办",
        "platform": "淘宝",
        "shop_name": "示例店",
        "order_no": "ORD-001",
        "deposit_amount": "100.00",
        "balance_amount": "50.00",
        "estimated_month": "2026-08-01",
        "notes": "预定款",
    }
    payload.update(overrides)
    return payload


class PreorderAPITestCase(TestCase):
    """预购 CRUD、鉴权与归属隔离。"""

    def setUp(self):
        self.user_a = make_user("preorder_user_a")
        self.user_b = make_user("preorder_user_b")
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)
        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)
        self.anon = APIClient()

    def test_list_requires_auth(self):
        response = self.anon.get("/api/preorders/")
        # 项目统一行为：无认证头时 DRF 将 NotAuthenticated 强转为 403
        # （与 /api/auth/me/、/api/location/nodes/ 等现有接口一致）
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_success_and_month_normalization(self):
        response = self.client_a.post(
            "/api/preorders/", preorder_payload(estimated_month="2026-08-15"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        data = response.json()
        self.assertEqual(data["name"], "流萤手办")
        self.assertEqual(data["status"], "pending")
        # 任意日期统一归一化为当月 1 日
        self.assertEqual(data["estimated_month"], "2026-08-01")
        self.assertEqual(Decimal(data["deposit_amount"]), Decimal("100.00"))
        self.assertIsNone(data["goods_id"])

    def test_create_validation_errors(self):
        # 缺名称
        response = self.client_a.post(
            "/api/preorders/", preorder_payload(name=""), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # 负定金
        response = self.client_a.post(
            "/api/preorders/", preorder_payload(deposit_amount="-1.00"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # 缺预计月份
        payload = preorder_payload()
        payload.pop("estimated_month")
        response = self.client_a.post("/api/preorders/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_isolation(self):
        created = self.client_a.post(
            "/api/preorders/", preorder_payload(), format="json"
        )
        preorder_id = created.json()["id"]
        # B 的列表看不到 A 的数据
        response = self.client_b.get("/api/preorders/")
        self.assertEqual(response.json()["count"], 0)
        # B 的详情 / 更新 / 删除均为 404
        self.assertEqual(
            self.client_b.get(f"/api/preorders/{preorder_id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client_b.patch(
                f"/api/preorders/{preorder_id}/", {"name": "hack"}, format="json"
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client_b.delete(f"/api/preorders/{preorder_id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_update_and_delete(self):
        created = self.client_a.post(
            "/api/preorders/", preorder_payload(), format="json"
        )
        preorder_id = created.json()["id"]
        response = self.client_a.patch(
            f"/api/preorders/{preorder_id}/", {"name": "改名手办"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["name"], "改名手办")

        # 状态字段在普通更新中只读：PATCH 携带 status 被忽略
        response = self.client_a.patch(
            f"/api/preorders/{preorder_id}/", {"status": "paid"}, format="json"
        )
        self.assertEqual(response.json()["status"], "pending")

        response = self.client_a.delete(f"/api/preorders/{preorder_id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Preorder.objects.count(), 0)

    def test_delete_cascades_notifications(self):
        preorder = Preorder.objects.create(
            user=self.user_a,
            name="级联手办",
            deposit_amount=Decimal("100.00"),
            estimated_month=datetime.date(2026, 6, 1),
        )
        Notification.objects.create(
            user=self.user_a,
            preorder=preorder,
            type=Notification.TYPE_DUE,
            title="《级联手办》已到补款期",
            message="请及时补款",
        )
        self.client_a.delete(f"/api/preorders/{preorder.id}/")
        self.assertEqual(Notification.objects.count(), 0)

    def test_list_status_filter_and_search(self):
        self.client_a.post("/api/preorders/", preorder_payload(name="AAA"), format="json")
        self.client_a.post(
            "/api/preorders/",
            preorder_payload(name="BBB", estimated_month="2026-05-01"),
            format="json",
        )
        # 默认按预计月份升序
        response = self.client_a.get("/api/preorders/")
        results = response.json()["results"]
        self.assertEqual([r["name"] for r in results], ["BBB", "AAA"])
        # 搜索
        response = self.client_a.get("/api/preorders/?search=AAA")
        self.assertEqual(response.json()["count"], 1)
        # 状态过滤
        preorder = Preorder.objects.get(name="BBB")
        preorder.status = Preorder.STATUS_PAID
        preorder.save(update_fields=["status", "updated_at"])
        response = self.client_a.get("/api/preorders/?status=paid")
        self.assertEqual(response.json()["count"], 1)


class PreorderStatsTestCase(TestCase):
    """预购统计概览：计数正确性、用户隔离与管理员语义。"""

    def setUp(self):
        self.user = make_user("stats_user")
        self.other = make_user("stats_other")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.other_client = APIClient()
        self.other_client.force_authenticate(user=self.other)
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.admin = User.objects.create(username="stats_admin", role=self.admin_role)
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)

    def _create(
        self,
        user,
        month: str,
        status: str = Preorder.STATUS_PENDING,
        deposit: str = "100.00",
        granularity: str = Preorder.GRANULARITY_MONTH,
    ):
        return Preorder.objects.create(
            user=user,
            name=f"统计-{month}",
            deposit_amount=Decimal(deposit),
            estimated_month=datetime.date.fromisoformat(month),
            status=status,
            time_granularity=granularity,
        )

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_stats_counts_and_ownership(self, _mocked):
        # 本人：2 待补款（其中 1 条本月到期、1 条本季到期）、1 已转正；他人 1 待补款不计入
        self._create(self.user, "2026-06-01")  # 月粒度，本月到期
        self._create(self.user, "2026-09-01", deposit="250.00")  # 普通待补款
        self._create(
            self.user,
            "2026-04-01",
            deposit="80.00",
            granularity=Preorder.GRANULARITY_QUARTER,
        )  # 季度粒度 Q2（季度首月 4 月），本季到期（ORM 直建需传季度首月）
        self._create(self.user, "2026-06-01", status=Preorder.STATUS_CONVERTED)
        self._create(self.other, "2026-06-01", deposit="999.00")

        response = self.client.get("/api/preorders/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {
                "pending_count": 3,
                "due_this_month": 1,
                "due_this_quarter": 1,
                "converted_count": 1,
                "total_pending_deposit": "430.00",
            },
        )

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_stats_excludes_non_pending_deposit_and_cancelled(self, _mocked):
        # 已转正 / 已取消的定金不计入待补款定金总额
        self._create(self.user, "2026-06-01", status=Preorder.STATUS_CONVERTED, deposit="500.00")
        self._create(self.user, "2026-06-01", status=Preorder.STATUS_CANCELLED, deposit="300.00")
        self._create(self.user, "2026-08-01", deposit="120.00")
        response = self.client.get("/api/preorders/stats/")
        data = response.json()
        self.assertEqual(data["pending_count"], 1)
        self.assertEqual(data["total_pending_deposit"], "120.00")

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_stats_empty_returns_zeros(self, _mocked):
        response = self.client.get("/api/preorders/stats/")
        self.assertEqual(
            response.json(),
            {
                "pending_count": 0,
                "due_this_month": 0,
                "due_this_quarter": 0,
                "converted_count": 0,
                "total_pending_deposit": "0.00",
            },
        )

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_stats_admin_sees_all_users(self, _mocked):
        self._create(self.user, "2026-06-01", deposit="100.00")
        self._create(self.other, "2026-06-01", deposit="200.00")
        response = self.admin_client.get("/api/preorders/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["pending_count"], 2)
        self.assertEqual(data["total_pending_deposit"], "300.00")

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_stats_requires_auth(self, _mocked):
        response = self.client.get("/api/preorders/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        anon = APIClient()
        response = anon.get("/api/preorders/stats/")
        # 项目统一行为：无认证头时 DRF 将 NotAuthenticated 强转为 403
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class PreorderStatusFlowTestCase(TestCase):
    """状态机：pending→paid（不可逆）、pending→cancelled、paid→converted。"""

    def setUp(self):
        self.user = make_user("status_flow_user")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.preorder = Preorder.objects.create(
            user=self.user,
            name="状态机手办",
            deposit_amount=Decimal("100.00"),
            estimated_month=datetime.date(2026, 6, 1),
        )

    def test_mark_paid_flow(self):
        response = self.client.post(f"/api/preorders/{self.preorder.id}/mark-paid/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.preorder.refresh_from_db()
        self.assertEqual(self.preorder.status, Preorder.STATUS_PAID)
        self.assertIsNotNone(self.preorder.paid_at)
        # 重复标记补款被拒（不可逆）
        response = self.client.post(f"/api/preorders/{self.preorder.id}/mark-paid/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_paid_cannot_cancel(self):
        self.preorder.status = Preorder.STATUS_PAID
        self.preorder.paid_at = timezone.now()
        self.preorder.save(update_fields=["status", "paid_at", "updated_at"])
        response = self.client.post(f"/api/preorders/{self.preorder.id}/cancel/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_flow(self):
        response = self.client.post(f"/api/preorders/{self.preorder.id}/cancel/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.preorder.refresh_from_db()
        self.assertEqual(self.preorder.status, Preorder.STATUS_CANCELLED)
        # 已取消不能再标记补款 / 转正
        self.assertEqual(
            self.client.post(f"/api/preorders/{self.preorder.id}/mark-paid/").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.post(
                f"/api/preorders/{self.preorder.id}/convert-to-goods/", {}, format="json"
            ).status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_convert_requires_paid(self):
        response = self.client.post(
            f"/api/preorders/{self.preorder.id}/convert-to-goods/", {}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_marks_reminders_stale_and_creates_cancelled_notification(self):
        with patch("django.utils.timezone.localdate", return_value=TODAY):
            # 先让系统生成一条 due 提醒
            sync_due_notifications(self.user)
        self.assertTrue(
            Notification.objects.filter(
                preorder=self.preorder, type=Notification.TYPE_DUE, is_stale=False
            ).exists()
        )
        self.client.post(f"/api/preorders/{self.preorder.id}/cancel/")
        # 旧提醒过期且已读
        due = Notification.objects.get(
            preorder=self.preorder, type=Notification.TYPE_DUE
        )
        self.assertTrue(due.is_stale)
        self.assertTrue(due.is_read)
        # 新生成「已取消补款」通知
        cancelled = Notification.objects.get(
            preorder=self.preorder, type=Notification.TYPE_CANCELLED
        )
        self.assertEqual(cancelled.title, "《状态机手办》已取消补款")

    def test_mark_paid_reads_reminders(self):
        with patch("django.utils.timezone.localdate", return_value=TODAY):
            sync_due_notifications(self.user)
        self.client.post(f"/api/preorders/{self.preorder.id}/mark-paid/")
        due = Notification.objects.get(
            preorder=self.preorder, type=Notification.TYPE_DUE
        )
        self.assertTrue(due.is_read)
        self.assertFalse(due.is_stale)  # 补款后保留历史，不标记过期


class ConvertToGoodsTestCase(TestCase):
    """转正为谷子：字段映射、金额/日期迁移、幂等与校验。"""

    def setUp(self):
        self.user = make_user("convert_user")
        self.other = make_user("convert_other")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.ip = IP.objects.create(name="测试IP", subject_type=4)
        self.char = Character.objects.create(ip=self.ip, name="测试角色", gender="female")
        self.category = Category.objects.create(name="手办", path_name="手办")
        self.theme = Theme.objects.create(user=self.user, name="我的主题")
        self.other_theme = Theme.objects.create(user=self.other, name="别人的主题")
        self.paid_at = timezone.now() - datetime.timedelta(days=2)
        self.preorder = Preorder.objects.create(
            user=self.user,
            name="转正手办",
            deposit_amount=Decimal("100.00"),
            balance_amount=Decimal("50.00"),
            estimated_month=datetime.date(2026, 6, 1),
            status=Preorder.STATUS_PAID,
            paid_at=self.paid_at,
            notes="来自预购的备注",
        )

    def _convert_payload(self, **overrides) -> dict:
        payload = {
            "name": "转正手办",
            "ip": self.ip.id,
            "category": self.category.id,
            "characters": [self.char.id],
            "status": "in_cabinet",
            "theme": self.theme.id,
            "notes": "补充说明",
        }
        payload.update(overrides)
        return payload

    def test_convert_success(self):
        response = self.client.post(
            f"/api/preorders/{self.preorder.id}/convert-to-goods/",
            self._convert_payload(),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        data = response.json()
        self.assertEqual(data["status"], "converted")
        self.assertIsNotNone(data["goods_id"])

        self.preorder.refresh_from_db()
        goods = self.preorder.goods
        self.assertIsNotNone(goods)
        self.assertEqual(goods.user_id, self.user.id)
        self.assertEqual(goods.name, "转正手办")
        self.assertEqual(goods.ip_id, self.ip.id)
        self.assertEqual(goods.category_id, self.category.id)
        self.assertEqual(list(goods.characters.values_list("id", flat=True)), [self.char.id])
        self.assertEqual(goods.theme_id, self.theme.id)
        # 金额 / 日期 / 备注自动迁移
        self.assertEqual(goods.price, Decimal("150.00"))
        self.assertEqual(
            goods.purchase_date, timezone.localtime(self.paid_at).date()
        )
        self.assertEqual(goods.notes, "补充说明")
        # 已转正通知
        converted = Notification.objects.get(
            preorder=self.preorder, type=Notification.TYPE_CONVERTED
        )
        self.assertEqual(converted.title, "《转正手办》已转正为谷子")

    def test_convert_defaults_to_draft_without_characters(self):
        payload = self._convert_payload(status="draft", characters=[])
        response = self.client.post(
            f"/api/preorders/{self.preorder.id}/convert-to-goods/",
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        goods = Goods.objects.get(user=self.user)
        self.assertEqual(goods.status, "draft")
        self.assertEqual(goods.characters.count(), 0)

    def test_convert_price_deposit_only_when_balance_unknown(self):
        self.preorder.balance_amount = None
        self.preorder.save(update_fields=["balance_amount", "updated_at"])
        response = self.client.post(
            f"/api/preorders/{self.preorder.id}/convert-to-goods/",
            self._convert_payload(status="draft", characters=[]),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        self.assertEqual(Goods.objects.get(user=self.user).price, Decimal("100.00"))

    def test_convert_validation_errors_no_partial_write(self):
        # 缺 IP
        payload = self._convert_payload()
        payload.pop("ip")
        response = self.client.post(
            f"/api/preorders/{self.preorder.id}/convert-to-goods/",
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # 缺品类
        payload = self._convert_payload()
        payload.pop("category")
        response = self.client.post(
            f"/api/preorders/{self.preorder.id}/convert-to-goods/",
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # 非草稿必须带角色
        response = self.client.post(
            f"/api/preorders/{self.preorder.id}/convert-to-goods/",
            self._convert_payload(characters=[]),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # 全部失败场景下不得创建谷子，预购状态不变
        self.assertEqual(Goods.objects.count(), 0)
        self.preorder.refresh_from_db()
        self.assertEqual(self.preorder.status, Preorder.STATUS_PAID)
        self.assertIsNone(self.preorder.goods_id)

    def test_convert_duplicate_conflict(self):
        self.client.post(
            f"/api/preorders/{self.preorder.id}/convert-to-goods/",
            self._convert_payload(),
            format="json",
        )
        response = self.client.post(
            f"/api/preorders/{self.preorder.id}/convert-to-goods/",
            self._convert_payload(),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_convert_rejects_foreign_theme(self):
        response = self.client.post(
            f"/api/preorders/{self.preorder.id}/convert-to-goods/",
            self._convert_payload(theme=self.other_theme.id),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class NotificationGenerationTestCase(TestCase):
    """通知生成边界（冻结“今天”为 2026-06-01）。"""

    def setUp(self):
        self.user = make_user("notify_gen_user")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_preorder(self, month: str, **overrides) -> Preorder:
        return Preorder.objects.create(
            user=self.user,
            name=f"手办-{month}",
            deposit_amount=Decimal("100.00"),
            estimated_month=datetime.date.fromisoformat(month),
            **overrides,
        )

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_soon_window_boundary(self, _mocked):
        # 窗口第 1 天：2026-07-01 往前 30 天 = 2026-06-01
        preorder = self._create_preorder("2026-07-01")
        created = sync_due_notifications(self.user)
        self.assertEqual(created, 1)
        notification = Notification.objects.get(preorder=preorder)
        self.assertEqual(notification.type, Notification.TYPE_SOON)
        self.assertIn("还有 30 天", notification.message)
        # 窗口外：8 月 1 日补款，6 月 1 日尚未进入窗口
        self._create_preorder("2026-08-01")
        self.assertEqual(sync_due_notifications(self.user), 0)

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_due_and_overdue(self, _mocked):
        due = self._create_preorder("2026-06-01")
        overdue = self._create_preorder("2026-05-01")
        self.assertEqual(sync_due_notifications(self.user), 2)
        self.assertEqual(
            Notification.objects.get(preorder=due).type, Notification.TYPE_DUE
        )
        self.assertEqual(
            Notification.objects.get(preorder=overdue).type, Notification.TYPE_DUE
        )

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_idempotent_generation(self, _mocked):
        self._create_preorder("2026-07-01")
        self.assertEqual(sync_due_notifications(self.user), 1)
        # 第二次同步不产生新通知
        self.assertEqual(sync_due_notifications(self.user), 0)
        self.assertEqual(Notification.objects.filter(is_stale=False).count(), 1)

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_paid_or_cancelled_never_generate(self, _mocked):
        self._create_preorder("2026-06-01", status=Preorder.STATUS_PAID, paid_at=timezone.now())
        self._create_preorder("2026-06-01", status=Preorder.STATUS_CANCELLED)
        self.assertEqual(sync_due_notifications(self.user), 0)
        self.assertEqual(Notification.objects.count(), 0)

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_api_create_triggers_sync_immediately(self, _mocked):
        response = self.client.post(
            "/api/preorders/",
            preorder_payload(estimated_month="2026-06-01"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Notification.objects.filter(type=Notification.TYPE_DUE).count(), 1
        )

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_month_update_stales_old_and_generates_new(self, _mocked):
        preorder = self._create_preorder("2026-07-01")
        sync_due_notifications(self.user)
        self.assertTrue(
            Notification.objects.filter(
                preorder=preorder, type=Notification.TYPE_SOON, is_stale=False
            ).exists()
        )
        # 修改月份为已到补款期
        response = self.client.patch(
            f"/api/preorders/{preorder.id}/",
            {"estimated_month": "2026-05-01"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 旧 soon 通知过期，新 due 通知生成，且唯一约束不冲突
        old = Notification.objects.get(
            preorder=preorder, type=Notification.TYPE_SOON
        )
        self.assertTrue(old.is_stale)
        self.assertTrue(old.is_read)
        new = Notification.objects.get(
            preorder=preorder, type=Notification.TYPE_DUE
        )
        self.assertFalse(new.is_stale)
        self.assertEqual(
            Notification.objects.filter(
                preorder=preorder, is_stale=False
            ).count(),
            1,
        )

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_reschedule_twice_keeps_stale_history(self, _mocked):
        """连续两次修改月份：过期提醒累积为历史，不触发唯一约束冲突（回归）。"""
        created = self.client.post(
            "/api/preorders/",
            preorder_payload(estimated_month="2026-07-01"),
            format="json",
        )
        preorder_id = created.json()["id"]
        # 第一次改期：07 → 06（窗口内，旧 soon 过期，生成 due）
        response = self.client.patch(
            f"/api/preorders/{preorder_id}/",
            {"estimated_month": "2026-06-01"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        # 第二次改期：06 → 07（旧 due 过期，重新生成 soon）
        response = self.client.patch(
            f"/api/preorders/{preorder_id}/",
            {"estimated_month": "2026-07-01"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        preorder = Preorder.objects.get(id=preorder_id)
        self.assertEqual(
            Notification.objects.filter(preorder=preorder, is_stale=False).count(), 1
        )
        self.assertEqual(
            Notification.objects.filter(preorder=preorder, is_stale=True).count(), 2
        )

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_cancel_after_reschedule_no_integrity_error(self, _mocked):
        """改期后取消：置过期不应与历史过期记录冲突（回归）。"""
        created = self.client.post(
            "/api/preorders/",
            preorder_payload(estimated_month="2026-07-01"),
            format="json",
        )
        preorder_id = created.json()["id"]
        self.client.patch(
            f"/api/preorders/{preorder_id}/",
            {"estimated_month": "2026-06-01"},
            format="json",
        )
        response = self.client.post(f"/api/preorders/{preorder_id}/cancel/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        preorder = Preorder.objects.get(id=preorder_id)
        self.assertEqual(
            Notification.objects.filter(
                preorder=preorder,
                type__in=(Notification.TYPE_SOON, Notification.TYPE_DUE),
                is_stale=True,
            ).count(),
            2,
        )
        self.assertEqual(
            Notification.objects.filter(
                preorder=preorder, type=Notification.TYPE_CANCELLED
            ).count(),
            1,
        )

    def test_unique_constraint_blocks_duplicate_active(self):
        preorder = self._create_preorder("2026-06-01")
        Notification.objects.create(
            user=self.user,
            preorder=preorder,
            type=Notification.TYPE_DUE,
            title="t",
            message="m",
        )
        with self.assertRaises(IntegrityError):
            Notification.objects.create(
                user=self.user,
                preorder=preorder,
                type=Notification.TYPE_DUE,
                title="t2",
                message="m2",
            )


class QuarterGranularityTestCase(TestCase):
    """季度粒度：归一化、45 天提醒窗口与文案。"""

    def setUp(self):
        self.user = make_user("quarter_user")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_quarter_normalizes_to_quarter_start(self):
        response = self.client.post(
            "/api/preorders/",
            preorder_payload(estimated_month="2026-08-15", time_granularity="quarter"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        data = response.json()
        # 季度粒度：季度内任意日期统一归一化为季度首月 1 日
        self.assertEqual(data["estimated_month"], "2026-07-01")
        self.assertEqual(data["time_granularity"], "quarter")

    def test_default_granularity_is_month(self):
        response = self.client.post(
            "/api/preorders/",
            preorder_payload(estimated_month="2026-08-15"),
            format="json",
        )
        data = response.json()
        self.assertEqual(data["time_granularity"], "month")
        self.assertEqual(data["estimated_month"], "2026-08-01")

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_quarter_soon_window_45_days(self, _mocked):
        # Q3 首月 07-01，45 天窗口起点 = 05-17 → 06-01 在窗口内
        preorder = Preorder.objects.create(
            user=self.user,
            name="季度手办Q3",
            deposit_amount=Decimal("100.00"),
            estimated_month=datetime.date(2026, 7, 1),
            time_granularity=Preorder.GRANULARITY_QUARTER,
        )
        self.assertEqual(sync_due_notifications(self.user), 1)
        notification = Notification.objects.get(preorder=preorder)
        self.assertEqual(notification.type, Notification.TYPE_SOON)
        self.assertIn("第三季度", notification.message)
        self.assertIn("还有 30 天", notification.message)
        # Q4 首月 10-01，窗口起点 = 08-17 → 06-01 在窗口外
        Preorder.objects.create(
            user=self.user,
            name="季度手办Q4",
            deposit_amount=Decimal("100.00"),
            estimated_month=datetime.date(2026, 10, 1),
            time_granularity=Preorder.GRANULARITY_QUARTER,
        )
        self.assertEqual(sync_due_notifications(self.user), 0)

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_quarter_due_message(self, _mocked):
        # Q2 首月 04-01：06-01 已进入补款期 → due，文案含「第二季度」
        preorder = Preorder.objects.create(
            user=self.user,
            name="季度手办到期",
            deposit_amount=Decimal("100.00"),
            estimated_month=datetime.date(2026, 4, 1),
            time_granularity=Preorder.GRANULARITY_QUARTER,
        )
        self.assertEqual(sync_due_notifications(self.user), 1)
        notification = Notification.objects.get(preorder=preorder)
        self.assertEqual(notification.type, Notification.TYPE_DUE)
        self.assertIn("第二季度", notification.message)

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_update_switches_granularity_stales_old(self, _mocked):
        # 季度 Q3（07-01）→ 改月粒度 2026-06-01：旧季度提醒过期，新月粒度 due 生成
        preorder = Preorder.objects.create(
            user=self.user,
            name="季度改月",
            deposit_amount=Decimal("100.00"),
            estimated_month=datetime.date(2026, 7, 1),
            time_granularity=Preorder.GRANULARITY_QUARTER,
        )
        self.assertEqual(sync_due_notifications(self.user), 1)
        response = self.client.patch(
            f"/api/preorders/{preorder.id}/",
            {"estimated_month": "2026-06-01", "time_granularity": "month"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        preorder.refresh_from_db()
        self.assertEqual(preorder.time_granularity, Preorder.GRANULARITY_MONTH)
        self.assertEqual(preorder.estimated_month, datetime.date(2026, 6, 1))
        # 旧季度提醒过期，新月粒度 due 生成
        self.assertEqual(
            Notification.objects.filter(preorder=preorder, is_stale=True).count(), 1
        )
        active = Notification.objects.get(preorder=preorder, is_stale=False)
        self.assertEqual(active.type, Notification.TYPE_DUE)


    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_granularity_switch_resyncs_notifications(self, _mocked):
        """粒度切换（存储日期不变）：旧提醒过期并按新粒度重新生成（回归）。"""
        preorder = Preorder.objects.create(
            user=self.user,
            name="粒度切换",
            deposit_amount=Decimal("100.00"),
            estimated_month=datetime.date(2026, 7, 1),
            time_granularity=Preorder.GRANULARITY_MONTH,
        )
        self.assertEqual(sync_due_notifications(self.user), 1)
        self.assertIn(
            "2026年7月",
            Notification.objects.get(preorder=preorder).message,
        )
        # 同一天切为季度粒度（Q3）
        response = self.client.patch(
            f"/api/preorders/{preorder.id}/",
            {"estimated_month": "2026-07-01", "time_granularity": "quarter"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        # 旧月粒度提醒过期，新季度提醒生成（文案含第三季度）
        self.assertEqual(
            Notification.objects.filter(preorder=preorder, is_stale=True).count(), 1
        )
        active = Notification.objects.get(preorder=preorder, is_stale=False)
        self.assertEqual(active.type, Notification.TYPE_SOON)
        self.assertIn("第三季度", active.message)

    def test_patch_granularity_only_normalizes_month(self):
        """仅改粒度（不含 estimated_month）：实例时间归一化为季度首月（回归）。"""
        preorder = Preorder.objects.create(
            user=self.user,
            name="仅改粒度",
            deposit_amount=Decimal("100.00"),
            estimated_month=datetime.date(2026, 8, 1),
        )
        response = self.client.patch(
            f"/api/preorders/{preorder.id}/",
            {"time_granularity": "quarter"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        data = response.json()
        # 8 月属于 Q3 → 归一化为季度首月 7 月 1 日
        self.assertEqual(data["time_granularity"], "quarter")
        self.assertEqual(data["estimated_month"], "2026-07-01")


class NotificationAPITestCase(TestCase):
    """通知接口：列表零副作用、已读操作与越权忽略。"""

    def setUp(self):
        self.user = make_user("notify_api_user")
        self.other = make_user("notify_api_other")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.other_client = APIClient()
        self.other_client.force_authenticate(user=self.other)
        self.preorder = Preorder.objects.create(
            user=self.user,
            name="接口手办",
            deposit_amount=Decimal("100.00"),
            estimated_month=datetime.date(2026, 6, 1),
        )

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_list_has_no_side_effect_unread_count_syncs(self, _mocked):
        # 列表本身不生成通知
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.json()["count"], 0)
        self.assertEqual(Notification.objects.count(), 0)
        # unread-count 触发惰性同步
        response = self.client.get("/api/notifications/unread-count/")
        self.assertEqual(response.json()["unread_count"], 1)
        self.assertEqual(Notification.objects.count(), 1)
        # 再次调用不重复生成
        response = self.client.get("/api/notifications/unread-count/")
        self.assertEqual(response.json()["unread_count"], 1)

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_list_content_and_unread_filter(self, _mocked):
        self.client.get("/api/notifications/unread-count/")
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["page_size"], 20)
        self.assertIsNone(data["next"])
        item = data["results"][0]
        self.assertEqual(item["type"], "preorder_due")
        self.assertEqual(item["preorder_id"], str(self.preorder.id))
        self.assertEqual(item["preorder_name"], "接口手办")
        self.assertFalse(item["is_read"])
        self.assertFalse(item["is_stale"])
        self.assertIn("title", item)
        # unread_only 过滤
        response = self.client.get("/api/notifications/?unread_only=1")
        self.assertEqual(response.json()["count"], 1)

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_read_batch_and_read_all(self, _mocked):
        self.client.get("/api/notifications/unread-count/")
        nid = Notification.objects.get().id
        response = self.client.post(
            "/api/notifications/read/", {"ids": [nid]}, format="json"
        )
        self.assertEqual(response.json()["updated"], 1)
        self.assertTrue(Notification.objects.get(id=nid).is_read)
        self.assertEqual(
            self.client.get("/api/notifications/unread-count/").json()["unread_count"], 0
        )
        # read-all
        Notification.objects.filter(user=self.user).update(is_read=False)
        response = self.client.post("/api/notifications/read-all/")
        self.assertEqual(response.json()["updated"], 1)

    @patch("django.utils.timezone.localdate", return_value=TODAY)
    def test_read_ignores_foreign_ids(self, _mocked):
        self.client.get("/api/notifications/unread-count/")
        nid = Notification.objects.get().id
        # 其他用户尝试已读该通知：被忽略
        response = self.other_client.post(
            "/api/notifications/read/", {"ids": [nid]}, format="json"
        )
        self.assertEqual(response.json()["updated"], 0)
        self.assertFalse(Notification.objects.get(id=nid).is_read)
        # 其他用户也看不到该通知
        response = self.other_client.get("/api/notifications/")
        self.assertEqual(response.json()["count"], 0)
