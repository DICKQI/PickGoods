import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as reminderApi from '@/api/reminder'
import type { Preorder, PreorderInput, PreorderOcrFields, PreorderUpdateInput } from '@/api/types'
import { monthToQuarter, toMonthStart } from '@/utils/preorder'

export const PLATFORM_OPTIONS = ['淘宝', '天猫', '京东', '拼多多', '抖音', 'B站会员购', '代购', '线下展会', '其他']

export const GRANULARITY_OPTIONS: Array<{ label: string; value: 'month' | 'quarter' }> = [
  { label: '按月', value: 'month' },
  { label: '按季度', value: 'quarter' },
]

// 季度下拉选项（'YYYY-Qn'）：从打开表单时的当前季度起向后生成未来 3 年（12 个季度）
const QUARTER_OPTIONS_FUTURE_COUNT = 12

const emptyForm = (): PreorderInput => ({
  name: '',
  platform: '',
  shop_name: '',
  order_no: '',
  deposit_amount: 0,
  balance_amount: null,
  time_granularity: 'month',
  estimated_month: '',
  notes: '',
})

/** 预购新增 / 编辑表单逻辑（OCR 仅用于新增）；成功提交返回 true，由视图负责关闭弹层与刷新 */
export function usePreorderEditor() {
  const formRef = ref()
  const editingId = ref<string | null>(null)
  const formSubmitting = ref(false)
  const form = reactive<PreorderInput>(emptyForm())

  const formRules = {
    name: [{ required: true, message: '请输入手办名称', trigger: 'blur' }],
    deposit_amount: [{ required: true, message: '请输入定金金额', trigger: 'blur' }],
    estimated_month: [{ required: true, message: '请选择预计补款时间', trigger: 'change' }],
  }

  // 打开表单时的基准时间，随 openCreate/openEdit 刷新，保证按用户实际使用时间生成
  const nowRef = ref(new Date())

  const quarterOptions = computed(() => {
    const now = nowRef.value
    const options: Array<{ label: string; value: string }> = []
    let year = now.getFullYear()
    let quarter = Math.floor(now.getMonth() / 3) + 1
    for (let i = 0; i < QUARTER_OPTIONS_FUTURE_COUNT; i++) {
      options.push({ label: `${year}年 Q${quarter}`, value: `${year}-Q${quarter}` })
      if (quarter === 4) {
        quarter = 1
        year++
      } else {
        quarter++
      }
    }
    // 回显超出未来 12 个季度的旧值（编辑历史记录 / OCR 识别远期季度）
    const current = form.estimated_month
    if (typeof current === 'string' && /^\d{4}-Q[1-4]$/i.test(current) && !options.some((o) => o.value === current)) {
      const m = current.match(/^(\d{4})-Q([1-4])$/i)!
      const now = nowRef.value
      const nowYear = now.getFullYear()
      const nowQuarter = Math.floor(now.getMonth() / 3) + 1
      const isPast = Number(m[1]) < nowYear || (Number(m[1]) === nowYear && Number(m[2]) < nowQuarter)
      options.push({ label: isPast ? `${current}（已过期）` : current, value: current })
    }
    return options
  })

  const resetForm = () => {
    editingId.value = null
    Object.assign(form, emptyForm())
    formRef.value?.clearValidate()
  }

  const openCreate = () => {
    resetForm()
    nowRef.value = new Date()
    ocrSession++
    ocrUploading.value = false
    ocrWarnings.value = []
    ocrPanelVisible.value = false
  }

  const openEdit = (item: Preorder) => {
    nowRef.value = new Date()
    editingId.value = item.id
    ocrSession++
    ocrUploading.value = false
    ocrWarnings.value = []
    ocrPanelVisible.value = false
    form.name = item.name
    form.platform = item.platform || ''
    form.shop_name = item.shop_name || ''
    form.order_no = item.order_no || ''
    form.deposit_amount = Number(item.deposit_amount)
    form.balance_amount = item.balance_amount !== null ? Number(item.balance_amount) : null
    form.time_granularity = item.time_granularity
    // 按粒度回填表单值：月粒度 '2026-08-01' → '2026-08'；季度粒度 → '2026-Q3'
    form.estimated_month =
      item.time_granularity === 'quarter'
        ? monthToQuarter(item.estimated_month)
        : (item.estimated_month || '').slice(0, 7)
    form.notes = item.notes || ''
    nextTick(() => formRef.value?.clearValidate())
  }

  // 切换时间粒度时清空已选时间，避免残留不匹配的格式
  const handleGranularityChange = () => {
    form.estimated_month = ''
  }

  // ─── 智能识别（截图，弱化入口）───
  const ocrUploadRef = ref()
  const ocrUploading = ref(false)
  const ocrPanelVisible = ref(false)
  const ocrWarnings = ref<string[]>([])
  // 识别会话号：openCreate/openEdit 时递增；请求返回时若会话已切换，丢弃迟到结果
  let ocrSession = 0

  const ocrDetail = (err: any): string => {
    return err?.response?.data?.detail || err?.message || '识别失败，请重试'
  }

  // 识别结果 → 表单：只覆盖识别到的字段，未识别字段保留用户手填值
  const applyOcrResult = (fields: PreorderOcrFields) => {
    let filled = 0
    if (fields.name) { form.name = fields.name; filled++ }
    if (fields.platform) { form.platform = fields.platform; filled++ }
    if (fields.shop_name) { form.shop_name = fields.shop_name; filled++ }
    if (fields.order_no) { form.order_no = fields.order_no; filled++ }
    if (fields.deposit_amount !== null && fields.deposit_amount !== undefined && fields.deposit_amount !== '') {
      const amount = Number(fields.deposit_amount)
      if (Number.isFinite(amount)) {
        form.deposit_amount = amount
        filled++
      }
    }
    if (fields.balance_amount !== null && fields.balance_amount !== undefined && fields.balance_amount !== '') {
      const amount = Number(fields.balance_amount)
      if (Number.isFinite(amount)) {
        form.balance_amount = amount
        filled++
      }
    }
    if (fields.estimated_month) {
      const isQuarter = fields.time_granularity === 'quarter'
      form.time_granularity = isQuarter ? 'quarter' : 'month'
      // 后端返回粒度起点 'YYYY-MM'：月粒度截 'YYYY-MM'，季度粒度转表单值 'YYYY-Qn'
      form.estimated_month = isQuarter
        ? monthToQuarter(fields.estimated_month + '-01')
        : fields.estimated_month.slice(0, 7)
      filled++
    }
    ocrWarnings.value = fields.warnings || []
    formRef.value?.clearValidate()
    if (ocrWarnings.value.length) {
      ElMessage.warning(`已自动填入 ${filled} 个字段，请核对下方提示`)
    } else {
      ElMessage.success(`已自动填入 ${filled} 个字段，请核对后保存`)
    }
  }

  const handleOcrFileChange = async (file: File) => {
    if (!file) return
    if (ocrUploading.value) {
      ElMessage.warning('正在识别中，请稍候再上传')
      return
    }
    const session = ocrSession
    ocrUploading.value = true
    ocrWarnings.value = []
    try {
      const result = await reminderApi.recognizePreorderImage(file)
      if (session !== ocrSession) return // 对话框已关闭或切换目标，丢弃迟到结果
      applyOcrResult(result.preorder)
    } catch (err: any) {
      if (session === ocrSession) ElMessage.error(ocrDetail(err))
    } finally {
      // 仅当会话未切换时才复位 loading：旧请求的 finally 不得影响新会话的上传状态
      if (session === ocrSession) {
        ocrUploading.value = false
        ocrUploadRef.value?.clearFiles()
      }
    }
  }

  const submitForm = async (): Promise<boolean> => {
    if (ocrUploading.value) {
      ElMessage.warning('识别进行中，请稍候再保存')
      return false
    }
    try {
      await formRef.value.validate()
    } catch {
      return false // 校验错误由表单展示
    }
    formSubmitting.value = true
    try {
      if (editingId.value) {
        const payload: PreorderUpdateInput = {
          name: form.name,
          platform: form.platform,
          shop_name: form.shop_name,
          order_no: form.order_no,
          deposit_amount: form.deposit_amount,
          balance_amount: form.balance_amount ?? null,
          notes: form.notes,
        }
        await reminderApi.updatePreorder(editingId.value, payload)
        ElMessage.success('预购已更新')
      } else {
        const payload: PreorderInput = {
          ...form,
          deposit_amount: form.deposit_amount,
          balance_amount: form.balance_amount ?? null,
          time_granularity: form.time_granularity,
          // 统一转为粒度起点日期：后端按粒度归一化存储
          estimated_month: form.estimated_month
            ? toMonthStart(form.estimated_month, form.time_granularity ?? 'month')
            : '',
        }
        await reminderApi.createPreorder(payload)
        ElMessage.success('预购已登记，到补款期将自动提醒')
      }
      return true
    } catch {
      // 校验错误由表单 / 拦截器提示
      return false
    } finally {
      formSubmitting.value = false
    }
  }

  return {
    form,
    formRules,
    formRef,
    editingId,
    formSubmitting,
    quarterOptions,
    openCreate,
    openEdit,
    handleGranularityChange,
    ocrUploadRef,
    ocrUploading,
    ocrPanelVisible,
    ocrWarnings,
    handleOcrFileChange,
    submitForm,
  }
}
