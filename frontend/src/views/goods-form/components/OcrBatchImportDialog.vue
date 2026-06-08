<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="📸 OCR 批量导入确认"
    width="min(96vw, 980px)"
    :close-on-click-modal="false"
    class="ocr-batch-dialog"
    @open="handleOpen"
  >
    <div v-if="rows.length === 0" class="ocr-batch-empty">
      暂无识别结果
    </div>

    <template v-else>
      <div class="ocr-batch-toolbar">
        <div>
          <strong>识别到 {{ rows.length }} 个候选谷子</strong>
          <span class="toolbar-subtitle">勾选需要导入的条目，确认前可以逐条修改。</span>
        </div>
        <el-button size="small" @click="addBlankRow">新增空白条目</el-button>
      </div>

      <div class="ocr-batch-list">
        <div
          v-for="(row, index) in rows"
          :key="row.localId"
          class="ocr-batch-card"
          :class="[`is-${row.status}`, { 'has-error': row.errors.length > 0 }]"
        >
          <div class="card-head">
            <el-checkbox v-model="row.selected" :disabled="submitting || row.status === 'success' || row.status === 'merged'">
              #{{ index + 1 }}
            </el-checkbox>
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
            <div class="card-spacer"></div>
            <el-button size="small" text type="danger" :disabled="submitting" @click="removeRow(index)">删除</el-button>
          </div>

          <div v-if="row.errors.length || row.warnings.length" class="row-messages">
            <el-alert
              v-for="message in row.errors"
              :key="`e-${message}`"
              :title="message"
              type="error"
              :closable="false"
              show-icon
            />
            <el-alert
              v-for="message in row.warnings"
              :key="`w-${message}`"
              :title="message"
              type="warning"
              :closable="false"
              show-icon
            />
          </div>

          <div class="field-grid">
            <label class="field field--wide">
              <span>谷子名称</span>
              <el-input v-model="row.name" placeholder="谷子名称" />
            </label>
            <label class="field">
              <span>单价</span>
              <el-input v-model="row.price" placeholder="单价" />
            </label>
            <label class="field">
              <span>数量</span>
              <el-input-number v-model="row.quantity" :min="1" :max="999" style="width: 100%" />
            </label>
            <label class="field">
              <span>入手日期</span>
              <el-date-picker v-model="row.purchase_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
            </label>
            <label class="field">
              <span>是否官谷</span>
              <el-switch v-model="row.is_official" active-text="是" inactive-text="否" inline-prompt />
            </label>
            <label class="field">
              <span>IP 作品</span>
              <el-select v-model="row.ipId" placeholder="选择IP" filterable clearable style="width: 100%" @change="handleRowIpChange(row)">
                <el-option v-for="ip in ipOptions" :key="ip.id" :label="ip.name" :value="ip.id" />
              </el-select>
            </label>
            <label class="field">
              <span>角色</span>
              <el-select v-model="row.characterIds" placeholder="选择角色" filterable multiple clearable style="width: 100%">
                <el-option v-for="char in charactersForRow(row)" :key="char.id" :label="char.name" :value="char.id" />
              </el-select>
            </label>
            <label class="field">
              <span>品类</span>
              <el-select v-model="row.categoryId" placeholder="选择品类" filterable clearable style="width: 100%">
                <el-option v-for="cat in categoryOptions" :key="cat.id" :label="cat.path_name || cat.name" :value="cat.id" />
              </el-select>
            </label>
          </div>

          <div v-if="row.status === 'duplicate'" class="duplicate-panel">
            <div class="duplicate-title">检测到可能重复，请选择处理方式</div>
            <div class="duplicate-list">
              <div
                v-for="candidate in row.duplicateCandidates"
                :key="candidate.id"
                class="duplicate-item"
                :class="{ 'is-selected': row.selectedDuplicateId === candidate.id }"
                @click="row.selectedDuplicateId = candidate.id"
              >
                <span class="dup-name">{{ candidate.name }}</span>
                <span class="dup-meta">库存 {{ candidate.quantity }} · {{ candidate.price || '无价格' }}</span>
              </div>
            </div>
            <div class="duplicate-actions">
              <el-button size="small" :disabled="!row.selectedDuplicateId || submitting" @click="resolveDuplicate(row, 'merge')">合并到所选</el-button>
              <el-button size="small" :disabled="submitting" @click="resolveDuplicate(row, 'new')">独立新建</el-button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <OcrRawTextViewer v-if="ocrResult?.raw_text" :text="ocrResult.raw_text" />

    <template #footer>
      <div class="ocr-batch-footer">
        <el-button @click="emit('update:modelValue', false)" :disabled="submitting">关闭</el-button>
        <el-button @click="addBlankRow" :disabled="submitting">新增条目</el-button>
        <el-button type="primary" @click="handleImport" :loading="submitting">导入选中条目</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createGoods } from '@/api/goods'
import OcrRawTextViewer from './OcrRawTextViewer.vue'
import type {
  Category,
  Character,
  GoodsDuplicateCandidate,
  GoodsInput,
  IP,
  OcrGoodsItem,
  OcrResult,
} from '@/api/types'

type RowStatus = 'pending' | 'success' | 'merged' | 'duplicate' | 'failed'

interface BatchDefaults {
  status: GoodsInput['status']
  location?: number | null
  theme_id?: number | null
  notes?: string | null
  purchase_date?: string | null
  is_official?: boolean
}

interface ImportRow {
  localId: string
  selected: boolean
  name: string
  price: string
  quantity: number
  purchase_date: string
  is_official: boolean
  ipId: number | undefined
  characterIds: number[]
  categoryId: number | undefined
  raw_text: string
  source_lines: string[]
  warnings: string[]
  errors: string[]
  status: RowStatus
  duplicateCandidates: GoodsDuplicateCandidate[]
  selectedDuplicateId: string | null
  lastPayload: GoodsInput | null
}

const props = defineProps<{
  modelValue: boolean
  ocrResult: OcrResult | null
  ipOptions: IP[]
  allCharacters: Character[]
  categoryOptions: Category[]
  defaults: BatchDefaults
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  imported: []
}>()

const rows = ref<ImportRow[]>([])
const submitting = ref(false)

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function rowFromItem(item?: OcrGoodsItem): ImportRow {
  const suggestions = item?.suggestions
  return {
    localId: createLocalId(),
    selected: true,
    name: item?.name || '',
    price: item?.price || '',
    quantity: item?.quantity || 1,
    purchase_date: item?.purchase_date || props.defaults.purchase_date || '',
    is_official: item?.is_official ?? props.defaults.is_official ?? true,
    ipId: suggestions?.ip?.id,
    characterIds: suggestions?.characters?.map((c) => c.id) || [],
    categoryId: suggestions?.category?.id,
    raw_text: item?.raw_text || '',
    source_lines: item?.source_lines || [],
    warnings: item?.warnings ? [...item.warnings] : [],
    errors: [],
    status: 'pending',
    duplicateCandidates: [],
    selectedDuplicateId: null,
    lastPayload: null,
  }
}

function handleOpen() {
  const items = props.ocrResult?.items?.length
    ? props.ocrResult.items
    : props.ocrResult
      ? [{
          ...props.ocrResult,
          source_lines: props.ocrResult.raw_text ? props.ocrResult.raw_text.split('\n') : [],
          warnings: ['未能拆分多个商品，已按单条结果展示'],
        }]
      : []
  rows.value = items.map((item) => rowFromItem(item))
}

function addBlankRow() {
  rows.value.push(rowFromItem())
}

function removeRow(index: number) {
  rows.value.splice(index, 1)
}

function charactersForRow(row: ImportRow) {
  if (!row.ipId) return props.allCharacters
  return props.allCharacters.filter((char) => char.ip.id === row.ipId)
}

function handleRowIpChange(row: ImportRow) {
  const allowedIds = new Set(charactersForRow(row).map((char) => char.id))
  row.characterIds = row.characterIds.filter((id) => allowedIds.has(id))
}

function validateRow(row: ImportRow) {
  const errors: string[] = []
  if (!row.name.trim()) errors.push('请填写谷子名称')
  if (!row.ipId) errors.push('请选择 IP 作品')
  if (!row.characterIds.length) errors.push('请至少选择一个角色')
  if (!row.categoryId) errors.push('请选择品类')
  row.errors = errors
  return errors.length === 0
}

function buildPayload(row: ImportRow, mergeStrategy: GoodsInput['merge_strategy'] = 'auto'): GoodsInput {
  const payload: GoodsInput = {
    name: row.name.trim(),
    status: props.defaults.status,
    location: props.defaults.location ?? undefined,
    theme_id: props.defaults.theme_id ?? null,
    notes: props.defaults.notes ?? null,
    quantity: row.quantity,
    price: row.price ? row.price.toString() : undefined,
    purchase_date: row.purchase_date || undefined,
    is_official: row.is_official,
    ip_id: row.ipId!,
    character_ids: row.characterIds,
    category_id: row.categoryId!,
    merge_strategy: mergeStrategy,
  }
  return payload
}

function statusText(status: RowStatus) {
  const map: Record<RowStatus, string> = {
    pending: '待导入',
    success: '已导入',
    merged: '已合并',
    duplicate: '疑似重复',
    failed: '失败',
  }
  return map[status]
}

function statusTagType(status: RowStatus) {
  if (status === 'success' || status === 'merged') return 'success'
  if (status === 'duplicate') return 'warning'
  if (status === 'failed') return 'danger'
  return 'info'
}

async function submitRow(row: ImportRow, payload: GoodsInput) {
  row.errors = []
  row.lastPayload = payload
  try {
    const result = await createGoods(payload)
    row.status = result.merged ? 'merged' : 'success'
    row.selected = false
    row.duplicateCandidates = []
    row.selectedDuplicateId = null
  } catch (err: any) {
    const data = err.response?.data
    if (err.response?.status === 409 && data?.code === 'goods_duplicate' && Array.isArray(data.candidates)) {
      row.status = 'duplicate'
      row.duplicateCandidates = data.candidates
      row.selectedDuplicateId = data.candidates[0]?.id || null
      return
    }
    row.status = 'failed'
    row.errors = [data?.detail || err.message || '导入失败']
  }
}

async function handleImport() {
  const selectedRows = rows.value.filter((row) => (
    row.selected
    && row.status !== 'success'
    && row.status !== 'merged'
    && row.status !== 'duplicate'
  ))
  if (!selectedRows.length) {
    const hasDuplicate = rows.value.some((row) => row.status === 'duplicate')
    ElMessage.info(hasDuplicate ? '请先处理疑似重复条目' : '没有选中的待导入条目')
    return
  }

  const valid = selectedRows.map(validateRow).every(Boolean)
  if (!valid) {
    ElMessage.warning('请先补全标红条目的必填信息')
    return
  }

  submitting.value = true
  try {
    for (const row of selectedRows) {
      await submitRow(row, buildPayload(row, 'auto'))
    }
    const hasPendingDuplicate = rows.value.some((row) => row.status === 'duplicate')
    const hasFailed = rows.value.some((row) => row.status === 'failed')
    if (hasPendingDuplicate) {
      ElMessage.warning('部分条目疑似重复，请逐条选择合并或独立新建')
    } else if (hasFailed) {
      ElMessage.warning('部分条目导入失败，请检查后重试')
    } else {
      ElMessage.success('批量导入完成')
      emit('imported')
      emit('update:modelValue', false)
    }
  } finally {
    submitting.value = false
  }
}

async function resolveDuplicate(row: ImportRow, action: 'merge' | 'new') {
  if (action === 'merge' && !row.selectedDuplicateId) {
    ElMessage.warning('请先选择要合并到的谷子')
    return
  }
  if (!validateRow(row)) {
    ElMessage.warning('请先补全该条目的必填信息')
    return
  }

  submitting.value = true
  try {
    const payload: GoodsInput = {
      ...buildPayload(row, action === 'merge' ? 'merge' : 'new'),
      merge_strategy: action === 'merge' ? 'merge' : 'new',
      merge_target_id: action === 'merge' ? row.selectedDuplicateId || undefined : undefined,
    }
    await submitRow(row, payload)
    const unresolved = rows.value.some((item) => item.status === 'duplicate' || item.status === 'failed' || item.selected)
    if (!unresolved) {
      ElMessage.success('批量导入完成')
      emit('imported')
      emit('update:modelValue', false)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.ocr-batch-dialog :deep(.el-dialog__body) { padding-top: 8px; max-height: min(72vh, 760px); overflow: auto; }
.ocr-batch-empty { padding: 40px 0; text-align: center; color: #909399; }
.ocr-batch-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.toolbar-subtitle { margin-left: 8px; color: #909399; font-size: 12px; }
.ocr-batch-list { display: flex; flex-direction: column; gap: 12px; }
.ocr-batch-card { padding: 14px; border: 1px solid #ebeef5; border-radius: 14px; background: #fff; box-shadow: 0 4px 14px rgba(15,23,42,0.04); }
.ocr-batch-card.has-error { border-color: #f56c6c; }
.ocr-batch-card.is-success, .ocr-batch-card.is-merged { background: #f6ffed; border-color: #b7eb8f; }
.ocr-batch-card.is-duplicate { background: #fffaf0; border-color: #e6a23c; }
.card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.card-spacer { flex: 1; }
.row-messages { display: grid; gap: 6px; margin-bottom: 10px; }
.field-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 12px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #606266; }
.field--wide { grid-column: span 2; }
.duplicate-panel { margin-top: 12px; padding: 12px; border-radius: 10px; background: rgba(230,162,60,0.08); }
.duplicate-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #7a4b00; }
.duplicate-list { display: grid; gap: 8px; }
.duplicate-item { display: flex; justify-content: space-between; gap: 10px; padding: 10px; border-radius: 8px; border: 1px solid transparent; background: #fff; cursor: pointer; }
.duplicate-item.is-selected { border-color: #d4af37; background: rgba(212,175,55,0.08); }
.dup-name { font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dup-meta { flex-shrink: 0; color: #909399; font-size: 12px; }
.duplicate-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.ocr-batch-footer { display: flex; justify-content: flex-end; gap: 10px; }
@media (max-width: 768px) {
  .ocr-batch-dialog :deep(.el-dialog) { width: 96vw !important; margin-top: 3vh; }
  .ocr-batch-toolbar { align-items: flex-start; flex-direction: column; }
  .toolbar-subtitle { display: block; margin: 4px 0 0; }
  .field-grid { grid-template-columns: 1fr 1fr; }
  .field--wide { grid-column: span 2; }
}
@media (max-width: 480px) {
  .field-grid { grid-template-columns: 1fr; }
  .field--wide { grid-column: span 1; }
  .duplicate-item { flex-direction: column; }
  .ocr-batch-footer { flex-wrap: wrap; }
}
</style>
