<template>
  <section class="paper-section display-section">
    <div class="paper-header" data-test="paper-section-title">
      <div class="section-heading-copy">
        <span class="section-kicker">Paper archive album</span>
        <h2 class="paper-title">纸制品收纳册</h2>
      </div>
      <div class="paper-header-meta">
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
import { ArrowLeft, ArrowRight, Picture } from '@element-plus/icons-vue'
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
  goodsContextMenuFromDom: [goodsId: string, event: MouseEvent]
}>()

type TurnDirection = 'next' | 'prev'
const pageTurnDurationMs = 520
const albumRef = ref<HTMLElement | null>(null)
const currentSpread = ref(0)
const displayedSpread = ref(0)
const turnFromSpread = ref<number | null>(null)
const turnToSpread = ref<number | null>(null)
const turnDirection = ref<TurnDirection | null>(null)
const isPageTurning = ref(false)
const isMobile = ref(false)
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

const slotsPerPage = computed(() => 4)
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
  pageTurnTimer = window.setTimeout(finishPageTurn, pageTurnDurationMs)
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
    return mobile ? { width: 128, height: 128, radius: '14px' } : { width: 168, height: 168, radius: '16px' }
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
.paper-header {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.paper-title {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
  color: rgba(38, 50, 56, 0.84);
  margin: 0;
}
.paper-header-meta {
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.paper-count,
.paper-page-indicator {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 800;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(142, 125, 255, 0.1);
  border: 1px solid rgba(142, 125, 255, 0.18);
  color: rgba(64, 58, 112, 0.68);
}

.paper-album {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 14px;
}
.paper-page-button {
  width: 40px;
  height: 56px;
  border: 1px solid rgba(142, 125, 255, 0.18);
  border-radius: 999px;
  color: rgba(64, 58, 112, 0.72);
  background: rgba(255, 255, 255, 0.78);
  cursor: pointer;
}
.paper-page-button:disabled {
  cursor: default;
  opacity: 0.38;
}

.paper-book {
  --paper-book-padding: 20px;
  --paper-turn-duration: 520ms;
  min-width: 0;
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  max-width: min(1120px, 100%);
  margin: 0 auto;
  border-radius: 20px;
  padding: var(--paper-book-padding);
  overflow: hidden;
  perspective: 1800px;
  background:
    repeating-linear-gradient(90deg, rgba(142, 125, 255, 0.045) 0 1px, transparent 1px 18px),
    linear-gradient(135deg, #fbfcff 0%, #eef4ff 48%, #e3eaf8 100%);
  border: 1px solid rgba(142, 125, 255, 0.22);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 22px 54px -34px rgba(40, 48, 74, 0.42);
}
.paper-book::before {
  content: '';
  position: absolute;
  top: var(--paper-book-padding);
  bottom: var(--paper-book-padding);
  left: calc(50% - 1px);
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(142, 125, 255, 0.18), rgba(212, 175, 55, 0.12), rgba(142, 125, 255, 0.2));
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
  animation-timing-function: cubic-bezier(0.22, 0.72, 0.22, 1);
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
  background: linear-gradient(90deg, rgba(34, 29, 62, 0.2), transparent 22%, rgba(255, 255, 255, 0.36) 72%, transparent);
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
    linear-gradient(90deg, rgba(31, 38, 62, 0.22), transparent 18%, transparent 76%, rgba(31, 38, 62, 0.14)),
    radial-gradient(ellipse at center, rgba(31, 38, 62, 0.18), transparent 68%);
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
  padding: 22px 20px 22px 40px;
  border-radius: 5px 16px 16px 5px;
  background:
    repeating-linear-gradient(0deg, rgba(142, 125, 255, 0.035) 0 1px, transparent 1px 18px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(246, 249, 255, 0.88));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.64),
    0 24px 44px -26px rgba(31, 38, 62, 0.52);
}
.is-turning-prev .paper-turn-page {
  border-radius: 16px 5px 5px 16px;
}
.paper-turn-card {
  width: min(168px, 100%);
}
.paper-turn-card .paper-card {
  width: 100%;
}
.paper-page {
  position: relative;
  z-index: 1;
  min-height: 440px;
  padding: 22px 20px 22px 40px;
  border-radius: 16px 5px 5px 16px;
  background:
    repeating-linear-gradient(0deg, rgba(142, 125, 255, 0.035) 0 1px, transparent 1px 18px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(246, 249, 255, 0.74));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.58);
}
.paper-page--right {
  border-radius: 5px 16px 16px 5px;
}
.paper-page-ring {
  position: absolute;
  top: 22px;
  bottom: 22px;
  left: 14px;
  width: 9px;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.9) 0 32%, transparent 34%) 0 0 / 9px 56px,
    linear-gradient(180deg, rgba(142, 125, 255, 0.28), rgba(212, 175, 55, 0.2));
}
.paper-pocket-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.paper-pocket {
  min-height: 188px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid rgba(142, 125, 255, 0.16);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.28)),
    rgba(231, 238, 250, 0.46);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    inset 0 -10px 18px -16px rgba(59, 71, 102, 0.3);
}
.paper-pocket.is-empty {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.18)),
    rgba(231, 238, 250, 0.28);
}
.paper-item {
  position: relative;
  width: min(168px, 100%);
  transition: transform 0.22s ease;
  touch-action: none;
  user-select: none;
  -webkit-user-drag: none;
}
.paper-item:hover {
  transform: translateY(-4px);
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
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(255, 255, 255, 0.86);
  box-shadow:
    0 0 0 3px rgba(255, 255, 255, 0.62),
    0 0 0 5px var(--paper-accent, rgba(142, 125, 255, 0.5)),
    0 10px 18px -12px rgba(44, 51, 73, 0.42);
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
  top: -8px;
  right: -8px;
  min-width: 22px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: linear-gradient(180deg, #ff8a5b, #f0603a);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  z-index: 4;
}
.paper-official-dot {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid #fff;
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
    0 0 0 5px var(--paper-accent, rgba(142, 125, 255, 0.5)),
    0 14px 26px -10px rgba(31, 34, 48, 0.42);
  transform: scale(1.04);
}
.paper-ghost-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

@keyframes paper-turn-next {
  0% {
    transform: rotateY(0deg);
  }
  100% {
    transform: rotateY(-180deg);
  }
}

@keyframes paper-turn-prev {
  0% {
    transform: rotateY(0deg);
  }
  100% {
    transform: rotateY(180deg);
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
  }
  .paper-album {
    grid-template-columns: 32px minmax(0, 1fr) 32px;
    gap: 8px;
  }
  .paper-page-button {
    width: 32px;
    height: 46px;
  }
  .paper-book {
    --paper-book-padding: 12px;
    grid-template-columns: 1fr;
    padding: 10px;
    border-radius: 14px;
    background:
      repeating-linear-gradient(90deg, rgba(142, 125, 255, 0.04) 0 1px, transparent 1px 16px),
      linear-gradient(135deg, #fbfcff 0%, #eef4ff 52%, #e3eaf8 100%);
  }
  .paper-book::before {
    display: none;
  }
  .paper-turn-sheet {
    width: 100%;
  }
  .is-turning-next .paper-turn-sheet,
  .is-turning-prev .paper-turn-sheet {
    left: 0;
    right: auto;
    transform-origin: left center;
  }
  .is-turning-prev .paper-turn-sheet {
    transform-origin: right center;
  }
  .paper-turn-page {
    padding: 16px 14px 16px 30px;
    border-radius: 12px;
  }
  .paper-turn-card {
    width: min(128px, 100%);
  }
  .paper-page {
    min-height: 380px;
    padding: 16px 14px 16px 30px;
    border-radius: 12px;
  }
  .paper-pocket-grid {
    gap: 12px;
  }
  .paper-pocket {
    min-height: 156px;
  }
  .paper-item {
    width: min(128px, 100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .paper-turn-sheet,
  .paper-turn-sheet::after {
    animation-duration: 1ms;
  }

  .paper-item {
    transition-duration: 1ms;
  }
}
</style>
