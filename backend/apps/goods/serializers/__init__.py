"""
Goods app serializers module.
导出所有序列化器，保持向后兼容。
"""
from .fields import AvatarField, KeywordsField
from .ip import (
    IPBatchUpdateOrderSerializer,
    IPDetailSerializer,
    IPKeywordSerializer,
    IPOrderItemSerializer,
    IPSimpleSerializer,
)
from .character import CharacterSimpleSerializer
from .category import (
    CategoryBatchUpdateOrderSerializer,
    CategoryDetailSerializer,
    CategoryOrderItemSerializer,
    CategorySimpleSerializer,
    CategoryTreeSerializer,
)
from .theme import (
    ThemeDetailSerializer,
    ThemeImageSerializer,
    ThemeTemplatePayloadSerializer,
    ThemeTemplateSerializer,
    ThemeSimpleSerializer,
)
from .goods import (
    GoodsDetailSerializer,
    GoodsDuplicateCandidateSerializer,
    GoodsImageClassifyRequestSerializer,
    GoodsImageClassifyResponseSerializer,
    GoodsListSerializer,
    GoodsMoveSerializer,
    GuziImageSerializer,
)
from .showcase import (
    AddGoodsToShowcaseSerializer,
    MoveGoodsInShowcaseSerializer,
    RemoveGoodsFromShowcaseSerializer,
    ShowcaseDetailSerializer,
    ShowcaseGoodsSerializer,
    ShowcaseListSerializer,
)
from .bgm import (
    BGMCharacterSerializer,
    BGMCreateCharacterRequestSerializer,
    BGMCreateCharactersRequestSerializer,
    BGMSearchRequestSerializer,
    BGMSearchResponseSerializer,
    BGMSubjectSerializer,
    BGMSearchSubjectsRequestSerializer,
    BGMSearchSubjectsResponseSerializer,
    BGMGetCharactersBySubjectIdRequestSerializer,
    BGMGetCharactersBySubjectIdResponseSerializer,
    BGMSyncPreviewRequestSerializer,
    BGMSyncDiffItemSerializer,
    BGMSyncPreviewResponseSerializer,
    BGMSyncApplyItemSerializer,
    BGMSyncApplyRequestSerializer,
    BGMSyncApplyResponseSerializer,
)

__all__ = [
    # Fields
    "KeywordsField",
    "AvatarField",
    # IP
    "IPKeywordSerializer",
    "IPSimpleSerializer",
    "IPDetailSerializer",
    "IPOrderItemSerializer",
    "IPBatchUpdateOrderSerializer",
    # Character
    "CharacterSimpleSerializer",
    # Category
    "CategorySimpleSerializer",
    "CategoryTreeSerializer",
    "CategoryOrderItemSerializer",
    "CategoryBatchUpdateOrderSerializer",
    "CategoryDetailSerializer",
    # Theme
    "ThemeSimpleSerializer",
    "ThemeDetailSerializer",
    "ThemeImageSerializer",
    "ThemeTemplateSerializer",
    "ThemeTemplatePayloadSerializer",
    # Goods
    "GuziImageSerializer",
    "GoodsListSerializer",
    "GoodsDetailSerializer",
    "GoodsDuplicateCandidateSerializer",
    "GoodsMoveSerializer",
    "GoodsImageClassifyRequestSerializer",
    "GoodsImageClassifyResponseSerializer",
    # Showcase
    "ShowcaseListSerializer",
    "ShowcaseDetailSerializer",
    "ShowcaseGoodsSerializer",
    "AddGoodsToShowcaseSerializer",
    "RemoveGoodsFromShowcaseSerializer",
    "MoveGoodsInShowcaseSerializer",
    # BGM
    "BGMSearchRequestSerializer",
    "BGMCharacterSerializer",
    "BGMSearchResponseSerializer",
    "BGMCreateCharacterRequestSerializer",
    "BGMCreateCharactersRequestSerializer",
    "BGMSubjectSerializer",
    "BGMSearchSubjectsRequestSerializer",
    "BGMSearchSubjectsResponseSerializer",
    "BGMGetCharactersBySubjectIdRequestSerializer",
    "BGMGetCharactersBySubjectIdResponseSerializer",
    "BGMSyncPreviewRequestSerializer",
    "BGMSyncDiffItemSerializer",
    "BGMSyncPreviewResponseSerializer",
    "BGMSyncApplyItemSerializer",
    "BGMSyncApplyRequestSerializer",
    "BGMSyncApplyResponseSerializer",
]
