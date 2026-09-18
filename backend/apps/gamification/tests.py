from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.core.management import call_command
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.goods.models import Category, Character, Goods, IP, Showcase, ShowcaseGoods
from apps.reminder.models import Preorder
from apps.users.models import Role, User

from .models import (
    Achievement,
    AchievementSet,
    GamificationConfig,
    MetricEvent,
    MetricSourceState,
    Reward,
    RuleCondition,
    RuleGroup,
    UserAchievement,
    UserReward,
    PublicBadgeSelection,
)
from .services import (
    claim_achievement,
    evaluate_achievement,
    initialize_baseline,
    seed_defaults,
    sync_goods_source,
    sync_preorder_source,
    sync_showcase_altar,
)


class GamificationServiceTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="collector", role=self.role)
        self.ip = IP.objects.create(name="Test IP")
        self.other_ip = IP.objects.create(name="Other IP")
        self.character = Character.objects.create(ip=self.ip, name="Test Character")
        self.other_character = Character.objects.create(ip=self.other_ip, name="Other Character")
        self.category = Category.objects.create(name="吧唧")
        self.rollout_at = timezone.now()

    def make_goods(self, *, quantity=1, price="10.00", status="in_cabinet", created_at=None):
        goods = Goods.objects.create(
            user=self.user,
            name="Test Goods",
            ip=self.ip,
            category=self.category,
            quantity=quantity,
            price=Decimal(price) if price is not None else None,
            status=status,
        )
        goods.characters.add(self.character)
        if created_at:
            Goods.objects.filter(pk=goods.pk).update(created_at=created_at)
            goods.refresh_from_db()
        return goods

    def initialize(self, *, rollout_at=None):
        initialize_baseline(rollout_at or self.rollout_at)

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_existing_goods_are_frozen_and_only_future_increase_counts(self):
        goods = self.make_goods(quantity=2, created_at=self.rollout_at - timedelta(minutes=1))
        self.initialize()
        sync_goods_source(goods.id)
        self.assertFalse(MetricEvent.objects.exists())

        goods.quantity = 5
        goods.save(update_fields=["quantity", "updated_at"])
        sync_goods_source(goods.id)

        events = MetricEvent.objects.filter(event_type=MetricEvent.EVENT_GOODS_QUANTITY)
        self.assertEqual(events.count(), 1)
        self.assertEqual(events.get().amount, Decimal("3.00"))

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_new_goods_event_emits_full_quantity_and_spend(self):
        self.initialize()
        goods = self.make_goods(quantity=3, price="12.50", created_at=self.rollout_at + timedelta(minutes=1))
        sync_goods_source(goods.id)

        self.assertEqual(
            MetricEvent.objects.filter(
                event_type=MetricEvent.EVENT_GOODS_QUANTITY,
                amount__gt=0,
            ).get().amount,
            Decimal("3.00"),
        )
        self.assertEqual(
            MetricEvent.objects.get(event_type=MetricEvent.EVENT_SPEND_AMOUNT).amount,
            Decimal("37.50"),
        )

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_draft_transition_counts_once_and_decrease_does_not_roll_back(self):
        self.initialize()
        goods = self.make_goods(quantity=2, created_at=self.rollout_at + timedelta(minutes=1), status="draft")
        sync_goods_source(goods.id)
        self.assertFalse(MetricEvent.objects.exists())

        goods.status = "in_cabinet"
        goods.save(update_fields=["status", "updated_at"])
        sync_goods_source(goods.id)
        goods.quantity = 1
        goods.save(update_fields=["quantity", "updated_at"])
        sync_goods_source(goods.id)

        self.assertEqual(
            MetricEvent.objects.get(event_type=MetricEvent.EVENT_GOODS_QUANTITY).amount,
            Decimal("2.00"),
        )

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_paid_preorder_is_counted_and_conversion_does_not_double_charge(self):
        self.initialize()
        preorder = Preorder.objects.create(
            user=self.user,
            name="Preorder",
            deposit_amount=Decimal("20.00"),
            balance_amount=Decimal("80.00"),
            estimated_month=timezone.localdate(),
        )
        sync_preorder_source(preorder.id)
        self.assertFalse(MetricEvent.objects.exists())

        preorder.status = Preorder.STATUS_PAID
        preorder.paid_at = timezone.now()
        preorder.save(update_fields=["status", "paid_at", "updated_at"])
        sync_preorder_source(preorder.id)
        self.assertEqual(
            MetricEvent.objects.get(event_type=MetricEvent.EVENT_SPEND_AMOUNT).amount,
            Decimal("100.00"),
        )

        with transaction.atomic():
            goods = self.make_goods(
                quantity=1,
                price="100.00",
                created_at=self.rollout_at + timedelta(minutes=2),
            )
            preorder.goods = goods
            preorder.status = Preorder.STATUS_CONVERTED
            preorder.save(update_fields=["goods", "status", "updated_at"])
        sync_goods_source(goods.id)
        self.assertEqual(
            MetricEvent.objects.filter(event_type=MetricEvent.EVENT_SPEND_AMOUNT).count(),
            1,
        )

        goods.price = Decimal("120.00")
        goods.save(update_fields=["price", "updated_at"])
        sync_goods_source(goods.id)
        spend_events = MetricEvent.objects.filter(event_type=MetricEvent.EVENT_SPEND_AMOUNT)
        self.assertEqual(spend_events.count(), 2)
        self.assertEqual(sum((event.amount for event in spend_events), Decimal("0")), Decimal("120.00"))

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_initialization_counts_converted_preorder_in_stable_order(self):
        preorder = Preorder.objects.create(
            user=self.user,
            name="Converted before rollout",
            deposit_amount=Decimal("20.00"),
            balance_amount=Decimal("80.00"),
            estimated_month=timezone.localdate(),
            status=Preorder.STATUS_PAID,
            paid_at=self.rollout_at - timedelta(minutes=2),
        )
        Preorder.objects.filter(pk=preorder.pk).update(
            created_at=self.rollout_at - timedelta(minutes=3)
        )
        preorder.refresh_from_db()
        goods = self.make_goods(
            quantity=1,
            price="100.00",
            created_at=self.rollout_at - timedelta(minutes=1),
        )
        preorder.goods = goods
        preorder.status = Preorder.STATUS_CONVERTED
        preorder.save(update_fields=["goods", "status", "updated_at"])
        self.initialize()
        sync_goods_source(goods.id, emit_events=True)
        self.assertFalse(MetricEvent.objects.filter(event_type=MetricEvent.EVENT_SPEND_AMOUNT).exists())

        goods.price = Decimal("120.00")
        goods.save(update_fields=["price", "updated_at"])
        sync_goods_source(goods.id, emit_events=True)
        self.assertEqual(
            MetricEvent.objects.get(event_type=MetricEvent.EVENT_SPEND_AMOUNT).amount,
            Decimal("20.00"),
        )

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_linked_preorder_keeps_spend_increment_idempotency(self):
        self.initialize()
        preorder = Preorder.objects.create(
            user=self.user,
            name="Linked preorder",
            deposit_amount=Decimal("20.00"),
            balance_amount=Decimal("80.00"),
            estimated_month=timezone.localdate(),
        )
        with transaction.atomic():
            goods = self.make_goods(
                quantity=1,
                price="100.00",
                created_at=self.rollout_at + timedelta(minutes=1),
            )
            preorder.goods = goods
            preorder.status = Preorder.STATUS_PAID
            preorder.paid_at = timezone.now()
            preorder.save(update_fields=["goods", "status", "paid_at", "updated_at"])
        sync_preorder_source(preorder.id)
        preorder.balance_amount = Decimal("130.00")
        preorder.save(update_fields=["balance_amount", "updated_at"])
        sync_preorder_source(preorder.id)

        events = list(
            MetricEvent.objects.filter(
                event_type=MetricEvent.EVENT_SPEND_AMOUNT,
                source_type="spend_component",
                source_id=f"preorder:{preorder.id}",
            ).order_by("occurred_at", "id")
        )
        self.assertEqual([event.amount for event in events], [Decimal("100.00"), Decimal("50.00")])

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_linked_spend_total_is_independent_of_sync_order(self):
        self.initialize()
        preorder = Preorder.objects.create(
            user=self.user,
            name="Order-independent spend",
            deposit_amount=Decimal("20.00"),
            balance_amount=Decimal("80.00"),
            estimated_month=timezone.localdate(),
        )
        with transaction.atomic():
            goods = self.make_goods(
                quantity=1,
                price="100.00",
                created_at=self.rollout_at + timedelta(minutes=1),
            )
            preorder.goods = goods
            preorder.status = Preorder.STATUS_PAID
            preorder.paid_at = timezone.now()
            preorder.save(update_fields=["goods", "status", "paid_at", "updated_at"])

        preorder.balance_amount = Decimal("120.00")
        preorder.save(update_fields=["balance_amount", "updated_at"])
        sync_preorder_source(preorder.id)
        goods.price = Decimal("150.00")
        goods.save(update_fields=["price", "updated_at"])
        sync_goods_source(goods.id)

        total_spend = sum(
            MetricEvent.objects.filter(
                user=self.user,
                event_type=MetricEvent.EVENT_SPEND_AMOUNT,
            ).values_list("amount", flat=True),
            Decimal("0.00"),
        )
        self.assertEqual(total_spend, Decimal("150.00"))

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_preorder_balance_increment_uses_increment_time(self):
        self.initialize()
        paid_at = timezone.now() - timedelta(days=2)
        preorder = Preorder.objects.create(
            user=self.user,
            name="Timed preorder",
            deposit_amount=Decimal("20.00"),
            balance_amount=Decimal("0.00"),
            estimated_month=timezone.localdate(),
        )
        Preorder.objects.filter(pk=preorder.pk).update(
            status=Preorder.STATUS_PAID,
            paid_at=paid_at,
            gamification_spend_changed_at=paid_at
        )
        preorder.refresh_from_db()
        sync_preorder_source(preorder.id)
        first_event = MetricEvent.objects.get(
            event_type=MetricEvent.EVENT_SPEND_AMOUNT,
            source_id=f"preorder:{preorder.id}",
        )
        self.assertLess(abs((first_event.occurred_at - paid_at).total_seconds()), 1)

        before_increment = timezone.now()
        preorder.balance_amount = Decimal("80.00")
        preorder.save(update_fields=["balance_amount", "updated_at"])
        sync_preorder_source(preorder.id)
        second_event = (
            MetricEvent.objects.filter(
                event_type=MetricEvent.EVENT_SPEND_AMOUNT,
                source_id=f"preorder:{preorder.id}",
            )
            .exclude(pk=first_event.pk)
            .get()
        )
        self.assertGreaterEqual(second_event.occurred_at, before_increment)

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_unrelated_preorder_edit_does_not_move_spend_event_time(self):
        self.initialize()
        preorder = Preorder.objects.create(
            user=self.user,
            name="Stable preorder time",
            deposit_amount=Decimal("20.00"),
            balance_amount=Decimal("80.00"),
            estimated_month=timezone.localdate(),
        )
        with transaction.atomic():
            goods = self.make_goods(
                quantity=1,
                price="100.00",
                created_at=self.rollout_at + timedelta(minutes=1),
            )
            preorder.goods = goods
            preorder.status = Preorder.STATUS_PAID
            preorder.paid_at = timezone.now() - timedelta(hours=1)
            preorder.save(update_fields=["goods", "status", "paid_at", "updated_at"])
        sync_preorder_source(preorder.id)
        first_event = MetricEvent.objects.get(
            event_type=MetricEvent.EVENT_SPEND_AMOUNT,
            source_id=f"preorder:{preorder.id}",
        )

        preorder.name = "Renamed only"
        preorder.save(update_fields=["name", "updated_at"])
        goods.price = Decimal("120.00")
        goods.save(update_fields=["price", "updated_at"])
        preorder.name = "Renamed after price"
        preorder.save(update_fields=["name", "updated_at"])
        sync_preorder_source(preorder.id)
        second_event = (
            MetricEvent.objects.filter(
                event_type=MetricEvent.EVENT_SPEND_AMOUNT,
                source_id=f"preorder:{preorder.id}",
            )
            .exclude(pk=first_event.pk)
            .get()
        )
        expected_time = goods.gamification_spend_changed_at
        self.assertIsNotNone(expected_time)
        self.assertLess(abs((second_event.occurred_at - expected_time).total_seconds()), 1)

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_goods_status_transition_triggers_altar_recheck(self):
        self.initialize()
        showcase = Showcase.objects.create(
            user=self.user,
            name="Status altar",
            character=self.character,
        )
        for _ in range(2):
            goods = self.make_goods(created_at=self.rollout_at + timedelta(minutes=1))
            ShowcaseGoods.objects.create(showcase=showcase, goods=goods)
        pending_goods = self.make_goods(
            status="draft",
            created_at=self.rollout_at + timedelta(minutes=1),
        )
        ShowcaseGoods.objects.create(showcase=showcase, goods=pending_goods)
        sync_showcase_altar(showcase.id)
        self.assertFalse(MetricEvent.objects.filter(event_type=MetricEvent.EVENT_VALID_ALTAR).exists())

        pending_goods.status = "in_cabinet"
        pending_goods.save(update_fields=["status", "updated_at"])

        self.assertTrue(MetricEvent.objects.filter(event_type=MetricEvent.EVENT_VALID_ALTAR).exists())

    def test_initialize_does_not_silently_change_an_existing_rollout(self):
        self.initialize()
        with self.assertRaisesMessage(ValueError, "已经初始化"):
            self.initialize(rollout_at=self.rollout_at + timedelta(hours=1))

    def test_limited_flag_is_derived_from_set_on_set_update(self):
        achievement_set = AchievementSet.objects.create(code="limited-sync", name="Limited Sync")
        achievement = Achievement.objects.create(
            code="limited-sync-achievement",
            set=achievement_set,
            name="Limited Sync Achievement",
        )
        achievement_set.is_limited = True
        achievement_set.starts_at = timezone.now()
        achievement_set.ends_at = timezone.now() + timedelta(days=1)
        achievement_set.save()
        achievement.refresh_from_db()
        self.assertTrue(achievement.is_limited)

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_valid_altar_is_distinct_by_character(self):
        self.initialize()
        showcase = Showcase.objects.create(user=self.user, name="Character altar", character=self.character)
        for _ in range(3):
            goods = self.make_goods(
                created_at=self.rollout_at + timedelta(minutes=1),
            )
            ShowcaseGoods.objects.create(showcase=showcase, goods=goods)
        sync_showcase_altar(showcase.id)
        sync_showcase_altar(showcase.id)
        self.assertEqual(MetricEvent.objects.filter(event_type=MetricEvent.EVENT_VALID_ALTAR).count(), 1)

        second = Showcase.objects.create(user=self.user, name="Same character", character=self.character)
        for goods in Goods.objects.all()[:3]:
            ShowcaseGoods.objects.create(showcase=second, goods=goods)
        sync_showcase_altar(second.id)
        self.assertEqual(MetricEvent.objects.filter(event_type=MetricEvent.EVENT_VALID_ALTAR).count(), 2)

        achievement = Achievement.objects.create(
            code="altar-distinct-test",
            set=AchievementSet.objects.create(code="altar-test-set", name="Altar Test"),
            name="Distinct altar",
        )
        group = RuleGroup.objects.create(achievement=achievement)
        RuleCondition.objects.create(
            group=group,
            metric=RuleCondition.METRIC_VALID_ALTARS,
            threshold=Decimal("1.00"),
        )
        result = evaluate_achievement(self.user, achievement)
        self.assertEqual(result["progress"]["groups"][0]["conditions"][0]["current"], 1.0)

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_draft_and_intended_goods_do_not_form_valid_altar(self):
        self.initialize()
        showcase = Showcase.objects.create(
            user=self.user,
            name="Draft altar",
            character=self.character,
            created_at=self.rollout_at + timedelta(minutes=1),
        )
        for index, status in enumerate(("draft", "intended", "draft")):
            goods = self.make_goods(
                status=status,
                created_at=self.rollout_at + timedelta(minutes=index + 1),
            )
            ShowcaseGoods.objects.create(showcase=showcase, goods=goods)
        sync_showcase_altar(showcase.id)
        self.assertFalse(MetricEvent.objects.filter(event_type=MetricEvent.EVENT_VALID_ALTAR).exists())

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_scope_refresh_updates_distinct_character_without_changing_quantity(self):
        self.initialize()
        goods = self.make_goods(
            quantity=1,
            created_at=self.rollout_at + timedelta(minutes=1),
        )
        sync_goods_source(goods.id)
        goods.characters.add(self.other_character)
        sync_goods_source(goods.id)

        achievement = Achievement.objects.create(
            code="distinct-character-scope",
            set=AchievementSet.objects.create(code="scope-set", name="Scope Set"),
            name="Distinct character scope",
        )
        group = RuleGroup.objects.create(achievement=achievement)
        RuleCondition.objects.create(
            group=group,
            metric=RuleCondition.METRIC_DISTINCT_CHARACTER_COUNT,
            threshold=Decimal("2"),
        )
        result = evaluate_achievement(self.user, achievement)

        self.assertEqual(result["progress"]["groups"][0]["conditions"][0]["current"], 2.0)
        quantity_sum = sum(
            MetricEvent.objects.filter(
                user=self.user,
                event_type=MetricEvent.EVENT_GOODS_QUANTITY,
            ).values_list("amount", flat=True),
            Decimal("0.00"),
        )
        self.assertEqual(quantity_sum, Decimal("1.00"))
        self.assertEqual(
            MetricEvent.objects.filter(
                user=self.user,
                event_type=MetricEvent.EVENT_SCOPE_REFRESH,
            ).count() >= 1,
            True,
        )

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_compound_achievement_and_claim_are_idempotent(self):
        seed_defaults()
        self.initialize()
        achievement = Achievement.objects.get(code="collector-versatile")
        rewards = achievement.rewards.all()
        self.assertEqual(rewards.count(), 2)

        MetricEvent.objects.create(
            user=self.user,
            event_type=MetricEvent.EVENT_GOODS_QUANTITY,
            amount=Decimal("50.00"),
            source_type="test",
            source_id="quantity",
            occurred_at=timezone.now(),
            idempotency_key="test-quantity",
            metadata={"ip_id": self.ip.id, "character_ids": [self.character.id], "category_id": self.category.id},
        )
        spend_event = MetricEvent.objects.create(
            user=self.user,
            event_type=MetricEvent.EVENT_SPEND_AMOUNT,
            amount=Decimal("1000.00"),
            source_type="test",
            source_id="spend",
            occurred_at=timezone.now(),
            idempotency_key="test-spend",
        )
        for index in range(3):
            MetricEvent.objects.create(
                user=self.user,
                event_type=MetricEvent.EVENT_VALID_ALTAR,
                amount=Decimal("1.00"),
                source_type="test",
                source_id=f"altar-{index}",
                occurred_at=timezone.now(),
                idempotency_key=f"test-altar-{index}",
                metadata={"character_id": index + 1},
            )
        result = evaluate_achievement(self.user, achievement)
        self.assertEqual(result["state"].status, UserAchievement.STATUS_UNLOCKED)

        state, grants = claim_achievement(self.user, achievement.id)
        self.assertEqual(state.status, UserAchievement.STATUS_CLAIMED)
        self.assertEqual(len(grants), 2)
        _, grants_again = claim_achievement(self.user, achievement.id)
        self.assertEqual(len(grants_again), 2)
        self.assertEqual(UserReward.objects.filter(user=self.user).count(), 2)

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_reconcile_rebuilds_missing_achievement_state_without_new_events(self):
        seed_defaults()
        self.initialize()
        achievement = Achievement.objects.get(code="collection-1")
        MetricEvent.objects.create(
            user=self.user,
            event_type=MetricEvent.EVENT_GOODS_QUANTITY,
            amount=Decimal("1.00"),
            source_type="test",
            source_id="reconcile",
            occurred_at=timezone.now(),
            idempotency_key="reconcile-event",
            metadata={"ip_id": self.ip.id, "character_ids": [self.character.id], "category_id": self.category.id},
        )
        initial = UserAchievement.objects.get(user=self.user, achievement=achievement)
        self.assertEqual(initial.status, UserAchievement.STATUS_LOCKED)

        call_command("reconcile_gamification", verbosity=0)

        state = UserAchievement.objects.get(user=self.user, achievement=achievement)
        self.assertEqual(state.status, UserAchievement.STATUS_UNLOCKED)


class GamificationApiTests(TestCase):
    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="api-collector", role=self.role)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @override_settings(GAMIFICATION_ENABLED=False)
    def test_summary_reports_disabled_without_events(self):
        response = self.client.get("/api/gamification/summary/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["enabled"])

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_overview_returns_seeded_achievements(self):
        GamificationConfig.objects.create(
            pk=1,
            rollout_at=timezone.now() - timedelta(minutes=1),
            initialized_at=timezone.now(),
        )
        seed_defaults()
        from apps.gamification.services import evaluate_user

        evaluate_user(self.user, force=True)
        response = self.client.get("/api/gamification/overview/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["achievements"]), Achievement.objects.count())

    def test_normal_user_cannot_access_admin_endpoints(self):
        response = self.client.get("/api/admin/gamification/sets/")
        self.assertEqual(response.status_code, 403)

    def admin_client(self):
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        admin = User.objects.create(username="gamification-rules-admin", role=admin_role)
        client = APIClient()
        client.force_authenticate(admin)
        return client

    def test_admin_rejects_empty_rules_and_invalid_filters(self):
        client = self.admin_client()
        achievement_set = AchievementSet.objects.create(code="rule-validation", name="Rule Validation")
        empty_response = client.post(
            "/api/admin/gamification/achievements/",
            {
                "code": "empty-rule",
                "set": achievement_set.id,
                "name": "Empty Rule",
                "root_operator": "ALL",
                "rewards": [],
                "rule_groups": [],
            },
            format="json",
        )
        invalid_filter_response = client.post(
            "/api/admin/gamification/achievements/",
            {
                "code": "invalid-filter",
                "set": achievement_set.id,
                "name": "Invalid Filter",
                "root_operator": "ALL",
                "rewards": [],
                "rule_groups": [
                    {
                        "operator": "ALL",
                        "order": 0,
                        "conditions": [
                            {
                                "metric": "GOODS_QUANTITY",
                                "threshold": 1,
                                "filters": {"ip_ids": ["not-an-id"]},
                                "order": 0,
                            }
                        ],
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(empty_response.status_code, 400)
        self.assertEqual(invalid_filter_response.status_code, 400)

    def test_admin_cannot_delete_definition_with_user_progress(self):
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        admin = User.objects.create(username="gamification-admin", role=admin_role)
        achievement_set = AchievementSet.objects.create(code="protected", name="Protected")
        achievement = Achievement.objects.create(
            code="protected-achievement",
            set=achievement_set,
            name="Protected Achievement",
        )
        reward = Reward.objects.create(
            code="protected-reward",
            name="Protected Reward",
            reward_type=Reward.TYPE_BADGE,
        )
        reward.achievements.add(achievement)
        UserAchievement.objects.create(
            user=self.user,
            achievement=achievement,
            status=UserAchievement.STATUS_UNLOCKED,
        )
        self.client.force_authenticate(admin)

        achievement_response = self.client.delete(
            f"/api/admin/gamification/achievements/{achievement.id}/"
        )
        reward_response = self.client.delete(
            f"/api/admin/gamification/rewards/{reward.id}/"
        )
        set_response = self.client.delete(
            f"/api/admin/gamification/sets/{achievement_set.id}/"
        )

        self.assertEqual(achievement_response.status_code, 409)
        self.assertEqual(reward_response.status_code, 409)
        self.assertEqual(set_response.status_code, 409)
        self.assertTrue(Achievement.objects.filter(pk=achievement.pk).exists())
        self.assertTrue(Reward.objects.filter(pk=reward.pk).exists())

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_public_badges_require_enabled_feature_active_reward_and_grant(self):
        GamificationConfig.objects.create(pk=1, rollout_at=timezone.now())
        reward = Reward.objects.create(
            code="public-badge",
            name="Public Badge",
            reward_type=Reward.TYPE_BADGE,
        )
        UserReward.objects.create(user=self.user, reward=reward)
        PublicBadgeSelection.objects.create(user=self.user, reward=reward, order=0)
        showcase = Showcase.objects.create(user=self.user, name="Public", is_public=True)
        anonymous = APIClient()

        visible = anonymous.get("/api/showcases/public/")
        self.assertEqual(visible.status_code, 200)
        self.assertEqual(visible.json()["results"][0]["creator"]["badges"][0]["name"], "Public Badge")

        reward.is_active = False
        reward.save(update_fields=["is_active", "updated_at"])
        hidden = anonymous.get("/api/showcases/public/")
        self.assertIsNone(hidden.json()["results"][0]["creator"])

        reward.is_active = True
        reward.reward_type = Reward.TYPE_JOURNAL_STICKER_PACK
        reward.save(update_fields=["is_active", "reward_type", "updated_at"])
        non_badge_hidden = anonymous.get("/api/showcases/public/")
        self.assertIsNone(non_badge_hidden.json()["results"][0]["creator"])

    def test_admin_cannot_change_frozen_reward_or_achievement_rewards(self):
        client = self.admin_client()
        achievement_set = AchievementSet.objects.create(code="freeze-set", name="Freeze Set")
        achievement = Achievement.objects.create(
            code="freeze-achievement",
            set=achievement_set,
            name="Freeze Achievement",
        )
        reward = Reward.objects.create(
            code="freeze-reward",
            name="Freeze Reward",
            reward_type=Reward.TYPE_BADGE,
        )
        achievement.rewards.add(reward)
        UserAchievement.objects.create(user=self.user, achievement=achievement)
        granted_reward = Reward.objects.create(
            code="granted-freeze-reward",
            name="Granted Freeze Reward",
            reward_type=Reward.TYPE_BADGE,
        )
        UserReward.objects.create(
            user=self.user,
            reward=granted_reward,
            source_achievement=achievement,
        )

        reward_response = client.patch(
            f"/api/admin/gamification/rewards/{reward.id}/",
            {"reward_type": Reward.TYPE_PROFILE_FRAME, "preset_key": "star-orbit"},
            format="json",
        )
        achievement_response = client.patch(
            f"/api/admin/gamification/achievements/{achievement.id}/",
            {"rewards": []},
            format="json",
        )
        granted_response = client.patch(
            f"/api/admin/gamification/rewards/{granted_reward.id}/",
            {"code": "changed-after-grant"},
            format="json",
        )

        self.assertEqual(reward_response.status_code, 400)
        self.assertEqual(achievement_response.status_code, 400)
        self.assertEqual(granted_response.status_code, 400)

    @override_settings(GAMIFICATION_ENABLED=True)
    def test_goods_owner_cannot_change_after_ledger_state_exists(self):
        GamificationConfig.objects.create(pk=1, rollout_at=timezone.now())
        ip = IP.objects.create(name="Owner transfer IP")
        category = Category.objects.create(name="Owner transfer category")
        goods = Goods.objects.create(
            user=self.user,
            name="Owner transfer goods",
            ip=ip,
            category=category,
        )
        MetricSourceState.objects.create(
            source_type="goods",
            source_id=str(goods.id),
            user=self.user,
        )
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        admin = User.objects.create(username="owner-transfer-admin", role=admin_role)
        other = User.objects.create(username="owner-transfer-target", role=admin_role)
        client = APIClient()
        client.force_authenticate(admin)

        response = client.patch(
            f"/api/goods/{goods.id}/",
            {"user_id": other.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_paid_preorder_cannot_be_deleted_after_spend_ledger_started(self):
        preorder = Preorder.objects.create(
            user=self.user,
            name="Protected paid preorder",
            deposit_amount=Decimal("20.00"),
            estimated_month=timezone.localdate(),
            status=Preorder.STATUS_PAID,
            paid_at=timezone.now(),
        )
        self.client.force_authenticate(self.user)

        response = self.client.delete(f"/api/preorders/{preorder.id}/")

        self.assertEqual(response.status_code, 409)
        self.assertTrue(Preorder.objects.filter(pk=preorder.pk).exists())
