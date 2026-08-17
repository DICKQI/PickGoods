<template>
  <div class="preorder-editor-form-root">
    <el-form :ref="setFormRef" :model="form" :rules="formRules" label-position="top" class="preorder-editor-form">
      <section class="preorder-editor-section">
        <div class="preorder-editor-section-title">
          <h4>基本信息</h4>
          <p>手办名称与下单渠道</p>
        </div>
        <el-form-item label="手办名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：流萤 1/7 手办" maxlength="200" />
        </el-form-item>
        <div class="preorder-editor-grid">
          <el-form-item label="下单平台">
            <el-select v-model="form.platform" placeholder="选择或输入平台" filterable allow-create clearable style="width: 100%">
              <el-option v-for="p in PLATFORM_OPTIONS" :key="p" :label="p" :value="p" />
            </el-select>
          </el-form-item>
          <el-form-item label="店铺名称">
            <el-input v-model="form.shop_name" placeholder="选填" maxlength="100" />
          </el-form-item>
        </div>
        <el-form-item label="订单号">
          <el-input v-model="form.order_no" placeholder="选填" maxlength="100" />
        </el-form-item>
      </section>

      <section class="preorder-editor-section">
        <div class="preorder-editor-section-title">
          <h4>金额与补款</h4>
          <p>定金必填，尾款未知可留空</p>
        </div>
        <div class="preorder-editor-grid">
          <el-form-item label="定金金额" prop="deposit_amount">
            <el-input-number v-model="form.deposit_amount" :min="0" :precision="2" :controls="false" placeholder="0.00" style="width: 100%" />
          </el-form-item>
          <el-form-item label="尾款金额">
            <el-input-number v-model="form.balance_amount" :min="0" :precision="2" :controls="false" placeholder="未知可留空" style="width: 100%" />
          </el-form-item>
        </div>
        <div v-if="!editingTarget" class="preorder-editor-grid preorder-time-grid">
          <el-form-item label="时间粒度">
            <el-segmented
              v-model="form.time_granularity"
              :options="GRANULARITY_OPTIONS"
              class="granularity-select"
              @change="handleGranularityChange"
            />
          </el-form-item>
          <el-form-item :label="form.time_granularity === 'quarter' ? '预计补款季度' : '预计补款月份'" prop="estimated_month">
            <el-date-picker
              v-if="form.time_granularity === 'month'"
              v-model="form.estimated_month"
              type="month"
              value-format="YYYY-MM"
              placeholder="选择预计补款月份"
              style="width: 100%"
              :clearable="false"
            />
            <!-- EP 2.13 无 type="quarter" 面板，季度用下拉选择（契约值 'YYYY-Qn'） -->
            <el-select
              v-else
              v-model="form.estimated_month"
              placeholder="选择预计补款季度"
              style="width: 100%"
              class="quarter-select"
            >
              <el-option v-for="opt in quarterOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
        </div>
      </section>

      <section class="preorder-editor-section">
        <div class="preorder-editor-section-title">
          <h4>备注</h4>
          <p>选填</p>
        </div>
        <el-form-item label="">
          <el-input v-model="form.notes" type="textarea" :rows="3" placeholder="选填" />
        </el-form-item>
      </section>

      <!-- 截图识别（弱化入口：默认收起，置于表单末尾） -->
      <section v-if="!editingTarget" class="preorder-editor-section preorder-ocr-section">
        <button type="button" class="preorder-ocr-toggle" @click="ocrPanelVisible = !ocrPanelVisible">
          <el-icon><Picture /></el-icon>
          <span>{{ ocrPanelVisible ? '收起截图识别' : '📸 用订单截图自动填写' }}</span>
          <el-icon class="preorder-ocr-chevron" :class="{ 'is-open': ocrPanelVisible }"><ArrowDown /></el-icon>
        </button>
        <p class="preorder-ocr-hint">上传淘宝 / 哔哩哔哩会员购订单截图，自动填入表单；也可完全不用，手动填写即可</p>
        <div v-if="ocrPanelVisible" class="preorder-ocr-body">
          <!-- 桌面端：通用文件上传入口 -->
          <el-upload
            v-if="!isMobile"
            :ref="setOcrUploadRef"
            class="preorder-ocr-upload"
            :show-file-list="false"
            :auto-upload="false"
            accept="image/*"
            :on-change="handleDesktopFileChange"
          >
            <div class="preorder-ocr-trigger" :class="{ 'is-loading': ocrUploading }">
              <el-icon v-if="!ocrUploading"><Picture /></el-icon>
              <el-icon v-else class="is-spinning"><Loading /></el-icon>
              <span>{{ ocrUploading ? '识别中...' : '上传订单截图自动识别' }}</span>
            </div>
          </el-upload>
          <!-- 移动端：拍照 / 相册来源选择 -->
          <button
            v-else
            type="button"
            class="preorder-ocr-trigger"
            :class="{ 'is-loading': ocrUploading }"
            @click="photoSourceSheetVisible = true"
          >
            <el-icon v-if="!ocrUploading"><Picture /></el-icon>
            <el-icon v-else class="is-spinning"><Loading /></el-icon>
            <span>{{ ocrUploading ? '识别中...' : '拍照 / 相册上传订单截图' }}</span>
          </button>
          <input
            v-show="false"
            ref="cameraInputRef"
            type="file"
            accept="image/*"
            capture="environment"
            @change="handleH5Picked($event)"
          />
          <input
            v-show="false"
            ref="albumInputRef"
            type="file"
            accept="image/*"
            @change="handleH5Picked($event)"
          />
          <div v-if="ocrWarnings.length" class="preorder-ocr-warnings">
            <el-icon><Warning /></el-icon>
            <span>识别提示：{{ ocrWarnings.join('；') }}</span>
          </div>
        </div>
      </section>
    </el-form>

    <MobileActionSheet
      v-if="!editingTarget"
      v-model="photoSourceSheetVisible"
      title="上传订单截图"
      :actions="photoSourceActions"
      @select="handlePhotoSourceSelect"
    />

    <div class="preorder-editor-form-footer">
      <el-button class="preorder-editor-cancel" @click="$emit('close')">取消</el-button>
      <el-button class="preorder-editor-submit" type="primary" :loading="formSubmitting" @click="submit">
        保存
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { markRaw, ref, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { ArrowDown, Loading, Picture, Warning } from '@element-plus/icons-vue'
import { usePreorderEditor, GRANULARITY_OPTIONS, PLATFORM_OPTIONS } from '@/composables/usePreorderEditor'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import MobileActionSheet from '@/components/MobileActionSheet.vue'
import type { Preorder } from '@/api/types'

const props = defineProps<{
  visible: boolean
  editingTarget: Preorder | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const editor = usePreorderEditor()
// 顶层解包：模板中对 ref / reactive 的自动解包只作用于顶层绑定
const {
  form,
  formRules,
  formSubmitting,
  quarterOptions,
  handleGranularityChange,
  ocrUploading,
  ocrPanelVisible,
  ocrWarnings,
} = editor
const { isMobile } = useResponsiveDevice()

const setFormRef = (el: unknown) => {
  editor.formRef.value = el
}
const setOcrUploadRef = (el: unknown) => {
  editor.ocrUploadRef.value = el
}

// 打开 / 切换目标时重置表单
watch(
  [() => props.visible, () => props.editingTarget],
  ([visible]) => {
    if (!visible) return
    if (props.editingTarget) {
      editor.openEdit(props.editingTarget)
    } else {
      editor.openCreate()
    }
  },
  { immediate: true }
)

const submit = async () => {
  const ok = await editor.submitForm()
  if (ok) emit('saved')
}

// ─── OCR 上传 ───
const handleDesktopFileChange = (uploadFile: any) => {
  const file = uploadFile?.raw as File | undefined
  if (!file) return
  editor.handleOcrFileChange(file)
}

const photoSourceSheetVisible = ref(false)
const cameraInputRef = ref<HTMLInputElement | null>(null)
const albumInputRef = ref<HTMLInputElement | null>(null)

const photoSourceActions = [
  { key: 'camera', label: '拍照', icon: markRaw(Picture) },
  { key: 'album', label: '从相册选择', icon: markRaw(Picture) },
]

const handlePhotoSourceSelect = (key: string) => {
  if (key === 'camera') {
    if (Capacitor.isNativePlatform()) {
      pickFromNative(CameraSource.Camera)
    } else {
      cameraInputRef.value?.click()
    }
  } else if (key === 'album') {
    if (Capacitor.isNativePlatform()) {
      pickFromNative(CameraSource.Photos)
    } else {
      albumInputRef.value?.click()
    }
  }
}

const handleH5Picked = async (e: Event) => {
  const input = e.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return
  await editor.handleOcrFileChange(file)
  if (input) input.value = ''
}

const pickFromNative = async (source: CameraSource) => {
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      resultType: CameraResultType.Uri,
      source,
      correctOrientation: true,
    })
    if (!photo.webPath) throw new Error('未获取到图片路径')
    const resp = await fetch(photo.webPath)
    const blob = await resp.blob()
    const mime = blob.type || 'image/jpeg'
    const ext = mime.includes('/') ? mime.split('/')[1] : 'jpg'
    const file = new File([blob], `preorder_ocr_${Date.now()}.${ext}`, { type: mime })
    await editor.handleOcrFileChange(file)
  } catch (err: any) {
    const msg = err?.message || ''
    if (msg.includes('cancel') || msg.includes('Cancel')) return
    // 识别错误由 handleOcrFileChange 内部提示；这里仅吞掉取消/未授权
  }
}

// 暴露编辑器状态：既有页面级测试通过子组件实例访问表单/识别状态
defineExpose({ editor })
</script>

<style scoped>
.preorder-editor-form-root {
  display: flex;
  flex-direction: column;
}

.preorder-editor-form {
  padding: 20px 28px 4px;
}

.preorder-editor-section {
  margin-bottom: 18px;
  padding: 18px 20px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.09), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 12px 26px -26px rgba(17, 24, 39, 0.5);
}

.preorder-editor-section-title {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 16px;
}

.preorder-editor-section-title::before {
  content: '';
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--primary-gold);
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.12);
}

.preorder-editor-section-title h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #2f2a20;
}

.preorder-editor-section-title p {
  margin: 0 0 0 auto;
  font-size: 12px;
  color: #9ca3af;
}

.preorder-editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.preorder-ocr-section {
  border-top: 1px dashed rgba(212, 175, 55, 0.25);
  padding-top: 12px;
}

.preorder-ocr-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: none;
  color: #9ca3af;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s;
}

.preorder-ocr-toggle:hover {
  color: #b88230;
}

.preorder-ocr-chevron {
  font-size: 12px;
  transition: transform 0.2s;
}

.preorder-ocr-chevron.is-open {
  transform: rotate(180deg);
}

.preorder-ocr-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #c0c4cc;
  line-height: 1.6;
}

.preorder-ocr-body {
  margin-top: 12px;
}

.preorder-ocr-body :deep(.el-upload) {
  width: 100%;
}

.preorder-ocr-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 10px 18px;
  border-radius: 12px;
  border: 1px dashed rgba(212, 175, 55, 0.45);
  background: #fdfaf3;
  color: #7a6a3a;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
}

.preorder-ocr-trigger:hover {
  border-color: var(--primary-gold);
  background: #fbf5e4;
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.12);
}

.preorder-ocr-trigger.is-loading {
  cursor: wait;
  opacity: 0.8;
}

.preorder-ocr-trigger .is-spinning {
  animation: preorder-ocr-rotate 1.1s linear infinite;
}

@keyframes preorder-ocr-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.preorder-ocr-warnings {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(230, 162, 60, 0.1);
  border: 1px solid rgba(230, 162, 60, 0.28);
  color: #b88230;
  font-size: 12.5px;
  line-height: 1.6;
}

.preorder-ocr-warnings .el-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.preorder-editor-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.preorder-editor-form :deep(.el-form-item__label) {
  margin-bottom: 6px;
  color: #5f5874;
  font-weight: 800;
  font-size: 13px;
  line-height: 1.4;
}

.preorder-editor-form :deep(.el-input__wrapper),
.preorder-editor-form :deep(.el-select__wrapper),
.preorder-editor-form :deep(.el-textarea__inner) {
  min-height: 44px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6px 18px -14px rgba(162, 155, 254, 0.45);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.preorder-editor-form :deep(.el-input__wrapper.is-focus),
.preorder-editor-form :deep(.el-select__wrapper.is-focused) {
  border-color: rgba(162, 155, 254, 0.5);
  box-shadow: 0 0 0 3px rgba(196, 181, 253, 0.2), 0 10px 22px -14px rgba(162, 155, 254, 0.5);
}

.preorder-editor-form :deep(.el-input-number) {
  width: 100%;
}

.preorder-editor-form :deep(.el-input-number .el-input__wrapper) {
  padding-left: 12px;
  padding-right: 12px;
}

.preorder-editor-cancel,
.preorder-editor-submit {
  min-width: 96px;
  min-height: 40px;
  border-radius: 12px;
  font-weight: 800;
}

.preorder-editor-cancel {
  border: 1px solid rgba(212, 175, 55, 0.35);
  color: #8a650b;
  background: rgba(255, 248, 230, 0.6);
}

.preorder-editor-cancel:hover {
  background: rgba(255, 248, 230, 0.95);
  border-color: rgba(212, 175, 55, 0.5);
  color: #8a650b;
}

.preorder-editor-submit {
  border: none;
  background: linear-gradient(135deg, var(--accent-purple), var(--accent-purple-hover));
  box-shadow: 0 8px 20px -8px rgba(142, 125, 255, 0.55);
}

.preorder-editor-submit:hover {
  background: linear-gradient(135deg, var(--accent-purple-hover), var(--accent-purple-dark));
}

.granularity-select {
  --el-segmented-bg-color: rgba(244, 243, 247, 0.9);
  --el-segmented-padding: 2px;
  --el-segmented-item-selected-bg-color: linear-gradient(135deg, #fdf4da 0%, #f4da94 100%);
  --el-segmented-item-selected-color: #7a5b08;
  --el-segmented-item-hover-bg-color: rgba(212, 175, 55, 0.1);
  --el-segmented-item-hover-color: #8a650b;
  width: 100%;
  height: 44px;
  padding: 2px;
  box-sizing: border-box;
  border-radius: 12px;
}

.granularity-select :deep(.el-segmented__item) {
  height: 40px;
  line-height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.granularity-select :deep(.el-segmented__item-selected) {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

/* 表单底部操作：桌面弹窗 / 移动抽屉共用，吸底 */
.preorder-editor-form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 28px 20px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid rgba(212, 175, 55, 0.12);
}

@media (max-width: 768px) {
  .preorder-editor-form {
    padding: 16px 14px 4px;
  }

  .preorder-editor-section {
    margin-bottom: 14px;
    padding: 14px;
  }

  .preorder-editor-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .preorder-editor-form-footer {
    position: sticky;
    bottom: 0;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  }

  .preorder-editor-cancel,
  .preorder-editor-submit {
    flex: 1;
    min-height: 48px;
  }
}
</style>
