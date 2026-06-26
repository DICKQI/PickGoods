<template>
  <div class="detail-root">
    <div v-if="loading && !showcase" class="detail-loading" data-test="detail-loading">
      <div class="loading-hero">
        <el-skeleton :rows="3" animated />
      </div>
      <div class="loading-display">
        <el-skeleton :rows="7" animated />
      </div>
    </div>

    <div v-else-if="showcase" class="detail-content">
      <section
        class="showcase-hero"
        :class="{ 'has-cover': !!showcase.cover_image }"
        :style="heroStyle"
        data-test="showcase-detail-hero"
      >
        <div class="hero-surface">
          <div class="hero-toolbar">
            <el-button text class="hero-back-button" data-test="back-button" @click="emit('back')">
              <el-icon><ArrowLeft /></el-icon>
              <span>返回展柜</span>
            </el-button>

            <div v-if="!readonly" class="hero-actions">
              <el-button class="hero-secondary-action" data-test="edit-showcase-button" @click="emit('editShowcase')">
                <el-icon class="el-icon--left"><Edit /></el-icon>
                编辑
              </el-button>
              <el-button type="primary" class="btn-accent hero-primary-action" data-test="add-goods-button" @click="emit('addGoods')">
                <el-icon class="el-icon--left"><Goods /></el-icon>
                添加谷子
              </el-button>
              <el-dropdown trigger="click" @command="handleMoreCommand">
                <el-button circle class="hero-more-button" data-test="more-actions-button">
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="delete" class="danger-dropdown-item" data-test="delete-showcase-action">
                      <el-icon><Delete /></el-icon>
                      删除展柜
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <div class="hero-main">
            <div class="hero-copy">
              <div class="hero-kicker">云展柜陈列</div>
              <h1 class="detail-name">{{ showcase.name }}</h1>
              <p class="detail-desc" data-test="hero-description">
                {{ showcase.description || '这个展柜还没有描述，先把喜欢的谷子摆上来吧。' }}
              </p>
              <div class="detail-tags">
                <el-tag
                  size="small"
                  :type="showcase.is_public ? 'success' : 'info'"
                  effect="light"
                  round
                  data-test="hero-visibility"
                >
                  {{ showcase.is_public ? '公开展示' : '私密收藏' }}
                </el-tag>
                <span v-if="showcase.cover_image" class="cover-status">封面陈列中</span>
              </div>
            </div>

            <div class="hero-stats" aria-label="展柜统计">
              <div class="hero-stat" data-test="hero-total-count">
                <strong>{{ goods.length }}</strong>
                <span>全部谷子</span>
              </div>
              <div class="hero-stat" data-test="hero-round-count">
                <strong>{{ roundGoods.length }}</strong>
                <span>吧唧</span>
              </div>
              <div class="hero-stat" data-test="hero-paper-count">
                <strong>{{ paperGoods.length }}</strong>
                <span>纸制品</span>
              </div>
              <div class="hero-stat" data-test="hero-other-count">
                <strong>{{ otherGoods.length }}</strong>
                <span>其他</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="goods-section">
        <div v-if="goods.length === 0" class="empty-showcase-panel" data-test="empty-showcase-panel">
          <el-empty description="这个展柜还没有摆上谷子" image-size="96">
            <el-button
              v-if="!readonly"
              type="primary"
              class="btn-accent empty-add-button"
              data-test="empty-add-goods-button"
              @click="emit('addGoods')"
            >
              <el-icon class="el-icon--left"><Goods /></el-icon>
              添加第一件谷子
            </el-button>
          </el-empty>
        </div>

        <template v-else>
          <!-- 吧唧香槟金属展架 -->
          <section v-if="roundGoods.length" class="display-section round-display-section">
            <div class="cabinet-label" data-test="round-section-title">
              <div class="section-heading-copy">
                <span class="section-kicker">Round badge shelf</span>
                <h2 class="cabinet-label-title">吧唧展架</h2>
              </div>
              <span class="cabinet-label-count">{{ roundGoods.length }} 枚</span>
            </div>

            <div ref="cabinetRef" class="cabinet" :class="{ 'is-drag-active': dragging }">
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
          </section>

          <PaperAlbumDisplay
            v-if="paperGoods.length"
            :items="paperGoods"
            :showcase-id="showcase.id"
            :readonly="readonly"
            @open-goods="emit('openGoods', $event)"
            @goods-context-menu-from-dom="forwardGoodsContextMenuFromDom"
          />

          <!-- 其他谷子（非吧唧）网格 -->
          <section v-if="otherGoods.length" class="other-section display-section">
            <div class="other-header" data-test="other-section-title">
              <div class="section-heading-copy">
                <span class="section-kicker">Mixed collection</span>
                <h2 class="other-title">其他谷子</h2>
              </div>
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
          </section>
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
          width: dragGhost.width + 'px',
          height: dragGhost.height + 'px',
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Delete, Edit, Goods, MoreFilled, Picture } from '@element-plus/icons-vue'
import GoodsCard from '@/components/GoodsCard.vue'
import PaperAlbumDisplay from '@/components/showcase/PaperAlbumDisplay.vue'
import WatermarkImage from '@/components/WatermarkImage.vue'
import { groupShowcaseDisplayGoods } from './showcaseDisplayGrouping'
import { useShowcaseDisplayDragSort } from './useShowcaseDisplayDragSort'
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
  editShowcase: []
  deleteShowcase: []
  openGoods: [goods: GoodsListItem]
  goodsContextMenu: [payload: { goods: GoodsListItem; x: number; y: number }]
  goodsContextMenuFromDom: [goodsId: string, event: MouseEvent]
}>()

const noop = () => {}

const heroStyle = computed(() => {
  if (!props.showcase?.cover_image) return {}
  return {
    '--hero-cover': `url("${props.showcase.cover_image}")`,
  }
})

const handleMoreCommand = (command: string | number | object) => {
  if (command === 'delete') {
    emit('deleteShowcase')
  }
}

const forwardGoodsContextMenuFromDom = (goodsId: string, event: MouseEvent) => {
  emit('goodsContextMenuFromDom', goodsId, event)
}

const displayGroups = computed(() => groupShowcaseDisplayGoods(props.goods))
/** 吧唧（圆形）谷子：上柜展示 */
const roundGoods = computed(() => displayGroups.value.round)
/** 纸制品谷子：收纳册展示 */
const paperGoods = computed(() => displayGroups.value.paper)
/** 其他形状谷子：保留下方网格 */
const otherGoods = computed(() => displayGroups.value.other)

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
const showcaseId = computed(() => props.showcase?.id)
const readonlyRef = computed(() => props.readonly)
const {
  localOrder,
  dragging,
  dragItemId,
  dragGhost,
  onPointerDown: onBadgePointerDown,
  shouldSuppressClick,
  cleanupDrag,
} = useShowcaseDisplayDragSort({
  items: roundGoods,
  showcaseId,
  readonly: readonlyRef,
  itemSelector: '.badge-item',
  defaultRing: '#d4af37',
  ghostSize: () => {
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
    const size = isMobile ? 84 : 116
    return { width: size, height: size, radius: '50%' }
  },
})

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

/** 点击：拖曳后短时间内抑制 click，避免误开详情 */
const onBadgeClick = (item: ShowcaseGoods) => {
  if (shouldSuppressClick()) return
  if (props.readonly) return
  emit('openGoods', item.goods)
}
</script>

<style scoped>
.detail-root {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: #263238;
}

.detail-loading {
  display: grid;
  gap: 18px;
  padding: 4px;
}
.loading-hero,
.loading-display {
  border-radius: 18px;
  padding: 22px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(212, 175, 55, 0.12);
}

.detail-content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.showcase-hero {
  min-height: 260px;
  border-radius: 22px;
  padding: 1px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 16%, rgba(255, 255, 255, 0.92), transparent 24%),
    radial-gradient(circle at 82% 20%, rgba(162, 155, 254, 0.26), transparent 30%),
    linear-gradient(135deg, rgba(212, 175, 55, 0.28), rgba(162, 155, 254, 0.18) 42%, rgba(255, 255, 255, 0.7));
  box-shadow:
    0 24px 60px -36px rgba(80, 65, 24, 0.46),
    inset 0 0 0 1px rgba(255, 255, 255, 0.48);
}
.showcase-hero.has-cover {
  background:
    linear-gradient(135deg, rgba(21, 18, 12, 0.52), rgba(63, 47, 16, 0.3)),
    var(--hero-cover) center / cover no-repeat;
}
.showcase-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.76) 48%, rgba(255, 255, 255, 0.36)),
    repeating-linear-gradient(90deg, rgba(212, 175, 55, 0.07) 0 1px, transparent 1px 12px);
  pointer-events: none;
}
.showcase-hero.has-cover::before {
  background:
    linear-gradient(90deg, rgba(18, 16, 12, 0.78), rgba(18, 16, 12, 0.58) 42%, rgba(18, 16, 12, 0.2)),
    radial-gradient(circle at 80% 16%, rgba(212, 175, 55, 0.28), transparent 28%);
}
.showcase-hero::after {
  content: '';
  position: absolute;
  left: 26px;
  right: 26px;
  bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.62), transparent);
}
.hero-surface {
  position: relative;
  z-index: 1;
  min-height: 258px;
  padding: 18px 22px 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 36px;
}
.hero-toolbar,
.hero-actions,
.hero-main,
.hero-stats,
.detail-tags {
  display: flex;
  align-items: center;
}
.hero-toolbar {
  justify-content: space-between;
  gap: 16px;
}
.hero-actions {
  gap: 10px;
}
.hero-back-button,
.hero-secondary-action,
.hero-more-button {
  border: 1px solid rgba(212, 175, 55, 0.22);
  background: rgba(255, 255, 255, 0.72);
  color: rgba(38, 50, 56, 0.84);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.has-cover .hero-back-button,
.has-cover .hero-secondary-action,
.has-cover .hero-more-button {
  background: rgba(255, 255, 255, 0.16);
  color: #fffaf0;
  border-color: rgba(255, 255, 255, 0.24);
}
.hero-back-button {
  gap: 6px;
  padding: 8px 10px;
  border-radius: 999px;
}
.hero-secondary-action,
.hero-primary-action,
.hero-more-button {
  height: 36px;
}
.hero-secondary-action,
.hero-primary-action {
  border-radius: 999px;
  padding: 0 16px;
}
.hero-primary-action,
.empty-add-button {
  box-shadow: 0 10px 24px -14px rgba(162, 155, 254, 0.9);
}
.hero-more-button {
  width: 36px;
}
.hero-main {
  justify-content: space-between;
  align-items: flex-end;
  gap: 30px;
}
.hero-copy {
  max-width: min(720px, 64%);
}
.hero-kicker,
.section-kicker,
.cover-status {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
.hero-kicker {
  margin-bottom: 10px;
  color: rgba(154, 116, 64, 0.8);
}
.has-cover .hero-kicker {
  color: rgba(255, 244, 214, 0.82);
}
.detail-name {
  font-size: clamp(32px, 4vw, 52px);
  line-height: 1.06;
  color: rgba(26, 26, 26, 0.92);
  margin: 0;
  font-weight: 900;
}
.has-cover .detail-name {
  color: #fffaf0;
  text-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
}
.detail-desc {
  max-width: 620px;
  color: rgba(38, 50, 56, 0.68);
  font-size: 14px;
  margin: 12px 0 14px;
  line-height: 1.7;
}
.has-cover .detail-desc {
  color: rgba(255, 250, 240, 0.82);
}
.detail-tags {
  gap: 8px;
  flex-wrap: wrap;
}
.cover-status {
  color: rgba(154, 116, 64, 0.76);
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(212, 175, 55, 0.2);
}
.has-cover .cover-status {
  color: rgba(255, 244, 214, 0.86);
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.22);
}
.hero-stats {
  min-width: 300px;
  justify-content: flex-end;
  gap: 10px;
}
.hero-stat {
  width: 92px;
  min-height: 78px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(212, 175, 55, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
.has-cover .hero-stat {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.22);
}
.hero-stat strong {
  display: block;
  font-size: 26px;
  line-height: 1;
  color: #9a7440;
  font-weight: 900;
}
.has-cover .hero-stat strong {
  color: #fff4d6;
}
.hero-stat span {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: rgba(38, 50, 56, 0.58);
}
.has-cover .hero-stat span {
  color: rgba(255, 250, 240, 0.78);
}
.danger-dropdown-item {
  color: #f56c6c;
}

/* 香槟金属展示柜局部调色板：仅服务吧唧展架，不影响其他谷子陈列 */
.goods-section {
  --c-display-shell: #fff8e6;
  --c-display-edge: #d4af37;
  --c-display-rail-light: #fff2bf;
  --c-display-rail-mid: #d8bd72;
  --c-display-rail-dark: #9f7a31;
  --c-display-panel: #f7f5ef;
  --c-display-holo: 162, 155, 254;
  --c-display-cyan: 64, 221, 255;
  --c-display-shadow: 70, 50, 18;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 0 4px 8px;
}
.display-section,
.empty-showcase-panel {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(212, 175, 55, 0.12);
  box-shadow: 0 18px 46px -36px rgba(50, 36, 10, 0.34);
}
.display-section {
  padding: 20px;
}
.round-display-section {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 251, 241, 0.7)),
    radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.12), transparent 34%);
}
.empty-showcase-panel {
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}
.section-heading-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.section-kicker {
  color: rgba(var(--c-display-shadow), 0.54);
}

/* ==================== 吧唧香槟金属展架 ==================== */
.cabinet-label {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.cabinet-label-title {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
  color: rgba(var(--c-display-shadow), 0.86);
  margin: 0;
}
.cabinet-label-count {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 800;
  color: rgba(var(--c-display-shadow), 0.62);
  padding: 5px 10px;
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(var(--c-display-holo), 0.1), rgba(var(--c-display-cyan), 0.08)),
    rgba(255, 248, 230, 0.7);
  border: 1px solid rgba(212, 175, 55, 0.24);
}

.cabinet {
  max-width: 720px;
  margin: 0 auto;
  border-radius: 18px;
  padding: 14px;
  background:
    linear-gradient(135deg, rgba(var(--c-display-holo), 0.16), transparent 34%, rgba(var(--c-display-cyan), 0.12) 68%, transparent),
    linear-gradient(160deg, #fffdf6 0%, var(--c-display-shell) 48%, #ead8a4 100%);
  border: 1px solid rgba(212, 175, 55, 0.34);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    inset 0 0 0 1px rgba(255, 247, 216, 0.68),
    inset 0 0 0 2px rgba(var(--c-display-holo), 0.06),
    0 22px 54px -30px rgba(var(--c-display-shadow), 0.34),
    0 8px 22px -16px rgba(var(--c-display-holo), 0.35);
}

.cabinet-inner {
  position: relative;
  border-radius: 13px;
  padding: 14px 14px 4px;
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(255, 255, 255, 0.74) 0%, rgba(255, 255, 255, 0.18) 42%, transparent 68%),
    radial-gradient(110% 78% at 90% 8%, rgba(var(--c-display-holo), 0.12), transparent 46%),
    radial-gradient(100% 74% at 6% 16%, rgba(var(--c-display-cyan), 0.075), transparent 48%),
    linear-gradient(112deg, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0.08) 42%, rgba(var(--c-display-holo), 0.045) 72%, rgba(255, 255, 255, 0.2) 100%),
    linear-gradient(180deg, #fffef9 0%, var(--c-display-panel) 56%, #eee8da 100%);
  box-shadow:
    inset 0 10px 18px -14px rgba(var(--c-display-shadow), 0.22),
    inset 5px 0 12px -9px rgba(var(--c-display-shadow), 0.28),
    inset -5px 0 12px -9px rgba(var(--c-display-shadow), 0.28),
    inset 0 0 0 1px rgba(212, 175, 55, 0.18),
    inset 0 0 0 2px rgba(255, 255, 255, 0.34);
}

.cabinet-inner::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 2px;
  height: 6px;
  border-radius: 50%;
  background:
    radial-gradient(ellipse at center, rgba(var(--c-display-holo), 0.16) 0%, transparent 68%),
    radial-gradient(ellipse at center, rgba(var(--c-display-shadow), 0.08) 0%, transparent 72%);
  pointer-events: none;
  z-index: 0;
}

.cabinet-inner::before {
  content: '';
  display: block;
  height: 10px;
  margin: -14px -14px 20px;
  border-radius: 13px 13px 7px 7px;
  background:
    linear-gradient(90deg, rgba(var(--c-display-holo), 0.1), transparent 24%, rgba(255, 255, 255, 0.22) 52%, transparent 76%, rgba(var(--c-display-cyan), 0.08)),
    linear-gradient(180deg, #fff6ce 0%, var(--c-display-rail-light) 34%, var(--c-display-rail-mid) 72%, var(--c-display-rail-dark) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.68),
    inset 0 -1px 0 rgba(var(--c-display-shadow), 0.28),
    0 7px 16px -12px rgba(var(--c-display-shadow), 0.42);
}

.shelf {
  position: relative;
  z-index: 1;
  margin-bottom: 24px;
}
.shelf:last-child {
  margin-bottom: 8px;
}

.shelf::before,
.shelf::after {
  content: '';
  position: absolute;
  bottom: -6px;
  width: 18px;
  height: 8px;
  pointer-events: none;
  z-index: 0;
  background:
    linear-gradient(180deg, rgba(255, 246, 206, 0.72) 0%, var(--c-display-rail-mid) 42%, var(--c-display-rail-dark) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.36),
    0 3px 6px -5px rgba(var(--c-display-shadow), 0.48);
  border-radius: 0 0 5px 5px;
}
.shelf::before { left: 18px; }
.shelf::after { right: 18px; }

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
  height: 10px;
  margin: -2px 0 0;
  border-radius: 999px;
  position: relative;
  z-index: 1;
  background:
    linear-gradient(90deg, rgba(var(--c-display-holo), 0.1), transparent 22%, rgba(255, 255, 255, 0.2) 50%, transparent 78%, rgba(var(--c-display-cyan), 0.08)),
    linear-gradient(180deg, #fff7d3 0%, var(--c-display-rail-light) 28%, var(--c-display-rail-mid) 68%, var(--c-display-rail-dark) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.68),
    inset 0 -1px 0 rgba(var(--c-display-shadow), 0.26),
    0 8px 16px -13px rgba(var(--c-display-shadow), 0.46);
}

.shelf-board::before,
.shelf-board::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.34), transparent 48%),
    linear-gradient(90deg, var(--c-display-rail-dark) 0%, var(--c-display-rail-mid) 100%);
  box-shadow: inset 0 0 0 1px rgba(var(--c-display-shadow), 0.12);
}
.shelf-board::before {
  left: 0;
  border-radius: 999px 0 0 999px;
}
.shelf-board::after {
  right: 0;
  border-radius: 0 999px 999px 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.34), transparent 48%),
    linear-gradient(90deg, var(--c-display-rail-mid) 0%, var(--c-display-rail-dark) 100%);
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
    0 0 0 2px #fffdf4,
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
  isolation: isolate;
  background: #fffdf4;
  box-shadow:
    0 0 0 2px #fffdf4,
    0 0 0 4px var(--badge-ring, #d4af37),
    inset 0 0 0 1px rgba(255, 255, 255, 0.48);
  filter:
    drop-shadow(0 2px 2px rgba(var(--c-display-shadow), 0.2))
    drop-shadow(0 7px 7px rgba(52, 47, 33, 0.18));
  transition: box-shadow 0.22s ease;
}

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
    0 0 0 2px #fffdf4,
    0 0 0 4px var(--badge-ring, #d4af37),
    inset 0 0 0 1px rgba(255, 255, 255, 0.55),
    0 0 11px 1px rgba(212, 175, 55, 0.34);
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
  color: rgba(var(--c-display-shadow), 0.34);
  font-size: 26px;
}

.badge-ghost {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  border-radius: 50%;
  overflow: hidden;
  background: #fffdf4;
  box-shadow:
    0 0 0 2px #fffdf4,
    0 0 0 4px var(--badge-ring, #d4af37),
    inset 0 0 0 1px rgba(255, 255, 255, 0.45),
    0 12px 24px -6px rgba(31, 28, 20, 0.34);
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
  border: 1.5px solid #fffdf4;
  z-index: 4;
}
.badge-official-dot.is-official {
  background: var(--c-display-edge);
}
.badge-official-dot.is-doujin {
  background: #9c6dd6;
}

/* ==================== 其他谷子网格 ==================== */
.other-section {
  margin-top: 0;
}
.other-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.other-title {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
  color: rgba(38, 50, 56, 0.82);
  margin: 0;
}
.other-count {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 800;
  color: rgba(38, 50, 56, 0.56);
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(162, 155, 254, 0.1);
  border: 1px solid rgba(162, 155, 254, 0.18);
}
.goods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
  gap: 18px;
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
  .showcase-hero {
    border-radius: 16px;
  }
  .hero-surface {
    min-height: auto;
    padding: 14px;
    gap: 24px;
  }
  .hero-toolbar,
  .hero-main {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .hero-actions {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
  }
  .hero-copy {
    max-width: none;
  }
  .detail-name {
    font-size: 30px;
  }
  .hero-stats {
    min-width: 0;
    justify-content: stretch;
  }
  .hero-stat {
    width: auto;
    flex: 1;
  }
  .display-section {
    padding: 14px;
  }
  .cabinet {
    padding: 10px;
  }
  .cabinet-inner {
    padding: 10px 10px 2px;
  }
  .cabinet-inner::before {
    margin: -10px -10px 16px;
    height: 8px;
  }
  .cabinet-inner::after {
    left: 10px;
    right: 10px;          /* 与移动端内边距对齐 */
  }
  .shelf {
    margin-bottom: 16px;
  }
  .shelf::before,
  .shelf::after {
    width: 14px;
    height: 6px;
    bottom: -5px;
  }
  .shelf::before { left: 12px; }
  .shelf::after { right: 12px; }
  .shelf-items {
    gap: 16px;
    padding: 4px 2px 6px;
  }
  .shelf-board {
    height: 8px;
  }
  .shelf-board::before,
  .shelf-board::after {
    width: 3px;
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
