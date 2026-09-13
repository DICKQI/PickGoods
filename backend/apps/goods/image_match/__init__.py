"""谷子主图视觉匹配能力。"""

from .exceptions import InvalidImageError, ModelUnavailableError
from .features import (
    ImageFingerprint,
    QueryFeatures,
    decode_image,
    extract_main_fingerprint,
    extract_query_features,
    hamming_distance,
)
from .indexing import refresh_goods_image_fingerprint, schedule_fingerprint_refresh
from .service import MatchCandidate, MatchOutcome, match_goods_image

__all__ = [
    "ImageFingerprint",
    "InvalidImageError",
    "MatchCandidate",
    "MatchOutcome",
    "ModelUnavailableError",
    "QueryFeatures",
    "decode_image",
    "extract_main_fingerprint",
    "extract_query_features",
    "hamming_distance",
    "match_goods_image",
    "refresh_goods_image_fingerprint",
    "schedule_fingerprint_refresh",
]
