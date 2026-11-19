"""
自定义序列化器字段
"""
import os
from uuid import uuid4
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework import serializers

from ..cover_cache import CoverCacheError, absolute_cover_url, normalize_cover_input
from ..models import IPKeyword
from ..utils import compress_image


class KeywordsField(serializers.Field):
    """自定义关键词字段：读取时返回对象数组，写入时接收字符串数组"""

    def to_representation(self, value):
        """读取时：返回关键词对象数组"""
        if value is None:
            return []
        # value是RelatedManager，需要调用all()获取查询集
        return [{"id": kw.id, "value": kw.value} for kw in value.all()]

    def to_internal_value(self, data):
        """写入时：接收字符串数组"""
        if data is None:
            return []
        if not isinstance(data, list):
            raise serializers.ValidationError("关键词必须是数组格式")
        # 去重、去空、去除前后空格
        keywords = [str(item).strip() for item in data if item and str(item).strip()]
        # 去重（保持顺序）
        seen = set()
        result = []
        for kw in keywords:
            if kw not in seen:
                seen.add(kw)
                result.append(kw)
        return result


class AvatarField(serializers.Field):
    """
    自定义头像字段：
    - 支持文件上传（保存到服务器并存储相对路径）
    - 支持URL字符串（直接存储）
    - 返回时：本地路径返回完整URL，外部URL直接返回
    """
    
    def to_representation(self, value):
        """读取时：本地路径返回完整URL，外部URL直接返回"""
        if not value:
            return None
        
        # 判断是否为外部URL（以http://或https://开头）
        if value.startswith('http://') or value.startswith('https://'):
            return value
        
        # 本地路径，构建完整URL
        request = self.context.get('request')
        if request:
            # 使用MEDIA_URL构建完整URL
            from django.conf import settings
            if value.startswith(settings.MEDIA_URL):
                return request.build_absolute_uri(value)
            else:
                # 确保路径以MEDIA_URL开头
                media_url = settings.MEDIA_URL
                if not value.startswith(media_url):
                    value = media_url + value.lstrip('/')
                return request.build_absolute_uri(value)
        else:
            # 没有request对象时，返回原始值
            from django.conf import settings
            if not value.startswith('http'):
                media_url = settings.MEDIA_URL
                if not value.startswith(media_url):
                    value = media_url + value.lstrip('/')
            return value
    
    def to_internal_value(self, data):
        """写入时：处理文件上传或URL字符串"""
        if data is None or data == '':
            return None
        
        # 如果是文件上传对象
        if hasattr(data, 'read'):
            # 压缩图片
            compressed_image = compress_image(data, max_size_kb=300) or data
            
            # 保存文件到服务器
            upload_to = "characters/"
            
            # 获取原始文件名
            original_name = compressed_image.name if hasattr(compressed_image, 'name') else 'avatar.jpg'
            file_name = os.path.basename(original_name)
            
            # 生成唯一文件名（避免覆盖）
            name, ext = os.path.splitext(file_name)
            unique_name = f"{name}_{uuid4().hex[:8]}{ext}"
            
            # 构建保存路径
            file_path = os.path.join(upload_to, unique_name)
            
            # 保存文件
            saved_path = default_storage.save(file_path, compressed_image)
            
            # 返回相对路径（相对于MEDIA_ROOT）
            return saved_path
        
        # 如果是URL字符串
        if isinstance(data, str):
            data = data.strip()
            if not data:
                return None
            
            # 如果是外部URL，直接返回
            if data.startswith('http://') or data.startswith('https://'):
                return data
            
            # 如果是相对路径，确保格式正确
            # 移除开头的斜杠和MEDIA_URL前缀（如果存在）
            from django.conf import settings
            if data.startswith(settings.MEDIA_URL):
                data = data[len(settings.MEDIA_URL):]
            data = data.lstrip('/')
            
            return data
        
        raise serializers.ValidationError("头像必须是文件或URL字符串")

class IPCoverField(serializers.CharField):
    """IP 作品封面字段。

    - 读取：把库里的 /media/ips/covers/... 补成绝对 URL（nginx 不服务 /media/，
      所以必须绝对；与 Goods.main_photo 的 DRF ImageField 行为一致）；
    - 写入：外链一律由后端下载转存到本站媒体目录（cover_cache），
      /media/... 原样保留，空字符串/null 表示清除。
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("required", False)
        kwargs.setdefault("allow_null", True)
        kwargs.setdefault("allow_blank", True)
        kwargs.setdefault("max_length", 500)
        super().__init__(**kwargs)

    def to_representation(self, value):
        request = self.context.get("request")
        return absolute_cover_url(request, value)

    def to_internal_value(self, data):
        if data is None:
            return None
        text = str(data).strip()
        if not text:
            return None
        try:
            return normalize_cover_input(text)
        except CoverCacheError as exc:
            raise serializers.ValidationError(str(exc)) from exc

class IsPersonalField(serializers.BooleanField):
    """归属标记字段：读时为「该作品是否个人作品」，写时为「是否创建个人作品」。

    - 写：只有管理员新建时生效（普通账号恒为个人作品，序列化器会忽略该值）；
    - 读：直接看 IP.user 是否为空，前端不必自己推断。
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("required", False)
        kwargs.setdefault("default", False)
        super().__init__(**kwargs)

    def get_attribute(self, instance):
        # 读取时先拿模型实例本身，再由 to_representation 判断归属
        return instance

    def to_representation(self, instance):
        return getattr(instance, "user_id", None) is not None
