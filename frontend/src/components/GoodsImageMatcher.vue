<template>
  <component
    :is="shellComponent"
    v-model="visible"
    v-bind="shellProps"
  >
    <div class="goods-image-matcher">
      <input
        ref="fileInputRef"
        class="sr-only-input"
        type="file"
        accept="image/*"
        @change="handleInputPicked($event)"
      />
      <input
        ref="cameraInputRef"
        class="sr-only-input"
        type="file"
        accept="image/*"
        capture="environment"
        @change="handleInputPicked($event)"
      />
      <input
        ref="albumInputRef"
        class="sr-only-input"
        type="file"
        accept="image/*"
        @change="handleInputPicked($event)"
      />

      <section v-if="!previewUrl" class="goods-image-matcher__empty">
        <button
          type="button"
          class="goods-image-matcher__dropzone"
          @click="openPicker"
          @dragover.prevent
          @drop.prevent="handleDrop"
        >
          <span class="goods-image-matcher__dropzone-icon">
            <el-icon><CameraIcon /></el-icon>
          </span>
          <strong>拍一张或选一张谷子照片吧~</strong>
          <span>让一件谷子单独出镜，主体完整、光线均匀，会更容易认出它哦~</span>
          <small>支持 JPG / PNG / WebP，最大 10MB 哦</small>
        </button>
      </section>

      <template v-else>
        <section class="goods-image-matcher__preview">
          <img :src="previewUrl" alt="待识别谷子照片" class="goods-image-matcher__preview-image" />
          <div class="goods-image-matcher__preview-info">
            <span class="goods-image-matcher__preview-name">{{ selectedFileName }}</span>
            <span v-if="recognizing" class="goods-image-matcher__status is-loading">
              <el-icon class="is-spinning"><Loading /></el-icon>
              正在谷仓里帮你找同款...
            </span>
            <span v-else-if="requestError" class="goods-image-matcher__status is-error">
              识别失败啦，换一张再试试吧~
            </span>
            <span v-else-if="result" class="goods-image-matcher__status is-ready">
              找到线索啦
            </span>
          </div>
          <button
            type="button"
            class="goods-image-matcher__reselect"
            :disabled="recognizing"
            @click="openPicker"
          >
            换一张
          </button>
        </section>

        <section v-if="recognizing" class="goods-image-matcher__loading">
          <div class="goods-image-matcher__loading-ring" />
          <p>几秒钟就好，先别关掉呀~</p>
        </section>

        <section v-else-if="requestError" class="goods-image-matcher__error">
          <el-icon><WarningFilled /></el-icon>
          <h3>暂时认不出来啦</h3>
          <p>识别服务开小差了，稍后再试试吧~</p>
          <div class="goods-image-matcher__actions">
            <el-button @click="openPicker">重新选择</el-button>
            <el-button type="primary" @click="close">关闭</el-button>
          </div>
        </section>

        <template v-else-if="result">
          <section
            v-if="result.decision === 'matched' && result.match"
            class="goods-image-matcher__matched"
          >
            <div class="goods-image-matcher__result-heading is-matched">
              <el-icon><CircleCheckFilled /></el-icon>
              <div>
                <h3>好像已经在谷仓里啦！</h3>
                <p>它和主图长得好像，快看看是不是同一款吧~</p>
              </div>
            </div>
            <article
              class="goods-image-match-card is-primary"
              @click="openGoods(result.match.goods.id)"
            >
              <div class="goods-image-match-card__image">
                <img
                  v-if="result.match.goods.main_photo"
                  :src="result.match.goods.main_photo"
                  :alt="result.match.goods.name"
                />
                <el-icon v-else><Picture /></el-icon>
              </div>
              <div class="goods-image-match-card__body">
                <div class="goods-image-match-card__title-row">
                  <strong>{{ result.match.goods.name }}</strong>
                  <span>{{ confidenceLabel(result.match.confidence) }}</span>
                </div>
                <p>{{ goodsMeta(result.match.goods) }}</p>
                <div class="goods-image-match-card__tags">
                  <span>{{ result.match.goods.category.name }}</span>
                  <span>{{ statusLabel(result.match.goods.status) }}</span>
                </div>
                <button
                  type="button"
                  class="goods-image-match-card__confirm"
                  :disabled="feedbackSubmitting || feedbackOutcome !== null"
                  @click.stop="confirmCandidate(result.match.goods.id)"
                >
                  {{ candidateConfirmLabel(result.match.goods.id) }}
                </button>
              </div>
            </article>
          </section>

          <section
            v-else-if="result.decision === 'candidates'"
            class="goods-image-matcher__results"
          >
            <div class="goods-image-matcher__result-heading">
              <el-icon><Search /></el-icon>
              <div>
                <h3>找到几个相似谷子啦</h3>
                <p>看看下面有没有它，点开详情确认一下吧~</p>
              </div>
            </div>
          </section>

          <section
            v-else
            class="goods-image-matcher__not-found"
          >
            <el-icon><Box /></el-icon>
            <h3>没找到能确定的那一款</h3>
            <p>谷仓里可能还没有这件谷子，换张更清楚的照片再试试吧~</p>
          </section>

          <div
            v-if="visibleCandidates.length"
            class="goods-image-match-list"
          >
            <article
              v-for="candidate in visibleCandidates"
              :key="candidate.goods.id"
              class="goods-image-match-card"
              @click="openGoods(candidate.goods.id)"
            >
              <div class="goods-image-match-card__image">
                <img
                  v-if="candidate.goods.main_photo"
                  :src="candidate.goods.main_photo"
                  :alt="candidate.goods.name"
                />
                <el-icon v-else><Picture /></el-icon>
              </div>
              <div class="goods-image-match-card__body">
                <div class="goods-image-match-card__title-row">
                  <strong>{{ candidate.goods.name }}</strong>
                  <span>{{ confidenceLabel(candidate.confidence) }}</span>
                </div>
                <p>{{ goodsMeta(candidate.goods) }}</p>
                <div class="goods-image-match-card__tags">
                  <span>{{ candidate.goods.category.name }}</span>
                  <span>{{ statusLabel(candidate.goods.status) }}</span>
                </div>
                <button
                  type="button"
                  class="goods-image-match-card__confirm"
                  :disabled="feedbackSubmitting || feedbackOutcome !== null"
                  @click.stop="confirmCandidate(candidate.goods.id)"
                >
                  {{ candidateConfirmLabel(candidate.goods.id) }}
                </button>
              </div>
            </article>
          </div>

          <div v-if="feedbackOutcome" class="goods-image-matcher__feedback">
            <el-icon><CircleCheck /></el-icon>
            <span>{{ feedbackOutcome === 'confirmed' ? '已记下啦，谢谢确认~' : '收到啦，这几个都不是它~' }}</span>
          </div>

          <div
            v-if="result.decision !== 'not_found'"
            class="goods-image-matcher__actions"
          >
            <el-button
              v-if="!feedbackOutcome"
              :loading="feedbackSubmitting"
              @click="rejectCandidates"
            >
              都不是它
            </el-button>
            <el-button @click="openPicker">换一张</el-button>
            <el-button type="primary" @click="close">关闭</el-button>
          </div>
          <div v-else class="goods-image-matcher__actions">
            <el-button @click="openPicker">换一张</el-button>
            <el-button type="primary" @click="close">关闭</el-button>
          </div>
        </template>
      </template>
    </div>
  </component>

  <MobileActionSheet
    v-model="photoSourceSheetVisible"
    title="照片从哪里来呀？"
    :actions="photoSourceActions"
    @select="handlePhotoSource"
  />
</template>

<script setup lang="ts">
import {
  computed,
  markRaw,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue'
import { Camera, CameraSource, CameraResultType } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import { ElDialog, ElMessage } from 'element-plus'
import {
  Box,
  Camera as CameraIcon,
  CircleCheck,
  CircleCheckFilled,
  Loading,
  Picture,
  Search,
  WarningFilled,
} from '@element-plus/icons-vue'
import BaseBottomSheet from '@/components/ui/BaseBottomSheet.vue'
import MobileActionSheet from '@/components/MobileActionSheet.vue'
import { matchGoodsImage, submitGoodsImageMatchFeedback } from '@/api/goods'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import type {
  GoodsImageMatchCandidate,
  GoodsImageMatchConfidence,
  GoodsImageMatchResult,
  GoodsListItem,
} from '@/api/types'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  openGoods: [goodsId: string]
}>()

const { isMobile } = useResponsiveDevice()
const shellComponent = computed(() => (isMobile.value ? BaseBottomSheet : ElDialog))
const shellProps = computed(() =>
  isMobile.value
    ? {
        title: '拍图找谷子',
        subtitle: '只和你的谷仓主图比一比，在馆和出街中都能找~',
      }
    : {
        title: '拍图找谷子',
        width: '720px',
        appendToBody: true,
        destroyOnClose: false,
        closeOnClickModal: false,
        class: 'goods-image-matcher-dialog',
      },
)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const photoSourceActions = [
  { key: 'camera', label: '拍照', icon: markRaw(CameraIcon), tone: 'primary' as const },
  { key: 'album', label: '从相册挑一张', icon: markRaw(Picture) },
]

const fileInputRef = ref<HTMLInputElement | null>(null)
const cameraInputRef = ref<HTMLInputElement | null>(null)
const albumInputRef = ref<HTMLInputElement | null>(null)
const photoSourceSheetVisible = ref(false)
const previewUrl = ref('')
const selectedFileName = ref('')
const recognizing = ref(false)
const requestError = ref('')
const result = ref<GoodsImageMatchResult | null>(null)
const feedbackSubmitting = ref(false)
const feedbackOutcome = ref<'confirmed' | 'rejected' | null>(null)
const confirmedGoodsId = ref<string | null>(null)

let currentObjectUrl = ''
let requestController: AbortController | null = null
let requestSequence = 0

const visibleCandidates = computed<GoodsImageMatchCandidate[]>(() => {
  if (!result.value) return []
  if (result.value.decision === 'matched') return result.value.candidates
  if (result.value.decision === 'candidates') return result.value.candidates
  return []
})

const clearPreview = () => {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = ''
  }
  previewUrl.value = ''
  selectedFileName.value = ''
}

const resetRequestState = () => {
  requestSequence += 1
  requestController?.abort()
  requestController = null
  recognizing.value = false
  requestError.value = ''
  result.value = null
  feedbackSubmitting.value = false
  feedbackOutcome.value = null
  confirmedGoodsId.value = null
}

const close = () => {
  visible.value = false
}

const openPicker = () => {
  if (recognizing.value) return
  if (isMobile.value) {
    photoSourceSheetVisible.value = true
    return
  }
  fileInputRef.value?.click()
}

const validateFile = (file: File): string | null => {
  if (!file.type.startsWith('image/')) return '请选择图片文件'
  if (file.size > 10 * 1024 * 1024) return '图片大小不能超过 10MB'
  return null
}

const recognizeFile = async (file: File) => {
  const validationError = validateFile(file)
  if (validationError) {
    ElMessage.warning(validationError)
    return
  }

  clearPreview()
  currentObjectUrl = URL.createObjectURL(file)
  previewUrl.value = currentObjectUrl
  selectedFileName.value = file.name || '本次照片'
  resetRequestState()
  recognizing.value = true

  const sequence = ++requestSequence
  const controller = new AbortController()
  requestController = controller
  try {
    const response = await matchGoodsImage(file, controller.signal)
    if (sequence !== requestSequence) return
    result.value = response
  } catch (error: any) {
    if (sequence !== requestSequence || error?.code === 'ERR_CANCELED') return
    requestError.value =
      error?.response?.data?.detail ||
      error?.message ||
      '识别失败，请稍后重试'
  } finally {
    if (sequence === requestSequence) {
      recognizing.value = false
      requestController = null
    }
  }
}

const handleInputPicked = (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (input) input.value = ''
  if (!file) return
  void recognizeFile(file)
}

const handleDrop = (event: DragEvent) => {
  const file = event.dataTransfer?.files?.[0]
  if (file) void recognizeFile(file)
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
    const response = await fetch(photo.webPath)
    const blob = await response.blob()
    const mime = blob.type || 'image/jpeg'
    const extension = mime.includes('/') ? mime.split('/')[1] : 'jpg'
    const file = new File([blob], `goods_match_${Date.now()}.${extension}`, {
      type: mime,
    })
    await recognizeFile(file)
  } catch (error: any) {
    const message = String(error?.message || '')
    if (message.toLowerCase().includes('cancel')) return
    ElMessage.error('获取图片失败：' + (message || '未知错误'))
  }
}

const handlePhotoSource = (key: string) => {
  const native = Capacitor.isNativePlatform()
  if (key === 'camera') {
    if (native) void pickFromNative(CameraSource.Camera)
    else cameraInputRef.value?.click()
    return
  }
  if (native) void pickFromNative(CameraSource.Photos)
  else albumInputRef.value?.click()
}

const openGoods = (goodsId: string) => {
  emit('openGoods', goodsId)
  close()
}

const submitFeedback = async (
  outcome: 'confirmed' | 'rejected',
  goodsId?: string,
) => {
  if (!result.value || feedbackSubmitting.value || feedbackOutcome.value) return
  feedbackSubmitting.value = true
  try {
    await submitGoodsImageMatchFeedback({
      attempt_id: result.value.attempt_id,
      outcome,
      ...(goodsId ? { goods_id: goodsId } : {}),
    })
    feedbackOutcome.value = outcome
    confirmedGoodsId.value = outcome === 'confirmed' ? goodsId ?? null : null
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.detail ||
      error?.message ||
      '反馈记录失败，不影响继续查看结果',
    )
  } finally {
    feedbackSubmitting.value = false
  }
}

const confirmCandidate = (goodsId: string) => {
  void submitFeedback('confirmed', goodsId)
}

const rejectCandidates = () => {
  void submitFeedback('rejected')
}

const candidateConfirmLabel = (goodsId: string) => {
  if (feedbackOutcome.value === 'confirmed' && confirmedGoodsId.value === goodsId) {
    return '就是它啦'
  }
  if (feedbackOutcome.value) return '已回复'
  return '就是它！'
}

const confidenceLabel = (confidence: GoodsImageMatchConfidence) => {
  if (confidence === 'high') return '相似度较高'
  if (confidence === 'medium') return '较为相似'
  return '可能相似'
}

const statusLabel = (statusValue: GoodsListItem['status']) => {
  const labels: Record<GoodsListItem['status'], string> = {
    draft: '草稿',
    intended: '意向入手',
    in_cabinet: '在馆',
    outdoor: '出街中',
    sold: '已售出',
  }
  return labels[statusValue]
}

const goodsMeta = (goods: GoodsListItem) => {
  const characters = goods.characters.map((character) => character.name).join('、')
  return [goods.ip?.name, characters].filter(Boolean).join(' · ')
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) {
      resetRequestState()
      clearPreview()
      photoSourceSheetVisible.value = false
    }
  },
)

onBeforeUnmount(() => {
  resetRequestState()
  clearPreview()
})
</script>

<style scoped>
.sr-only-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.goods-image-matcher {
  min-height: 280px;
}

.goods-image-matcher__empty {
  padding: 8px 0 4px;
}

.goods-image-matcher__dropzone {
  width: 100%;
  min-height: 250px;
  border: 1px dashed rgba(212, 175, 55, 0.62);
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.14), transparent 55%),
    #fffdf8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px 20px;
  color: var(--text-regular);
  cursor: pointer;
}

.goods-image-matcher__dropzone strong {
  color: var(--text-dark);
  font-size: 17px;
}

.goods-image-matcher__dropzone span:not(.goods-image-matcher__dropzone-icon) {
  max-width: 460px;
  color: var(--text-light);
  font-size: 13px;
  line-height: 1.6;
}

.goods-image-matcher__dropzone small {
  color: var(--text-lighter);
  font-size: 12px;
}

.goods-image-matcher__dropzone-icon {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(212, 175, 55, 0.15);
  color: var(--primary-gold-dark);
  font-size: 28px;
}

.goods-image-matcher__preview {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 12px;
  border-radius: 16px;
  background: #f8f8f7;
  border: 1px solid var(--border-color);
}

.goods-image-matcher__preview-image {
  width: 86px;
  height: 86px;
  object-fit: cover;
  border-radius: 12px;
  background: #fff;
}

.goods-image-matcher__preview-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.goods-image-matcher__preview-name {
  overflow: hidden;
  color: var(--text-dark);
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-image-matcher__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-light);
  font-size: 12px;
}

.goods-image-matcher__status.is-error {
  color: #d64545;
}

.goods-image-matcher__status.is-ready {
  color: #3e8e5b;
}

.goods-image-matcher__reselect {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: #fff;
  color: var(--text-regular);
  font-weight: 700;
  cursor: pointer;
}

.goods-image-matcher__loading,
.goods-image-matcher__error,
.goods-image-matcher__not-found {
  min-height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px 16px;
  text-align: center;
}

.goods-image-matcher__loading-ring {
  width: 34px;
  height: 34px;
  border: 3px solid rgba(212, 175, 55, 0.2);
  border-top-color: var(--primary-gold);
  border-radius: 50%;
  animation: goods-match-spin 0.8s linear infinite;
}

.goods-image-matcher__loading p,
.goods-image-matcher__error p,
.goods-image-matcher__not-found p {
  margin: 0;
  color: var(--text-light);
  font-size: 13px;
  line-height: 1.6;
}

.goods-image-matcher__error > .el-icon,
.goods-image-matcher__not-found > .el-icon {
  color: var(--primary-gold-dark);
  font-size: 42px;
}

.goods-image-matcher__error h3,
.goods-image-matcher__not-found h3,
.goods-image-matcher__result-heading h3 {
  margin: 0;
  color: var(--text-dark);
  font-size: 17px;
}

.goods-image-matcher__matched,
.goods-image-matcher__results {
  margin-top: 16px;
}

.goods-image-matcher__result-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}

.goods-image-matcher__result-heading > .el-icon {
  margin-top: 2px;
  color: var(--primary-gold-dark);
  font-size: 22px;
}

.goods-image-matcher__result-heading.is-matched > .el-icon {
  color: #3e8e5b;
}

.goods-image-matcher__result-heading p {
  margin: 4px 0 0;
  color: var(--text-light);
  font-size: 12px;
  line-height: 1.5;
}

.goods-image-match-list {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.goods-image-match-card {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 14px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: #fff;
  cursor: pointer;
  transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.goods-image-match-card:hover {
  transform: translateY(-1px);
  border-color: rgba(212, 175, 55, 0.5);
  box-shadow: var(--shadow-sm);
}

.goods-image-match-card.is-primary {
  border-color: rgba(62, 142, 91, 0.42);
  background: linear-gradient(135deg, #f8fff9, #fffef8);
}

.goods-image-match-card__image {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f5f4;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-lighter);
  font-size: 28px;
}

.goods-image-match-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.goods-image-match-card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
}

.goods-image-match-card__title-row {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.goods-image-match-card__title-row strong {
  min-width: 0;
  color: var(--text-dark);
  font-size: 15px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-image-match-card__title-row span {
  flex-shrink: 0;
  color: var(--primary-gold-dark);
  font-size: 11px;
  font-weight: 700;
}

.goods-image-match-card__body p {
  margin: 0;
  color: var(--text-light);
  font-size: 12px;
  line-height: 1.5;
}

.goods-image-match-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.goods-image-match-card__tags span {
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.1);
  color: #826b1e;
  font-size: 11px;
  font-weight: 700;
}

.goods-image-match-card__confirm {
  min-height: 34px;
  margin-top: 1px;
  padding: 0 12px;
  border: 0;
  border-radius: 9px;
  background: rgba(62, 142, 91, 0.12);
  color: #2e7247;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.goods-image-match-card__confirm:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.goods-image-matcher__feedback {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(62, 142, 91, 0.1);
  color: #2e7247;
  font-size: 12px;
  font-weight: 700;
}

.goods-image-matcher__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.is-spinning {
  animation: goods-match-spin 0.8s linear infinite;
}

@keyframes goods-match-spin {
  to {
    transform: rotate(360deg);
  }
}

:global(.goods-image-matcher-dialog .el-dialog__body) {
  padding-top: 8px;
}

@media (max-width: 768px) {
  .goods-image-matcher__preview {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .goods-image-matcher__preview-image {
    width: 72px;
    height: 72px;
  }

  .goods-image-matcher__reselect {
    grid-column: 1 / -1;
    width: 100%;
  }

  .goods-image-matcher__actions {
    display: flex;
    gap: 8px;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .goods-image-matcher__actions :deep(.el-button) {
    flex: 1 1 0;
    min-width: 0;
    margin-left: 0;
    padding-right: 8px;
    padding-left: 8px;
    white-space: nowrap;
  }

  .goods-image-match-card {
    grid-template-columns: 78px minmax(0, 1fr);
    gap: 10px;
  }

  .goods-image-match-card__image {
    width: 78px;
    height: 78px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .goods-image-match-card,
  .goods-image-matcher__loading-ring,
  .is-spinning {
    transition: none;
    animation-duration: 1.5s;
  }
}
</style>
