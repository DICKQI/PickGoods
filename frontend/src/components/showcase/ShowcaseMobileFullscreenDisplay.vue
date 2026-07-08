<template>
  <div
    ref="rootRef"
    class="mobile-fullscreen-display"
    :class="[`is-${displayType}`, `density-${density}`, { 'is-drag-active': dragging }]"
    :data-test="`showcase-mobile-fullscreen-${displayType}`"
    @keydown.esc="emit('close')"
  >
    <header class="fullscreen-header">
      <button class="fullscreen-close" data-test="fullscreen-close-button" type="button" @click="emit('close')">
        关闭
      </button>
      <div class="fullscreen-title-block">
        <span class="fullscreen-kicker">{{ displayType === 'round' ? 'ROUND BADGE SHELF' : 'PAPER ARCHIVE ALBUM' }}</span>
        <h2 class="fullscreen-title">{{ displayTitle }}</h2>
      </div>
      <span class="fullscreen-count">{{ items.length }} {{ displayType === 'round' ? '枚' : '张' }}</span>
    </header>

    <div class="fullscreen-toolbar">
      <div class="density-toggle" aria-label="显示密度">
        <button
          class="density-button"
          :class="{ 'is-active': density === 'large' }"
          data-test="fullscreen-density-large"
          type="button"
          @click="density = 'large'"
        >
          大图
        </button>
        <button
          class="density-button"
          :class="{ 'is-active': density === 'dense' }"
          data-test="fullscreen-density-dense"
          type="button"
          @click="density = 'dense'"
        >
          更多
        </button>
      </div>

      <div v-if="displayType === 'paper'" class="page-controls">
        <button
          class="page-button"
          data-test="fullscreen-prev-page"
          type="button"
          :disabled="currentPage <= 0"
          @click="goPrev"
        >
          上一页
        </button>
        <span class="page-indicator" data-test="fullscreen-page-indicator">{{ currentPage + 1 }} / {{ totalPages }}</span>
        <button
          class="page-button"
          data-test="fullscreen-next-page"
          type="button"
          :disabled="currentPage >= totalPages - 1"
          @click="goNext"
        >
          下一页
        </button>
      </div>
    </div>

    <main class="fullscreen-body" @touchstart="onTouchStart" @touchend="onTouchEnd">
      <div v-if="displayType === 'round'" class="round-fullscreen-grid">
        <div
          v-for="item in localOrder"
          :key="item.id"
          class="fullscreen-round-item"
          data-test="fullscreen-round-item"
          :data-id="item.id"
          :class="{ 'is-dragging': dragItemId === item.id }"
          :style="[
            { cursor: readonly ? 'default' : 'grab' },
            item.goods.category?.color_tag ? { '--item-accent': item.goods.category.color_tag } : {},
          ]"
          @pointerdown="onPointerDown($event, item)"
          @click="onItemClick(item)"
          @contextmenu.prevent.stop="!readonly && emit('goodsContextMenuFromDom', item.goods.id, $event)"
          @dragstart.prevent
        >
          <div class="round-photo" :title="item.goods.name">
            <WatermarkImage
              v-if="readonly && item.goods.main_photo"
              :src="item.goods.main_photo"
              :alt="item.goods.name"
              :user-id="'ID:' + item.goods.id.slice(0, 8)"
              fit="cover"
              class="fullscreen-img"
            />
            <el-image
              v-else-if="item.goods.main_photo"
              :src="item.goods.main_photo"
              :alt="item.goods.name"
              fit="cover"
              class="fullscreen-img"
              loading="lazy"
            >
              <template #error>
                <div class="fullscreen-placeholder">无图</div>
              </template>
            </el-image>
            <div v-else class="fullscreen-placeholder">无图</div>
          </div>
          <span v-if="item.goods.quantity > 1" class="fullscreen-qty">x{{ item.goods.quantity }}</span>
          <span class="fullscreen-official-dot" :class="item.goods.is_official ? 'is-official' : 'is-doujin'" />
        </div>
      </div>

      <div v-else class="paper-fullscreen-shell">
        <div class="paper-fullscreen-grid">
          <div
            v-for="item in visiblePaperItems"
            :key="item.id"
            class="fullscreen-paper-item"
            data-test="fullscreen-paper-item"
            :data-id="item.id"
            :class="{ 'is-dragging': dragItemId === item.id }"
            :style="[
              { cursor: readonly ? 'default' : 'grab' },
              item.goods.category?.color_tag ? { '--item-accent': item.goods.category.color_tag } : {},
            ]"
            @pointerdown="onPointerDown($event, item)"
            @click="onItemClick(item)"
            @contextmenu.prevent.stop="!readonly && emit('goodsContextMenuFromDom', item.goods.id, $event)"
            @dragstart.prevent
          >
            <div class="paper-photo" :title="item.goods.name">
              <WatermarkImage
                v-if="readonly && item.goods.main_photo"
                :src="item.goods.main_photo"
                :alt="item.goods.name"
                :user-id="'ID:' + item.goods.id.slice(0, 8)"
                fit="contain"
                class="fullscreen-img"
              />
              <el-image
                v-else-if="item.goods.main_photo"
                :src="item.goods.main_photo"
                :alt="item.goods.name"
                fit="contain"
                class="fullscreen-img"
                loading="lazy"
              >
                <template #error>
                  <div class="fullscreen-placeholder">无图</div>
                </template>
              </el-image>
              <div v-else class="fullscreen-placeholder">无图</div>
            </div>
            <span v-if="item.goods.quantity > 1" class="fullscreen-qty">x{{ item.goods.quantity }}</span>
            <span class="fullscreen-official-dot" :class="item.goods.is_official ? 'is-official' : 'is-doujin'" />
          </div>
        </div>
      </div>
    </main>

    <Teleport to="body">
      <div
        v-if="dragGhost"
        class="fullscreen-ghost"
        :style="{
          left: dragGhost.x + 'px',
          top: dragGhost.y + 'px',
          width: dragGhost.width + 'px',
          height: dragGhost.height + 'px',
          borderRadius: dragGhost.radius,
          '--item-accent': dragGhost.ring,
        }"
      >
        <img v-if="dragGhost.src" :src="dragGhost.src" :alt="dragGhost.alt" class="fullscreen-ghost-img" />
        <div v-else class="fullscreen-placeholder">无图</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WatermarkImage from '@/components/WatermarkImage.vue'
import { useShowcaseDisplayDragSort } from './useShowcaseDisplayDragSort'
import type { GoodsListItem, ShowcaseGoods } from '@/api/types'

type FullscreenDisplayType = 'round' | 'paper'
type FullscreenDensity = 'large' | 'dense'

const props = withDefaults(defineProps<{
  displayType: FullscreenDisplayType
  items: ShowcaseGoods[]
  showcaseId?: string | null
  readonly?: boolean
  initialDensity?: FullscreenDensity
}>(), {
  showcaseId: null,
  readonly: false,
  initialDensity: 'large',
})

const emit = defineEmits<{
  close: []
  openGoods: [goods: GoodsListItem]
  goodsContextMenuFromDom: [goodsId: string, event: MouseEvent]
}>()

const rootRef = ref<HTMLElement | null>(null)
const density = ref<FullscreenDensity>(props.initialDensity)
const currentPage = ref(0)
const viewportHeight = ref(typeof window === 'undefined' ? 760 : window.innerHeight)
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchStartAt = ref(0)
let previousBodyOverflow = ''

const displayTitle = computed(() => (props.displayType === 'round' ? '吧唧展架' : '纸制品收纳册'))
const showcaseIdRef = computed(() => props.showcaseId)
const readonlyRef = computed(() => props.readonly)
const itemsRef = computed(() => props.items)
const columns = computed(() => (density.value === 'dense' ? 4 : 3))
const paperRows = computed(() => {
  const chromeHeight = 156
  const slotHeight = density.value === 'dense' ? 94 : 122
  return Math.max(3, Math.floor((viewportHeight.value - chromeHeight) / slotHeight))
})
const paperItemsPerPage = computed(() => columns.value * paperRows.value)

const updateViewport = () => {
  viewportHeight.value = window.innerHeight || viewportHeight.value
}

const {
  localOrder,
  dragging,
  dragItemId,
  dragGhost,
  onPointerDown,
  shouldSuppressClick,
  cleanupDrag,
} = useShowcaseDisplayDragSort({
  items: itemsRef,
  showcaseId: showcaseIdRef,
  readonly: readonlyRef,
  itemSelector: props.displayType === 'round' ? '.fullscreen-round-item' : '.fullscreen-paper-item',
  defaultRing: props.displayType === 'round' ? '#d4af37' : '#8e7dff',
  errorMessage: props.displayType === 'round'
    ? '吧唧排序更新失败，已恢复'
    : '纸制品排序更新失败，已恢复',
  ghostSize: () => {
    if (props.displayType === 'round') {
      const size = density.value === 'dense' ? 86 : 112
      return { width: size, height: size, radius: '50%' }
    }
    const size = density.value === 'dense' ? 92 : 116
    return { width: size, height: size, radius: '16px' }
  },
  onHoverEdge: (x, y) => {
    if (props.displayType !== 'paper') return
    const rect = rootRef.value?.getBoundingClientRect()
    if (!rect || y < rect.top || y > rect.bottom) return
    const edge = Math.min(72, rect.width * 0.18)
    if (x < rect.left + edge) goPrev()
    if (x > rect.right - edge) goNext()
  },
})

const totalPages = computed(() => {
  if (props.displayType !== 'paper') return 1
  return Math.max(1, Math.ceil(localOrder.value.length / paperItemsPerPage.value))
})

const visiblePaperItems = computed(() => {
  const start = currentPage.value * paperItemsPerPage.value
  return localOrder.value.slice(start, start + paperItemsPerPage.value)
})

const goPrev = () => {
  if (currentPage.value > 0) currentPage.value -= 1
}

const goNext = () => {
  if (currentPage.value < totalPages.value - 1) currentPage.value += 1
}

const onItemClick = (item: ShowcaseGoods) => {
  if (shouldSuppressClick()) return
  if (props.readonly) return
  emit('openGoods', item.goods)
}

const onTouchStart = (event: TouchEvent) => {
  if (props.displayType !== 'paper' || dragging.value) return
  const touch = event.touches[0]
  if (!touch) return
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
  touchStartAt.value = Date.now()
}

const onTouchEnd = (event: TouchEvent) => {
  if (props.displayType !== 'paper' || !touchStartAt.value) return
  const touch = event.changedTouches[0]
  if (!touch) return
  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value
  const elapsed = Date.now() - touchStartAt.value
  touchStartAt.value = 0
  if (Math.abs(deltaX) <= 48) return
  if (Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return
  if (elapsed > 900) return
  if (deltaX < 0) goNext()
  else goPrev()
}

watch(totalPages, (next) => {
  if (currentPage.value >= next) currentPage.value = Math.max(0, next - 1)
})

watch(() => props.displayType, () => {
  currentPage.value = 0
})

watch(density, () => {
  currentPage.value = Math.min(currentPage.value, totalPages.value - 1)
})

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  updateViewport()
  window.addEventListener('resize', updateViewport)
  rootRef.value?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('resize', updateViewport)
  cleanupDrag()
})
</script>

<style scoped>
.mobile-fullscreen-display {
  --fullscreen-columns: 3;
  --fullscreen-body-bg:
    linear-gradient(180deg, #f8f3e4 0%, #fffaf0 100%);
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  color: #263238;
  background:
    radial-gradient(circle at 18% 8%, rgba(255, 255, 255, 0.16), transparent 28%),
    linear-gradient(180deg, #14130f 0%, #232016 100%);
  outline: none;
}
.mobile-fullscreen-display.density-dense {
  --fullscreen-columns: 4;
}
.mobile-fullscreen-display.is-paper {
  --fullscreen-body-bg:
    linear-gradient(180deg, #f3f6ff 0%, #fbfcff 100%);
  background:
    radial-gradient(circle at 18% 8%, rgba(255, 255, 255, 0.16), transparent 28%),
    linear-gradient(180deg, #19192a 0%, #262447 100%);
}
.fullscreen-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 8px;
  color: #fffaf0;
}
.fullscreen-close,
.fullscreen-count,
.density-button,
.page-button {
  border: 0;
  font: inherit;
}
.fullscreen-close,
.fullscreen-count {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #fffaf0;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.fullscreen-close {
  height: 34px;
  padding: 0 12px;
}
.fullscreen-title-block {
  min-width: 0;
  text-align: center;
}
.fullscreen-kicker {
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
  opacity: 0.7;
}
.fullscreen-title {
  margin: 2px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  line-height: 1.2;
}
.fullscreen-count {
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 800;
}
.fullscreen-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px 10px;
  color: #fffaf0;
}
.density-toggle,
.page-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}
.density-toggle {
  padding: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.density-button,
.page-button {
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  color: inherit;
  background: transparent;
}
.density-button.is-active,
.page-button:not(:disabled) {
  background: rgba(255, 255, 255, 0.88);
  color: #3c2d12;
}
.is-paper .density-button.is-active,
.is-paper .page-button:not(:disabled) {
  color: #262447;
}
.page-button:disabled {
  opacity: 0.42;
}
.page-indicator {
  min-width: 44px;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
}
.fullscreen-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  background: var(--fullscreen-body-bg);
  border-radius: 22px 22px 0 0;
  padding: 10px 10px calc(env(safe-area-inset-bottom, 0px) + 14px);
  -webkit-overflow-scrolling: touch;
}
.round-fullscreen-grid,
.paper-fullscreen-grid {
  display: grid;
  grid-template-columns: repeat(var(--fullscreen-columns), minmax(0, 1fr));
  gap: 12px 10px;
}
.density-dense .round-fullscreen-grid,
.density-dense .paper-fullscreen-grid {
  gap: 9px 7px;
}
.fullscreen-round-item,
.fullscreen-paper-item {
  position: relative;
  min-width: 0;
  touch-action: none;
  user-select: none;
  -webkit-user-drag: none;
  transition: transform 0.18s ease;
}
.fullscreen-round-item:active,
.fullscreen-paper-item:active {
  transform: scale(0.97);
}
.fullscreen-round-item.is-dragging,
.fullscreen-paper-item.is-dragging {
  opacity: 0;
  pointer-events: none;
}
.round-photo,
.paper-photo {
  overflow: hidden;
  background: #fff;
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.9),
    0 0 0 4px var(--item-accent, rgba(212, 175, 55, 0.8)),
    0 14px 22px -16px rgba(27, 21, 11, 0.5);
}
.round-photo {
  aspect-ratio: 1 / 1;
  border-radius: 50%;
}
.paper-fullscreen-shell {
  min-height: 100%;
  padding: 10px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(245, 248, 255, 0.72)),
    repeating-linear-gradient(90deg, rgba(142, 125, 255, 0.055) 0 1px, transparent 1px 14px);
}
.paper-photo {
  aspect-ratio: 1 / 1;
  border-radius: 14px;
}
.density-large .paper-photo {
  border-radius: 17px;
}
.fullscreen-img,
:deep(.fullscreen-img .el-image__inner) {
  display: block;
  width: 100%;
  height: 100%;
}
:deep(.round-photo .el-image__inner) {
  object-fit: cover;
}
:deep(.paper-photo .el-image__inner) {
  object-fit: contain;
}
.fullscreen-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(38, 50, 56, 0.38);
  font-size: 12px;
  font-weight: 800;
}
.fullscreen-qty {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 22px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: linear-gradient(180deg, #ff8a5b, #f0603a);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
}
.fullscreen-official-dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
}
.fullscreen-official-dot.is-official {
  background: #d4af37;
}
.fullscreen-official-dot.is-doujin {
  background: #9c6dd6;
}
.fullscreen-ghost {
  position: fixed;
  z-index: 2300;
  pointer-events: none;
  overflow: hidden;
  background: #fff;
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.9),
    0 0 0 5px var(--item-accent, rgba(212, 175, 55, 0.8)),
    0 18px 28px -12px rgba(20, 17, 12, 0.45);
  transform: scale(1.05);
}
.fullscreen-ghost-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.is-paper .fullscreen-ghost-img {
  object-fit: contain;
}

@media (min-width: 769px) {
  .mobile-fullscreen-display {
    display: none;
  }
}
</style>
