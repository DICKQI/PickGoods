import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { NOTIFICATION_POLL_INTERVAL, useNotificationStore } from '@/stores/notification'

vi.mock('@/api/reminder', () => ({
  getUnreadCount: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  NOTIFICATION_TYPE_LABELS: {},
}))

import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationsRead,
} from '@/api/reminder'
import type { NotificationItem } from '@/api/types'

const makeNotification = (id: number, overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id,
  type: 'preorder_due',
  title: '《测试》已到补款期',
  message: '请及时完成补款',
  preorder_id: 'preorder-1',
  preorder_name: '测试手办',
  is_read: false,
  is_stale: false,
  created_at: '2026-06-01T00:00:00Z',
  ...overrides,
})

describe('useNotificationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetchUnreadCount 更新未读数', async () => {
    vi.mocked(getUnreadCount).mockResolvedValue({ unread_count: 3 })
    const store = useNotificationStore()
    await store.fetchUnreadCount()
    expect(store.unreadCount).toBe(3)
  })

  it('fetchNotifications 加载列表并顺带刷新未读数', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [makeNotification(1)],
    })
    vi.mocked(getUnreadCount).mockResolvedValue({ unread_count: 1 })
    const store = useNotificationStore()
    await store.fetchNotifications()
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]?.title).toBe('《测试》已到补款期')
    expect(store.unreadCount).toBe(1)
  })

  it('fetchNotifications(reset) 清空列表并请求第一页，fetchMore 追加且更新 hasNext', async () => {
    vi.mocked(getNotifications).mockResolvedValueOnce({
      count: 3,
      page: 1,
      page_size: 20,
      next: 2,
      previous: null,
      results: [makeNotification(1)],
    })
    vi.mocked(getNotifications).mockResolvedValueOnce({
      count: 3,
      page: 2,
      page_size: 20,
      next: null,
      previous: 1,
      results: [makeNotification(2), makeNotification(3)],
    })
    vi.mocked(getUnreadCount).mockResolvedValue({ unread_count: 3 })
    const store = useNotificationStore()
    await store.fetchNotifications()
    expect(store.page).toBe(1)
    expect(store.total).toBe(3)
    expect(store.hasNext).toBe(true)

    await store.fetchMoreNotifications()
    expect(getNotifications).toHaveBeenLastCalledWith({ page: 2, page_size: 20 })
    expect(store.notifications.map((n) => n.id)).toEqual([1, 2, 3])
    expect(store.hasNext).toBe(false)
  })

  it('没有下一页时 fetchMoreNotifications 不再发请求', async () => {
    vi.mocked(getNotifications).mockResolvedValueOnce({
      count: 1,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [makeNotification(1)],
    })
    vi.mocked(getUnreadCount).mockResolvedValue({ unread_count: 1 })
    const store = useNotificationStore()
    await store.fetchNotifications()
    await store.fetchMoreNotifications()
    expect(getNotifications).toHaveBeenCalledTimes(1)
  })

  it('加载更多失败时回退页码，可重试同一页', async () => {
    vi.mocked(getNotifications)
      .mockResolvedValueOnce({
        count: 3,
        page: 1,
        page_size: 20,
        next: 2,
        previous: null,
        results: [makeNotification(1)],
      })
      .mockRejectedValueOnce(new Error('network'))
    vi.mocked(getUnreadCount).mockResolvedValue({ unread_count: 1 })
    const store = useNotificationStore()
    await store.fetchNotifications()
    expect(store.page).toBe(1)

    await store.fetchMoreNotifications()
    expect(store.page).toBe(1)
    expect(store.hasNext).toBe(true)

    vi.mocked(getNotifications).mockResolvedValueOnce({
      count: 3,
      page: 2,
      page_size: 20,
      next: null,
      previous: 1,
      results: [makeNotification(2)],
    })
    await store.fetchMoreNotifications()
    expect(getNotifications).toHaveBeenLastCalledWith({ page: 2, page_size: 20 })
    expect(store.page).toBe(2)
    expect(store.notifications.map((n) => n.id)).toEqual([1, 2])
  })

  it('markRead 更新本地已读状态与未读数', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      count: 2,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [makeNotification(1), makeNotification(2)],
    })
    vi.mocked(getUnreadCount).mockResolvedValue({ unread_count: 2 })
    vi.mocked(markNotificationsRead).mockResolvedValue({ updated: 1 })
    const store = useNotificationStore()
    await store.fetchNotifications()
    await store.markRead([1])
    expect(markNotificationsRead).toHaveBeenCalledWith([1])
    expect(store.notifications[0]?.is_read).toBe(true)
    expect(store.notifications[1]?.is_read).toBe(false)
    expect(store.unreadCount).toBe(1)
  })

  it('markAllRead 全部已读并清零未读数', async () => {
    vi.mocked(markAllNotificationsRead).mockResolvedValue({ updated: 2 })
    const store = useNotificationStore()
    store.unreadCount = 2
    await store.markAllRead()
    expect(markAllNotificationsRead).toHaveBeenCalled()
    expect(store.unreadCount).toBe(0)
  })

  it('startPolling 立即同步并按 60s 轮询，stopPolling 停止', async () => {
    vi.mocked(getUnreadCount).mockResolvedValue({ unread_count: 5 })
    const store = useNotificationStore()
    store.startPolling()
    expect(getUnreadCount).toHaveBeenCalledTimes(1)
    // 冲刷 microtask 让首次同步结果落地
    await Promise.resolve()
    expect(store.unreadCount).toBe(5)
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_INTERVAL)
    expect(getUnreadCount).toHaveBeenCalledTimes(2)
    store.stopPolling()
    await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_INTERVAL * 2)
    expect(getUnreadCount).toHaveBeenCalledTimes(2)
  })
})
