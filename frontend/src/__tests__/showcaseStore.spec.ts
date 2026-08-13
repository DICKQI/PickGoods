import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useShowcaseStore } from '@/stores/showcase'
import type { PaginatedShowcaseResponse, Showcase } from '@/api/types'

vi.mock('@/api/showcase', () => ({
  getShowcaseList: vi.fn(),
  getPublicShowcases: vi.fn(),
  getPrivateShowcases: vi.fn(),
  getShowcaseDetail: vi.fn(),
  createShowcase: vi.fn(),
  deleteShowcase: vi.fn(),
  patchShowcase: vi.fn(),
  moveShowcaseGoods: vi.fn(),
  addGoodsToShowcase: vi.fn(),
  removeGoodsFromShowcase: vi.fn(),
}))

import { getPrivateShowcases, getShowcaseDetail } from '@/api/showcase'

const makeShowcase = (id: string, name: string): Showcase => ({ id, name })

const makeListResponse = (
  items: Showcase[],
  page = 1,
  next: number | null = null,
): PaginatedShowcaseResponse => ({
  count: items.length,
  page,
  page_size: 20,
  next,
  previous: page > 1 ? page - 1 : null,
  results: items,
})

describe('useShowcaseStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchDetail 并发调用时，后选中的展柜生效', async () => {
    let resolveA!: (v: Showcase) => void
    let resolveB!: (v: Showcase) => void
    vi.mocked(getShowcaseDetail)
      .mockReturnValueOnce(new Promise<Showcase>((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise<Showcase>((r) => { resolveB = r }))

    const store = useShowcaseStore()
    const pa = store.fetchDetail('a')
    const pb = store.fetchDetail('b')

    // b 先返回
    resolveB(makeShowcase('b', '展柜B'))
    await pb
    expect(store.activeShowcase?.id).toBe('b')
    expect(store.activeShowcaseId).toBe('b')

    // a 后返回，应被丢弃
    resolveA(makeShowcase('a', '展柜A'))
    await pa
    expect(store.activeShowcase?.id).toBe('b')
    expect(store.activeShowcaseId).toBe('b')
    expect(store.detailLoading).toBe(false)
  })

  it('fetchDetail 过期失败不覆盖最新详情，且 loading 正确复位', async () => {
    let resolveA!: (v: Showcase) => void
    let rejectB!: (e: unknown) => void
    vi.mocked(getShowcaseDetail)
      .mockReturnValueOnce(new Promise<Showcase>((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise<Showcase>((_, j) => { rejectB = j }))

    const store = useShowcaseStore()
    const pa = store.fetchDetail('a')
    const pb = store.fetchDetail('b')

    // b（最新请求）失败：展示错误态
    rejectB(new Error('网络错误'))
    await pb
    expect(store.activeShowcase).toBeNull()

    // a（过期请求）后返回：不应把旧详情“复活”
    resolveA(makeShowcase('a', '展柜A'))
    await pa
    expect(store.activeShowcase).toBeNull()
    expect(store.detailLoading).toBe(false)
  })

  it('fetchList 并发翻页时，最后一次请求生效', async () => {
    let resolveP1!: (v: PaginatedShowcaseResponse) => void
    let resolveP2!: (v: PaginatedShowcaseResponse) => void
    vi.mocked(getPrivateShowcases)
      .mockReturnValueOnce(new Promise<PaginatedShowcaseResponse>((r) => { resolveP1 = r }))
      .mockReturnValueOnce(new Promise<PaginatedShowcaseResponse>((r) => { resolveP2 = r }))

    const store = useShowcaseStore()
    const p1 = store.fetchList({ page: 1 })
    const p2 = store.fetchList({ page: 2 })

    // page 2 先返回
    resolveP2(makeListResponse([makeShowcase('s2', '展柜2')], 2))
    await p2
    expect(store.list.map(s => s.id)).toEqual(['s2'])
    expect(store.pagination.page).toBe(2)

    // page 1 后返回，应被丢弃
    resolveP1(makeListResponse([makeShowcase('s1', '展柜1')], 1, 2))
    await p1
    expect(store.list.map(s => s.id)).toEqual(['s2'])
    expect(store.pagination.page).toBe(2)
    expect(store.listLoading).toBe(false)
  })
})
