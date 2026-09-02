<template>
  <el-drawer
    v-model="visible"
    :direction="drawerDirection"
    :size="drawerSize"
    :with-header="false"
    :show-close="false"
    :lock-scroll="!isMobile"
    :class="[
      'club-goods-detail-drawer',
      { 'is-mobile': isMobile },
      { 'is-dragging': isDragging },
    ]"
    :aria-label="drawerAriaLabel"
    @open="handleOpen"
    @close="handleClose"
  >
    <div
      v-if="isMobile"
      class="mobile-drawer-header"
      @touchstart="handleHeaderTouchStart"
      @touchmove="handleHeaderTouchMove"
      @touchend="handleHeaderTouchEnd"
    >
      <div class="mobile-drawer-handle" aria-hidden="true"></div>
      <button
        ref="mobileCloseButtonRef"
        type="button"
        class="mobile-close-button"
        aria-label="关闭谷子详情"
        @click.stop="close"
      >
        <el-icon><Close /></el-icon>
      </button>
    </div>

    <div class="detail-drawer-shell">
      <div v-if="loading" class="detail-loading" aria-label="正在加载谷子详情">
        <el-skeleton :rows="10" animated />
      </div>

      <div
        v-else-if="detail"
        class="detail-scroll-content"
        @touchstart="handleContentTouchStart"
        @touchmove="handleContentTouchMove"
        @touchend="handleContentTouchEnd"
        @scroll="handleContentScroll"
      >
        <section v-if="!isMobile" class="desktop-detail-panel">
          <header class="desktop-detail-header">
            <h2 :title="detail.name">{{ detail.name }}</h2>
            <div class="desktop-detail-header__actions">
              <el-tag type="success" effect="dark" class="status-badge">已上架</el-tag>
              <button
                ref="desktopCloseButtonRef"
                type="button"
                class="desktop-close-button"
                aria-label="关闭谷子详情"
                @click="close"
              >
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </header>

          <section class="desktop-hero-card">
            <div class="desktop-main-image-wrap" :aria-label="detail.main_photo ? undefined : '暂无主图'">
              <SquarePaddedImage
                :src="detail.main_photo"
                :alt="`${detail.name}主图`"
                :preview-src-list="allImages"
                :initial-index="detail.main_photo ? 0 : undefined"
                class="desktop-main-image"
              />
              <span v-if="!detail.main_photo" class="image-placeholder-label">暂无主图</span>
            </div>

            <aside class="desktop-profile-area">
              <div class="detail-chip-row" aria-label="谷子分类信息">
                <span class="detail-chip is-public">社团公开</span>
                <span class="detail-chip" :title="detail.category.path_name || detail.category.name">
                  {{ detail.category.name }}
                </span>
                <span v-if="detail.theme" class="detail-chip is-theme" :title="detail.theme.name">
                  {{ detail.theme.name }}
                </span>
              </div>

              <dl class="detail-summary-list">
                <div class="detail-summary-row">
                  <dt>IP作品</dt>
                  <dd :title="detail.ip.name">{{ detail.ip.name }}</dd>
                </div>
                <div v-if="detail.characters.length" class="detail-summary-row is-characters">
                  <dt>角色</dt>
                  <dd class="detail-character-list">
                    <span v-for="character in detail.characters" :key="character.id" class="detail-character-chip">
                      {{ character.name }}
                    </span>
                  </dd>
                </div>
                <div class="detail-summary-row">
                  <dt>发布社团</dt>
                  <dd :title="clubName">{{ clubName || '—' }}</dd>
                </div>
              </dl>

              <article class="detail-price-card">
                <span>公开价格</span>
                <strong :class="{ 'is-price': hasPublicPrice }">{{ priceText }}</strong>
              </article>

              <section v-if="detail.additional_photos.length" class="desktop-thumbnail-panel">
                <div class="desktop-thumbnail-header">
                  <span>{{ detail.additional_photos.length }} 张附加图片</span>
                  <div v-if="totalThumbnailPages > 1" class="desktop-thumbnail-controls">
                    <button
                      type="button"
                      class="thumbnail-nav-button"
                      :disabled="thumbnailPage === 0"
                      aria-label="上一组附加图片"
                      @click="showPreviousThumbnails"
                    >
                      <el-icon><ArrowLeft /></el-icon>
                    </button>
                    <button
                      type="button"
                      class="thumbnail-nav-button"
                      :disabled="thumbnailPage >= totalThumbnailPages - 1"
                      aria-label="下一组附加图片"
                      @click="showNextThumbnails"
                    >
                      <el-icon><ArrowRight /></el-icon>
                    </button>
                  </div>
                </div>
                <div class="desktop-thumbnail-grid">
                  <button
                    v-for="{ photo, previewIndex, itemIndex } in visibleAdditionalPhotos"
                    :key="photo.id"
                    type="button"
                    class="detail-thumbnail"
                    :title="photo.label || `附加图片 ${itemIndex + 1}`"
                  >
                    <el-image
                      :src="photo.image"
                      fit="cover"
                      :preview-src-list="allImages"
                      :initial-index="previewIndex"
                      class="detail-thumbnail__image"
                    >
                      <template #error>
                        <div class="thumbnail-error"><el-icon><Picture /></el-icon></div>
                      </template>
                    </el-image>
                    <span :class="['detail-thumbnail__label', { 'is-placeholder': !photo.label }]">
                      {{ photo.label || '\u00a0' }}
                    </span>
                  </button>
                </div>
              </section>

              <div v-if="canImport" class="detail-inline-action desktop-inline-action">
                <el-button
                  type="primary"
                  class="detail-action__import brand-add-btn"
                  @click="emit('import', detail)"
                >
                  <span class="brand-add-btn__content">
                    <el-icon><Plus /></el-icon>
                    <span>加入谷仓</span>
                  </span>
                </el-button>
              </div>
            </aside>
          </section>

          <section v-if="detail.description" class="detail-notes-card">
            <h3>公开说明</h3>
            <p>{{ detail.description }}</p>
          </section>
        </section>

        <section v-else class="mobile-detail-panel">
          <section class="mobile-hero-card">
            <div class="mobile-main-image-wrap" :aria-label="detail.main_photo ? undefined : '暂无主图'">
              <SquarePaddedImage
                :src="detail.main_photo"
                :alt="`${detail.name}主图`"
                :preview-src-list="allImages"
                :initial-index="detail.main_photo ? 0 : undefined"
                class="mobile-main-image"
              />
              <span v-if="!detail.main_photo" class="image-placeholder-label">暂无主图</span>
            </div>
          </section>

          <section class="mobile-profile-card">
            <div class="mobile-title-row">
              <h2 :title="detail.name">{{ detail.name }}</h2>
              <el-tag type="success" effect="dark" class="status-badge">已上架</el-tag>
            </div>

            <div class="detail-chip-row" aria-label="谷子分类信息">
              <span class="detail-chip is-public">社团公开</span>
              <span class="detail-chip" :title="detail.category.path_name || detail.category.name">
                {{ detail.category.name }}
              </span>
              <span v-if="detail.theme" class="detail-chip is-theme" :title="detail.theme.name">
                {{ detail.theme.name }}
              </span>
            </div>

            <dl class="detail-summary-list">
              <div class="detail-summary-row">
                <dt>IP作品</dt>
                <dd :title="detail.ip.name">{{ detail.ip.name }}</dd>
              </div>
              <div v-if="detail.characters.length" class="detail-summary-row is-characters">
                <dt>角色</dt>
                <dd class="detail-character-list">
                  <span v-for="character in detail.characters" :key="character.id" class="detail-character-chip">
                    {{ character.name }}
                  </span>
                </dd>
              </div>
              <div class="detail-summary-row">
                <dt>发布社团</dt>
                <dd :title="clubName">{{ clubName || '—' }}</dd>
              </div>
            </dl>

            <article class="detail-price-card">
              <span>公开价格</span>
              <strong :class="{ 'is-price': hasPublicPrice }">{{ priceText }}</strong>
            </article>

            <div v-if="canImport" class="detail-inline-action mobile-inline-action">
              <el-button
                type="primary"
                class="detail-action__import brand-add-btn"
                @click="emit('import', detail)"
              >
                <span class="brand-add-btn__content">
                  <el-icon><Plus /></el-icon>
                  <span>加入谷仓</span>
                </span>
              </el-button>
            </div>
          </section>

          <section v-if="detail.additional_photos.length" class="mobile-gallery-card">
            <div class="mobile-section-title-row">
              <h3>附加图片</h3>
              <span>{{ detail.additional_photos.length }} 张</span>
            </div>
            <div class="mobile-gallery-rail">
              <button
                v-for="{ photo, previewIndex, itemIndex } in additionalPhotoEntries"
                :key="photo.id"
                type="button"
                class="detail-thumbnail mobile-gallery-item"
                :title="photo.label || `附加图片 ${itemIndex + 1}`"
              >
                <el-image
                  :src="photo.image"
                  fit="cover"
                  :preview-src-list="allImages"
                  :initial-index="previewIndex"
                  class="detail-thumbnail__image"
                >
                  <template #error>
                    <div class="thumbnail-error"><el-icon><Picture /></el-icon></div>
                  </template>
                </el-image>
                <span :class="['detail-thumbnail__label', { 'is-placeholder': !photo.label }]">
                  {{ photo.label || '\u00a0' }}
                </span>
              </button>
            </div>
          </section>

          <section v-if="detail.description" class="detail-notes-card mobile-notes-card">
            <h3>公开说明</h3>
            <p>{{ detail.description }}</p>
          </section>
        </section>
      </div>

      <div v-else class="detail-empty-state">
        <el-empty description="谷子详情暂时无法显示" />
      </div>

    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Close, Picture, Plus } from '@element-plus/icons-vue'
import SquarePaddedImage from '@/components/SquarePaddedImage.vue'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import type { ClubGoodsDetail } from '@/api/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  loading?: boolean
  detail: ClubGoodsDetail | null
  clubName?: string
  canImport?: boolean
}>(), {
  loading: false,
  clubName: '',
  canImport: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  import: [detail: ClubGoodsDetail]
}>()

const { isMobile, viewportHeight } = useResponsiveDevice()
const mobileCloseButtonRef = ref<HTMLButtonElement | null>(null)
const desktopCloseButtonRef = ref<HTMLButtonElement | null>(null)
const thumbnailPage = ref(0)
const isDragging = ref(false)
const sheetState = ref<'half' | 'full'>('half')
const currentDrawerHeight = ref<number | string>('65%')

let startY = 0
let startHeight = 0
let windowHeight = 0
let contentStartY = 0
let contentStartScrollTop = 0
let contentScrolled = false
let mobileBodyScrollTop = 0
let mobileBodyStyleSnapshot: Partial<CSSStyleDeclaration> | null = null
let previouslyFocused: HTMLElement | null = null

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const drawerDirection = computed(() => isMobile.value ? 'btt' : 'rtl')
const drawerSize = computed(() => isMobile.value ? currentDrawerHeight.value : 'clamp(720px, 48vw, 880px)')
const drawerAriaLabel = computed(() => props.detail?.name ? `${props.detail.name}详情` : '谷子详情')
const hasPublicPrice = computed(() => props.detail?.public_price !== null && props.detail?.public_price !== undefined && props.detail.public_price !== '')
const priceText = computed(() => hasPublicPrice.value ? `¥${props.detail!.public_price}` : '暂未公开')
const allImages = computed(() => {
  if (!props.detail) return []
  const images = props.detail.main_photo ? [props.detail.main_photo] : []
  return images.concat(props.detail.additional_photos.map(photo => photo.image))
})
const additionalPhotoEntries = computed(() => {
  if (!props.detail) return []
  const previewOffset = props.detail.main_photo ? 1 : 0
  return props.detail.additional_photos.map((photo, itemIndex) => ({
    photo,
    itemIndex,
    previewIndex: itemIndex + previewOffset,
  }))
})
const thumbnailPageSize = 4
const totalThumbnailPages = computed(() => Math.max(1, Math.ceil(additionalPhotoEntries.value.length / thumbnailPageSize)))
const visibleAdditionalPhotos = computed(() => {
  const start = thumbnailPage.value * thumbnailPageSize
  return additionalPhotoEntries.value.slice(start, start + thumbnailPageSize)
})

function showPreviousThumbnails() {
  thumbnailPage.value = Math.max(0, thumbnailPage.value - 1)
}

function showNextThumbnails() {
  thumbnailPage.value = Math.min(totalThumbnailPages.value - 1, thumbnailPage.value + 1)
}

function syncWindowHeight() {
  if (isMobile.value) windowHeight = viewportHeight.value || window.innerHeight
}

function lockMobileBodyScroll() {
  if (!isMobile.value || mobileBodyStyleSnapshot) return
  mobileBodyScrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  mobileBodyStyleSnapshot = {
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width,
    overflow: document.body.style.overflow,
    transform: document.body.style.transform,
  }
  document.body.style.position = 'fixed'
  // 用负 top 而非 transform 保留滚动位置：transform 会把 body 变成 fixed 定位基准，
  // 导致 el-overlay 遮罩和抽屉随页面滚动偏移、无法贴住视口底部
  document.body.style.top = `-${mobileBodyScrollTop}px`
  document.body.style.left = '0'
  document.body.style.right = '0'
  document.body.style.width = '100%'
  document.body.style.overflow = 'hidden'
}

function unlockMobileBodyScroll() {
  if (!mobileBodyStyleSnapshot) return
  document.body.style.position = mobileBodyStyleSnapshot.position || ''
  document.body.style.top = mobileBodyStyleSnapshot.top || ''
  document.body.style.left = mobileBodyStyleSnapshot.left || ''
  document.body.style.right = mobileBodyStyleSnapshot.right || ''
  document.body.style.width = mobileBodyStyleSnapshot.width || ''
  document.body.style.overflow = mobileBodyStyleSnapshot.overflow || ''
  document.body.style.transform = mobileBodyStyleSnapshot.transform || ''

  const scrollTop = mobileBodyScrollTop
  mobileBodyStyleSnapshot = null
  mobileBodyScrollTop = 0
  if (scrollTop > 0) window.scrollTo(0, scrollTop)
}

function close() {
  visible.value = false
}

function handleOpen() {
  syncWindowHeight()
  lockMobileBodyScroll()
  void nextTick(() => (isMobile.value ? mobileCloseButtonRef.value : desktopCloseButtonRef.value)?.focus())
}

function handleClose() {
  unlockMobileBodyScroll()
}

function snapTo(state: 'half' | 'full') {
  sheetState.value = state
  currentDrawerHeight.value = state === 'half' ? '65%' : '100%'
}

function handleHeaderTouchStart(event: TouchEvent) {
  if (!isMobile.value || !event.touches.length) return
  isDragging.value = true
  startY = event.touches[0]!.clientY
  windowHeight = viewportHeight.value || window.innerHeight
  startHeight = typeof currentDrawerHeight.value === 'string'
    ? windowHeight * parseFloat(currentDrawerHeight.value) / 100
    : currentDrawerHeight.value
}

function handleHeaderTouchMove(event: TouchEvent) {
  if (!isMobile.value || !isDragging.value || !event.touches.length) return
  event.preventDefault()
  const deltaY = startY - event.touches[0]!.clientY
  const minHeight = windowHeight * 0.2
  currentDrawerHeight.value = Math.min(windowHeight, Math.max(minHeight, startHeight + deltaY))
}

function handleHeaderTouchEnd() {
  if (!isMobile.value || !isDragging.value) return
  isDragging.value = false
  const finalHeight = typeof currentDrawerHeight.value === 'number'
    ? currentDrawerHeight.value
    : windowHeight * parseFloat(currentDrawerHeight.value) / 100
  const ratio = windowHeight > 0 ? finalHeight / windowHeight : 0.65
  if (ratio < 0.4) {
    close()
  } else if (ratio > 0.8) {
    snapTo('full')
  } else {
    snapTo('half')
  }
}

function handleContentTouchStart(event: TouchEvent) {
  if (!isMobile.value || !event.touches.length) return
  contentStartY = event.touches[0]!.clientY
  contentScrolled = false
  contentStartScrollTop = (event.currentTarget as HTMLElement | null)?.scrollTop || 0
}

function handleContentTouchMove() {
  // Native scrolling remains enabled while gesture intent is resolved on touchend.
}

function handleContentScroll(event: Event) {
  if (contentScrolled) return
  const container = event.currentTarget as HTMLElement | null
  if (container && Math.abs(container.scrollTop - contentStartScrollTop) > 2) contentScrolled = true
}

function handleContentTouchEnd(event: TouchEvent) {
  if (!isMobile.value || !event.changedTouches.length) return
  const deltaY = contentStartY - event.changedTouches[0]!.clientY
  if (sheetState.value === 'half' && deltaY > 50) {
    snapTo('full')
  } else if (
    sheetState.value === 'full' &&
    contentStartScrollTop <= 2 &&
    !contentScrolled &&
    deltaY < -80
  ) {
    close()
  }
  contentStartY = 0
  contentStartScrollTop = 0
  contentScrolled = false
}

watch(() => props.detail?.id, () => {
  thumbnailPage.value = 0
})

watch(() => props.modelValue, (isVisible) => {
  if (isVisible) {
    previouslyFocused = document.activeElement as HTMLElement | null
    if (isMobile.value) snapTo('half')
    syncWindowHeight()
    lockMobileBodyScroll()
    void nextTick(() => (isMobile.value ? mobileCloseButtonRef.value : desktopCloseButtonRef.value)?.focus())
    return
  }
  unlockMobileBodyScroll()
  const focusTarget = previouslyFocused
  previouslyFocused = null
  void nextTick(() => focusTarget?.focus?.())
}, { immediate: true })

watch([isMobile, viewportHeight], () => {
  syncWindowHeight()
  if (!isMobile.value) unlockMobileBodyScroll()
  else if (props.modelValue) lockMobileBodyScroll()
})

onBeforeUnmount(() => {
  unlockMobileBodyScroll()
})

defineExpose({
  currentDrawerHeight,
  sheetState,
  snapTo,
})
</script>

<style scoped>
.detail-drawer-shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #fff;
}

.detail-loading,
.detail-empty-state {
  flex: 1;
  padding: 24px;
}

.detail-scroll-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px 20px 8px;
  -webkit-overflow-scrolling: touch;
}

.desktop-detail-panel,
.mobile-detail-panel {
  color: var(--text-dark, #333);
}

.desktop-detail-panel {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 18px;
}

.desktop-detail-header,
.desktop-detail-header__actions,
.mobile-title-row,
.mobile-section-title-row {
  display: flex;
  align-items: flex-start;
}

.desktop-detail-header,
.mobile-title-row,
.mobile-section-title-row {
  justify-content: space-between;
  gap: 14px;
}

.desktop-detail-header h2,
.mobile-title-row h2 {
  display: -webkit-box;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #2f2a20;
  font-weight: 800;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.desktop-detail-header h2 {
  font-size: 24px;
  line-height: 1.25;
}

.desktop-detail-header__actions {
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.status-badge {
  flex: 0 0 auto;
}

.desktop-close-button,
.mobile-close-button,
.thumbnail-nav-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid rgba(212, 175, 55, 0.22);
  background: #fff;
  color: var(--text-light, #888);
  cursor: pointer;
}

.desktop-close-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 16px;
}

.desktop-close-button:hover,
.desktop-close-button:focus-visible,
.thumbnail-nav-button:not(:disabled):hover,
.thumbnail-nav-button:not(:disabled):focus-visible {
  border-color: var(--primary-gold, #d4af37);
  color: var(--primary-gold-dark, #b8941f);
  outline: none;
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.14);
}

.desktop-hero-card,
.detail-price-card,
.detail-notes-card,
.mobile-hero-card,
.mobile-profile-card,
.mobile-gallery-card {
  border: 1px solid rgba(212, 175, 55, 0.24);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(255, 255, 255, 0.9)),
    var(--secondary-gray, #f5f5f7);
  box-shadow: 0 10px 28px rgba(82, 63, 16, 0.08);
}

.desktop-hero-card {
  display: grid;
  grid-template-columns: minmax(360px, 1.28fr) minmax(270px, 0.9fr);
  gap: 20px;
  align-items: start;
  padding: 14px;
  border-radius: 18px;
}

.desktop-main-image-wrap,
.mobile-main-image-wrap {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: linear-gradient(135deg, #fafafa, var(--secondary-gray, #f5f5f7));
}

.desktop-main-image-wrap {
  border: 1px solid rgba(212, 175, 55, 0.34);
  border-radius: 16px;
}

.desktop-main-image,
.mobile-main-image {
  width: 100%;
  height: 100%;
}

.image-placeholder-label {
  position: absolute;
  left: 50%;
  bottom: 24%;
  color: var(--text-light, #888);
  font-size: 12px;
  transform: translateX(-50%);
  pointer-events: none;
}

.desktop-profile-area {
  display: flex;
  min-width: 0;
  align-self: stretch;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px 4px 0;
}

.detail-chip-row,
.detail-character-list {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-chip,
.detail-character-chip {
  max-width: 100%;
  overflow: hidden;
  padding: 7px 10px;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.1);
  color: #7c5f16;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-chip.is-public {
  border-color: rgba(103, 194, 58, 0.3);
  background: rgba(103, 194, 58, 0.1);
  color: #3f8f2f;
}

.detail-chip.is-theme {
  border-color: rgba(162, 155, 254, 0.32);
  background: var(--accent-purple-soft, #f6f4ff);
  color: #6358bd;
}

.detail-summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}

.detail-summary-row {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.detail-summary-row dt {
  color: var(--text-light, #888);
  font-size: 13px;
  line-height: 1.5;
}

.detail-summary-row dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--text-dark, #333);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
}

.detail-summary-row dd:not(.detail-character-list) {
  white-space: nowrap;
}

.detail-summary-row.is-characters {
  align-items: center;
}

.detail-character-chip {
  border-color: rgba(162, 155, 254, 0.3);
  background: rgba(246, 244, 255, 0.78);
  color: var(--accent-purple-dark, #9980fa);
  font-weight: 600;
}

.detail-price-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  padding: 13px 14px;
  border-radius: 14px;
  box-shadow: none;
}

.detail-price-card span {
  color: var(--text-light, #888);
  font-size: 12px;
}

.detail-price-card strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-light, #888);
  font-size: 18px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-price-card strong.is-price {
  color: var(--primary-gold-dark, #b8941f);
}

.desktop-thumbnail-panel {
  min-width: 0;
  padding-top: 13px;
  border-top: 1px dashed rgba(212, 175, 55, 0.24);
}

.desktop-thumbnail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.desktop-thumbnail-header > span {
  color: var(--text-light, #888);
  font-size: 12px;
}

.desktop-thumbnail-controls {
  display: flex;
  gap: 6px;
}

.thumbnail-nav-button {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.thumbnail-nav-button:disabled {
  color: var(--text-placeholder, #c0c4cc);
  cursor: not-allowed;
  opacity: 0.58;
}

.desktop-thumbnail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.detail-thumbnail {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.detail-thumbnail__image,
.thumbnail-error {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 10px;
  background: var(--secondary-gray, #f5f5f7);
}

.thumbnail-error {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light, #888);
}

.detail-thumbnail__label {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--text-regular, #606266);
  font-size: 12px;
  line-height: 1.3;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-thumbnail__label.is-placeholder {
  visibility: hidden;
}

.detail-notes-card {
  padding: 18px;
  border-radius: 18px;
}

.detail-notes-card h3,
.mobile-section-title-row h3 {
  margin: 0;
  color: #2f2a20;
  font-size: 15px;
  font-weight: 800;
}

.detail-notes-card p {
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 12px;
  background: rgba(245, 245, 247, 0.9);
  color: var(--text-regular, #606266);
  font-size: 13px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.detail-inline-action {
  display: flex;
  justify-content: flex-end;
}

.desktop-inline-action {
  margin-top: auto;
  padding-top: 4px;
}

.mobile-inline-action {
  margin-top: 14px;
}

.detail-action__import {
  width: 112px;
  --brand-add-radius: 8px;
  --brand-add-padding-y: 8px;
  --brand-add-padding-x: 13px;
  --brand-add-min-height: 38px;
  --brand-add-font-size: 13px;
  --brand-add-gap: 6px;
  letter-spacing: 0;
}

.mobile-drawer-header {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  background: #fff;
  cursor: grab;
  touch-action: none;
}

.mobile-drawer-header:active {
  cursor: grabbing;
}

.mobile-drawer-handle {
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: rgba(51, 51, 51, 0.14);
}

.mobile-close-button {
  position: absolute;
  top: -2px;
  right: 8px;
  width: 44px;
  height: 44px;
  border-color: transparent;
  border-radius: 50%;
  font-size: 16px;
}

.mobile-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mobile-hero-card,
.mobile-profile-card,
.mobile-gallery-card,
.mobile-notes-card {
  border-radius: 18px;
}

.mobile-hero-card {
  padding: 10px;
}

.mobile-main-image-wrap {
  border-radius: 16px;
}

.mobile-profile-card,
.mobile-gallery-card,
.mobile-notes-card {
  padding: 15px;
}

.mobile-title-row h2 {
  font-size: 19px;
  line-height: 1.28;
}

.mobile-profile-card .detail-chip-row {
  margin-top: 14px;
}

.mobile-profile-card .detail-summary-list {
  margin-top: 16px;
}

.mobile-profile-card .detail-price-card {
  margin-top: 14px;
}

.mobile-section-title-row {
  align-items: center;
  margin-bottom: 12px;
}

.mobile-section-title-row > span {
  color: var(--text-light, #888);
  font-size: 12px;
}

.mobile-gallery-rail {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.mobile-gallery-rail::-webkit-scrollbar {
  display: none;
}

.mobile-gallery-item {
  flex: 0 0 92px;
}

/* el-drawer 内部 DOM 不携带本组件的 scoped 属性，:deep 命不中，须用 :global + 组件专属类名覆盖，
   否则 body 保持 EP 默认的 padding:20px/overflow:auto，会多出一条滚动条并把内容滚动条顶离边缘 */
:global(.el-drawer.club-goods-detail-drawer .el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

:global(.el-drawer.club-goods-detail-drawer) {
  background: #fff;
  box-shadow: -18px 0 42px rgba(15, 23, 42, 0.16);
}

:global(.el-drawer.club-goods-detail-drawer.is-mobile) {
  max-height: 100dvh;
  overflow: hidden;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -18px 42px rgba(15, 23, 42, 0.18);
}

:global(.el-drawer.club-goods-detail-drawer.is-mobile .el-drawer__body) {
  max-height: 100dvh;
}

:global(.el-drawer.club-goods-detail-drawer.is-mobile .detail-scroll-content) {
  padding: 0 12px 18px;
  scrollbar-width: none;
}

:global(.el-drawer.club-goods-detail-drawer.is-mobile .detail-scroll-content::-webkit-scrollbar) {
  display: none;
}

:global(.el-drawer.club-goods-detail-drawer.is-dragging) {
  transition: none !important;
}

@media (max-width: 1100px) and (min-width: 769px) {
  .desktop-hero-card {
    grid-template-columns: minmax(320px, 1.12fr) minmax(250px, 0.88fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .desktop-close-button,
  .mobile-close-button,
  .thumbnail-nav-button,
  :global(.el-drawer.club-goods-detail-drawer) {
    transition: none !important;
  }
}
</style>
