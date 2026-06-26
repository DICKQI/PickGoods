import type { ShowcaseGoods } from '@/api/types'

const ROUND_KEYWORDS = ['吧唧', '徽章', '马口铁']
const ROUND_EXCLUDES = [
  '异形', '方形', '正方形', '长方形', '矩形', '心形', '椭圆',
  '宝石', '星形', '星型', '菱形', '三角', '六边', '多边形',
]

const PAPER_ROOT_KEYWORD = '纸制品'
const PAPER_KEYWORDS = [
  '方卡',
  '仿胶片卡',
  '纸夹相卡',
  '光栅卡',
  '书签',
  '邮票',
  '色纸',
  '镭射票',
  '明信片',
  '拍立得',
  '小卡',
]

const categoryText = (item: ShowcaseGoods) => {
  const cat = item.goods?.category
  if (!cat) return ''
  return `${cat.name || ''}/${cat.path_name || ''}`
}

export const isRoundDisplayGoods = (item: ShowcaseGoods): boolean => {
  const cat = item.goods?.category
  if (!cat) return false
  const text = categoryText(item)
  if (ROUND_EXCLUDES.some((k) => text.includes(k))) return false
  if (cat.shape_type === 'round') return true
  return ROUND_KEYWORDS.some((k) => text.includes(k))
}

export const isPaperDisplayGoods = (item: ShowcaseGoods): boolean => {
  if (isRoundDisplayGoods(item)) return false
  const text = categoryText(item)
  if (!text) return false
  if (text.includes(PAPER_ROOT_KEYWORD)) return true
  return PAPER_KEYWORDS.some((k) => text.includes(k))
}

export const groupShowcaseDisplayGoods = (items: ShowcaseGoods[]) => {
  const round: ShowcaseGoods[] = []
  const paper: ShowcaseGoods[] = []
  const other: ShowcaseGoods[] = []

  for (const item of items) {
    if (isRoundDisplayGoods(item)) {
      round.push(item)
    } else if (isPaperDisplayGoods(item)) {
      paper.push(item)
    } else {
      other.push(item)
    }
  }

  return { round, paper, other }
}
