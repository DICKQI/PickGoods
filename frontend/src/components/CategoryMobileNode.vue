<template>
  <div
    class="mobile-category-node"
    :class="{
      'is-expanded': isExpanded,
      'has-children': hasChildren,
      'is-root-node': nodeDepth <= 1,
      'is-child-node': nodeDepth > 1,
    }"
    :data-category-id="node.id"
  >
    <div
      class="mobile-category-surface"
      :style="{
        '--depth-color': depthColor(node.depth),
        '--depth-offset': `${Math.max(nodeDepth - 1, 0) * 12}px`,
      }"
    >
      <div class="mobile-category-main" @click="emitToggle">
        <div class="mobile-depth-rail" aria-hidden="true"></div>
        <div class="icon-placeholder">
          <el-icon><CollectionTag /></el-icon>
        </div>

        <div class="card-info">
          <div class="card-name">
            <span class="card-name-text">{{ node.name }}</span>
            <span
              v-if="node.color_tag"
              class="color-dot"
              :style="{ backgroundColor: node.color_tag || '#a3a3a3' }"
            />
          </div>
          <div class="card-path">{{ node.path_name || node.name }}</div>
          <div class="card-meta-list">
            <div class="card-meta-line">
              <span>{{ node.goods_count ?? 0 }} 件谷子</span>
            </div>
            <div v-if="hasChildren" class="card-meta-line">
              <span>{{ childrenCount }} 个子类</span>
            </div>
          </div>
        </div>

        <button
          v-if="hasChildren"
          class="mobile-expand-indicator"
          type="button"
          :aria-label="isExpanded ? '收起子类' : '展开子类'"
          @click.stop="emitToggle"
        >
          <el-icon><ArrowRight /></el-icon>
        </button>

        <div class="mobile-card-actions" @click.stop>
          <button
            v-if="authIsAdmin"
            class="mobile-drag-handle"
            type="button"
            aria-label="拖拽排序"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <button
            v-if="authIsAdmin"
            class="mobile-more"
            type="button"
            aria-label="更多操作"
            @click.stop="$emit('edit', node)"
          >
            <el-icon><MoreFilled /></el-icon>
          </button>
        </div>
      </div>

      <Transition name="category-expand">
        <div v-if="hasChildren && isExpanded" class="mobile-category-children-shell">
          <div
            class="mobile-category-children mobile-sortable-group"
            :data-parent-id="String(node.id)"
          >
            <CategoryMobileNode
              v-for="child in node.children"
              :key="child.id"
              :node="child"
              :auth-is-admin="authIsAdmin"
              :expanded-ids="expandedIds"
              :depth-color="depthColor"
              @toggle="$emit('toggle', $event)"
              @add-sub="$emit('add-sub', $event)"
              @edit="$emit('edit', $event)"
              @delete="$emit('delete', $event)"
            />
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, CollectionTag, MoreFilled } from '@element-plus/icons-vue'
import type { Category } from '@/api/types'

defineOptions({ name: 'CategoryMobileNode' })

type CategoryNode = Category & { children?: CategoryNode[]; depth?: number }

const props = defineProps<{
  node: CategoryNode
  authIsAdmin: boolean
  expandedIds: Set<number>
  depthColor: (depth?: number) => string
}>()

const emit = defineEmits<{
  toggle: [node: CategoryNode]
  'add-sub': [node: CategoryNode]
  edit: [node: CategoryNode]
  delete: [node: CategoryNode]
}>()

const nodeDepth = computed(() => props.node.depth || 1)
const childrenCount = computed(() => props.node.children?.length || 0)
const hasChildren = computed(() => childrenCount.value > 0)
const isExpanded = computed(() => props.expandedIds.has(props.node.id))

const emitToggle = () => {
  if (!hasChildren.value) return
  emit('toggle', props.node)
}
</script>

<style scoped>
.mobile-category-node {
  min-width: 0;
}

.mobile-category-node + .mobile-category-node {
  margin-top: 12px;
}

.mobile-category-node.is-child-node + .mobile-category-node.is-child-node {
  margin-top: 8px;
}

.mobile-category-surface {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(212, 175, 55, 0.12);
  box-shadow:
    0 10px 28px -20px rgba(17, 24, 39, 0.36),
    0 3px 10px -8px rgba(212, 175, 55, 0.18);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.mobile-category-node.is-child-node > .mobile-category-surface {
  border-radius: 12px;
  border-color: rgba(212, 175, 55, 0.1);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: none;
}

.mobile-category-node.is-expanded > .mobile-category-surface {
  border-color: rgba(212, 175, 55, 0.34);
  box-shadow:
    0 12px 30px -18px rgba(17, 24, 39, 0.34),
    0 4px 14px rgba(212, 175, 55, 0.12);
}

.mobile-category-node.is-child-node.is-expanded > .mobile-category-surface {
  box-shadow: none;
}

.mobile-category-surface:active {
  transform: scale(0.99);
}

.mobile-category-main {
  position: relative;
  min-height: 74px;
  padding: 14px 12px 14px calc(14px + var(--depth-offset, 0px));
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.mobile-category-node.is-child-node .mobile-category-main {
  min-height: 60px;
  padding-top: 10px;
  padding-bottom: 10px;
  grid-template-columns: 34px minmax(0, 1fr) auto auto;
  gap: 10px;
}

.mobile-depth-rail {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: max(8px, calc(8px + var(--depth-offset, 0px)));
  width: 4px;
  border-radius: 999px;
  background: var(--depth-color, var(--primary-gold));
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08);
}

.mobile-category-node.is-child-node .mobile-depth-rail {
  top: 10px;
  bottom: 10px;
  width: 3px;
}

.icon-placeholder {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.14), rgba(162, 155, 254, 0.12));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-gold-dark);
  font-size: 20px;
}

.mobile-category-node.is-child-node .icon-placeholder {
  width: 34px;
  height: 34px;
  flex-basis: 34px;
  border-radius: 10px;
  font-size: 17px;
  background: rgba(212, 175, 55, 0.08);
}

.card-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-name {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-dark);
  font-size: 16px;
  font-weight: 800;
}

.mobile-category-node.is-child-node .card-name {
  font-size: 14px;
  font-weight: 750;
}

.card-name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-dot {
  flex: 0 0 auto;
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9), 0 0 0 2px rgba(17, 24, 39, 0.04);
}

.card-path {
  min-width: 0;
  font-size: 12px;
  color: var(--text-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-category-node.is-child-node .card-path {
  font-size: 11px;
}

.card-meta-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.card-meta-line {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 20px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  background: rgba(212, 175, 55, 0.1);
  color: var(--primary-gold-dark);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.mobile-expand-indicator,
.mobile-drag-handle,
.mobile-more {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  padding: 0;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.mobile-expand-indicator {
  border: 0;
  background: rgba(212, 175, 55, 0.1);
  color: var(--primary-gold-dark);
  transition: transform var(--transition-fast), background var(--transition-fast);
}

.mobile-category-node.is-expanded > .mobile-category-surface > .mobile-category-main .mobile-expand-indicator {
  transform: rotate(90deg);
  background: rgba(212, 175, 55, 0.16);
}

.mobile-card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.mobile-drag-handle {
  border: 1px solid rgba(162, 155, 254, 0.18);
  background: rgba(162, 155, 254, 0.06);
  color: rgba(90, 75, 255, 0.72);
  cursor: grab;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}

.mobile-more {
  border: 0;
  background: rgba(245, 245, 247, 0.86);
  color: var(--text-light);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.mobile-drag-handle:active {
  background: rgba(162, 155, 254, 0.12);
  border-color: rgba(162, 155, 254, 0.3);
  color: var(--accent-purple-dark);
}

.mobile-more:active {
  background: rgba(212, 175, 55, 0.12);
  color: var(--primary-gold-dark);
}

.mobile-drag-handle svg {
  display: block;
  pointer-events: none;
}

.mobile-category-children-shell {
  display: grid;
  grid-template-rows: 1fr;
  overflow: hidden;
}

.mobile-category-children {
  min-height: 0;
  padding: 0 12px 14px calc(18px + var(--depth-offset, 0px));
  overflow: hidden;
}

.mobile-category-node.is-child-node .mobile-category-children {
  padding-right: 10px;
  padding-bottom: 10px;
}

.category-expand-enter-active,
.category-expand-leave-active {
  display: grid;
  overflow: hidden;
  transition:
    grid-template-rows 0.26s ease,
    opacity 0.22s ease,
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.category-expand-enter-from,
.category-expand-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translateY(-6px);
}

.category-expand-enter-to,
.category-expand-leave-from {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: translateY(0);
}

.mobile-category-node.sortable-chosen > .mobile-category-surface {
  transform: scale(0.98);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.mobile-category-node.sortable-ghost {
  opacity: 0.6;
}

@media (max-width: 380px) {
  .mobile-category-main {
    grid-template-columns: 36px minmax(0, 1fr) auto auto;
    gap: 8px;
    padding-right: 10px;
  }

  .icon-placeholder {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
  }

  .mobile-card-actions {
    gap: 6px;
  }

  .mobile-expand-indicator,
  .mobile-drag-handle,
  .mobile-more {
    width: 28px;
    height: 28px;
    flex-basis: 28px;
  }
}
</style>
