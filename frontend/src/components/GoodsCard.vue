<template>
  <div
    class="goods-card"
    :class="{ 'is-selectable': selectable, 'is-selected': selected }"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
    @touchstart.stop="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchEnd"
    @touchmove="handleTouchMove"
  >
    <!-- 1. 图片区域 -->
    <div class="card-image-wrapper">
      <SquarePaddedImage
        v-if="goods.main_photo"
        :src="goods.main_photo"
        :alt="goods.name"
        :watermark="enableWatermark"
        :watermark-user-id="'ID:' + goods.id.slice(0, 8)"
        loading="lazy"
        class="main-image"
      />
      <div v-else class="image-placeholder">
        <el-icon><Picture /></el-icon>
      </div>

      <!-- 官谷/同人 标签 -->
      <div class="attr-tag" :class="tagClass">
        <el-icon class="tag-icon">
          <CircleCheck v-if="goods.is_official" />
          <Brush v-else />
        </el-icon>
        <span class="tag-text">{{ tagText }}</span>
      </div>

      <!-- 数量角标 -->
      <div v-if="goods.quantity > 1" class="quantity-badge">
        x{{ goods.quantity }}
      </div>

      <div
        v-if="selectable"
        class="selection-indicator"
        :class="{ 'is-selected': selected }"
        @click.stop="handleSelectClick"
      >
        <el-icon v-if="selected"><Check /></el-icon>
      </div>

      <!-- 更多按钮（某些页面会在外层自定义右上角操作区，避免重复显示） -->
      <div v-if="showMenu" class="menu-button" @click.stop="handleMenuButtonClick">
        <el-icon><MoreFilled /></el-icon>
      </div>
    </div>

    <!-- 2. 内容区域 -->
    <div class="card-content">
      <!-- 标题 -->
      <h3 class="goods-title" :title="goods.name">{{ goods.name }}</h3>

      <!-- 参数对齐布局 -->
      <div class="info-meta">
        <div class="info-row">
          <span class="info-label">IP</span>
          <span class="info-value truncate">{{ goods.ip.name }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">角色</span>
          <span class="info-value truncate">
            {{ characterNames }}
          </span>
        </div>
      </div>

      <!-- 3. 底部脚部（解决移动端冲突的核心区域） -->
      <div class="card-footer" :class="{ 'has-location': goods.location_path }">
        <!-- 品类标签：固定宽度不收缩 -->
        <div class="category-wrapper">
          <span
            ref="categoryTagRef"
            class="category-tag"
            :class="{ 'is-scrollable': isCategoryScrollable }"
            :style="categoryStyle"
            :title="goods.category.name"
          >
            <span class="category-tag-clip">
              <span ref="categoryTextRef" class="category-tag-text">{{ goods.category.name }}</span>
              <span class="category-tag-track" aria-hidden="true">
                <span class="category-tag-scroll-text">{{ goods.category.name }}</span>
                <span class="category-tag-scroll-text">{{ goods.category.name }}</span>
              </span>
            </span>
          </span>
        </div>

      <!-- 位置信息：PC 端用面包屑强化“在哪儿”的识别 -->
      <div
        v-if="goods.location_path"
        class="location-box"
        :title="goods.location_path"
        @click.stop="handleLocationClick"
      >
        <el-icon class="loc-icon"><Location /></el-icon>
        <span class="location-breadcrumb">
          <span
            v-for="(segment, index) in locationDisplaySegments"
            :key="`${segment}-${index}`"
            class="location-segment"
          >
            {{ segment }}
          </span>
        </span>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Picture, Location, CircleCheck, MoreFilled, Brush, Check } from '@element-plus/icons-vue'
import SquarePaddedImage from '@/components/SquarePaddedImage.vue'
import type { GoodsListItem } from '@/api/types'

interface Props {
  goods: GoodsListItem
  enableWatermark?: boolean
  selectable?: boolean
  selected?: boolean
  /**
   * 是否显示卡片右上角的“更多”按钮。
   * 默认显示；当外层页面已自定义右上角操作区时可关闭，避免冲突/重叠。
   */
  showMenu?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectable: false,
  selected: false,
  showMenu: true,
})

const selectable = computed(() => props.selectable)
const selected = computed(() => props.selected)
const showMenu = computed(() => props.showMenu && !selectable.value)

const emit = defineEmits<{
  click: [goods: GoodsListItem]
  select: [goods: GoodsListItem]
  locationClick: [path: string]
  contextMenu: [{ goods: GoodsListItem; x: number; y: number }]
}>()

const isLongPress = ref(false)
let longPressTimer: number | null = null

const tagText = computed(() => props.goods.is_official ? '官谷' : '同人')
const tagClass = computed(() => ({
  'tag-official': props.goods.is_official,
  'tag-unofficial': !props.goods.is_official
}))

const characterNames = computed(() =>
  props.goods.characters.map(character => character.name).join('、'),
)

const categoryTagRef = ref<HTMLElement | null>(null)
const categoryTextRef = ref<HTMLElement | null>(null)
const isCategoryScrollable = ref(false)
let categoryResizeObserver: ResizeObserver | null = null

const updateCategoryScrollState = async () => {
  await nextTick()
  const textEl = categoryTextRef.value

  if (!textEl) {
    isCategoryScrollable.value = false
    return
  }

  isCategoryScrollable.value = textEl.scrollWidth > textEl.clientWidth + 1
}

const locationDisplaySegments = computed(() => {
  const segments = props.goods.location_path
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)

  return segments.slice(-3)
})

// 动态计算品类标签样式
const categoryStyle = computed(() => {
  const color = props.goods.category.color_tag || 'var(--primary-gold)'
  return {
    color,
    backgroundColor: color.startsWith('#') ? `${color}14` : 'rgba(212, 175, 55, 0.12)',
    borderColor: color.startsWith('#') ? `${color}36` : 'rgba(212, 175, 55, 0.28)',
  }
})

// --- 逻辑处理 ---
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

const handleLocationClick = () => {
  if (selectable.value) {
    emit('select', props.goods)
    return
  }
  emit('locationClick', props.goods.location_path)
}

const handleSelectClick = () => {
  emit('select', props.goods)
}

const handleMenuButtonClick = (event: MouseEvent) => {
  event.stopPropagation()
  if (selectable.value) return
  emit('contextMenu', { goods: props.goods, x: event.clientX, y: event.clientY })
}

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  if (selectable.value) return
  emit('contextMenu', { goods: props.goods, x: event.clientX, y: event.clientY })
}

const clearLongPressTimer = () => {
  if (longPressTimer !== null) {
    window.clearTimeout(longPressTimer)
    longPressTimer = null
  }
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
  void updateCategoryScrollState()

  if (typeof ResizeObserver === 'undefined') return

  categoryResizeObserver = new ResizeObserver(() => {
    void updateCategoryScrollState()
  })

  if (categoryTagRef.value) {
    categoryResizeObserver.observe(categoryTagRef.value)
  }
  if (categoryTextRef.value) {
    categoryResizeObserver.observe(categoryTextRef.value)
  }
})

watch(
  () => [props.goods.category.name, props.goods.location_path],
  () => {
    void updateCategoryScrollState()
  },
)

onBeforeUnmount(() => {
  clearLongPressTimer()
  categoryResizeObserver?.disconnect()
})
</script>

<style scoped>
.goods-card {
  --goods-card-gold: var(--primary-gold, #D4AF37);
  --goods-card-gold-light: var(--primary-gold-light, #EACDA3);
  --goods-card-gold-dark: var(--primary-gold-dark, #B8941F);
  --goods-card-purple: var(--accent-purple, #A29BFE);
  --goods-card-text: var(--text-dark, #333333);
  --goods-card-subtle: var(--text-light, #888888);
  --goods-card-muted: var(--text-regular, #606266);
  --goods-card-surface: var(--bg-white, #FFFFFF);
  --goods-card-rail: rgba(212, 175, 55, 0.16);

  isolation: isolate;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(250, 249, 246, 0.96)),
    var(--goods-card-surface);
  border-radius: var(--card-radius, 20px);
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition:
    transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 0.24s ease,
    border-color 0.24s ease;
  border: 1px solid rgba(212, 175, 55, 0.26);
  display: flex;
  flex-direction: column;
  height: 100%;
  box-shadow:
    0 12px 30px rgba(28, 23, 12, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.goods-card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  background:
    linear-gradient(135deg, rgba(212, 175, 55, 0.18), transparent 34%),
    linear-gradient(315deg, rgba(162, 155, 254, 0.14), transparent 32%);
  opacity: 0;
  transition: opacity 0.24s ease;
}

.goods-card::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: calc(var(--card-radius, 20px) - 1px);
  pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42);
}

.goods-card:hover {
  transform: translateY(-3px);
  border-color: rgba(212, 175, 55, 0.62);
  box-shadow:
    0 18px 38px rgba(28, 23, 12, 0.1),
    0 0 0 3px rgba(212, 175, 55, 0.08);
}

.goods-card:hover::before {
  opacity: 1;
}

.goods-card.is-selectable {
  user-select: none;
}

.goods-card.is-selectable:hover {
  transform: translateY(-2px);
}

.goods-card.is-selected {
  border-color: var(--goods-card-gold);
  box-shadow:
    0 0 0 3px rgba(212, 175, 55, 0.2),
    0 18px 34px rgba(28, 23, 12, 0.12);
}

.goods-card.is-selected .card-image-wrapper::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(212, 175, 55, 0.16), rgba(162, 155, 254, 0.08));
  pointer-events: none;
  z-index: 1;
}

/* 图片区域 */
.card-image-wrapper {
  position: relative;
  width: calc(100% - 24px);
  margin: 12px 12px 0;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  overflow: hidden;
  box-shadow: none;
}

.main-image {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
}

.main-image :deep(.square-padded-image) {
  height: 100%;
  aspect-ratio: auto;
  border-radius: inherit;
  background: transparent;
}

.main-image :deep(.square-padded-image__media),
.main-image :deep(.square-padded-image__placeholder) {
  border-radius: inherit;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(184, 148, 31, 0.48);
  background:
    linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(162, 155, 254, 0.1)),
    #f8fafc;
}

.image-placeholder .el-icon {
  font-size: 34px;
}

/* 官谷/同人标签 */
.attr-tag {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  max-width: calc(100% - 58px);
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  z-index: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.46);
  backdrop-filter: blur(10px) saturate(1.24);
  -webkit-backdrop-filter: blur(10px) saturate(1.24);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.1);
}

.tag-icon {
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

.quantity-badge {
  position: absolute;
  right: 16px;
  bottom: 16px;
  min-width: 30px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 999px;
  background: rgba(31, 41, 55, 0.76);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 22px;
  text-align: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.menu-button {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 30px;
  height: 30px;
  background: rgba(255, 255, 255, 0.9);
  color: #475569;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(-2px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
  z-index: 3;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
}

.goods-card:hover .menu-button {
  opacity: 1;
  transform: translateY(0);
}

.menu-button:hover {
  color: var(--goods-card-gold-dark);
  box-shadow: 0 10px 22px rgba(212, 175, 55, 0.2);
}

.selection-indicator {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.95);
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  transition: background-color 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
}

.selection-indicator.is-selected {
  background: var(--goods-card-gold);
  border-color: #fff;
  transform: scale(1.04);
}

.selection-indicator .el-icon {
  font-size: 18px;
  font-weight: 700;
}

/* 内容区 */
.card-content {
  padding: 13px 14px 14px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0; /* 允许内部元素收缩 */
}

.goods-title {
  margin: 0 0 9px;
  color: var(--goods-card-text);
  font-size: 14px;
  font-weight: 750;
  line-height: 1.36;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  padding-bottom: 2px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
}

.info-label {
  width: 30px;
  flex: none;
  color: rgba(184, 148, 31, 0.82);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-align: center;
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.08);
}

.info-value {
  color: var(--goods-card-muted);
  flex: 1;
  min-width: 0;
  line-height: 1.35;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 底部脚部 - 解决冲突的关键样式 */
.card-footer {
  margin-top: auto;
  padding-top: 11px;
  border-top: 1px solid rgba(212, 175, 55, 0.14);
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-width: 0;
}

.card-footer.has-location {
  grid-template-columns: minmax(94px, 42%) minmax(0, 1fr);
}

.category-wrapper {
  justify-self: stretch;
  min-width: 0;
}

.category-tag {
  display: inline-flex;
  align-items: center;
  max-width: min(126px, 100%);
  min-height: 24px;
  min-width: 0;
  width: max-content;
  box-sizing: border-box;
  overflow: hidden;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.category-tag-clip {
  position: relative;
  display: block;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.category-tag-text {
  display: block;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-tag-track {
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

.category-tag-scroll-text {
  flex: 0 0 auto;
}

.category-tag.is-scrollable .category-tag-text {
  animation: categoryTagEllipsis 4.8s ease-in-out infinite;
}

.category-tag.is-scrollable .category-tag-track {
  animation: categoryTagScroll 4.8s ease-in-out infinite;
}

@keyframes categoryTagEllipsis {
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

@keyframes categoryTagScroll {
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

.location-box {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  font-size: 11px;
  color: var(--goods-card-subtle);
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  transition: color 0.18s ease;
}

.location-box:hover {
  color: var(--goods-card-gold-dark);
}

.loc-icon {
  flex: none;
  font-size: 13px;
}

.location-breadcrumb {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.location-segment {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-segment + .location-segment::before {
  content: '>';
  margin-right: 4px;
  color: rgba(148, 163, 184, 0.72);
}

.location-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px), (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .goods-card {
    border-color: rgba(15, 23, 42, 0.04);
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
    transform: none;
  }

  .goods-card:hover {
    transform: none;
    border-color: rgba(212, 175, 55, 0.18);
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
  }

  .goods-card:active {
    transform: scale(0.985);
  }

  .card-image-wrapper {
    width: calc(100% - 16px);
    margin: 8px 8px 0;
    padding: 0;
    border-radius: 16px;
    border: 0;
    background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  }

  .main-image,
  .image-placeholder {
    border-radius: inherit;
  }

  .attr-tag {
    top: 8px;
    left: 8px;
    min-height: 28px;
    padding: 4px 9px;
    border-radius: 9px;
    font-size: 12px;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.16);
  }

  .quantity-badge {
    bottom: 8px;
    right: 8px;
    border-radius: 999px;
    padding: 3px 7px;
  }

  .card-content {
    padding: 10px 10px 12px;
  }

  .goods-title {
    margin-bottom: 6px;
    font-size: 15px;
    line-height: 1.32;
    line-clamp: 1;
    -webkit-line-clamp: 1;
  }

  .info-meta {
    display: block;
    margin-bottom: 8px;
    color: #64748b;
    font-size: 12px;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .info-row {
    display: inline;
    font-size: inherit;
  }

  .info-row + .info-row::before {
    content: ' / ';
    color: #cbd5e1;
  }

  .info-label {
    display: none;
  }

  .info-value,
  .truncate {
    display: inline;
    color: inherit;
    overflow: visible;
    white-space: inherit;
    text-overflow: clip;
  }

  .card-footer {
    padding-top: 8px;
    border-top: 0;
    display: block;
  }

  .category-tag {
    max-width: 100%;
    width: auto;
    min-height: 28px;
    padding: 4px 9px;
    border-radius: 8px;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
  }

  .location-box {
    display: none;
  }

  .menu-button {
    opacity: 0;
  }
}
</style>
