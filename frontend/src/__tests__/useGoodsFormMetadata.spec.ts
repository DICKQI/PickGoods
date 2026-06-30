import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGoodsFormMetadata } from '@/views/goods-form/composables/useGoodsFormMetadata'

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

const createThemeMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/metadata', () => ({
  getIPList: vi.fn(async () => [
    {
      id: 1,
      name: '原神',
      keywords: [{ id: 101, value: 'YS' }],
    },
    {
      id: 2,
      name: '崩坏：星穹铁道',
      keywords: [
        { id: 201, value: 'HSR' },
        { id: 202, value: '崩铁' },
        { id: 203, value: '星铁' },
      ],
    },
  ]),
  getCharacterList: vi.fn(async () => [
    { id: 11, name: '空', ip: { id: 1, name: '原神' }, gender: 'other' },
    { id: 12, name: '派蒙', ip: { id: 1, name: '原神' }, gender: 'female' },
    { id: 21, name: '三月七', ip: { id: 2, name: '崩坏：星穹铁道' }, gender: 'female' },
  ]),
  getCategoryList: vi.fn(async () => [
    { id: 31, name: '吧唧', parent: null, path_name: '谷类 / 吧唧', order: 1 },
    { id: 32, name: '亚克力', parent: null, path_name: '制品 / 亚克力', order: 2 },
  ]),
  getThemeList: vi.fn(async () => [
    { id: 41, name: '海灯节', description: null },
    { id: 42, name: '群星邀约', description: null },
  ]),
  createTheme: createThemeMock,
}))

describe('useGoodsFormMetadata 拼音搜索', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createThemeMock.mockResolvedValue({ id: 99, name: 'hdj' })
  })

  const buildMetadata = async () => {
    const formData = ref({
      ip: undefined as number | undefined,
      characters: [] as number[],
      category: undefined as number | undefined,
      theme: undefined as number | string | undefined | null,
      notes: '',
    })
    const metadata = useGoodsFormMetadata(formData)
    await metadata.loadMetadata()
    await nextTick()
    return { formData, metadata }
  }

  it('支持 IP 名称与检索关键词的拼音搜索', async () => {
    const { metadata } = await buildMetadata()

    metadata.handleIpFilter('ys')
    await nextTick()
    expect(metadata.filteredIpOptions.value.map((item) => item.name)).toEqual(['原神'])

    metadata.handleIpFilter('hsr')
    await nextTick()
    expect(metadata.filteredIpOptions.value.map((item) => item.name)).toEqual(['崩坏：星穹铁道'])

    metadata.handleIpFilter('xingtie')
    await nextTick()
    expect(metadata.filteredIpOptions.value.map((item) => item.name)).toEqual(['崩坏：星穹铁道'])
  })

  it('角色搜索保持按当前 IP 联动', async () => {
    const { formData, metadata } = await buildMetadata()

    formData.value.ip = 1
    metadata.handleCharacterFilter('pm')
    await nextTick()
    expect(metadata.filteredCharacters.value.map((item) => item.name)).toEqual(['派蒙'])

    formData.value.ip = 2
    metadata.handleIpChange()
    metadata.handleCharacterFilter('syq')
    await nextTick()
    expect(metadata.filteredCharacters.value.map((item) => item.name)).toEqual(['三月七'])
  })

  it('品类支持 name 与 path_name 的拼音搜索', async () => {
    const { metadata } = await buildMetadata()

    expect(metadata.filterCategoryNode('gulei', { id: 31, name: '吧唧' } as any)).toBe(true)
    expect(metadata.filterCategoryNode('yakeli', { id: 32, name: '亚克力' } as any)).toBe(true)
    expect(metadata.filterCategoryNode('fz', { id: 31, name: '吧唧' } as any)).toBe(false)
  })

  it('主题搜索保留拼音联想，但创建时仍按原输入创建新主题', async () => {
    const { formData, metadata } = await buildMetadata()

    metadata.handleThemeFilter('hdj')
    await nextTick()
    expect(metadata.filteredThemeOptions.value.map((item) => item.name)).toEqual(['海灯节'])

    metadata.handleThemeChange('hdj')
    await metadata.handleThemeCreate('hdj')

    expect(createThemeMock).toHaveBeenCalledWith({ name: 'hdj' })
    expect(formData.value.theme).toBe(99)
  })

  it('主题显式选择已有项时，仍选中已有主题', async () => {
    const { formData, metadata } = await buildMetadata()

    metadata.handleThemeFilter('hdj')
    await nextTick()
    metadata.handleThemeChange(41)

    expect(formData.value.theme).toBe(41)
    expect(createThemeMock).not.toHaveBeenCalled()
  })
})
