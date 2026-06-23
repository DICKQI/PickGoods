"""
Unit tests for goods.bgm_sync.compute_bgm_diff and apply_bgm_sync.

只覆盖核心算法的行为契约，不触达 BGM 外部 HTTP（避免网络依赖）。
"""
from django.test import TestCase

from apps.goods.bgm_sync import apply_bgm_sync, compute_bgm_diff
from apps.goods.models import Character, IP


class ComputeBgmDiffTests(TestCase):
    """compute_bgm_diff 的行为契约测试。"""

    def setUp(self):
        self.ip = IP.objects.create(name="测试作品", subject_type=2)

    def _bgm(self, items):
        return list(items)

    def test_new_character_when_local_empty(self):
        bgm = [{"id": 101, "name": "流萤", "relation": "主角", "avatar": "u"}]
        result = compute_bgm_diff(self.ip, bgm)
        self.assertEqual(result["summary"]["new"], 1)
        self.assertEqual(result["items"][0]["action"], "new")
        self.assertEqual(result["items"][0]["bgm_character_id"], 101)

    def test_matched_by_bgm_character_id(self):
        Character.objects.create(ip=self.ip, name="流萤", bgm_character_id=101)
        bgm = [{"id": 101, "name": "流萤(已改名)", "relation": "主角", "avatar": "u"}]
        result = compute_bgm_diff(self.ip, bgm)
        self.assertEqual(result["summary"]["matched"], 1)
        self.assertEqual(result["summary"]["new"], 0)
        self.assertEqual(result["items"][0]["action"], "matched")

    def test_link_by_name_when_local_has_no_bgm_id(self):
        c = Character.objects.create(ip=self.ip, name="流萤")
        bgm = [{"id": 101, "name": "流萤", "relation": "主角", "avatar": "u"}]
        result = compute_bgm_diff(self.ip, bgm)
        self.assertEqual(result["summary"]["link_by_name"], 1)
        item = next(i for i in result["items"] if i["action"] == "link_by_name")
        self.assertEqual(item["local_character_id"], c.id)
        self.assertEqual(item["bgm_character_id"], 101)

    def test_local_only_when_bgm_does_not_include_local(self):
        Character.objects.create(ip=self.ip, name="花火", bgm_character_id=200)
        bgm = [{"id": 101, "name": "流萤", "relation": "主角", "avatar": "u"}]
        result = compute_bgm_diff(self.ip, bgm)
        self.assertEqual(result["summary"]["local_only"], 1)
        self.assertEqual(result["summary"]["new"], 1)

    def test_skipped_duplicate_when_same_bgm_id_repeats(self):
        bgm = [
            {"id": 101, "name": "流萤", "relation": "主角", "avatar": "u"},
            {"id": 101, "name": "流萤", "relation": "主角", "avatar": "u"},
        ]
        result = compute_bgm_diff(self.ip, bgm)
        self.assertEqual(result["summary"]["new"], 1)
        self.assertEqual(result["summary"]["skipped_duplicate"], 1)

    def test_link_local_with_other_bgm_id_falls_back_to_new(self):
        # 本地同名角色已绑定别的 BGM ID，新来的 BGM 项视作新增更安全
        Character.objects.create(ip=self.ip, name="流萤", bgm_character_id=999)
        bgm = [{"id": 101, "name": "流萤", "relation": "主角", "avatar": "u"}]
        result = compute_bgm_diff(self.ip, bgm)
        # 新增 + 本地独有（local 角色没出现在 matched）
        self.assertEqual(result["summary"]["new"], 1)
        self.assertEqual(result["summary"]["local_only"], 1)


class ApplyBgmSyncTests(TestCase):
    """apply_bgm_sync 的写入行为测试。"""

    def setUp(self):
        self.ip = IP.objects.create(name="测试作品")

    def test_apply_links_subject_id_and_subject_type(self):
        result = apply_bgm_sync(
            ip=self.ip,
            bgm_subject_id=12345,
            items=[],
            bgm_subject_type=2,
            update_subject_type=True,
        )
        self.ip.refresh_from_db()
        self.assertEqual(self.ip.bgm_subject_id, 12345)
        self.assertEqual(self.ip.subject_type, 2)
        self.assertTrue(result["subject_linked"])
        self.assertTrue(result["subject_type_updated"])
        self.assertIsNotNone(self.ip.last_synced_at)

    def test_apply_creates_new_character(self):
        result = apply_bgm_sync(
            ip=self.ip,
            bgm_subject_id=12345,
            items=[{
                "action": "new",
                "bgm_character_id": 101,
                "name": "流萤",
                "avatar": "https://x.png",
                "local_character_id": None,
            }],
        )
        self.assertEqual(result["created_count"], 1)
        c = Character.objects.get(ip=self.ip, name="流萤")
        self.assertEqual(c.bgm_character_id, 101)
        self.assertEqual(c.avatar, "https://x.png")

    def test_apply_link_by_name_backfills_bgm_id(self):
        c = Character.objects.create(ip=self.ip, name="流萤")
        result = apply_bgm_sync(
            ip=self.ip,
            bgm_subject_id=12345,
            items=[{
                "action": "link_by_name",
                "bgm_character_id": 101,
                "name": "流萤",
                "avatar": "",
                "local_character_id": c.id,
            }],
        )
        self.assertEqual(result["linked_count"], 1)
        c.refresh_from_db()
        self.assertEqual(c.bgm_character_id, 101)

    def test_apply_does_not_overwrite_existing_avatar(self):
        c = Character.objects.create(ip=self.ip, name="流萤", avatar="old.png")
        apply_bgm_sync(
            ip=self.ip,
            bgm_subject_id=12345,
            items=[{
                "action": "link_by_name",
                "bgm_character_id": 101,
                "name": "流萤",
                "avatar": "new.png",
                "local_character_id": c.id,
            }],
        )
        c.refresh_from_db()
        self.assertEqual(c.avatar, "old.png")  # 保守策略：不覆盖
