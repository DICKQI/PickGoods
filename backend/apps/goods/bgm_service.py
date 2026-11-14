"""
BGM API 服务模块
提供搜索IP作品和获取角色列表的核心功能
支持按作品类型（动画、游戏、书籍等）筛选
"""
import html
import os
import urllib.parse
import requests

# --- 配置部分 ---
# 请在这里填入你的 Access Token，或设置环境变量 BGM_ACCESS_TOKEN
ACCESS_TOKEN = os.environ.get("BGM_ACCESS_TOKEN", "")
# 指定的 User-Agent
USER_AGENT = "DSCWWW/ShiGu(https://github.com/DICKQI/ShiGu_backend)"

# API 基础 URL
API_HOST = "https://api.bgm.tv"

# --- 作品类型常量 (Subject Type) ---
SUBJECT_TYPE_BOOK = 1   # 书籍
SUBJECT_TYPE_ANIME = 2  # 动画
SUBJECT_TYPE_MUSIC = 3  # 音乐
SUBJECT_TYPE_GAME = 4   # 游戏
SUBJECT_TYPE_REAL = 6   # 三次元/特摄

def get_headers(access_token=None):
    """
    构造请求头，包含 User-Agent 和 Authorization

    ``access_token`` 为 None 时使用服务端环境变量里的 token（管理员与后台任务）；
    传入字符串时使用该用户自己的 token（个人 IP 的 Bangumi 导入/同步）。
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    token = ACCESS_TOKEN if access_token is None else access_token
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def search_subject(keyword, subject_type=None, access_token=None):
    """
    搜索条目，返回第一个匹配结果的 ID 和 名称。
    使用 Legacy Search API 进行模糊匹配。
    
    Args:
        keyword (str): 搜索关键词（IP名称）
        subject_type (int, optional): 作品类型 (1:书籍, 2:动画, 3:音乐, 4:游戏, 6:三次元). 默认为 None (搜索所有).
    
    Returns:
        tuple: (subject_id, display_name) 或 (None, None) 如果未找到
    """
    # URL 路径中的关键词仍需手动编码
    encoded_keyword = urllib.parse.quote(keyword)
    url = f"{API_HOST}/search/subject/{encoded_keyword}"
    
    # 构造查询参数
    params = {
        "responseGroup": "small"
    }
    # 如果指定了类型，则添加到参数中
    if subject_type:
        params["type"] = subject_type
    
    try:
        # requests 会自动处理 params 的拼接
        response = requests.get(url, headers=get_headers(access_token), params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if "list" in data and data["list"]:
            first_result = data["list"][0]
            subject_id = first_result.get("id")
            name = first_result.get("name")
            name_cn = first_result.get("name_cn")
            
            # 优先显示中文名，并解码HTML实体
            display_name = name_cn if name_cn else name
            if display_name:
                display_name = html.unescape(display_name)
            if name:
                name = html.unescape(name)
            
            return subject_id, display_name
        else:
            return None, None

    except requests.exceptions.RequestException as e:
        raise Exception(f"搜索请求失败: {str(e)}")


def get_characters(subject_id, access_token=None):
    """
    获取指定条目 ID 下的所有角色名。
    针对附件提供的 JSON 结构进行解析。
    
    Args:
        subject_id: BGM条目ID
    
    Returns:
        list: 角色列表，每个角色包含 name, relation, avatar 字段
    """
    url = f"{API_HOST}/v0/subjects/{subject_id}/characters"
    
    try:
        response = requests.get(url, headers=get_headers(access_token), timeout=30)
        response.raise_for_status()
        data = response.json()
        
        characters = []
        
        if isinstance(data, list):
            for item in data:
                # 根据附件 JSON，name 和 relation 直接在 item 根节点
                name = item.get("name")
                relation = item.get("relation", "未知")
                
                # 提取头像URL (grid尺寸)
                images = item.get("images", {})
                avatar_url = ""
                if isinstance(images, dict):
                    avatar_url = images.get("grid", "")

                # BGM 角色 ID（用于增量同步精确匹配）
                bgm_character_id = item.get("id")

                # 只有当名字存在时才添加，并解码HTML实体（如 &amp; -> &）
                if name:
                    name = html.unescape(name)  # 解码HTML实体编码
                    characters.append({
                        "id": bgm_character_id,
                        "name": name,
                        "relation": relation,
                        "avatar": avatar_url
                    })
            
            # --- 排序逻辑 ---
            # 定义关系优先级：主角 > 配角 > 客串 > 其他
            priority = {"主角": 1, "配角": 2, "客串": 3}
            
            # 使用 lambda 进行排序，未知的关系放到最后(99)
            characters.sort(key=lambda x: priority.get(x["relation"], 99))
            
            return characters
        else:
            return []

    except requests.exceptions.RequestException as e:
        raise Exception(f"获取角色请求失败: {str(e)}")


def search_subjects_list(keyword, subject_type=None, access_token=None):
    """
    搜索条目，返回所有匹配结果的列表。
    使用 Legacy Search API 进行模糊匹配。
    
    Args:
        keyword (str): 搜索关键词（IP名称）
        subject_type (int, optional): 作品类型 (1:书籍, 2:动画, 3:音乐, 4:游戏, 6:三次元). 默认为 None (搜索所有).
    
    Returns:
        list: 作品列表，每个作品包含 id, name, name_cn, type, type_name, image 等字段
    """
    # 作品类型映射
    TYPE_NAMES = {
        1: "书籍",
        2: "动画",
        3: "音乐",
        4: "游戏",
        6: "三次元/特摄"
    }
    
    # URL 路径中的关键词需要手动编码
    encoded_keyword = urllib.parse.quote(keyword)
    url = f"{API_HOST}/search/subject/{encoded_keyword}"
    
    # 构造查询参数
    params = {
        "responseGroup": "small"
    }
    # 如果指定了类型，则添加到参数中
    if subject_type:
        params["type"] = subject_type
    
    try:
        # requests 会自动处理 params 的拼接
        response = requests.get(url, headers=get_headers(access_token), params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        subjects = []
        if "list" in data and data["list"]:
            for item in data["list"]:
                subject_id = item.get("id")
                name = item.get("name", "")
                name_cn = item.get("name_cn", "")
                subject_type_code = item.get("type")
                
                # 解码HTML实体
                if name:
                    name = html.unescape(name)
                if name_cn:
                    name_cn = html.unescape(name_cn)
                
                # 获取封面图
                images = item.get("images", {})
                image_url = ""
                if isinstance(images, dict):
                    # 优先使用 large，其次 common，最后 medium
                    image_url = images.get("large") or images.get("common") or images.get("medium", "")
                
                subjects.append({
                    "id": subject_id,
                    "name": name,
                    "name_cn": name_cn,
                    "type": subject_type_code,
                    "type_name": TYPE_NAMES.get(subject_type_code, "未知"),
                    "image": image_url
                })
        
        return subjects

    except requests.exceptions.RequestException as e:
        raise Exception(f"搜索请求失败: {str(e)}")


def get_subject_info(subject_id, access_token=None):
    """
    根据BGM作品ID获取作品基本信息
    
    Args:
        subject_id (int): BGM作品ID
    
    Returns:
        dict: 作品信息，包含 id, name, name_cn 等字段，如果未找到返回 None
    """
    url = f"{API_HOST}/v0/subjects/{subject_id}"
    
    try:
        response = requests.get(url, headers=get_headers(access_token), timeout=30)
        response.raise_for_status()
        data = response.json()
        
        name = data.get("name", "")
        name_cn = data.get("name_cn", "")
        subject_type_code = data.get("type")

        # 解码HTML实体
        if name:
            name = html.unescape(name)
        if name_cn:
            name_cn = html.unescape(name_cn)

        # 优先返回中文名
        display_name = name_cn if name_cn else name

        return {
            "id": subject_id,
            "name": name,
            "name_cn": name_cn,
            "display_name": display_name,
            "type": subject_type_code,
            "images": data.get("images") or {},
        }

    except requests.exceptions.RequestException as e:
        raise Exception(f"获取作品信息失败: {str(e)}")


# --- 封面相关 ---
# BGM 图片域：legacy 搜索接口返回 http://lain.bgm.tv/...，HTTPS 页面会触发混合内容拦截，
# 因此凡是往库里/前端写的图片地址，统一归一为 https。
IMAGE_HOST_PREFIX_HTTP = "http://lain.bgm.tv"
IMAGE_HOST_PREFIX_HTTPS = "https://lain.bgm.tv"

# 封面尺寸优先级：原图（large）> 400 宽（common）> 800 宽（medium）> 网格缩略（grid）> 小图（small）
COVER_IMAGE_KEYS = ("large", "common", "medium", "grid", "small")


def normalize_image_url(url):
    """把 BGM 图片地址统一成 https 绝对地址。"""
    if not isinstance(url, str):
        return ""
    url = url.strip()
    if not url:
        return ""
    if url.startswith(IMAGE_HOST_PREFIX_HTTP):
        return IMAGE_HOST_PREFIX_HTTPS + url[len(IMAGE_HOST_PREFIX_HTTP):]
    if url.startswith("//"):
        return "https:" + url
    return url


def pick_cover_url(images):
    """从 BGM 的 images 字典里挑一张最适合做封面的图。

    Args:
        images: BGM 返回的 images 字典，例如 {"large": "...", "common": "..."}

    Returns:
        str | None: https 绝对地址；没有任何可用图时返回 None
    """
    if not isinstance(images, dict):
        return None

    for key in COVER_IMAGE_KEYS:
        url = normalize_image_url(images.get(key))
        if url:
            return url
    return None


def search_subject_candidates(keyword, subject_type=None, limit=10, access_token=None):
    """按关键词搜索 BGM 条目，返回带封面图的候选列表。

    使用 v0 搜索接口（https 图片地址、无需 Access Token）。

    Args:
        keyword (str): 搜索关键词（一般是 IP 作品名）
        subject_type (int, optional): 作品类型，传入时只搜该类型
        limit (int, optional): 返回条数上限，默认 10

    Returns:
        list: 每个候选包含 id, name, name_cn, type, images

    Raises:
        Exception: 请求 BGM 失败时抛出
    """
    url = f"{API_HOST}/v0/search/subjects"

    payload = {"keyword": keyword}
    if subject_type:
        payload["filter"] = {"type": [subject_type]}

    try:
        response = requests.post(
            url,
            headers=get_headers(access_token),
            params={"limit": limit},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        candidates = []
        for item in data.get("data") or []:
            name = html.unescape(item.get("name") or "")
            name_cn = html.unescape(item.get("name_cn") or "")
            candidates.append({
                "id": item.get("id"),
                "name": name,
                "name_cn": name_cn,
                "type": item.get("type"),
                "images": item.get("images") or {},
            })
        return candidates

    except requests.exceptions.RequestException as e:
        raise Exception(f"搜索封面请求失败: {str(e)}")


def search_ip_characters(ip_name, subject_type=None, access_token=None):
    """
    搜索IP作品并获取其角色列表的便捷方法
    
    Args:
        ip_name (str): IP作品名称
        subject_type (int, optional): 作品类型 (1:书籍, 2:动画, 3:音乐, 4:游戏, 6:三次元). 默认为 None.
    
    Returns:
        tuple: (ip_display_name, characters_list) 或 (None, []) 如果未找到
    """
    subject_id, display_name = search_subject(ip_name, subject_type, access_token=access_token)
    if subject_id and display_name:
        # print(f"找到作品: {display_name} (ID: {subject_id})") # 调试用
        characters = get_characters(subject_id, access_token=access_token)
        return display_name, characters
    return None, []

