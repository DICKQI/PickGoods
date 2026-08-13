import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as reminderApi from '@/api/reminder'
import type { NotificationItem } from '@/api/types'

/** 未读数轮询间隔（毫秒） */
export const NOTIFICATION_POLL_INTERVAL = 60 * 1000

export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0)
  const notifications = ref<NotificationItem[]>([])
  const loading = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  /** 拉取未读数（后端在 unread-count 接口内执行惰性同步） */
  async function fetchUnreadCount() {
    try {
      const data = await reminderApi.getUnreadCount()
      unreadCount.value = data.unread_count
    } catch {
      // 网络/鉴权异常不阻断页面
    }
  }

  /** 拉取最新通知列表（纯读） */
  async function fetchNotifications() {
    loading.value = true
    try {
      const data = await reminderApi.getNotifications({ page_size: 20 })
      notifications.value = data.results
      // 顺带刷新未读数，保持徽标一致
      await fetchUnreadCount()
    } catch {
      // 静默失败
    } finally {
      loading.value = false
    }
  }

  /** 批量标记已读并同步本地状态 */
  async function markRead(ids: number[]) {
    if (!ids.length) return
    try {
      await reminderApi.markNotificationsRead(ids)
      const idSet = new Set(ids)
      notifications.value = notifications.value.map((n) =>
        idSet.has(n.id) ? { ...n, is_read: true } : n
      )
      unreadCount.value = Math.max(0, unreadCount.value - ids.length)
    } catch {
      // 静默失败
    }
  }

  /** 全部已读 */
  async function markAllRead() {
    try {
      await reminderApi.markAllNotificationsRead()
      notifications.value = notifications.value.map((n) => ({ ...n, is_read: true }))
      unreadCount.value = 0
    } catch {
      // 静默失败
    }
  }

  function startPolling() {
    stopPolling()
    // 立即同步一次，再进入周期轮询
    fetchUnreadCount()
    pollTimer = setInterval(() => {
      fetchUnreadCount()
    }, NOTIFICATION_POLL_INTERVAL)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    unreadCount,
    notifications,
    loading,
    fetchUnreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    startPolling,
    stopPolling,
  }
})
