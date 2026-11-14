<template>
  <el-card
    class="app-filter-surface app-filter-panel"
    :class="{ 'is-collapsed': isCollapsed }"
    shadow="never"
  >
    <template #header>
      <div class="app-filter-header">
        <span class="app-filter-title">{{ title }}</span>
        <slot name="meta" />
        <div class="app-filter-actions">
          <slot name="actions" />
          <el-tooltip content="重置筛选" placement="top" :disabled="resetDisabled">
            <el-button
              text
              circle
              size="small"
              class="app-filter-reset-btn"
              :disabled="resetDisabled"
              aria-label="重置筛选"
              @click="emit('reset')"
            >
              <el-icon><RefreshLeft /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip
            v-if="collapsible"
            :content="isCollapsed ? '展开筛选' : '收起筛选'"
            placement="top"
          >
            <el-button
              text
              circle
              size="small"
              class="app-filter-toggle-btn"
              :aria-label="isCollapsed ? '展开筛选' : '收起筛选'"
              @click="toggleCollapsed"
            >
              <el-icon :class="['app-filter-toggle-icon', { expanded: !isCollapsed }]">
                <ArrowDown />
              </el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <transition name="app-filter-collapse">
      <div v-show="!isCollapsed" class="app-filter-collapse-wrapper">
        <div class="app-filter-fields app-filter-panel-fields">
          <slot />
        </div>
      </div>
    </transition>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, RefreshLeft } from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    /** 面板标题，例如「筛选作品」「筛选品类」「筛选主题」 */
    title: string
    /** 折叠状态；传入时受控（配合 v-model:collapsed），不传则组件内部自管 */
    collapsed?: boolean
    /** 是否显示折叠按钮 */
    collapsible?: boolean
    /** 没有可重置项时禁用重置按钮 */
    resetDisabled?: boolean
  }>(),
  { collapsed: undefined, collapsible: true, resetDisabled: false },
)

const emit = defineEmits<{
  (e: 'update:collapsed', value: boolean): void
  (e: 'reset'): void
}>()

const innerCollapsed = ref(false)

const isCollapsed = computed(() => props.collapsed ?? innerCollapsed.value)

const toggleCollapsed = () => {
  const next = !isCollapsed.value
  innerCollapsed.value = next
  emit('update:collapsed', next)
}
</script>

<style scoped>
/* 卡片表面、标题、操作区、字段标签、胶囊与折叠动效统一由 styles/filterPanel.css 提供 */
.app-filter-panel {
  margin-bottom: 18px;
}

.app-filter-title {
  flex-shrink: 0;
}

.app-filter-panel-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: clamp(12px, 1.6vw, 20px);
  align-items: start;
  min-height: 0;
}

:deep(.app-filter-panel-fields > *) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

/* 大屏：关键词字段占两列，其余控件等宽 */
@media (min-width: 1280px) {
  .app-filter-panel-fields {
    grid-template-columns: minmax(280px, 1.4fr) repeat(auto-fit, minmax(180px, 1fr));
  }
}
</style>
