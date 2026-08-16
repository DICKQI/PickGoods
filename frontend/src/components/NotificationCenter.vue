<template>
  <!-- 桌面端：popover 面板（保持不变） -->
  <el-popover
    v-if="!isMobile"
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

  <!-- 移动端：铃铛 + 底部抽屉 -->
  <template v-else>
    <el-button text class="notification-btn" aria-label="通知中心" :title="unreadText" @click="openSheet">
      <el-badge :value="store.unreadCount" :hidden="store.unreadCount === 0" :max="99" class="notification-badge">
        <el-icon class="notification-icon"><Bell /></el-icon>
      </el-badge>
    </el-button>

    <BaseBottomSheet v-model="sheetVisible" title="通知中心">
      <template #header-extra>
        <el-button
          v-if="store.unreadCount > 0"
          text
          size="small"
          type="primary"
          class="notification-read-all notification-read-all--mobile"
          @click="handleReadAll"
        >
          全部已读
        </el-button>
      </template>

      <!-- 预购管理主入口：预购=提醒工作流，任何通知状态都可达 -->
      <button type="button" class="notification-preorder-entry" @click="goToPreorderManagement">
        <span class="notification-preorder-entry__icon">
          <el-icon><ShoppingCart /></el-icon>
        </span>
        <span class="notification-preorder-entry__copy">
          <strong>管理预购</strong>
          <small>登记定金 · 补款提醒 · 一键转正</small>
        </span>
        <el-icon class="notification-preorder-entry__arrow"><ArrowRight /></el-icon>
      </button>

      <div v-if="store.loading && !store.notifications.length" class="notification-empty">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载中…</span>
      </div>

      <div v-else-if="!store.notifications.length" class="notification-empty">
        <el-icon><BellFilled /></el-icon>
        <span>暂无通知</span>
      </div>

      <div v-else class="notification-list notification-list--mobile">
        <div
          v-for="item in store.notifications"
          :key="item.id"
          class="notification-item notification-item--mobile"
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
        <div ref="sentinelRef" class="notification-load-more">
          <span v-if="store.hasNext">{{ store.loading ? '加载中…' : '上拉加载更多' }}</span>
          <span v-else-if="store.notifications.length">没有更多了</span>
        </div>
      </div>
    </BaseBottomSheet>
  </template>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, BellFilled, Loading, ArrowRight, ShoppingCart } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useNotificationStore } from '@/stores/notification'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import BaseBottomSheet from '@/components/ui/BaseBottomSheet.vue'
import { NOTIFICATION_TYPE_LABELS } from '@/api/reminder'
import type { NotificationItem } from '@/api/types'

const router = useRouter()
const store = useNotificationStore()
const { isMobile } = useResponsiveDevice()

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
    sheetVisible.value = false
    router.push({ path: '/preorders', query: { highlight: item.preorder_id } })
  }
}

const handleReadAll = () => {
  store.markAllRead()
  ElMessage.success('已全部标为已读')
}

const goToAll = () => {
  sheetVisible.value = false
  router.push({ path: '/preorders', query: { status: 'pending' } })
}

const goToPreorderManagement = () => {
  sheetVisible.value = false
  router.push('/preorders')
}

// ─── 移动端：底部抽屉 + 无限滚动 ───
const sheetVisible = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)
let sentinelObserver: IntersectionObserver | null = null

const openSheet = () => {
  sheetVisible.value = true
  store.fetchNotifications()
}

const setupSentinel = () => {
  sentinelObserver?.disconnect()
  if (typeof IntersectionObserver === 'undefined' || !sentinelRef.value) return
  sentinelObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        store.fetchMoreNotifications()
      }
    },
    { rootMargin: '200px 0px' }
  )
  sentinelObserver.observe(sentinelRef.value)
}

watch([sheetVisible, () => store.notifications.length, () => store.hasNext], () => {
  if (sheetVisible.value) nextTick(setupSentinel)
})

onUnmounted(() => {
  sentinelObserver?.disconnect()
})
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

/* ─── 移动端抽屉 ─── */
.notification-read-all--mobile {
  min-height: 44px;
  padding: 0 8px;
  white-space: nowrap;
}

.notification-list--mobile {
  margin: 0;
  padding: 0;
  overflow: visible;
}

.notification-item--mobile {
  min-height: 64px;
  padding: 12px 4px;
  border-bottom: 1px solid #f5f5f7;
}

.notification-item--mobile:last-child {
  border-bottom: none;
}

.notification-item--mobile:active {
  background-color: #f5f5f7;
}

.notification-load-more {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 12px;
}

/* 移动端：预购管理主入口卡片（始终位于通知列表之前） */
.notification-preorder-entry {
  width: 100%;
  min-height: 60px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 14px;
  background:
    radial-gradient(circle at 92% 0%, rgba(212, 175, 55, 0.18), transparent 46%),
    linear-gradient(135deg, #fffdf6, #f8f5ff);
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.notification-preorder-entry:active {
  transform: scale(0.98);
  box-shadow: 0 8px 18px -10px rgba(212, 175, 55, 0.4);
}

.notification-preorder-entry__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(162, 155, 254, 0.18));
  border: 1px solid rgba(212, 175, 55, 0.3);
  color: #9a740b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.notification-preorder-entry__copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notification-preorder-entry__copy strong {
  font-size: 15px;
  font-weight: 800;
  color: #2f2a20;
  line-height: 1.3;
}

.notification-preorder-entry__copy small {
  font-size: 12px;
  color: #8a6c14;
  line-height: 1.4;
}

.notification-preorder-entry__arrow {
  flex-shrink: 0;
  color: #c0b388;
  font-size: 16px;
}
</style>
