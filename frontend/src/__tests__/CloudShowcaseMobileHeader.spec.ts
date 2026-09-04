import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CloudShowcase from '@/views/CloudShowcase.vue'
import type { GoodsListItem } from '@/api/types'

const cloudShowcaseSource = readFileSync(resolve(process.cwd(), 'src/views/CloudShowcase.vue'), 'utf8')

const routerPush = vi.hoisted(() => vi.fn())
const getGoodsListMock = vi.hoisted(() => vi.fn())
const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: routeQuery.value,
  }),
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('@/api/goods', () => ({
  deleteGoods: vi.fn(),
  getGoodsList: getGoodsListMock,
  moveGoods: vi.fn(),
}))

const setWindowScrollY = (value: number) => {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value,
  })
}

// 记录本次测试挂载的 wrapper，beforeEach 统一卸载，
// 避免上一个用例的 window 事件监听器残留污染后续用例
const mountedWrappers: Array<{ unmount: () => void }> = []

const createTouchEvent = (type: string, clientY: number) => {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as TouchEvent

  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: [{ clientY }],
  })

  return event
}

const sampleGoods: GoodsListItem = {
  id: 'goods-1',
  name: 'Sample Goods',
  main_photo: '',
  is_official: true,
  quantity: 1,
  ip: { id: 1, name: 'IP' },
  characters: [{ id: 1, name: 'Character', ip: { id: 1, name: 'IP' }, gender: 'other' }],
  category: { id: 1, name: 'Category', parent: null, path_name: 'Category', color_tag: '#D4AF37', order: 1 },
  location_path: '',
  status: 'in_cabinet',
}

const setViewport = (viewport: 'mobile' | 'desktop') => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: viewport === 'mobile' ? 390 : 1440,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: viewport === 'mobile' ? 844 : 900,
  })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: viewport === 'mobile' ? 1 : 0,
  })
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: viewport === 'mobile' && query === '(pointer: coarse)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const mountCloudShowcase = async ({
  goodsResults = [],
  viewport = 'mobile',
}: {
  goodsResults?: GoodsListItem[]
  viewport?: 'mobile' | 'desktop'
} = {}) => {
  setViewport(viewport)
  setWindowScrollY(0)
  getGoodsListMock.mockResolvedValue({
    results: goodsResults,
    count: goodsResults.length,
    page: 1,
    page_size: 18,
    next: null,
    previous: null,
  })

  setActivePinia(createPinia())

  const wrapper = mount(CloudShowcase, {
    global: {
      directives: {
        loading: {},
      },
      stubs: {
        SearchBar: { template: '<div data-test="search-bar" />' },
        FilterPanel: { template: '<div data-test="filter-panel" />' },
        GoodsCard: { template: '<article class="goods-card-stub" @touchstart.stop />' },
        MobileGoodsCard: { template: '<article class="mobile-goods-card-stub" @touchstart.stop />' },
        GoodsDrawer: { template: '<aside />' },
        GoodsMultiDisplayDialog: { template: '<aside />' },
        StatsDashboard: { template: '<section data-test="stats-dashboard" />' },
        JournalWorkspace: { template: '<section data-test="journal-workspace" />' },
        ShowcaseManager: { template: '<section />' },
        'el-alert': { template: '<div />' },
        'el-button': { template: '<button><slot /></button>' },
        'el-card': { template: '<section><slot name="header" /><slot /></section>' },
        'el-empty': { template: '<div />' },
        'el-icon': { template: '<i><slot /></i>' },
        'el-option': { template: '<option />' },
        'el-select': { template: '<select><slot /></select>' },
        'el-skeleton': { template: '<div />' },
        'el-tab-pane': { template: '<div />' },
        'el-tabs': { template: '<div><slot /></div>' },
        Transition: false,
      },
    },
  })

  await wrapper.vm.$nextTick()
  mountedWrappers.push(wrapper)
  return wrapper
}

const mountMobileCloudShowcase = (options: { goodsResults?: GoodsListItem[] } = {}) =>
  mountCloudShowcase({ ...options, viewport: 'mobile' })

const mountDesktopCloudShowcase = (options: { goodsResults?: GoodsListItem[] } = {}) =>
  mountCloudShowcase({ ...options, viewport: 'desktop' })

describe('CloudShowcase mobile compact header', () => {
  function cssRuleBlock(source: string, selector: string) {
    const start = source.indexOf(selector)
    expect(start).toBeGreaterThan(-1)

    const open = source.indexOf('{', start)
    const close = source.indexOf('}', open)
    expect(open).toBeGreaterThan(start)
    expect(close).toBeGreaterThan(open)

    return source.slice(open + 1, close)
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    routeQuery.value = {}
    getGoodsListMock.mockReset()
    vi.stubGlobal('IntersectionObserver', class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    })
  })

  it('keeps mobile search collapsed until the search trigger is tapped', async () => {
    const wrapper = await mountMobileCloudShowcase()

    expect(wrapper.find('[data-test="search-bar"]').exists()).toBe(false)
    expect(wrapper.get('.mobile-search-trigger').attributes('aria-expanded')).toBe('false')

    await wrapper.get('.mobile-search-trigger').trigger('click')

    expect(wrapper.find('[data-test="search-bar"]').exists()).toBe(true)
    expect(wrapper.get('.mobile-search-trigger').attributes('aria-expanded')).toBe('true')
  })

  it('defines an expand transition for the mobile search panel', () => {
    expect(cloudShowcaseSource).toContain('<Transition name="mobile-search-expand">')
    expect(cloudShowcaseSource).toContain('.mobile-search-expand-enter-active')
    expect(cloudShowcaseSource).toContain('.mobile-search-expand-leave-active')
    expect(cloudShowcaseSource).toContain('.mobile-search-expand-enter-from')
    expect(cloudShowcaseSource).toContain('.mobile-search-expand-leave-to')
  })

  it('aligns the mobile sticky tabs with the shared navbar height', () => {
    expect(cloudShowcaseSource).toContain('top: var(--app-navbar-height, 64px);')
    expect(cloudShowcaseSource).toContain('background: var(--bg-gray, #f7f8fa);')
    expect(cloudShowcaseSource).toContain('padding-top: 0;')
  })

  it('places the journal tab before the stats dashboard tab', () => {
    const journalIndex = cloudShowcaseSource.indexOf('name="journal"')
    const statsIndex = cloudShowcaseSource.indexOf('name="stats"')

    expect(journalIndex).toBeGreaterThan(-1)
    expect(statsIndex).toBeGreaterThan(-1)
    expect(journalIndex).toBeLessThan(statsIndex)
  })

  it('does not render the desktop floating page-size selector', async () => {
    const wrapper = await mountDesktopCloudShowcase({ goodsResults: [sampleGoods] })
    await flushPromises()

    expect(wrapper.find('.page-size-float').exists()).toBe(false)
  })

  it('keeps pull gestures for refresh instead of revealing the search bar', async () => {
    const wrapper = await mountMobileCloudShowcase()
    await flushPromises()
    expect(getGoodsListMock).toHaveBeenCalledTimes(1)

    const pullWrapper = wrapper.get('.barn-pull-refresh-wrapper')
    await pullWrapper.trigger('touchstart', { touches: [{ clientY: 10 }] })
    await pullWrapper.trigger('touchmove', { touches: [{ clientY: 160 }] })
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-test="search-bar"]').exists()).toBe(false)
    expect(wrapper.get('.pull-indicator').text()).toContain('释放刷新')

    await pullWrapper.trigger('touchend')
    await flushPromises()

    expect(getGoodsListMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-test="search-bar"]').exists()).toBe(false)
  })

  it('renders the mobile filter sheet outside the pull refresh container', async () => {
    const wrapper = await mountMobileCloudShowcase()

    await wrapper.get('.mobile-filter-trigger').trigger('click')

    const sheet = wrapper.get('.mobile-filter-sheet')
    expect(sheet.classes()).toContain('is-open')
    expect(sheet.element.closest('.barn-pull-refresh-content')).toBe(null)
    expect(wrapper.get('.mobile-filter-backdrop').element.closest('.barn-pull-refresh-content')).toBe(null)
  })

  it('refreshes when pulling from a goods card area', async () => {
    const wrapper = await mountMobileCloudShowcase()
    await flushPromises()
    expect(getGoodsListMock).toHaveBeenCalledTimes(1)

    const pullWrapper = wrapper.get('.barn-pull-refresh-wrapper')
    const card = document.createElement('article')
    card.className = 'goods-card-stub'
    card.addEventListener('touchstart', event => event.stopPropagation())
    pullWrapper.element.appendChild(card)

    card.dispatchEvent(createTouchEvent('touchstart', 10))
    card.dispatchEvent(createTouchEvent('touchmove', 160))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.pull-indicator').text()).toContain('释放刷新')

    card.dispatchEvent(createTouchEvent('touchend', 160))
    await flushPromises()

    expect(getGoodsListMock).toHaveBeenCalledTimes(2)
  })

  it('does not create a desktop containing block around the drawer', () => {
    const globalStyleSource = cloudShowcaseSource.split('@media (max-width: 768px)')[0] ?? ''
    const globalPullContentRule = globalStyleSource.match(
      /\.barn-pull-refresh-content\s*\{[\s\S]*?\}/,
    )?.[0] ?? ''

    expect(globalPullContentRule).not.toContain('will-change: transform')
  })

  it('keeps medium desktop at five columns and opens large desktop to six columns', () => {
    expect(cloudShowcaseSource).toContain('max-width: 1400px;')
    expect(cloudShowcaseSource).toContain('grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));')
    expect(cloudShowcaseSource).toContain('@media (min-width: 1500px)')
    expect(cloudShowcaseSource).toContain('max-width: 1520px;')
  })

  it('opens the stats tab when the route query requests it', async () => {
    routeQuery.value = { tab: 'stats' }

    const wrapper = await mountMobileCloudShowcase()

    expect(wrapper.find('[data-test="stats-dashboard"]').exists()).toBe(true)
    expect(wrapper.find('.barn-section').exists()).toBe(false)
  })

  it('opens the journal tab when the route query requests it', async () => {
    routeQuery.value = { tab: 'journal' }

    const wrapper = await mountMobileCloudShowcase()

    expect(wrapper.find('[data-test="journal-workspace"]').exists()).toBe(true)
    expect(wrapper.find('.barn-section').exists()).toBe(false)
  })

  it('uses the dense mobile card only in the mobile granary branch', () => {
    expect(cloudShowcaseSource).toContain("import MobileGoodsCard from '@/components/MobileGoodsCard.vue'")
    expect(cloudShowcaseSource).toContain('<MobileGoodsCard')
    expect(cloudShowcaseSource).toContain('v-if="isMobile"')
    expect(cloudShowcaseSource).toContain('<GoodsCard')
    expect(cloudShowcaseSource).toContain('v-else')
  })

  it('keeps card event bindings aligned between mobile and desktop branches', () => {
    const mobileCardIndex = cloudShowcaseSource.indexOf('<MobileGoodsCard')
    const desktopCardIndex = cloudShowcaseSource.indexOf('<GoodsCard')
    const mobileCardBlock = cloudShowcaseSource.slice(mobileCardIndex, cloudShowcaseSource.indexOf('/>', mobileCardIndex))
    const desktopCardBlock = cloudShowcaseSource.slice(desktopCardIndex, cloudShowcaseSource.indexOf('/>', desktopCardIndex))

    for (const binding of ['@click="handleCardClick"', '@select="handleCardSelect"', '@location-click="handleLocationClick"', '@context-menu="handleCardContextMenu"']) {
      expect(mobileCardBlock).toContain(binding)
      expect(desktopCardBlock).toContain(binding)
    }
  })

  it('uses opacity-only mobile tab transitions to prevent zoom-like jitter', () => {
    const mobileTransitionRule = cssRuleBlock(
      cloudShowcaseSource,
      '.tab-fade-enter-active,\n  .tab-fade-leave-active',
    )
    const mobileEnterRule = cssRuleBlock(
      cloudShowcaseSource,
      '.tab-fade-enter-from,\n  .tab-fade-leave-to',
    )
    const mobilePanelRule = cssRuleBlock(
      cloudShowcaseSource,
      '.barn-section,\n  .stats-section',
    )

    expect(mobileTransitionRule).toContain('transition: opacity 0.18s ease;')
    expect(mobileTransitionRule).toContain('transform: none;')
    expect(mobileEnterRule).toContain('opacity: 0;')
    expect(mobileEnterRule).toContain('transform: none;')
    expect(mobilePanelRule).toContain('width: 100%;')
    expect(mobilePanelRule).toContain('min-width: 0;')
    expect(mobilePanelRule).toContain('box-sizing: border-box;')
  })

  it('refreshing on the journal tab triggers journal refresh only', async () => {
    routeQuery.value = { tab: 'journal' }
    await mountCloudShowcase({ viewport: 'desktop' })

    const seen: string[] = []
    const listener = (e: Event) => { seen.push(e.type) }
    window.addEventListener('cloud-showcase:journal-refresh', listener)
    window.addEventListener('cloud-showcase:stats-refresh', listener)

    window.dispatchEvent(new CustomEvent('cloud-showcase:refresh'))
    await flushPromises()

    expect(seen).toContain('cloud-showcase:journal-refresh')
    expect(seen).not.toContain('cloud-showcase:stats-refresh')

    window.removeEventListener('cloud-showcase:journal-refresh', listener)
    window.removeEventListener('cloud-showcase:stats-refresh', listener)
  })

  it('defers refresh-complete on the journal tab until journal refresh finishes', async () => {
    routeQuery.value = { tab: 'journal' }
    await mountCloudShowcase({ viewport: 'desktop' })

    const seen: string[] = []
    const listener = (e: Event) => { seen.push(e.type) }
    window.addEventListener('cloud-showcase:refresh-complete', listener)

    window.dispatchEvent(new CustomEvent('cloud-showcase:refresh'))
    await flushPromises()

    // 手帐刷新完成前不应发送 refresh-complete（Layout 刷新态保持）
    expect(seen).not.toContain('cloud-showcase:refresh-complete')

    // 模拟 JournalWorkspace 完成刷新
    window.dispatchEvent(new CustomEvent('cloud-showcase:journal-refresh-complete'))
    await flushPromises()

    expect(seen).toContain('cloud-showcase:refresh-complete')
    window.removeEventListener('cloud-showcase:refresh-complete', listener)
  })
})
