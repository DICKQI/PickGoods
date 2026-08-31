import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type ClubImportQueueItemStatus = 'pending' | 'processing' | 'completed' | 'skipped' | 'failed'

export interface ClubImportQueueItem {
  goodsId: string
  clubId: number
  clubName: string
  name: string
  mainPhoto?: string | null
  ipName?: string | null
  categoryName?: string | null
  imported: boolean
  importedQuantity?: number | null
  importedGoodsId?: string | null
  status: ClubImportQueueItemStatus
  resultGoodsId?: string | null
  resultMessage?: string | null
}

interface PersistedQueue {
  id: string
  createdAt: number
  items: ClubImportQueueItem[]
}

const STORAGE_KEY = 'pickgoods:club-import-queue'

function createQueueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function readPersistedQueue(): PersistedQueue | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedQueue
    if (!parsed?.id || !Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}

export const useClubImportQueueStore = defineStore('clubImportQueue', () => {
  const queueId = ref<string | null>(null)
  const createdAt = ref<number | null>(null)
  const items = ref<ClubImportQueueItem[]>([])

  const pendingItems = computed(() => items.value.filter(item => item.status === 'pending' || item.status === 'processing'))
  const completedItems = computed(() => items.value.filter(item => item.status === 'completed'))
  const unresolvedItems = computed(() => items.value.filter(item => ['pending', 'processing', 'failed'].includes(item.status)))
  const currentItem = computed(() => items.value.find(item => item.status === 'processing') || items.value.find(item => item.status === 'pending') || null)
  const isComplete = computed(() => items.value.length > 0 && unresolvedItems.value.length === 0)

  function persist() {
    if (typeof window === 'undefined' || !queueId.value) return
    const payload: PersistedQueue = {
      id: queueId.value,
      createdAt: createdAt.value || Date.now(),
      items: items.value,
    }
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Session storage is an enhancement; route navigation remains usable if it is unavailable.
    }
  }

  function hydrate(id?: string | null) {
    const persisted = readPersistedQueue()
    if (!persisted || (id && persisted.id !== id)) return false
    queueId.value = persisted.id
    createdAt.value = persisted.createdAt || Date.now()
    items.value = persisted.items.map(item => ({ ...item, status: item.status === 'processing' ? 'pending' : item.status }))
    persist()
    return true
  }

  function start(nextItems: ClubImportQueueItem[]) {
    queueId.value = createQueueId()
    createdAt.value = Date.now()
    items.value = nextItems.map(item => ({ ...item, status: 'pending', resultGoodsId: null, resultMessage: null }))
    persist()
    return queueId.value
  }

  function find(goodsId: string) {
    return items.value.find(item => item.goodsId === goodsId) || null
  }

  function update(goodsId: string, patch: Partial<ClubImportQueueItem>) {
    const item = find(goodsId)
    if (!item) return
    Object.assign(item, patch)
    persist()
  }

  function markProcessing(goodsId: string) {
    update(goodsId, { status: 'processing', resultMessage: null })
  }

  function markPending(goodsId: string, message?: string | null) {
    update(goodsId, { status: 'pending', resultMessage: message || null })
  }

  function markCompleted(goodsId: string, resultGoodsId?: string | null, message?: string | null) {
    update(goodsId, { status: 'completed', resultGoodsId: resultGoodsId || null, resultMessage: message || null })
  }

  function markSkipped(goodsId: string, message = '已跳过') {
    update(goodsId, { status: 'skipped', resultMessage: message })
  }

  function markFailed(goodsId: string, message: string) {
    update(goodsId, { status: 'failed', resultMessage: message })
  }

  function nextPending() {
    return items.value.find(item => item.status === 'pending' || item.status === 'processing') || null
  }

  function clear() {
    queueId.value = null
    createdAt.value = null
    items.value = []
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }
  }

  hydrate()

  return {
    queueId,
    createdAt,
    items,
    pendingItems,
    completedItems,
    unresolvedItems,
    currentItem,
    isComplete,
    hydrate,
    start,
    find,
    update,
    markProcessing,
    markPending,
    markCompleted,
    markSkipped,
    markFailed,
    nextPending,
    clear,
  }
})
