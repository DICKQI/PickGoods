import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as reminderApi from '@/api/reminder'
import type { Preorder, PreorderDelayRecord } from '@/api/types'
import { addMonths, addQuarters, monthToQuarter, toMonthStart } from '@/utils/preorder'

export const DEFAULT_DELAY_REASON = '厂家跳票'

export interface DelayQuickOption {
  key: string
  label: string
  /** 目标表单值：月粒度 'YYYY-MM'，季度 'YYYY-Qn' */
  value: string
}

/** 自定义季度下拉向后生成的季度数 */
const QUARTER_OPTIONS_FUTURE_COUNT = 8

/**
 * 跳票延期表单逻辑：快捷/自定义目标时间、原因备注、延期历史；
 * 成功提交返回 true，由视图负责关闭弹窗与刷新。
 */
export function usePreorderDelay() {
  const target = ref<Preorder | null>(null)
  const reason = ref(DEFAULT_DELAY_REASON)
  const note = ref('')
  // 选中的快捷选项 key（默认第一个，保证一键可提交）；选「自定义」时用 customMonth / customQuarter
  const selectedKey = ref('')
  const customMonth = ref('')
  const customQuarter = ref('')
  const records = ref<PreorderDelayRecord[]>([])
  const historyLoading = ref(false)
  const historyError = ref(false)
  const submitting = ref(false)

  const isQuarter = computed(() => target.value?.time_granularity === 'quarter')

  /** 当前预计补款时间的表单值：月粒度 'YYYY-MM'，季度 'YYYY-Qn' */
  const currentValue = computed(() => {
    const item = target.value
    if (!item) return ''
    return item.time_granularity === 'quarter'
      ? monthToQuarter(item.estimated_month)
      : (item.estimated_month || '').slice(0, 7)
  })

  /** 快捷延期选项：月粒度 +1/+2/+3 个月，季度粒度 +1/+2 个季度 */
  const quickOptions = computed<DelayQuickOption[]>(() => {
    const base = currentValue.value
    if (!base) return []
    if (isQuarter.value) {
      return [
        { key: 'q1', label: '延后 1 个季度', value: addQuarters(base, 1) },
        { key: 'q2', label: '延后 2 个季度', value: addQuarters(base, 2) },
      ]
    }
    return [
      { key: 'm1', label: '延后 1 个月', value: addMonths(base, 1) },
      { key: 'm2', label: '延后 2 个月', value: addMonths(base, 2) },
      { key: 'm3', label: '延后 3 个月', value: addMonths(base, 3) },
    ]
  })

  /** 自定义季度下拉：当前季度之后 8 个季度 */
  const quarterOptions = computed<Array<{ label: string; value: string }>>(() => {
    const base = currentValue.value
    const m = base.match(/^(\d{4})-Q([1-4])$/i)
    if (!m) return []
    const options: Array<{ label: string; value: string }> = []
    let year = Number(m[1])
    let quarter = Number(m[2])
    for (let i = 0; i < QUARTER_OPTIONS_FUTURE_COUNT; i++) {
      quarter += 1
      if (quarter > 4) {
        quarter = 1
        year += 1
      }
      options.push({ label: `${year}年 Q${quarter}`, value: `${year}-Q${quarter}` })
    }
    return options
  })

  /** 自定义月份选择禁用不晚于当前预计月份的所有日期 */
  const customDisabledDate = (date: Date) => {
    const item = target.value
    if (!item || item.time_granularity === 'quarter') return false
    const current = new Date(item.estimated_month + 'T00:00:00')
    return date.getTime() <= current.getTime()
  }

  /** 最终目标表单值：快捷选项优先，否则取自定义值 */
  const selectedValue = computed(() => {
    const quick = quickOptions.value.find((o) => o.key === selectedKey.value)
    if (quick) return quick.value
    return isQuarter.value ? customQuarter.value : customMonth.value
  })

  const loadHistory = async () => {
    const item = target.value
    if (!item) return
    historyLoading.value = true
    historyError.value = false
    try {
      records.value = await reminderApi.listPreorderDelays(item.id)
    } catch {
      historyError.value = true
      records.value = []
    } finally {
      historyLoading.value = false
    }
  }

  const open = (item: Preorder): Promise<void> => {
    target.value = item
    reason.value = DEFAULT_DELAY_REASON
    note.value = ''
    selectedKey.value = item.time_granularity === 'quarter' ? 'q1' : 'm1'
    customMonth.value = ''
    customQuarter.value = ''
    return loadHistory()
  }

  const submit = async (): Promise<boolean> => {
    const item = target.value
    if (!item) return false
    const value = selectedValue.value
    if (!value) {
      ElMessage.warning('请选择延期后的时间')
      return false
    }
    submitting.value = true
    try {
      await reminderApi.delayPreorder(item.id, {
        to_month: toMonthStart(value, item.time_granularity),
        reason: reason.value.trim() || DEFAULT_DELAY_REASON,
        note: note.value.trim() ? note.value.trim() : null,
      })
      return true
    } catch {
      return false // 错误由拦截器提示
    } finally {
      submitting.value = false
    }
  }

  return {
    target,
    isQuarter,
    currentValue,
    quickOptions,
    selectedKey,
    selectedValue,
    customMonth,
    customQuarter,
    customDisabledDate,
    quarterOptions,
    reason,
    note,
    records,
    historyLoading,
    historyError,
    submitting,
    open,
    loadHistory,
    submit,
  }
}
