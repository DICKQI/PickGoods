class GoodsImageMatchError(Exception):
    """图片匹配领域异常基类。"""


class InvalidImageError(GoodsImageMatchError):
    """上传内容无法作为受支持图片解码。"""


class ModelUnavailableError(GoodsImageMatchError):
    """本地模型缺失、损坏或运行环境不可用。"""
