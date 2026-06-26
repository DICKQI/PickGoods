<template>
  <div class="detail-root">
    <div class="detail-header-bar">
      <el-button link @click="emit('back')" class="back-btn">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <div class="title">展柜详情</div>
    </div>

    <div v-if="loading && !showcase" class="detail-loading">
      <el-skeleton :rows="10" animated />
    </div>

    <div v-else-if="showcase" class="detail-content">
      <div class="detail-info-banner">
        <div class="info-text">
          <h2 class="detail-name">{{ showcase.name }}</h2>
          <p class="detail-desc">{{ showcase.description || '这个展柜还没有描述...' }}</p>
          <div class="detail-tags">
            <el-tag size="small" :type="showcase.is_public ? 'success' : 'info'" effect="light" round>
              {{ showcase.is_public ? '公开展示' : '私密收藏' }}
            </el-tag>
          </div>
        </div>
        <div class="info-action">
          <el-button v-if="!readonly" type="primary" class="btn-accent add-goods-btn" @click="emit('addGoods')">
            <el-icon class="el-icon--left"><Goods /></el-icon> 添加谷子
          </el-button>
        </div>
      </div>

      <el-divider class="custom-divider" />

      <div class="goods-section">
        <div class="section-header">
          <span class="section-title">收纳物品</span>
          <span class="section-count">{{ goods.length }} 件</span>
        </div>

        <div v-if="goods.length === 0" class="goods-empty">
          <el-empty description="这里空空如也，快去添加心爱的谷子吧！" image-size="80" />
        </div>

        <template v-else>
          <!-- 吧唧木质展架 -->
          <div v-if="roundGoods.length" class="cabinet-label">
            <span class="cabinet-label-title">吧唧展架</span>
            <span class="cabinet-label-count">{{ roundGoods.length }} 枚</span>
          </div>

          <div v-if="roundGoods.length" ref="cabinetRef" class="cabinet" :class="{ 'is-drag-active': dragging }">
            <div class="cabinet-inner">
              <div v-for="(row, ri) in roundRows" :key="ri" class="shelf">
                <div class="shelf-items">
                  <div
                    v-for="item in row"
                    :key="item.id"
                    class="badge-item"
                    :data-id="item.id"
                    :class="{ 'is-dragging': dragItemId === item.id }"
                    :style="[
                      { cursor: readonly ? 'default' : 'grab' },
                      item.goods.category?.color_tag ? { '--badge-ring': item.goods.category.color_tag } : {},
                    ]"
                    @pointerdown="onBadgePointerDown($event, item)"
                    @click="onBadgeClick(item)"
                    @contextmenu.prevent.stop="!readonly && emit('goodsContextMenuFromDom', item.goods.id, $event)"
                    @dragstart.prevent
                  >
                    <div class="badge-photo" :title="item.goods.name">
                      <WatermarkImage
                        v-if="readonly && item.goods.main_photo"
                        :src="item.goods.main_photo"
                        :alt="item.goods.name"
                        :user-id="'ID:' + item.goods.id.slice(0, 8)"
                        fit="cover"
                        class="badge-img"
                      />
                      <el-image
                        v-else-if="item.goods.main_photo"
                        :src="item.goods.main_photo"
                        :alt="item.goods.name"
                        fit="cover"
                        class="badge-img"
                        loading="lazy"
                      >
                        <template #error>
                          <div class="badge-placeholder"><el-icon><Picture /></el-icon></div>
                        </template>
                      </el-image>
                      <div v-else class="badge-placeholder"><el-icon><Picture /></el-icon></div>
                    </div>

                    <!-- 数量角标 -->
                    <div v-if="item.goods.quantity > 1" class="badge-qty">x{{ item.goods.quantity }}</div>
                    <!-- 官谷/同人 小点 -->
                    <span class="badge-official-dot" :class="item.goods.is_official ? 'is-official' : 'is-doujin'" />
                  </div>
                </div>
                <div class="shelf-board" />
              </div>
            </div>
          </div>

          <!-- 其他谷子（非吧唧）网格 -->
          <div v-if="otherGoods.length" class="other-section">
            <div class="other-header">
              <span class="other-title">其他谷子</span>
              <span class="other-count">{{ otherGoods.length }} 件</span>
            </div>
            <div class="goods-grid">
              <div
                v-for="item in otherGoods"
                :key="item.id"
                class="goods-wrapper"
                @contextmenu.prevent.stop="!readonly && emit('goodsContextMenuFromDom', item.goods.id, $event)"
              >
                <GoodsCard
                  :goods="item.goods"
                  :show-menu="false"
                  :enable-watermark="readonly"
                  class="mini-goods-card"
                  :style="{ cursor: readonly ? 'default' : 'pointer' }"
                  @click="!readonly && emit('openGoods', item.goods)"
                  @location-click="noop"
                  @context-menu="!readonly && emit('goodsContextMenu', $event)"
                />
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-else class="detail-empty-state">
      <el-empty description="展柜不存在或加载失败" />
    </div>

    <!-- 拖曳浮动镜像：Teleport 到 body，避免 ancestor transform 干扰 fixed 定位 -->
    <Teleport to="body">
      <div
        v-if="dragGhost"
        class="badge-ghost"
        :style="{
          left: dragGhost.x + 'px',
          top: dragGhost.y + 'px',
          width: dragGhost.size + 'px',
          height: dragGhost.size + 'px',
          '--badge-ring': dragGhost.ring,
        }"
      >
        <img v-if="dragGhost.src" :src="dragGhost.src" :alt="dragGhost.alt" class="badge-ghost-img" />
        <div v-else class="badge-placeholder"><el-icon><Picture /></el-icon></div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Goods, Picture } from '@element-plus/icons-vue'
import GoodsCard from '@/components/GoodsCard.vue'
import WatermarkImage from '@/components/WatermarkImage.vue'
import { useShowcaseStore } from '@/stores/showcase'
import type { GoodsListItem, Showcase, ShowcaseGoods } from '@/api/types'

const props = withDefaults(defineProps<{
  loading: boolean
  showcase: Showcase | null
  goods: ShowcaseGoods[]
  readonly?: boolean
}>(), {
  readonly: false
})

const emit = defineEmits<{
  back: []
  addGoods: []
  openGoods: [goods: GoodsListItem]
  goodsContextMenu: [payload: { goods: GoodsListItem; x: number; y: number }]
  goodsContextMenuFromDom: [goodsId: string, event: MouseEvent]
}>()

const noop = () => {}

// 与后端 CATEGORY_SHAPE_KEYWORDS 保持一致：吧唧/徽章/马口铁 → 圆形
const ROUND_KEYWORDS = ['吧唧', '徽章', '马口铁']
const ROUND_EXCLUDES = [
  '异形', '方形', '正方形', '长方形', '矩形', '心形', '椭圆',
  '宝石', '星形', '星型', '菱形', '三角', '六边', '多边形',
]

/**
 * 判定一枚谷子是否为"圆形吧唧类"→ 上柜展示。
 * 优先用 category.shape_type；子分类（如 58mm吧唧/75mm吧唧）shape_type 常为空，
 * 故再用与后端一致的关键词逻辑兜底：name/path_name 含 吧唧/徽章/马口铁 且不含排除词。
 */
const isRoundGoods = (g: ShowcaseGoods): boolean => {
  const cat = g.goods?.category
  if (!cat) return false
  const text = `${cat.name || ''}/${cat.path_name || ''}`
  if (ROUND_EXCLUDES.some((k) => text.includes(k))) return false
  if (cat.shape_type === 'round') return true
  return ROUND_KEYWORDS.some((k) => text.includes(k))
}

/** 吧唧（圆形）谷子：上柜展示 */
const roundGoods = computed(() => props.goods.filter(isRoundGoods))
/** 其他形状谷子：保留下方网格 */
const otherGoods = computed(() => props.goods.filter((g) => !isRoundGoods(g)))

// ===== 展柜层板自适应列数（ResizeObserver） =====
const cabinetRef = ref<HTMLElement | null>(null)
const columnsPerShelf = ref(5)
let ro: ResizeObserver | null = null

const recalcColumns = () => {
  const el = cabinetRef.value
  if (!el) return
  // 与 CSS 中 .badge-photo 尺寸 / .shelf-items gap 保持一致
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const badge = isMobile ? 84 : 116
  const gap = isMobile ? 16 : 26
  const slot = badge + gap + 6 // 含安全余量，倾向少列数，避免溢出导致层板与视觉行错位
  const innerWidth = el.clientWidth - 28 // 减去 cabinet-inner 左右内边距
  const n = Math.floor(innerWidth / slot)
  columnsPerShelf.value = Math.min(5, Math.max(2, n || 2))
}

const attachObserver = (el: HTMLElement | null) => {
  ro?.disconnect()
  if (!el) return
  recalcColumns()
  if (typeof ResizeObserver !== 'undefined') {
    if (!ro) ro = new ResizeObserver(recalcColumns)
    ro.observe(el)
  }
}

// 用 watch 确保 v-if 控制 cabinetRef 出现/消失时都能正确挂载/卸载 observer
watch(cabinetRef, attachObserver)
onMounted(() => attachObserver(cabinetRef.value))
onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  cleanupDrag()
})

// ===== 吧唧展架拖曳排序 =====
const showcaseStore = useShowcaseStore()

/** 本地排序副本：拖曳时实时修改，松手后同步后端 */
const localOrder = ref<ShowcaseGoods[]>([])
const dragging = ref(false)
const dragItemId = ref<string | null>(null)
const dragGhost = ref<{
  src: string | null
  alt: string
  ring: string
  size: number
  x: number
  y: number
} | null>(null)

// 拖曳过程临时状态（非响应式，避免多余渲染）
let pendingDragItem: ShowcaseGoods | null = null
let pointerStart = { x: 0, y: 0 }
let grabOffset = { x: 0, y: 0 }
const flipRects = new Map<string, DOMRect>()
let suppressClickUntil = 0
let playRafId: number | null = null

// 非拖曳时 localOrder 与 roundGoods 保持同步
watch(roundGoods, (v) => {
  if (!dragging.value) localOrder.value = v.slice()
}, { immediate: true })

/** 按列数把吧唧切成若干层板（基于 localOrder，支持拖曳实时重排） */
const roundRows = computed<ShowcaseGoods[][]>(() => {
  const n = columnsPerShelf.value
  const rows: ShowcaseGoods[][] = []
  const arr = localOrder.value
  for (let i = 0; i < arr.length; i += n) {
    rows.push(arr.slice(i, i + n))
  }
  return rows
})

// --- 拖曳核心逻辑 ---

/** 指针按下：记录起点与抓取偏移，挂载全局监听 */
const onBadgePointerDown = (e: PointerEvent, item: ShowcaseGoods) => {
  if (props.readonly || e.button !== 0) return
  pendingDragItem = item
  pointerStart = { x: e.clientX, y: e.clientY }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  grabOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

/** 超过移动阈值后真正进入拖曳状态 */
const startDrag = (item: ShowcaseGoods, x: number, y: number) => {
  dragging.value = true
  dragItemId.value = item.id
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const size = isMobile ? 84 : 116
  const ring = item.goods.category?.color_tag || '#d4af37'
  dragGhost.value = {
    src: item.goods.main_photo || null,
    alt: item.goods.name,
    ring,
    size,
    x: x - grabOffset.x,
    y: y - grabOffset.y,
  }
}

/** 计算放置位置：在 localOrder 去掉拖曳项后的索引 */
const computeDropIndex = (x: number, y: number): number => {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  if (!el) return -1
  const badge = el.closest('.badge-item') as HTMLElement | null
  if (!badge || badge.classList.contains('is-dragging')) return -1
  const targetId = badge.dataset.id
  if (!targetId) return -1
  const others = localOrder.value.filter((g) => g.id !== dragItemId.value)
  const oIdx = others.findIndex((g) => g.id === targetId)
  if (oIdx < 0) return -1
  const rect = badge.getBoundingClientRect()
  const after = x > rect.left + rect.width / 2
  return after ? oIdx + 1 : oIdx
}

/** FLIP 第一步：清除上次残留 transform，记录所有非拖曳项的真实布局位置 */
const flipFirst = () => {
  flipRects.clear()
  const nodes = document.querySelectorAll<HTMLElement>('.badge-item:not(.is-dragging)')
  nodes.forEach((n) => {
    n.style.transition = 'none'
    n.style.transform = ''
    const id = n.dataset.id
    if (id) flipRects.set(id, n.getBoundingClientRect())
  })
}

/** FLIP 第三步：两遍法——先统一设置位移，强制 reflow，再 rAF 触发过渡动画 */
const flipPlay = () => {
  if (playRafId !== null) {
    cancelAnimationFrame(playRafId)
    playRafId = null
  }
  nextTick(() => {
    const nodes = document.querySelectorAll<HTMLElement>('.badge-item:not(.is-dragging)')
    const animated: HTMLElement[] = []
    nodes.forEach((n) => {
      const id = n.dataset.id
      if (!id) return
      const oldRect = flipRects.get(id)
      if (!oldRect) return
      const newRect = n.getBoundingClientRect()
      const dx = oldRect.left - newRect.left
      const dy = oldRect.top - newRect.top
      if (dx === 0 && dy === 0) return
      n.style.transition = 'none'
      n.style.transform = `translate(${dx}px, ${dy}px)`
      animated.push(n)
    })
    // 强制 reflow：让浏览器先"看到" translate 状态，过渡才能从该状态播放
    if (animated.length > 0) {
      void animated[0]!.offsetWidth
    }
    playRafId = requestAnimationFrame(() => {
      playRafId = null
      animated.forEach((n) => {
        n.style.transition = 'transform 0.25s ease'
        n.style.transform = ''
      })
    })
    flipRects.clear()
  })
}

/** 把拖曳项插入到 localOrder 的指定位置 */
const applyReorder = (item: ShowcaseGoods, dropIdx: number) => {
  const others = localOrder.value.filter((g) => g.id !== item.id)
  const clamped = Math.max(0, Math.min(dropIdx, others.length))
  localOrder.value = [...others.slice(0, clamped), item, ...others.slice(clamped)]
}

/** 指针移动：更新幽灵位置 + 实时重排 */
const onPointerMove = (e: PointerEvent) => {
  if (!pendingDragItem) return
  // 安全兜底：按钮已松开但 pointerup 未触发（原生拖拽等场景），立即清理
  if (e.buttons === 0) {
    onPointerUp()
    return
  }
  const x = e.clientX
  const y = e.clientY

  if (!dragging.value) {
    const dist = Math.hypot(x - pointerStart.x, y - pointerStart.y)
    if (dist < 6) return // 移动阈值，避免点击误触发
    startDrag(pendingDragItem, x, y)
  }

  if (dragging.value && dragGhost.value) {
    dragGhost.value.x = x - grabOffset.x
    dragGhost.value.y = y - grabOffset.y

    const dropIdx = computeDropIndex(x, y)
    if (dropIdx >= 0) {
      const currentIdx = localOrder.value.findIndex((g) => g.id === pendingDragItem!.id)
      if (dropIdx !== currentIdx) {
        flipFirst()
        applyReorder(pendingDragItem!, dropIdx)
        flipPlay()
      }
    }
  }
}

/** 松手后提交排序到后端；失败则回滚 localOrder */
const commitReorder = async (item: ShowcaseGoods) => {
  const arr = localOrder.value
  const idx = arr.findIndex((g) => g.id === item.id)
  if (idx < 0 || arr.length <= 1) return

  // 顺序是否真正变化
  const origIds = roundGoods.value.map((g) => g.id)
  const newIds = arr.map((g) => g.id)
  const changed = origIds.some((id, i) => id !== newIds[i])
  if (!changed) return

  // 确定锚点：优先前一项（after），否则后一项（before）
  let anchor: ShowcaseGoods | undefined
  let position: 'before' | 'after'
  if (idx > 0) {
    anchor = arr[idx - 1]
    position = 'after'
  } else {
    anchor = arr[idx + 1]
    position = 'before'
  }
  if (!anchor) return

  const showcaseId = props.showcase?.id
  if (!showcaseId) return

  const res = await showcaseStore.moveGoods(showcaseId, {
    goods_id: item.goods.id,
    anchor_goods_id: anchor.goods.id,
    position,
  })
  if (!res) {
    localOrder.value = roundGoods.value.slice()
    ElMessage.error('排序更新失败，已恢复')
  }
}

/** 指针抬起：结束拖曳，提交排序 */
const onPointerUp = async () => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)

  if (dragging.value && pendingDragItem) {
    suppressClickUntil = Date.now() + 300
    const item = pendingDragItem
    dragging.value = false
    dragItemId.value = null
    dragGhost.value = null
    pendingDragItem = null
    await commitReorder(item)
  } else {
    pendingDragItem = null
  }
}

/** 点击：拖曳后短时间内抑制 click，避免误开详情 */
const onBadgeClick = (item: ShowcaseGoods) => {
  if (Date.now() < suppressClickUntil) return
  if (props.readonly) return
  emit('openGoods', item.goods)
}

/** 清理拖曳状态与全局监听 */
const cleanupDrag = () => {
  if (playRafId !== null) {
    cancelAnimationFrame(playRafId)
    playRafId = null
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  dragging.value = false
  dragItemId.value = null
  dragGhost.value = null
  pendingDragItem = null
}
</script>

<style scoped>
.detail-root {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.detail-header-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 6px;
}
.title {
  font-size: 16px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.8);
}
.back-btn {
  padding: 0;
}

.detail-loading {
  padding: 16px;
}

.detail-content {
  flex: 1 1 auto;
  min-height: 0;
}

.detail-info-banner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  gap: 20px;
}
.detail-name {
  font-size: 24px;
  color: rgba(0, 0, 0, 0.84);
  margin: 0;
  font-weight: 900;
}
.detail-desc {
  color: rgba(0, 0, 0, 0.55);
  font-size: 14px;
  margin: 8px 0;
  line-height: 1.5;
}
.custom-divider {
  margin: 20px 0;
  border-color: rgba(0, 0, 0, 0.06);
}
.section-header {
  display: flex;
  align-items: baseline;
  margin-bottom: 16px;
}
.section-title {
  font-size: 16px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.8);
}
.section-count {
  margin-left: 8px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.55);
}
.goods-empty {
  padding: 16px 0;
}

/* 木质展架局部调色板：定义在 .goods-section，让标题与柜体共用同一套木色
   （对齐 ShowcaseManager 的 --c-* 局部变量用法；仅在吧唧展架相关样式中引用） */
.goods-section {
  --c-wood-frame-light: #fbf4e4;
  --c-wood-frame-dark: #f0e2c4;
  --c-wood-panel-light: #d8c6a4;
  --c-wood-panel-mid: #c1ab83;
  --c-wood-panel-dark: #a98f68;
  --c-wood-cap-light: #b8905a;
  --c-wood-cap-mid: #9a7440;
  --c-wood-cap-dark: #7d5a2a;
  --c-wood-grain: 120, 72, 22;        /* 木纹基色（RGB 分量，便于带透明度复用） */
  --c-wood-shadow: 90, 54, 18;        /* 木影基色（RGB 分量） */
  --c-wood-inlay: 199, 154, 74;       /* 木中泛金的嵌线（RGB 分量） */
}

/* ==================== 吧唧木质展架 ==================== */
.cabinet-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}
.cabinet-label-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--c-wood-cap-dark);
  padding-bottom: 2px;
  border-bottom: 1px solid rgba(var(--c-wood-inlay), 0.45);   /* 金木嵌线点缀 */
}
.cabinet-label-count {
  font-size: 12px;
  color: rgba(var(--c-wood-shadow), 0.6);
}

.cabinet {
  max-width: 720px;
  margin: 0 auto;
  border-radius: 14px;
  padding: 14px;
  background: linear-gradient(160deg, var(--c-wood-frame-light) 0%, var(--c-wood-frame-dark) 100%);
  border: 1px solid rgba(150, 100, 40, 0.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),            /* 顶部高光：框体斜面 */
    inset 0 0 0 1px rgba(var(--c-wood-inlay), 0.35),   /* 内层极细金木嵌线 */
    0 10px 40px -10px rgba(var(--c-wood-shadow), 0.22),
    0 6px 18px -8px rgba(var(--c-wood-shadow), 0.28);
}

.cabinet-inner {
  position: relative;
  border-radius: 10px;
  padding: 14px 14px 4px;
  background:
    /* 顶部光晕：模拟柜顶光源，中心提亮 */
    radial-gradient(110% 70% at 50% 0%, rgba(255, 250, 235, 0.12) 0%, transparent 55%),
    /* 边缘晕影：四角渐入暗，营造柜内纵深 */
    radial-gradient(130% 100% at 50% 40%, transparent 55%, rgba(var(--c-wood-shadow), 0.2) 100%),
    /* 亮色木纹丝：丝绸般的高光纹理走向 */
    repeating-linear-gradient(90deg, rgba(255, 250, 235, 0.04) 0 1px, transparent 1px 11px),
    /* 细密暗纹：贴近的木纹 */
    repeating-linear-gradient(90deg, rgba(var(--c-wood-grain), 0.06) 0 1px, transparent 1px 4px),
    /* 较疏暗纹：节奏变化，避免单调 */
    repeating-linear-gradient(90deg, rgba(var(--c-wood-grain), 0.05) 0 2px, transparent 2px 9px),
    /* 极淡斜向纹：木纹自然走向 */
    repeating-linear-gradient(88deg, rgba(var(--c-wood-grain), 0.04) 0 1px, transparent 1px 14px),
    /* 顶光衰减：上亮下暗模拟柜内光照 */
    linear-gradient(180deg, var(--c-wood-panel-light) 0%, var(--c-wood-panel-mid) 55%, var(--c-wood-panel-dark) 100%);
  /* 帽下凹陷 + 立柱（左右内阴影加深）+ 内嵌木框描边 */
  box-shadow:
    inset 0 8px 10px -8px rgba(var(--c-wood-shadow), 0.3),
    inset 4px 0 7px -3px rgba(var(--c-wood-shadow), 0.5),
    inset -4px 0 7px -3px rgba(var(--c-wood-shadow), 0.5),
    inset 0 0 0 1px rgba(var(--c-wood-grain), 0.18);
}
/* 底板反光：柜体内部地板的空间感 */
.cabinet-inner::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 2px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(var(--c-wood-shadow), 0.12) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}
/* 顶部木帽：让柜体更像立式高柜 */
.cabinet-inner::before {
  content: '';
  display: block;
  height: 14px;
  margin: -14px -14px 16px;
  border-radius: 10px 10px 3px 3px;
  background:
    /* 端纹：木帽横截面纹理 */
    repeating-linear-gradient(90deg, rgba(var(--c-wood-shadow), 0.08) 0 1px, transparent 1px 6px),
    linear-gradient(180deg, var(--c-wood-cap-light) 0%, var(--c-wood-cap-mid) 60%, var(--c-wood-cap-dark) 100%);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.3),             /* 顶部高光更亮：斜面 */
    inset 0 -2px 0 rgba(var(--c-wood-shadow), 0.4),     /* 底部凹槽更深：板厚 */
    inset 0 -1px 0 0 rgba(var(--c-wood-inlay), 0.6),    /* 金木嵌线：封边 */
    inset 4px 0 6px -4px rgba(var(--c-wood-shadow), 0.35),  /* 左侧下沉：衔接立柱 */
    inset -4px 0 6px -4px rgba(var(--c-wood-shadow), 0.35), /* 右侧下沉：衔接立柱 */
    0 4px 8px -3px rgba(var(--c-wood-shadow), 0.4);
}

.shelf {
  position: relative;
  z-index: 1;            /* 让层板/托架绘制在柜内底板反光之上 */
  margin-bottom: 24px;
}
.shelf:last-child {
  margin-bottom: 8px;
}
/* 木质托架：让层板被支撑而非悬浮，提升实体感 */
.shelf::before,
.shelf::after {
  content: '';
  position: absolute;
  bottom: -9px;
  width: 16px;
  height: 12px;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(180deg, var(--c-wood-cap-mid) 0%, var(--c-wood-cap-dark) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(var(--c-wood-shadow), 0.4),
    0 2px 5px -2px rgba(var(--c-wood-shadow), 0.45);
  border-radius: 0 0 3px 3px;
}
.shelf::before { left: 4px; }
.shelf::after { right: 4px; }

.shelf-items {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 26px;
  align-items: flex-end;
  padding: 8px 6px 10px;
  position: relative;
  z-index: 2;
}

.shelf-board {
  height: 15px;
  margin: -3px -6px 0;
  border-radius: 3px;
  position: relative;
  z-index: 1;
  background:
    /* 横向木纹：板面纹理走向 */
    repeating-linear-gradient(90deg, rgba(var(--c-wood-shadow), 0.05) 0 1px, transparent 1px 9px),
    linear-gradient(180deg, var(--c-wood-cap-light) 0%, var(--c-wood-cap-mid) 55%, var(--c-wood-cap-dark) 100%);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.28),          /* 顶部高光：正面斜面 */
    inset 0 -2px 0 rgba(var(--c-wood-shadow), 0.4),   /* 底部凹槽：板厚 */
    inset 0 -1px 0 0 rgba(var(--c-wood-inlay), 0.5),  /* 金木嵌线：封边 */
    0 7px 14px -5px rgba(var(--c-wood-shadow), 0.5);  /* 落影：板压在柜内 */
}
/* 端纹：木板两端封边（横截面纹理） */
.shelf-board::before,
.shelf-board::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  pointer-events: none;
  background:
    repeating-linear-gradient(90deg, rgba(var(--c-wood-shadow), 0.12) 0 1px, transparent 1px 4px),
    linear-gradient(90deg, var(--c-wood-cap-dark) 0%, var(--c-wood-cap-mid) 100%);
  box-shadow: inset 0 0 0 1px rgba(var(--c-wood-shadow), 0.2);
}
.shelf-board::before {
  left: 0;
  border-radius: 3px 0 0 3px;
}
.shelf-board::after {
  right: 0;
  border-radius: 0 3px 3px 0;
  background:
    repeating-linear-gradient(90deg, rgba(var(--c-wood-shadow), 0.12) 0 1px, transparent 1px 4px),
    linear-gradient(90deg, var(--c-wood-cap-mid) 0%, var(--c-wood-cap-dark) 100%);
}

.badge-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.22s ease;
  touch-action: none;
  user-select: none;
  -webkit-user-drag: none;
}
.badge-item:hover {
  transform: translateY(-5px);
  z-index: 3;
}
.badge-item.is-dragging {
  opacity: 0;
  pointer-events: none;
}
.cabinet.is-drag-active .badge-item:hover {
  transform: none;
}
.cabinet.is-drag-active .badge-item:hover .badge-photo {
  box-shadow:
    0 0 0 2px #fffbe8,
    0 0 0 4px var(--badge-ring, #d4af37),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}
.cabinet.is-drag-active .badge-item {
  will-change: transform;
}

.badge-photo {
  width: 116px;
  height: 116px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  isolation: isolate;             /* 让 ::after 的 screen 混合只作用于吧唧内部 */
  background: #fff8ea;
  box-shadow:
    0 0 0 2px #fffbe8,                            /* 内底：奶白 */
    0 0 0 4px var(--badge-ring, #d4af37),         /* 主金属边 */
    inset 0 0 0 1px rgba(255, 255, 255, 0.45);    /* 内高光弧：金属倒角反光 */
  filter:
    drop-shadow(0 2px 2px rgba(90, 54, 18, 0.28))   /* 接触影 */
    drop-shadow(0 6px 5px rgba(90, 54, 18, 0.3));   /* 环境影 */
  transition: box-shadow 0.22s ease;
}
/* 穹顶高光：吧唧金属面的弧度反光 */
.badge-photo::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(120% 80% at 50% 16%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.08) 40%, transparent 60%);
  mix-blend-mode: screen;
  pointer-events: none;
  z-index: 1;
}
.badge-item:hover .badge-photo {
  box-shadow:
    0 0 0 2px #fffbe8,
    0 0 0 4px var(--badge-ring, #d4af37),
    inset 0 0 0 1px rgba(255, 255, 255, 0.55),
    0 0 10px 1px rgba(212, 175, 55, 0.5);          /* 悬停金色辉光（马口铁细闪） */
}
.badge-img {
  width: 100%;
  height: 100%;
  display: block;
}
:deep(.badge-img .el-image__inner) {
  width: 100%;
  height: 100%;
}
.badge-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(120, 72, 22, 0.4);
  font-size: 26px;
}

.badge-ghost {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  border-radius: 50%;
  overflow: hidden;
  background: #fff8ea;
  box-shadow:
    0 0 0 2px #fffbe8,
    0 0 0 4px var(--badge-ring, #d4af37),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45),
    0 12px 24px -6px rgba(0, 0, 0, 0.4);
  transform: scale(1.06);
}
.badge-ghost-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.badge-qty {
  position: absolute;
  top: -4px;
  right: -4px;
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
  z-index: 4;
}

.badge-official-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid #fffbe8;
  z-index: 4;
}
.badge-official-dot.is-official {
  background: #d4af37;
}
.badge-official-dot.is-doujin {
  background: #9c6dd6;
}

/* ==================== 其他谷子网格 ==================== */
.other-section {
  margin-top: 22px;
}
.other-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}
.other-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.65);
}
.other-count {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.goods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
}
.goods-wrapper {
  position: relative;
  transition: transform 0.2s;
}
.goods-wrapper:hover {
  transform: translateY(-4px);
  z-index: 2;
}

@media (max-width: 768px) {
  .detail-info-banner {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .add-goods-btn {
    width: 100%;
  }
  .cabinet {
    padding: 10px;
  }
  .cabinet-inner {
    padding: 10px 10px 2px;
  }
  .cabinet-inner::before {
    margin: -10px -10px 14px;
    height: 11px;
  }
  .cabinet-inner::after {
    left: 10px;
    right: 10px;          /* 与移动端内边距对齐 */
  }
  .shelf {
    margin-bottom: 16px;
  }
  /* 托架在窄屏略缩小，避免拥挤 */
  .shelf::before,
  .shelf::after {
    width: 12px;
    height: 10px;
    bottom: -7px;
  }
  .shelf-items {
    gap: 16px;
    padding: 4px 2px 6px;
  }
  .shelf-board {
    height: 12px;
  }
  .shelf-board::before,
  .shelf-board::after {
    width: 6px;           /* 端纹同步收窄 */
  }
  .badge-photo {
    width: 84px;
    height: 84px;
  }
  .goods-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}
</style>
