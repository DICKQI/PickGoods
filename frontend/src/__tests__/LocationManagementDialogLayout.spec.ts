import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LocationManagement from '@/views/LocationManagement.vue'
import { getIPList, getIPCharacters, getCategoryList, getThemeList } from '@/api/metadata'
import {
  createLocationNode,
  getLocationNodeDetail,
  getLocationNodeGoods,
  getLocationNodeSummary,
  getLocationTree,
} from '@/api/location'
import type { Category, Character, IP, StorageNode } from '@/api/types'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}))

vi.mock('@/composables/useResponsiveDevice', () => ({
  useResponsiveDevice: () => ({ isMobile: computed(() => false) }),
}))

vi.mock('@/api/goods', () => ({
  getGoodsList: vi.fn(),
}))

vi.mock('@/api/metadata', () => ({
  getIPList: vi.fn(),
  getIPCharacters: vi.fn(),
  getCategoryList: vi.fn(),
  getThemeList: vi.fn(),
}))

vi.mock('@/api/location', () => ({
  createLocationNode: vi.fn(),
  deleteLocationNode: vi.fn(),
  getLocationNodeDetail: vi.fn(),
  getLocationNodeGoods: vi.fn(),
  getLocationNodeSummary: vi.fn(),
  getLocationTree: vi.fn(),
  moveLocationGoods: vi.fn(),
  moveLocationNode: vi.fn(),
  patchLocationNode: vi.fn(),
}))

const ip: IP = { id: 1, name: 'Project Sekai' }
const character: Character = { id: 11, name: 'Tenma Tsukasa', ip, gender: 'other' }
const category: Category = { id: 100, name: '徽章', parent: null, path_name: '徽章', order: 1 }

const locationNode: StorageNode = {
  id: 7,
  name: '书房展示柜',
  code: 'A-01',
  parent: null,
  path_name: '书房展示柜',
  order: 1,
  goods_count: 0,
  descendant_goods_count: 0,
}

const ElDialogStub = defineComponent({
  props: {
    modelValue: Boolean,
    title: String,
  },
  template: `
    <section v-if="modelValue" class="el-dialog-stub" v-bind="$attrs">
      <header><slot name="header" /></header>
      <div class="dialog-body"><slot /></div>
      <footer><slot name="footer" /></footer>
    </section>
  `,
})

const ElButtonStub = defineComponent({
  props: ['disabled', 'loading', 'type', 'size', 'icon'],
  emits: ['click'],
  template: `
    <button class="el-button-stub" :disabled="disabled || loading" @click="$emit('click', $event)">
      <slot />
    </button>
  `,
})

const ElInputStub = defineComponent({
  props: ['modelValue', 'placeholder', 'maxlength', 'type'],
  emits: ['update:modelValue'],
  template: `
    <input
      class="el-input-stub"
      :type="type || 'text'"
      :placeholder="placeholder"
      :value="modelValue ?? ''"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
})

const ElInputNumberStub = defineComponent({
  props: ['modelValue', 'min', 'max', 'controls'],
  emits: ['update:modelValue'],
  template: `
    <div class="el-input-number-stub" :data-controls="String(controls)">
      <input
        class="el-input-number-inner"
        type="number"
        :min="min"
        :max="max"
        :value="modelValue ?? ''"
        @input="$emit('update:modelValue', $event.target.value === '' ? null : Number($event.target.value))"
      />
    </div>
  `,
})

const ElSelectStub = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `
    <select class="el-select-stub" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <slot />
    </select>
  `,
})

const ElOptionStub = defineComponent({
  props: ['label', 'value'],
  template: '<option :value="value">{{ label }}</option>',
})

const ElTreeSelectStub = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `
    <select class="el-tree-select-stub" :value="modelValue ?? ''" @change="$emit('update:modelValue', $event.target.value ? Number($event.target.value) : null)">
      <slot />
    </select>
  `,
})

const ElSwitchStub = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `
    <input
      class="el-switch-stub"
      type="checkbox"
      :checked="Boolean(modelValue)"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
  `,
})

const mountView = async () => {
  setActivePinia(createPinia())
  localStorage.clear()

  vi.mocked(getLocationTree).mockResolvedValue([locationNode])
  vi.mocked(getLocationNodeDetail).mockResolvedValue(locationNode)
  vi.mocked(getLocationNodeSummary).mockResolvedValue({
    node_id: locationNode.id,
    direct_goods_count: 0,
    descendant_goods_count: 0,
    child_node_count: 0,
    capacity: null,
    capacity_usage_ratio: null,
    status_distribution: {},
    recent_goods: [],
  })
  vi.mocked(getLocationNodeGoods).mockResolvedValue({
    count: 0,
    page: 1,
    page_size: 18,
    next: null,
    previous: null,
    results: [],
  })

  vi.mocked(getIPList).mockResolvedValue([ip])
  vi.mocked(getIPCharacters).mockResolvedValue([character])
  vi.mocked(getCategoryList).mockResolvedValue([category])
  vi.mocked(getThemeList).mockResolvedValue([])
  vi.mocked(createLocationNode).mockResolvedValue(locationNode)

  const wrapper = mount(LocationManagement, {
    global: {
      stubs: {
        'el-button': ElButtonStub,
        'el-dialog': ElDialogStub,
        'el-empty': { template: '<div class="el-empty-stub"><slot /></div>' },
        'el-form': { template: '<form><slot /></form>' },
        'el-form-item': {
          props: ['label'],
          template: '<label class="el-form-item-stub"><span class="el-form-item-label">{{ label }}</span><slot /></label>',
        },
        'el-icon': { template: '<i><slot /></i>' },
        'el-input': ElInputStub,
        'el-input-number': ElInputNumberStub,
        'el-option': ElOptionStub,
        'el-pagination': true,
        'el-row': { template: '<div><slot /></div>' },
        'el-segmented': true,
        'el-select': ElSelectStub,
        'el-skeleton': true,
        'el-switch': ElSwitchStub,
        'el-tag': { template: '<span><slot /></span>' },
        'el-tree': {
          template: '<div class="el-tree-stub" />',
          methods: {
            filter() {},
            setCurrentKey() {},
          },
        },
        'el-tree-select': ElTreeSelectStub,
        'el-alert': true,
        'el-checkbox-group': true,
        'el-checkbox-button': true,
        'el-col': { template: '<div><slot /></div>' },
        'el-image': true,
        GoodsCard: true,
        GoodsDrawer: true,
        Teleport: true,
      },
    },
  })

  await flushPromises()
  return wrapper
}

describe('LocationManagement dialog layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders number inputs without stepper controls and removes the extra favorite status pill', async () => {
    const wrapper = await mountView()

    await wrapper.get('.sidebar-header .el-button-stub').trigger('click')
    await flushPromises()

    const dialog = wrapper.get('[data-test="location-node-dialog"]')
    const numberFields = dialog.findAll('.location-number-input.el-input-number-stub')
    expect(numberFields).toHaveLength(2)
    expect(numberFields.every((field) => field.attributes('data-controls') === 'false')).toBe(true)
    expect(dialog.find('.favorite-switch-state').exists()).toBe(false)
    expect(dialog.get('.favorite-switch-control .el-switch-stub').exists()).toBe(true)
  })

  it('submits numeric capacity and order values after compact dialog edits', async () => {
    const wrapper = await mountView()

    await wrapper.get('.sidebar-header .el-button-stub').trigger('click')
    await flushPromises()

    const dialog = wrapper.get('[data-test="location-node-dialog"]')
    const textInputs = dialog.findAll('.el-input-stub')
    await textInputs[0].setValue('玄关抽屉')
    const numberFields = dialog.findAll('.location-number-input .el-input-number-inner')
    await numberFields[0].setValue('24')
    await numberFields[1].setValue('8')
    await dialog.get('.favorite-switch-control .el-switch-stub').setValue(true)

    const footerButtons = dialog.findAll('.location-dialog-footer .el-button-stub')
    await footerButtons[1].trigger('click')
    await flushPromises()

    expect(createLocationNode).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '玄关抽屉',
        capacity: 24,
        order: 8,
        is_favorite: true,
      }),
    )
  })
})
