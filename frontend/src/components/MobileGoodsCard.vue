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
        ref="titleHostRef"
        class="mobile-goods-title"
        :class="{ 'is-overflowing': titleOverflowing }"
        :title="goods.name"
      >
        <span class="mobile-goods-title-track">
          <span class="mobile-title-marquee">{{ goods.name }}</span>
          <span v-if="titleOverflowing" class="mobile-title-marquee" aria-hidden="true">
            {{ goods.name }}
          </span>
        </span>
        <span ref="titleMeasureRef" class="mobile-title-measure" aria-hidden="true">
          {{ goods.name }}
        </span>
      </h3>

      <p class="mobile-goods-meta" :title="metaTitle">
        <span>{{ goods.ip.name }}</span>
        <span v-if="characterNames">{{ characterNames }}</span>
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
const titleHostRef = ref<HTMLElement | null>(null)
const titleMeasureRef = ref<HTMLElement | null>(null)
const titleOverflowing = ref(false)
let longPressTimer: number | null = null

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

const syncTitleOverflow = async () => {
  await nextTick()
  const host = titleHostRef.value
  const measure = titleMeasureRef.value
  if (!host || !measure) {
    titleOverflowing.value = false
    return
  }

  titleOverflowing.value = measure.scrollWidth > host.clientWidth + 1
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

  const touch = event.touches[0]
  if (!touch) return

  longPressTimer = window.setTimeout(() => {
    isLongPress.value = true
    const currentTouch = event.touches[0] || touch
    emit('contextMenu', { goods: props.goods, x: currentTouch.clientX, y: currentTouch.clientY })
  }, 600)
}

const handleTouchEnd = () => clearLongPressTimer()
const handleTouchMove = () => clearLongPressTimer()

onMounted(() => {
  syncTitleOverflow()
  window.addEventListener('resize', syncTitleOverflow)
})

onBeforeUnmount(() => clearLongPressTimer())

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncTitleOverflow)
})

watch(() => props.goods.name, () => {
  titleOverflowing.value = false
  syncTitleOverflow()
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
  height: 100%;
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
  cursor: pointer;
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
  top: 6px;
  left: 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: calc(100% - 44px);
  min-height: 20px;
  padding: 2px 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 999px;
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
}

.mobile-tag-icon {
  flex: none;
  font-size: 11px;
}

.tag-official {
  background: rgba(190, 138, 12, 0.72);
}

.tag-unofficial {
  background: rgba(99, 102, 241, 0.68);
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
  display: block;
  position: relative;
  margin: 0 0 3px;
  overflow: hidden;
  color: var(--mobile-card-text);
  font-size: 13px;
  font-weight: 750;
  line-height: 1.25;
  white-space: nowrap;
}

.mobile-goods-title-track {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-width: 0;
  vertical-align: top;
}

.mobile-title-marquee {
  display: inline-block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-title-measure {
  position: absolute;
  inset: 0 auto auto 0;
  width: max-content;
  max-width: none;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
}

.mobile-goods-title.is-overflowing .mobile-goods-title-track {
  max-width: none;
  min-width: max-content;
  animation: mobileTitleMarquee 7s linear 0.8s infinite;
  will-change: transform;
}

.mobile-goods-title.is-overflowing .mobile-title-marquee {
  overflow: visible;
  padding-right: 24px;
  text-overflow: clip;
}

@keyframes mobileTitleMarquee {
  0%,
  12% {
    transform: translateX(0);
  }
  88%,
  100% {
    transform: translateX(calc(-50%));
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-goods-title.is-overflowing .mobile-goods-title-track {
    animation: none;
  }
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

.mobile-goods-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-goods-meta span + span::before {
  content: ' · ';
  color: #cbd5e1;
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
