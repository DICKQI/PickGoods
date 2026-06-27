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
  return wrapper
}

const mountMobileCloudShowcase = (options: { goodsResults?: GoodsListItem[] } = {}) =>
  mountCloudShowcase({ ...options, viewport: 'mobile' })

const mountDesktopCloudShowcase = (options: { goodsResults?: GoodsListItem[] } = {}) =>
  mountCloudShowcase({ ...options, viewport: 'desktop' })

describe('CloudShowcase mobile compact header', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
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
})
