<template>
  <div class="edit-toolbar">
    <div class="edit-toolbar__history">
      <el-button
        text
        :icon="RefreshLeft"
        :disabled="!ready || !canUndo || confirming"
        title="撤回（Ctrl/Cmd+Z）"
        @click="emit('undo')"
      >
        撤回
      </el-button>
      <el-button
        text
        :icon="RefreshRight"
        :disabled="!ready || !canRedo || confirming"
        title="恢复（Ctrl/Cmd+Shift+Z）"
        @click="emit('redo')"
      >
        恢复
      </el-button>
      <el-button
        text
        :icon="Delete"
        :disabled="!ready || confirming"
        @click="emit('reset')"
      >
        重置
      </el-button>
      <el-button
        text
        :icon="View"
        :class="{ 'is-comparing': comparing }"
        :disabled="!ready || confirming"
        :aria-pressed="comparing"
        @mousedown="startCompare"
        @mouseup="stopCompare"
        @mouseleave="stopCompare"
        @touchstart.prevent="startCompare"
        @touchend="stopCompare"
        @touchcancel="stopCompare"
        @keydown.space.prevent="startCompare"
        @keyup.space="stopCompare"
        @keydown.enter.prevent="startCompare"
        @keyup.enter="stopCompare"
      >
        按住看原图
      </el-button>
    </div>

    <div class="edit-toolbar__actions">
      <el-button :disabled="confirming" @click="emit('cancel')">取消</el-button>
      <el-button
        type="primary"
        :loading="confirming"
        :disabled="!ready"
        @click="emit('confirm')"
      >
        确认
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Delete, RefreshLeft, RefreshRight, View } from '@element-plus/icons-vue'

defineProps<{
  canUndo: boolean
  canRedo: boolean
  confirming: boolean
  ready: boolean
  comparing: boolean
}>()

const emit = defineEmits<{
  undo: []
  redo: []
  reset: []
  cancel: []
  confirm: []
  'compare-start': []
  'compare-stop': []
}>()

const startCompare = () => emit('compare-start')
const stopCompare = () => emit('compare-stop')
</script>

<style scoped>
.edit-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
}

.edit-toolbar__history,
.edit-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.edit-toolbar :deep(.el-button) {
  margin: 0;
}

.edit-toolbar__history :deep(.el-button.is-comparing) {
  color: var(--primary-gold-dark);
  background: #fff7e5;
}

.edit-toolbar__actions :deep(.el-button) {
  min-width: 76px;
}

@media (max-width: 980px) {
  .edit-toolbar__history :deep(.el-button span) {
    display: none;
  }

  .edit-toolbar__history :deep(.el-button) {
    width: 34px;
    padding: 8px;
  }
}

@media (max-width: 768px) {
  .edit-toolbar {
    width: 100%;
  }

  .edit-toolbar__history :deep(.el-button),
  .edit-toolbar__actions :deep(.el-button) {
    min-width: 36px;
  }

}
</style>
