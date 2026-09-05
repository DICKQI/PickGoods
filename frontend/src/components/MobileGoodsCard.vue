<template>
  <article
    class="mobile-goods-card"
    :class="{ 'is-selectable': selectable, 'is-selected': selected }"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
    @touchstart.stop="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchEnd"
    @touchmove="handleTouchMove"
  >
    <div class="mobile-image-wrapper">
      <SquarePaddedImage
        :src="goods.main_photo"
        :alt="goods.name"
        :watermark="enableWatermark"
        :watermark-user-id="'ID:' + goods.id.slice(0, 8)"
        loading="lazy"
        class="mobile-main-image"
      />

      <span class="mobile-attr-tag" :class="tagClass">
        <el-icon class="mobile-tag-icon">
          <CircleCheck v-if="goods.is_official" />
          <Brush v-else />
        </el-icon>
        {{ tagText }}
      </span>

      <span v-if="goods.quantity > 1" class="mobile-quantity-badge">
        x{{ goods.quantity }}
      </span>

      <button
        v-if="selectable"
        class="mobile-selection-indicator"
        :class="{ 'is-selected': selected }"
        type="button"
        aria-label="选择谷子"
        @click.stop="handleSelectClick"
      >
        <el-icon v-if="selected"><Check /></el-icon>
      </button>

      <button
        v-else-if="showMenu"
        class="mobile-menu-button"
        type="button"
        aria-label="更多操作"
        @click.stop="handleMenuButtonClick"
      >
        <el-icon><MoreFilled /></el-icon>
      </button>
    </div>

    <div class="mobile-card-content">
      <h3
        class="mobile-goods-title"
        :title="goods.name"
      >
        {{ goods.name }}
      </h3>

      <p class="mobile-goods-meta" :title="metaTitle">
        <span class="mobile-goods-ip">{{ goods.ip.name }}</span>
        <span v-if="characterNames" class="mobile-goods-meta-separator" aria-hidden="true">·</span>
        <span
          v-if="characterNames"
          ref="characterHostRef"
          class="mobile-goods-characters"
          :class="{ 'is-scrollable': isCharacterScrollable }"
          :style="{ '--character-scroll-duration': characterScrollDuration }"
        >
          <span class="mobile-character-clip">
            <span ref="characterTextRef" class="mobile-character-text">{{ characterNames }}</span>
            <span class="mobile-character-track" aria-hidden="true">
              <span class="mobile-character-scroll-text">{{ characterNames }}</span>
              <span class="mobile-character-scroll-text">{{ characterNames }}</span>
            </span>
          </span>
        </span>
      </p>

      <div class="mobile-card-footer">
        <span class="mobile-category-chip" :style="categoryStyle">
          {{ goods.category.name }}
        </span>
        <button
          v-if="locationName"
          class="mobile-location-chip"
          type="button"
          @click.stop="handleLocationClick"
        >
          <el-icon><Location /></el-icon>
          <span>{{ locationName }}</span>
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Brush, Check, CircleCheck, Location, MoreFilled } from '@element-plus/icons-vue'
import SquarePaddedImage from '@/components/SquarePaddedImage.vue'
import { getReadableMarqueeDuration } from '@/utils/readableMarquee'
import type { GoodsListItem } from '@/api/types'

interface Props {
  goods: GoodsListItem
  enableWatermark?: boolean
  selectable?: boolean
  selected?: boolean
  showMenu?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enableWatermark: false,
  selectable: false,
  selected: false,
  showMenu: true,
})

const emit = defineEmits<{
  click: [goods: GoodsListItem]
  select: [goods: GoodsListItem]
  locationClick: [path: string]
  contextMenu: [{ goods: GoodsListItem; x: number; y: number }]
}>()

const isLongPress = ref(false)
const characterHostRef = ref<HTMLElement | null>(null)
const characterTextRef = ref<HTMLElement | null>(null)
const isCharacterScrollable = ref(false)
const characterScrollDuration = ref('8s')
let longPressTimer: number | null = null
let longPressStartPoint: { x: number; y: number } | null = null
let latestTouchPoint: { x: number; y: number } | null = null
let resizeObserver: ResizeObserver | null = null
const CHARACTER_SCROLL_GAP_PX = 16

const LONG_PRESS_DELAY = 600
const LONG_PRESS_MOVE_TOLERANCE = 12

const selectable = computed(() => props.selectable)
const selected = computed(() => props.selected)
const showMenu = computed(() => props.showMenu && !selectable.value)

const tagText = computed(() => (props.goods.is_official ? '官谷' : '同人'))
const tagClass = computed(() => ({
  'tag-official': props.goods.is_official,
  'tag-unofficial': !props.goods.is_official,
}))

const characterNames = computed(() =>
  props.goods.characters.map(character => character.name).join('、'),
)

const metaTitle = computed(() => {
  if (!characterNames.value) return props.goods.ip.name
  return `${props.goods.ip.name} · ${characterNames.value}`
})

const locationName = computed(() => {
  if (!props.goods.location_path) return ''
  return props.goods.location_path.split('/').filter(Boolean).pop() ?? ''
})

const categoryStyle = computed(() => {
  const color = props.goods.category.color_tag || '#D4AF37'
  return {
    color,
    backgroundColor: `${color}14`,
    borderColor: `${color}30`,
  }
})

const syncCharacterOverflow = async () => {
  await nextTick()
  const textEl = characterTextRef.value

  if (!textEl) {
    isCharacterScrollable.value = false
    characterScrollDuration.value = '8s'
    return
  }

  const isOverflowing = textEl.scrollWidth > textEl.clientWidth + 1
  isCharacterScrollable.value = isOverflowing
  characterScrollDuration.value = isOverflowing
    ? getReadableMarqueeDuration(textEl.scrollWidth + CHARACTER_SCROLL_GAP_PX)
    : '8s'
}

const handleClick = () => {
  if (isLongPress.value) {
    isLongPress.value = false
    return
  }

  if (selectable.value) {
    emit('select', props.goods)
    return
  }

  emit('click', props.goods)
}

const handleSelectClick = () => {
  emit('select', props.goods)
}

const handleLocationClick = () => {
  if (selectable.value) {
    emit('select', props.goods)
    return
  }
  emit('locationClick', props.goods.location_path)
}

const handleMenuButtonClick = (event: MouseEvent) => {
  if (selectable.value) return
  emit('contextMenu', { goods: props.goods, x: event.clientX, y: event.clientY })
}

const handleContextMenu = (event: MouseEvent) => {
  if (selectable.value) return
  emit('contextMenu', { goods: props.goods, x: event.clientX, y: event.clientY })
}

const clearLongPressTimer = () => {
  if (longPressTimer === null) return
  window.clearTimeout(longPressTimer)
  longPressTimer = null
}

const handleTouchStart = (event: TouchEvent) => {
  if (selectable.value) return
  clearLongPressTimer()
  isLongPress.value = false

  const touch = event.touches[0]
  if (!touch) return

  longPressStartPoint = { x: touch.clientX, y: touch.clientY }
  latestTouchPoint = longPressStartPoint
  longPressTimer = window.setTimeout(() => {
    isLongPress.value = true
    const currentTouch = latestTouchPoint ?? longPressStartPoint ?? { x: touch.clientX, y: touch.clientY }
    emit('contextMenu', { goods: props.goods, x: currentTouch.x, y: currentTouch.y })
    longPressTimer = null
  }, LONG_PRESS_DELAY)
}

const handleTouchEnd = () => {
  clearLongPressTimer()
  longPressStartPoint = null
  latestTouchPoint = null
}

const handleTouchMove = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch || event.touches.length > 1 || !longPressStartPoint) {
    clearLongPressTimer()
    longPressStartPoint = null
    latestTouchPoint = null
    return
  }

  latestTouchPoint = { x: touch.clientX, y: touch.clientY }
  const distance = Math.hypot(
    touch.clientX - longPressStartPoint.x,
    touch.clientY - longPressStartPoint.y,
  )

  // Android WebView can report a few pixels of jitter while the finger is held still.
  if (distance > LONG_PRESS_MOVE_TOLERANCE) {
    clearLongPressTimer()
    longPressStartPoint = null
    latestTouchPoint = null
  }
}

onMounted(() => {
  void syncCharacterOverflow()

  if (typeof ResizeObserver === 'undefined') return

  resizeObserver = new ResizeObserver(() => {
    void syncCharacterOverflow()
  })

  if (characterHostRef.value) {
    resizeObserver.observe(characterHostRef.value)
  }
  if (characterTextRef.value) {
    resizeObserver.observe(characterTextRef.value)
  }
})

onBeforeUnmount(() => {
  clearLongPressTimer()
  resizeObserver?.disconnect()
})

watch(characterNames, () => {
  void syncCharacterOverflow()
})
</script>

<style scoped>
.mobile-goods-card {
  --mobile-card-gold: #D4AF37;
  --mobile-card-text: #1f2937;
  --mobile-card-subtle: #64748b;

  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  height: auto;
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.mobile-goods-card:active {
  transform: scale(0.985);
}

.mobile-goods-card.is-selected {
  border-color: var(--mobile-card-gold);
  box-shadow:
    0 0 0 2px rgba(212, 175, 55, 0.22),
    0 8px 18px rgba(15, 23, 42, 0.08);
}

.mobile-image-wrapper {
  position: relative;
  width: calc(100% - 10px);
  margin: 5px 5px 0;
  aspect-ratio: 1.12 / 1;
  overflow: hidden;
  border-radius: 11px;
  background: linear-gradient(135deg, #f8fafc, #eef2f7);
}

.mobile-main-image {
  width: 100%;
  height: 100%;
}

.mobile-main-image :deep(.square-padded-image) {
  height: 100%;
  aspect-ratio: auto;
  background: transparent;
}

.mobile-main-image :deep(.square-padded-image__media),
.mobile-main-image :deep(.square-padded-image__placeholder) {
  border-radius: inherit;
}

.mobile-attr-tag,
.mobile-quantity-badge,
.mobile-menu-button,
.mobile-selection-indicator {
  position: absolute;
  z-index: 2;
}

.mobile-attr-tag {
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: calc(100% - 58px);
  min-height: 22px;
  padding: 3px 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.46);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(10px) saturate(1.24);
  -webkit-backdrop-filter: blur(10px) saturate(1.24);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.1);
}

.mobile-tag-icon {
  flex: none;
  font-size: 11px;
}

.tag-official {
  background: rgba(255, 249, 232, 0.46);
  color: #a8790e;
}

.tag-unofficial {
  background: rgba(245, 243, 255, 0.46);
  color: #6657f0;
}

.mobile-quantity-badge {
  right: 6px;
  bottom: 6px;
  min-width: 24px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  line-height: 20px;
  text-align: center;
}

.mobile-menu-button,
.mobile-selection-indicator {
  top: 6px;
  right: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 999px;
  color: #334155;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.16);
}

.mobile-menu-button .el-icon,
.mobile-selection-indicator .el-icon {
  font-size: 15px;
}

.mobile-selection-indicator {
  background: rgba(15, 23, 42, 0.36);
  color: #ffffff;
}

.mobile-selection-indicator.is-selected {
  background: var(--mobile-card-gold);
}

.mobile-card-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 7px 8px 8px;
}

.mobile-goods-title {
  display: -webkit-box;
  margin: 0 0 3px;
  overflow: hidden;
  color: var(--mobile-card-text);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  white-space: normal;
}

.mobile-goods-meta {
  display: flex;
  min-width: 0;
  margin: 0 0 6px;
  overflow: hidden;
  color: var(--mobile-card-subtle);
  font-size: 11px;
  line-height: 1.25;
  white-space: nowrap;
}

.mobile-goods-ip {
  /* IP 是识别主信息，不能被角色名称挤压或省略。 */
  flex: 0 0 auto;
  min-width: max-content;
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}

.mobile-goods-meta-separator {
  flex: none;
  margin: 0 4px;
  color: #cbd5e1;
}

.mobile-goods-characters {
  position: relative;
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.mobile-character-clip {
  position: relative;
  display: block;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.mobile-character-text {
  display: block;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-character-track {
  position: absolute;
  top: 0;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 16px;
  max-width: none;
  opacity: 0;
  white-space: nowrap;
  pointer-events: none;
}

.mobile-character-scroll-text {
  flex: 0 0 auto;
}

.mobile-goods-characters.is-scrollable .mobile-character-text {
  animation: mobileCharacterEllipsis var(--character-scroll-duration, 8s) ease-in-out infinite;
}

.mobile-goods-characters.is-scrollable .mobile-character-track {
  animation: mobileCharacterScroll var(--character-scroll-duration, 8s) ease-in-out infinite;
  will-change: transform, opacity;
}

@keyframes mobileCharacterEllipsis {
  0%,
  18%,
  94%,
  100% {
    opacity: 1;
  }

  24%,
  88% {
    opacity: 0;
  }
}

@keyframes mobileCharacterScroll {
  0%,
  18% {
    opacity: 0;
    transform: translateX(0);
  }

  24% {
    opacity: 1;
    transform: translateX(0);
  }

  88% {
    opacity: 1;
    transform: translateX(calc(-50% - 8px));
  }

  94%,
  100% {
    opacity: 0;
    transform: translateX(calc(-50% - 8px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-goods-characters.is-scrollable .mobile-character-text,
  .mobile-goods-characters.is-scrollable .mobile-character-track {
    animation: none;
  }
}

.mobile-card-footer {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-top: auto;
}

.mobile-category-chip,
.mobile-location-chip {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  height: 22px;
  border: 1px solid transparent;
  border-radius: 7px;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.mobile-category-chip {
  flex: 0 1 auto;
  max-width: 58%;
  padding: 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-location-chip {
  flex: 1 1 auto;
  justify-content: flex-end;
  gap: 2px;
  padding: 0;
  border: 0;
  color: #64748b;
  background: transparent;
}

.mobile-location-chip .el-icon {
  flex: none;
  font-size: 11px;
}

.mobile-location-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
