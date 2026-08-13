import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationCenter from '@/components/NotificationCenter.vue'
import { useNotificationStore } from '@/stores/notification'

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: {
      ...actual.ElMessage,
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  }
})

vi.mock('@/api/reminder', () => ({
  getUnreadCount: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  NOTIFICATION_TYPE_LABELS: {
    preorder_soon: '即将补款',
    preorder_due: '已到补款期',
    preorder_cancelled: '已取消补款',
    preorder_converted: '已转正',
  },
}))

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from '@/api/reminder'
import type { NotificationItem } from '@/api/types'

const makeNotification = (id: number, overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id,
  type: 'preorder_due',
  title: '《测试手办》已到补款期',
  message: '请及时完成补款，避免订单被取消。',
  preorder_id: 'preorder-1',
  preorder_name: '测试手办',
  is_read: false,
  is_stale: false,
  created_at: new Date().toISOString(),
  ...overrides,
})

const ElPopoverStub = defineComponent({
  template: '<div class="popover-stub"><slot name="reference" /><slot /></div>',
})

const ElButtonStub = defineComponent({
  props: ['text', 'size', 'type'],
  emits: ['click'],
  template: '<button class="el-button-stub" @click="$emit(\'click\', $event)"><slot /></button>',
})

const ElBadgeStub = defineComponent({
  props: ['value', 'hidden', 'max'],
  template: '<span class="badge-stub" :data-value="value" :data-hidden="hidden"><slot /></span>',
})

const mountCenter = async () => {
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
        'el-popover': ElPopoverStub,
        'el-button': ElButtonStub,
        'el-badge': ElBadgeStub,
        'el-icon': { template: '<i><slot /></i>' },
      },
    },
  })
  return { wrapper, router }
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('渲染未读徽标与通知列表', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      count: 2,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [makeNotification(1), makeNotification(2, { type: 'preorder_soon' })],
    })
    const store = useNotificationStore()
    store.unreadCount = 2
    const { wrapper } = await mountCenter()
    await store.fetchNotifications()
    await flushPromises()
    const badge = wrapper.get('.badge-stub')
    expect(badge.attributes('data-value')).toBe('2')
    expect(wrapper.text()).toContain('《测试手办》已到补款期')
    expect(wrapper.text()).toContain('已到补款期')
    expect(wrapper.text()).toContain('即将补款')
  })

  it('点击通知标记已读并跳转预购页带 highlight', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [makeNotification(1)],
    })
    vi.mocked(markNotificationsRead).mockResolvedValue({ updated: 1 })
    const { wrapper, router } = await mountCenter()
    const store = useNotificationStore()
    await store.fetchNotifications()
    await flushPromises()
    await wrapper.get('.notification-item').trigger('click')
    await flushPromises()
    expect(markNotificationsRead).toHaveBeenCalledWith([1])
    expect(router.currentRoute.value.path).toBe('/preorders')
    expect(router.currentRoute.value.query.highlight).toBe('preorder-1')
  })

  it('已过期通知显示标签且点击不标记已读', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [makeNotification(1, { is_stale: true, is_read: true })],
    })
    const { wrapper } = await mountCenter()
    const store = useNotificationStore()
    await store.fetchNotifications()
    await flushPromises()
    expect(wrapper.text()).toContain('已过期')
    await wrapper.get('.notification-item').trigger('click')
    expect(markNotificationsRead).not.toHaveBeenCalled()
  })

  it('全部已读按钮调用接口并清空未读', async () => {
    vi.mocked(markAllNotificationsRead).mockResolvedValue({ updated: 1 })
    const { wrapper } = await mountCenter()
    const store = useNotificationStore()
    store.unreadCount = 1
    await flushPromises()
    await wrapper.get('.notification-read-all').trigger('click')
    await flushPromises()
    expect(markAllNotificationsRead).toHaveBeenCalled()
    expect(store.unreadCount).toBe(0)
  })

  it('无通知时显示空态', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      count: 0,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [],
    })
    const { wrapper } = await mountCenter()
    const store = useNotificationStore()
    await store.fetchNotifications()
    await flushPromises()
    expect(wrapper.text()).toContain('暂无通知')
  })

  it('查看全部跳转预购页并带待补款筛选', async () => {
    const { wrapper, router } = await mountCenter()
    await wrapper.get('.notification-footer .el-button-stub').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/preorders')
    expect(router.currentRoute.value.query.status).toBe('pending')
  })
})
