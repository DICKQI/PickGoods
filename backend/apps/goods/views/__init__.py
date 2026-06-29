"""
Goods app views module.
导出所有视图类和函数，保持向后兼容。
"""
from .goods import GoodsFilter, GoodsPagination, GoodsViewSet
from .ip import IPViewSet
from .character import CharacterViewSet
from .category import CategoryViewSet
from .theme import ThemeViewSet
from .showcase import ShowcaseViewSet
from .journal import JournalBookViewSet, JournalPageVersionViewSet, JournalPageViewSet, PublicJournalPageViewSet
from .bgm import (
    bgm_create_characters,
    bgm_search_characters,
    bgm_search_subjects,
    bgm_get_characters_by_subject_id,
)

__all__ = [
    "GoodsViewSet",
    "GoodsFilter",
    "GoodsPagination",
    "IPViewSet",
    "CharacterViewSet",
    "CategoryViewSet",
    "ThemeViewSet",
    "ShowcaseViewSet",
    "JournalBookViewSet",
    "JournalPageViewSet",
    "JournalPageVersionViewSet",
    "PublicJournalPageViewSet",
    "bgm_search_characters",
    "bgm_create_characters",
    "bgm_search_subjects",
    "bgm_get_characters_by_subject_id",
]
