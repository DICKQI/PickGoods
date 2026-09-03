<template>
  <el-drawer
    v-model="visible"
    :direction="drawerDirection"
    :size="drawerSize"
    :with-header="false"
    :show-close="false"
    :lock-scroll="!isMobile"
    :class="[
      'guzi-detail-drawer', 
      { 'is-mobile': isMobile },
      { 'is-dragging': isDragging } 
    ]"
    @close="handleClose"
    @open="handleOpen"
  >
    <div v-if="loading" class="drawer-loading">
      <el-skeleton :rows="10" animated />
    </div>

    <GoodsDetailDesktop
      v-else-if="detail && !isMobile"
      :detail="detail"
      :all-images="allImages"
      :status-text="statusText"
      :status-tag-type="statusTagType"
      :same-theme-goods="sameThemeGoods"
      :same-theme-loading="sameThemeLoading"
      @same-theme-click="handleSameThemeItemClick"
    />

    <div v-else-if="detail" class="drawer-container">
      <!-- 
        移动端专属头部区域 
        添加 touch 事件监听，实现跟随拖拽
      -->
      <div
        v-if="isMobile"
        class="mobile-header-area"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <div class="handle-indicator"></div>
        <button
          type="button"
          class="mobile-close-btn"
          aria-label="关闭谷子详情"
          @click.stop="handleMobileClose"
        >
          <el-icon><Close /></el-icon>
        </button>
      </div>

      <!-- 可滚动的内容区域 -->
      <div
        class="scrollable-content"
        @touchstart="handleContentTouchStart"
        @touchmove="handleContentTouchMove"
        @touchend="handleContentTouchEnd"
        @scroll="handleContentScroll"
      >
        <section class="mobile-detail-panel">
          <section class="mobile-hero-card">
            <div class="mobile-main-image-wrapper">
              <SquarePaddedImage
                v-if="detail.main_photo"
                :src="detail.main_photo"
                :preview-src-list="allImages"
                class="mobile-main-image"
              />
              <div v-else class="mobile-image-placeholder">
                <el-icon><Picture /></el-icon>
                <span>暂无主图</span>
              </div>
            </div>
          </section>

          <section class="mobile-profile-card">
            <div class="mobile-title-row">
              <h2 class="mobile-detail-title">{{ detail.name }}</h2>
              <el-tag :type="statusTagType" effect="dark" class="mobile-status-badge">{{ statusText }}</el-tag>
            </div>

            <div class="mobile-chip-row">
              <span class="mobile-chip" :class="detail.is_official ? 'is-official' : 'is-fanmade'">
                {{ detail.is_official ? '官谷' : '同人' }}
              </span>
              <span class="mobile-chip" :title="detail.category.path_name || detail.category.name">
                {{ detail.category.name }}
              </span>
              <span
                v-if="detail.theme"
                class="mobile-chip is-theme mobile-theme-chip"
                :class="{ 'is-scrollable': isMobileThemeNameScrollable }"
                :title="detail.theme.name"
              >
                <span class="mobile-theme-chip-clip">
                  <span ref="mobileThemeNameTextRef" class="mobile-theme-chip-text">{{ detail.theme.name }}</span>
                  <span class="mobile-theme-chip-track" aria-hidden="true">
                    <span class="mobile-theme-chip-scroll-text">{{ detail.theme.name }}</span>
                    <span class="mobile-theme-chip-scroll-text">{{ detail.theme.name }}</span>
                  </span>
                </span>
              </span>
            </div>

            <dl class="mobile-summary-list">
              <div v-if="detail.user?.username" class="mobile-summary-row">
                <dt>谷主</dt>
                <dd :title="detail.user.username">{{ detail.user.username }}</dd>
              </div>
              <div class="mobile-summary-row">
                <dt>IP作品</dt>
                <dd :title="detail.ip.name">{{ detail.ip.name }}</dd>
              </div>
              <div class="mobile-summary-row is-characters">
                <dt>角色</dt>
                <dd class="mobile-character-list">
                  <span
                    v-for="char in detail.characters"
                    :key="char.id"
                    class="mobile-character-chip"
                    :title="char.name"
                  >
                    {{ char.name }}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section class="mobile-stat-grid" aria-label="入手信息">
            <article class="mobile-stat-card">
              <span class="mobile-stat-label">购买价格</span>
              <strong class="mobile-stat-value is-price">{{ mobilePriceText }}</strong>
            </article>
            <article class="mobile-stat-card">
              <span class="mobile-stat-label">入手日期</span>
              <strong class="mobile-stat-value">{{ detail.purchase_date || '未记录' }}</strong>
            </article>
            <article class="mobile-stat-card">
              <span class="mobile-stat-label">数量</span>
              <strong class="mobile-stat-value">x{{ detail.quantity }}</strong>
            </article>
            <article class="mobile-stat-card">
              <span class="mobile-stat-label">收纳位置</span>
              <strong class="mobile-stat-value" :title="mobileLocationText">{{ mobileLocationText }}</strong>
            </article>
          </section>

          <section v-if="detail.additional_photos.length > 0" class="mobile-gallery-card">
            <div class="mobile-section-title-row">
              <h3>附加图片</h3>
              <span>{{ detail.additional_photos.length }} 张</span>
            </div>
            <div class="mobile-gallery-rail">
              <button
                v-for="(photo, index) in detail.additional_photos"
                :key="photo.id"
                class="additional-image-item mobile-gallery-item"
                type="button"
                :title="photo.label || `附加图片 ${index + 1}`"
              >
                <el-image
                  :src="photo.image"
                  fit="cover"
                  :preview-src-list="allImages"
                  :initial-index="index + 1"
                  class="mobile-gallery-image"
                >
                  <template #error>
                    <div class="image-error mobile-gallery-error">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                </el-image>
                <span
                  class="photo-label mobile-gallery-label"
                  :class="{ 'is-placeholder': !photo.label }"
                  :aria-hidden="!photo.label ? 'true' : undefined"
                >
                  {{ photo.label || '\u00a0' }}
                </span>
              </button>
            </div>
          </section>

          <section v-if="detail.notes" class="mobile-notes-card">
            <h3>备注</h3>
            <p>{{ detail.notes }}</p>
          </section>

          <section v-if="detail.theme" class="mobile-same-theme-section">
            <div class="mobile-section-title-row">
              <h3><span class="same-theme-title-text">同主题收藏</span></h3>
              <span class="same-theme-count">{{ sameThemeGoods.length }}</span>
            </div>
            <div v-if="sameThemeLoading" class="same-theme-loading">
              <el-skeleton :rows="3" animated />
            </div>
            <div v-else-if="sameThemeGoods.length === 0" class="same-theme-empty">
              <el-empty description="暂无同主题收藏" :image-size="80" />
            </div>
            <div v-else class="mobile-same-theme-rail">
              <button
                v-for="goods in sameThemeGoods"
                :key="goods.id"
                class="same-theme-item mobile-same-theme-card"
                type="button"
                @click="handleSameThemeItemClick(goods.id)"
              >
                <SquarePaddedImage
                  v-if="goods.main_photo"
                  :src="goods.main_photo"
                  class="same-theme-image mobile-same-theme-image"
                />
                <div v-else class="same-theme-image-placeholder mobile-same-theme-placeholder">
                  <el-icon><Picture /></el-icon>
                </div>
                <span
                  class="same-theme-item-name mobile-same-theme-name"
                  :class="{ 'is-scrollable': isMobileSameThemeNameScrollable(goods.id) }"
                  :style="{ '--same-theme-name-scroll-duration': getMobileSameThemeNameScrollDuration(goods.id) }"
                  :title="goods.name"
                >
                  <span class="mobile-same-theme-name-clip">
                    <span
                      :ref="(el) => setMobileSameThemeNameRef(goods.id, el)"
                      class="same-theme-item-name-text mobile-same-theme-name-text"
                    >
                      {{ goods.name }}
                    </span>
                    <span class="mobile-same-theme-name-track" aria-hidden="true">
                      <span class="mobile-same-theme-name-scroll-text">{{ goods.name }}</span>
                      <span class="mobile-same-theme-name-scroll-text">{{ goods.name }}</span>
                    </span>
                  </span>
                </span>
              </button>
            </div>
          </section>
        </section>
      </div>
    </div>

    <div v-else class="drawer-error">
      <el-empty description="加载失败" />
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { Picture, Close, Collection } from '@element-plus/icons-vue'
import { useGuziStore } from '@/stores/guzi'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { getGoodsList } from '@/api/goods'
import SquarePaddedImage from '@/components/SquarePaddedImage.vue'
import GoodsDetailDesktop from '@/components/goods-detail/GoodsDetailDesktop.vue'
import { getReadableMarqueeDuration } from '@/utils/readableMarquee'
import type { GoodsDetail, GoodsListItem } from '@/api/types'

interface Props {
  modelValue: boolean
  goodsId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const guziStore = useGuziStore()
const { isMobile, viewportHeight } = useResponsiveDevice()
const detail = ref<GoodsDetail | null>(null)
const loading = ref(false)
// 添加请求标识，用于防止竞态条件
let currentRequestId: string | null = null

// 相同主题的谷子列表
const sameThemeGoods = ref<GoodsListItem[]>([])
const sameThemeLoading = ref(false)
const sameThemeExpanded = ref<string[]>([])
const mobileThemeNameTextRef = ref<HTMLElement | null>(null)
const isMobileThemeNameScrollable = ref(false)
let mobileThemeNameResizeObserver: ResizeObserver | null = null
const mobileSameThemeNameRefs = new Map<string, HTMLElement>()
const scrollableMobileSameThemeNameIds = ref(new Set<string>())
const mobileSameThemeNameScrollDurations = ref(new Map<string, string>())
let mobileSameThemeNameResizeObserver: ResizeObserver | null = null
const MOBILE_SAME_THEME_NAME_SCROLL_GAP_PX = 16

// --- 移动端状态管理 ---
const isDragging = ref(false) // 是否正在拖拽中
const sheetState = ref<'half' | 'full'>('half') // 当前吸附状态
const currentDrawerHeight = ref<number | string>('65%') // 实时高度

// 触摸相关临时变量
let startY = 0
let startHeight = 0
let windowHeight = 0
let mobileBodyScrollTop = 0
let mobileBodyStyleSnapshot: Partial<CSSStyleDeclaration> | null = null

// 内容区域触摸相关变量
let contentStartY = 0
let contentStartScrollTop = 0
let isContentScrolled = false

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const syncWindowHeight = () => {
  if (isMobile.value) {
    windowHeight = viewportHeight.value || window.innerHeight
  }
}

const drawerDirection = computed(() => isMobile.value ? 'btt' : 'rtl')

// Drawer Size 核心逻辑
const drawerSize = computed(() => {
  if (!isMobile.value) return 'clamp(720px, 48vw, 880px)'
  // 如果正在拖拽，返回实时计算的像素值（数字）
  // 如果没拖拽，返回预设百分比（字符串）
  return currentDrawerHeight.value
})

const statusText = computed(() => {
  if (!detail.value) return ''
  const map: Record<string, string> = {
    draft: '草稿',
    intended: '意向入手',
    in_cabinet: '在馆',
    outdoor: '出街中',
    sold: '已售出',
  }
  return map[detail.value.status] || detail.value.status
})

const statusTagType = computed(() => {
  if (!detail.value) return ''
  const map: Record<string, string> = {
    draft: 'info',
    intended: 'warning',
    in_cabinet: 'success',
    outdoor: 'warning',
    sold: 'info',
  }
  return map[detail.value.status] || ''
})

const allImages = computed(() => {
  if (!detail.value) return []
  const images = detail.value.main_photo ? [detail.value.main_photo] : []
  return images.concat(detail.value.additional_photos.map((p) => p.image))
})

const mobileLocationText = computed(() => detail.value?.location_path || '未收纳')
const mobilePriceText = computed(() => (detail.value?.price ? `¥ ${detail.value.price}` : '未记录'))

const updateMobileThemeNameScrollState = async () => {
  await nextTick()
  const textEl = mobileThemeNameTextRef.value
  isMobileThemeNameScrollable.value = !!textEl && textEl.scrollWidth > textEl.clientWidth + 1
}

const observeMobileThemeNameText = async () => {
  await nextTick()

  mobileThemeNameResizeObserver?.disconnect()

  const textEl = mobileThemeNameTextRef.value
  if (textEl) {
    mobileThemeNameResizeObserver?.observe(textEl)
  }

  void updateMobileThemeNameScrollState()
}

const hasDurationMapChanged = (nextDurations: Map<string, string>, currentDurations: Map<string, string>) =>
  nextDurations.size !== currentDurations.size ||
  [...nextDurations].some(([goodsId, duration]) => currentDurations.get(goodsId) !== duration)

const updateMobileSameThemeNameScrollState = async () => {
  await nextTick()
  const nextScrollableIds = new Set<string>()
  const nextScrollDurations = new Map<string, string>()

  mobileSameThemeNameRefs.forEach((el, goodsId) => {
    if (el.scrollWidth > el.clientWidth + 1) {
      nextScrollableIds.add(goodsId)
      nextScrollDurations.set(
        goodsId,
        getReadableMarqueeDuration(el.scrollWidth + MOBILE_SAME_THEME_NAME_SCROLL_GAP_PX),
      )
    }
  })

  const currentScrollableIds = scrollableMobileSameThemeNameIds.value
  const hasChanged =
    nextScrollableIds.size !== currentScrollableIds.size ||
    [...nextScrollableIds].some(goodsId => !currentScrollableIds.has(goodsId))

  const durationsChanged = hasDurationMapChanged(
    nextScrollDurations,
    mobileSameThemeNameScrollDurations.value,
  )

  if (hasChanged || durationsChanged) {
    scrollableMobileSameThemeNameIds.value = nextScrollableIds
    mobileSameThemeNameScrollDurations.value = nextScrollDurations
  }
}

const setMobileSameThemeNameRef = (goodsId: string, el: Element | ComponentPublicInstance | null) => {
  const previousEl = mobileSameThemeNameRefs.get(goodsId)
  if (previousEl && previousEl !== el) {
    mobileSameThemeNameResizeObserver?.unobserve(previousEl)
    mobileSameThemeNameRefs.delete(goodsId)
  }

  if (!(el instanceof HTMLElement)) return

  mobileSameThemeNameRefs.set(goodsId, el)
  mobileSameThemeNameResizeObserver?.observe(el)
}

const isMobileSameThemeNameScrollable = (goodsId: string) =>
  scrollableMobileSameThemeNameIds.value.has(goodsId)

const getMobileSameThemeNameScrollDuration = (goodsId: string) =>
  mobileSameThemeNameScrollDurations.value.get(goodsId) ?? '8s'

watch(
  () => props.goodsId,
  async (newId, oldId) => {
    // 如果 goodsId 没有真正变化，跳过
    if (newId === oldId) return
    if (newId && visible.value) {
      await loadDetail(newId)
      // 加载相同主题的谷子
      if (detail.value?.theme) {
        await loadSameThemeGoods(detail.value.theme.id, newId)
      }
    }
  },
  { immediate: true }
)

watch(visible, async (newVal) => {
  if (newVal) {
    // 每次打开，重置为半屏状态
    if (isMobile.value) {
      sheetState.value = 'half'
      currentDrawerHeight.value = '65%' 
      lockMobileBodyScroll()
    }
    // 如果已经有 goodsId，加载详情
    // 注意：这里可能会和 goodsId 的 watch 重复调用，但 loadDetail 内部会有去重处理
    if (props.goodsId) {
      await loadDetail(props.goodsId)
      // 加载相同主题的谷子
      if (detail.value?.theme) {
        await loadSameThemeGoods(detail.value.theme.id, props.goodsId)
      }
    }
  } else {
    unlockMobileBodyScroll()
    // 清除当前请求标识
    currentRequestId = null
    // 延迟清理，避免关闭动画时闪烁
    setTimeout(() => { 
      // 只有在没有新的请求时才清空
      if (!currentRequestId) {
        detail.value = null
        sameThemeGoods.value = []
        sameThemeExpanded.value = []
      }
    }, 300)
  }
})

async function loadDetail(id: string) {
  // 如果正在加载同一个 ID，跳过
  if (currentRequestId === id && loading.value) {
    return
  }
  
  // 设置当前请求标识
  currentRequestId = id
  loading.value = true
  
  try {
    const data = await guziStore.fetchGoodsDetail(id)
    
    // 检查请求是否仍然有效（防止竞态条件）
    if (currentRequestId === id && visible.value) {
      // 如果返回 null，可能是请求失败，但网络是正常的
      // 这种情况下应该保留之前的数据，而不是显示"加载失败"
      if (data) {
        detail.value = data
        // 加载相同主题的谷子
        if (data.theme) {
          await loadSameThemeGoods(data.theme.id, id)
        } else {
          sameThemeGoods.value = []
        }
      } else if (!detail.value) {
        // 只有之前也没有数据时才设置为 null（显示加载失败）
        detail.value = null
        console.warn('获取详情返回 null，但网络请求可能已成功:', id)
      }
      // 如果 data 为 null 但之前有数据，保留之前的数据（不更新）
    }
  } catch (error) {
    // 只有当前请求仍然有效时才处理错误
    if (currentRequestId === id) {
      console.error('加载详情失败:', error)
      // 请求失败时，如果之前有数据，保留之前的数据
      // 如果没有数据，detail.value 保持为 null，会显示"加载失败"
      if (!detail.value) {
        detail.value = null
      }
    }
  } finally {
    // 只有当前请求仍然有效时才重置 loading
    if (currentRequestId === id) {
      loading.value = false
      // 如果请求完成且 Drawer 已关闭，清除标识
      if (!visible.value) {
        currentRequestId = null
      }
    }
  }
}

// 加载相同主题的谷子
async function loadSameThemeGoods(themeId: number, currentGoodsId: string) {
  sameThemeLoading.value = true
  try {
    const response = await getGoodsList({ theme: themeId, page_size: 100 })
    const allGoods = Array.isArray(response) ? response : (response.results || [])
    // 排除当前谷子本身
    sameThemeGoods.value = allGoods.filter(goods => goods.id !== currentGoodsId)
    void updateMobileSameThemeNameScrollState()
  } catch (error) {
    console.error('加载相同主题的谷子失败:', error)
    sameThemeGoods.value = []
  } finally {
    sameThemeLoading.value = false
  }
}

// 点击相同主题的谷子项
async function handleSameThemeItemClick(goodsId: string) {
  // 直接加载新谷子的详情
  await loadDetail(goodsId)
  // 确保相同主题列表展开
  if (sameThemeExpanded.value.length === 0) {
    sameThemeExpanded.value = ['same-theme']
  }
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

  if (scrollTop > 0) {
    window.scrollTo(0, scrollTop)
  }
}

function handleClose() {
  unlockMobileBodyScroll()
}
function handleMobileClose() {
  visible.value = false
}
function handleOpen() {
  syncWindowHeight()
  lockMobileBodyScroll()
}

// ---------------- 核心：移动端跟随拖拽逻辑 ----------------

function handleTouchStart(e: TouchEvent) {
  if (!isMobile.value || !e.touches || e.touches.length === 0) return
  
  isDragging.value = true // 开启拖拽模式（禁用CSS过渡）
  startY = e.touches[0]!.clientY
  windowHeight = viewportHeight.value || window.innerHeight
  
  // 获取当前Drawer的实际像素高度
  // 如果当前是百分比，转化为像素
  if (typeof currentDrawerHeight.value === 'string') {
    const ratio = parseFloat(currentDrawerHeight.value) / 100
    startHeight = windowHeight * ratio
  } else {
    startHeight = currentDrawerHeight.value as number
  }
}

function handleTouchMove(e: TouchEvent) {
  if (!isMobile.value || !isDragging.value || !e.touches || e.touches.length === 0) return
  
  // 阻止浏览器默认滚动（防止下拉刷新等干扰）
  e.preventDefault() 

  const currentY = e.touches[0]!.clientY
  const deltaY = startY - currentY // 向上拖拽 delta 为正，向下为负
  
  // 实时计算新高度
  let newHeight = startHeight + deltaY

  // 限制高度范围：最小 20% (防止拖太低直接没了)，最大 100%
  const minHeight = windowHeight * 0.2
  const maxHeight = windowHeight
  
  if (newHeight > maxHeight) newHeight = maxHeight
  if (newHeight < minHeight) newHeight = minHeight

  currentDrawerHeight.value = newHeight
}

function handleTouchEnd() {
  if (!isMobile.value) return
  isDragging.value = false // 恢复CSS过渡动画
  
  // 最终的高度比例
  const finalHeight = currentDrawerHeight.value as number
  const ratio = finalHeight / windowHeight

  // 阈值判断
  // 1. 如果高度小于 40%，则关闭
  if (ratio < 0.4) {
    visible.value = false
    return
  }

  // 2. 如果高度超过 80%，吸附到全屏
  if (ratio > 0.8) {
    snapTo('full')
  } 
  // 3. 否则吸附到半屏
  else {
    // 细化体验：如果之前是 full，往下拉只要过了 80% 线就回弹到 half
    // 如果之前是 half，往上拉没过 80% 线就回弹到 half
    snapTo('half')
  }
}

// 辅助函数：吸附到指定状态
function snapTo(state: 'half' | 'full') {
  sheetState.value = state
  currentDrawerHeight.value = state === 'half' ? '65%' : '100%'
}

// ---------------- 内容区域触摸事件处理（半屏上滑展开 + 全屏下滑关闭） ----------------

function handleContentTouchStart(e: TouchEvent) {
  if (!isMobile.value) return
  if (sheetState.value !== 'half' && sheetState.value !== 'full') return

  if (!e.touches || e.touches.length === 0) return

  const touch = e.touches[0]
  if (!touch) return

  contentStartY = touch.clientY
  isContentScrolled = false

  const scrollContainer = e.currentTarget as HTMLElement
  if (scrollContainer) {
    contentStartScrollTop = scrollContainer.scrollTop
  }
}

// scroll 事件在 touchmove 期间同步触发
// 只在 scrollTop 真正变化时才标记（忽略 iOS 橡皮筋等假性偏移）
function handleContentScroll(e: Event) {
  if (isContentScrolled) return
  const container = e.currentTarget as HTMLElement
  if (container && Math.abs(container.scrollTop - contentStartScrollTop) > 2) {
    isContentScrolled = true
  }
}

function handleContentTouchMove() {
  // 不调用 e.preventDefault()，让浏览器原生滚动正常工作
}

function handleContentTouchEnd(e: TouchEvent) {
  if (!isMobile.value) return
  if (sheetState.value !== 'half' && sheetState.value !== 'full') return

  if (!e.changedTouches || e.changedTouches.length === 0) return

  const touch = e.changedTouches[0]
  if (!touch) return

  const endY = touch.clientY
  const deltaY = contentStartY - endY // 向上滑动为正

  if (sheetState.value === 'half') {
    // 半屏：任何位置上滑超 50px → 直接展开全屏
    if (deltaY > 50) {
      snapTo('full')
    }
  } else if (sheetState.value === 'full') {
    // 全屏：没有真正滚动过内容 → 纯手势，下滑超 80px 关闭
    if (!isContentScrolled && deltaY < -80) {
      visible.value = false
    }
  }

  // 重置状态
  contentStartY = 0
  contentStartScrollTop = 0
  isContentScrolled = false
}

watch([isMobile, viewportHeight], () => {
  syncWindowHeight()
  if (!isMobile.value) {
    unlockMobileBodyScroll()
  } else if (visible.value) {
    lockMobileBodyScroll()
  }
})

watch(
  () => [
    detail.value?.theme?.name,
    detail.value?.category?.name,
    detail.value?.is_official,
    isMobile.value,
  ],
  () => {
    void observeMobileThemeNameText()
  },
)

watch(
  () => sameThemeGoods.value.map(goods => `${goods.id}:${goods.name}`).join('|'),
  () => {
    const activeIds = new Set(sameThemeGoods.value.map(goods => goods.id))

    mobileSameThemeNameRefs.forEach((el, goodsId) => {
      if (!activeIds.has(goodsId)) {
        mobileSameThemeNameResizeObserver?.unobserve(el)
        mobileSameThemeNameRefs.delete(goodsId)
      }
    })

    void updateMobileSameThemeNameScrollState()
  },
)

onMounted(() => {
  syncWindowHeight()
  if (visible.value && isMobile.value) {
    lockMobileBodyScroll()
  }

  void updateMobileThemeNameScrollState()
  void updateMobileSameThemeNameScrollState()

  if (typeof ResizeObserver === 'undefined') return

  mobileThemeNameResizeObserver = new ResizeObserver(() => {
    void updateMobileThemeNameScrollState()
  })
  mobileSameThemeNameResizeObserver = new ResizeObserver(() => {
    void updateMobileSameThemeNameScrollState()
  })

  void observeMobileThemeNameText()
  mobileSameThemeNameRefs.forEach(el => mobileSameThemeNameResizeObserver?.observe(el))
})

onBeforeUnmount(() => {
  unlockMobileBodyScroll()
  mobileThemeNameResizeObserver?.disconnect()
  mobileSameThemeNameResizeObserver?.disconnect()
  mobileSameThemeNameRefs.clear()
})
</script>

<style scoped>
/* 通用布局 */
.drawer-loading { padding: 20px; }
.drawer-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 40px;
  /* 在半屏状态下，允许触摸事件响应 */
  touch-action: pan-y;
}

/* ---------------- 头部与图片区域 ---------------- */
.mobile-header-area {
  flex-shrink: 0;
  height: 40px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-bottom: 1px solid transparent;
  cursor: grab;
  z-index: 10;
  /* 关键：防止浏览器默认行为，保证拖拽流畅 */
  touch-action: none; 
}
.mobile-header-area:active { cursor: grabbing; }

.handle-indicator {
  width: 40px;
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 10px;
}

.mobile-close-btn {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  color: #909399;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

/* ---------------- 移动端详情内容 ---------------- */
.mobile-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 12px calc(24px + env(safe-area-inset-bottom));
  color: var(--text-dark, #333);
}

.mobile-hero-card,
.mobile-profile-card,
.mobile-stat-card,
.mobile-gallery-card,
.mobile-notes-card,
.mobile-same-theme-section {
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(255, 255, 255, 0.88)),
    var(--secondary-gray, #f5f5f7);
  box-shadow: 0 10px 28px rgba(82, 63, 16, 0.08);
}

.mobile-hero-card {
  margin-top: 2px;
  padding: 10px;
}

.mobile-main-image-wrapper {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 16px;
  background: linear-gradient(135deg, #fafafa, var(--secondary-gray, #f5f5f7));
}

.mobile-main-image {
  width: 100%;
  height: 100%;
}

.mobile-image-placeholder {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: var(--text-light, #888);
  font-size: 13px;
}

.mobile-image-placeholder .el-icon {
  color: var(--primary-gold, #d4af37);
  font-size: 38px;
  opacity: 0.72;
}

.mobile-profile-card,
.mobile-gallery-card,
.mobile-notes-card,
.mobile-same-theme-section {
  padding: 15px;
}

.mobile-title-row,
.mobile-section-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.mobile-detail-title {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: #2f2a20;
  font-size: 19px;
  font-weight: 800;
  line-height: 1.28;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.mobile-status-badge {
  flex: 0 0 auto;
  margin-top: 1px;
}

.mobile-chip-row,
.mobile-character-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.mobile-chip-row {
  flex-wrap: nowrap;
  margin-top: 12px;
}

.mobile-chip,
.mobile-character-chip {
  max-width: 100%;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.1);
  color: #7c5f16;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding: 7px 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-chip:not(.is-theme) {
  flex: 0 0 auto;
  max-width: none;
}

.mobile-chip.is-fanmade {
  border-color: rgba(162, 155, 254, 0.34);
  background: var(--accent-purple-soft, #f6f4ff);
  color: #6358bd;
}

.mobile-chip.is-official {
  border-color: rgba(103, 194, 58, 0.32);
  background: rgba(103, 194, 58, 0.1);
  color: #3f8f2f;
}

.mobile-chip.is-theme {
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(162, 155, 254, 0.12));
}

.mobile-theme-chip {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
}

.mobile-theme-chip-clip {
  position: relative;
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.mobile-theme-chip-text {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-theme-chip-track {
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

.mobile-theme-chip-scroll-text {
  flex: 0 0 auto;
}

.mobile-theme-chip.is-scrollable .mobile-theme-chip-text {
  animation: mobileThemeChipEllipsis 5.4s ease-in-out infinite;
}

.mobile-theme-chip.is-scrollable .mobile-theme-chip-track {
  animation: mobileThemeChipScroll 5.4s ease-in-out infinite;
}

@keyframes mobileThemeChipEllipsis {
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

@keyframes mobileThemeChipScroll {
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

.mobile-summary-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 14px 0 0;
}

.mobile-summary-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.mobile-summary-row.is-characters {
  align-items: center;
}

.mobile-summary-row dt {
  color: var(--text-light, #888);
  font-size: 13px;
  line-height: 1.5;
}

.mobile-summary-row dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #333;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
}

.mobile-summary-row dd:not(.mobile-character-list) {
  white-space: nowrap;
}

.mobile-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.mobile-stat-card {
  min-width: 0;
  padding: 12px;
  border-radius: 15px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.74)),
    rgba(245, 245, 247, 0.88);
  box-shadow: none;
}

.mobile-stat-label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-light, #888);
  font-size: 12px;
}

.mobile-stat-value {
  display: block;
  overflow: hidden;
  color: #2f2a20;
  font-size: 15px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-stat-value.is-price {
  color: #f56c6c;
}

.mobile-section-title-row {
  align-items: center;
  margin-bottom: 12px;
}

.mobile-section-title-row h3,
.mobile-notes-card h3 {
  margin: 0;
  color: #2f2a20;
  font-size: 15px;
  font-weight: 800;
}

.mobile-section-title-row > span:not(.same-theme-count) {
  color: var(--text-light, #888);
  font-size: 12px;
}

.mobile-gallery-rail,
.mobile-same-theme-rail {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.mobile-gallery-rail::-webkit-scrollbar,
.mobile-same-theme-rail::-webkit-scrollbar {
  display: none;
}

.mobile-gallery-item,
.mobile-same-theme-card {
  flex: 0 0 92px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.mobile-gallery-image,
.mobile-gallery-error,
.mobile-same-theme-image,
.mobile-same-theme-placeholder {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 12px;
  background: var(--secondary-gray, #f5f5f7);
}

.mobile-gallery-error,
.mobile-same-theme-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light, #888);
  font-size: 22px;
}

.photo-label,
.mobile-same-theme-name {
  display: block;
  min-width: 0;
  max-width: 100%;
  margin-top: 6px;
  overflow: hidden;
  color: var(--text-regular, #606266);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-label.is-placeholder {
  visibility: hidden;
}

.mobile-notes-card p {
  margin: 10px 0 0;
  border-radius: 12px;
  background: rgba(245, 245, 247, 0.9);
  color: var(--text-regular, #606266);
  font-size: 13px;
  line-height: 1.7;
  padding: 12px;
  white-space: pre-wrap;
}

.same-theme-count {
  min-width: 24px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.14);
  color: #8a6510;
  font-size: 12px;
  font-weight: 800;
  line-height: 22px;
  text-align: center;
}

.same-theme-loading {
  padding-top: 4px;
}

.same-theme-empty {
  padding-top: 4px;
}

.same-theme-item {
  min-width: 0;
  cursor: pointer;
  border-radius: 10px;
  background: transparent;
  transition: transform 0.2s ease;
}

.same-theme-item:hover {
  transform: translateY(-2px);
}

.same-theme-item:hover .same-theme-image,
.same-theme-item:hover .same-theme-image-placeholder {
  box-shadow: 0 6px 16px rgba(40, 35, 28, 0.12);
  filter: brightness(1.02);
}

.same-theme-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.2s ease, filter 0.2s ease;
}

.same-theme-image-placeholder {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  color: #c0c4cc;
  font-size: 24px;
  border-radius: 10px;
  transition: box-shadow 0.2s ease, filter 0.2s ease;
}

.same-theme-item-name {
  min-width: 0;
  max-width: 100%;
  padding: 6px 2px 0;
  font-size: 12px;
  color: #606266;
  text-align: center;
  line-height: 1.4;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.same-theme-item-name-text {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  will-change: transform;
}

.mobile-same-theme-name-clip {
  position: relative;
  display: block;
  max-width: 100%;
  overflow: hidden;
}

.mobile-same-theme-name-track {
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

.mobile-same-theme-name-scroll-text {
  flex: 0 0 auto;
}

.mobile-same-theme-name.is-scrollable .mobile-same-theme-name-text {
  animation: mobileSameThemeNameEllipsis var(--same-theme-name-scroll-duration, 8s) ease-in-out infinite;
}

.mobile-same-theme-name.is-scrollable .mobile-same-theme-name-track {
  animation: mobileSameThemeNameScroll var(--same-theme-name-scroll-duration, 8s) ease-in-out infinite;
}

@keyframes mobileSameThemeNameEllipsis {
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

@keyframes mobileSameThemeNameScroll {
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

/* ---------------- Element UI 样式重置与动画控制 ---------------- */

:global(.guzi-detail-drawer .el-drawer__body) { padding: 20px; overflow-y: auto; }

/* 移动端特殊处理 */
:global(.guzi-detail-drawer.is-mobile .el-drawer__body) {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  max-height: 100dvh;
}
:global(.guzi-detail-drawer.is-mobile) {
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  overflow: visible;
  max-height: 100dvh;
}

.is-mobile .drawer-container {
  max-height: 100dvh;
}

.is-mobile .scrollable-content {
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}

@media (max-width: 768px), (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .is-mobile .main-image-wrapper {
    height: 38dvh;
    max-height: 450px;
    min-height: 250px;
  }

  :global(.guzi-detail-drawer.is-mobile .el-drawer__body),
  :global(.guzi-detail-drawer.is-mobile),
  .is-mobile .drawer-container {
    max-height: 100dvh;
  }

  .is-mobile .scrollable-content {
    padding-bottom: calc(40px + env(safe-area-inset-bottom));
  }
}

/* 
  关键：当正在拖拽时，强制移除 Drawer 的过渡动画
  这样高度变化就是实时的，不会有滞后感
*/
:global(.guzi-detail-drawer.is-dragging) {
  transition: none !important;
}
</style>
