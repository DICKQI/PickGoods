import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePreorderList } from '@/composables/usePreorderList'
import type { Preorder } from '@/api/types'

vi.mock('@/api/reminder', () => ({
  listPreorders: vi.fn(),
}))

import { listPreorders } from '@/api/reminder'

const makePreorder = (id: string, overrides: Partial<Preorder> = {}): Preorder => ({
  id,
  name: `手办${id}`,
  platform: '淘宝',
  shop_name: '示例店',
  order_no: '',
  deposit_amount: '100.00',
  balance_amount: null,
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

const paginated = (results: Preorder[], page: number, next: number | null, count = results.length) => ({
  count,
  page,
  page_size: 12,
  next,
  previous: page > 1 ? page - 1 : null,
  results,
})

describe('usePreorderList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('infinite 模式 loadMore 追加去重并更新 hasNext', async () => {
    vi.mocked(listPreorders)
      .mockResolvedValueOnce(paginated([makePreorder('p-1'), makePreorder('p-2')], 1, 2, 3))
      .mockResolvedValueOnce(paginated([makePreorder('p-2'), makePreorder('p-3')], 2, null, 3))

    const list = usePreorderList({ isInfinite: () => true })
    await list.loadInitial()
    expect(list.preorders.value.map((p) => p.id)).toEqual(['p-1', 'p-2'])
    expect(list.hasNext.value).toBe(true)

    await list.loadMore()
    expect(listPreorders).toHaveBeenLastCalledWith({ page: 2, page_size: 12, status: undefined, search: undefined })
    expect(list.preorders.value.map((p) => p.id)).toEqual(['p-1', 'p-2', 'p-3'])
    expect(list.hasNext.value).toBe(false)

    // 没有下一页时不再请求
    await list.loadMore()
    expect(listPreorders).toHaveBeenCalledTimes(2)
  })

  it('paged 模式 loadInitial 替换当前页，不追加', async () => {
    vi.mocked(listPreorders).mockResolvedValueOnce(paginated([makePreorder('p-1')], 1, null))
    const list = usePreorderList({ isInfinite: () => false })
    await list.loadInitial()
    expect(list.preorders.value.map((p) => p.id)).toEqual(['p-1'])
    await list.loadMore()
    expect(listPreorders).toHaveBeenCalledTimes(1)
  })

  it('筛选变化重置到第一页并携带 status 参数', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([], 1, null, 0))
    const list = usePreorderList({ isInfinite: () => true })
    list.statusFilter.value = 'paid'
    list.handleFilterChange()
    await vi.runAllTimersAsync()
    expect(listPreorders).toHaveBeenLastCalledWith({ page: 1, page_size: 12, status: 'paid', search: undefined })
  })

  it('搜索防抖 300ms 后请求', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([], 1, null, 0))
    const list = usePreorderList({ isInfinite: () => true })
    list.searchKeyword.value = '流萤'
    list.handleSearchInput()
    list.searchKeyword.value = '流萤手'
    list.handleSearchInput()
    await vi.advanceTimersByTimeAsync(299)
    expect(listPreorders).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(listPreorders).toHaveBeenCalledWith({ page: 1, page_size: 12, status: undefined, search: '流萤手' })
  })

  it('loadUntilId 顺序翻页命中目标，超上限返回 false', async () => {
    vi.mocked(listPreorders)
      .mockResolvedValueOnce(paginated([makePreorder('p-1')], 1, 2, 30))
      .mockResolvedValueOnce(paginated([makePreorder('p-2')], 2, 3, 30))
      .mockResolvedValueOnce(paginated([makePreorder('p-3')], 3, 4, 30))

    const list = usePreorderList({ isInfinite: () => true })
    await list.loadInitial()
    const found = await list.loadUntilId('p-3')
    expect(found).toBe(true)
    expect(list.page.value).toBe(3)
    expect(list.preorders.value.map((p) => p.id)).toEqual(['p-1', 'p-2', 'p-3'])
  })

  it('loadUntilId 超过 10 页仍未命中返回 false', async () => {
    // 每页 12 条且 next 恒存在，10 次翻页后停止
    const results = Array.from({ length: 12 }, (_, i) => makePreorder(`p-${i + 1}`))
    vi.mocked(listPreorders).mockResolvedValue(paginated(results, 1, 2, 200))
    const list = usePreorderList({ isInfinite: () => true })
    await list.loadInitial()
    const found = await list.loadUntilId('missing')
    expect(found).toBe(false)
    expect(listPreorders).toHaveBeenCalledTimes(11) // 首屏 1 次 + 探测 10 次
  })
})
