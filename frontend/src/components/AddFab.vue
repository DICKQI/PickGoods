<template>
  <!--
    栈容器用 TransitionGroup：整理页三个分栏共用同一个 AddFab，切到没有刷新按钮的分栏时，
    紫色圆钮按谷仓同款 fab-list 动效收起，金色主按钮位置保持不变。
  -->
  <TransitionGroup
    v-if="showPrimary || showRefresh"
    name="app-fab-list"
    tag="div"
    class="app-fab-stack"
  >
    <div v-if="showRefresh" key="refresh" class="app-fab-item">
      <el-tooltip :content="refreshLabel" placement="left" :show-after="300">
        <button
          type="button"
          class="app-fab app-fab--refresh"
          :disabled="refreshing"
          :aria-label="refreshLabel"
          @click="emit('refresh')"
        >
          <el-icon :class="{ 'app-fab__spin': refreshing }"><Refresh /></el-icon>
        </button>
      </el-tooltip>
    </div>

    <div v-if="showPrimary" key="primary" class="app-fab-item">
      <el-tooltip :content="label" placement="left" :show-after="300">
        <el-dropdown
          v-if="items.length"
          trigger="click"
          placement="top-end"
          @command="handleCommand"
        >
          <button
            type="button"
            class="app-fab app-fab--primary"
            :disabled="disabled"
            :aria-label="label"
            aria-haspopup="menu"
          >
            <el-icon class="app-fab__icon"><component :is="icon" /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu class="app-fab-menu">
              <el-dropdown-item
                v-for="item in items"
                :key="item.command"
                :command="item.command"
                :divided="Boolean(item.divided)"
              >
                <div class="app-fab-menu-item">
                  <el-icon v-if="item.icon" class="app-fab-menu-icon"><component :is="item.icon" /></el-icon>
                  <span class="app-fab-menu-label">{{ item.label }}</span>
                  <span v-if="item.tag" class="app-fab-menu-tag">{{ item.tag }}</span>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <button
          v-else
          type="button"
          class="app-fab app-fab--primary"
          :disabled="disabled"
          :aria-label="label"
          @click="emit('click')"
        >
          <el-icon class="app-fab__icon"><component :is="icon" /></el-icon>
        </button>
      </el-tooltip>
    </div>
  </TransitionGroup>
</template>

<script lang="ts">
import type { Component } from 'vue'

export interface AddFabItem {
  command: string
  label: string
  icon?: Component
  /** 菜单右侧的小标签，例如「推荐」 */
  tag?: string
  /** 在菜单项之前加分隔线 */
  divided?: boolean
}

/** 悬浮按钮的全部可视化配置；整理页把它注册给外壳渲染时也复用这份类型 */
export interface AddFabProps {
  /** 主按钮的无障碍文案（悬停 tooltip 也用这个），例如「新增 / 导入」 */
  label: string
  /** 主按钮图标 */
  icon?: Component
  /** 有值时主按钮点击弹出下拉菜单 */
  items?: AddFabItem[]
  /** 是否渲染主按钮（非管理员只保留刷新按钮） */
  showPrimary?: boolean
  /** 是否显示同栈的刷新按钮 */
  showRefresh?: boolean
  /** 刷新按钮的加载态 */
  refreshing?: boolean
  disabled?: boolean
  refreshLabel?: string
}
</script>

<script setup lang="ts">
import { Plus, Refresh } from '@element-plus/icons-vue'

withDefaults(defineProps<AddFabProps>(), {
    icon: () => Plus,
    items: () => [],
    showPrimary: true,
    showRefresh: false,
    refreshing: false,
    disabled: false,
    refreshLabel: '刷新列表',
  },
)

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'command', command: string): void
  (e: 'refresh'): void
}>()

const handleCommand = (command: string | number | object) => {
  emit('command', String(command))
}
</script>

<style scoped>
/* 右下角悬浮栈：与谷仓的圆形快捷按钮同规格（52px 圆钮，间距 12px） */
.app-fab-stack {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}

/* 每个圆钮单独一层：TransitionGroup 的子元素必须是单一根节点，才能播 fab-list 动效 */
.app-fab-item {
  display: flex;
  pointer-events: none;
}

/* 与 Layout 里云展柜 fab-group 的 fab-list 动效同规格 */
.app-fab-list-move,
.app-fab-list-enter-active,
.app-fab-list-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 0.22s ease;
}

.app-fab-list-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.72);
  filter: blur(3px);
}

.app-fab-list-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.72);
  filter: blur(3px);
}

.app-fab-list-leave-active {
  position: absolute;
  right: 0;
}

.app-fab {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  padding: 0;
  border: none;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.app-fab:focus-visible {
  box-shadow: 0 0 0 3px rgba(142, 125, 255, 0.32);
}

.app-fab:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

/* 新增：谷仓同款金色圆钮 */
.app-fab--primary {
  color: #fff;
  background: linear-gradient(135deg, #f2d781 0%, #d4af37 100%);
  box-shadow: 0 8px 20px rgba(212, 175, 55, 0.42);
}

.app-fab--primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(212, 175, 55, 0.5);
}

/* 刷新：沿用页面原有的紫色圆钮 */
.app-fab--refresh {
  color: #fff;
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
  box-shadow: 0 8px 20px rgba(142, 125, 255, 0.42);
}

.app-fab--refresh:hover:not(:disabled) {
  transform: translateY(-2px) rotate(180deg);
  box-shadow: 0 12px 26px rgba(142, 125, 255, 0.5);
}

.app-fab__spin {
  animation: app-fab-spin 1s linear infinite;
}

@keyframes app-fab-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.app-fab-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 168px;
}

.app-fab-menu-icon {
  font-size: 14px;
  color: #8a84a8;
}

.app-fab-menu-label {
  flex: 1;
}

.app-fab-menu-tag {
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.16);
  color: #8a6a10;
  font-size: 11px;
  line-height: 16px;
}

@media (prefers-reduced-motion: reduce) {
  .app-fab,
  .app-fab--primary:hover:not(:disabled),
  .app-fab--refresh:hover:not(:disabled) {
    transition: none;
    transform: none;
  }

  .app-fab__spin {
    animation: none;
  }

  .app-fab-list-move,
  .app-fab-list-enter-active,
  .app-fab-list-leave-active {
    transition: none;
  }

  .app-fab-list-enter-from,
  .app-fab-list-leave-to {
    transform: none;
    filter: none;
  }
}
</style>
