<template>
  <section class="paper-section display-section">
    <div class="paper-header" data-test="paper-section-title">
      <div class="section-heading-copy">
        <span class="section-kicker">PAPER ARCHIVE ALBUM</span>
        <h2 class="paper-title">纸制品收纳册</h2>
      </div>
      <div class="paper-header-meta">
        <button
          v-if="isMobile"
          class="paper-fullscreen-button"
          data-test="paper-fullscreen-button"
          type="button"
          aria-label="Fullscreen paper album"
          title="Fullscreen"
          @click="emit('openFullscreen')"
        >
          <el-icon><FullScreen /></el-icon>
        </button>
        <span class="paper-count">{{ items.length }} 张</span>
        <span class="paper-page-indicator" data-test="paper-album-page-indicator">{{ currentSpread + 1 }} / {{ totalSpreads }}</span>
      </div>
    </div>

    <div
      ref="albumRef"
      class="paper-album"
      :class="{
        'is-drag-active': dragging,
        'is-page-turning': isPageTurning,
        'is-turning-next': turnDirection === 'next',
        'is-turning-prev': turnDirection === 'prev',
      }"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <button
        class="paper-page-button paper-page-button--prev"
        data-test="paper-prev-page"
        :disabled="isPageTurning || currentSpread === 0"
        type="button"
        title="上一页"
        @click="goPrev"
      >
        <el-icon><ArrowLeft /></el-icon>
      </button>

      <div class="paper-book">
        <div
          v-for="(page, pageIndex) in visiblePages"
          :key="page.key"
          class="paper-page"
          :class="{ 'paper-page--right': pageIndex === 1 }"
        >
          <div class="paper-page-ring" />
          <div class="paper-pocket-grid">
            <div
              v-for="slot in page.slots"
              :key="slot.key"
              class="paper-pocket"
              :class="{ 'is-empty': !slot.item }"
            >
              <div
                v-if="slot.item"
                class="paper-item"
                :data-id="slot.item.id"
                :class="{ 'is-dragging': dragItemId === slot.item.id }"
                :style="[
                  { cursor: readonly ? 'default' : 'grab' },
                  slot.item.goods.category?.color_tag ? { '--paper-accent': slot.item.goods.category.color_tag } : {},
                ]"
                @pointerdown="onPointerDown($event, slot.item)"
                @click="onPaperClick(slot.item)"
                @contextmenu.prevent.stop="!readonly && emit('goodsContextMenuFromDom', slot.item.goods.id, $event)"
                @dragstart.prevent
              >
                <div class="paper-card" :title="slot.item.goods.name">
                  <WatermarkImage
                    v-if="readonly && slot.item.goods.main_photo"
                    :src="slot.item.goods.main_photo"
                    :alt="slot.item.goods.name"
                    :user-id="'ID:' + slot.item.goods.id.slice(0, 8)"
                    fit="contain"
                    class="paper-img"
                  />
                  <el-image
                    v-else-if="slot.item.goods.main_photo"
                    :src="slot.item.goods.main_photo"
                    :alt="slot.item.goods.name"
                    fit="contain"
                    class="paper-img"
                    loading="lazy"
                  >
                    <template #error>
                      <div class="paper-placeholder"><el-icon><Picture /></el-icon></div>
                    </template>
                  </el-image>
                  <div v-else class="paper-placeholder"><el-icon><Picture /></el-icon></div>
                </div>
                <div v-if="slot.item.goods.quantity > 1" class="paper-qty">x{{ slot.item.goods.quantity }}</div>
                <span class="paper-official-dot" :class="slot.item.goods.is_official ? 'is-official' : 'is-doujin'" />
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="isPageTurning && turnSheetFrontPage && turnSheetBackPage"
          class="paper-turn-layer"
          aria-hidden="true"
        >
          <div class="paper-turn-sheet">
            <div class="paper-turn-shadow" />
            <div class="paper-turn-face paper-turn-face--front">
              <div class="paper-turn-page">
                <div class="paper-page-ring" />
                <div class="paper-pocket-grid">
                  <div
                    v-for="slot in turnSheetFrontPage.slots"
                    :key="`front-${slot.key}`"
                    class="paper-pocket"
                    :class="{ 'is-empty': !slot.item }"
                  >
                    <div v-if="slot.item" class="paper-turn-card" :data-id="slot.item.id">
                      <div
                        class="paper-card"
                        :style="slot.item.goods.category?.color_tag ? { '--paper-accent': slot.item.goods.category.color_tag } : {}"
                      >
                        <WatermarkImage
                          v-if="readonly && slot.item.goods.main_photo"
                          :src="slot.item.goods.main_photo"
                          :alt="slot.item.goods.name"
                          :user-id="'ID:' + slot.item.goods.id.slice(0, 8)"
                          fit="contain"
                          class="paper-img"
                        />
                        <el-image
                          v-else-if="slot.item.goods.main_photo"
                          :src="slot.item.goods.main_photo"
                          :alt="slot.item.goods.name"
                          fit="contain"
                          class="paper-img"
                          loading="lazy"
                        >
                          <template #error>
                            <div class="paper-placeholder"><el-icon><Picture /></el-icon></div>
                          </template>
                        </el-image>
                        <div v-else class="paper-placeholder"><el-icon><Picture /></el-icon></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="paper-turn-face paper-turn-face--back">
              <div class="paper-turn-page">
                <div class="paper-page-ring" />
                <div class="paper-pocket-grid">
                  <div
                    v-for="slot in turnSheetBackPage.slots"
                    :key="`back-${slot.key}`"
                    class="paper-pocket"
                    :class="{ 'is-empty': !slot.item }"
                  >
                    <div v-if="slot.item" class="paper-turn-card" :data-id="slot.item.id">
                      <div
                        class="paper-card"
                        :style="slot.item.goods.category?.color_tag ? { '--paper-accent': slot.item.goods.category.color_tag } : {}"
                      >
                        <WatermarkImage
                          v-if="readonly && slot.item.goods.main_photo"
                          :src="slot.item.goods.main_photo"
                          :alt="slot.item.goods.name"
                          :user-id="'ID:' + slot.item.goods.id.slice(0, 8)"
                          fit="contain"
                          class="paper-img"
                        />
                        <el-image
                          v-else-if="slot.item.goods.main_photo"
                          :src="slot.item.goods.main_photo"
                          :alt="slot.item.goods.name"
                          fit="contain"
                          class="paper-img"
                          loading="lazy"
                        >
                          <template #error>
                            <div class="paper-placeholder"><el-icon><Picture /></el-icon></div>
                          </template>
                        </el-image>
                        <div v-else class="paper-placeholder"><el-icon><Picture /></el-icon></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        class="paper-page-button paper-page-button--next"
        data-test="paper-next-page"
        :disabled="isPageTurning || currentSpread >= totalSpreads - 1"
        type="button"
        title="下一页"
        @click="goNext"
      >
        <el-icon><ArrowRight /></el-icon>
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="dragGhost"
        class="paper-ghost"
        :style="{
          left: dragGhost.x + 'px',
          top: dragGhost.y + 'px',
          width: dragGhost.width + 'px',
          height: dragGhost.height + 'px',
          borderRadius: dragGhost.radius,
          '--paper-accent': dragGhost.ring,
        }"
      >
        <img v-if="dragGhost.src" :src="dragGhost.src" :alt="dragGhost.alt" class="paper-ghost-img" />
        <div v-else class="paper-placeholder"><el-icon><Picture /></el-icon></div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, FullScreen, Picture } from '@element-plus/icons-vue'
import WatermarkImage from '@/components/WatermarkImage.vue'
import { useShowcaseDisplayDragSort } from './useShowcaseDisplayDragSort'
import type { GoodsListItem, ShowcaseGoods } from '@/api/types'

const props = withDefaults(defineProps<{
  items: ShowcaseGoods[]
  showcaseId?: string | null
  readonly?: boolean
}>(), {
  showcaseId: null,
  readonly: false,
})

const emit = defineEmits<{
  openGoods: [goods: GoodsListItem]
  openFullscreen: []
  goodsContextMenuFromDom: [goodsId: string, event: MouseEvent]
}>()

type TurnDirection = 'next' | 'prev'
const albumRef = ref<HTMLElement | null>(null)
const currentSpread = ref(0)
const displayedSpread = ref(0)
const turnFromSpread = ref<number | null>(null)
const turnToSpread = ref<number | null>(null)
const turnDirection = ref<TurnDirection | null>(null)
const isPageTurning = ref(false)
const isMobile = ref(false)
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchStartAt = ref(0)
let mediaQuery: MediaQueryList | null = null
let mediaCleanup: (() => void) | null = null
let pageTurnTimer: number | null = null

if (typeof window !== 'undefined') {
  mediaQuery = window.matchMedia('(max-width: 768px)')
  const update = () => {
    isMobile.value = !!mediaQuery?.matches
  }
  update()
  mediaQuery.addEventListener?.('change', update)
  mediaCleanup = () => mediaQuery?.removeEventListener?.('change', update)
}

onBeforeUnmount(() => {
  mediaCleanup?.()
  if (pageTurnTimer !== null) window.clearTimeout(pageTurnTimer)
})

const pageTurnDurationMs = computed(() => (isMobile.value ? 420 : 620))
const slotsPerPage = computed(() => 6)
const pagesPerSpread = computed(() => (isMobile.value ? 1 : 2))
const itemsPerSpread = computed(() => slotsPerPage.value * pagesPerSpread.value)
const totalSpreads = computed(() => Math.max(1, Math.ceil(props.items.length / itemsPerSpread.value)))

const finishPageTurn = () => {
  if (turnToSpread.value !== null) {
    currentSpread.value = turnToSpread.value
    displayedSpread.value = turnToSpread.value
  }
  isPageTurning.value = false
  turnFromSpread.value = null
  turnToSpread.value = null
  turnDirection.value = null
  pageTurnTimer = null
}

const startPageTurn = (targetSpread: number, direction: TurnDirection) => {
  if (isPageTurning.value) return
  if (targetSpread < 0 || targetSpread > totalSpreads.value - 1) return
  if (targetSpread === currentSpread.value) return

  turnFromSpread.value = currentSpread.value
  turnToSpread.value = targetSpread
  turnDirection.value = direction
  isPageTurning.value = true

  if (pageTurnTimer !== null) window.clearTimeout(pageTurnTimer)
  pageTurnTimer = window.setTimeout(finishPageTurn, pageTurnDurationMs.value)
}

const goPrev = () => {
  startPageTurn(currentSpread.value - 1, 'prev')
}

const goNext = () => {
  startPageTurn(currentSpread.value + 1, 'next')
}

const maybeFlipAtEdge = (x: number, y: number) => {
  const rect = albumRef.value?.getBoundingClientRect()
  if (!rect) return
  if (y < rect.top || y > rect.bottom) return
  const edge = Math.min(82, rect.width * 0.16)
  if (x < rect.left + edge && currentSpread.value > 0) {
    startPageTurn(currentSpread.value - 1, 'prev')
  } else if (x > rect.right - edge && currentSpread.value < totalSpreads.value - 1) {
    startPageTurn(currentSpread.value + 1, 'next')
  }
}

const onTouchStart = (event: TouchEvent) => {
  if (!isMobile.value || dragging.value || isPageTurning.value) return
  const touch = event.touches[0]
  if (!touch) return
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
  touchStartAt.value = Date.now()
}

const canSwipeTurn = (deltaX: number, deltaY: number) => {
  if (!isMobile.value || dragging.value || isPageTurning.value) return false
  if (Math.abs(deltaX) <= 48) return false
  if (Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return false
  return Date.now() - touchStartAt.value < 900
}

const onTouchEnd = (event: TouchEvent) => {
  if (!touchStartAt.value) return
  const touch = event.changedTouches[0]
  if (!touch) return
  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value

  const shouldTurn = canSwipeTurn(deltaX, deltaY)
  touchStartAt.value = 0

  if (!shouldTurn) return
  if (deltaX < 0) {
    goNext()
  } else {
    goPrev()
  }
}

const showcaseId = computed(() => props.showcaseId)
const readonlyRef = computed(() => props.readonly)
const itemsRef = computed(() => props.items)

const {
  localOrder,
  dragging,
  dragItemId,
  dragGhost,
  onPointerDown,
  shouldSuppressClick,
} = useShowcaseDisplayDragSort({
  items: itemsRef,
  showcaseId,
  readonly: readonlyRef,
  itemSelector: '.paper-item',
  defaultRing: '#8e7dff',
  errorMessage: '纸制品排序更新失败，已恢复',
  ghostSize: () => {
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
    return mobile ? { width: 128, height: 128, radius: '14px' } : { width: 176, height: 176, radius: '18px' }
  },
  onHoverEdge: maybeFlipAtEdge,
})

watch(totalSpreads, (next) => {
  if (currentSpread.value >= next) currentSpread.value = Math.max(0, next - 1)
  if (displayedSpread.value >= next) displayedSpread.value = Math.max(0, next - 1)
})

interface PaperSlot {
  key: string
  item: ShowcaseGoods | null
}

interface VisiblePage {
  key: string
  slots: PaperSlot[]
}

const buildPagesForSpread = (spreadIndex: number): VisiblePage[] => {
  const pages: VisiblePage[] = []
  const spreadStart = spreadIndex * itemsPerSpread.value
  for (let page = 0; page < pagesPerSpread.value; page += 1) {
    const start = spreadStart + page * slotsPerPage.value
    const slots: PaperSlot[] = []
    for (let slot = 0; slot < slotsPerPage.value; slot += 1) {
      const index = start + slot
      slots.push({
        key: `p${page}-s${slot}-${localOrder.value[index]?.id || 'empty'}`,
        item: localOrder.value[index] || null,
      })
    }
    pages.push({ key: `spread-${spreadIndex}-page-${page}`, slots })
  }
  return pages
}

const turnFromPages = computed<VisiblePage[]>(() => (
  turnFromSpread.value === null ? [] : buildPagesForSpread(turnFromSpread.value)
))
const turnToPages = computed<VisiblePage[]>(() => (
  turnToSpread.value === null ? [] : buildPagesForSpread(turnToSpread.value)
))
const visiblePages = computed<VisiblePage[]>(() => {
  if (!isPageTurning.value || !turnDirection.value || pagesPerSpread.value === 1) {
    return buildPagesForSpread(displayedSpread.value)
  }

  const fromPages = turnFromPages.value
  const toPages = turnToPages.value
  if (fromPages.length < 2 || toPages.length < 2) return buildPagesForSpread(displayedSpread.value)

  const [fromLeft, fromRight] = fromPages
  const [toLeft, toRight] = toPages
  if (!fromLeft || !fromRight || !toLeft || !toRight) return buildPagesForSpread(displayedSpread.value)

  return turnDirection.value === 'next'
    ? [fromLeft, toRight]
    : [toLeft, fromRight]
})
const turnSheetFrontPage = computed<VisiblePage | null>(() => {
  if (!turnDirection.value) return null
  const pages = turnFromPages.value
  return pages[turnDirection.value === 'next' && pagesPerSpread.value > 1 ? 1 : 0] || null
})
const turnSheetBackPage = computed<VisiblePage | null>(() => {
  if (!turnDirection.value) return null
  const pages = turnToPages.value
  return pages[turnDirection.value === 'prev' && pagesPerSpread.value > 1 ? 1 : 0] || null
})

const onPaperClick = (item: ShowcaseGoods) => {
  if (shouldSuppressClick()) return
  if (props.readonly) return
  emit('openGoods', item.goods)
}
</script>

<style scoped>
.paper-section {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(247, 250, 255, 0.72)),
    repeating-linear-gradient(90deg, rgba(142, 125, 255, 0.055) 0 1px, transparent 1px 16px),
    linear-gradient(135deg, rgba(142, 125, 255, 0.12), rgba(255, 255, 255, 0.42) 46%, rgba(212, 175, 55, 0.1));
}

.paper-header,
.paper-header-meta {
  display: flex;
  align-items: flex-end;
}
.section-heading-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.section-kicker {
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0;
  text-transform: uppercase;
  color: rgba(70, 50, 18, 0.54);
}
.paper-header {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.paper-title {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
  color: rgba(70, 50, 18, 0.86);
  margin: 0;
}
.paper-header-meta {
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.paper-count,
.paper-page-indicator,
.paper-fullscreen-button {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 800;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(142, 125, 255, 0.1);
  border: 1px solid rgba(142, 125, 255, 0.18);
  color: rgba(64, 58, 112, 0.68);
}
.paper-fullscreen-button {
  border-color: rgba(142, 125, 255, 0.24);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  width: 28px;
  height: 28px;
  padding: 0;
}

.paper-album {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 48px;
  align-items: center;
  gap: 18px;
}
.paper-page-button {
  width: 48px;
  height: 72px;
  border: 1px solid rgba(142, 125, 255, 0.18);
  border-radius: 999px;
  color: rgba(64, 58, 112, 0.72);
  background: rgba(255, 255, 255, 0.78);
  box-shadow:
    0 16px 30px -24px rgba(31, 38, 62, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
  cursor: pointer;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    background 0.22s ease,
    opacity 0.22s ease;
}
.paper-page-button:not(:disabled):hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 20px 36px -22px rgba(31, 38, 62, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.paper-page-button:disabled {
  cursor: default;
  opacity: 0.38;
}

.paper-book {
  --paper-book-padding: clamp(24px, 2.1vw, 34px);
  --paper-card-size: clamp(158px, 9.6vw, 190px);
  --paper-pocket-min-height: clamp(172px, 10.8vw, 206px);
  --paper-page-min-height: clamp(620px, 41vw, 700px);
  --paper-turn-duration: 620ms;
  min-width: 0;
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  width: 100%;
  max-width: min(1520px, 100%);
  margin: 0 auto;
  border-radius: 26px;
  padding: var(--paper-book-padding);
  overflow: hidden;
  perspective: 2200px;
  background:
    radial-gradient(circle at 14% 10%, rgba(255, 255, 255, 0.86), transparent 24%),
    radial-gradient(circle at 84% 16%, rgba(142, 125, 255, 0.12), transparent 30%),
    repeating-linear-gradient(90deg, rgba(142, 125, 255, 0.045) 0 1px, transparent 1px 22px),
    linear-gradient(135deg, #fbfcff 0%, #eef4ff 46%, #dce6f6 100%);
  border: 1px solid rgba(142, 125, 255, 0.22);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    inset 0 -22px 44px -40px rgba(31, 38, 62, 0.38),
    0 32px 72px -42px rgba(40, 48, 74, 0.48);
}
.paper-book::before {
  content: '';
  position: absolute;
  top: var(--paper-book-padding);
  bottom: var(--paper-book-padding);
  left: calc(50% - 1px);
  width: 2px;
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(142, 125, 255, 0.2), rgba(212, 175, 55, 0.16), rgba(142, 125, 255, 0.24)),
    rgba(64, 58, 112, 0.08);
  box-shadow:
    -10px 0 22px -18px rgba(31, 38, 62, 0.8),
    10px 0 22px -18px rgba(31, 38, 62, 0.8);
  pointer-events: none;
  z-index: 3;
}
.paper-turn-layer {
  position: absolute;
  inset: var(--paper-book-padding);
  z-index: 6;
  pointer-events: none;
  perspective: 1800px;
  isolation: isolate;
  contain: paint;
}
.paper-turn-sheet {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  transform-style: preserve-3d;
  will-change: transform;
  animation-duration: var(--paper-turn-duration);
  animation-fill-mode: both;
  animation-timing-function: cubic-bezier(0.16, 0.72, 0.18, 1);
}
.is-turning-next .paper-turn-sheet {
  right: 0;
  transform-origin: left center;
  animation-name: paper-turn-next;
}
.is-turning-prev .paper-turn-sheet {
  left: 0;
  transform-origin: right center;
  animation-name: paper-turn-prev;
}
.paper-turn-sheet::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  border-radius: inherit;
  background:
    linear-gradient(90deg, rgba(34, 29, 62, 0.24), transparent 20%, rgba(255, 255, 255, 0.48) 68%, transparent),
    linear-gradient(120deg, transparent 18%, rgba(255, 255, 255, 0.28) 48%, transparent 72%);
  opacity: 0;
  animation: paper-turn-sheen var(--paper-turn-duration) ease both;
  pointer-events: none;
}
.paper-turn-shadow {
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: inherit;
  background:
    linear-gradient(90deg, rgba(31, 38, 62, 0.28), transparent 18%, transparent 74%, rgba(31, 38, 62, 0.18)),
    radial-gradient(ellipse at center, rgba(31, 38, 62, 0.24), transparent 68%);
  opacity: 0.34;
  transform: translateZ(1px);
  animation: paper-turn-shadow var(--paper-turn-duration) ease both;
  pointer-events: none;
}
.paper-turn-face {
  position: absolute;
  inset: 0;
  display: flex;
  z-index: 2;
  backface-visibility: hidden;
  transform-style: preserve-3d;
}
.paper-turn-face--front {
  transform: rotateY(0deg);
}
.paper-turn-face--back {
  transform: rotateY(180deg);
}
.paper-turn-page {
  position: relative;
  width: 100%;
  padding: clamp(22px, 1.6vw, 28px) clamp(22px, 1.6vw, 28px) clamp(22px, 1.6vw, 28px) clamp(44px, 3vw, 52px);
  border-radius: 6px 22px 22px 6px;
  background:
    radial-gradient(circle at 24% 14%, rgba(255, 255, 255, 0.72), transparent 22%),
    repeating-linear-gradient(0deg, rgba(142, 125, 255, 0.035) 0 1px, transparent 1px 22px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 249, 255, 0.88));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.64),
    0 24px 44px -26px rgba(31, 38, 62, 0.52);
}
.is-turning-prev .paper-turn-page {
  border-radius: 22px 6px 6px 22px;
}
.paper-turn-card {
  width: min(var(--paper-card-size), 100%);
}
.paper-turn-card .paper-card {
  width: 100%;
}
.paper-page {
  position: relative;
  z-index: 1;
  min-height: var(--paper-page-min-height);
  padding: clamp(22px, 1.6vw, 28px) clamp(22px, 1.6vw, 28px) clamp(22px, 1.6vw, 28px) clamp(44px, 3vw, 52px);
  border-radius: 22px 6px 6px 22px;
  background:
    radial-gradient(circle at 24% 14%, rgba(255, 255, 255, 0.62), transparent 24%),
    repeating-linear-gradient(0deg, rgba(142, 125, 255, 0.035) 0 1px, transparent 1px 22px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(246, 249, 255, 0.76));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.58),
    inset 0 -28px 42px -44px rgba(31, 38, 62, 0.42);
}
.paper-page--right {
  border-radius: 6px 22px 22px 6px;
}
.paper-page-ring {
  position: absolute;
  top: clamp(28px, 2.2vw, 38px);
  bottom: clamp(28px, 2.2vw, 38px);
  left: clamp(18px, 1.5vw, 24px);
  width: 11px;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.92) 0 32%, transparent 34%) 0 0 / 11px 68px,
    linear-gradient(180deg, rgba(142, 125, 255, 0.28), rgba(212, 175, 55, 0.2));
}
.paper-pocket-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: clamp(16px, 1.25vw, 22px);
}
.paper-pocket {
  min-height: var(--paper-pocket-min-height);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  border: 1px solid rgba(142, 125, 255, 0.16);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.28)),
    rgba(231, 238, 250, 0.46);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    inset 0 -14px 24px -18px rgba(59, 71, 102, 0.32),
    0 14px 24px -22px rgba(31, 38, 62, 0.28);
}
.paper-pocket.is-empty {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.18)),
    rgba(231, 238, 250, 0.28);
}
.paper-item {
  position: relative;
  width: min(var(--paper-card-size), 100%);
  transition: transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.26s ease;
  will-change: transform, filter;
  touch-action: none;
  user-select: none;
  -webkit-user-drag: none;
}
.paper-item:hover {
  transform: translateY(-10px) scale(1.035) rotateX(1deg);
  filter: drop-shadow(0 18px 18px rgba(31, 38, 62, 0.18));
  z-index: 3;
}
.paper-item.is-dragging {
  opacity: 0;
  pointer-events: none;
}
.paper-album.is-drag-active .paper-item:hover {
  transform: none;
}
.paper-card {
  aspect-ratio: 1 / 1;
  border-radius: 20px;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(255, 255, 255, 0.86);
  box-shadow:
    0 0 0 3px rgba(255, 255, 255, 0.62),
    0 0 0 6px var(--paper-accent, rgba(142, 125, 255, 0.5)),
    0 16px 26px -16px rgba(44, 51, 73, 0.46);
}
.paper-img,
:deep(.paper-img .el-image__inner) {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}
.paper-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(64, 58, 112, 0.32);
  font-size: 24px;
}
.paper-qty {
  position: absolute;
  top: -10px;
  right: -10px;
  min-width: 28px;
  height: 22px;
  padding: 0 7px;
  border-radius: 11px;
  background: linear-gradient(180deg, #ff8a5b, #f0603a);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 22px;
  text-align: center;
  z-index: 4;
}
.paper-official-dot {
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
  z-index: 4;
}
.paper-official-dot.is-official {
  background: #d4af37;
}
.paper-official-dot.is-doujin {
  background: #9c6dd6;
}
.paper-ghost {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  overflow: hidden;
  background: #fff;
  box-shadow:
    0 0 0 3px rgba(255, 255, 255, 0.72),
    0 0 0 6px var(--paper-accent, rgba(142, 125, 255, 0.5)),
    0 22px 36px -14px rgba(31, 34, 48, 0.46);
  transform: scale(1.06) rotate(0.6deg);
}
.paper-ghost-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

@keyframes paper-turn-next {
  0% {
    transform: rotateY(0deg) scaleX(1);
  }
  50% {
    transform: rotateY(-96deg) scaleX(0.985);
  }
  100% {
    transform: rotateY(-180deg) scaleX(1);
  }
}

@keyframes paper-turn-prev {
  0% {
    transform: rotateY(0deg) scaleX(1);
  }
  50% {
    transform: rotateY(96deg) scaleX(0.985);
  }
  100% {
    transform: rotateY(180deg) scaleX(1);
  }
}

@keyframes paper-turn-shadow {
  0%,
  100% {
    opacity: 0.24;
  }
  48% {
    opacity: 0.42;
  }
}

@keyframes paper-turn-sheen {
  0%,
  100% {
    opacity: 0.18;
  }
  50% {
    opacity: 0.54;
  }
}

@media (max-width: 768px) {
  .paper-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;
  }
  .paper-header-meta {
    width: 100%;
    justify-content: flex-start;
  }
  .paper-album {
    position: relative;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      "book book"
      "prev next";
    align-items: center;
    gap: 10px 12px;
    touch-action: pan-y;
  }
  .paper-page-button {
    position: static;
    justify-self: center;
    z-index: 2;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    box-shadow:
      0 14px 24px -18px rgba(31, 38, 62, 0.46),
      inset 0 1px 0 rgba(255, 255, 255, 0.86);
  }
  .paper-page-button:not(:disabled):hover {
    transform: translateY(-1px);
  }
  .paper-page-button:not(:disabled):active {
    transform: scale(0.94);
    background: rgba(255, 255, 255, 0.98);
  }
  .paper-page-button--prev {
    grid-area: prev;
    justify-self: end;
  }
  .paper-page-button--next {
    grid-area: next;
    justify-self: start;
  }
  .paper-book {
    --paper-book-padding: var(--paper-mobile-padding);
    --paper-mobile-card-size: min(40vw, 150px);
    --paper-mobile-gap: clamp(8px, 2.8vw, 12px);
    --paper-mobile-padding: clamp(10px, 3.2vw, 14px);
    --paper-turn-duration: 420ms;
    grid-template-columns: 1fr;
    grid-area: book;
    width: 100%;
    padding: var(--paper-mobile-padding);
    border-radius: 16px;
    background:
      radial-gradient(circle at 18% 8%, rgba(255, 255, 255, 0.82), transparent 24%),
      repeating-linear-gradient(90deg, rgba(142, 125, 255, 0.04) 0 1px, transparent 1px 16px),
      linear-gradient(135deg, #fbfcff 0%, #eef4ff 52%, #e3eaf8 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.78),
      0 18px 42px -32px rgba(40, 48, 74, 0.46);
  }
  .paper-book::before {
    display: none;
  }
  .paper-turn-layer {
    inset: var(--paper-mobile-padding);
    perspective: 900px;
  }
  .paper-turn-sheet {
    width: 100%;
    animation-duration: var(--paper-turn-duration);
  }
  .paper-turn-sheet::after {
    animation-duration: var(--paper-turn-duration);
    background:
      linear-gradient(100deg, rgba(31, 38, 62, 0.16), transparent 24%, rgba(255, 255, 255, 0.42) 62%, transparent),
      linear-gradient(130deg, transparent 20%, rgba(255, 255, 255, 0.22) 48%, transparent 76%);
  }
  .is-turning-next .paper-turn-sheet,
  .is-turning-prev .paper-turn-sheet {
    left: 0;
    right: auto;
    transform-origin: left center;
    animation-name: paper-mobile-turn-next;
  }
  .is-turning-prev .paper-turn-sheet {
    transform-origin: right center;
    animation-name: paper-mobile-turn-prev;
  }
  .paper-turn-shadow {
    opacity: 0.22;
    background:
      linear-gradient(90deg, rgba(31, 38, 62, 0.18), transparent 30%, rgba(31, 38, 62, 0.1)),
      radial-gradient(ellipse at center, rgba(31, 38, 62, 0.16), transparent 72%);
  }
  .paper-turn-page {
    padding: var(--paper-mobile-padding) var(--paper-mobile-padding) var(--paper-mobile-padding) calc(var(--paper-mobile-padding) + 14px);
    border-radius: 12px;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.62),
      0 16px 28px -22px rgba(31, 38, 62, 0.42);
  }
  .paper-turn-card {
    width: min(100%, var(--paper-mobile-card-size));
  }
  .paper-page {
    min-height: 0;
    padding: var(--paper-mobile-padding) var(--paper-mobile-padding) var(--paper-mobile-padding) calc(var(--paper-mobile-padding) + 14px);
    border-radius: 12px;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.58),
      inset 0 -16px 26px -28px rgba(31, 38, 62, 0.32);
  }
  .paper-page-ring {
    top: 18px;
    bottom: 18px;
    left: 9px;
    width: 7px;
    background:
      radial-gradient(circle, rgba(255, 255, 255, 0.9) 0 30%, transparent 33%) 0 0 / 7px 42px,
      linear-gradient(180deg, rgba(142, 125, 255, 0.2), rgba(212, 175, 55, 0.14));
  }
  .paper-pocket-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(3, auto);
    gap: var(--paper-mobile-gap);
  }
  .paper-pocket {
    min-height: 0;
    aspect-ratio: 1 / 1;
    padding: 5px;
    border-radius: 14px;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.22)),
      rgba(231, 238, 250, 0.38);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.68),
      inset 0 -10px 18px -18px rgba(59, 71, 102, 0.24);
  }
  .paper-item {
    width: min(100%, var(--paper-mobile-card-size));
    touch-action: pan-y;
    transition:
      transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
      filter 0.18s ease;
  }
  .paper-item:hover {
    transform: none;
    filter: none;
  }
  .paper-item:active {
    transform: scale(0.965);
    filter: drop-shadow(0 10px 12px rgba(31, 38, 62, 0.14));
  }
  .paper-card {
    border-radius: 15px;
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.66),
      0 0 0 4px var(--paper-accent, rgba(142, 125, 255, 0.42)),
      0 10px 18px -14px rgba(44, 51, 73, 0.36);
  }
  .paper-qty {
    top: -7px;
    right: -7px;
    min-width: 24px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    font-size: 11px;
    line-height: 20px;
  }
  .paper-official-dot {
    right: -4px;
    bottom: -4px;
    width: 10px;
    height: 10px;
  }
}

@keyframes paper-mobile-turn-next {
  0% {
    opacity: 1;
    transform: translateX(0) rotateY(0deg);
  }
  52% {
    opacity: 0.96;
    transform: translateX(-14%) rotateY(-18deg);
  }
  100% {
    opacity: 0;
    transform: translateX(-24%) rotateY(-8deg);
  }
}

@keyframes paper-mobile-turn-prev {
  0% {
    opacity: 1;
    transform: translateX(0) rotateY(0deg);
  }
  52% {
    opacity: 0.96;
    transform: translateX(14%) rotateY(18deg);
  }
  100% {
    opacity: 0;
    transform: translateX(24%) rotateY(8deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .paper-turn-sheet,
  .paper-turn-sheet::after {
    animation-duration: 1ms;
  }

  .paper-item {
    transition-duration: 1ms;
    filter: none;
  }

}
</style>
