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

vi.mock('vue-router', () => ({
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

const mountMobileCloudShowcase = async ({
  goodsResults = [],
}: {
  goodsResults?: GoodsListItem[]
} = {}) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 390,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 844,
  })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 1,
  })
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(pointer: coarse)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
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
        StatsDashboard: { template: '<section />' },
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

describe('CloudShowcase mobile compact header', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
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

  it('keeps pull gestures for refresh instead of revealing the search bar', async () => {
    const wrapper = await mountMobileCloudShowcase()
    await flushPromises()
    expect(getGoodsListMock).toHaveBeenCalledTimes(1)

    const pullWrapper = wrapper.get('.barn-pull-refresh-wrapper')
    await pullWrapper.trigger('touchstart', { touches: [{ clientY: 10 }] })
    await pullWrapper.trigger('touchmove', { touches: [{ clientY: 160 }] })

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
})
