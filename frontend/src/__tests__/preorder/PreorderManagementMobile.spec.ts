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
  convertPreorderToGoods: vi.fn(),
  recognizePreorderImage: vi.fn(),
}))

import { getPreorderStats, listPreorders, markPreorderPaid } from '@/api/reminder'
import type { Preorder } from '@/api/types'

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

  it('新增 FAB 打开底部抽屉表单', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    const { wrapper } = await mountPage()
    await flushPromises()
    await wrapper.find('.preorder-mobile-fab').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('登记外部平台下单的手办定金')
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

    const page = wrapper.find('.preorder-mobile-page')
    await page.trigger('touchstart', {
      touches: [{ clientX: 100, clientY: 120 }],
      changedTouches: [{ clientX: 100, clientY: 120 }],
    })
    await page.trigger('touchmove', {
      touches: [{ clientX: 100, clientY: 320 }],
      changedTouches: [{ clientX: 100, clientY: 320 }],
    })
    // 与 useMobilePullRefresh 现有测试一致：先冲刷 rAF，再结束手势
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
    await page.trigger('touchend', {
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 320 }],
    })
    await flushPromises()

    expect(listPreorders).toHaveBeenCalledTimes(2)
    expect(getPreorderStats).toHaveBeenCalledTimes(2)
  })

  it('左滑删除打开底部确认面板', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    const { wrapper } = await mountPage()
    await flushPromises()

    const card = wrapper.find('.preorder-mobile-card')
    await card.trigger('touchstart', {
      touches: [{ clientX: 200, clientY: 100 }],
      changedTouches: [{ clientX: 200, clientY: 100 }],
    })
    await card.trigger('touchmove', {
      touches: [{ clientX: 90, clientY: 102 }],
      changedTouches: [{ clientX: 90, clientY: 102 }],
    })
    await card.trigger('touchend', {
      touches: [],
      changedTouches: [{ clientX: 90, clientY: 102 }],
    })
    await wrapper.find('.preorder-mobile-card__swipe-btn.is-delete').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('确定删除「流萤手办」？相关通知将一并删除。')
  })

  it('列表滚动时收起已展开的左滑操作', async () => {
    vi.mocked(listPreorders).mockResolvedValue(
      paginated([makePreorder('p-1'), makePreorder('p-2', { name: '第二个手办' })])
    )
    const { wrapper } = await mountPage()
    await flushPromises()

    const firstCard = wrapper.findAll('.preorder-mobile-card')[0]!
    await firstCard.trigger('touchstart', {
      touches: [{ clientX: 200, clientY: 100 }],
      changedTouches: [{ clientX: 200, clientY: 100 }],
    })
    await firstCard.trigger('touchmove', {
      touches: [{ clientX: 90, clientY: 102 }],
      changedTouches: [{ clientX: 90, clientY: 102 }],
    })
    await firstCard.trigger('touchend', {
      touches: [],
      changedTouches: [{ clientX: 90, clientY: 102 }],
    })
    expect(firstCard.attributes('style')).toContain('translateX(-144px)')

    await wrapper.find('.preorder-mobile-list').trigger('scroll')
    await nextTick()
    expect(wrapper.findAll('.preorder-mobile-card')[0]!.attributes('style')).toContain('translateX(0px)')
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
