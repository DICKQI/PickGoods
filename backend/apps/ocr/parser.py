"""
淘宝订单截图 OCR 解析器。

从 PaddleOCR 识别结果中提取结构化字段：
- 商品名称、价格、数量、入手日期、店铺名
- 并结合 jieba 分词与数据库进行 IP/角色/品类模糊匹配。
- 预购定金单（parse_preorder）：定金、尾款、预计出货（补款）时间。
"""
import re
import logging
from datetime import date
from rapidfuzz import fuzz
from decimal import Decimal
from typing import Any, Optional

try:
    import jieba
    _JIEBA_AVAILABLE = True
except ImportError:
    jieba = None
    _JIEBA_AVAILABLE = False

logger = logging.getLogger(__name__)

# ── 正则模式 ──────────────────────────────────────────────────

# 价格：¥12.50  ￥12.50  12.50元  合计:12.50
# 优先匹配带小数点的价格（两位小数），无小数点作为低优先兜底
_PRICE_RE = re.compile(
    r'(?:¥|￥|价格|单价|金额|合计|总价|实付|售价)[\s：:]*(\d+\.?\d*)'
)
_PRICE_ANY_RE = re.compile(r'[¥￥]\s*(\d+\.?\d*)|(?<!\d)(\d+\.\d{2})\s*(?:元|块)')
_PRICE_FALLBACK_RE = re.compile(r'(\d+\.\d{2})\s*(?:元|块)')
_PRICE_INT_FALLBACK_RE = re.compile(r'(?<!\d)(\d{1,6})\s*(?:元|块)(?!\d)')

# 日期：2025-06-01 或 2025/06/01 或 2025年06月01日
_DATE_RE = re.compile(
    r'(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})[日]?'
)

# 数量：×1  x1  *1  数量:1  1件  1个
_QUANTITY_RE = re.compile(
    r'[×xX\*]\s*(\d+)|数量[：:]\s*(\d+)|(\d+)\s*[件个]'
)

# 订单号：纯数字长串 (>12位)。
# 用数字前后环视而非 \b：中文（如「订单号5127…」）与数字间无词边界，
# \b 会漏检，导致订单号行不被判噪音、被兜底选为商品名称。
_ORDER_NO_RE = re.compile(r'(?<!\d)(\d{14,})(?!\d)')

# 店铺：含 "店" 或 "铺" 的行
_SHOP_KEYWORDS = ('店', '铺', '店铺')

# 同人/非官相关
_UNOFFICIAL_KEYWORDS = ('同人', '非官', '自制', '自印', '非官方', 'fanart', 'Fan')

# 品类关键词映射 (OCR中常见叫法 → 品类名称)
# 按 key 长度降序排列，确保长关键词优先匹配（如 "亚克力挂件" 先于 "亚克力"）
_CATEGORY_HINTS_RAW = {
    '亚克力挂件': '亚克力挂件', '金属徽章': '金属徽章', '棉花娃娃': '棉花娃娃',
    '亚克力立牌': '亚克力立牌', '流沙摆件': '流沙摆件', '亚克力': '亚克力立牌',
    '摇摇乐': '摇摇乐', '镭射票': '镭射票', '拍立得': '拍立得', '明信片': '明信片',
    '吧唧': '吧唧', '徽章': '徽章', '立牌': '亚克力立牌', '色纸': '色纸',
    '透卡': '透卡', '小卡': '小卡', '团子': '团子', '痛包': '痛包', '印章': '印章',
    '胶带': '胶带', '挂件': '亚克力挂件', '流沙': '流沙摆件', '摆件': '流沙摆件',
    '钥匙扣': '亚克力挂件', '毛绒': '棉花娃娃', '娃娃': '棉花娃娃',
    '贴纸': '胶带', '海报': '明信片',
}
_CATEGORY_HINTS = sorted(_CATEGORY_HINTS_RAW.items(), key=lambda x: len(x[0]), reverse=True)

_SUMMARY_KEYWORDS = (
    '商品总价', '实付款', '订单信息', '赠品', '店铺优惠', '确认收货', '查看物流',
    '催发货', '查看详情', '复制',
)
_SUMMARY_LINE_RE = re.compile(r'^共\s*\d+\s*件$')
_SERVICE_KEYWORDS = (
    '退货宝', '假一赔四', '极速退款', '加入购物车', '申请售后', '退款',
    '进店逛逛', '客服', '更多', '再买一单', '不支持7天无理由', '7天无理由退货',
)
_PRODUCT_TITLE_RE = re.compile(r'【[^】\n]{2,}(?:】|$)')
_ASCII_NOISE_RE = re.compile(r'^[A-Za-z0-9\s:：._/\-]+$')
_TRADE_SNAPSHOT_LINE_RE = re.compile(r'^[【\[\(（]?\s*交易快照\s*[】\]\)）]?$')
_TRADE_SNAPSHOT_SUFFIX_RE = re.compile(r'\s*[【\[\(（]?\s*交易快照\s*[】\]\)）]?\s*$')
_SALE_STATUS_PREFIX_RE = re.compile(r'^\s*现货\s*')


# ── 预编译正则 ──────────────────────────────────────────────────
_CLEAN_OCR_BRACKET_RE = re.compile(r'[【】『』「」\[\]()（）]')
_CLEAN_OCR_SEP_RE = re.compile(r'[/／：:·]')
_COMPACT_NAME_RE = re.compile(r'[【】『』「」\[\]()（）/／：:·\s]')


def _clean_ocr_name(name: str) -> str:
    """清理 OCR 文本中的括号、分隔符等噪音，提高子串匹配精度。"""
    name = _CLEAN_OCR_BRACKET_RE.sub(' ', name)
    name = _CLEAN_OCR_SEP_RE.sub(' ', name)
    return ' '.join(name.split())


def _compact_name(name: str) -> str:
    """去除所有括号、分隔符和空格，用于 OCR 吞掉分隔符时的容错匹配。"""
    return _COMPACT_NAME_RE.sub('', name)


def _is_trade_snapshot_line(text: str) -> bool:
    return bool(_TRADE_SNAPSHOT_LINE_RE.fullmatch(text.strip()))


def _strip_trade_snapshot_suffix(text: str) -> str:
    return _TRADE_SNAPSHOT_SUFFIX_RE.sub('', text.strip()).strip()


def _clean_item_name_part(text: str) -> str | None:
    text = _strip_trade_snapshot_suffix(text)
    text = _SALE_STATUS_PREFIX_RE.sub('', text).strip()
    text = ' '.join(text.split())
    return text or None


def _tokenize(text: str) -> list[str]:
    """jieba 分词，返回长度 ≥2 的 token 列表。jieba 不可用时返回原文。"""
    if _JIEBA_AVAILABLE and jieba is not None:
        try:
            tokens = list(jieba.cut(text))
        except Exception:
            return [text]
        return [t.strip() for t in tokens if len(t.strip()) >= 2]
    return [text]


def _token_threshold(token: str) -> float:
    """短 token 信息量低，需更严格阈值防误伤。"""
    n = len(token)
    if n <= 2:
        return 0.80
    if n == 3:
        return 0.67
    return 0.55


def _decimal_to_string(value: str) -> str | None:
    try:
        return str(Decimal(value))
    except Exception:
        return None


def _box_to_list(box: Any) -> list[float] | None:
    if box is None:
        return None
    if hasattr(box, 'tolist'):
        box = box.tolist()
    if not isinstance(box, (list, tuple)) or len(box) < 4:
        return None
    try:
        return [float(box[0]), float(box[1]), float(box[2]), float(box[3])]
    except Exception:
        return None


def _normalize_ocr_entries(ocr_entries: list[dict]) -> list[dict]:
    normalized = []
    for index, entry in enumerate(ocr_entries):
        text = str(entry.get('text') or '').strip()
        if not text:
            continue
        try:
            score = float(entry.get('score', 1.0))
        except Exception:
            score = 1.0
        box = _box_to_list(entry.get('box'))
        if box is None:
            box = [0.0, float(index * 10), 0.0, float(index * 10 + 1)]
        left, top, right, bottom = box
        normalized.append({
            'text': text,
            'score': score,
            'box': [left, top, right, bottom],
            'left': left,
            'top': top,
            'right': right,
            'bottom': bottom,
            'x_center': (left + right) / 2,
            'y_center': (top + bottom) / 2,
        })
    return sorted(normalized, key=lambda item: (item['top'], item['left']))


def _is_summary_line(text: str) -> bool:
    return any(keyword in text for keyword in _SUMMARY_KEYWORDS) or bool(_SUMMARY_LINE_RE.fullmatch(text.strip()))


def _is_product_title_line(text: str) -> bool:
    if _is_summary_line(text):
        return False
    return bool(_PRODUCT_TITLE_RE.search(text))


def _is_line_noise_for_name(text: str) -> bool:
    if _is_summary_line(text) or any(keyword in text for keyword in _SERVICE_KEYWORDS):
        return True
    if _PRICE_ANY_RE.search(text):
        return True
    if re.fullmatch(r'[×xX]\s*\d+', text):
        return True
    if re.fullmatch(r'\d+\s*[件个]', text):
        return True
    if _ORDER_NO_RE.search(text):
        return True
    if _ASCII_NOISE_RE.fullmatch(text):
        return True
    return False


def _extract_order_date(lines: list[dict]) -> str | None:
    for line in reversed(lines):
        match = _DATE_RE.search(line['text'])
        if match:
            year = match.group(1)
            month = match.group(2).zfill(2)
            day = match.group(3).zfill(2)
            return f'{year}-{month}-{day}'
    return None


def _extract_shop_name(lines: list[dict]) -> str | None:
    for line in lines:
        text = line['text']
        if '旗舰店' in text or '店铺' in text or text.endswith('店'):
            return text
    return None


def _line_height(line: dict) -> float:
    return max(1.0, float(line['bottom'] - line['top']))


def _vertical_overlap_ratio(a: dict, b: dict) -> float:
    overlap = min(a['bottom'], b['bottom']) - max(a['top'], b['top'])
    if overlap <= 0:
        return 0.0
    return overlap / min(_line_height(a), _line_height(b))


def _is_same_row(line: dict, anchor: dict) -> bool:
    center_distance = abs(line['y_center'] - anchor['y_center'])
    tolerance = max(12.0, _line_height(anchor) * 0.7, _line_height(line) * 0.7)
    return _vertical_overlap_ratio(line, anchor) >= 0.35 or center_distance <= tolerance


def _split_item_blocks(lines: list[dict]) -> list[list[dict]]:
    summary_y = None
    for line in lines:
        if _is_summary_line(line['text']):
            summary_y = line['y_center']
            break

    title_lines = [
        line for line in lines
        if (summary_y is None or line['y_center'] < summary_y)
        and _is_product_title_line(line['text'])
    ]
    title_lines.sort(key=lambda line: line['y_center'])

    blocks = []
    for pos, title_line in enumerate(title_lines):
        next_title = title_lines[pos + 1] if pos + 1 < len(title_lines) else None
        lower_margin = max(32.0, _line_height(title_line) * 1.1)
        lower_y = title_line['y_center'] - lower_margin
        if next_title:
            upper_margin = max(32.0, _line_height(next_title) * 1.1)
            upper_y = next_title['y_center'] - upper_margin
        else:
            upper_y = summary_y if summary_y is not None else float('inf')

        block = [
            line for line in lines
            if lower_y <= line['y_center'] < upper_y
            and not _is_summary_line(line['text'])
        ]
        if block:
            rest = sorted(
                [line for line in block if line is not title_line],
                key=lambda line: (line['top'], line['left']),
            )
            blocks.append([title_line, *rest])
    return blocks


def _extract_item_price(block: list[dict]) -> tuple[str | None, str | None]:
    price_candidates = []
    title_line = next((line for line in block if _is_product_title_line(line['text'])), block[0] if block else None)
    if title_line is None:
        return None, '未识别到商品实付价'

    for line in block:
        match = _PRICE_ANY_RE.search(line['text'])
        if not match:
            continue
        value = match.group(1) or match.group(2)
        price = _decimal_to_string(value)
        if price is None:
            continue
        # Taobao paid price is in the right price column on the title row. The
        # gray original price usually sits on the next detail row, so same-row
        # overlap must beat raw y-distance.
        same_row_rank = 0 if _is_same_row(line, title_line) else 1
        currency_rank = 0 if match.group(1) else 1
        price_candidates.append((
            same_row_rank,
            abs(line['y_center'] - title_line['y_center']),
            currency_rank,
            -line['x_center'],
            price,
        ))
    if not price_candidates:
        return None, '未识别到商品实付价'
    price_candidates.sort()
    return price_candidates[0][4], None


def _extract_item_quantity(block: list[dict]) -> tuple[int, list[str]]:
    warnings = []
    for line in block:
        match = _QUANTITY_RE.search(line['text'])
        if not match:
            continue
        qty_str = match.group(1) or match.group(2) or match.group(3)
        try:
            quantity = int(qty_str)
        except Exception:
            continue
        if not (1 <= quantity <= 999):
            continue
        if quantity > 1 and line['score'] < 0.85:
            warnings.append(f'数量 "{line["text"]}" 置信度较低，已默认按 1 处理')
            return 1, warnings
        return quantity, warnings
    return 1, warnings


def _extract_item_name(block: list[dict]) -> tuple[str | None, list[str]]:
    warnings = []
    if not block:
        return None, ['未识别到商品名称']

    main_left = max(0.0, block[0]['left'] - 40)
    parts = []
    for line in block:
        text = line['text'].strip()
        if line['right'] < main_left:
            continue
        if _is_line_noise_for_name(text):
            continue
        if len(text) < 2:
            continue
        if not parts or text not in parts:
            parts.append(text)

    if not parts:
        return None, ['未识别到商品名称']
    name = ' '.join(parts)
    return name, warnings


def parse_ocr_items(ocr_entries: list[dict]) -> list[dict]:
    """
    从带坐标的 OCR 文本中拆分多个淘宝商品条目。

    每个条目对应截图中一个可见商品行；不根据“共 N 件”推断截图外商品。
    """
    lines = _normalize_ocr_entries(ocr_entries)
    if not lines:
        return []

    order_date = _extract_order_date(lines)
    shop_name = _extract_shop_name(lines)
    blocks = _split_item_blocks(lines)

    if not blocks:
        parsed = parse_ocr_results([line['text'] for line in lines])
        if not parsed:
            return []
        parsed['source_lines'] = [line['text'] for line in lines]
        parsed['warnings'] = ['未能可靠拆分多个商品，已按单条结果返回']
        return [parsed]

    items = []
    for block in blocks:
        source_lines = [line['text'] for line in block]
        raw_text = '\n'.join(source_lines)
        base = parse_ocr_results(source_lines)
        name, name_warnings = _extract_item_name(block)
        price, price_warning = _extract_item_price(block)
        quantity, quantity_warnings = _extract_item_quantity(block)

        warnings = []
        warnings.extend(name_warnings)
        warnings.extend(quantity_warnings)
        if price_warning:
            warnings.append(price_warning)

        items.append({
            'name': name or base.get('name'),
            'price': price or base.get('price'),
            'quantity': quantity,
            'purchase_date': order_date or base.get('purchase_date'),
            'is_official': base.get('is_official', True),
            'shop_name': shop_name or base.get('shop_name'),
            'raw_text': raw_text,
            'source_lines': source_lines,
            'warnings': warnings,
        })

    return items


def _fuzzy_match(text: str, candidates: list[tuple[int, str]], threshold: float = 0.6):
    """
    模糊匹配：从候选列表中找出与 text 最相似的项。

    Args:
        text: 待匹配文本
        candidates: [(id, name), ...] 候选列表
        threshold: 最低相似度阈值

    Returns:
        (id, name, confidence) 或 (None, None, 0)
    """
    if not text or not candidates:
        return None, None, 0.0
    best_id, best_name, best_score = None, None, 0.0
    for cid, cname in candidates:
        score = fuzz.ratio(text, cname) / 100.0
        if score > best_score:
            best_score = score
            best_id = cid
            best_name = cname
    if best_score >= threshold:
        return best_id, best_name, round(best_score, 3)
    return None, None, round(best_score, 3)


def parse_ocr_results(ocr_lines: list[str]) -> dict:
    """
    从 OCR 文本行中提取结构化字段。

    Args:
        ocr_lines: PaddleOCR 返回的文本行列表（已按从上到下排列）

    Returns:
        解析结果字典
    """
    if not ocr_lines:
        return {}

    raw_text = '\n'.join(ocr_lines)

    price = None
    purchase_date = None
    quantity = 1
    shop_name = None
    is_official = True

    for line in ocr_lines:
        s = line.strip()
        if not s:
            continue

        # 价格
        if price is None:
            m = _PRICE_RE.search(s)
            if m:
                try:
                    price = str(Decimal(m.group(1)))
                except Exception:
                    pass

        # 日期
        if purchase_date is None:
            m = _DATE_RE.search(s)
            if m:
                y, mo, d = m.group(1), m.group(2).zfill(2), m.group(3).zfill(2)
                purchase_date = f'{y}-{mo}-{d}'

        # 数量
        if quantity == 1:
            m = _QUANTITY_RE.search(s)
            if m:
                qty_str = m.group(1) or m.group(2) or m.group(3)
                try:
                    q = int(qty_str)
                    if 1 <= q <= 999:
                        quantity = q
                except Exception:
                    pass

        # 店铺
        if shop_name is None:
            if any(kw in s for kw in _SHOP_KEYWORDS):
                shop_name = s

        # 非官判断
        if is_official:
            if any(kw.lower() in s.lower() for kw in _UNOFFICIAL_KEYWORDS):
                is_official = False

    # 价格兜底 (正则1没匹配到时)：优先匹配两位小数，再匹配整数元
    if price is None:
        m = _PRICE_FALLBACK_RE.search(raw_text)
        if not m:
            m = _PRICE_INT_FALLBACK_RE.search(raw_text)
        if m:
            try:
                price = str(Decimal(m.group(1)))
            except Exception:
                pass

    # 商品名：取最长有效文本行（排除价格/日期/店铺/纯数字行）
    name_candidates = []
    for line in ocr_lines:
        s = line.strip()
        if not s or len(s) < 2:
            continue
        if _PRICE_RE.search(s) or _DATE_RE.search(s):
            continue
        if _ORDER_NO_RE.search(s):
            continue
        if any(kw in s for kw in _SHOP_KEYWORDS):
            continue
        if re.fullmatch(r'[\d\s\.\-+×xX\*¥￥,，]+', s):
            continue
        name_candidates.append(s)

    # 优先选包含品类关键词的行（长关键词优先），否则选最长行
    name = None
    for s in name_candidates:
        for hint_text, _hint_cat_name in _CATEGORY_HINTS:
            if hint_text in s:
                name = s
                break
        if name:
            break
    if name is None and name_candidates:
        name = max(name_candidates, key=len)

    return {
        'name': name,
        'price': price,
        'quantity': quantity,
        'purchase_date': purchase_date,
        'is_official': is_official,
        'shop_name': shop_name,
        'raw_text': raw_text,
    }


# ── 预购（定金单）解析 ──────────────────────────────────────────

# 定金单特征关键词：全文命中任一即判定为预购定金单
# 注：不含「全款」（全款预付不是定金+尾款模式），避免误入
_PREORDER_HINTS = ('定金', '订金', '尾款', '补款', '预售', '预定')

_PLATFORM_BILIBILI_HINTS = ('会员购', 'bilibili', '哔哩')
# 「尾款时间」是会员购常用文案，但淘宝商家文案也可能出现「付尾款时间」，
# 作为弱信号：仅当全文无淘宝特征时才用于推断哔哩
_PLATFORM_BILIBILI_WEAK_HINTS = ('尾款时间',)
_PLATFORM_TAOBAO_HINTS = (
    '订单信息', '实付款', '交易快照', '加入购物车', '极速退款', '退货宝', '订单保障',
)

# 定金：优先"实付价/实付款"行（定金单实付即定金），其次"定金"字样，兜底商品区价格
# 数字后跟 年/月/- + 数字 或更多数字属于日期续写（如「实付价：2027年4月15日」），不算金额
_PAID_PRICE_RE = re.compile(
    r'实付(?:价|款)?[：: ]*[¥￥]?\s*(\d+(?:\.\d{1,2})?)(?!\s*(?:年|月|[/\-])\s*\d|\d)'
)
_DEPOSIT_RE = re.compile(
    r'(?:定金|订金)[：: ]*[¥￥]?\s*(\d+(?:\.\d{1,2})?)(?!\s*(?:年|月|[/\-])\s*\d|\d)'
)
# 尾款：数字后跟 年/月/- + 数字 属于日期续写（如「尾款：2027年4月15日」），不算尾款金额；
# (?!\d) 防止回溯（\d+ 缩成部分数字如 202 绕过日期前瞻）
_BALANCE_RE = re.compile(
    r'(?:尾款|补款)[：: ]*[¥￥]?\s*(\d+(?:\.\d{1,2})?)(?!\s*(?:年|月|[/\-])\s*\d|\d)'
)

# 预计出货（= 补款）时间：季度 → 带年月份 → 时间在出货字样后 → 仅月份（推断年份）
_SHIP_YEAR_MONTH_RE = re.compile(
    r'预计[^0-9]{0,10}(\d{4})[年/\-](\d{1,2})[月]?\s*(?:出货|出荷|发货|发售|到货|到仓)?'
)
_SHIP_TIME_AFTER_RE = re.compile(
    r'(?:出货|出荷|发货|发售|到货|到仓|补款|尾款)时间?[：: ]*(\d{4})[年/\-](\d{1,2})[月]?'
)
# 季度：阿拉伯数字（2027年4季度 / 2027年Q2）与中文数字（2027年第四季度）
_CN_QUARTER_MAP = {'一': 1, '二': 2, '三': 3, '四': 4}
_SHIP_QUARTER_RE = re.compile(
    r'预计[^0-9]{0,10}(\d{4})[年/\-]?\s*(?:第)?([1-4])\s*(?:季度|季)|'
    r'预计[^0-9]{0,10}(\d{4})[年/\-]?\s*[Qq]([1-4])|'
    r'预计[^0-9]{0,10}(\d{4})[年/\-]?\s*第?([一二三四])\s*季度'
)
_SHIP_MONTH_ONLY_RE = re.compile(
    r'预计[^0-9]{0,10}(\d{1,2})[月]\s*(?:出货|出荷|发货|发售|到货|到仓)'
)

# 名称清洗：丢弃含这些关键词的行（订单页横幅 / 括号组残留 / 服务信息）
_PREORDER_NAME_NOISE = (
    '定金', '订金', '尾款', '补款', '预计', '预定', '预售', '全款',
    '出货', '出荷', '发货', '发售', '到货', '到仓',
    '送货', '收货', '地址', '凭据', '快照', '开票', '赔付', '运费',
    '规则', '满足', '服务', '恢复', '进店', '逛逛', '客服', '退款',
    '88VIP', 'VIP', '更多', '查看', '复制', '收集进度', '系列+', '还差', '假一赔',
)
_BRACKET_GROUP_RE = re.compile(r'【[^】]*】')
# 尾部 ASCII 品牌词（带捕获组，用于长度判断）
_TRAILING_ASCII_RE = re.compile(r'\s*([A-Za-z][A-Za-z0-9]*)\s*$')


def _preorder_platform(raw_text: str) -> Optional[str]:
    """按页面特征推断下单平台。

    「会员购/bilibili/哔哩」为强信号；「尾款时间」为弱信号（淘宝商家文案
    也可能出现「付尾款时间」），弱信号仅在全文无淘宝特征时生效。
    """
    lowered = raw_text.lower()
    strong_bili = any(kw.lower() in lowered for kw in _PLATFORM_BILIBILI_HINTS)
    weak_bili = any(kw.lower() in lowered for kw in _PLATFORM_BILIBILI_WEAK_HINTS)
    taobao = any(kw in raw_text for kw in _PLATFORM_TAOBAO_HINTS)
    if strong_bili or (weak_bili and not taobao):
        return '哔哩哔哩会员购'
    if taobao:
        return '淘宝'
    return None


def _preorder_name(lines: list[dict], window: list[dict]) -> tuple[Optional[str], list[str]]:
    """提取手办名称。

    优先取与商品区首个价格同行的非噪音行（淘宝定金单标题行右侧即定金价），
    否则取商品窗口内最长非噪音行；再做括号组与尾部品牌词清理。
    """
    warnings: list[str] = []

    def is_noise(line: dict) -> bool:
        text = line['text']
        if _is_line_noise_for_name(text):
            return True
        return any(kw in text for kw in _PREORDER_NAME_NOISE)

    price_line = next(
        (
            line for line in window
            if _PRICE_ANY_RE.search(line['text'])
            or _PAID_PRICE_RE.search(line['text'])
            or _DEPOSIT_RE.search(line['text'])
        ),
        None,
    )

    name = None
    if price_line is not None:
        same_row = [
            line for line in window
            if not is_noise(line) and _is_same_row(line, price_line)
        ]
        if same_row:
            name = ' '.join(
                line['text'] for line in sorted(same_row, key=lambda l: (l['top'], l['left']))
            )
    if name is None:
        candidates = [
            line for line in window if not is_noise(line) and len(line['text']) >= 2
        ]
        if candidates:
            name = max(candidates, key=lambda line: len(line['text']))['text']

    if name:
        name = _BRACKET_GROUP_RE.sub('', name)
        name = ' '.join(name.split())
        # 仅去除 ≥5 字符的尾部 ASCII 品牌词（miHoYo/GoodSmile 等），
        # 保留 DX/EX/SP 等短后缀（可能是商品版本标识）
        trailing = _TRAILING_ASCII_RE.search(name)
        if trailing and len(trailing.group(1)) >= 5:
            name = name[: trailing.start()].rstrip()
        if name:
            return name, warnings
    warnings.append('未识别到手办名称，请手动填写')
    return None, warnings


def _parse_preorder_from_lines(lines: list[dict]) -> Optional[dict]:
    """从带坐标的 OCR 行解析单个预购定金单；非定金单返回 None。"""
    raw_text = '\n'.join(line['text'] for line in lines)
    if not any(hint in raw_text for hint in _PREORDER_HINTS):
        return None

    warnings: list[str] = []

    # 商品区窗口：店铺行之下、汇总行之上（跳过订单页顶部横幅与底部服务信息）
    shop_line = next((line for line in lines if _extract_shop_name([line])), None)
    if shop_line is not None:
        shop_y = shop_line['y_center']
    else:
        # 无店铺行（如纯文本粘贴）：以商品区首个价格为窗口起点，并向上留出约两行
        # 高度，避免把「价格行上方紧邻的标题行」切出窗口
        price_anchor = next(
            (
                line for line in lines
                if _PRICE_ANY_RE.search(line['text']) or _PAID_PRICE_RE.search(line['text'])
            ),
            None,
        )
        shop_y = (
            price_anchor['y_center'] - max(_line_height(price_anchor) * 2.2, 20.0)
            if price_anchor is not None
            else None
        )
    summary_y = None
    for line in lines:
        if _is_summary_line(line['text']):
            summary_y = line['y_center']
            break
    window = [
        line for line in lines
        if (shop_y is None or line['y_center'] > shop_y)
        and (summary_y is None or line['y_center'] < summary_y)
    ]

    name, name_warnings = _preorder_name(lines, window)
    warnings.extend(name_warnings)

    # 定金：实付价/实付款行 → "定金"字样 → 商品区首个价格
    deposit = None
    for line in lines:
        m = _PAID_PRICE_RE.search(line['text'])
        if m:
            deposit = _decimal_to_string(m.group(1))
            break
    if deposit is None:
        m = _DEPOSIT_RE.search(raw_text)
        if m:
            deposit = _decimal_to_string(m.group(1))
    if deposit is None:
        for line in window:
            m = _PRICE_ANY_RE.search(line['text'])
            if m:
                deposit = _decimal_to_string(m.group(1) or m.group(2))
                break
    if deposit is None:
        warnings.append('未识别到定金金额，请手动填写')

    # 尾款（未知可留空）
    balance = None
    m = _BALANCE_RE.search(raw_text)
    if m:
        balance = _decimal_to_string(m.group(1))
    else:
        warnings.append('未识别到尾款金额，可留空后手动补充')

    # 预计补款时间（出货月即补款月）
    # 顺序：季度优先（「2027年4季度」「2027年Q2」→ quarter，避免被月份正则把季度数字
    # 误当月份）→ 带年月份（「预计2027年4月出货」→ month）→ 出货字样后时间（「出货时间：2027年4月」）
    # → 仅月份（「预计12月到货」推断年份）
    estimated_month = None
    granularity = 'month'
    m = _SHIP_QUARTER_RE.search(raw_text)
    if m:
        year = m.group(1) or m.group(3) or m.group(5)
        quarter_raw = m.group(2) or m.group(4) or m.group(6)
        quarter = int(quarter_raw) if quarter_raw.isdigit() else _CN_QUARTER_MAP[quarter_raw]
        estimated_month = f'{year}-{(quarter - 1) * 3 + 1:02d}'
        granularity = 'quarter'
    else:
        m = _SHIP_YEAR_MONTH_RE.search(raw_text) or _SHIP_TIME_AFTER_RE.search(raw_text)
        if m:
            estimated_month = f'{m.group(1)}-{int(m.group(2)):02d}'
        else:
            m = _SHIP_MONTH_ONLY_RE.search(raw_text)
            if m:
                today = date.today()
                month = int(m.group(1))
                year = today.year if month >= today.month else today.year + 1
                estimated_month = f'{year}-{month:02d}'
    if estimated_month is None:
        warnings.append('未识别到预计补款时间，请手动选择')

    # 订单号 / 店铺
    order_no = None
    for line in lines:
        m = _ORDER_NO_RE.search(line['text'])
        if m:
            order_no = m.group(1)
            break
    shop_name = _extract_shop_name(lines)

    # 多商品防护：多个不同实付价 → 仅按第一条登记（Decimal 归一化，'60' 与 '60.00' 视为同值）
    paid_values: set[Decimal] = set()
    for line in lines:
        m = _PAID_PRICE_RE.search(line['text'])
        value = _decimal_to_string(m.group(1)) if m else None
        if value is not None:
            paid_values.add(Decimal(value))
    if len(paid_values) > 1:
        warnings.append('截图含多个商品实付价，仅按第一条登记，请逐个确认')

    return {
        'name': name,
        'platform': _preorder_platform(raw_text),
        'shop_name': shop_name,
        'order_no': order_no,
        'deposit_amount': deposit,
        'balance_amount': balance,
        'estimated_month': estimated_month,
        'time_granularity': granularity,
        'raw_text': raw_text,
        'warnings': warnings,
    }


def parse_preorder(ocr_entries: list[dict]) -> Optional[dict]:
    """从带坐标的 OCR 行解析单个预购定金单；非定金单截图返回 None。"""
    lines = _normalize_ocr_entries(ocr_entries)
    if not lines:
        return None
    return _parse_preorder_from_lines(lines)


def match_metadata(name: Optional[str], all_ips: list, all_characters: list,
                   all_categories: list) -> dict:
    """
    对商品名称进行多策略匹配 IP、角色、品类。

    匹配优先级：子串包含（长名优先） → jieba 分词模糊 → 全文模糊兜底。
    数据库名称/关键词更新后，缓存 60 秒自动刷新，无需重启。

    Args:
        name: 商品名称
        all_ips: [(id, name), ...]  包含 IP 名和 IPKeyword 值
        all_characters: [(id, name, ip_id, ip_name), ...]
        all_categories: [(id, name, path_name), ...]

    Returns:
        { 'ip': {...}, 'characters': [...], 'category': {...} }
    """
    result = {
        'ip': None,
        'characters': [],
        'category': None,
    }

    if not name:
        return result

    cleaned = _clean_ocr_name(name)
    compact = _compact_name(name)
    tokens = _tokenize(name)
    if not tokens:
        tokens = [name]

    # 来源优先级：子串 > 分词模糊 > 关键词 hint > 全文模糊
    source_rank = {'substr': 0, 'fuzzy_token': 1, 'hint': 2, 'fuzzy_full': 3}

    # ═══════════════════════════════════════════════════════════
    # 预计算所有候选名的清洗结果，避免循环内重复 regex
    # 同时保留 compact 版本用于 OCR 吞掉分隔符时的容错匹配
    # ═══════════════════════════════════════════════════════════
    _ip_entries = [(ip_id, ip_name, _clean_ocr_name(ip_name), _compact_name(ip_name))
                   for ip_id, ip_name in all_ips]
    _ip_entries.sort(key=lambda x: len(x[2]), reverse=True)

    _cat_entries = [(cid, cpath or cname, _clean_ocr_name(cpath or cname), _compact_name(cpath or cname))
                     for cid, cname, cpath in all_categories]
    _cat_entries.sort(key=lambda x: len(x[2]), reverse=True)

    # ═══════════════════════════════════════════════════════════
    # IP 匹配（单最佳候选）
    # ═══════════════════════════════════════════════════════════

    ip_candidates: list[dict] = []

    # 1. 子串匹配（长名优先，clean + compact 双路容错）
    for ip_id, ip_name, ip_cleaned, ip_compact in _ip_entries:
        if len(ip_compact) >= 2 and (ip_cleaned in cleaned or ip_compact in compact):
            ip_candidates.append({'id': ip_id, 'name': ip_name, 'confidence': 0.95, 'source': 'substr'})
            break

    # 2. jieba 分词 + 动态阈值模糊匹配
    if not ip_candidates:
        seen_ip_ids: set[int] = set()
        for token in tokens:
            threshold = _token_threshold(token)
            tid, tname, tconf = _fuzzy_match(token, all_ips, threshold=threshold)
            if tid and tid not in seen_ip_ids:
                seen_ip_ids.add(tid)
                ip_candidates.append({'id': tid, 'name': tname, 'confidence': tconf, 'source': 'fuzzy_token'})

    # 3. 全文模糊兜底
    if not ip_candidates:
        tid, tname, tconf = _fuzzy_match(name, all_ips, threshold=0.55)
        if tid:
            ip_candidates.append({'id': tid, 'name': tname, 'confidence': tconf, 'source': 'fuzzy_full'})

    if ip_candidates:
        ip_candidates.sort(key=lambda x: (source_rank[x['source']], -len(x['name']), -x['confidence']))
        best = ip_candidates[0]
        result['ip'] = {'id': best['id'], 'name': best['name'], 'confidence': best['confidence']}

    # ═══════════════════════════════════════════════════════════
    # 角色匹配（多候选，统一评分后截断取前 3）
    # ═══════════════════════════════════════════════════════════

    matched_ip_id = result['ip']['id'] if result['ip'] else None
    if matched_ip_id:
        scoped = [(cid, cname) for cid, cname, cip_id, _ in all_characters
                  if cip_id == matched_ip_id]
        if not scoped:
            scoped = [(cid, cname) for cid, cname, *_ in all_characters]
    else:
        scoped = [(cid, cname) for cid, cname, *_ in all_characters]

    _char_entries = [(cid, cname, _clean_ocr_name(cname), _compact_name(cname)) for cid, cname in scoped]
    _char_entries.sort(key=lambda x: len(x[2]), reverse=True)

    char_candidates: list[dict] = []

    # 1. 子串匹配（clean + compact 双路容错）
    for cid, cname, cname_cleaned, cname_compact in _char_entries:
        if len(cname_compact) >= 2 and (cname_cleaned in cleaned or cname_compact in compact):
            char_candidates.append({'id': cid, 'name': cname, 'confidence': 0.95, 'source': 'substr'})

    # 2. jieba 分词 + 动态阈值模糊匹配
    for token in tokens:
        threshold = _token_threshold(token)
        cid, cname, cconf = _fuzzy_match(token, scoped, threshold=threshold)
        if cid:
            char_candidates.append({'id': cid, 'name': cname, 'confidence': cconf, 'source': 'fuzzy_token'})

    # 3. 全文模糊兜底
    if not char_candidates:
        cid, cname, cconf = _fuzzy_match(name, scoped, threshold=0.4)
        if cid:
            char_candidates.append({'id': cid, 'name': cname, 'confidence': cconf, 'source': 'fuzzy_full'})

    # 统一排序 + 去重 + 截断（source 优先，再按候选名长度降序、置信度降序）
    char_candidates.sort(key=lambda x: (source_rank[x['source']], -len(x['name']), -x['confidence']))
    seen_char_ids: set[int] = set()
    for entry in char_candidates:
        if entry['id'] in seen_char_ids:
            continue
        seen_char_ids.add(entry['id'])
        result['characters'].append({'id': entry['id'], 'name': entry['name'], 'confidence': entry['confidence']})
        if len(result['characters']) >= 3:
            break

    # ═══════════════════════════════════════════════════════════
    # 品类匹配（单最佳候选）
    # ═══════════════════════════════════════════════════════════

    cat_candidates: list[dict] = []

    # 1. 子串匹配（clean + compact 双路容错）
    for cid, cname, cat_cleaned, cat_compact in _cat_entries:
        if len(cat_compact) >= 2 and (cat_cleaned in cleaned or cat_compact in compact):
            cat_candidates.append({'id': cid, 'name': cname, 'confidence': 0.95, 'source': 'substr'})
            break

    # 2. 关键词 hints（OCR 俗名 → 正式品类名）
    if not cat_candidates:
        for hint_text, hint_cat_name in _CATEGORY_HINTS:
            if hint_text in name:
                for cid, cname, cpath in all_categories:
                    if cname == hint_cat_name or (cpath and hint_cat_name in cpath):
                        cat_candidates.append({'id': cid, 'name': cpath or cname, 'confidence': 0.9, 'source': 'hint'})
                        break
            if cat_candidates:
                break

    # 3. 模糊兜底
    if not cat_candidates:
        cid, cname, cconf = _fuzzy_match(name, [(c[0], c[1]) for c in _cat_entries], threshold=0.35)
        if cid:
            cat_candidates.append({'id': cid, 'name': cname, 'confidence': cconf, 'source': 'fuzzy_full'})

    if cat_candidates:
        result['category'] = {'id': cat_candidates[0]['id'], 'name': cat_candidates[0]['name'], 'confidence': cat_candidates[0]['confidence']}

    return result
