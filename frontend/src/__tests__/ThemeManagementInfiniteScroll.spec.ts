import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const viewSource = readFileSync(join(process.cwd(), 'src/views/ThemeManagement.vue'), 'utf-8')

// ============================================================
// 1. 源码结构断言：确保模板和 observer 配置正确
// ============================================================
describe('ThemeManagement infinite scroll – source structure', () => {
  it('renders a sentinel element with v-if="hasMoreMobileData"', () => {
    expect(viewSource).toContain('ref="sentinelRef"')
    expect(viewSource).toContain('v-if="hasMoreMobileData"')
    expect(viewSource).toContain('class="scroll-sentinel"')
  })

  it('shows a loading indicator when loadingMoreMobile is true', () => {
    expect(viewSource).toContain('v-if="loadingMoreMobile"')
    expect(viewSource).toContain('class="load-more-wrapper"')
    expect(viewSource).toContain('加载中...')
  })

  it('does NOT render a "继续加载" button (old pattern removed)', () => {
    // The template should not have a clickable "继续加载" button
    expect(viewSource).not.toContain('继续加载')
    // The old pattern: a button with @click="loadMoreMobile" in the template
    // loadMoreMobile still exists as a script function, but should NOT appear in <template>
    const templateSection = viewSource.match(/<template>[\s\S]*?<\/template>/)?.[0] ?? ''
    expect(templateSection).not.toContain('@click="loadMoreMobile"')
    expect(templateSection).not.toContain(':loading="loadingMore"')
  })

  it('creates IntersectionObserver WITHOUT a root option (viewport-based)', () => {
    // Must NOT set root: scrollContainerRef.value — the scroll context is the window
    expect(viewSource).not.toContain('root: scrollContainerRef.value')
    // Must create the observer
    expect(viewSource).toContain('new IntersectionObserver')
    expect(viewSource).toContain("rootMargin: '100px'")
  })

  it('watches sentinelRef for conditional mount/unmount', () => {
    expect(viewSource).toContain('watch(sentinelRef')
    expect(viewSource).toContain('sentinelObserver.observe(el)')
    expect(viewSource).toContain('sentinelObserver.unobserve(oldEl)')
  })

  it('cleans up observer in onUnmounted', () => {
    expect(viewSource).toContain('sentinelObserver.disconnect()')
  })

  it('refreshes the theme list and closes edit dialog when detail loading returns 404', () => {
    const handleEditStart = viewSource.indexOf('const handleEdit = async (row: Theme) => {')
    expect(handleEditStart).toBeGreaterThan(-1)
    const handleEditBody = viewSource.slice(handleEditStart, handleEditStart + 1200)
    expect(handleEditBody).toContain('error?.response?.status === 404')
    expect(handleEditBody).toContain('dialogVisible.value = false')
    expect(handleEditBody).toContain('editingId.value = null')
    expect(handleEditBody).toContain('await fetchThemeList(true)')
  })

  it('has guard logic to prevent duplicate loadMoreMobile calls', () => {
    // loadMoreMobile should check loadingMoreMobile.value before proceeding
    expect(viewSource).toContain('if (loadingMoreMobile.value || !hasMoreMobileData.value) return')
  })

  it('uses nextTick to reset loadingMoreMobile after DOM update', () => {
    // This prevents the observer from re-firing before the sentinel is removed from DOM
    expect(viewSource).toMatch(/loadingMoreMobile\.value\s*=\s*false/)
    // Find the loadMoreMobile function and verify nextTick wraps the reset
    const fnStart = viewSource.indexOf('const loadMoreMobile = () => {')
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = viewSource.slice(fnStart, fnStart + 500)
    expect(fnBody).toContain('nextTick')
    expect(fnBody).toContain('loadingMoreMobile.value = false')
    // nextTick should appear BEFORE the reset (wrapping it)
    expect(fnBody.indexOf('nextTick')).toBeLessThan(fnBody.indexOf('loadingMoreMobile.value = false'))
  })
})

// ============================================================
// 2. 逻辑单测：验证 loadMoreMobile 的行为
// ============================================================
describe('ThemeManagement infinite scroll – loadMoreMobile logic', () => {
  // Simulate the core reactive state from ThemeManagement.vue
  const mobileDisplayList = ref<any[]>([])
  const loadingMoreMobile = ref(false)
  const filteredThemeList = ref<any[]>([])
  const mobilePageSize = 10

  const hasMoreMobileData = () =>
    mobileDisplayList.value.length < filteredThemeList.value.length

  function loadMoreMobile() {
    if (loadingMoreMobile.value || !hasMoreMobileData()) return
    loadingMoreMobile.value = true
    const currentLength = mobileDisplayList.value.length
    const nextBatch = filteredThemeList.value.slice(currentLength, currentLength + mobilePageSize)
    mobileDisplayList.value = [...mobileDisplayList.value, ...nextBatch]
    // nextTick to reset (mirrors the real component)
    nextTick(() => {
      loadingMoreMobile.value = false
    })
  }

  beforeEach(() => {
    // 25 items total, page size 10 → 3 pages
    const allItems = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Theme ${i + 1}` }))
    filteredThemeList.value = allItems
    mobileDisplayList.value = allItems.slice(0, mobilePageSize)
    loadingMoreMobile.value = false
  })

  it('loads the next batch of items', async () => {
    expect(mobileDisplayList.value).toHaveLength(10)

    loadMoreMobile()
    await nextTick()

    expect(mobileDisplayList.value).toHaveLength(20)
    expect(mobileDisplayList.value[10].name).toBe('Theme 11')
    expect(loadingMoreMobile.value).toBe(false)
  })

  it('loads the final partial page', async () => {
    // Load page 2 first
    loadMoreMobile()
    await nextTick()
    expect(mobileDisplayList.value).toHaveLength(20)

    // Load page 3 (only 5 items remain)
    loadMoreMobile()
    await nextTick()
    expect(mobileDisplayList.value).toHaveLength(25)
    expect(hasMoreMobileData()).toBe(false)
  })

  it('stops loading when all items are displayed', async () => {
    // Exhaust all pages
    loadMoreMobile(); await nextTick()
    loadMoreMobile(); await nextTick()
    loadMoreMobile(); await nextTick() // no-op, already at 25

    expect(mobileDisplayList.value).toHaveLength(25)

    // Further calls should be no-ops
    loadMoreMobile(); await nextTick()
    expect(mobileDisplayList.value).toHaveLength(25)
  })

  it('prevents duplicate calls while loading', async () => {
    // loadingMoreMobile starts false, first call should proceed
    loadMoreMobile()
    // Before nextTick resolves, loadingMoreMobile is still true
    // so a second synchronous call should be a no-op
    loadMoreMobile()

    await nextTick()
    // Only one batch should have been added
    expect(mobileDisplayList.value).toHaveLength(20)
  })

  it('resets display list when filteredThemeList changes (simulating filter)', async () => {
    // Load more first
    loadMoreMobile()
    await nextTick()
    expect(mobileDisplayList.value).toHaveLength(20)

    // Simulate filter change: only 3 items match
    filteredThemeList.value = [
      { id: 100, name: 'Filtered A' },
      { id: 101, name: 'Filtered B' },
      { id: 102, name: 'Filtered C' },
    ]
    // Simulate the watcher: reset to first page
    mobileDisplayList.value = filteredThemeList.value.slice(0, mobilePageSize)
    await nextTick()

    expect(mobileDisplayList.value).toHaveLength(3)
    expect(hasMoreMobileData()).toBe(false)
  })
})

// ============================================================
// 3. IntersectionObserver mock：验证 observer 回调行为
// ============================================================
describe('ThemeManagement infinite scroll – IntersectionObserver integration', () => {
  let observerCallback: IntersectionObserverCallback | null = null
  let observerOptions: IntersectionObserverInit | undefined

  beforeEach(() => {
    observerCallback = null
    observerOptions = undefined

    // Mock IntersectionObserver
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
          observerCallback = cb
          observerOptions = opts
        }
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        takeRecords = vi.fn(() => [])
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('observer is created with rootMargin and without root', () => {
    // Simulate what onMounted does
    const _observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          // loadMoreMobile() would be called here
        }
      },
      { rootMargin: '100px' },
    )

    expect(observerOptions).toEqual({ rootMargin: '100px' })
    expect(observerOptions).not.toHaveProperty('root')
  })

  it('observer callback triggers loadMore when sentinel intersects', () => {
    const loadMore = vi.fn()

    // Simulate onMounted observer creation
    new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '100px' },
    )

    // Simulate the sentinel entering the viewport
    observerCallback!(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )

    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('observer callback does NOT trigger when sentinel leaves viewport', () => {
    const loadMore = vi.fn()

    new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '100px' },
    )

    // Simulate the sentinel leaving the viewport
    observerCallback!(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )

    expect(loadMore).not.toHaveBeenCalled()
  })
})
