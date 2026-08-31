import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubGoods from '@/views/club/ClubGoods.vue'
import type { ClubCatalogItem, PaginatedResponse } from '@/api/types'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  ElMessageBox: {
    confirm: vi.fn(),
  },
}))

vi.mock('@/api/clubs', () => ({
  batchDeleteClubGoods: vi.fn(),
  batchUnlistClubGoods: vi.fn(),
  getMyClubGoods: vi.fn(),
  getMyClubPopularity: vi.fn(),
  updateClubGoods: vi.fn(),
}))

import * as clubApi from '@/api/clubs'
import { ElMessage, ElMessageBox } from 'element-plus'

const passthrough = (name: string, tag = 'div') => defineComponent({
  name,
  inheritAttrs: false,
  emits: ['click'],
  template: `<${tag} v-bind="$attrs" @click="$emit('click', $event)"><slot /></${tag}>`,
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  props: { disabled: Boolean, loading: Boolean },
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
})

const ElCheckboxStub = defineComponent({
  name: 'ElCheckbox',
  props: { modelValue: Boolean, disabled: Boolean, indeterminate: Boolean },
  emits: ['change'],
  template: '<label><input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'change\', $event.target.checked)" /><slot /></label>',
})

const ElImageStub = defineComponent({
  name: 'ElImage',
  props: { src: { type: String, default: '' } },
  template: '<img :src="src" />',
})

const item = (id: string, publication_status: ClubCatalogItem['publication_status']): ClubCatalogItem => ({
  id,
  name: `谷子 ${id}`,
  description: '',
  ip: { id: 1, name: '测试 IP' },
  characters: [{ id: 1, name: '角色', ip: { id: 1, name: '测试 IP' }, gender: 'other' }],
  category: { id: 1, name: '徽章', parent: null, path_name: '徽章', order: 1 },
  theme: null,
  main_photo: null,
  additional_photos: [],
  public_price: null,
  is_official: false,
  publication_status,
  order: 0,
  created_at: '',
  updated_at: '',
})

const draftGoods = item('draft', 'draft')
const listedGoods = item('listed', 'listed')
const unlistedGoods = item('unlisted', 'unlisted')
const goods = [draftGoods, listedGoods, unlistedGoods]

function pageResponse(results: ClubCatalogItem[] = goods): PaginatedResponse<ClubCatalogItem> {
  return { count: results.length, page: 1, page_size: 20, next: null, previous: null, results }
}

async function mountPage(results: ClubCatalogItem[] = goods) {
  vi.mocked(clubApi.getMyClubGoods).mockResolvedValue(pageResponse(results))
  vi.mocked(clubApi.getMyClubPopularity).mockResolvedValue([])
  const wrapper = mount(ClubGoods, {
    global: {
      directives: { loading: {} },
      stubs: {
        ElButton: ElButtonStub,
        ElCheckbox: ElCheckboxStub,
        ElEmpty: passthrough('ElEmpty'),
        ElIcon: passthrough('ElIcon', 'span'),
        ElImage: ElImageStub,
        ElInput: passthrough('ElInput', 'input'),
        ElPagination: passthrough('ElPagination'),
        ElTag: passthrough('ElTag'),
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('ClubGoods 批量操作', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
  })

  it('默认显示批量删除和批量下架入口', async () => {
    const wrapper = await mountPage()

    expect(wrapper.find('[data-test="start-batch-delete"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="start-batch-unlist"]').exists()).toBe(true)
    expect(wrapper.find('.selection-cell').exists()).toBe(false)
  })

  it('以不同颜色徽标展示意向入手和已入手统计', async () => {
    const wrapper = await mountPage()

    expect(wrapper.find('.popularity-badge--intended').exists()).toBe(true)
    expect(wrapper.find('.popularity-badge--acquired').exists()).toBe(true)
    expect(wrapper.text()).toContain('意向入手 0 人')
    expect(wrapper.text()).toContain('已入手 0 人')
    expect(wrapper.text()).not.toContain('曾经入手')
  })

  it('删除和下架模式分别只允许对应状态，并且切换时清空选择', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as unknown as {
      startBulkAction: (action: 'delete' | 'unlist') => void
      toggleSelection: (goods: ClubCatalogItem, selected: boolean) => void
      selectedGoodsIds: string[]
    }

    await wrapper.get('[data-test="start-batch-delete"]').trigger('click')
    const selectionInputs = () => wrapper.findAll('.selection-cell input').map(input => input.element as HTMLInputElement)
    expect(selectionInputs()[1]?.disabled).toBe(true)
    expect(selectionInputs()[0]?.disabled).toBe(false)
    vm.toggleSelection(draftGoods, true)
    expect(vm.selectedGoodsIds).toEqual(['draft'])

    vm.startBulkAction('unlist')
    expect(vm.selectedGoodsIds).toEqual([])
    await nextTick()
    expect(selectionInputs()[0]?.disabled).toBe(true)
    expect(selectionInputs()[1]?.disabled).toBe(false)
  })

  it('确认后分别调用批量删除和批量下架接口', async () => {
    vi.mocked(ElMessageBox.confirm).mockResolvedValue(undefined as never)
    vi.mocked(clubApi.batchDeleteClubGoods).mockResolvedValue({ deleted_count: 1, deleted_ids: ['draft'] })
    vi.mocked(clubApi.batchUnlistClubGoods).mockResolvedValue({ updated_count: 1, updated_ids: ['listed'] })
    const wrapper = await mountPage()
    const vm = wrapper.vm as unknown as {
      startBulkAction: (action: 'delete' | 'unlist') => void
      toggleSelection: (goods: ClubCatalogItem, selected: boolean) => void
      executeBulkAction: () => Promise<void>
    }

    vm.startBulkAction('delete')
    vm.toggleSelection(draftGoods, true)
    await vm.executeBulkAction()
    expect(clubApi.batchDeleteClubGoods).toHaveBeenCalledWith(['draft'])
    expect(ElMessage.success).toHaveBeenCalledWith('已删除 1 条谷子')

    vm.startBulkAction('unlist')
    vm.toggleSelection(listedGoods, true)
    await vm.executeBulkAction()
    expect(clubApi.batchUnlistClubGoods).toHaveBeenCalledWith(['listed'])
    expect(ElMessage.success).toHaveBeenCalledWith('已下架 1 条谷子')
  })

  it('取消确认不发起请求，失败时保留选择并显示错误', async () => {
    vi.mocked(ElMessageBox.confirm).mockRejectedValueOnce('cancel')
    const wrapper = await mountPage()
    const vm = wrapper.vm as unknown as {
      startBulkAction: (action: 'delete' | 'unlist') => void
      toggleSelection: (goods: ClubCatalogItem, selected: boolean) => void
      executeBulkAction: () => Promise<void>
      selectedGoodsIds: string[]
    }
    vm.startBulkAction('delete')
    vm.toggleSelection(draftGoods, true)
    await vm.executeBulkAction()
    expect(clubApi.batchDeleteClubGoods).not.toHaveBeenCalled()
    expect(vm.selectedGoodsIds).toEqual(['draft'])

    vi.mocked(ElMessageBox.confirm).mockResolvedValue(undefined as never)
    vi.mocked(clubApi.batchDeleteClubGoods).mockRejectedValue({ response: { data: { detail: '条目状态已变化' } } })
    vi.mocked(clubApi.getMyClubGoods).mockResolvedValue(pageResponse([listedGoods]))
    await vm.executeBulkAction()
    expect(vm.selectedGoodsIds).toEqual(['draft'])
    expect(ElMessage.error).toHaveBeenCalledWith('条目状态已变化')
  })

  it('分页或搜索刷新时保留当前批量模式的已选 ID', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as unknown as {
      startBulkAction: (action: 'delete' | 'unlist') => void
      toggleSelection: (goods: ClubCatalogItem, selected: boolean) => void
      load: () => Promise<void>
      selectedGoodsIds: string[]
    }
    vm.startBulkAction('delete')
    vm.toggleSelection(draftGoods, true)
    vi.mocked(clubApi.getMyClubGoods).mockResolvedValue(pageResponse([unlistedGoods]))
    await vm.load()
    expect(vm.selectedGoodsIds).toEqual(['draft'])
  })
})
