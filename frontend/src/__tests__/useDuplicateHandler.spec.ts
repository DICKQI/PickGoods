import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDuplicateHandler } from '@/views/goods-form/composables/useDuplicateHandler'
import type { GoodsDuplicateCandidate, GoodsInput } from '@/api/types'

vi.mock('@/api/goods', () => ({
  createGoods: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}))

import { createGoods } from '@/api/goods'
import { ElMessage } from 'element-plus'

const makeCandidate = (id: string, name: string): GoodsDuplicateCandidate => ({
  id,
  name,
  ip_name: 'IP',
  characters: [],
  similarity_score: 90,
  main_photo: null,
  created_at: '2025-01-15T10:00:00Z',
} as any)

const makePayload = (): GoodsInput => ({
  name: '测试谷子',
  ip_id: 1,
  category_id: 1,
  character_ids: [1],
  quantity: 1,
} as any)

describe('useDuplicateHandler', () => {
  let onSuccess: any

  beforeEach(() => {
    vi.clearAllMocks()
    onSuccess = vi.fn().mockResolvedValue(undefined)
  })

  it('初始状态', () => {
    const handler = useDuplicateHandler({ onSuccess })
    expect(handler.duplicateDialogVisible.value).toBe(false)
    expect(handler.duplicateCandidates.value).toEqual([])
    expect(handler.duplicateSelectedId.value).toBeNull()
    expect(handler.submitting.value).toBe(false)
  })

  it('openDuplicateDialog 打开对话框并设置候选', () => {
    const handler = useDuplicateHandler({ onSuccess })
    const candidates = [makeCandidate('1', 'C1')]
    const payload = makePayload()

    handler.openDuplicateDialog(candidates, payload)

    expect(handler.duplicateDialogVisible.value).toBe(true)
    expect(handler.duplicateCandidates.value).toEqual(candidates)
    expect(handler.pendingCreatePayload.value).toBeTruthy()
    expect(handler.duplicateSelectedId.value).toBeNull()
  })

  it('setDuplicateSelectedId 设置选中 ID', () => {
    const handler = useDuplicateHandler({ onSuccess })
    handler.setDuplicateSelectedId('123')
    expect(handler.duplicateSelectedId.value).toBe('123')
  })

  it('closeDuplicateDialog 关闭并清除状态', () => {
    const handler = useDuplicateHandler({ onSuccess })
    handler.openDuplicateDialog([makeCandidate('1', 'C1')], makePayload())
    handler.setDuplicateSelectedId('1')

    handler.closeDuplicateDialog()

    expect(handler.duplicateDialogVisible.value).toBe(false)
    expect(handler.duplicateCandidates.value).toEqual([])
    expect(handler.duplicateSelectedId.value).toBeNull()
    expect(handler.pendingCreatePayload.value).toBeNull()
  })

  it('handleDuplicateMerge 未选择时提示', async () => {
    const handler = useDuplicateHandler({ onSuccess })
    handler.openDuplicateDialog([makeCandidate('1', 'C1')], makePayload())
    // 不设置 selectedId

    await handler.handleDuplicateMerge()

    expect(ElMessage.warning).toHaveBeenCalled()
    expect(createGoods).not.toHaveBeenCalled()
  })

  it('handleDuplicateMerge 成功调用 API 并回调', async () => {
    const mockResult = { id: 'new-1', name: '测试' }
    vi.mocked(createGoods).mockResolvedValue(mockResult as any)

    const handler = useDuplicateHandler({ onSuccess })
    handler.openDuplicateDialog([makeCandidate('1', 'C1')], makePayload())
    handler.setDuplicateSelectedId('1')

    await handler.handleDuplicateMerge()

    expect(createGoods).toHaveBeenCalledWith(
      expect.objectContaining({ merge_strategy: 'merge', merge_target_id: '1' })
    )
    expect(onSuccess).toHaveBeenCalledWith(mockResult, 'publish')
    expect(handler.duplicateDialogVisible.value).toBe(false)
  })

  it('handleDuplicateNew 调用 API 并回调', async () => {
    const mockResult = { id: 'new-2', name: '测试' }
    vi.mocked(createGoods).mockResolvedValue(mockResult as any)

    const handler = useDuplicateHandler({ onSuccess })
    handler.openDuplicateDialog([makeCandidate('1', 'C1')], makePayload())

    await handler.handleDuplicateNew()

    expect(createGoods).toHaveBeenCalledWith(
      expect.objectContaining({ merge_strategy: 'new' })
    )
    expect(onSuccess).toHaveBeenCalledWith(mockResult, 'publish')
  })

  it('handleDuplicateNew 失败时显示错误', async () => {
    vi.mocked(createGoods).mockRejectedValue(new Error('创建失败'))

    const handler = useDuplicateHandler({ onSuccess })
    handler.openDuplicateDialog([makeCandidate('1', 'C1')], makePayload())

    await handler.handleDuplicateNew()

    expect(ElMessage.error).toHaveBeenCalledWith('创建失败')
    expect(handler.submitting.value).toBe(false)
  })

  it('formatCandidateCreatedAt 格式化日期', () => {
    const handler = useDuplicateHandler({ onSuccess })
    const result = handler.formatCandidateCreatedAt('2025-01-15T10:00:00Z')
    expect(typeof result).toBe('string')
    expect(result).not.toBe('-')
  })

  it('formatCandidateCreatedAt 空字符串返回 -', () => {
    const handler = useDuplicateHandler({ onSuccess })
    expect(handler.formatCandidateCreatedAt('')).toBe('-')
  })
})
