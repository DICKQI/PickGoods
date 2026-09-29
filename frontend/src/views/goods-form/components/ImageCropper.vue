<template>
  <el-dialog
    v-model="dialogVisible"
    :fullscreen="isMobileEditor"
    :width="isMobileEditor ? '100%' : 'min(1440px, calc(100vw - 48px))'"
    :show-close="false"
    :close-on-click-modal="false"
    class="image-editor-dialog"
    :before-close="handleBeforeClose"
    @opened="handleDialogOpened"
    @closed="cleanupEditor"
  >
    <template #header>
      <header class="image-editor-header">
        <div class="image-editor-header__copy">
          <span>GOODS COVER</span>
          <div>
            <strong>编辑谷子主图</strong>
            <small>先裁剪构图，再按需调整色彩和外形</small>
          </div>
        </div>

        <ImageEditToolbar
          :can-undo="canUndoCropEdit"
          :can-redo="canRedoCropEdit"
          :confirming="confirming"
          :ready="sourceReady"
          :comparing="comparingOriginal"
          @undo="handleUndo"
          @redo="handleRedo"
          @reset="handleReset"
          @cancel="handleCancel"
          @confirm="handleConfirm"
          @compare-start="comparingOriginal = true"
          @compare-stop="comparingOriginal = false"
        />
      </header>
    </template>

    <div
      class="image-editor-shell"
      :class="{ 'is-compact': !isMobileEditor, 'is-inspector-collapsed': inspectorCollapsed }"
    >
      <ImageEditToolRail
        :active-tool="activeTool"
        :disabled="!sourceReady"
        @change="handleToolChange"
      />

      <main class="image-editor-canvas">
        <div class="image-editor-canvas__stage">
          <div
            class="cropper-wrapper"
            :class="{
              'circle-crop': selectedAspectRatio === 'circle' || selectedAspectRatio.endsWith('-ellipse'),
              'rounded-rect-preview': showRoundedControls && enableRoundedRect,
            }"
            :style="cropperWrapperStyle"
            @pointerdown="handleRightDragPointerDown"
            @pointermove="handleRightDragPointerMove"
            @pointerup="handleRightDragPointerEnd"
            @pointercancel="handleRightDragPointerEnd"
            @lostpointercapture="handleRightDragLostPointerCapture"
            @contextmenu="handleRightDragContextMenu"
          >
            <vue-picture-cropper
              v-show="!comparingOriginal"
              ref="pictureCropperRef"
              :key="`cropper-${selectedAspectRatio}`"
              :img="sourceUrl"
              :options="cropperOptions"
              :style="cropperStyle"
            />
            <img
              v-if="comparingOriginal"
              :src="sourceUrl"
              class="original-image"
              alt="编辑前原图"
            />
          </div>

          <div v-if="comparingOriginal" class="compare-badge">原图</div>
          <div v-if="!sourceReady && !sourceError" class="canvas-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>正在载入图片...</span>
          </div>
          <div v-if="sourceError" class="canvas-error">
            <el-icon><WarningFilled /></el-icon>
            <span>{{ sourceError }}</span>
            <el-button text @click="handleCancel">关闭编辑器</el-button>
          </div>
        </div>

        <footer class="image-editor-canvas__footer">
          <span>拖动图片调整位置，滚轮或双指缩放</span>
          <div class="canvas-tools">
            <el-button
              class="inspector-toggle"
              :icon="Operation"
              :aria-pressed="!inspectorCollapsed"
              @click="inspectorCollapsed = !inspectorCollapsed"
            >
              参数
            </el-button>
            <el-tooltip content="缩小" placement="top">
              <el-button circle :icon="ZoomOut" aria-label="缩小" @click="handleZoom(-0.1)" />
            </el-tooltip>
            <el-tooltip content="适配画布" placement="top">
              <el-button circle :icon="FullScreen" aria-label="适配画布" @click="handleFit" />
            </el-tooltip>
            <el-tooltip content="放大" placement="top">
              <el-button circle :icon="ZoomIn" aria-label="放大" @click="handleZoom(0.1)" />
            </el-tooltip>
          </div>
        </footer>
      </main>

      <aside class="image-editor-inspector">
        <div class="image-editor-inspector__preview">
          <ImageEditPreview
            :url="livePreviewUrl"
            :loading="livePreviewLoading"
            :error="livePreviewError"
            @retry="scheduleLivePreviewRefresh"
          />
        </div>
        <div class="image-editor-inspector__scroll">
          <ImageEditInspector
            :active-tool="activeTool"
            :selected-aspect-ratio="selectedAspectRatio"
            :filter-state="filterState"
            :active-hsl-color="activeHslColor"
            :enable-rounded-rect="enableRoundedRect"
            :rounded-radius="roundedRadius"
            :enable-margin="enableMargin"
            :margin-percent="marginPercent"
            :source-has-transparency="sourceHasTransparency"
            :disabled="!sourceReady"
            @update:selected-aspect-ratio="updateAspectRatio"
            @update:active-hsl-color="activeHslColor = $event"
            @update:enable-rounded-rect="enableRoundedRect = $event"
            @update:rounded-radius="roundedRadius = $event"
            @update:enable-margin="enableMargin = $event"
            @update:margin-percent="marginPercent = $event"
            @update-filter="updateFilter"
            @update-hsl="updateHsl"
            @quick-rotate="handleQuickRotate"
            @reset-current-hsl="resetCurrentHsl"
            @commit="handleCommittedChange"
          />
        </div>
      </aside>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FullScreen, Loading, Operation, WarningFilled, ZoomIn, ZoomOut } from '@element-plus/icons-vue'
import VuePictureCropper from 'vue-picture-cropper'
import ImageEditInspector from '@/views/goods-form/components/ImageEditInspector.vue'
import ImageEditPreview from '@/views/goods-form/components/ImageEditPreview.vue'
import ImageEditToolbar from '@/views/goods-form/components/ImageEditToolbar.vue'
import ImageEditToolRail from '@/views/goods-form/components/ImageEditToolRail.vue'
import {
  applyCropperStateFromSnapshot,
  exportCropperFile,
  fitCropper,
  getCropperNumericState,
  moveCropper,
  rotateCropperTo,
  zoomCropper,
} from '@/views/goods-form/imageCropperAdapter'
import {
  assertImageDecodable,
  createDefaultFilterState,
  computeCropperStyle,
  detectImageTransparency,
} from '@/views/goods-form/imageUtils'
import {
  getCropOutputDimensions,
  processCroppedImage,
} from '@/views/goods-form/imageRenderPipeline'
import type {
  CropEditSnapshot,
  CropFilterState,
  HslColorKey,
} from '@/views/goods-form/cropHistory'
import { useCropHistory } from '@/views/goods-form/composables/useCropHistory'
import { useCropperRightDrag } from '@/views/goods-form/composables/useCropperRightDrag'
import { useLivePreview } from '@/views/goods-form/composables/useLivePreview'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import type { ImageEditorTool } from '@/views/goods-form/imageEditorConfig'

const props = withDefaults(defineProps<{
  visible: boolean
  imageFile: File
  imageUrl?: string
  maxOutputSize?: number
}>(), {
  imageUrl: '',
  maxOutputSize: 2000,
})

const emit = defineEmits<{
  confirm: [file: File]
  cancel: []
  'update:visible': [value: boolean]
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

const { isMobile, viewportWidth } = useResponsiveDevice()
const isMobileEditor = computed(() => isMobile.value || viewportWidth.value <= 768)
const pictureCropperRef = ref<any>(null)
const internalImageUrl = ref('')
const sourceReady = ref(false)
const cropperReady = ref(false)
const transparencyChecked = ref(false)
const sourceError = ref('')
const sourceHasTransparency = ref(false)
const confirming = ref(false)
const comparingOriginal = ref(false)
const inspectorCollapsed = ref(false)
const activeTool = ref<ImageEditorTool>('crop')

const aspectRatios = [
  { label: '自由', value: 'free' },
  { label: '1:1', value: '1:1' },
  { label: '圆形', value: 'circle' },
  { label: '47:65', value: '47:65-ellipse' },
  { label: '63:93', value: '63:93-ellipse' },
]

const selectedAspectRatio = ref('free')
const filterState = ref<CropFilterState>(createDefaultFilterState())
const enableRoundedRect = ref(false)
const roundedRadius = ref(20)
const enableMargin = ref(false)
const marginPercent = ref(8)
const activeHslColor = ref<HslColorKey>('red')
const roundedRectPreviewPx = ref(0)

const sourceUrl = computed(() => props.imageUrl || internalImageUrl.value)
const showRoundedControls = computed(() => (
  selectedAspectRatio.value === 'free' || selectedAspectRatio.value === '1:1'
))

const getCurrentCropperNumericState = (method: 'getData' | 'getCropBoxData' | 'getCanvasData') => (
  getCropperNumericState(pictureCropperRef.value, method)
)

const getCurrentSnapshot = (): CropEditSnapshot => ({
  selectedAspectRatio: selectedAspectRatio.value,
  filterState: filterState.value,
  enableRoundedRect: enableRoundedRect.value,
  roundedRadius: roundedRadius.value,
  enableMargin: enableMargin.value,
  marginPercent: marginPercent.value,
  cropData: getCurrentCropperNumericState('getData'),
  cropBoxData: getCurrentCropperNumericState('getCropBoxData'),
  canvasData: getCurrentCropperNumericState('getCanvasData'),
})

const cropHistory = useCropHistory({
  cropDialogVisible: dialogVisible,
  selectedAspectRatio,
  filterState,
  enableRoundedRect,
  roundedRadius,
  enableMargin,
  marginPercent,
  getCropperNumericState: getCurrentCropperNumericState,
  applyCropperStateFromSnapshot: (snapshot) => (
    applyCropperStateFromSnapshot(pictureCropperRef.value, snapshot)
  ),
})

const {
  canUndoCropEdit,
  canRedoCropEdit,
  isCropEditDirty,
  resetCropHistorySession,
  commitCropHistorySnapshot,
  markCropEditDirty,
  handleCropUndo,
  handleCropRedo,
  handleCropperReady,
} = cropHistory

const cropperOptions = computed(() => {
  const options: Record<string, unknown> = {
    outputSize: 1,
    outputType: 'png',
    canScale: true,
    autoCrop: true,
    centerBox: true,
    high: true,
    cropData: {},
    enlarge: 1,
    mode: 'contain',
    maxImgSize: 2000,
    limitMinSize: [16, 16],
    minCropBoxWidth: 16,
    minCropBoxHeight: 16,
    autoCropArea: 0.78,
    viewMode: 1,
    dragMode: 'crop',
    cropBoxMovable: true,
    cropBoxResizable: true,
    strict: true,
    ready: handleCropperReadyInternal,
    crop: () => {
      updateRoundedRectPreviewRadius()
      scheduleLivePreviewRefresh()
    },
    cropend: () => {
      updateRoundedRectPreviewRadius()
      handleCommittedChange()
    },
    zoom: () => {
      updateRoundedRectPreviewRadius()
      markCropEditDirty()
      scheduleLivePreviewRefresh()
    },
    zoomend: handleCommittedChange,
  }

  if (selectedAspectRatio.value === 'circle') {
    options.aspectRatio = 1
    options.fixed = true
    options.fixedNumber = [1, 1]
  } else if (selectedAspectRatio.value.endsWith('-ellipse')) {
    const parts = selectedAspectRatio.value.replace('-ellipse', '').split(':').map(Number)
    if (parts[0] && parts[1]) {
      options.aspectRatio = parts[0] / parts[1]
      options.fixed = true
      options.fixedNumber = parts
    }
  } else if (selectedAspectRatio.value !== 'free') {
    const parts = selectedAspectRatio.value.split(':').map(Number)
    if (parts[0] && parts[1]) {
      options.aspectRatio = parts[0] / parts[1]
      options.fixed = true
      options.fixedNumber = parts
    }
  } else {
    options.aspectRatio = Number.NaN
    options.fixed = false
  }

  return options
})

const cropperStyle = computed(() => computeCropperStyle(filterState.value))
const cropperWrapperStyle = computed(() => ({
  '--rounded-radius-px': `${roundedRectPreviewPx.value}px`,
}))

const livePreview = useLivePreview()
const { livePreviewUrl, livePreviewLoading } = livePreview
const livePreviewError = ref('')
let livePreviewSeq = 0
let sourceLoadingTimer: number | undefined

const updateRoundedRectPreviewRadius = () => {
  if (!showRoundedControls.value || !enableRoundedRect.value) {
    roundedRectPreviewPx.value = 0
    return
  }
  const cropBox = getCurrentCropperNumericState('getCropBoxData')
  const width = cropBox?.width
  const height = cropBox?.height
  if (!width || !height) return
  const percent = Math.max(0, Math.min(roundedRadius.value, 50))
  const radius = (percent / 100) * (Math.min(width, height) / 2)
  roundedRectPreviewPx.value = Number.isFinite(radius) ? radius : 0
}

const releaseInternalImageUrl = () => {
  if (internalImageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(internalImageUrl.value)
  }
  internalImageUrl.value = ''
}

const resolveSourceUrl = () => {
  releaseInternalImageUrl()
  sourceReady.value = false
  cropperReady.value = false
  transparencyChecked.value = false
  sourceError.value = ''
  sourceHasTransparency.value = false

  if (props.imageUrl) return
  if (props.imageFile) {
    internalImageUrl.value = URL.createObjectURL(props.imageFile)
  }
}

const refreshTransparencyState = async () => {
  sourceHasTransparency.value = await detectImageTransparency(props.imageFile)
}

const scheduleLivePreviewRefresh = (delay = 220) => {
  if (!dialogVisible.value || !sourceReady.value) return
  livePreview.scheduleRefresh(() => {
    void refreshLivePreview()
  }, delay)
}

const renderCurrentImage = async (maxOutputSize: number, quality: number) => {
  const snapshot = getCurrentSnapshot()
  const dimensions = getCropOutputDimensions(
    snapshot.selectedAspectRatio,
    snapshot.cropData,
    snapshot.cropBoxData,
    maxOutputSize,
  )
  const cropFile = await exportCropperFile(pictureCropperRef.value, {
    ...dimensions,
    mimeType: 'image/png',
    quality: 0.94,
  })
  return await processCroppedImage(cropFile, snapshot, {
    maxOutputSize,
    sourceHasTransparency: sourceHasTransparency.value,
    quality,
  })
}

const refreshLivePreview = async () => {
  if (!dialogVisible.value || !sourceReady.value) return

  const sequence = ++livePreviewSeq
  livePreviewLoading.value = true
  try {
    const previewFile = await renderCurrentImage(768, 0.9)
    if (sequence !== livePreviewSeq || !dialogVisible.value) return

    const nextUrl = URL.createObjectURL(previewFile)
    const previousUrl = livePreviewUrl.value
    livePreviewUrl.value = nextUrl
    livePreviewError.value = ''
    if (previousUrl.startsWith('blob:')) URL.revokeObjectURL(previousUrl)
  } catch (error: any) {
    if (sequence === livePreviewSeq) {
      livePreviewError.value = error?.message || '预览生成失败，请重试'
    }
  } finally {
    if (sequence === livePreviewSeq) livePreviewLoading.value = false
  }
}

const clearSourceLoadingTimer = () => {
  if (sourceLoadingTimer !== undefined) {
    window.clearTimeout(sourceLoadingTimer)
    sourceLoadingTimer = undefined
  }
}

const startSourceLoadingTimer = () => {
  clearSourceLoadingTimer()
  sourceLoadingTimer = window.setTimeout(() => {
    if (!cropperReady.value) {
      sourceReady.value = false
      sourceError.value = '图片编辑器加载超时，请关闭后重试'
    }
  }, 12000)
}

const handleCropperReadyInternal = () => {
  clearSourceLoadingTimer()
  handleCropperReady()
  if (Math.abs(filterState.value.rotation ?? 0) > 1e-8) {
    rotateCropperTo(pictureCropperRef.value, filterState.value.rotation ?? 0)
  }
  commitCropHistorySnapshot()
  cropperReady.value = true
  sourceReady.value = cropperReady.value && transparencyChecked.value
  sourceError.value = ''
  updateRoundedRectPreviewRadius()
  scheduleLivePreviewRefresh()
}

const handleDialogOpened = async () => {
  startSourceLoadingTimer()
  try {
    await nextTick()
    await assertImageDecodable(props.imageFile)
    await refreshTransparencyState()
    transparencyChecked.value = true
    sourceReady.value = cropperReady.value && transparencyChecked.value
    if (sourceUrl.value) {
      scheduleLivePreviewRefresh()
    }
  } catch (error: any) {
    clearSourceLoadingTimer()
    sourceReady.value = false
    sourceError.value = error?.message || '图片载入失败'
  }
}

const handleToolChange = (tool: ImageEditorTool) => {
  activeTool.value = tool
}

const updateAspectRatio = (value: string) => {
  if (!cropperReady.value) return
  if (selectedAspectRatio.value === value) return
  sourceReady.value = false
  selectedAspectRatio.value = value
  if (!showRoundedControls.value) enableRoundedRect.value = false
  markCropEditDirty()
  void nextTick(() => scheduleLivePreviewRefresh())
}

const updateFilter = (patch: Partial<CropFilterState>) => {
  if (!cropperReady.value) return
  filterState.value = {
    ...filterState.value,
    ...patch,
  }
  if (patch.rotation !== undefined) {
    rotateCropperTo(pictureCropperRef.value, patch.rotation)
  }
  markCropEditDirty()
  scheduleLivePreviewRefresh()
}

const updateHsl = (key: HslColorKey, axis: 'h' | 's' | 'l', value: number) => {
  if (!cropperReady.value) return
  const current = filterState.value.hslAdjustments[key] ?? { h: 0, s: 0, l: 0 }
  filterState.value = {
    ...filterState.value,
    hslAdjustments: {
      ...filterState.value.hslAdjustments,
      [key]: {
        ...current,
        [axis]: value,
      },
    },
  }
  markCropEditDirty()
  scheduleLivePreviewRefresh()
}

const resetCurrentHsl = () => {
  if (!cropperReady.value) return
  const key = activeHslColor.value
  filterState.value = {
    ...filterState.value,
    hslAdjustments: {
      ...filterState.value.hslAdjustments,
      [key]: { h: 0, s: 0, l: 0 },
    },
  }
  markCropEditDirty()
  commitCropHistorySnapshot()
  scheduleLivePreviewRefresh()
}

const normalizeRotation = (value: number) => {
  let next = value % 360
  if (next > 180) next -= 360
  if (next <= -180) next += 360
  return next
}

const handleQuickRotate = (degrees: number) => {
  if (!cropperReady.value) return
  updateFilter({
    rotation: normalizeRotation((filterState.value.rotation ?? 0) + degrees),
  })
  commitCropHistorySnapshot()
}

const handleCommittedChange = () => {
  if (!cropperReady.value) return
  markCropEditDirty()
  commitCropHistorySnapshot()
}

const {
  handlePointerDown: handleRightDragPointerDown,
  handlePointerMove: handleRightDragPointerMove,
  handlePointerEnd: handleRightDragPointerEnd,
  handleLostPointerCapture: handleRightDragLostPointerCapture,
  handleContextMenu: handleRightDragContextMenu,
} = useCropperRightDrag({
  canDrag: () => cropperReady.value && sourceReady.value,
  moveBy: (offsetX, offsetY) => moveCropper(pictureCropperRef.value, offsetX, offsetY),
  onMoved: () => {
    markCropEditDirty()
    scheduleLivePreviewRefresh(160)
  },
  onDragEnd: () => {
    handleCommittedChange()
    scheduleLivePreviewRefresh(0)
  },
})

const handleZoom = (delta: number) => {
  if (!cropperReady.value) return
  if (!zoomCropper(pictureCropperRef.value, delta)) return
  markCropEditDirty()
  updateRoundedRectPreviewRadius()
  scheduleLivePreviewRefresh()
}

const handleFit = () => {
  if (!cropperReady.value) return
  if (!fitCropper(pictureCropperRef.value)) return
  markCropEditDirty()
  updateRoundedRectPreviewRadius()
  commitCropHistorySnapshot()
  scheduleLivePreviewRefresh()
}

const handleUndo = async () => {
  if (!cropperReady.value) return
  await handleCropUndo()
  updateRoundedRectPreviewRadius()
  scheduleLivePreviewRefresh()
}

const handleRedo = async () => {
  if (!cropperReady.value) return
  await handleCropRedo()
  updateRoundedRectPreviewRadius()
  scheduleLivePreviewRefresh()
}

const handleReset = async () => {
  if (!cropperReady.value) return
  const ratioChanged = selectedAspectRatio.value !== 'free'
  sourceReady.value = false
  selectedAspectRatio.value = 'free'
  filterState.value = createDefaultFilterState()
  enableRoundedRect.value = false
  roundedRadius.value = 20
  enableMargin.value = false
  marginPercent.value = 8
  activeHslColor.value = 'red'
  fitCropper(pictureCropperRef.value)
  markCropEditDirty()
  await nextTick()
  if (!ratioChanged) {
    sourceReady.value = true
    commitCropHistorySnapshot()
  } else {
    markCropEditDirty()
  }
  updateRoundedRectPreviewRadius()
  scheduleLivePreviewRefresh()
}

const handleConfirm = async () => {
  if (!sourceReady.value || confirming.value) return
  confirming.value = true
  try {
    const output = await renderCurrentImage(props.maxOutputSize, 0.92)
    emit('confirm', output)
    emit('update:visible', false)
  } catch (error: any) {
    ElMessage.error(error?.message || '图片保存失败，请重试')
  } finally {
    confirming.value = false
  }
}

const confirmDiscard = async () => {
  if (!isCropEditDirty.value) return true
  try {
    await ElMessageBox.confirm(
      '当前编辑尚未保存，确定放弃本次修改吗？',
      '放弃编辑',
      {
        confirmButtonText: '放弃修改',
        cancelButtonText: '继续编辑',
        type: 'warning',
      },
    )
    return true
  } catch {
    return false
  }
}

const handleCancel = async () => {
  if (confirming.value || !(await confirmDiscard())) return
  emit('cancel')
  emit('update:visible', false)
}

const handleBeforeClose = async (done: () => void) => {
  if (confirming.value) return
  if (await confirmDiscard()) {
    emit('cancel')
    done()
  }
}

const cleanupEditor = () => {
  clearSourceLoadingTimer()
  livePreviewSeq += 1
  livePreview.cancelRefresh()
  livePreview.clearUrl()
  livePreviewError.value = ''
  comparingOriginal.value = false
  sourceReady.value = false
  resetCropHistorySession()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!dialogVisible.value || confirming.value || event.isComposing) return
  const target = event.target as HTMLElement | null
  if (target?.matches('input, textarea, select, [contenteditable="true"]')) return

  const modKey = event.ctrlKey || event.metaKey
  if (!modKey || event.key.toLowerCase() !== 'z') return

  event.preventDefault()
  if (event.shiftKey) {
    void handleRedo()
  } else {
    void handleUndo()
  }
}

watch(
  () => [props.imageUrl, props.imageFile],
  () => resolveSourceUrl(),
  { immediate: true },
)

watch(
  [showRoundedControls, enableRoundedRect, roundedRadius],
  () => updateRoundedRectPreviewRadius(),
)

watch(dialogVisible, (visible) => {
  if (!visible) cleanupEditor()
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  cleanupEditor()
  releaseInternalImageUrl()
})

defineExpose({
  aspectRatios,
  selectedAspectRatio,
  filterState,
})
</script>

<style scoped>
:global(.image-editor-dialog) {
  --editor-border: rgba(29, 33, 41, 0.09);
  --editor-surface: #fff;
  --editor-canvas: #20242b;
}

:global(.image-editor-dialog.el-dialog) {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 48px);
  max-height: min(860px, calc(100dvh - 48px));
  margin: 24px auto;
  padding: 0;
  overflow: hidden;
  border-radius: 18px;
  background: var(--editor-surface);
}

:global(.image-editor-dialog .el-dialog__header) {
  flex: 0 0 auto;
  margin: 0;
  padding: 13px 16px;
  border-bottom: 1px solid var(--editor-border);
}

:global(.image-editor-dialog .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

:global(.image-editor-dialog.is-fullscreen) {
  height: 100dvh;
  margin: 0;
  border-radius: 0;
}

:global(.image-editor-dialog.is-fullscreen .el-dialog__body) {
  height: calc(100dvh - 82px);
}

.image-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-width: 0;
}

.image-editor-header__copy {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 3px;
}

.image-editor-header__copy > span {
  color: var(--primary-gold-dark);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.image-editor-header__copy > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.image-editor-header__copy strong {
  color: #282e37;
  font-size: 16px;
}

.image-editor-header__copy small {
  color: #8a919d;
  font-size: 11px;
}

.image-editor-shell {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 376px;
  height: min(760px, calc(100dvh - 134px));
  min-height: 520px;
  overflow: hidden;
  background: #f6f7f9;
}

.image-editor-canvas {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: var(--editor-canvas);
}

.image-editor-canvas__stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  align-items: stretch;
  justify-content: stretch;
  padding: 18px;
  overflow: hidden;
}

.cropper-wrapper {
  --rounded-radius: v-bind('roundedRadius + "%"');
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.035);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24);
}

.cropper-wrapper :deep(.cropper-container) {
  max-width: 100% !important;
  max-height: 100% !important;
}

.cropper-wrapper :deep(.vue-picture-cropper),
.cropper-wrapper :deep(.vue--picture-cropper__wrap) {
  width: 100% !important;
  height: 100% !important;
}

:deep(.cropper-canvas img),
:deep(.cropper-view-box img) {
  filter:
    brightness(var(--brightness, 100%))
    contrast(var(--contrast, 100%))
    saturate(var(--saturate, 100%))
    hue-rotate(var(--hue-rotate, 0deg)) !important;
}

.cropper-wrapper.circle-crop :deep(.cropper-view-box),
.cropper-wrapper.circle-crop :deep(.cropper-face) {
  border-radius: 50%;
}

.cropper-wrapper.rounded-rect-preview :deep(.cropper-view-box),
.cropper-wrapper.rounded-rect-preview :deep(.cropper-face) {
  border-radius: var(--rounded-radius-px, var(--rounded-radius));
}

.original-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.compare-badge {
  position: absolute;
  top: 26px;
  left: 26px;
  z-index: 3;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(18, 21, 26, 0.76);
  color: #fff;
  font-size: 11px;
  letter-spacing: 0.06em;
  pointer-events: none;
}

.canvas-loading,
.canvas-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 9px;
  padding: 24px;
  background: rgba(25, 29, 35, 0.9);
  color: #d8dbe0;
  font-size: 12px;
  text-align: center;
}

.canvas-error {
  color: #ffd9d9;
}

.image-editor-canvas__footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
  padding: 8px 14px 8px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #1a1e24;
  color: #aeb4be;
  font-size: 11px;
}

.canvas-tools {
  display: flex;
  gap: 6px;
}

.inspector-toggle {
  display: none;
}

.canvas-tools :deep(.el-button) {
  color: #e8e9eb;
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
}

.canvas-tools :deep(.el-button:hover) {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.12);
}

.image-editor-inspector {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid var(--editor-border);
  background: var(--editor-surface);
}

.image-editor-inspector__preview {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  background: var(--editor-surface);
}

.image-editor-inspector__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

@media (max-width: 1199px) and (min-width: 769px) {
  .image-editor-shell {
    grid-template-columns: 64px minmax(0, 1fr);
    position: relative;
  }

  .image-editor-inspector {
    position: absolute;
    right: 12px;
    top: 12px;
    bottom: 12px;
    z-index: 5;
    width: min(360px, calc(100% - 88px));
    border: 1px solid rgba(29, 33, 41, 0.12);
    border-radius: 14px;
    box-shadow: 0 16px 42px rgba(12, 16, 22, 0.22);
  }

  .image-editor-canvas__stage {
    padding-right: min(380px, calc(100% - 88px));
  }

  .image-editor-shell.is-inspector-collapsed .image-editor-canvas__stage {
    padding-right: 18px;
  }

  .image-editor-shell.is-inspector-collapsed .image-editor-inspector {
    display: none;
  }

  .inspector-toggle {
    display: inline-flex;
  }
}

@media (max-width: 768px) {
  :global(.image-editor-dialog.el-dialog) {
    max-width: none;
    max-height: none;
  }

  :global(.image-editor-dialog .el-dialog__header) {
    padding: calc(10px + env(safe-area-inset-top)) 12px 10px;
  }

  .image-editor-header {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  .image-editor-header__copy small {
    display: none;
  }

  .image-editor-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(300px, 48dvh) minmax(260px, auto);
    height: calc(100dvh - 92px - env(safe-area-inset-top));
    min-height: 0;
    overflow-y: auto;
  }

  .image-editor-canvas {
    min-height: 300px;
  }

  .image-editor-canvas__stage {
    padding: 12px;
  }

  .image-editor-canvas__footer {
    min-height: 48px;
    padding-left: 12px;
  }

  .image-editor-canvas__footer > span {
    display: none;
  }

  .image-editor-shell.is-inspector-collapsed {
    grid-template-rows: auto minmax(300px, 1fr) 0;
  }

  .image-editor-inspector {
    height: clamp(360px, 58dvh, 540px);
    overflow: hidden;
    border-top: 1px solid var(--editor-border);
    border-left: 0;
  }

  .image-editor-shell.is-inspector-collapsed .image-editor-inspector {
    display: none;
  }
}
</style>
