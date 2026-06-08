<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="📸 OCR 识别结果确认"
    width="min(92vw, 600px)"
    :close-on-click-modal="false"
    class="ocr-fill-dialog"
    @open="handleOpen"
  >
    <div v-if="!ocrResult && !loading" class="ocr-empty">暂无识别结果</div>

    <template v-else>
      <div class="ocr-section">
        <h4 class="ocr-section-title">已识别字段</h4>
        <div class="ocr-field-grid">
          <div class="ocr-field">
            <label>商品名</label>
            <el-input v-model="editData.name" placeholder="商品名" />
          </div>
          <div class="ocr-field">
            <label>单价</label>
            <el-input v-model="editData.price" placeholder="单价" />
          </div>
          <div class="ocr-field">
            <label>数量</label>
            <el-input-number v-model="editData.quantity" :min="1" style="width: 100%" />
          </div>
          <div class="ocr-field">
            <label>入手日期</label>
            <el-date-picker v-model="editData.purchase_date" type="date" placeholder="选择日期" style="width: 100%" value-format="YYYY-MM-DD" />
          </div>
          <div class="ocr-field">
            <label>是否官谷</label>
            <el-switch v-model="editData.is_official" active-text="是" inactive-text="否" inline-prompt />
          </div>
        </div>
      </div>

      <div class="ocr-section">
        <h4 class="ocr-section-title">智能匹配建议</h4>
        <div class="ocr-field-grid">
          <div class="ocr-field">
            <label>
              IP 作品
              <span v-if="editData.suggestedIp" class="ocr-confidence" :class="confidenceClass(editData.suggestedIp.confidence)">
                {{ (editData.suggestedIp.confidence * 100).toFixed(0) }}%
              </span>
            </label>
            <el-select v-model="editData.ipId" placeholder="选择IP" filterable clearable style="width: 100%" @change="handleIpChange">
              <el-option v-for="ip in ipOptions" :key="ip.id" :label="ip.name" :value="ip.id" />
            </el-select>
          </div>
          <div class="ocr-field">
            <label>角色</label>
            <el-select v-model="editData.characterIds" placeholder="选择角色（可多选）" filterable multiple clearable style="width: 100%">
              <el-option v-for="char in filteredCharacters" :key="char.id" :label="char.name" :value="char.id" />
            </el-select>
          </div>
          <div class="ocr-field">
            <label>
              品类
              <span v-if="editData.suggestedCategory" class="ocr-confidence" :class="confidenceClass(editData.suggestedCategory.confidence)">
                {{ (editData.suggestedCategory.confidence * 100).toFixed(0) }}%
              </span>
            </label>
            <el-select v-model="editData.categoryId" placeholder="选择品类" filterable clearable style="width: 100%">
              <el-option v-for="cat in categoryOptions" :key="cat.id" :label="cat.path_name || cat.name" :value="cat.id">
                <span :style="cat.color_tag ? { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: cat.color_tag, marginRight: '8px', verticalAlign: 'middle' } : {}"></span>
                {{ cat.path_name || cat.name }}
              </el-option>
            </el-select>
          </div>
        </div>
      </div>

      <OcrRawTextViewer :text="editData.raw_text" />
    </template>

    <template #footer>
      <div class="ocr-dialog-footer">
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :disabled="!ocrResult">确认填入</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'
import type { IP, Character, Category, OcrResult } from '@/api/types'
import OcrRawTextViewer from './OcrRawTextViewer.vue'

interface FillData {
  name: string
  price: string
  quantity: number
  purchase_date: string
  is_official: boolean
  ipId: number | undefined
  characterIds: number[]
  categoryId: number | undefined
  raw_text: string
  suggestedIp: { id: number; name: string; confidence: number } | null
  suggestedCategory: { id: number; name: string; confidence: number } | null
}

const props = defineProps<{
  modelValue: boolean
  ocrResult: OcrResult | null
  ipOptions: IP[]
  allCharacters: Character[]
  categoryOptions: Category[]
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [data: FillData]
}>()

const editData = reactive<FillData>({
  name: '',
  price: '',
  quantity: 1,
  purchase_date: '',
  is_official: true,
  ipId: undefined,
  characterIds: [],
  categoryId: undefined,
  raw_text: '',
  suggestedIp: null,
  suggestedCategory: null,
})

function resetEditData() {
  editData.name = ''
  editData.price = ''
  editData.quantity = 1
  editData.purchase_date = ''
  editData.is_official = true
  editData.ipId = undefined
  editData.characterIds = []
  editData.categoryId = undefined
  editData.raw_text = ''
  editData.suggestedIp = null
  editData.suggestedCategory = null
}

function populateFromResult(result: OcrResult) {
  editData.name = result.name || ''
  editData.price = result.price || ''
  editData.quantity = result.quantity || 1
  editData.purchase_date = result.purchase_date || ''
  editData.is_official = result.is_official ?? true
  editData.raw_text = result.raw_text || ''

  const s = result.suggestions
  if (s?.ip) {
    editData.suggestedIp = { id: s.ip.id, name: s.ip.name, confidence: s.ip.confidence }
    editData.ipId = s.ip.id
  } else {
    editData.suggestedIp = null
    editData.ipId = undefined
  }

  if (s?.characters?.length) {
    editData.characterIds = s.characters.map(c => c.id)
  } else {
    editData.characterIds = []
  }

  if (s?.category) {
    editData.suggestedCategory = { id: s.category.id, name: s.category.name, confidence: s.category.confidence }
    editData.categoryId = s.category.id
  } else {
    editData.suggestedCategory = null
    editData.categoryId = undefined
  }
}

function handleOpen() {
  if (props.ocrResult) {
    populateFromResult(props.ocrResult)
  } else {
    resetEditData()
  }
}

function handleConfirm() {
  emit('confirm', { ...editData, characterIds: getCharacterIdsForIp(editData.ipId) })
  emit('update:modelValue', false)
}

const filteredCharacters = computed(() => {
  if (!editData.ipId) return props.allCharacters
  return props.allCharacters.filter((c) => c.ip.id === editData.ipId)
})

function getCharacterIdsForIp(ipId: number | undefined) {
  if (!ipId) return editData.characterIds
  const allowedIds = new Set(
    props.allCharacters
      .filter((c) => c.ip.id === ipId)
      .map((c) => c.id)
  )
  return editData.characterIds.filter((id) => allowedIds.has(id))
}

function handleIpChange(value: number | undefined) {
  editData.characterIds = getCharacterIdsForIp(value)
}

function confidenceClass(confidence: number) {
  if (confidence >= 0.7) return 'conf-high'
  if (confidence >= 0.5) return 'conf-mid'
  return 'conf-low'
}
</script>

<style scoped>
.ocr-fill-dialog :deep(.el-dialog__body) { padding-top: 8px; }
.ocr-empty { text-align: center; color: #909399; padding: 40px 0; font-size: 14px; }
.ocr-section { margin-bottom: 20px; }
.ocr-section-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #303133; padding-left: 10px; border-left: 3px solid var(--primary-gold, #D4AF37); }
.ocr-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
@media (max-width: 480px) { .ocr-field-grid { grid-template-columns: 1fr; } }
.ocr-field { display: flex; flex-direction: column; gap: 4px; }
.ocr-field label { font-size: 12px; color: #606266; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.ocr-confidence { font-size: 11px; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
.ocr-confidence.conf-high { color: #67c23a; background: rgba(103,194,58,0.1); }
.ocr-confidence.conf-mid { color: #e6a23c; background: rgba(230,162,60,0.1); }
.ocr-confidence.conf-low { color: #f56c6c; background: rgba(245,108,108,0.1); }
.ocr-dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }
</style>
