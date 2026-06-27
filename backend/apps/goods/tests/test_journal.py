import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.goods.models import JournalPage, JournalPageVersion
from apps.users.models import Role, User


class JournalAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="journal_user", role=self.role)
        self.other_user = User.objects.create(username="journal_other", role=self.role)
        self.client.force_authenticate(user=self.user)

    def _create_book(self, title="旅行手帐"):
        response = self.client.post(
            "/api/journals/",
            {"title": title, "description": "贴一点喜欢的谷子"},
            format="json",
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            getattr(response, "data", response.content),
        )
        return response.json()

    def _first_page(self, book_id):
        response = self.client.get(f"/api/journals/{book_id}/pages/")
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            getattr(response, "data", response.content),
        )
        pages = response.json()
        self.assertEqual(len(pages), 1)
        return pages[0]

    def _image_file(self, name="preview.png", color="pink"):
        buf = io.BytesIO()
        Image.new("RGB", (48, 48), color=color).save(buf, format="PNG")
        buf.seek(0)
        return SimpleUploadedFile(name, buf.read(), content_type="image/png")

    def test_create_journal_book_creates_default_page(self):
        book = self._create_book()

        self.assertEqual(book["title"], "旅行手帐")
        self.assertEqual(book["description"], "贴一点喜欢的谷子")
        self.assertIn("id", book)

        page = self._first_page(book["id"])
        self.assertEqual(page["title"], "第 1 页")
        self.assertEqual(page["page_no"], 1)
        self.assertEqual(page["width"], 1080)
        self.assertEqual(page["height"], 1440)
        self.assertEqual(page["background"], "#fffaf0")
        self.assertEqual(page["content"], {"version": 2, "layers": []})
        self.assertEqual(page["revision"], 1)
        self.assertEqual(JournalPageVersion.objects.filter(page_id=page["id"]).count(), 1)

    def test_normal_user_cannot_access_other_users_journal(self):
        book = self._create_book("自己的手帐")

        self.client.force_authenticate(user=self.other_user)
        detail_response = self.client.get(f"/api/journals/{book['id']}/")
        list_response = self.client.get("/api/journals/")

        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.json()["results"], [])

    def test_page_content_json_round_trips(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        content = {
            "version": 1,
            "layers": [
                {
                    "id": "layer-1",
                    "type": "sticker",
                    "goods_id": "00000000-0000-0000-0000-000000000001",
                    "src": "/media/goods/main/a.png",
                    "x": 120,
                    "y": 160,
                    "width": 240,
                    "height": 240,
                    "rotation": 12,
                    "opacity": 0.92,
                    "z_index": 1,
                }
            ],
        }

        patch_response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": content},
            format="json",
        )
        self.assertEqual(
            patch_response.status_code,
            status.HTTP_200_OK,
            getattr(patch_response, "data", patch_response.content),
        )
        self.assertEqual(patch_response.json()["content"], content)

        get_response = self.client.get(f"/api/journal-pages/{page['id']}/")
        self.assertEqual(
            get_response.status_code,
            status.HTTP_200_OK,
            getattr(get_response, "data", get_response.content),
        )
        self.assertEqual(get_response.json()["content"], content)

        versions_response = self.client.get(f"/api/journal-pages/{page['id']}/versions/")
        self.assertEqual(versions_response.status_code, status.HTTP_200_OK)
        versions = versions_response.json()["results"]
        self.assertEqual(versions[0]["version_no"], 2)
        self.assertNotIn("content", versions[0])

        version_detail = self.client.get(f"/api/journal-page-versions/{versions[0]['id']}/")
        self.assertEqual(version_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(version_detail.json()["content"], content)

    def test_auto_save_updates_page_without_creating_version(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        content = {
            "version": 1,
            "layers": [
                {
                    "id": "text-auto-save",
                    "type": "text",
                    "text": "auto",
                    "x": 10,
                    "y": 20,
                    "font_size": 32,
                    "fill": "#333333",
                    "rotation": 0,
                    "z_index": 1,
                }
            ],
        }

        response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": content, "create_version": False, "revision": page["revision"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["content"], content)
        self.assertEqual(response.json()["revision"], page["revision"] + 1)
        self.assertEqual(JournalPageVersion.objects.filter(page_id=page["id"]).count(), 1)

    def test_manual_save_creates_version_and_checks_revision_conflict(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        first_content = {
            "version": 1,
            "layers": [
                {
                    "id": "text-first",
                    "type": "text",
                    "text": "first",
                    "x": 10,
                    "y": 20,
                    "font_size": 32,
                    "fill": "#333333",
                    "rotation": 0,
                    "z_index": 1,
                }
            ],
        }

        first_response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": first_content, "create_version": True, "revision": page["revision"]},
            format="json",
        )
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(first_response.json()["revision"], page["revision"] + 1)
        self.assertEqual(JournalPageVersion.objects.filter(page_id=page["id"]).count(), 2)

        stale_response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": first_content, "create_version": True, "revision": page["revision"]},
            format="json",
        )

        self.assertEqual(stale_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(stale_response.json()["code"], "journal_revision_conflict")

    def test_draw_layer_accepts_known_brush_type(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        content = {
            "version": 1,
            "layers": [
                {
                    "id": "draw-pencil",
                    "type": "draw",
                    "brush_type": "pencil",
                    "points": [1, 2, 3, 4],
                    "stroke": "#123abc",
                    "stroke_width": 4,
                    "opacity": 0.65,
                    "z_index": 1,
                }
            ],
        }

        response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": content, "create_version": True, "revision": page["revision"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["content"], content)

    def test_invalid_draw_layer_brush_type_is_rejected(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        content = {
            "version": 1,
            "layers": [
                {
                    "id": "draw-invalid",
                    "type": "draw",
                    "brush_type": "marker",
                    "points": [1, 2, 3, 4],
                    "stroke": "#123abc",
                    "stroke_width": 4,
                    "opacity": 0.65,
                    "z_index": 1,
                }
            ],
        }

        response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": content, "create_version": True, "revision": page["revision"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("brush_type", str(response.json()))

    def test_draw_layer_with_too_many_points_is_rejected(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        content = {
            "version": 1,
            "layers": [
                {
                    "id": "draw-too-large",
                    "type": "draw",
                    "brush_type": "watercolor",
                    "points": list(range(12002)),
                    "stroke": "#123abc",
                    "stroke_width": 4,
                    "opacity": 0.65,
                    "z_index": 1,
                }
            ],
        }

        response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": content, "create_version": True, "revision": page["revision"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("points", str(response.json()))

    def test_v2_logical_draw_layer_accepts_multiple_stroke_items(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        content = {
            "version": 2,
            "layers": [
                {
                    "id": "draw-layer-1",
                    "type": "draw",
                    "name": "画笔层 1",
                    "opacity": 1,
                    "visible": True,
                    "locked": False,
                    "z_index": 1,
                    "items": [
                        {
                            "id": "stroke-1",
                            "type": "stroke",
                            "brush_type": "pencil",
                            "points": [1, 2, 3, 4],
                            "stroke": "#123abc",
                            "stroke_width": 4,
                            "opacity": 0.65,
                        },
                        {
                            "id": "stroke-2",
                            "type": "stroke",
                            "brush_type": "watercolor",
                            "points": [5, 6, 7, 8],
                            "stroke": "#abcdef",
                            "stroke_width": 8,
                            "opacity": 0.45,
                        },
                    ],
                }
            ],
        }

        response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": content, "create_version": True, "revision": page["revision"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        self.assertEqual(response.json()["content"], content)

    def test_v2_unknown_item_type_is_rejected(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        content = {
            "version": 2,
            "layers": [
                {
                    "id": "draw-layer-1",
                    "type": "draw",
                    "opacity": 1,
                    "z_index": 1,
                    "items": [{"id": "bad-item", "type": "shape"}],
                }
            ],
        }

        response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": content, "create_version": True, "revision": page["revision"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("type", str(response.json()))

    def test_v2_unknown_brush_type_is_rejected(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        content = {
            "version": 2,
            "layers": [
                {
                    "id": "draw-layer-1",
                    "type": "draw",
                    "opacity": 1,
                    "z_index": 1,
                    "items": [
                        {
                            "id": "stroke-1",
                            "type": "stroke",
                            "brush_type": "marker",
                            "points": [1, 2, 3, 4],
                            "stroke": "#123abc",
                            "stroke_width": 4,
                            "opacity": 0.65,
                        }
                    ],
                }
            ],
        }

        response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": content, "create_version": True, "revision": page["revision"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("brush_type", str(response.json()))

    def test_v2_total_draw_points_limit_is_enforced(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        content = {
            "version": 2,
            "layers": [
                {
                    "id": "draw-layer-1",
                    "type": "draw",
                    "opacity": 1,
                    "z_index": 1,
                    "items": [
                        {
                            "id": "stroke-too-large",
                            "type": "stroke",
                            "brush_type": "pen",
                            "points": list(range(12002)),
                            "stroke": "#123abc",
                            "stroke_width": 4,
                            "opacity": 0.65,
                        }
                    ],
                }
            ],
        }

        response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": content, "create_version": True, "revision": page["revision"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("points", str(response.json()))

    def test_page_versions_keep_latest_fifty(self):
        book = self._create_book()
        page = self._first_page(book["id"])

        for index in range(55):
            response = self.client.patch(
                f"/api/journal-pages/{page['id']}/",
                {
                    "content": {
                        "version": 1,
                        "layers": [
                            {
                                "id": f"text-{index}",
                                "type": "text",
                                "text": str(index),
                                "x": 10,
                                "y": 20,
                                "font_size": 32,
                                "fill": "#333333",
                                "rotation": 0,
                                "z_index": 1,
                            }
                        ],
                    }
                },
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        versions = JournalPageVersion.objects.filter(page_id=page["id"])
        self.assertEqual(versions.count(), 50)
        self.assertEqual(versions.order_by("version_no").first().version_no, 7)
        self.assertEqual(versions.order_by("-version_no").first().version_no, 56)

    def test_restore_page_version_updates_current_page_and_creates_version(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        original_version = JournalPageVersion.objects.get(page_id=page["id"], version_no=1)
        changed_content = {
            "version": 1,
            "layers": [
                {
                    "id": "draw-1",
                    "type": "draw",
                    "points": [1, 2, 3, 4],
                    "stroke": "#000000",
                    "stroke_width": 4,
                    "opacity": 1,
                    "z_index": 1,
                }
            ],
        }
        self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"content": changed_content},
            format="json",
        )

        restore_response = self.client.post(f"/api/journal-page-versions/{original_version.id}/restore/")

        self.assertEqual(
            restore_response.status_code,
            status.HTTP_200_OK,
            getattr(restore_response, "data", restore_response.content),
        )
        self.assertEqual(restore_response.json()["content"], {"version": 2, "layers": []})
        refreshed = JournalPage.objects.get(id=page["id"])
        self.assertEqual(refreshed.content, {"version": 2, "layers": []})
        self.assertEqual(JournalPageVersion.objects.filter(page_id=page["id"]).count(), 3)

    def test_get_and_delete_page_version(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        version = JournalPageVersion.objects.get(page_id=page["id"], version_no=1)

        detail_response = self.client.get(f"/api/journal-page-versions/{version.id}/")
        delete_response = self.client.delete(f"/api/journal-page-versions/{version.id}/")

        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.json()["content"], {"version": 2, "layers": []})
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(JournalPageVersion.objects.filter(id=version.id).exists())

    def test_normal_user_cannot_access_other_users_page_versions(self):
        book = self._create_book()
        page = self._first_page(book["id"])
        version = JournalPageVersion.objects.get(page_id=page["id"], version_no=1)

        self.client.force_authenticate(user=self.other_user)
        list_response = self.client.get(f"/api/journal-pages/{page['id']}/versions/")
        detail_response = self.client.get(f"/api/journal-page-versions/{version.id}/")
        restore_response = self.client.post(f"/api/journal-page-versions/{version.id}/restore/")

        self.assertEqual(list_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(restore_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_page_number_is_read_only(self):
        book = self._create_book()
        page = self._first_page(book["id"])

        response = self.client.patch(
            f"/api/journal-pages/{page['id']}/",
            {"page_no": 99, "title": "Updated title"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            getattr(response, "data", response.content),
        )
        self.assertEqual(response.json()["page_no"], 1)
        self.assertEqual(response.json()["title"], "Updated title")

    def test_upload_page_preview_image(self):
        book = self._create_book()
        page = self._first_page(book["id"])

        response = self.client.post(
            f"/api/journal-pages/{page['id']}/upload-preview/",
            {"preview_image": self._image_file()},
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            getattr(response, "data", response.content),
        )
        self.assertIn("/media/journals/previews/", response.json()["preview_image"])

    def test_delete_journal_book_cascades_pages(self):
        book = self._create_book()
        page = self._first_page(book["id"])

        delete_response = self.client.delete(f"/api/journals/{book['id']}/")
        page_response = self.client.get(f"/api/journal-pages/{page['id']}/")

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(page_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(JournalPageVersion.objects.filter(page_id=page["id"]).count(), 0)
