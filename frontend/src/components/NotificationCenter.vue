<template>
  <el-popover
    placement="bottom-end"
    :width="360"
    trigger="click"
    popper-class="notification-center-popper"
    @show="handleShow"
  >
    <template #reference>
      <el-button text class="notification-btn" aria-label="通知中心" :title="unreadText">
        <el-badge :value="store.unreadCount" :hidden="store.unreadCount === 0" :max="99" class="notification-badge">
          <el-icon class="notification-icon"><Bell /></el-icon>
        </el-badge>
      </el-button>
    </template>

    <div class="notification-panel">
      <div class="notification-header">
        <span class="notification-title">通知中心</span>
        <span v-if="store.unreadCount > 0" class="notification-unread-text">未读 {{ store.unreadCount }} 条</span>
        <el-button
          v-if="store.unreadCount > 0"
          text
          size="small"
          type="primary"
          class="notification-read-all"
          @click="handleReadAll"
        >
          全部已读
        </el-button>
      </div>

      <div v-if="store.loading && !store.notifications.length" class="notification-empty">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载中…</span>
      </div>

      <div v-else-if="!store.notifications.length" class="notification-empty">
        <el-icon><BellFilled /></el-icon>
        <span>暂无通知</span>
      </div>

      <div v-else class="notification-list">
        <div
          v-for="item in store.notifications"
          :key="item.id"
          class="notification-item"
          :class="{ 'is-unread': !item.is_read, 'is-stale': item.is_stale }"
          role="button"
          tabindex="0"
          @click="handleItemClick(item)"
          @keydown.enter="handleItemClick(item)"
        >
          <span v-if="!item.is_read && !item.is_stale" class="notification-dot" aria-hidden="true"></span>
          <span v-if="item.is_stale" class="notification-stale-tag">已过期</span>
          <div class="notification-item-body">
            <div class="notification-item-title">{{ item.title }}</div>
            <div class="notification-item-message">{{ item.message }}</div>
            <div class="notification-item-meta">
              <span class="notification-item-type">{{ typeLabel(item.type) }}</span>
              <span class="notification-item-time">{{ relativeTime(item.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="notification-footer">
        <el-button text size="small" @click="goToAll">查看全部预购</el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, BellFilled, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useNotificationStore } from '@/stores/notification'
import { NOTIFICATION_TYPE_LABELS } from '@/api/reminder'
import type { NotificationItem } from '@/api/types'

const router = useRouter()
const store = useNotificationStore()

const unreadText = computed(() =>
  store.unreadCount > 0 ? `有 ${store.unreadCount} 条未读通知` : '通知中心'
)

const typeLabel = (type: string) => NOTIFICATION_TYPE_LABELS[type] || type

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

const handleShow = () => {
  store.fetchNotifications()
}

const handleItemClick = (item: NotificationItem) => {
  if (!item.is_read && !item.is_stale) {
    store.markRead([item.id])
  }
  if (item.preorder_id) {
    router.push({ path: '/preorders', query: { highlight: item.preorder_id } })
  }
}

const handleReadAll = () => {
  store.markAllRead()
  ElMessage.success('已全部标为已读')
}

const goToAll = () => {
  router.push({ path: '/preorders', query: { status: 'pending' } })
}
</script>

<style scoped>
.notification-btn {
  color: var(--text-dark);
  padding: 6px;
  font-size: 20px;
  transition: color 0.2s ease;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.notification-btn:hover {
  color: var(--primary-gold);
}

.notification-icon {
  font-size: 20px;
}

.notification-badge {
  display: inline-flex;
}

.notification-panel {
  display: flex;
  flex-direction: column;
  max-height: 420px;
}

.notification-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 10px;
  border-bottom: 1px solid #f0f0f0;
}

.notification-title {
  font-size: 15px;
  font-weight: 600;
}

.notification-unread-text {
  font-size: 12px;
  color: var(--text-muted, #909399);
}

.notification-read-all {
  margin-left: auto;
}

.notification-list {
  overflow-y: auto;
  flex: 1;
  margin: 4px -8px 0;
  padding: 0 8px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.notification-item:hover {
  background-color: #f5f5f7;
}

.notification-item.is-unread .notification-item-title {
  font-weight: 600;
}

.notification-item.is-stale {
  opacity: 0.55;
}

.notification-item.is-stale .notification-item-title {
  text-decoration: line-through;
}

.notification-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background-color: #f56c6c;
}

.notification-stale-tag {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 1.4;
  padding: 1px 6px;
  margin-top: 2px;
  border-radius: 4px;
  color: #909399;
  background-color: #f0f0f0;
}

.notification-item-body {
  flex: 1;
  min-width: 0;
}

.notification-item-title {
  font-size: 14px;
  color: var(--text-dark);
  word-break: break-all;
}

.notification-item-message {
  font-size: 12px;
  color: var(--text-muted, #909399);
  margin-top: 2px;
  word-break: break-all;
}

.notification-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.notification-item-type {
  font-size: 11px;
  color: var(--primary-gold);
}

.notification-item-time {
  font-size: 11px;
  color: #c0c4cc;
}

.notification-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 0;
  color: #c0c4cc;
  font-size: 13px;
}

.notification-footer {
  border-top: 1px solid #f0f0f0;
  padding-top: 8px;
  display: flex;
  justify-content: center;
}
</style>
