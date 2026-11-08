import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CloudShowcase from '@/views/CloudShowcase.vue'

const cloudShowcaseSource = readFileSync(resolve(process.cwd(), 'src/views/CloudShowcase.vue'), 'utf8')

/** 取出某个选择器对应的 CSS 规则块（含媒体查询内的同名规则）。 */
const cssRulesFor = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return Array.from(
    cloudShowcaseSource.matchAll(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\}`, 'g')),
    (match) => match[0],
  )
}

const getGoodsListMock = vi.hoisted(() => vi.fn())
const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
  useRoute: () => ({
    query: routeQuery.value,
    path: '/showcase',
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/api/goods', () => ({
  deleteGoods: vi.fn(),
  getGoodsList: getGoodsListMock,
  moveGoods: vi.fn(),
}))

const mountedWrappers: VueWrapper[] = []

const setViewport = () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const mountCloudShowcase = async () => {
  setViewport()
  getGoodsListMock.mockResolvedValue({
    results: [],
    count: 0,
    page: 1,
    page_size: 18,
    next: null,
    previous: null,
  })

  setActivePinia(createPinia())

  const wrapper = mount(CloudShowcase, {
    global: {
      directives: { loading: {} },
      stubs: {
        SearchBar: { template: '<div data-test="search-bar" />' },
        FilterPanel: { template: '<div data-test="filter-panel" />' },
        GoodsCard: { template: '<article class="goods-card-stub" />' },
        MobileGoodsCard: { template: '<article class="mobile-goods-card-stub" />' },
        GoodsDrawer: { template: '<aside />' },
        GoodsImageMatcher: { template: '<div />' },
        GoodsMultiDisplayDialog: { template: '<aside />' },
        StatsDashboard: { template: '<section />' },
        JournalLibrary: { template: '<section />' },
        JournalWorkspace: { template: '<section />' },
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

describe('CloudShowcase selection status bar transition', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    routeQuery.value = {}
    getGoodsListMock.mockReset()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
      },
    )
  })

  it('establishes a block formatting context on the pull refresh content', () => {
    const [rule] = cssRulesFor('.barn-pull-refresh-content')
    expect(rule).toBeTruthy()
    expect(rule).toContain('display: flow-root')
  })

  it('animates the slot row height instead of the bar box model', () => {
    const slotRules = cssRulesFor('.selection-slot')
    expect(slotRules.length).toBeGreaterThan(0)
    expect(slotRules[0]).toContain('grid-template-rows: 0fr')
    expect(slotRules[0]).toContain('transition: grid-template-rows')

    const openRules = cssRulesFor('.selection-slot.is-open')
    expect(openRules.length).toBeGreaterThan(0)
    expect(openRules[0]).toContain('grid-template-rows: 1fr')

    const trackRules = cssRulesFor('.selection-slot-track')
    expect(trackRules.length).toBeGreaterThan(0)
    expect(trackRules[0]).toContain('overflow: hidden')
  })

  it('keeps the bar animation to opacity and transform only', () => {
    const transitionRules = [
      ...cssRulesFor('.selection-bar-enter-active'),
      ...cssRulesFor('.selection-bar-leave-active'),
    ]
    expect(transitionRules.length).toBeGreaterThan(0)

    for (const rule of transitionRules) {
      expect(rule).not.toContain('max-height')
      expect(rule).not.toContain('margin')
      expect(rule).not.toContain('padding')
      expect(rule).not.toContain('border-color')
    }

    const fromRules = [
      ...cssRulesFor('.selection-bar-enter-from'),
      ...cssRulesFor('.selection-bar-leave-to'),
    ]
    expect(fromRules.length).toBeGreaterThan(0)

    for (const rule of fromRules) {
      expect(rule).not.toContain('scaleY')
      expect(rule).not.toContain('max-height')
    }
  })

  it('does not clamp the bar with a fixed max-height', () => {
    const barRules = cssRulesFor('.selection-status-bar')
    expect(barRules.length).toBeGreaterThan(0)

    for (const rule of barRules) {
      expect(rule).not.toContain('max-height')
      expect(rule).not.toContain('overflow: hidden')
    }
  })

  it('disables the slot transition for reduced motion', () => {
    const reducedMotionBlock = cloudShowcaseSource.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/,
    )?.[0] ?? ''

    expect(reducedMotionBlock).toContain('.selection-slot')
    expect(reducedMotionBlock).toContain('transition: none')
    expect(reducedMotionBlock).toContain('.selection-bar-enter-active')
  })

  it('toggles the slot wrapper together with the selection bar', async () => {
    const wrapper = await mountCloudShowcase()
    await flushPromises()

    expect(wrapper.find('.selection-slot').exists()).toBe(true)
    expect(wrapper.get('.selection-slot').classes()).not.toContain('is-open')
    expect(wrapper.find('.selection-status-bar').exists()).toBe(false)

    window.dispatchEvent(new CustomEvent('cloud-showcase:selection-enter'))
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(wrapper.get('.selection-slot').classes()).toContain('is-open')
    expect(wrapper.find('.selection-status-bar').exists()).toBe(true)
    expect(wrapper.get('.selection-slot-track').find('.selection-status-bar').exists()).toBe(true)

    window.dispatchEvent(new CustomEvent('cloud-showcase:selection-exit'))
    await wrapper.vm.$nextTick()
    await flushPromises()

    // 槽位先收起，状态条自身的离场动画随后结束（jsdom 不会触发 transitionend）。
    expect(wrapper.get('.selection-slot').classes()).not.toContain('is-open')

    await new Promise<void>((resolve) => setTimeout(resolve, 60))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.selection-status-bar').exists()).toBe(false)
  })
})
