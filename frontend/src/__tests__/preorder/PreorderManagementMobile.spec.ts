import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computed, defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PreorderManagement from '@/views/PreorderManagement.vue'

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined
}

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessageBox: { ...actual.ElMessageBox, confirm: vi.fn().mockResolvedValue('confirm') },
    ElMessage: {
      ...actual.ElMessage,
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  }
})

const mobileState = vi.hoisted(() => ({ value: true }))

vi.mock('@/composables/useResponsiveDevice', () => ({
  useResponsiveDevice: () => ({ isMobile: computed(() => mobileState.value) }),
}))

vi.mock('@/api/reminder', () => ({
  listPreorders: vi.fn(),
  getPreorderStats: vi.fn().mockResolvedValue({
    pending_count: 3,
    due_this_month: 1,
    due_this_quarter: 2,
    converted_count: 5,
    total_pending_balance: '1050.00',
  }),
  createPreorder: vi.fn(),
  updatePreorder: vi.fn(),
  deletePreorder: vi.fn(),
  markPreorderPaid: vi.fn(),
  cancelPreorder: vi.fn(),
  delayPreorder: vi.fn(),
  listPreorderDelays: vi.fn(),
  convertPreorderToGoods: vi.fn(),
  recognizePreorderImage: vi.fn(),
}))

import { getPreorderStats, listPreorderDelays, listPreorders, markPreorderPaid } from '@/api/reminder'
import type { Preorder } from '@/api/types'

const pageSource = readFileSync(resolve(process.cwd(), 'src/views/PreorderManagement.vue'), 'utf8')

const makePreorder = (id: string, overrides: Partial<Preorder> = {}): Preorder => ({
  id,
  name: '流萤手办',
  platform: '淘宝',
  shop_name: '示例店',
  order_no: 'ORD-001',
  deposit_amount: '100.00',
  balance_amount: '50.00',
  time_granularity: 'month',
  estimated_month: '2026-08-01',
  delay_count: 0,
  status: 'pending',
  paid_at: null,
  goods_id: null,
  goods_name: null,
  notes: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...overrides,
})

const paginated = (results: Preorder[], page = 1, next: number | null = null, count = results.length) => ({
  count,
  page,
  page_size: 12,
  next,
  previous: page > 1 ? page - 1 : null,
  results,
})

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  triggerIntersect() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    )
  }
}

const mountPage = async (query: Record<string, string> = {}) => {
  MockIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/preorders', component: { template: '<div />' } }],
  })
  await router.push({ path: '/preorders', query })
  await router.isReady()
  setActivePinia(createPinia())

  const wrapper = mount(PreorderManagement, {
    global: {
      plugins: [router],
      directives: { loading: {} },
      stubs: {
        'el-button': defineComponent({
          props: ['disabled', 'loading', 'type', 'size', 'icon', 'text', 'plain'],
          emits: ['click'],
          template: '<button class="el-button-stub" :disabled="disabled || loading" @click="$emit(\'click\', $event)"><slot /></button>',
        }),
        'el-icon': { template: '<i><slot /></i>' },
        'el-empty': { template: '<section class="el-empty-stub"><slot /></section>' },
        'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
        PreorderEditorForm: { template: '<div class="preorder-editor-form-stub" />' },
        PreorderDelayDialog: { template: '<div class="preorder-delay-form-stub" />' },
        ConvertGoodsForm: { template: '<div class="convert-goods-form-stub" />' },
        Transition: false,
        Teleport: true,
      },
    },
  })
  return { wrapper, router }
}

describe('PreorderManagement 移动端', () => {
  beforeEach(() => {
    mobileState.value = true
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    vi.clearAllMocks()
  })

  it('渲染移动端统计、筛选与卡片列表，不渲染桌面表格', async () => {
    vi.mocked(listPreorders).mockResolvedValue(
      paginated([makePreorder('p-1'), makePreorder('p-2', { status: 'paid' })]),
    )
    const { wrapper } = await mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('预购与尾款提醒')
    expect(wrapper.text()).toContain('共 2 条 · 按补款时间从近到远')
    expect(wrapper.text()).toContain('流萤手办')
    expect(wrapper.find('.preorder-mobile-card').exists()).toBe(true)
    expect(wrapper.find('.el-table-stub').exists()).toBe(false)
    expect(wrapper.find('.preorder-mobile-fab').exists()).toBe(true)
  })

  it('标题区位于独立滚动容器之外，刷新提示渲染在列表上方', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    const { wrapper } = await mountPage()
    await flushPromises()

    const sticky = wrapper.find('.preorder-mobile-sticky')
    const scroll = wrapper.find('.preorder-mobile-scroll')
    const indicator = wrapper.find('.mobile-pull-indicator')

    expect(sticky.exists()).toBe(true)
    expect(scroll.exists()).toBe(true)
    expect(indicator.exists()).toBe(true)
    expect(sticky.attributes('style')).toBeUndefined()
    // 标题区在滚动容器之前，列表滚动时不会进入标题下面。
    expect(
      sticky.element.compareDocumentPosition(scroll.element) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(pageSource).toMatch(/\.preorder-mobile-sticky \{[^}]*position: relative;/)
    expect(pageSource).toMatch(/\.preorder-mobile-scroll \{[^}]*overflow-y: auto;/)
    expect(pageSource).toMatch(/\.preorder-mobile-scroll \{[^}]*padding-top: 12px;/)
    expect(pageSource).toMatch(/\.preorder-mobile-expanded \{[^}]*max-height: var\(--preorder-mobile-expanded-height/)
    expect(pageSource).toContain('.preorder-mobile-collapse-spacer')
    expect(wrapper.find('.preorder-mobile-collapse-spacer').exists()).toBe(true)
    expect(pageSource).toMatch(/\.preorder-mobile-sticky\.is-compact \+ \.preorder-mobile-scroll \{[^}]*padding-top: 80px;/)
    // 下拉手势监听在独立滚动容器上。
    expect(pageSource).toContain('@touchstart.capture.passive="handleTouchStart"')
    expect(pageSource).toContain('@touchcancel="resetPullRefresh"')
    expect(pageSource).toContain('getScrollTop: () => mobileScrollRef.value?.scrollTop ?? 0')
  })

  it('向下滚动后收缩为标题和当前筛选名，中间保持收缩并在回顶后展开', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    const { wrapper } = await mountPage()
    await flushPromises()

    const sticky = wrapper.get('.preorder-mobile-sticky')
    const scroll = wrapper.get('.preorder-mobile-scroll').element as HTMLElement
    const compactFilter = wrapper.get('[data-test="preorder-compact-filter"]')
    const expanded = wrapper.get('.preorder-mobile-expanded')
    const flushFrame = async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await nextTick()
    }

    scroll.scrollTop = 56
    scroll.dispatchEvent(new Event('scroll'))
    await flushFrame()

    expect(sticky.classes()).not.toContain('is-compact')
    expect(sticky.attributes('data-compact')).toBe('false')

    scroll.scrollTop = 80
    scroll.dispatchEvent(new Event('scroll'))
    await flushFrame()

    expect(sticky.classes()).toContain('is-compact')
    expect(sticky.attributes('data-compact')).toBe('true')
    expect(compactFilter.text()).toBe('全部')
    expect(expanded.attributes('aria-hidden')).toBe('true')

    scroll.scrollTop = 24
    scroll.dispatchEvent(new Event('scroll'))
    await flushFrame()
    expect(sticky.classes()).toContain('is-compact')

    const paidChip = wrapper.findAll('.preorder-mobile-filterbar__chip')[2]!
    await paidChip.trigger('click')
    await flushPromises()
    expect(compactFilter.text()).toBe('已补款')

    scroll.scrollTop = 0
    scroll.dispatchEvent(new Event('scroll'))
    await flushFrame()
    expect(sticky.classes()).not.toContain('is-compact')
    expect(expanded.attributes('aria-hidden')).toBe('false')
  })

  it('新增 FAB 打开底部抽屉表单', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    const { wrapper } = await mountPage()
    await flushPromises()
    await wrapper.find('.preorder-mobile-fab').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('把外部平台下单的手办定金记下来吧~')
    expect(wrapper.find('.preorder-editor-form-stub').exists()).toBe(true)
  })

  it('无限滚动哨兵触发加载下一页并追加渲染', async () => {
    vi.mocked(listPreorders)
      .mockResolvedValueOnce(paginated([makePreorder('p-1')], 1, 2, 2))
      .mockResolvedValueOnce(paginated([makePreorder('p-2', { name: '第二页手办' })], 2, null, 2))
    const { wrapper } = await mountPage()
    await flushPromises()

    expect(wrapper.text()).not.toContain('第二页手办')
    const observer = MockIntersectionObserver.instances[0]!
    observer.triggerIntersect()
    await flushPromises()

    expect(listPreorders).toHaveBeenLastCalledWith({ page: 2, page_size: 12, status: undefined, search: undefined })
    expect(wrapper.text()).toContain('第二页手办')
    expect(wrapper.text()).toContain('没有更多了')
  })

  it('pending 卡片主操作打开确认面板，确认后调用接口', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    vi.mocked(markPreorderPaid).mockResolvedValue(makePreorder('p-1', { status: 'paid' }))
    const { wrapper } = await mountPage()
    await flushPromises()

    await wrapper.find('.preorder-mobile-card__primary').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('确认将「流萤手办」标记为已补款？此操作不可撤销。')

    const confirmButtons = wrapper.findAll('.mobile-action-sheet__confirm-btn')
    await confirmButtons[1]!.trigger('click')
    await flushPromises()
    expect(markPreorderPaid).toHaveBeenCalledWith('p-1')
  })

  it('标记补款后保留已加载的多页无限滚动列表', async () => {
    vi.mocked(listPreorders).mockImplementation(async ({ page: targetPage } = {}) =>
      targetPage === 1
        ? paginated([makePreorder('p-1')], 1, 2, 2)
        : paginated([makePreorder('p-2', { name: '第二页手办' })], 2, null, 2)
    )
    vi.mocked(markPreorderPaid).mockResolvedValue(makePreorder('p-1', { status: 'paid' }))
    const { wrapper } = await mountPage()
    await flushPromises()

    MockIntersectionObserver.instances[0]!.triggerIntersect()
    await flushPromises()
    expect(wrapper.text()).toContain('第二页手办')

    await wrapper.findAll('.preorder-mobile-card__primary')[0]!.trigger('click')
    await flushPromises()
    const confirmButtons = wrapper.findAll('.mobile-action-sheet__confirm-btn')
    await confirmButtons[1]!.trigger('click')
    await flushPromises()

    expect(markPreorderPaid).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('流萤手办')
    expect(wrapper.text()).toContain('第二页手办')
  })

  it('⋯ 菜单选择删除进入底部确认面板', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    const { wrapper } = await mountPage()
    await flushPromises()

    await wrapper.find('.preorder-mobile-card__more').trigger('click')
    await flushPromises()
    const menuButtons = wrapper.findAll('.mobile-action-sheet__item')
    const deleteItem = menuButtons.find((b) => b.text().includes('删除'))!
    await deleteItem.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('确定删除「流萤手办」？相关通知将一并删除。')
  })

  it('⋯ 菜单选择跳票延期打开延期底部抽屉', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    vi.mocked(listPreorderDelays).mockResolvedValue([])
    const { wrapper } = await mountPage()
    await flushPromises()

    await wrapper.find('.preorder-mobile-card__more').trigger('click')
    await flushPromises()
    const delayItem = wrapper
      .findAll('.mobile-action-sheet__item')
      .find((b) => b.text().includes('跳票延期'))!
    await delayItem.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('跳票延期')
    expect(wrapper.find('.preorder-delay-form-stub').exists()).toBe(true)
  })

  it('延期后的卡片显示延期次数标签', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1', { delay_count: 3 })]))
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('延期×3')
  })

  it('点击状态胶囊触发筛选重载并携带 status 参数', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([], 1, null, 0))
    const { wrapper } = await mountPage()
    await flushPromises()

    const chips = wrapper.findAll('.preorder-mobile-filterbar__chip')
    await chips[2]!.trigger('click') // 已补款
    await flushPromises()

    expect(listPreorders).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 12,
      status: 'paid',
      search: undefined,
    })
  })

  it('下拉刷新重新拉取列表与统计', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')], 1, null, 1))
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(listPreorders).toHaveBeenCalledTimes(1)

    const scroll = wrapper.find('.preorder-mobile-scroll')
    await scroll.trigger('touchstart', {
      touches: [{ clientX: 100, clientY: 120 }],
      changedTouches: [{ clientX: 100, clientY: 120 }],
    })
    await scroll.trigger('touchmove', {
      touches: [{ clientX: 100, clientY: 320 }],
      changedTouches: [{ clientX: 100, clientY: 320 }],
    })
    // 与 useMobilePullRefresh 现有测试一致：先冲刷 rAF，再结束手势
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
    await scroll.trigger('touchend', {
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 320 }],
    })
    await flushPromises()

    expect(listPreorders).toHaveBeenCalledTimes(2)
    expect(getPreorderStats).toHaveBeenCalledTimes(2)
  })

  it('移动端卡片不渲染左滑操作按钮', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    const { wrapper } = await mountPage()
    await flushPromises()

    expect(wrapper.find('.preorder-mobile-card__swipe-actions').exists()).toBe(false)
    expect(wrapper.find('.preorder-mobile-card__swipe-btn').exists()).toBe(false)
  })

  it('断点往返后无限滚动哨兵仍可加载更多', async () => {
    vi.mocked(listPreorders).mockImplementation(async ({ page } = {}) =>
      page === 1
        ? paginated([makePreorder('p-1')], 1, 2, 2)
        : paginated([makePreorder('p-2', { name: '第二页手办' })], 2, null, 2)
    )
    const { wrapper } = await mountPage()
    await flushPromises()

    // 桌面 → 移动 往返（桌面列表为空时不渲染哨兵，避免旧观察器）
    mobileState.value = false
    await flushPromises()
    mobileState.value = true
    await flushPromises()

    const observer = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]!
    observer.triggerIntersect()
    await flushPromises()

    expect(listPreorders).toHaveBeenLastCalledWith({ page: 2, page_size: 12, status: undefined, search: undefined })
    expect(wrapper.text()).toContain('第二页手办')
  })
})
