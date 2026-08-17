import type { Preorder, PreorderStatus } from '@/api/types'

export const PREORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待补款',
  paid: '已补款',
  converted: '已转正',
  cancelled: '已取消',
}

export const PREORDER_STATUS_TAG_TYPES: Record<string, 'warning' | 'success' | 'primary' | 'info'> = {
  pending: 'warning',
  paid: 'success',
  converted: 'primary',
  cancelled: 'info',
}

export const preorderStatusLabel = (s: string) => PREORDER_STATUS_LABELS[s] || s
export const preorderStatusTagType = (s: string) => PREORDER_STATUS_TAG_TYPES[s] || 'info'

export const formatAmount = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00'
  return Number(value).toFixed(2)
}

/** 季度字符串 ↔ 月份转换（表单 '2026-Q3' ↔ 后端存储 '2026-07-01'） */
export const quarterToMonth = (q: string): string => {
  const m = q.match(/^(\d{4})-Q([1-4])$/i)
  if (!m) return q
  const month = (Number(m[2]) - 1) * 3 + 1
  return `${m[1]}-${String(month).padStart(2, '0')}-01`
}

export const monthToQuarter = (ymd: string): string => {
  const d = new Date(ymd + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-Q${q}`
}

/** 提交时统一转为粒度起点日期 */
export const toMonthStart = (v: string, granularity: 'month' | 'quarter'): string => {
  if (granularity === 'quarter') return quarterToMonth(v)
  return v + '-01'
}

/** 按粒度格式化粒度起点日期：'2026-08-01'（month）→ '2026年8月'；'2026-07-01'（quarter）→ '2026年 Q3' */
export const formatPeriod = (ymd: string, granularity: 'month' | 'quarter'): string => {
  if (!ymd) return '—'
  const d = new Date(ymd + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ymd
  if (granularity === 'quarter') {
    const q = Math.floor(d.getMonth() / 3) + 1
    return `${d.getFullYear()}年 Q${q}`
  }
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月'
}

export const formatMonth = (row: Preorder): string =>
  formatPeriod(row.estimated_month, row.time_granularity)

/** 月份偏移：'2026-12' + 2 → '2027-02'（跨年正确；n 为正） */
export const addMonths = (ym: string, n: number): string => {
  const parts = ym.split('-').map(Number)
  if (parts.length !== 2 || !parts[0] || !parts[1]) return ym
  const total = parts[0] * 12 + (parts[1] - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** 季度偏移：'2026-Q4' + 1 → '2027-Q1'（跨年正确；n 为正） */
export const addQuarters = (yq: string, n: number): string => {
  const m = yq.match(/^(\d{4})-Q([1-4])$/i)
  if (!m) return yq
  let year = Number(m[1])
  let quarter = Number(m[2]) + n
  while (quarter > 4) {
    quarter -= 4
    year++
  }
  return `${year}-Q${quarter}`
}

/** 已到补款期（待补款且预计月份不晚于当月） */
export const isDueNow = (row: Preorder): boolean => {
  if (row.status !== 'pending') return false
  const month = new Date(row.estimated_month + 'T00:00:00')
  if (Number.isNaN(month.getTime())) return false
  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return month <= thisMonth
}

export const PREORDER_STATUS_OPTIONS: Array<{ label: string; value: PreorderStatus | '' }> = [
  { label: '全部', value: '' },
  { label: '待补款', value: 'pending' },
  { label: '已补款', value: 'paid' },
  { label: '已转正', value: 'converted' },
  { label: '已取消', value: 'cancelled' },
]

export const PREORDER_PLATFORM_OPTIONS = ['淘宝', '天猫', '京东', '拼多多', '抖音', 'B站会员购', '代购', '线下展会', '其他']
