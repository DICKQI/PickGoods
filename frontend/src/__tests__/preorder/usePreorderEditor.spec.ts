import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { usePreorderEditor } from '@/composables/usePreorderEditor'
import type { Preorder } from '@/api/types'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

vi.mock('@/api/reminder', () => ({
  createPreorder: vi.fn(),
  updatePreorder: vi.fn(),
  recognizePreorderImage: vi.fn(),
}))

import { createPreorder, recognizePreorderImage, updatePreorder } from '@/api/reminder'

const makePreorder = (overrides: Partial<Preorder> = {}): Preorder => ({
  id: 'p-1',
  name: '流萤手办',
  platform: '淘宝',
  shop_name: '示例店',
  order_no: 'ORD-001',
  deposit_amount: '350.00',
  balance_amount: '700.00',
  time_granularity: 'month',
  estimated_month: '2026-08-01',
  status: 'pending',
  paid_at: null,
  goods_id: null,
  goods_name: null,
  notes: '备注',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...overrides,
})

const attachFormRef = (editor: ReturnType<typeof usePreorderEditor>) => {
  editor.formRef.value = {
    validate: vi.fn().mockResolvedValue(true),
    clearValidate: vi.fn(),
  }
  return editor
}

describe('usePreorderEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('openCreate 重置表单并递增识别会话', () => {
    const editor = attachFormRef(usePreorderEditor())
    editor.form.name = '旧名称'
    editor.openCreate()
    expect(editor.form.name).toBe('')
    expect(editor.form.time_granularity).toBe('month')
  })

  it('openEdit 回填字段，季度粒度转回表单值 YYYY-Qn', () => {
    const editor = attachFormRef(usePreorderEditor())
    editor.openEdit(
      makePreorder({ time_granularity: 'quarter', estimated_month: '2026-07-01' })
    )
    expect(editor.form.time_granularity).toBe('quarter')
    expect(editor.form.estimated_month).toBe('2026-Q3')
    expect(editor.form.deposit_amount).toBe(350)
  })

  it('提交月粒度归一化为月初，季度粒度归一化为季度首月', async () => {
    const editor = attachFormRef(usePreorderEditor())
    vi.mocked(createPreorder).mockResolvedValue(makePreorder())
    vi.mocked(updatePreorder).mockResolvedValue(makePreorder())

    editor.form.name = '月粒度'
    editor.form.deposit_amount = 100
    editor.form.time_granularity = 'month'
    editor.form.estimated_month = '2026-08'
    expect(await editor.submitForm()).toBe(true)
    expect(createPreorder).toHaveBeenLastCalledWith(
      expect.objectContaining({ estimated_month: '2026-08-01', time_granularity: 'month' })
    )

    editor.openEdit(makePreorder({ time_granularity: 'quarter' }))
    editor.form.name = '季度粒度'
    editor.form.deposit_amount = 200
    editor.form.estimated_month = '2026-Q4'
    expect(await editor.submitForm()).toBe(true)
    expect(updatePreorder).toHaveBeenLastCalledWith(
      'p-1',
      expect.objectContaining({ estimated_month: '2026-10-01', time_granularity: 'quarter' })
    )
  })

  it('表单校验失败时 submitForm 返回 false 且不发请求', async () => {
    const editor = usePreorderEditor()
    editor.formRef.value = {
      validate: vi.fn().mockRejectedValue(new Error('invalid')),
      clearValidate: vi.fn(),
    }
    editor.form.name = '校验失败'
    expect(await editor.submitForm()).toBe(false)
    expect(createPreorder).not.toHaveBeenCalled()
  })

  it('OCR 识别结果回填；迟到结果被会话号丢弃', async () => {
    const editor = attachFormRef(usePreorderEditor())
    editor.openCreate()
    let resolveFirst!: (value: unknown) => void
    vi.mocked(recognizePreorderImage).mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = resolve })
    )
    vi.mocked(recognizePreorderImage).mockResolvedValueOnce({
      preorder: {
        name: '新会话名称',
        platform: '天猫',
        shop_name: '',
        order_no: '',
        deposit_amount: '80.00',
        balance_amount: null,
        time_granularity: 'month',
        estimated_month: '2027-01',
        warnings: [],
      },
    })

    const first = editor.handleOcrFileChange(new File(['x'], 'a.png', { type: 'image/png' }))
    editor.openCreate() // 会话切换，旧请求迟到
    resolveFirst({
      preorder: {
        name: '迟到名称',
        platform: '淘宝',
        shop_name: '',
        order_no: '',
        deposit_amount: '50.00',
        balance_amount: null,
        time_granularity: 'month',
        estimated_month: '2026-08',
        warnings: [],
      },
    })
    await first
    expect(editor.form.name).toBe('')
    expect(editor.ocrUploading.value).toBe(false)

    await editor.handleOcrFileChange(new File(['x'], 'b.png', { type: 'image/png' }))
    await flushPromises()
    expect(editor.form.name).toBe('新会话名称')
    expect(editor.form.deposit_amount).toBe(80)
  })
})
