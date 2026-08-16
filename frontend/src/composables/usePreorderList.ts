import { computed, ref } from 'vue'
import * as reminderApi from '@/api/reminder'
import type { Preorder, PreorderStatus } from '@/api/types'

export const PREORDER_PAGE_SIZE = 12
/** 通知高亮定位最多顺序探测页数（12 条/页 → 120 条上限） */
export const PREORDER_HIGHLIGHT_MAX_PAGES = 10
const SEARCH_DEBOUNCE_MS = 300

export interface UsePreorderListOptions {
  /** 移动端返回 true：列表为无限滚动合并模式；桌面返回 false：单页替换模式 */
  isInfinite?: () => boolean
  initialStatus?: PreorderStatus | ''
}

/** 预购列表状态：桌面分页 / 移动无限滚动共享同一份筛选与数据源 */
export function usePreorderList(options: UsePreorderListOptions = {}) {
  const isInfinite = options.isInfinite ?? (() => false)
  const preorders = ref<Preorder[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = PREORDER_PAGE_SIZE
  const loading = ref(false)
  const switching = ref(false)
  const hasNext = ref(false)
  const loadError = ref(false)
  const statusFilter = ref<PreorderStatus | ''>(options.initialStatus ?? '')
  const searchKeyword = ref('')

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  const emptyText = computed(() =>
    statusFilter.value || searchKeyword.value
      ? '没有找到匹配的预购'
      : '还没有预购登记，点击「新增预购」登记第一笔手办定金吧'
  )

  const requestList = async (targetPage: number) => {
    return reminderApi.listPreorders({
      page: targetPage,
      page_size: pageSize,
      status: statusFilter.value || undefined,
      search: searchKeyword.value || undefined,
    })
  }

  const appendUnique = (incoming: Preorder[]) => {
    const seen = new Set(preorders.value.map((item) => item.id))
    const fresh = incoming.filter((item) => !seen.has(item.id))
    preorders.value = [...preorders.value, ...fresh]
  }

  /** 加载当前 page（首屏 / 切换 / 桌面翻页共用）。调用方负责先把 page 置为目标页。 */
  const loadInitial = async () => {
    const isEmpty = preorders.value.length === 0
    loading.value = isEmpty
    switching.value = !isEmpty
    loadError.value = false
    try {
      const data = await requestList(page.value)
      preorders.value = data.results
      total.value = data.count
      hasNext.value = data.next !== null
    } catch {
      loadError.value = true
      // 全局错误提示已由 request 拦截器处理
    } finally {
      loading.value = false
      switching.value = false
    }
  }

  /** 无限滚动：加载下一页并追加（按 id 去重） */
  const loadMore = async () => {
    if (!isInfinite() || loading.value || switching.value || !hasNext.value) return
    switching.value = true
    loadError.value = false
    try {
      const data = await requestList(page.value + 1)
      page.value += 1
      total.value = data.count
      hasNext.value = data.next !== null
      appendUnique(data.results)
    } catch {
      loadError.value = true
    } finally {
      switching.value = false
    }
  }

  /** 下拉刷新：回到第一页重载（保持无限滚动合并语义，丢弃后续页） */
  const refresh = async () => {
    page.value = 1
    await loadInitial()
  }

  const handleFilterChange = () => {
    page.value = 1
    loadInitial()
  }

  const handleSearchInput = () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      page.value = 1
      loadInitial()
    }, SEARCH_DEBOUNCE_MS)
  }

  const handleSearchClear = () => {
    page.value = 1
    loadInitial()
  }

  /**
   * 通知 highlight 定位（无限滚动模式）：顺序翻页直到命中目标；
   * 超过 10 页仍未命中返回 false，列表停留在已加载状态。
   */
  const loadUntilId = async (id: string): Promise<boolean> => {
    if (preorders.value.some((item) => item.id === id)) return true
    for (let i = 0; i < PREORDER_HIGHLIGHT_MAX_PAGES; i++) {
      if (!hasNext.value && preorders.value.length > 0) return false
      switching.value = true
      loadError.value = false
      try {
        const data = await requestList(page.value + 1)
        page.value += 1
        total.value = data.count
        hasNext.value = data.next !== null
        appendUnique(data.results)
      } catch {
        loadError.value = true
        switching.value = false
        return false
      } finally {
        switching.value = false
      }
      if (preorders.value.some((item) => item.id === id)) return true
    }
    return false
  }

  const clearSearchTimer = () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = null
  }

  return {
    preorders,
    total,
    page,
    pageSize,
    loading,
    switching,
    hasNext,
    loadError,
    statusFilter,
    searchKeyword,
    emptyText,
    loadInitial,
    loadMore,
    refresh,
    handleFilterChange,
    handleSearchInput,
    handleSearchClear,
    loadUntilId,
    clearSearchTimer,
  }
}
