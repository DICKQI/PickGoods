from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.goods.models import (
    Category,
    Character,
    ClubCatalogItem,
    ClubGoodsImportEvent,
    Goods,
    IP,
    Theme,
)
from apps.users.models import Club, Role, User

from .models import (
    Achievement,
    AchievementSet,
    GamificationConfig,
    Reward,
    RuleCondition,
    RuleGroup,
    UserAchievement,
    UserReward,
)
from .services import evaluate_user, reconcile_club_achievements


@override_settings(GAMIFICATION_ENABLED=True)
class ClubGamificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        GamificationConfig.objects.create(pk=1, rollout_at=timezone.now())
        self.collector_role = Role.objects.create(name="user")
        self.admin_role = Role.objects.create(name="admin")
        self.collector = User.objects.create(
            username="club-reward-collector",
            role=self.collector_role,
        )
        self.other_collector = User.objects.create(
            username="club-reward-other",
            role=self.collector_role,
        )
        self.club_user = User.objects.create(
            username="club-reward-owner",
            role=self.collector_role,
            account_type=User.ACCOUNT_TYPE_CLUB,
            approval_status=User.APPROVAL_APPROVED,
        )
        self.other_club_user = User.objects.create(
            username="club-reward-owner-b",
            role=self.collector_role,
            account_type=User.ACCOUNT_TYPE_CLUB,
            approval_status=User.APPROVAL_APPROVED,
        )
        self.club = Club.objects.create(user=self.club_user, name="社团 A")
        self.other_club = Club.objects.create(
            user=self.other_club_user,
            name="社团 B",
        )
        self.ip = IP.objects.create(name="测试 IP")
        self.category = Category.objects.create(name="吧唧")
        self.character = Character.objects.create(name="测试角色", ip=self.ip)
        self.theme = Theme.objects.create(user=self.club_user, name="夏日系列")
        self.item = ClubCatalogItem.objects.create(
            club=self.club,
            name="夏日吧唧",
            ip=self.ip,
            category=self.category,
            theme=self.theme,
            public_price=Decimal("50.00"),
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        )
        self.item.characters.add(self.character)
        self.reward = Reward.objects.create(
            club=self.club,
            code="club-test-badge",
            name="社团徽章",
            reward_type=Reward.TYPE_BADGE,
        )

    def _achievement(
        self,
        *,
        club,
        code,
        metric=RuleCondition.METRIC_CLUB_GOODS_QUANTITY,
        threshold="1",
        filters=None,
        rewards=None,
    ):
        achievement_set = AchievementSet.objects.create(
            club=club,
            code=f"set-{code}",
            name=f"系列 {code}",
            is_active=True,
        )
        achievement = Achievement.objects.create(
            code=code,
            set=achievement_set,
            name=f"成就 {code}",
            is_active=True,
            first_published_at=timezone.now(),
        )
        group = RuleGroup.objects.create(
            achievement=achievement,
            operator=RuleGroup.OPERATOR_ALL,
        )
        RuleCondition.objects.create(
            group=group,
            metric=metric,
            threshold=Decimal(str(threshold)),
            filters=filters or {},
        )
        if rewards:
            achievement.rewards.set(rewards)
        return achievement

    def _import(
        self,
        source=None,
        *,
        quantity=1,
        price="50.00",
        status="in_cabinet",
    ):
        self.client.force_authenticate(self.collector)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                f"/api/clubs/goods/{(source or self.item).id}/import/",
                {
                    "status": status,
                    "quantity": quantity,
                    "price": price,
                },
                format="json",
            )

    def test_import_only_progresses_matching_club_achievement(self):
        own = self._achievement(club=self.club, code="club-a-import")
        other = self._achievement(club=self.other_club, code="club-b-import")

        response = self._import(quantity=2)

        self.assertEqual(response.status_code, 201)
        state = UserAchievement.objects.get(
            user=self.collector,
            achievement=own,
        )
        self.assertEqual(state.status, UserAchievement.STATUS_UNLOCKED)
        self.assertEqual(
            state.progress["groups"][0]["conditions"][0]["current"],
            2.0,
        )
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.collector,
                achievement=other,
            ).exists()
        )

    def test_reconcile_materializes_missing_club_achievement_states(self):
        achievement = self._achievement(
            club=self.club,
            code="club-a-reconcile",
        )
        self._import()
        UserAchievement.objects.filter(
            user=self.collector,
            achievement=achievement,
        ).delete()

        reconcile_club_achievements()

        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.collector,
                achievement=achievement,
                status=UserAchievement.STATUS_UNLOCKED,
            ).exists()
        )

    def test_import_before_first_publication_does_not_count(self):
        achievement = self._achievement(
            club=self.club,
            code="club-a-after-publish",
        )
        first = self._import()
        self.assertEqual(first.status_code, 201)
        UserAchievement.objects.filter(
            user=self.collector,
            achievement=achievement,
        ).delete()
        Achievement.objects.filter(pk=achievement.pk).update(
            first_published_at=timezone.now() + timedelta(minutes=1)
        )

        evaluate_user(self.collector, club=self.club, force=True)

        state = UserAchievement.objects.get(
            user=self.collector,
            achievement=achievement,
        )
        self.assertEqual(state.status, UserAchievement.STATUS_LOCKED)
        self.assertEqual(
            state.progress["groups"][0]["conditions"][0]["current"],
            0.0,
        )

    def test_spend_uses_catalog_snapshot_and_item_filters(self):
        achievement = self._achievement(
            club=self.club,
            code="club-a-spend",
            metric=RuleCondition.METRIC_CLUB_SPEND_AMOUNT,
            threshold="100",
            filters={"catalog_item_ids": [str(self.item.id)]},
            rewards=[self.reward],
        )

        response = self._import(quantity=2, price="1.00")

        self.assertEqual(response.status_code, 201)
        state = UserAchievement.objects.get(
            user=self.collector,
            achievement=achievement,
        )
        condition = state.progress["groups"][0]["conditions"][0]
        self.assertEqual(condition["current"], 100.0)
        self.assertTrue(condition["satisfied"])

    def test_draft_import_only_counts_after_status_changes(self):
        achievement = self._achievement(
            club=self.club,
            code="club-a-draft",
        )
        response = self._import(status="draft")
        self.assertEqual(response.status_code, 201)
        state = UserAchievement.objects.get(
            user=self.collector,
            achievement=achievement,
        )
        self.assertEqual(state.status, UserAchievement.STATUS_LOCKED)

        goods = Goods.objects.get(user=self.collector)
        goods.status = "in_cabinet"
        with self.captureOnCommitCallbacks(execute=True):
            goods.save(update_fields=["status", "updated_at"])

        state.refresh_from_db()
        self.assertEqual(state.status, UserAchievement.STATUS_UNLOCKED)
        self.assertEqual(
            state.progress["groups"][0]["conditions"][0]["current"],
            1.0,
        )

    def test_draft_import_uses_first_effective_time_for_limited_window(self):
        achievement = self._achievement(
            club=self.club,
            code="club-a-effective-time",
        )
        response = self._import(status="draft")
        self.assertEqual(response.status_code, 201)
        event = ClubGoodsImportEvent.objects.get(origin__collector=self.collector)
        ClubGoodsImportEvent.objects.filter(pk=event.pk).update(
            created_at=timezone.now() - timedelta(hours=1)
        )
        achievement.set.is_limited = True
        achievement.set.starts_at = timezone.now() - timedelta(minutes=1)
        achievement.set.ends_at = timezone.now() + timedelta(hours=1)
        achievement.set.save(
            update_fields=[
                "is_limited",
                "starts_at",
                "ends_at",
                "updated_at",
            ]
        )
        Achievement.objects.filter(pk=achievement.pk).update(
            first_published_at=timezone.now() - timedelta(minutes=2),
            is_limited=True,
        )

        goods = Goods.objects.get(user=self.collector)
        goods.status = "in_cabinet"
        with self.captureOnCommitCallbacks(execute=True):
            goods.save(update_fields=["status", "updated_at"])

        state = UserAchievement.objects.get(
            user=self.collector,
            achievement=achievement,
        )
        self.assertEqual(state.status, UserAchievement.STATUS_UNLOCKED)
        self.assertIsNotNone(
            ClubGoodsImportEvent.objects.get(pk=event.pk).effective_at
        )

    def test_status_change_after_limited_window_does_not_unlock(self):
        achievement = self._achievement(
            club=self.club,
            code="club-a-effective-time-late",
        )
        response = self._import(status="draft")
        self.assertEqual(response.status_code, 201)
        achievement.set.is_limited = True
        achievement.set.starts_at = timezone.now() - timedelta(hours=1)
        achievement.set.ends_at = timezone.now() + timedelta(minutes=5)
        achievement.set.save(
            update_fields=[
                "is_limited",
                "starts_at",
                "ends_at",
                "updated_at",
            ]
        )
        Achievement.objects.filter(pk=achievement.pk).update(
            first_published_at=timezone.now() - timedelta(hours=1),
            is_limited=True,
        )
        achievement.set.ends_at = timezone.now() - timedelta(seconds=1)
        achievement.set.save(update_fields=["ends_at", "updated_at"])

        goods = Goods.objects.get(user=self.collector)
        goods.status = "in_cabinet"
        with self.captureOnCommitCallbacks(execute=True):
            goods.save(update_fields=["status", "updated_at"])

        state = UserAchievement.objects.get(
            user=self.collector,
            achievement=achievement,
        )
        self.assertEqual(state.status, UserAchievement.STATUS_LOCKED)

    def test_public_overview_and_claim_flow(self):
        achievement = self._achievement(
            club=self.club,
            code="club-a-public",
            rewards=[self.reward],
        )
        self._import()

        anonymous = APIClient().get(f"/api/clubs/{self.club.id}/gamification/")
        self.assertEqual(anonymous.status_code, 200)
        self.assertTrue(anonymous.json()["sets"])
        self.assertIsNone(anonymous.json()["sets"][0]["achievements"][0]["status"])

        self.client.force_authenticate(self.collector)
        authenticated = self.client.get(f"/api/clubs/{self.club.id}/gamification/")
        self.assertTrue(
            authenticated.json()["sets"][0]["achievements"][0]["can_claim"]
        )
        claimed = self.client.post(
            f"/api/gamification/achievements/{achievement.id}/claim/"
        )
        self.assertEqual(claimed.status_code, 200)
        self.assertTrue(
            UserReward.objects.filter(
                user=self.collector,
                reward=self.reward,
            ).exists()
        )

    def test_personal_views_hide_other_clubs_and_keep_earned_claims(self):
        achievement = self._achievement(
            club=self.club,
            code="club-a-personal",
            rewards=[self.reward],
        )
        self._import()

        self.client.force_authenticate(self.collector)
        overview = self.client.get("/api/gamification/overview/")
        self.assertEqual(overview.status_code, 200)
        self.assertIn(
            achievement.id,
            [
                item["achievement"]["id"]
                for item in overview.json()["achievements"]
            ],
        )
        rewards = self.client.get("/api/gamification/rewards/")
        self.assertIn(
            self.reward.id,
            [item["id"] for item in rewards.json()["results"]],
        )

        self.client.force_authenticate(self.other_collector)
        other_overview = self.client.get("/api/gamification/overview/")
        self.assertNotIn(
            achievement.id,
            [
                item["achievement"]["id"]
                for item in other_overview.json()["achievements"]
            ],
        )

        AchievementSet.objects.filter(pk=achievement.set_id).update(is_active=False)
        self.client.force_authenticate(self.collector)
        claimed = self.client.post(
            f"/api/gamification/achievements/{achievement.id}/claim/"
        )
        self.assertEqual(claimed.status_code, 200)

    def test_club_management_is_scoped_and_requires_club_account(self):
        self.client.force_authenticate(self.club_user)
        created = self.client.post(
            "/api/clubs/me/gamification/sets/",
            {"name": "自有系列", "is_active": True},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertTrue(created.json()["code"].startswith(f"club-{self.club.id}-"))

        other_set = AchievementSet.objects.create(
            club=self.other_club,
            code="other-club-set",
            name="其他社团",
        )
        response = self.client.get(
            f"/api/clubs/me/gamification/sets/{other_set.id}/"
        )
        self.assertEqual(response.status_code, 404)

        self.client.force_authenticate(self.collector)
        forbidden = self.client.get("/api/clubs/me/gamification/sets/")
        self.assertEqual(forbidden.status_code, 403)

    def test_club_cannot_attach_another_clubs_reward(self):
        own_set = AchievementSet.objects.create(
            club=self.club,
            code="own-set",
            name="自有系列",
        )
        other_reward = Reward.objects.create(
            club=self.other_club,
            code="other-reward",
            name="其他奖励",
            reward_type=Reward.TYPE_BADGE,
        )
        self.client.force_authenticate(self.club_user)
        response = self.client.post(
            "/api/clubs/me/gamification/achievements/",
            {
                "set": own_set.id,
                "name": "非法成就",
                "root_operator": "ALL",
                "is_active": True,
                "order": 0,
                "rewards": [other_reward.id],
                "rule_groups": [
                    {
                        "operator": "ALL",
                        "order": 0,
                        "conditions": [
                            {
                                "metric": "CLUB_GOODS_QUANTITY",
                                "threshold": "1",
                                "filters": {},
                                "order": 0,
                            }
                        ],
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
