<template>
  <section class="preorder-mobile-stats" role="group" aria-label="预购统计">
    <div class="preorder-mobile-stats__primary">
      <div class="preorder-mobile-stat preorder-mobile-stat--main">
        <span class="preorder-mobile-stat__value" data-test="pending-count">{{ stats.pending_count }}</span>
        <span class="preorder-mobile-stat__label">待补款</span>
      </div>
      <div class="preorder-mobile-stat" :class="{ 'is-zero': stats.due_this_month === 0 }">
        <span class="preorder-mobile-stat__value is-purple">{{ stats.due_this_month }}</span>
        <span class="preorder-mobile-stat__label">本月到期</span>
      </div>
      <div class="preorder-mobile-stat" :class="{ 'is-zero': stats.due_this_quarter === 0 }">
        <span class="preorder-mobile-stat__value is-purple">{{ stats.due_this_quarter }}</span>
        <span class="preorder-mobile-stat__label">本季到期</span>
      </div>
    </div>

    <Transition name="preorder-mobile-stats-collapse">
      <div v-if="expanded" class="preorder-mobile-stats__secondary">
        <div class="preorder-mobile-stat-row">
          <span class="preorder-mobile-stat-row__label">待补尾款</span>
          <span class="preorder-mobile-stat-row__value is-gold">¥{{ formatAmount(stats.total_pending_balance) }}</span>
        </div>
        <div class="preorder-mobile-stat-row">
          <span class="preorder-mobile-stat-row__label">已转正</span>
          <span class="preorder-mobile-stat-row__value">{{ stats.converted_count }} 件</span>
        </div>
      </div>
    </Transition>

    <button
      type="button"
      class="preorder-mobile-stats__toggle"
      :aria-expanded="expanded ? 'true' : 'false'"
      @click="toggleExpanded"
    >
      <span>{{ expanded ? '收起详情' : '展开详情' }}</span>
      <el-icon class="preorder-mobile-stats__chevron" :class="{ 'is-open': expanded }"><ArrowDown /></el-icon>
    </button>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import type { PreorderStats } from '@/api/types'
import { formatAmount } from '@/utils/preorder'

defineProps<{
  stats: PreorderStats
}>()

const STORAGE_KEY = 'preorder:mobile:statsExpanded'

const readStoredExpanded = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const expanded = ref(readStoredExpanded())

const toggleExpanded = () => {
  expanded.value = !expanded.value
  try {
    localStorage.setItem(STORAGE_KEY, expanded.value ? '1' : '0')
  } catch {
    // 隐私模式等场景下忽略持久化失败
  }
}
</script>

<style scoped>
.preorder-mobile-stats {
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 26px -20px rgba(17, 24, 39, 0.35);
  overflow: hidden;
}

.preorder-mobile-stats__primary {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}

.preorder-mobile-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 6px 10px;
  border-left: 1px solid rgba(212, 175, 55, 0.14);
}

.preorder-mobile-stat:first-child {
  border-left: none;
}

.preorder-mobile-stat.is-zero .preorder-mobile-stat__value,
.preorder-mobile-stat.is-zero .preorder-mobile-stat__label {
  color: #c0c4cc;
}

.preorder-mobile-stat__value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.1;
  color: #2f2a20;
}

.preorder-mobile-stat--main .preorder-mobile-stat__value {
  font-size: 32px;
}

.preorder-mobile-stat__value.is-purple {
  color: var(--accent-purple-dark);
}

.preorder-mobile-stat__label {
  font-size: 11px;
  color: #6b7280;
  font-weight: 600;
}

.preorder-mobile-stats__secondary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid rgba(212, 175, 55, 0.14);
  background: rgba(253, 249, 239, 0.6);
}

.preorder-mobile-stat-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-left: 1px solid rgba(212, 175, 55, 0.14);
}

.preorder-mobile-stat-row:first-child {
  border-left: none;
}

.preorder-mobile-stat-row__label {
  font-size: 12px;
  color: #6b7280;
}

.preorder-mobile-stat-row__value {
  font-size: 15px;
  font-weight: 800;
  color: #2f2a20;
}

.preorder-mobile-stat-row__value.is-gold {
  color: #9a740b;
}

.preorder-mobile-stats__toggle {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-top: 1px solid rgba(212, 175, 55, 0.14);
  background: rgba(255, 255, 255, 0.7);
  color: #8a6c14;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-stats__chevron {
  font-size: 12px;
  transition: transform 0.2s ease;
}

.preorder-mobile-stats__chevron.is-open {
  transform: rotate(180deg);
}

.preorder-mobile-stats-collapse-enter-active,
.preorder-mobile-stats-collapse-leave-active {
  transition: opacity 0.18s ease;
}

.preorder-mobile-stats-collapse-enter-from,
.preorder-mobile-stats-collapse-leave-to {
  opacity: 0;
}
</style>
