import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GOODS_DETAIL_CACHE_TTL, useGoodsDetailStore } from '@/stores/goodsDetail'
import type { GoodsDetail } from '@/api/types'

const getGoodsDetailMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/goods', () => ({
  getGoodsDetail: getGoodsDetailMock,
}))

const makeDetail = (id: string, name = `谷子-${id}`): GoodsDetail => ({
  id,
  name,
  ip: { id: 1, name: 'IP' },
  characters: [],
  category: { id: 1, name: '品类', parent: null, path_name: '品类', order: 0 },
  theme: null,
  location_path: '',
  location: null,
  main_photo: null,
  status: 'in_cabinet',
  quantity: 1,
  price: null,
  purchase_date: null,
  is_official: true,
  notes: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  additional_photos: [],
})

describe('useGoodsDetailStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('deduplicates concurrent detail requests and reuses the cached value', async () => {
    let resolveRequest!: (value: GoodsDetail) => void
    getGoodsDetailMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve
    }))

    const store = useGoodsDetailStore()
    const first = store.ensureGoodsDetail('goods-1')
    const second = store.ensureGoodsDetail('goods-1')

    resolveRequest(makeDetail('goods-1'))
    await expect(first).resolves.toMatchObject({ name: '谷子-goods-1' })
    await expect(second).resolves.toMatchObject({ name: '谷子-goods-1' })
    expect(getGoodsDetailMock).toHaveBeenCalledTimes(1)

    await expect(store.ensureGoodsDetail('goods-1')).resolves.toMatchObject({ name: '谷子-goods-1' })
    expect(getGoodsDetailMock).toHaveBeenCalledTimes(1)
  })

  it('returns stale data first and refreshes the cache in the background', async () => {
    vi.useFakeTimers()
    getGoodsDetailMock
      .mockResolvedValueOnce(makeDetail('goods-1', '旧内容'))
      .mockResolvedValueOnce(makeDetail('goods-1', '新内容'))

    const store = useGoodsDetailStore()
    await store.ensureGoodsDetail('goods-1')
    vi.advanceTimersByTime(GOODS_DETAIL_CACHE_TTL + 1)

    await expect(store.ensureGoodsDetail('goods-1')).resolves.toMatchObject({ name: '旧内容' })
    await expect(store.ensureGoodsDetail('goods-1', { waitForRefresh: true }))
      .resolves.toMatchObject({ name: '新内容' })
    expect(getGoodsDetailMock).toHaveBeenCalledTimes(2)
    expect(store.getCachedGoodsDetail('goods-1')).toMatchObject({ name: '新内容' })
  })

  it('invalidates cached details and does not cache failed requests', async () => {
    getGoodsDetailMock
      .mockResolvedValueOnce(makeDetail('goods-1'))
      .mockRejectedValueOnce(new Error('network failed'))

    const store = useGoodsDetailStore()
    await store.ensureGoodsDetail('goods-1')
    store.invalidateGoodsDetail('goods-1')
    expect(store.getCachedGoodsDetail('goods-1')).toBeNull()

    await expect(store.ensureGoodsDetail('goods-1')).rejects.toThrow('network failed')
    expect(store.getCachedGoodsDetail('goods-1')).toBeNull()
  })

  it('does not let an invalidated in-flight request repopulate the cache', async () => {
    let resolveOldRequest!: (value: GoodsDetail) => void
    getGoodsDetailMock
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveOldRequest = resolve
      }))
      .mockResolvedValueOnce(makeDetail('goods-1', '重新请求内容'))

    const store = useGoodsDetailStore()
    const oldRequest = store.ensureGoodsDetail('goods-1')
    store.invalidateGoodsDetail('goods-1')

    resolveOldRequest(makeDetail('goods-1', '失效前内容'))
    await expect(oldRequest).rejects.toThrow('谷子详情请求已失效')
    expect(store.getCachedGoodsDetail('goods-1')).toBeNull()

    await expect(store.ensureGoodsDetail('goods-1')).resolves.toMatchObject({ name: '重新请求内容' })
    expect(store.getCachedGoodsDetail('goods-1')?.name).toBe('重新请求内容')
  })

  it('does not let a cleared in-flight request repopulate an account-scoped cache', async () => {
    let resolveOldRequest!: (value: GoodsDetail) => void
    getGoodsDetailMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveOldRequest = resolve
    }))

    const store = useGoodsDetailStore()
    const oldRequest = store.ensureGoodsDetail('goods-1')
    store.clearGoodsDetailCache()

    resolveOldRequest(makeDetail('goods-1'))
    await expect(oldRequest).rejects.toThrow('谷子详情请求已失效')
    expect(store.getCachedGoodsDetail('goods-1')).toBeNull()
  })

  it('starts a new request when force refresh is requested during a pending load', async () => {
    let resolveOldRequest!: (value: GoodsDetail) => void
    getGoodsDetailMock
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveOldRequest = resolve
      }))
      .mockResolvedValueOnce(makeDetail('goods-1', '强制刷新内容'))

    const store = useGoodsDetailStore()
    const oldRequest = store.ensureGoodsDetail('goods-1')
    const forcedRequest = store.ensureGoodsDetail('goods-1', { force: true })

    resolveOldRequest(makeDetail('goods-1', '旧请求内容'))
    await expect(oldRequest).rejects.toThrow('谷子详情请求已失效')
    await expect(forcedRequest).resolves.toMatchObject({ name: '强制刷新内容' })
    expect(getGoodsDetailMock).toHaveBeenCalledTimes(2)
    expect(store.getCachedGoodsDetail('goods-1')?.name).toBe('强制刷新内容')
  })
})
