import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePreorderConvert } from '@/composables/usePreorderConvert'
import type { Preorder } from '@/api/types'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

vi.mock('@/api/reminder', () => ({
  convertPreorderToGoods: vi.fn(),
}))

vi.mock('@/api/metadata', () => ({
  getIPList: vi.fn().mockResolvedValue([{ id: 1, name: '崩坏：星穹铁道', keywords: [] }]),
  getCharacterList: vi.fn().mockResolvedValue([]),
  getIPCharacters: vi.fn().mockResolvedValue([{ id: 11, name: '流萤', ip: { id: 1 } }]),
  getCategoryList: vi.fn().mockResolvedValue([{ id: 21, name: '手办', parent: null, order: 0 }]),
  getThemeList: vi.fn().mockResolvedValue([]),
}))

import { ElMessage } from 'element-plus'
import { convertPreorderToGoods } from '@/api/reminder'
import { getIPCharacters } from '@/api/metadata'

const makePreorder = (): Preorder => ({
  id: 'p-1',
  name: '流萤手办',
  platform: '淘宝',
  shop_name: '示例店',
  order_no: 'ORD-001',
  deposit_amount: '350.00',
  balance_amount: '700.00',
  time_granularity: 'month',
  estimated_month: '2026-08-01',
  status: 'paid',
  paid_at: '2026-08-01T00:00:00Z',
  goods_id: null,
  goods_name: null,
  notes: '备注',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
})

const attachConvertRef = (convert: ReturnType<typeof usePreorderConvert>) => {
  convert.convertRef.value = {
    validate: vi.fn().mockResolvedValue(true),
    clearValidate: vi.fn(),
  }
  return convert
}

describe('usePreorderConvert', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('openConvert 预填名称与备注并拉取元数据', async () => {
    const convert = attachConvertRef(usePreorderConvert())
    await convert.openConvert(makePreorder())
    expect(convert.convertForm.name).toBe('流萤手办')
    expect(convert.convertForm.notes).toBe('备注')
    expect(convert.ipOptions.value.map((ip) => ip.name)).toContain('崩坏：星穹铁道')
  })

  it('切换 IP 清空已选角色并拉取角色列表', async () => {
    const convert = attachConvertRef(usePreorderConvert())
    await convert.openConvert(makePreorder())
    convert.convertForm.ip = 1
    convert.convertForm.characters = [11]
    convert.handleConvertIpChange()
    expect(convert.convertForm.characters).toEqual([])
    expect(getIPCharacters).toHaveBeenCalledWith(1)
  })

  it('草稿状态无需角色即可提交', async () => {
    const convert = attachConvertRef(usePreorderConvert())
    vi.mocked(convertPreorderToGoods).mockResolvedValue(makePreorder())
    await convert.openConvert(makePreorder())
    convert.convertForm.ip = 1
    convert.convertForm.category = 21
    expect(await convert.submitConvert()).toBe(true)
    expect(convertPreorderToGoods).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({ status: 'draft', characters: [] })
    )
  })

  it('非草稿状态至少需要一个角色，否则返回 false 并提示', async () => {
    const convert = attachConvertRef(usePreorderConvert())
    await convert.openConvert(makePreorder())
    convert.convertForm.status = 'in_cabinet'
    convert.convertForm.ip = 1
    convert.convertForm.category = 21
    expect(await convert.submitConvert()).toBe(false)
    expect(ElMessage.warning).toHaveBeenCalledWith('非草稿状态至少需要关联一个角色')
    expect(convertPreorderToGoods).not.toHaveBeenCalled()
  })

  it('校验失败返回 false 且不发请求', async () => {
    const convert = usePreorderConvert()
    convert.convertRef.value = {
      validate: vi.fn().mockRejectedValue(new Error('invalid')),
      clearValidate: vi.fn(),
    }
    expect(await convert.submitConvert()).toBe(false)
    expect(convertPreorderToGoods).not.toHaveBeenCalled()
  })
})
