import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getGoodsDetail } from '@/api/goods'
import type { GoodsDetail } from '@/api/types'

export const GOODS_DETAIL_CACHE_TTL = 60_000
export const GOODS_DETAIL_CACHE_LIMIT = 50

interface GoodsDetailCacheEntry {
  data: GoodsDetail
  fetchedAt: number
}

interface PendingGoodsDetailRequest {
  promise: Promise<GoodsDetail>
  cacheEpoch: number
  version: number
}

interface EnsureGoodsDetailOptions {
  force?: boolean
  silent?: boolean
  waitForRefresh?: boolean
}

export const useGoodsDetailStore = defineStore('goodsDetail', () => {
  const cache = ref<Record<string, GoodsDetailCacheEntry>>({})
  const pending = new Map<string, PendingGoodsDetailRequest>()
  const versions = new Map<string, number>()
  const cacheEpoch = ref(0)

  const getVersion = (id: string) => versions.get(id) ?? 0

  const bumpVersion = (id: string) => {
    versions.set(id, getVersion(id) + 1)
  }

  const trimCache = () => {
    const entries = Object.entries(cache.value)
    if (entries.length <= GOODS_DETAIL_CACHE_LIMIT) return

    entries
      .sort(([, a], [, b]) => b.fetchedAt - a.fetchedAt)
      .slice(GOODS_DETAIL_CACHE_LIMIT)
      .forEach(([id]) => {
        delete cache.value[id]
      })
  }

  const getCachedGoodsDetail = (id: string) => cache.value[id]?.data ?? null

  const isGoodsDetailFresh = (id: string) => {
    const entry = cache.value[id]
    return Boolean(entry && Date.now() - entry.fetchedAt < GOODS_DETAIL_CACHE_TTL)
  }

  const fetchGoodsDetail = (id: string, force = false, silent = false) => {
    const existing = pending.get(id)
    const epoch = cacheEpoch.value
    const version = getVersion(id)
    if (
      existing
      && !force
      && existing.cacheEpoch === epoch
      && existing.version === version
    ) {
      return existing.promise
    }

    if (force) bumpVersion(id)
    const requestEpoch = cacheEpoch.value
    const requestVersion = getVersion(id)

    const request = getGoodsDetail(id, { suppressGlobalError: silent })
      .then((data) => {
        if (cacheEpoch.value !== requestEpoch || getVersion(id) !== requestVersion) {
          throw new Error('谷子详情请求已失效，请重试')
        }
        cache.value[id] = {
          data,
          fetchedAt: Date.now(),
        }
        trimCache()
        return data
      })

    const pendingRequest: PendingGoodsDetailRequest = {
      promise: request,
      cacheEpoch: requestEpoch,
      version: requestVersion,
    }
    pending.set(id, pendingRequest)
    void request.finally(() => {
      if (pending.get(id) === pendingRequest) {
        pending.delete(id)
      }
    }).catch(() => undefined)
    return request
  }

  const ensureGoodsDetail = async (
    id: string,
    options: EnsureGoodsDetailOptions = {},
  ): Promise<GoodsDetail> => {
    const cached = cache.value[id]
    if (!options.force && cached) {
      if (!isGoodsDetailFresh(id)) {
        const refresh = fetchGoodsDetail(id, false, options.silent === true)
        if (options.waitForRefresh) return refresh
        void refresh.catch(() => undefined)
      }
      return cached.data
    }

    return fetchGoodsDetail(id, options.force === true, options.silent === true)
  }

  const prefetchGoodsDetail = async (id: string) => {
    if (isGoodsDetailFresh(id)) return
    await fetchGoodsDetail(id, false, true)
  }

  const invalidateGoodsDetail = (id: string) => {
    bumpVersion(id)
    delete cache.value[id]
    pending.delete(id)
  }

  const clearGoodsDetailCache = () => {
    cacheEpoch.value += 1
    cache.value = {}
    pending.clear()
    versions.clear()
  }

  return {
    getCachedGoodsDetail,
    isGoodsDetailFresh,
    ensureGoodsDetail,
    prefetchGoodsDetail,
    invalidateGoodsDetail,
    clearGoodsDetailCache,
  }
})
