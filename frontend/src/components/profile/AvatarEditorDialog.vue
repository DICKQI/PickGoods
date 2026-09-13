<template>
  <el-dialog
    :model-value="modelValue"
    :fullscreen="isMobile"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    class="avatar-editor-dialog"
    @open="resetEditor"
    @closed="cleanup"
    @update:model-value="handleVisibleChange"
  >
    <section class="avatar-editor" aria-labelledby="avatar-editor-title">
      <header class="avatar-editor__header">
        <div>
          <p>PROFILE PHOTO</p>
          <h2 id="avatar-editor-title">修改头像</h2>
          <span>选择清晰的方形图片，调整后会自动裁成 1:1。</span>
        </div>
        <el-button
          text
          circle
          aria-label="关闭头像编辑"
          :disabled="busy"
          @click="close"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </header>

      <div class="avatar-editor__body">
        <template v-if="!sourceUrl">
          <div class="avatar-preview">
            <el-avatar :size="132" :src="currentAvatar || undefined">
              <span>{{ fallbackText }}</span>
            </el-avatar>
            <p>{{ currentAvatar ? '当前头像' : '当前使用默认首字母头像' }}</p>
          </div>

          <div class="avatar-actions">
            <el-button type="primary" @click="pickFile">
              <el-icon><Upload /></el-icon>
              <span>{{ currentAvatar ? '更换头像' : '上传头像' }}</span>
            </el-button>
            <el-button
              v-if="currentAvatar"
              :loading="removing"
              :disabled="uploading"
              @click="emit('remove')"
            >
              <el-icon><RefreshLeft /></el-icon>
              <span>恢复默认头像</span>
            </el-button>
          </div>

          <p class="avatar-hint">支持 JPG、PNG、WebP 等图片格式，文件不超过 5MB。</p>
        </template>

        <template v-else>
          <div class="crop-canvas">
            <VuePictureCropper :img="sourceUrl" :options="cropperOptions" />
          </div>
          <div class="crop-toolbar">
            <span>拖动图片调整位置，滚轮或双指缩放</span>
            <div>
              <el-button text @click="pickFile">重新选择</el-button>
              <el-button text @click="resetCrop">重置裁剪</el-button>
            </div>
          </div>
        </template>
      </div>

      <footer v-if="sourceUrl" class="avatar-editor__footer">
        <el-button :disabled="busy" @click="close">取消</el-button>
        <el-button type="primary" :loading="uploading" :disabled="removing" @click="confirmCrop">
          保存头像
        </el-button>
      </footer>

      <input
        ref="fileInput"
        class="avatar-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        @change="handleFileChange"
      />
    </section>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, RefreshLeft, Upload } from '@element-plus/icons-vue'
import VuePictureCropper, { cropper } from 'vue-picture-cropper'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'

const props = defineProps<{
  modelValue: boolean
  currentAvatar?: string | null
  fallbackText: string
  uploading?: boolean
  removing?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [file: File]
  remove: []
}>()

const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const { isMobile } = useResponsiveDevice()
const fileInput = ref<HTMLInputElement>()
const sourceUrl = ref('')
const busy = computed(() => Boolean(props.uploading || props.removing))
const cropperOptions = {
  aspectRatio: 1,
  autoCrop: true,
  autoCropArea: 1,
  center: true,
  cropBoxMovable: false,
  cropBoxResizable: false,
  dragMode: 'move',
  guides: true,
  movable: true,
  responsive: true,
  viewMode: 1,
  zoomable: true,
  outputType: 'png',
}

function clearObjectUrl() {
  if (sourceUrl.value.startsWith('blob:')) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''
}

function resetEditor() {
  clearObjectUrl()
  if (fileInput.value) fileInput.value.value = ''
}

function cleanup() {
  clearObjectUrl()
}

function close() {
  if (busy.value) return
  emit('update:modelValue', false)
}

function handleVisibleChange(value: boolean) {
  if (!value && busy.value) return
  emit('update:modelValue', value)
}

function pickFile() {
  if (busy.value) return
  fileInput.value?.click()
}

function resetCrop() {
  cropper?.reset()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }
  if (file.size > MAX_AVATAR_SIZE) {
    ElMessage.error('头像文件不能超过 5MB')
    return
  }
  clearObjectUrl()
  sourceUrl.value = URL.createObjectURL(file)
}

async function confirmCrop() {
  if (!sourceUrl.value || busy.value) return
  const blob = await cropper?.getBlob({
    width: 1024,
    height: 1024,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  })
  if (!blob) {
    ElMessage.error('头像裁剪失败，请重新选择图片')
    return
  }
  const file = new File([blob], 'avatar.png', { type: 'image/png' })
  emit('confirm', file)
}

onBeforeUnmount(cleanup)
</script>

<style scoped>
:global(.avatar-editor-dialog .el-dialog__header),
:global(.avatar-editor-dialog .el-dialog__footer) {
  display: none;
}

:global(.avatar-editor-dialog .el-dialog__body) {
  padding: 0;
}

:global(.avatar-editor-dialog.is-fullscreen) {
  height: 100dvh;
  margin: 0;
  display: flex;
  flex-direction: column;
}

:global(.avatar-editor-dialog.is-fullscreen .el-dialog__body) {
  flex: 1;
  min-height: 0;
}

.avatar-editor {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--bg-white);
}

.avatar-editor__header {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid rgba(44, 39, 30, 0.07);
}

.avatar-editor__header p {
  margin: 0 0 5px;
  color: var(--primary-gold-dark);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.avatar-editor__header h2 {
  margin: 0;
  color: var(--text-dark);
  font-size: 21px;
}

.avatar-editor__header span {
  display: block;
  margin-top: 6px;
  color: var(--text-light);
  font-size: var(--font-small);
  line-height: 1.5;
}

.avatar-editor__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.avatar-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 12px 0 22px;
}

.avatar-preview :deep(.el-avatar) {
  color: #fff;
  font-size: 44px;
  font-weight: 700;
  background:
    radial-gradient(circle at 28% 20%, rgba(255, 255, 255, 0.42), transparent 34%),
    linear-gradient(135deg, var(--primary-gold), var(--accent-purple));
  box-shadow: 0 14px 30px rgba(184, 148, 31, 0.2);
}

.avatar-preview :deep(.el-avatar img) {
  object-fit: cover;
}

.avatar-preview p,
.avatar-hint {
  margin: 0;
  color: var(--text-light);
  font-size: var(--font-small);
}

.avatar-actions {
  display: grid;
  gap: 10px;
}

.avatar-actions :deep(.el-button) {
  width: 100%;
  min-height: 42px;
  margin: 0;
  border-radius: 11px;
}

.avatar-hint {
  margin-top: 14px;
  line-height: 1.6;
  text-align: center;
}

.crop-canvas {
  min-height: 400px;
  overflow: hidden;
  border-radius: 14px;
  background: #1f1f22;
}

.crop-canvas :deep(.vue--picture-cropper__wrap) {
  min-height: 400px;
}

.crop-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}

.crop-toolbar > span {
  color: var(--text-light);
  font-size: var(--font-small);
}

.crop-toolbar > div {
  display: flex;
  flex: none;
  gap: 4px;
}

.crop-toolbar :deep(.el-button) {
  margin: 0;
}

.avatar-editor__footer {
  display: flex;
  flex: none;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(44, 39, 30, 0.07);
}

.avatar-editor__footer :deep(.el-button) {
  min-width: 104px;
  margin: 0;
  border-radius: 10px;
}

.avatar-file-input {
  display: none;
}

@media (max-width: 768px) {
  .avatar-editor__header {
    padding: calc(18px + env(safe-area-inset-top)) 18px 16px;
  }

  .avatar-editor__body {
    padding: 18px;
  }

  .crop-canvas,
  .crop-canvas :deep(.vue--picture-cropper__wrap) {
    min-height: 48dvh;
  }

  .crop-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .avatar-editor__footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
  }

  .avatar-editor__footer :deep(.el-button) {
    width: 100%;
    min-width: 0;
  }
}
</style>
