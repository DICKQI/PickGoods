import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGuziStore } from '@/stores/guzi'
import type { GoodsListItem } from '@/api/types'

vi.mock('@/api/goods', () => ({
  getGoodsList: vi.fn(),
  getGoodsDetail: vi.fn(),
  getSimilarRandomGoodsList: vi.fn(),
}))

import { getGoodsList, getSimilarRandomGoodsList } from '@/api/goods'

const makeGoods = (id: string, name: string): GoodsListItem =>
  ({
    id,
    name,
    ip: { id: 1, name: 'IP' },
    characters: [],
    category: { id: 1, name: '品类' },
    quantity: 1,
    price: '100',
    status: 'in_cabinet',
    main_photo: null,
    order: 0,
  }) as any

const makePaginatedResponse = (items: GoodsListItem[], count = items.length, page = 1, next: number | null = null) => ({
  count,
  page,
  page_size: 18,
  next,
  previous: null,
  results: items,
})

describe('useGuziStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('初始状态', () => {
    const store = useGuziStore()
    expect(store.guziList).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.viewMode).toBe('standard')
    expect(store.selectionMode).toBe(false)
    expect(store.selectedGoodsIds).toEqual([])
  })

  it('searchGuziImmediate 调用 API 并更新列表', async () => {
    const items = [makeGoods('1', 'G1'), makeGoods('2', 'G2')]
    vi.mocked(getGoodsList).mockResolvedValue(makePaginatedResponse(items))

    const store = useGuziStore()
    await store.searchGuziImmediate()

    expect(store.guziList).toHaveLength(2)
    expect(store.guziList[0].name).toBe('G1')
    expect(store.pagination.count).toBe(2)
    expect(store.loading).toBe(false)
  })

  it('searchGuziImmediate 处理数组格式响应', async () => {
    const items = [makeGoods('1', 'G1')]
    vi.mocked(getGoodsList).mockResolvedValue(items as any)

    const store = useGuziStore()
    await store.searchGuziImmediate()

    expect(store.guziList).toHaveLength(1)
  })

  it('searchGuziImmediate 失败设置 error', async () => {
    vi.mocked(getGoodsList).mockRejectedValue(new Error('网络错误'))

    const store = useGuziStore()
    await store.searchGuziImmediate()

    expect(store.error).toBe('网络错误')
    expect(store.guziList).toEqual([])
  })

  it('resetFilters 清除筛选条件', async () => {
    vi.mocked(getGoodsList).mockResolvedValue(makePaginatedResponse([]))

    const store = useGuziStore()
    store.filters = { ip: 1, category: 2 } as any
    await store.resetFilters()

    expect(store.filters).toEqual({})
    expect(store.pagination.page).toBe(1)
  })

  it('setViewMode 切换模式并重置页码', async () => {
    vi.mocked(getSimilarRandomGoodsList).mockResolvedValue(makePaginatedResponse([]))

    const store = useGuziStore()
    store.pagination.page = 5
    await store.setViewMode('similar')

    expect(store.viewMode).toBe('similar')
    expect(store.pagination.page).toBe(1)
  })

  it('enterSelectionMode / exitSelectionMode', () => {
    const store = useGuziStore()
    store.enterSelectionMode()
    expect(store.selectionMode).toBe(true)

    store.exitSelectionMode()
    expect(store.selectionMode).toBe(false)
    expect(store.selectedGoodsIds).toEqual([])
  })

  it('exitSelectionMode(false) 保留选择', () => {
    const store = useGuziStore()
    store.enterSelectionMode()
    store.toggleGoodsSelection(makeGoods('1', 'G1'))
    store.exitSelectionMode(false)

    expect(store.selectionMode).toBe(false)
    expect(store.selectedGoodsIds).toHaveLength(1)
  })

  it('toggleGoodsSelection 添加/移除', () => {
    const store = useGuziStore()
    const goods = makeGoods('1', 'G1')

    store.toggleGoodsSelection(goods)
    expect(store.isGoodsSelected('1')).toBe(true)
    expect(store.selectedGoodsCount).toBe(1)

    store.toggleGoodsSelection(goods)
    expect(store.isGoodsSelected('1')).toBe(false)
    expect(store.selectedGoodsCount).toBe(0)
  })

  it('clearGoodsSelection 清除所有选择', () => {
    const store = useGuziStore()
    store.toggleGoodsSelection(makeGoods('1', 'G1'))
    store.toggleGoodsSelection(makeGoods('2', 'G2'))
    store.clearGoodsSelection()

    expect(store.selectedGoodsIds).toEqual([])
    expect(store.selectedGoodsById).toEqual({})
    expect(store.selectedGoodsCount).toBe(0)
  })

  it('removeGoodsSelection 移除单个', () => {
    const store = useGuziStore()
    store.toggleGoodsSelection(makeGoods('1', 'G1'))
    store.toggleGoodsSelection(makeGoods('2', 'G2'))
    store.removeGoodsSelection('1')

    expect(store.selectedGoodsIds).toEqual(['2'])
    expect(store.isGoodsSelected('1')).toBe(false)
    expect(store.isGoodsSelected('2')).toBe(true)
  })

  it('hasMore 根据 pagination.next 计算', async () => {
    vi.mocked(getGoodsList).mockResolvedValue(
      makePaginatedResponse([makeGoods('1', 'G1')], 100, 1, 2)
    )

    const store = useGuziStore()
    await store.searchGuziImmediate()
    expect(store.hasMore).toBe(true)
  })

  it('hasMore 在 similar 模式下始终为 false', async () => {
    vi.mocked(getSimilarRandomGoodsList).mockResolvedValue(
      makePaginatedResponse([makeGoods('1', 'G1')], 100, 1, 2)
    )

    const store = useGuziStore()
    await store.setViewMode('similar')
    expect(store.hasMore).toBe(false)
  })
})
