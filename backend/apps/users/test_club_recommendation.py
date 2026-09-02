from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.goods.models import Category, Character, ClubCatalogItem, ClubGoodsOrigin, Goods, IP

from .club_recommendation import (
    calculate_club_recommendation_scores,
    rank_club_ids,
)
from .models import Club, ClubFavorite, Role, User


@override_settings(REGISTER_CAPTCHA_ENABLED=False)
class ClubRecommendationTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.owner_role, _ = Role.objects.get_or_create(name="Club Owner")
        self.collector = User.objects.create(username="recommendation-collector", role=self.user_role)
        self.owner = User.objects.create(
            username="recommendation-club-owner",
            role=self.owner_role,
            account_type=User.ACCOUNT_TYPE_CLUB,
        )
        self.ip = IP.objects.create(name="推荐 IP", subject_type=4)
        self.other_ip = IP.objects.create(name="其他 IP", subject_type=2)
        self.root_category = Category.objects.create(name="周边")
        self.category = Category.objects.create(name="徽章", parent=self.root_category)
        self.other_category = Category.objects.create(name="立牌", parent=self.root_category)
        self.character = Character.objects.create(ip=self.ip, name="推荐角色", gender="other")
        self.other_character = Character.objects.create(ip=self.other_ip, name="其他角色", gender="other")

    def create_club(self, name: str) -> Club:
        owner = User.objects.create(
            username=f"owner-{name}",
            role=self.owner_role,
            account_type=User.ACCOUNT_TYPE_CLUB,
        )
        return Club.objects.create(user=owner, name=name)

    def create_item(self, club: Club, *, matching: bool, created_at=None) -> ClubCatalogItem:
        item = ClubCatalogItem.objects.create(
            club=club,
            name=f"{club.name}-谷子",
            ip=self.ip if matching else self.other_ip,
            category=self.category if matching else self.other_category,
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        )
        item.characters.add(self.character if matching else self.other_character)
        if created_at is not None:
            item.created_at = created_at
            item.updated_at = created_at
            item.save(update_fields=["created_at", "updated_at"])
        return item

    def test_matching_content_and_direct_relationship_raise_personalized_score(self):
        matching_club = self.create_club("匹配社团")
        unrelated_club = self.create_club("非匹配社团")
        matching_item = self.create_item(matching_club, matching=True)
        self.create_item(unrelated_club, matching=False)
        personal = Goods.objects.create(
            user=self.collector,
            name="我的推荐谷子",
            ip=self.ip,
            category=self.category,
            quantity=4,
            status="in_cabinet",
        )
        personal.characters.add(self.character)
        ClubGoodsOrigin.objects.create(
            collector=self.collector,
            source_item=matching_item,
            personal_goods=personal,
            first_source_snapshot={},
        )
        ClubFavorite.objects.create(user=self.collector, club=matching_club)

        scores, personalized = calculate_club_recommendation_scores(
            [matching_club.id, unrelated_club.id], self.collector
        )

        self.assertTrue(personalized)
        self.assertGreater(scores[matching_club.id], scores[unrelated_club.id])
        first_order = rank_club_ids([unrelated_club.id, matching_club.id], self.collector, "same")
        second_order = rank_club_ids([unrelated_club.id, matching_club.id], self.collector, "same")
        self.assertEqual(first_order, second_order)

    def test_cold_start_uses_activity_and_freshness_without_personal_signals(self):
        now = timezone.now()
        fresh = self.create_club("新社团")
        old = self.create_club("旧社团")
        self.create_item(fresh, matching=True, created_at=now - timedelta(hours=1))
        self.create_item(old, matching=True, created_at=now - timedelta(days=120))

        scores, personalized = calculate_club_recommendation_scores(
            [fresh.id, old.id], None
        )

        self.assertFalse(personalized)
        self.assertGreater(scores[fresh.id], scores[old.id])

    def test_recommended_api_is_stable_per_seed_and_keeps_pages_disjoint(self):
        clubs = [self.create_club(f"社团 {index:02d}") for index in range(13)]
        for club in clubs:
            self.create_item(club, matching=True)

        first = self.client.get("/api/clubs/?ordering=recommended&recommendation_seed=stable&page_size=5")
        second = self.client.get("/api/clubs/?ordering=recommended&recommendation_seed=stable&page_size=5&page=2")
        repeat = self.client.get("/api/clubs/?ordering=recommended&recommendation_seed=stable&page_size=5")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual([row["id"] for row in first.json()["results"]],
                         [row["id"] for row in repeat.json()["results"]])
        first_ids = {row["id"] for row in first.json()["results"]}
        second_ids = {row["id"] for row in second.json()["results"]}
        self.assertTrue(first_ids.isdisjoint(second_ids))

        orders = {
            tuple(row["id"] for row in self.client.get(
                f"/api/clubs/?ordering=recommended&recommendation_seed=seed-{seed}&page_size=100"
            ).json()["results"])
            for seed in range(10)
        }
        self.assertGreater(len(orders), 1)

    def test_recommended_api_validates_scope_and_default_name_ordering(self):
        second = self.create_club("Alpha Club")
        first = self.create_club("Beta Club")
        self.create_item(first, matching=True)
        self.create_item(second, matching=True)

        default = self.client.get("/api/clubs/")
        self.assertEqual([row["name"] for row in default.json()["results"]], ["Alpha Club", "Beta Club"])
        self.assertEqual(
            self.client.get("/api/clubs/?ordering=recommended").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.get("/api/clubs/?ordering=recommended&recommendation_seed=x&search=社团").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.get("/api/clubs/?ordering=unknown").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.get("/api/clubs/?recommendation_seed=x").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.get("/api/clubs/?ordering=recommended&recommendation_seed=bad.seed").status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_recommendation_query_count_is_bounded(self):
        clubs = [self.create_club(f"批量社团 {index:03d}") for index in range(30)]
        for club in clubs:
            self.create_item(club, matching=True)

        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(
                "/api/clubs/?ordering=recommended&recommendation_seed=bounded&page_size=10"
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLess(len(queries), 18)
