<template>
  <section
    class="journal-library"
    data-test="journal-library"
    @touchstart.capture.passive="handlePullStart"
    @touchmove="handlePullMove"
    @touchend="handlePullEnd"
    @touchcancel="resetPullRefresh"
  >
    <span ref="headerSentinelRef" class="journal-library__scroll-sentinel" aria-hidden="true" />
    <header
      class="journal-library__header"
      :class="{ 'is-compact': headerCompact }"
      :data-compact="headerCompact ? 'true' : 'false'"
    >
      <div>
        <p>MY JOURNALS</p>
        <h1>我的手帐</h1>
        <span>把喜欢的谷子和日常拼贴成册</span>
      </div>
      <strong>{{ journalStore.books.length }} 本</strong>
    </header>

    <MobilePullIndicator :distance="pullDistance" :refreshing="isRefreshing" />

    <div v-if="journalStore.error" class="journal-library__error">
      <el-alert :title="journalStore.error" type="error" :closable="false" />
      <el-button link type="primary" @click="loadBooks">重新加载</el-button>
    </div>

    <div v-if="journalStore.loading && journalStore.books.length === 0" class="journal-library__skeletons">
      <div v-for="index in 4" :key="index" class="journal-library__skeleton">
        <span />
        <i />
        <i />
      </div>
    </div>

    <el-empty
      v-else-if="journalStore.books.length === 0"
      description="还没有手帐，点右下角开始第一本吧"
      :image-size="104"
    />

    <div v-else class="journal-library__grid">
      <button
        v-for="book in journalStore.books"
        :key="book.id"
        class="journal-book-card"
        type="button"
        :data-test="`journal-book-${book.id}`"
        @click="$emit('openBook', book.id)"
      >
        <span class="journal-book-card__cover">
          <el-image
            v-if="book.cover_image"
            :src="book.cover_image"
            :alt="`${book.title}封面`"
            fit="cover"
            lazy
          >
            <template #error>
              <span class="journal-book-card__placeholder">
                <i>{{ bookInitial(book.title) }}</i>
              </span>
            </template>
          </el-image>
          <span v-else class="journal-book-card__placeholder">
            <i>{{ bookInitial(book.title) }}</i>
          </span>
          <small>{{ book.page_count || 0 }} 页</small>
        </span>

        <span class="journal-book-card__body">
          <strong>{{ book.title }}</strong>
          <span>{{ formatUpdatedAt(book.updated_at) }}</span>
        </span>
      </button>
    </div>

    <button
      class="journal-library__fab"
      type="button"
      aria-label="新建手帐"
      data-test="journal-library-create"
      @click="$emit('createBook')"
    >
      <el-icon><Plus /></el-icon>
    </button>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import MobilePullIndicator from '@/components/ui/MobilePullIndicator.vue'
import { useMobilePullRefresh } from '@/composables/useMobilePullRefresh'
import { useJournalStore } from '@/stores/journal'

defineEmits<{
  openBook: [bookId: string]
  createBook: []
}>()

const journalStore = useJournalStore()
const headerSentinelRef = ref<HTMLElement | null>(null)
const headerCompact = ref(false)
let headerFrame = 0

const syncCompactHeader = () => {
  headerFrame = 0
  const sentinel = headerSentinelRef.value
  if (!sentinel) return
  const pageHeaderBottom = document.querySelector<HTMLElement>('.mobile-page-header')
    ?.getBoundingClientRect().bottom ?? 44
  const boundary = pageHeaderBottom + 6
  const sentinelRect = sentinel.getBoundingClientRect()
  if (
    sentinelRect.top === 0
    && sentinelRect.bottom === 0
    && sentinelRect.width === 0
    && sentinelRect.height === 0
  ) return
  const sentinelTop = sentinelRect.top
  const scrollTop = Math.max(
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0,
  )
  if (!headerCompact.value && sentinelTop <= boundary + 2) headerCompact.value = true
  else if (headerCompact.value && scrollTop <= 2) headerCompact.value = false
}

const scheduleCompactHeaderSync = () => {
  if (headerFrame) return
  headerFrame = window.requestAnimationFrame(syncCompactHeader)
}

const refreshBooks = async () => {
  const refreshed = await journalStore.refreshBookSummaries()
  if (refreshed) ElMessage.success('刷新成功')
}

const loadBooks = async () => {
  if (journalStore.books.length > 0) {
    await journalStore.refreshBookSummaries()
    return
  }
  await journalStore.fetchBookSummaries()
}

const {
  pullDistance,
  isRefreshing,
  handleTouchStart: handlePullStart,
  handleTouchMove: handlePullMove,
  handleTouchEnd: handlePullEnd,
  reset: resetPullRefresh,
} = useMobilePullRefresh({
  enabled: true,
  blocked: () => journalStore.loading,
  onRefresh: refreshBooks,
})

const handleExternalRefresh = async () => {
  try {
    await refreshBooks()
  } finally {
    window.dispatchEvent(new CustomEvent('cloud-showcase:journal-refresh-complete'))
  }
}

const bookInitial = (title: string) => title.trim().slice(0, 1) || '手'

const formatUpdatedAt = (value?: string) => {
  if (!value) return '还没有编辑记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '最近编辑'
  return `${date.toLocaleDateString()} 更新`
}

onMounted(() => {
  syncCompactHeader()
  void loadBooks()
  window.addEventListener('cloud-showcase:journal-refresh', handleExternalRefresh)
  window.addEventListener('scroll', scheduleCompactHeaderSync, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('cloud-showcase:journal-refresh', handleExternalRefresh)
  window.removeEventListener('scroll', scheduleCompactHeaderSync)
  if (headerFrame) window.cancelAnimationFrame(headerFrame)
})
</script>

<style scoped>
.journal-library {
  position: relative;
  min-height: 0;
  padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px));
}

.journal-library__scroll-sentinel {
  display: block;
  width: 1px;
  height: 1px;
  margin-bottom: -1px;
  pointer-events: none;
}

.journal-library__header {
  position: sticky;
  top: calc(var(--app-navbar-height, calc(44px + env(safe-area-inset-top, 0px))) + 6px);
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  min-height: 108px;
  margin-bottom: 14px;
  padding: 18px 16px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 18px;
  background:
    radial-gradient(circle at 92% 12%, rgba(162, 155, 254, 0.14), transparent 34%),
    rgba(255, 255, 255, 0.92);
  box-shadow: var(--shadow-sm);
  transform-origin: top center;
  overflow-anchor: none;
  transition:
    min-height 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    padding 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    margin 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 0.22s ease,
    background-color 0.22s ease,
    box-shadow 0.22s ease;
}

.journal-library__header.is-compact {
  min-height: 52px;
  align-items: center;
  margin-bottom: 8px;
  padding: 7px 14px;
  border-radius: 14px;
  background:
    radial-gradient(circle at 92% 12%, rgba(162, 155, 254, 0.1), transparent 34%),
    rgba(255, 255, 255, 0.97);
  box-shadow: 0 8px 22px rgba(72, 54, 14, 0.1);
}

.journal-library__header p {
  margin: 0 0 5px;
  color: var(--primary-gold-dark);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  max-height: 18px;
  overflow: hidden;
  opacity: 1;
  transition:
    max-height 0.2s ease,
    margin 0.2s ease,
    opacity 0.16s ease;
}

.journal-library__header h1 {
  margin: 0;
  color: var(--text-dark);
  font-size: 24px;
  line-height: 1.2;
  transition: font-size 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.journal-library__header span {
  display: block;
  margin-top: 6px;
  color: var(--text-light);
  font-size: 12px;
  max-height: 20px;
  overflow: hidden;
  opacity: 1;
  transition:
    max-height 0.2s ease,
    margin 0.2s ease,
    opacity 0.16s ease;
}

.journal-library__header strong {
  flex: none;
  padding: 5px 10px;
  border-radius: 999px;
  color: var(--primary-gold-dark);
  background: rgba(212, 175, 55, 0.12);
  font-size: 12px;
  transition:
    padding 0.22s ease,
    font-size 0.22s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.journal-library__header.is-compact p {
  max-height: 0;
  margin: 0;
  opacity: 0;
}

.journal-library__header.is-compact h1 {
  font-size: 18px;
}

.journal-library__header.is-compact span {
  max-height: 0;
  margin-top: 0;
  opacity: 0;
}

.journal-library__header.is-compact strong {
  padding: 4px 8px;
  font-size: 11px;
  transform: scale(0.96);
}

.journal-library__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.journal-library__error :deep(.el-alert) {
  flex: 1;
  min-width: 0;
}

.journal-library__grid,
.journal-library__skeletons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.journal-book-card,
.journal-library__skeleton {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 16px;
  background: var(--bg-white);
  box-shadow: 0 6px 18px rgba(72, 54, 14, 0.06);
}

.journal-book-card {
  padding: 0;
  color: inherit;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.journal-book-card:active {
  transform: scale(0.98);
  border-color: rgba(212, 175, 55, 0.54);
  box-shadow: var(--shadow-md);
}

.journal-book-card__cover {
  position: relative;
  display: block;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: linear-gradient(145deg, #fffdf7, #f2edf8);
}

.journal-book-card__cover :deep(.el-image),
.journal-book-card__cover :deep(.el-image__inner) {
  display: block;
  width: 100%;
  height: 100%;
}

.journal-book-card__placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background:
    linear-gradient(rgba(212, 175, 55, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(162, 155, 254, 0.07) 1px, transparent 1px),
    linear-gradient(145deg, #fffdf7, #f3effa);
  background-size: 16px 16px, 16px 16px, auto;
}

.journal-book-card__placeholder i {
  width: 58px;
  height: 58px;
  border: 1px solid rgba(212, 175, 55, 0.38);
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--primary-gold-dark);
  background: rgba(255, 255, 255, 0.74);
  font-size: 24px;
  font-style: normal;
  font-weight: 800;
}

.journal-book-card__cover small {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 4px 8px;
  border-radius: 999px;
  color: #fff;
  background: rgba(51, 51, 51, 0.62);
  font-size: 11px;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.journal-book-card__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  padding: 11px 12px 13px;
}

.journal-book-card__body strong,
.journal-book-card__body span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.journal-book-card__body strong {
  color: var(--text-dark);
  font-size: 14px;
}

.journal-book-card__body span {
  color: var(--text-light);
  font-size: 11px;
}

.journal-library__skeleton {
  min-height: 238px;
}

.journal-library__skeleton span,
.journal-library__skeleton i {
  display: block;
  background: linear-gradient(90deg, #f1f1f3 25%, #fafafa 50%, #f1f1f3 75%);
  background-size: 200% 100%;
  animation: journal-library-shimmer 1.3s infinite linear;
}

.journal-library__skeleton span {
  aspect-ratio: 3 / 4;
}

.journal-library__skeleton i {
  height: 14px;
  margin: 10px 12px 0;
  border-radius: 999px;
}

.journal-library__skeleton i:last-child {
  width: 58%;
  margin-top: 7px;
}

.journal-library__fab {
  position: fixed;
  right: 18px;
  bottom: calc(78px + env(safe-area-inset-bottom, 0px));
  z-index: 30;
  width: 56px;
  height: 56px;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, var(--accent-purple), var(--accent-purple-hover));
  box-shadow: var(--shadow-purple-soft);
  font-size: 25px;
  -webkit-tap-highlight-color: transparent;
}

.journal-library__fab:active {
  transform: scale(0.94);
}

@keyframes journal-library-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (max-width: 350px) {
  .journal-library__grid,
  .journal-library__skeletons {
    gap: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .journal-library__header,
  .journal-library__header p,
  .journal-library__header h1,
  .journal-library__header span,
  .journal-library__header strong,
  .journal-book-card,
  .journal-library__skeleton span,
  .journal-library__skeleton i {
    transition: none;
    animation: none;
  }
}
</style>
