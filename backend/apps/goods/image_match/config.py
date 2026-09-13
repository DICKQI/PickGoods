from pathlib import Path

from django.conf import settings

ALGORITHM_VERSION = "dinov2-small-int8-v1"
MATCH_PIPELINE_VERSION = "dinov2-small-int8-v2-rerank"
MODEL_REPOSITORY = "Xenova/dinov2-small"
MODEL_REVISION = "c2bb04a51fab207c420665f1946016107bffc701"
MODEL_FILENAME = "model_quantized.onnx"
MODEL_REPOSITORY_PATH = f"onnx/{MODEL_FILENAME}"
MODEL_SHA256 = "3afdc8bc63b50558d6e5770f5b799bb82455c2311183a2de43803f343a29d917"
MODEL_SIZE = 24_451_943
MODEL_INPUT_SIZE = 224
MODEL_EMBEDDING_DIM = 384
QUERY_CROP_RATIOS = (1.0, 0.85)
CANDIDATE_LIMIT = 3
RERANK_LIMIT = 8
PATCH_TOP_K = 16
PATCH_WEIGHT = 0.35
ELIGIBLE_STATUSES = ("in_cabinet", "outdoor")
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000


def get_model_path() -> Path:
    return Path(settings.GOODS_IMAGE_MATCH_MODEL_PATH)


def get_model_url() -> str:
    return (
        f"https://huggingface.co/{MODEL_REPOSITORY}/resolve/"
        f"{MODEL_REVISION}/{MODEL_REPOSITORY_PATH}"
    )


def get_model_threads() -> int:
    return max(1, int(settings.GOODS_IMAGE_MATCH_MODEL_THREADS))


def get_phash_distance_max() -> int:
    return max(0, int(settings.GOODS_IMAGE_MATCH_PHASH_DISTANCE_MAX))


def get_embedding_match_min() -> float:
    return float(settings.GOODS_IMAGE_MATCH_EMBEDDING_MIN)


def get_match_margin_min() -> float:
    return float(settings.GOODS_IMAGE_MATCH_MARGIN_MIN)


def get_candidate_min_score() -> float:
    return float(settings.GOODS_IMAGE_MATCH_CANDIDATE_MIN)


def get_rerank_limit() -> int:
    return max(0, int(getattr(settings, "GOODS_IMAGE_MATCH_RERANK_LIMIT", RERANK_LIMIT)))


def get_patch_top_k() -> int:
    return max(1, int(getattr(settings, "GOODS_IMAGE_MATCH_PATCH_TOP_K", PATCH_TOP_K)))


def get_patch_weight() -> float:
    return min(
        0.8,
        max(0.0, float(getattr(settings, "GOODS_IMAGE_MATCH_PATCH_WEIGHT", PATCH_WEIGHT))),
    )
