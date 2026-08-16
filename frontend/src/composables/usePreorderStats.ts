import { ref } from 'vue'
import * as reminderApi from '@/api/reminder'
import type { PreorderStats } from '@/api/types'

export const EMPTY_PREORDER_STATS: PreorderStats = {
  pending_count: 0,
  due_this_month: 0,
  due_this_quarter: 0,
  converted_count: 0,
  total_pending_balance: '0.00',
}

/** 预购统计概览：加载失败静默，不阻断页面 */
export function usePreorderStats() {
  const stats = ref<PreorderStats>({ ...EMPTY_PREORDER_STATS })
  const loading = ref(false)

  const loadStats = async () => {
    loading.value = true
    try {
      stats.value = await reminderApi.getPreorderStats()
    } catch {
      // 统计失败不阻断页面
    } finally {
      loading.value = false
    }
  }

  return {
    stats,
    loading,
    loadStats,
  }
}
