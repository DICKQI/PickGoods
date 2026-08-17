import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePreorderDelay } from '@/composables/usePreorderDelay'
import type { Preorder, PreorderDelayRecord } from '@/api/types'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

vi.mock('@/api/reminder', () => ({
  delayPreorder: vi.fn(),
  listPreorderDelays: vi.fn(),
}))

import { ElMessage } from 'element-plus'
import { delayPreorder, listPreorderDelays } from '@/api/reminder'

const makePreorder = (overrides: Partial<Preorder> = {}): Preorder => ({
  id: 'p-1',
  name: '流萤手办',
  platform: '淘宝',
  shop_name: '示例店',
  order_no: 'ORD-001',
  deposit_amount: '350.00',
  balance_amount: '700.00',
  time_granularity: 'month',
  estimated_month: '2026-08-01',
  delay_count: 0,
  status: 'pending',
  paid_at: null,
  goods_id: null,
  goods_name: null,
  notes: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...overrides,
})

const makeRecord = (overrides: Partial<PreorderDelayRecord> = {}): PreorderDelayRecord => ({
  id: 1,
  from_month: '2026-06-01',
  to_month: '2026-08-01',
  from_granularity: 'month',
  to_granularity: 'month',
  reason: '厂家跳票',
  note: '',
  created_at: '2026-06-05T00:00:00Z',
  ...overrides,
})

describe('usePreorderDelay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('月粒度快捷选项 +1/+2/+3 个月且跨年正确，默认选中第一个', () => {
    const delay = usePreorderDelay()
    delay.open(makePreorder({ estimated_month: '2026-11-01' }))
    expect(delay.quickOptions.value.map((o) => o.value)).toEqual(['2026-12', '2027-01', '2027-02'])
    expect(delay.quickOptions.value[0]!.label).toBe('延后 1 个月')
    expect(delay.selectedKey.value).toBe('m1')
  })

  it('季度粒度快捷选项 +1/+2 个季度且跨年正确，默认选中第一个', () => {
    const delay = usePreorderDelay()
    delay.open(
      makePreorder({ time_granularity: 'quarter', estimated_month: '2026-10-01' })
    )
    expect(delay.quickOptions.value.map((o) => o.value)).toEqual(['2027-Q1', '2027-Q2'])
    expect(delay.quickOptions.value[0]!.label).toBe('延后 1 个季度')
    expect(delay.selectedKey.value).toBe('q1')
  })

  it('默认快捷项提交：目标归一化为当月 1 日，原因默认厂家跳票', async () => {
    vi.mocked(delayPreorder).mockResolvedValue(makePreorder())
    const delay = usePreorderDelay()
    delay.open(makePreorder({ estimated_month: '2026-08-01' }))
    expect(await delay.submit()).toBe(true)
    expect(delayPreorder).toHaveBeenCalledWith('p-1', {
      to_month: '2026-09-01',
      reason: '厂家跳票',
      note: null,
    })
  })

  it('自定义月份提交（月粒度）', async () => {
    vi.mocked(delayPreorder).mockResolvedValue(makePreorder())
    const delay = usePreorderDelay()
    delay.open(makePreorder({ estimated_month: '2026-08-01' }))
    delay.selectedKey.value = 'custom'
    delay.customMonth.value = '2027-03'
    expect(await delay.submit()).toBe(true)
    expect(delayPreorder).toHaveBeenCalledWith('p-1', {
      to_month: '2027-03-01',
      reason: '厂家跳票',
      note: null,
    })
  })

  it('自定义季度提交（季度粒度）', async () => {
    vi.mocked(delayPreorder).mockResolvedValue(makePreorder())
    const delay = usePreorderDelay()
    delay.open(
      makePreorder({ time_granularity: 'quarter', estimated_month: '2026-07-01' })
    )
    delay.selectedKey.value = 'custom'
    delay.customQuarter.value = '2027-Q2'
    expect(await delay.submit()).toBe(true)
    expect(delayPreorder).toHaveBeenCalledWith('p-1', {
      to_month: '2027-04-01',
      reason: '厂家跳票',
      note: null,
    })
  })

  it('选择自定义但未填目标时间：提示且不提交', async () => {
    const delay = usePreorderDelay()
    delay.open(makePreorder({ estimated_month: '2026-08-01' }))
    delay.selectedKey.value = 'custom'
    expect(await delay.submit()).toBe(false)
    expect(delayPreorder).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalled()
  })

  it('提交失败返回 false', async () => {
    vi.mocked(delayPreorder).mockRejectedValue(new Error('400'))
    const delay = usePreorderDelay()
    delay.open(makePreorder({ estimated_month: '2026-08-01' }))
    expect(await delay.submit()).toBe(false)
  })

  it('自定义原因与备注随请求发送', async () => {
    vi.mocked(delayPreorder).mockResolvedValue(makePreorder())
    const delay = usePreorderDelay()
    delay.open(makePreorder({ estimated_month: '2026-08-01' }))
    delay.reason.value = '官方公告跳票'
    delay.note.value = '延期到 9 月'
    expect(await delay.submit()).toBe(true)
    expect(delayPreorder).toHaveBeenCalledWith('p-1', {
      to_month: '2026-09-01',
      reason: '官方公告跳票',
      note: '延期到 9 月',
    })
  })

  it('打开时加载延期历史；加载失败置错误态', async () => {
    vi.mocked(listPreorderDelays).mockResolvedValue([makeRecord()])
    const delay = usePreorderDelay()
    await delay.open(makePreorder({ estimated_month: '2026-08-01' }))
    expect(listPreorderDelays).toHaveBeenCalledWith('p-1')
    expect(delay.records.value).toHaveLength(1)

    vi.mocked(listPreorderDelays).mockRejectedValue(new Error('network'))
    await delay.loadHistory()
    expect(delay.historyError.value).toBe(true)
    expect(delay.records.value).toEqual([])
  })
})
