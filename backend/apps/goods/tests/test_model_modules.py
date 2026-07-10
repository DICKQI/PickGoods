from importlib import import_module

from django.test import SimpleTestCase

from apps.goods import models


class GoodsModelModuleLayoutTests(SimpleTestCase):
    def test_models_are_split_by_domain_and_keep_public_exports(self):
        self.assertTrue(
            hasattr(models, "__path__"),
            "apps.goods.models 应为按领域拆分的 Python 包",
        )

        expected_exports = {
            "catalog": ("IP", "IPKeyword", "Character", "Category", "GoodsCraft"),
            "theme": ("Theme", "ThemeImage", "ThemeTemplate"),
            "goods": ("Goods", "GuziImage"),
            "showcase": ("Showcase", "ShowcaseGoods"),
            "journal": (
                "JournalBook",
                "JournalPage",
                "JournalPageVersion",
                "default_journal_page_content",
            ),
            "bgm_sync": ("BGMSyncSettings", "BGMSyncJob", "BGMSyncJobItem"),
        }

        for module_name, export_names in expected_exports.items():
            domain_module = import_module(f"apps.goods.models.{module_name}")
            for export_name in export_names:
                with self.subTest(module=module_name, export=export_name):
                    self.assertIs(
                        getattr(models, export_name),
                        getattr(domain_module, export_name),
                    )
