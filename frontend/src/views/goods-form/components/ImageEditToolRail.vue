<template>
  <nav class="edit-tool-rail" aria-label="图片编辑工具">
    <button
      v-for="tool in IMAGE_EDITOR_TOOLS"
      :key="tool.key"
      type="button"
      class="edit-tool-rail__item"
      :class="{ 'is-active': tool.key === activeTool }"
      :disabled="disabled"
      :aria-current="tool.key === activeTool ? 'page' : undefined"
      @click="emit('change', tool.key)"
    >
      <el-icon>
        <component :is="toolIcons[tool.key]" />
      </el-icon>
      <span>{{ tool.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { Brush, Crop, Operation, ScaleToOriginal } from '@element-plus/icons-vue'
import { IMAGE_EDITOR_TOOLS, type ImageEditorTool } from '@/views/goods-form/imageEditorConfig'

defineProps<{
  activeTool: ImageEditorTool
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: [tool: ImageEditorTool]
}>()

const toolIcons = {
  crop: Crop,
  adjust: Brush,
  correct: Operation,
  shape: ScaleToOriginal,
}
</script>

<style scoped>
.edit-tool-rail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 8px;
  border-right: 1px solid rgba(29, 33, 41, 0.08);
  background: #fafafb;
}

.edit-tool-rail__item {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
  width: 56px;
  min-height: 60px;
  padding: 8px 4px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: #6d7481;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease;
}

.edit-tool-rail__item:hover,
.edit-tool-rail__item:focus-visible {
  outline: none;
  color: var(--primary-gold-dark);
  background: #fff8e7;
}

.edit-tool-rail__item.is-active {
  color: #5f4a0d;
  background: linear-gradient(135deg, #fff6db, #f7e9bd);
  box-shadow: inset 0 0 0 1px rgba(184, 148, 31, 0.2);
}

.edit-tool-rail__item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.edit-tool-rail__item .el-icon {
  font-size: 19px;
}

@media (max-width: 768px) {
  .edit-tool-rail {
    flex-direction: row;
    justify-content: space-around;
    gap: 4px;
    padding: 8px;
    border-right: 0;
    border-bottom: 1px solid rgba(29, 33, 41, 0.08);
  }

  .edit-tool-rail__item {
    flex: 1;
    min-width: 0;
    min-height: 52px;
  }
}
</style>
