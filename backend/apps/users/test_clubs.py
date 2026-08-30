from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.goods.models import (
    Category,
    Character,
    ClubCatalogItem,
    ClubCatalogImage,
    ClubGoodsImportEvent,
    ClubGoodsOrigin,
    Goods,
    IP,
    Theme,
)

from .models import Club, Role, User


class ClubFeatureAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.club_user = User.objects.create(
            username="club-owner", role=self.user_role, account_type=User.ACCOUNT_TYPE_CLUB,
            approval_status=User.APPROVAL_APPROVED,
        )
        self.club = Club.objects.create(user=self.club_user, name="公开社团", application_reason="测试申请")
        self.collector = User.objects.create(username="collector", role=self.user_role)
        self.other_collector = User.objects.create(username="collector-2", role=self.user_role)
        self.ip = IP.objects.create(name="测试 IP", subject_type=4)
        self.category = Category.objects.create(name="徽章")
        self.character = Character.objects.create(ip=self.ip, name="角色", gender="other")
        self.source = ClubCatalogItem.objects.create(
            club=self.club,
            name="社团徽章",
            description="公开说明",
            ip=self.ip,
            category=self.category,
            public_price="88.00",
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        )
        self.source.characters.add(self.character)

    def test_club_registration_is_pending_and_cannot_login(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "pending-club", "password": "pending-pass", "account_type": "club",
                "application_reason": "希望发布原创谷子",
                "club_profile": {"name": "待审批社团"},
            }, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.json()["code"], "account_pending")
        pending = User.objects.get(username="pending-club")
        self.assertFalse(pending.is_active)
        login = self.client.post("/api/auth/login/", {"username": "pending-club", "password": "pending-pass"}, format="json")
        self.assertEqual(login.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(login.json()["code"], "account_pending")

    def test_club_store_links_only_accept_http_urls(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "unsafe-club", "password": "pending-pass", "account_type": "club",
                "application_reason": "申请理由",
                "club_profile": {"name": "危险链接社团", "store_links": [{"label": "店铺", "url": "javascript:alert(1)"}]},
            }, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("club_profile", response.json())

    def test_club_platform_urls_are_optional_and_exposed_on_public_and_me_endpoints(self):
        self.assertIsNone(self.club.taobao_url)
        self.assertIsNone(self.club.xiaohongshu_url)
        self.assertIsNone(self.club.weidian_url)

        public = self.client.get(f"/api/clubs/{self.club.id}/")
        self.assertEqual(public.status_code, status.HTTP_200_OK)
        self.assertIsNone(public.json()["taobao_url"])
        self.assertIsNone(public.json()["xiaohongshu_url"])
        self.assertIsNone(public.json()["weidian_url"])

        self.client.force_authenticate(self.club_user)
        updated = self.client.patch(
            "/api/clubs/me/",
            {
                "taobao_url": "https://shop.taobao.com/example",
                "xiaohongshu_url": "https://www.xiaohongshu.com/user/example",
                "weidian_url": "https://weidian.com/item/example",
                "store_links": [{"label": "其他入口", "url": "https://example.com"}],
            },
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.json()["taobao_url"], "https://shop.taobao.com/example")
        self.assertEqual(updated.json()["xiaohongshu_url"], "https://www.xiaohongshu.com/user/example")
        self.assertEqual(updated.json()["weidian_url"], "https://weidian.com/item/example")
        self.assertEqual(updated.json()["store_links"][0]["label"], "其他入口")

        me = self.client.get("/api/clubs/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.json()["weidian_url"], "https://weidian.com/item/example")

        cleared = self.client.patch(
            "/api/clubs/me/",
            {"taobao_url": "", "xiaohongshu_url": None, "weidian_url": ""},
            format="json",
        )
        self.assertEqual(cleared.status_code, status.HTTP_200_OK)
        self.assertIsNone(cleared.json()["taobao_url"])
        self.assertIsNone(cleared.json()["xiaohongshu_url"])
        self.assertIsNone(cleared.json()["weidian_url"])
        self.club.refresh_from_db()
        self.assertEqual(self.club.store_links, [{"label": "其他入口", "url": "https://example.com"}])

    def test_club_platform_urls_only_accept_http_urls(self):
        self.client.force_authenticate(self.club_user)
        response = self.client.patch(
            "/api/clubs/me/",
            {"taobao_url": "ftp://shop.example.com/item"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("taobao_url", response.json())

    def test_admin_approve_and_reject_pending_clubs(self):
        admin = User.objects.create(username="admin-test", role=self.admin_role)
        self.client.force_authenticate(admin)
        pending = User.objects.create(
            username="pending", role=self.user_role, account_type=User.ACCOUNT_TYPE_CLUB,
            approval_status=User.APPROVAL_PENDING, is_active=False,
        )
        Club.objects.create(user=pending, name="待审资料", application_reason="理由")
        approved = self.client.post(f"/api/admin/users/{pending.id}/approve/")
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        pending.refresh_from_db()
        self.assertTrue(pending.is_active)
        self.assertEqual(pending.approval_status, User.APPROVAL_APPROVED)

        rejected = User.objects.create(
            username="rejected", role=self.user_role, account_type=User.ACCOUNT_TYPE_CLUB,
            approval_status=User.APPROVAL_PENDING, is_active=False,
        )
        Club.objects.create(user=rejected, name="将被删除", application_reason="理由")
        result = self.client.post(f"/api/admin/users/{rejected.id}/reject/")
        self.assertEqual(result.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=rejected.id).exists())

    def test_public_directory_only_returns_listed_catalog_fields(self):
        pending_user = User.objects.create(
            username="pending-public", role=self.user_role, account_type=User.ACCOUNT_TYPE_CLUB,
            approval_status=User.APPROVAL_PENDING, is_active=False,
        )
        pending_club = Club.objects.create(user=pending_user, name="不可见社团", application_reason="理由")
        ClubCatalogItem.objects.create(
            club=pending_club, name="不可见条目", ip=self.ip, category=self.category,
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        )
        ClubCatalogItem.objects.create(
            club=self.club, name="下架条目", ip=self.ip, category=self.category,
            publication_status=ClubCatalogItem.PUBLICATION_UNLISTED,
        )
        response = self.client.get("/api/clubs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["name"] for item in response.json()["results"]], ["公开社团"])

        goods = self.client.get(f"/api/clubs/{self.club.id}/goods/")
        self.assertEqual(goods.status_code, status.HTTP_200_OK)
        self.assertEqual([item["name"] for item in goods.json()["results"]], ["社团徽章"])
        item = goods.json()["results"][0]
        self.assertEqual(item["description"], "公开说明")
        for private_field in ("quantity", "location", "purchase_date", "notes", "status", "source_club_goods"):
            self.assertNotIn(private_field, item)

        detail = self.client.get(f"/api/clubs/{self.club.id}/goods/{self.source.id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertNotIn("quantity", detail.json())

    def test_public_directory_includes_latest_limited_previews_with_photo_fallback(self):
        now = timezone.now()
        self.source.created_at = now - timedelta(hours=1)
        self.source.updated_at = self.source.created_at
        self.source.save(update_fields=["created_at", "updated_at"])
        items = []
        for index in range(7):
            item = ClubCatalogItem.objects.create(
                club=self.club,
                name=f"目录预览 {index}",
                ip=self.ip,
                category=self.category,
                public_price=f"{index + 1}.00",
                publication_status=ClubCatalogItem.PUBLICATION_LISTED,
            )
            item.created_at = now - timedelta(minutes=index)
            item.updated_at = item.created_at
            item.save(update_fields=["created_at", "updated_at"])
            if index == 0:
                item.main_photo = "club_catalog/main/hero.jpg"
                item.save(update_fields=["main_photo"])
            elif index == 1:
                ClubCatalogImage.objects.create(item=item, image="club_catalog/extra/fallback.jpg", label="展示图")
            items.append(item)

        ClubCatalogItem.objects.create(
            club=self.club,
            name="目录草稿",
            ip=self.ip,
            category=self.category,
            publication_status=ClubCatalogItem.PUBLICATION_DRAFT,
        )
        response = self.client.get("/api/clubs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        club_payload = response.json()["results"][0]
        previews = club_payload["preview_goods"]
        self.assertEqual(len(previews), 5)
        self.assertEqual([item["name"] for item in previews], [f"目录预览 {index}" for index in range(5)])
        self.assertTrue(previews[0]["preview_photo"].endswith("/media/club_catalog/main/hero.jpg"))
        self.assertTrue(previews[1]["preview_photo"].endswith("/media/club_catalog/extra/fallback.jpg"))
        self.assertIsNone(previews[2]["preview_photo"])
        self.assertEqual(previews[0]["public_price"], "1.00")
        self.assertTrue(previews[0]["is_official"])
        for preview in previews:
            for private_field in ("quantity", "location", "purchase_date", "notes", "status", "description"):
                self.assertNotIn(private_field, preview)

    def test_club_catalog_crud_is_separate_from_personal_goods(self):
        self.client.force_authenticate(self.club_user)
        payload = {
            "name": "目录新条目",
            "description": "公开介绍",
            "ip_id": self.ip.id,
            "category_id": self.category.id,
            "character_ids": [self.character.id],
            "publication_status": "listed",
        }
        created = self.client.post("/api/clubs/me/goods/", payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.json()["publication_status"], "listed")
        catalog = ClubCatalogItem.objects.get(name="目录新条目")

        forbidden = self.client.post("/api/goods/", {
            "name": "错误入口", "ip_id": self.ip.id, "category_id": self.category.id,
            "character_ids": [self.character.id], "status": "in_cabinet",
        }, format="json")
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        updated = self.client.patch(f"/api/clubs/me/goods/{catalog.id}/", {"publication_status": "unlisted"}, format="json")
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.json()["publication_status"], "unlisted")

    def test_import_template_and_personal_snapshot_are_independent(self):
        self.client.force_authenticate(self.collector)
        template = self.client.get(f"/api/clubs/{self.club.id}/goods/{self.source.id}/import-template/")
        self.assertEqual(template.status_code, status.HTTP_200_OK)
        self.assertEqual(template.json()["defaults"]["price"], "88.00")
        self.assertIsNone(template.json()["defaults"]["theme_id"])
        self.assertIsNone(template.json()["defaults"]["theme_name"])
        self.assertIsNone(template.json()["defaults"]["purchase_date"])
        self.assertEqual(template.json()["defaults"]["notes"], "")

        imported = self.client.post(
            f"/api/clubs/goods/{self.source.id}/import/",
            {"status": "intended", "name": "我的自定义名称", "notes": "个人备注", "price": "99.00"},
            format="json",
        )
        self.assertEqual(imported.status_code, status.HTTP_201_CREATED)
        self.assertFalse(imported.json()["merged"])
        goods = Goods.objects.get(user=self.collector)
        self.assertEqual(goods.name, "我的自定义名称")
        self.assertEqual(goods.notes, "个人备注")
        self.assertEqual(str(goods.price), "99.00")
        self.assertTrue(ClubGoodsOrigin.objects.filter(collector=self.collector, source_item=self.source, personal_goods=goods).exists())
        self.assertEqual(ClubGoodsImportEvent.objects.filter(origin__personal_goods=goods).count(), 1)

        self.source.name = "来源修改后的名称"
        self.source.description = "来源新说明"
        self.source.save(update_fields=["name", "description", "updated_at"])
        goods.refresh_from_db()
        self.assertEqual(goods.name, "我的自定义名称")
        self.assertEqual(goods.notes, "个人备注")

    def test_import_theme_is_copied_when_omitted_and_can_be_cleared_explicitly(self):
        source_theme = Theme.objects.create(user=self.club_user, name="社团主题", description="社团主题说明")
        self.source.theme = source_theme
        self.source.save(update_fields=["theme"])
        self.client.force_authenticate(self.collector)

        imported = self.client.post(
            f"/api/clubs/goods/{self.source.id}/import/", {"status": "intended", "quantity": 3}, format="json"
        )
        self.assertEqual(imported.status_code, status.HTTP_201_CREATED)
        copied_goods = Goods.objects.get(user=self.collector)
        self.assertEqual(copied_goods.quantity, 3)
        self.assertIsNotNone(copied_goods.theme)
        self.assertEqual(copied_goods.theme.name, "社团主题")
        self.assertEqual(copied_goods.theme.user_id, self.collector.id)

        second_source = ClubCatalogItem.objects.create(
            club=self.club, name="无主题条目", ip=self.ip, category=self.category,
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        )
        second_source.characters.add(self.character)
        cleared = self.client.post(
            f"/api/clubs/goods/{second_source.id}/import/",
            {"status": "intended", "theme_id": None}, format="json",
        )
        self.assertEqual(cleared.status_code, status.HTTP_201_CREATED)
        cleared_goods = Goods.objects.exclude(id=copied_goods.id).get(user=self.collector)
        self.assertIsNone(cleared_goods.theme)

    def test_duplicate_import_requires_confirmation_and_only_increases_quantity(self):
        self.client.force_authenticate(self.collector)
        first = self.client.post(f"/api/clubs/goods/{self.source.id}/import/", {"status": "intended"}, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        origin = ClubGoodsOrigin.objects.get(collector=self.collector, source_item=self.source)
        goods = origin.personal_goods
        duplicate = self.client.post(f"/api/clubs/goods/{self.source.id}/import/", {"status": "sold", "name": "不应覆盖"}, format="json")
        self.assertEqual(duplicate.status_code, status.HTTP_409_CONFLICT)
        confirmed = self.client.post(f"/api/clubs/goods/{self.source.id}/import/", {"status": "sold", "confirm_duplicate": True}, format="json")
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.assertTrue(confirmed.json()["merged"])
        goods.refresh_from_db()
        self.assertEqual(goods.quantity, 2)
        self.assertEqual(goods.status, "intended")
        self.assertEqual(ClubGoodsImportEvent.objects.filter(origin=origin, operation="merged").count(), 1)

    def test_popularity_counts_unique_collectors_and_ignores_admin(self):
        origin = ClubGoodsOrigin.objects.create(collector=self.collector, source_item=self.source)
        goods = Goods.objects.create(user=self.collector, name="收藏", ip=self.ip, category=self.category, status="intended")
        origin.personal_goods = goods
        origin.save(update_fields=["personal_goods"])
        admin = User.objects.create(username="popularity-admin", role=self.admin_role)
        admin_origin = ClubGoodsOrigin.objects.create(collector=admin, source_item=self.source)
        admin_goods = Goods.objects.create(user=admin, name="管理员", ip=self.ip, category=self.category, status="intended")
        admin_origin.personal_goods = admin_goods
        admin_origin.save(update_fields=["personal_goods"])

        self.client.force_authenticate(self.club_user)
        response = self.client.get("/api/clubs/me/popularity/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["intended_user_count"], 1)

    def test_source_delete_keeps_personal_goods_and_origin_history(self):
        self.client.force_authenticate(self.collector)
        response = self.client.post(f"/api/clubs/goods/{self.source.id}/import/", {"status": "intended"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        origin = ClubGoodsOrigin.objects.get(source_item=self.source)
        goods_id = origin.personal_goods_id
        self.source.delete()
        origin.refresh_from_db()
        self.assertIsNone(origin.source_item_id)
        self.assertTrue(Goods.objects.filter(id=goods_id).exists())

    def test_club_cannot_access_collector_workspaces(self):
        self.client.force_authenticate(self.club_user)
        self.assertEqual(self.client.get("/api/location/nodes/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/api/showcases/private/").status_code, status.HTTP_403_FORBIDDEN)
