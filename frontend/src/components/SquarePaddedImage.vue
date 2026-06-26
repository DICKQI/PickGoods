<template>
  <div class="square-padded-image">
    <WatermarkImage
      v-if="watermark && src"
      :src="src"
      :alt="alt"
      :user-id="watermarkUserId"
      fit="contain"
      class="square-padded-image__media"
    />
    <el-image
      v-else-if="src"
      :src="src"
      :alt="alt"
      fit="contain"
      :preview-src-list="previewSrcList"
      :initial-index="initialIndex"
      :loading="loading"
      class="square-padded-image__media"
    >
      <template #error>
        <div class="square-padded-image__placeholder">
          <el-icon><Picture /></el-icon>
        </div>
      </template>
    </el-image>
    <div v-else class="square-padded-image__placeholder">
      <el-icon><Picture /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Picture } from '@element-plus/icons-vue'
import WatermarkImage from '@/components/WatermarkImage.vue'

withDefaults(defineProps<{
  src?: string | null
  alt?: string
  previewSrcList?: string[]
  initialIndex?: number
  loading?: 'eager' | 'lazy'
  watermark?: boolean
  watermarkUserId?: string
}>(), {
  src: '',
  alt: '',
  previewSrcList: undefined,
  initialIndex: undefined,
  loading: undefined,
  watermark: false,
  watermarkUserId: 'Unknown',
})
</script>

<style scoped>
.square-padded-image {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: #ffffff;
}

.square-padded-image__media,
.square-padded-image__placeholder {
  width: 100%;
  height: 100%;
}

.square-padded-image__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-gray, #f5f7fa);
  color: #909399;
}
</style>
