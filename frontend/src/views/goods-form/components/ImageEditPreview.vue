<template>
  <section class="edit-preview" aria-label="输出预览">
    <div class="edit-preview__header">
      <div>
        <strong>输出预览</strong>
        <span>最终效果</span>
      </div>
      <el-button
        v-if="error"
        text
        size="small"
        @click="emit('retry')"
      >
        重试
      </el-button>
      <span v-else class="edit-preview__resolution">最长边 ≤ 768px</span>
    </div>

    <div class="edit-preview__stage" :class="{ 'is-loading': loading || !url }">
      <img v-if="url" :src="url" alt="当前编辑效果预览" />
      <div v-if="!url" class="edit-preview__placeholder">
        <el-icon v-if="loading" class="is-loading"><Loading /></el-icon>
        <el-icon v-else><WarningFilled /></el-icon>
        <span>{{ error || '调整参数后生成预览' }}</span>
      </div>
      <div v-if="loading && url && !error" class="edit-preview__loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>更新中</span>
      </div>
      <div v-if="error && url" class="edit-preview__error">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ error }}，当前展示上一次有效预览。</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Loading, WarningFilled } from '@element-plus/icons-vue'

defineProps<{
  url: string
  loading: boolean
  error?: string
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<style scoped>
.edit-preview {
  padding: 14px;
  border-bottom: 1px solid rgba(29, 33, 41, 0.08);
  background: #fff;
}

.edit-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.edit-preview__header > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.edit-preview__header strong {
  color: #252a33;
  font-size: 13px;
}

.edit-preview__header span {
  color: #9096a2;
  font-size: 11px;
}

.edit-preview__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 188px;
  overflow: hidden;
  border: 1px solid rgba(29, 33, 41, 0.1);
  border-radius: 12px;
  background-color: #f5f6f8;
  background-image:
    linear-gradient(45deg, rgba(20, 24, 31, 0.05) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(20, 24, 31, 0.05) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(20, 24, 31, 0.05) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(20, 24, 31, 0.05) 75%);
  background-size: 18px 18px;
  background-position: 0 0, 0 9px, 9px -9px, -9px 0;
}

.edit-preview__stage img {
  display: block;
  width: auto;
  height: auto;
  max-width: calc(100% - 20px);
  max-height: calc(100% - 20px);
  filter: drop-shadow(0 8px 18px rgba(17, 22, 30, 0.18));
}

.edit-preview__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  max-width: 86%;
  color: #858c98;
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
}

.edit-preview__loading {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(24, 28, 35, 0.72);
  color: #fff;
  font-size: 11px;
}

.edit-preview__error {
  position: absolute;
  right: 8px;
  bottom: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(129, 43, 43, 0.86);
  color: #fff;
  font-size: 10px;
  line-height: 1.4;
}
</style>
