import { computed, defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationCenter from '@/components/NotificationCenter.vue'

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: { ...actual.ElMessage, success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
})

vi.mock('@/composables/useResponsiveDevice', () => ({
  useResponsiveDevice: () => ({ isMobile: computed(() => true) }),
}))

vi.mock('@/api/reminder', () => ({
  getUnreadCount: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  NOTIFICATION_TYPE_LABELS: { preorder_due: '已到补款期' },
}))

import { getNotifications, markNotificationsRead } from '@/api/reminder'
import type { NotificationItem } from '@/api/types'

const makeNotification = (id: number): NotificationItem => ({
  id,
  type: 'preorder_due',
  title: '《测试手办》已到补款期',
  message: '请及时完成补款',
  preorder_id: 'preorder-1',
  preorder_name: '测试手办',
  is_read: false,
  is_stale: false,
  created_at: new Date().toISOString(),
})

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observe = vi.fn()
  disconnect = vi.fn()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  triggerIntersect() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

const mountCenter = async () => {
  MockIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/preorders', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(NotificationCenter, {
    global: {
      plugins: [router],
      stubs: {
        'el-button': defineComponent({
          props: ['text', 'size', 'type'],
          emits: ['click'],
          template: '<button class="el-button-stub" @click="$emit(\'click\', $event)"><slot /></button>',
        }),
        'el-badge': defineComponent({
          props: ['value', 'hidden', 'max'],
          template: '<span class="badge-stub" :data-value="value" :data-hidden="hidden"><slot /></span>',
        }),
        'el-icon': { template: '<i><slot /></i>' },
        Transition: false,
        Teleport: true,
      },
    },
  })
  return { wrapper, router }
}

const paginated = (results: NotificationItem[], page: number, next: number | null, count: number) => ({
  count,
  page,
  page_size: 20,
  next,
  previous: page > 1 ? page - 1 : null,
  results,
})

describe('NotificationCenter 移动端', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('点击铃铛打开底部抽屉并加载通知', async () => {
    vi.mocked(getNotifications).mockResolvedValue(
      paginated([makeNotification(1)], 1, null, 1),
    )
    const { wrapper } = await mountCenter()
    await wrapper.find('.notification-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('通知中心')
    expect(wrapper.text()).toContain('《测试手办》已到补款期')
    expect(getNotifications).toHaveBeenCalledWith({ page: 1, page_size: 20 })
  })

  it('哨兵触发加载更多通知', async () => {
    vi.mocked(getNotifications)
      .mockResolvedValueOnce(paginated([makeNotification(1)], 1, 2, 2))
      .mockResolvedValueOnce(
        paginated([makeNotification(2)], 2, null, 2),
      )
    const { wrapper } = await mountCenter()
    await wrapper.find('.notification-btn').trigger('click')
    await flushPromises()

    const observer = MockIntersectionObserver.instances[0]!
    expect(observer).toBeTruthy()
    observer.triggerIntersect()
    await flushPromises()

    expect(getNotifications).toHaveBeenLastCalledWith({ page: 2, page_size: 20 })
    expect(wrapper.findAll('.notification-item--mobile')).toHaveLength(2)
  })

  it('点击通知标记已读、关闭抽屉并跳转带 highlight', async () => {
    vi.mocked(getNotifications).mockResolvedValue(
      paginated([makeNotification(1)], 1, null, 1),
    )
    vi.mocked(markNotificationsRead).mockResolvedValue({ updated: 1 })
    const { wrapper, router } = await mountCenter()
    await wrapper.find('.notification-btn').trigger('click')
    await flushPromises()

    await wrapper.find('.notification-item--mobile').trigger('click')
    await flushPromises()

    expect(markNotificationsRead).toHaveBeenCalledWith([1])
    expect(router.currentRoute.value.path).toBe('/preorders')
    expect(router.currentRoute.value.query.highlight).toBe('preorder-1')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('抽屉顶部提供管理预购入口，无通知时也可达预购页', async () => {
    vi.mocked(getNotifications).mockResolvedValue(paginated([], 1, null, 0))
    const { wrapper, router } = await mountCenter()
    await wrapper.find('.notification-btn').trigger('click')
    await flushPromises()

    const entry = wrapper.find('.notification-preorder-entry')
    expect(entry.exists()).toBe(true)
    expect(entry.text()).toContain('管理预购')
    expect(entry.text()).toContain('记下定金 · 提醒补款 · 一键转正~')

    await entry.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/preorders')
    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
