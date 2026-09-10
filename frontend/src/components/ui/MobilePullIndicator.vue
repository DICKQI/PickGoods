<template>
  <div
    class="mobile-pull-indicator"
    :style="{ height: `${distance}px` }"
    :aria-hidden="distance > 0 ? 'false' : 'true'"
  >
    <el-icon :class="{ 'is-spinning': refreshing }"><Loading /></el-icon>
    <span>{{ refreshing ? '刷新中…' : '下拉刷新' }}</span>
  </div>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'

withDefaults(defineProps<{
  /** 当前下拉高度（px），由各页面的下拉刷新逻辑提供。 */
  distance: number
  refreshing?: boolean
}>(), {
  refreshing: false,
})
</script>

<style scoped>
/* 移动端下拉刷新统一外观：以预购页为准（金色小字 + 旋转 loading 图标）。 */
.mobile-pull-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  overflow: hidden;
  color: #9a740b;
  font-size: 12px;
  font-weight: 700;
  transition: height 0.18s ease;
}

.mobile-pull-indicator .is-spinning {
  animation: mobile-pull-indicator-spin 1s linear infinite;
}

@keyframes mobile-pull-indicator-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-pull-indicator { transition: none; }
  .mobile-pull-indicator .is-spinning { animation: none; }
}
</style>
