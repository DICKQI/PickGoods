<template>
  <section
    class="journal-library"
    :class="{ 'journal-library--desktop': isDesktop }"
    data-test="journal-library"
    @touchstart.capture.passive="handlePullStart"
    @touchmove="handlePullMove"
    @touchend="handlePullEnd"
    @touchcancel="resetPullRefresh"
  >
    <template v-if="isDesktop">
      <header class="journal-library__desktop-header">
        <div>
          <p>MY JOURNALS</p>
          <h1>我的手帐</h1>
          <span>把喜欢的谷子和日常拼贴成册</span>
        </div>
        <div class="journal-library__desktop-actions">
          <strong>{{ journalStore.books.length }} 本</strong>
          <el-button
            class="brand-add-btn brand-add-btn--compact"
            data-test="journal-library-create-desktop"
            :loading="journalStore.loading"
            @click="emit('createBook')"
          >
            <el-icon class="el-icon--left"><Plus /></el-icon>
            新建手帐
          </el-button>
        </div>
      </header>
    </template>

    <template v-else>
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
    </template>

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
      :description="isDesktop ? '还没有手帐，创建一本开始记录吧' : '还没有手帐，点右下角开始第一本吧'"
      :image-size="104"
    />

    <div v-else class="journal-library__grid">
      <article
        v-for="book in journalStore.books"
        :key="book.id"
        class="journal-book-card"
        :data-test="`journal-book-card-${book.id}`"
      >
        <button
          class="journal-book-card__main"
          type="button"
          :data-test="`journal-book-${book.id}`"
          @click="emit('openBook', book.id)"
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

        <el-dropdown
          v-if="isDesktop"
          class="journal-book-card__menu"
          trigger="click"
          placement="bottom-end"
          @command="handleBookCommand($event, book)"
        >
          <button
            class="journal-book-card__menu-trigger"
            type="button"
            :aria-label="`${book.title}更多操作`"
            :data-test="`journal-book-menu-${book.id}`"
            @click.stop
          >
            <el-icon><MoreFilled /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="open">打开手帐</el-dropdown-item>
              <el-dropdown-item command="rename">重命名</el-dropdown-item>
              <el-dropdown-item command="cover">更换封面</el-dropdown-item>
              <el-dropdown-item command="delete" divided>删除手帐</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </article>
    </div>

    <button
      v-if="!isDesktop"
      class="journal-library__fab"
      type="button"
      aria-label="新建手帐"
      data-test="journal-library-create"
      @click="emit('createBook')"
    >
      <el-icon><Plus /></el-icon>
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { MoreFilled, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import MobilePullIndicator from '@/components/ui/MobilePullIndicator.vue'
import { useMobilePullRefresh } from '@/composables/useMobilePullRefresh'
import { useJournalStore } from '@/stores/journal'
import type { JournalBook } from '@/api/types'

const props = withDefaults(defineProps<{
  variant?: 'mobile' | 'desktop'
}>(), {
  variant: 'mobile',
})

const emit = defineEmits<{
  openBook: [bookId: string]
  createBook: []
  renameBook: [book: JournalBook]
  changeCover: [book: JournalBook]
  deleteBook: [book: JournalBook]
}>()

const isDesktop = computed(() => props.variant === 'desktop')
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
  enabled: computed(() => !isDesktop.value),
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

const handleBookCommand = (command: string, book: JournalBook) => {
  if (command === 'open') emit('openBook', book.id)
  else if (command === 'rename') emit('renameBook', book)
  else if (command === 'cover') emit('changeCover', book)
  else if (command === 'delete') emit('deleteBook', book)
}

onMounted(() => {
  void loadBooks()
  window.addEventListener('cloud-showcase:journal-refresh', handleExternalRefresh)
  if (!isDesktop.value) {
    syncCompactHeader()
    window.addEventListener('scroll', scheduleCompactHeaderSync, { passive: true })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('cloud-showcase:journal-refresh', handleExternalRefresh)
  if (!isDesktop.value) {
    window.removeEventListener('scroll', scheduleCompactHeaderSync)
  }
  if (headerFrame) window.cancelAnimationFrame(headerFrame)
})
</script>

<style scoped>
.journal-library {
  position: relative;
  min-height: 0;
  padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px));
}

.journal-library--desktop {
  padding-bottom: 24px;
}

.journal-library__desktop-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
  padding: 22px 24px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 20px;
  background:
    radial-gradient(circle at 90% 0, rgba(162, 155, 254, 0.16), transparent 32%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 251, 240, 0.94));
  box-shadow: var(--shadow-sm);
}

.journal-library__desktop-header p {
  margin: 0 0 6px;
  color: var(--primary-gold-dark);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.journal-library__desktop-header h1 {
  margin: 0;
  color: var(--text-dark);
  font-size: 28px;
  line-height: 1.2;
}

.journal-library__desktop-header span {
  display: block;
  margin-top: 7px;
  color: var(--text-light);
  font-size: 14px;
}

.journal-library__desktop-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.journal-library__desktop-actions strong {
  padding: 7px 12px;
  border-radius: 999px;
  color: var(--primary-gold-dark);
  background: rgba(212, 175, 55, 0.12);
  font-size: 13px;
}

.journal-library--desktop .journal-library__grid,
.journal-library--desktop .journal-library__skeletons {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
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
  position: relative;
  padding: 0;
  color: inherit;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.journal-book-card__main {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.journal-book-card__main:active {
  transform: scale(0.98);
  border-color: rgba(212, 175, 55, 0.54);
  box-shadow: var(--shadow-md);
}

.journal-library--desktop .journal-book-card:hover {
  transform: translateY(-3px);
  border-color: rgba(212, 175, 55, 0.48);
  box-shadow: 0 14px 30px rgba(72, 54, 14, 0.13);
}

.journal-library--desktop .journal-book-card__main {
  display: block;
}

.journal-book-card__menu {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.journal-library--desktop .journal-book-card:hover .journal-book-card__menu,
.journal-library--desktop .journal-book-card:focus-within .journal-book-card__menu {
  opacity: 1;
  transform: translateY(0);
}

.journal-book-card__menu-trigger {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-dark);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 5px 16px rgba(15, 23, 42, 0.16);
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.journal-book-card__menu-trigger:hover,
.journal-book-card__menu-trigger:focus-visible {
  color: var(--primary-gold-dark);
  border-color: rgba(212, 175, 55, 0.45);
  outline: none;
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
