<template>
  <div class="preorder-mobile-card-shell">
    <div class="preorder-mobile-card__swipe-actions">
      <button type="button" class="preorder-mobile-card__swipe-btn is-edit" @click="$emit('swipeAction', 'edit')">
        编辑
      </button>
      <button type="button" class="preorder-mobile-card__swipe-btn is-delete" @click="$emit('swipeAction', 'delete')">
        删除
      </button>
    </div>

    <article
      class="preorder-mobile-card"
      :class="{ 'is-highlight': highlight, 'is-due': dueNow, 'is-dragging': isSwipeDragging }"
      :style="{ transform: `translateX(${offsetX}px)` }"
      :data-status="item.status"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <header class="preorder-mobile-card__head">
        <h3 class="preorder-mobile-card__name">{{ item.name }}</h3>
        <el-tag :type="statusTagType(item.status)" size="small" effect="light" class="preorder-mobile-card__status">
          {{ statusLabel(item.status) }}
        </el-tag>
        <button
          type="button"
          class="preorder-mobile-card__more"
          aria-label="更多操作"
          @click="$emit('menu')"
        >
          <el-icon><MoreFilled /></el-icon>
        </button>
      </header>

      <div class="preorder-mobile-card__due">
        <el-icon><Calendar /></el-icon>
        <span class="preorder-mobile-card__due-text">{{ formatMonth(item) }}补款</span>
        <span v-if="dueNow" class="preorder-mobile-card__due-tag">
          {{ item.time_granularity === 'quarter' ? '补款期' : '已到期' }}
        </span>
      </div>

      <div class="preorder-mobile-card__amounts">
        <div class="preorder-mobile-card__amount">
          <span class="preorder-mobile-card__amount-label">定金</span>
          <span class="preorder-mobile-card__amount-value is-gold">¥{{ formatAmount(item.deposit_amount) }}</span>
        </div>
        <div class="preorder-mobile-card__amount">
          <span class="preorder-mobile-card__amount-label">尾款</span>
          <span class="preorder-mobile-card__amount-value">
            {{ item.balance_amount !== null && item.balance_amount !== undefined ? '¥' + formatAmount(item.balance_amount) : '未知' }}
          </span>
        </div>
      </div>

      <p class="preorder-mobile-card__meta">
        <template v-if="item.platform || item.shop_name || item.order_no">
          <span v-if="item.platform" class="preorder-mobile-card__platform">{{ item.platform }}</span>
          <span>{{ [item.shop_name, item.order_no ? `订单 ${item.order_no}` : ''].filter(Boolean).join(' · ') }}</span>
        </template>
        <span v-else class="is-muted">—</span>
      </p>

      <p v-if="item.notes" class="preorder-mobile-card__notes" :class="{ 'is-expanded': notesExpanded }" @click="notesExpanded = !notesExpanded">
        {{ item.notes }}
      </p>

      <button
        v-if="primaryAction"
        type="button"
        class="preorder-mobile-card__primary"
        :class="`is-${primaryAction.tone}`"
        @click="$emit('primary')"
      >
        {{ primaryAction.label }}
      </button>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Calendar, MoreFilled } from '@element-plus/icons-vue'
import type { Preorder } from '@/api/types'
import { formatAmount, formatMonth, isDueNow, preorderStatusLabel, preorderStatusTagType } from '@/utils/preorder'

const props = defineProps<{
  item: Preorder
  highlight?: boolean
}>()

const emit = defineEmits<{
  primary: []
  menu: []
  swipeAction: [key: 'edit' | 'delete']
  swipeStart: []
}>()

const statusLabel = preorderStatusLabel
const statusTagType = preorderStatusTagType
const dueNow = computed(() => isDueNow(props.item))
const notesExpanded = ref(false)

const primaryAction = computed(() => {
  switch (props.item.status) {
    case 'pending':
      return { label: '标记补款', tone: 'gold' }
    case 'paid':
      return { label: '转正为谷子', tone: 'purple' }
    case 'converted':
      return props.item.goods_id ? { label: '查看谷子', tone: 'plain' } : null
    default:
      return null
  }
})

// ─── 左滑手势：露出「编辑 / 删除」───
const SWIPE_ACTIONS_WIDTH = 144
const offsetX = ref(0)
const isSwipeDragging = ref(false)
let startX = 0
let startY = 0
let dragging = false
let horizontalIntent = false

const touchPoint = (e: TouchEvent) => e.touches?.[0] ?? e.changedTouches?.[0]

const onTouchStart = (e: TouchEvent) => {
  emit('swipeStart')
  const point = touchPoint(e)
  if (!point) return
  startX = point.clientX
  startY = point.clientY
  dragging = true
  horizontalIntent = false
}

const onTouchMove = (e: TouchEvent) => {
  if (!dragging) return
  const point = touchPoint(e)
  if (!point) return
  const dx = point.clientX - startX
  const dy = point.clientY - startY

  if (!horizontalIntent) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
    if (Math.abs(dy) >= Math.abs(dx)) {
      dragging = false // 纵向滚动，放弃手势
      offsetX.value = snapOffset(offsetX.value)
      isSwipeDragging.value = false
      return
    }
    horizontalIntent = true
    isSwipeDragging.value = true
  }

  if (e.cancelable) e.preventDefault()
  const base = offsetX.value < 0 ? -SWIPE_ACTIONS_WIDTH : 0
  const next = Math.min(0, Math.max(-SWIPE_ACTIONS_WIDTH, base + dx))
  offsetX.value = next
}

const snapOffset = (value: number) => (value <= -SWIPE_ACTIONS_WIDTH / 2 ? -SWIPE_ACTIONS_WIDTH : 0)

const onTouchEnd = () => {
  if (!dragging && !horizontalIntent) return
  dragging = false
  horizontalIntent = false
  isSwipeDragging.value = false
  offsetX.value = snapOffset(offsetX.value)
}

/** 供父组件在滚动/点击其他区域时统一复位左滑状态 */
const closeSwipe = () => {
  offsetX.value = 0
}

defineExpose({ closeSwipe })
</script>

<style scoped>
.preorder-mobile-card-shell {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: #f3efe4;
}

.preorder-mobile-card__swipe-actions {
  position: absolute;
  inset: 0 0 0 auto;
  width: 144px;
  display: grid;
  grid-template-columns: 72px 72px;
}

.preorder-mobile-card__swipe-btn {
  border: none;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-card__swipe-btn.is-edit {
  background: linear-gradient(135deg, #d4af37, #b8941f);
}

.preorder-mobile-card__swipe-btn.is-delete {
  background: linear-gradient(135deg, #f56c6c, #dc2626);
}

.preorder-mobile-card {
  position: relative;
  z-index: 1;
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  transition: transform 0.16s ease-out;
  touch-action: pan-y;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-card.is-dragging {
  transition: none;
}

.preorder-mobile-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 999px;
  background: #d4af37;
}

.preorder-mobile-card[data-status='paid']::before {
  background: var(--accent-purple);
}

.preorder-mobile-card[data-status='converted']::before {
  background: linear-gradient(180deg, #d4af37, #a29bfe);
}

.preorder-mobile-card[data-status='cancelled']::before {
  background: #d1d5db;
}

.preorder-mobile-card.is-highlight {
  border-color: var(--primary-gold);
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.3);
}

.preorder-mobile-card__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-left: 6px;
}

.preorder-mobile-card__name {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-dark);
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.preorder-mobile-card__status {
  flex-shrink: 0;
}

.preorder-mobile-card__more {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  margin: -8px -6px -8px 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #8a8a95;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-card__due {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding-left: 6px;
  color: #5f5874;
  font-size: 13px;
}

.preorder-mobile-card__due .el-icon {
  color: #9a740b;
}

.preorder-mobile-card__due-text {
  font-size: 15px;
  font-weight: 700;
}

.preorder-mobile-card.is-due .preorder-mobile-card__due-text {
  color: #c77700;
}

.preorder-mobile-card__due-tag {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(245, 108, 108, 0.12);
  color: #e5484d;
  font-size: 11px;
  font-weight: 700;
}

.preorder-mobile-card__amounts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(248, 246, 252, 0.8);
}

.preorder-mobile-card__amount {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}

.preorder-mobile-card__amount-label {
  font-size: 12px;
  color: #9ca3af;
}

.preorder-mobile-card__amount-value {
  font-size: 15px;
  font-weight: 700;
  color: #2f2a20;
}

.preorder-mobile-card__amount-value.is-gold {
  color: #9a740b;
}

.preorder-mobile-card__meta {
  margin: 8px 0 0;
  padding-left: 6px;
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preorder-mobile-card__meta .is-muted {
  color: #c0c4cc;
}

.preorder-mobile-card__platform {
  display: inline-block;
  margin-right: 6px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.12);
  color: #8a650b;
  font-weight: 600;
}

.preorder-mobile-card__notes {
  margin: 6px 0 0;
  padding-left: 6px;
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
}

.preorder-mobile-card__notes.is-expanded {
  display: block;
  overflow: visible;
}

.preorder-mobile-card__primary {
  width: 100%;
  min-height: 44px;
  margin-top: 10px;
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-card__primary.is-gold {
  background: linear-gradient(135deg, #d4af37, #b8941f);
  box-shadow: 0 8px 20px -8px rgba(212, 175, 55, 0.55);
}

.preorder-mobile-card__primary.is-purple {
  background: linear-gradient(135deg, var(--accent-purple), var(--accent-purple-hover));
  box-shadow: 0 8px 20px -8px rgba(142, 125, 255, 0.55);
}

.preorder-mobile-card__primary.is-plain {
  background: #f5f5f7;
  color: var(--accent-purple-dark);
}
</style>
