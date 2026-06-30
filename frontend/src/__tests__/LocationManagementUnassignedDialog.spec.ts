import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, type PropType } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LocationManagement from '@/views/LocationManagement.vue'
import { getGoodsList } from '@/api/goods'
import { getIPList, getIPCharacters, getCategoryList, getThemeList } from '@/api/metadata'
import {
  getLocationTree,
  getLocationNodeDetail,
  getLocationNodeGoods,
  getLocationNodeSummary,
  moveLocationGoods,
} from '@/api/location'
import type { Category, Character, GoodsListItem, IP, PaginatedResponse, StorageNode } from '@/api/types'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}))

vi.mock('@/composables/useResponsiveDevice', () => ({
  useResponsiveDevice: () => ({ isMobile: { value: false } }),
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
  getLocationTree: vi.fn(),
  getLocationNodeDetail: vi.fn(),
  getLocationNodeGoods: vi.fn(),
  getLocationNodeSummary: vi.fn(),
  moveLocationGoods: vi.fn(),
  createLocationNode: vi.fn(),
  deleteLocationNode: vi.fn(),
  moveLocationNode: vi.fn(),
  patchLocationNode: vi.fn(),
}))

const ip: IP = { id: 1, name: 'Project Sekai' }
const character: Character = { id: 11, name: 'Tenma Tsukasa', ip, gender: 'other' }
const category: Category = { id: 100, name: '徽章', parent: null, path_name: '徽章', order: 1 }

const makeGoods = (id: string, overrides: Partial<GoodsListItem> = {}): GoodsListItem => ({
  id,
  name: `Goods ${id}`,
  main_photo: '',
  is_official: true,
  quantity: 1,
  ip,
  characters: [character],
  category,
  location_path: '',
  status: 'draft',
  ...overrides,
})

const paginated = (results: GoodsListItem[], page = 1): PaginatedResponse<GoodsListItem> => ({
  count: 36,
  page,
  page_size: 18,
  next: page === 1 ? 2 : null,
  previous: page > 1 ? page - 1 : null,
  results,
})

const locationNode: StorageNode = {
  id: 7,
  name: 'A 柜',
  code: 'A-01',
  parent: null,
  path_name: 'A 柜',
  order: 1,
  goods_count: 0,
  descendant_goods_count: 0,
}

const ElDialogStub = defineComponent({
  props: {
    modelValue: Boolean,
    title: String,
    width: String,
    alignCenter: Boolean,
  },
  emits: ['update:modelValue'],
  template: `
    <section v-if="modelValue" class="el-dialog-stub" v-bind="$attrs">
      <header>{{ title }}<slot name="header" /></header>
      <slot />
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
  props: ['modelValue', 'placeholder', 'clearable', 'prefixIcon'],
  emits: ['update:modelValue', 'keyup'],
  template: `
    <label>
      <input
        class="el-input-stub"
        :placeholder="placeholder"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        @keyup="$emit('keyup', $event)"
      />
      <slot name="append" />
    </label>
  `,
})

const ElSelectStub = defineComponent({
  props: ['modelValue', 'placeholder', 'disabled', 'clearable', 'filterable'],
  emits: ['update:modelValue', 'change'],
  methods: {
    parseValue(value: string) {
      return value === '' ? undefined : JSON.parse(value)
    },
  },
  template: `
    <select
      class="el-select-stub"
      :disabled="disabled"
      :value="modelValue ?? ''"
      @change="
        $emit('update:modelValue', parseValue($event.target.value));
        $emit('change', parseValue($event.target.value))
      "
    >
      <option value=""></option>
      <slot />
    </select>
  `,
})

const ElOptionStub = defineComponent({
  props: ['label', 'value'],
  template: '<option :value="JSON.stringify(value)">{{ label }}</option>',
})

interface TreeSelectNode {
  id: number
  label: string
  children?: TreeSelectNode[]
}

const ElTreeSelectStub = defineComponent({
  props: {
    modelValue: Number,
    data: {
      type: Array as PropType<TreeSelectNode[]>,
      default: () => [],
    },
  },
  emits: ['update:modelValue', 'change'],
  methods: {
    parseValue(value: string) {
      return value ? Number(value) : undefined
    },
  },
  computed: {
    flatOptions(): TreeSelectNode[] {
      const flatten = (nodes: TreeSelectNode[]): TreeSelectNode[] =>
        nodes.flatMap((node) => [node, ...(node.children ? flatten(node.children) : [])])
      return flatten(this.data)
    },
  },
  template: `
    <select
      class="el-tree-select-stub"
      :value="modelValue ?? ''"
      @change="
        $emit('update:modelValue', parseValue($event.target.value));
        $emit('change', parseValue($event.target.value))
      "
    >
      <option value=""></option>
      <option v-for="option in flatOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
    </select>
  `,
})

const ElCheckboxGroupStub = defineComponent({
  props: {
    modelValue: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
  },
  emits: ['update:modelValue', 'change'],
  provide() {
    return {
      checkboxGroupValue: () => this.modelValue,
      toggleCheckbox: (value: string) => {
        const next = this.modelValue.includes(value)
          ? this.modelValue.filter((item: string) => item !== value)
          : [...this.modelValue, value]
        this.$emit('update:modelValue', next)
        this.$emit('change', next)
      },
    }
  },
  template: '<div class="el-checkbox-group-stub"><slot /></div>',
})

const ElCheckboxButtonStub = defineComponent({
  props: ['label'],
  inject: ['checkboxGroupValue', 'toggleCheckbox'],
  template: `
    <button
      type="button"
      class="el-checkbox-button-stub"
      :data-checked="checkboxGroupValue().includes(label)"
      @click="toggleCheckbox(label)"
    >
      <slot />
    </button>
  `,
})

const ElTreeStub = defineComponent({
  props: ['data'],
  emits: ['nodeClick'],
  template: `
    <div class="el-tree-stub">
      <button
        v-for="item in data"
        :key="item.id"
        class="tree-node-button"
        type="button"
        @click="$emit('nodeClick', item)"
      >
        {{ item.label }}
      </button>
    </div>
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
  vi.mocked(getLocationNodeGoods).mockResolvedValue(paginated([], 1))
  vi.mocked(moveLocationGoods).mockResolvedValue({ moved_count: 1, target_location: locationNode.id })

  vi.mocked(getIPList).mockResolvedValue([ip])
  vi.mocked(getIPCharacters).mockResolvedValue([character])
  vi.mocked(getCategoryList).mockResolvedValue([category])
  vi.mocked(getThemeList).mockResolvedValue([])
  vi.mocked(getGoodsList).mockResolvedValue(paginated([makeGoods('goods-1')], 1))

  const wrapper = mount(LocationManagement, {
    global: {
      stubs: {
        'el-alert': { props: ['title'], template: '<div class="el-alert-stub">{{ title }}</div>' },
        'el-button': ElButtonStub,
        'el-col': { template: '<div><slot /></div>' },
        'el-dialog': ElDialogStub,
        'el-empty': { props: ['description'], template: '<section class="el-empty-stub">{{ description }}<slot /></section>' },
        'el-form': { template: '<form><slot /></form>' },
        'el-form-item': { props: ['label'], template: '<label class="el-form-item-stub"><span>{{ label }}</span><slot /></label>' },
        'el-icon': { template: '<i><slot /></i>' },
        'el-image': { props: ['src', 'fit'], template: '<img class="el-image-stub" :src="src" />' },
        'el-input': ElInputStub,
        'el-input-number': { props: ['modelValue'], template: '<input class="el-input-number-stub" />' },
        'el-option': ElOptionStub,
        'el-pagination': {
          props: ['currentPage', 'pageSize', 'total'],
          emits: ['update:currentPage', 'currentChange'],
          template: '<button class="pager-next" type="button" @click="$emit(\'currentChange\', 2)">next</button>',
        },
        'el-row': { template: '<div><slot /></div>' },
        'el-segmented': { props: ['modelValue', 'options'], template: '<div class="el-segmented-stub" />' },
        'el-select': ElSelectStub,
        'el-skeleton': { template: '<div class="el-skeleton-stub" />' },
        'el-switch': { props: ['modelValue'], template: '<input class="el-switch-stub" type="checkbox" />' },
        'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
        'el-tree': ElTreeStub,
        'el-tree-select': ElTreeSelectStub,
        'el-checkbox-group': ElCheckboxGroupStub,
        'el-checkbox-button': ElCheckboxButtonStub,
        GoodsCard: { props: ['goods'], template: '<article class="goods-card-stub">{{ goods.name }}</article>' },
        GoodsDrawer: { template: '<div class="goods-drawer-stub" />' },
        Teleport: true,
      },
    },
  })

  await flushPromises()
  return wrapper
}

describe('LocationManagement unassigned goods dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens from the empty state and queries unassigned goods through the generic goods list API', async () => {
    const wrapper = await mountView()

    await wrapper.get('.empty-workbench .el-button-stub').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="unassigned-goods-dialog"]').exists()).toBe(true)
    expect(getGoodsList).toHaveBeenCalledWith({
      location__isnull: true,
      page: 1,
      page_size: 18,
    })
    expect(wrapper.get('[data-test="unassigned-move-goods-1"]').attributes('disabled')).toBeDefined()

    await wrapper.get('.pager-next').trigger('click')
    await flushPromises()

    expect(getGoodsList).toHaveBeenLastCalledWith({
      location__isnull: true,
      page: 2,
      page_size: 18,
    })
  })

  it('resets to page one when filters change and can move a selected unassigned good into the current location', async () => {
    const wrapper = await mountView()

    await wrapper.get('.tree-node-button').trigger('click')
    await flushPromises()
    await wrapper.get('.toolbar-right .el-button-stub').trigger('click')
    await flushPromises()

    vi.mocked(getGoodsList).mockClear()
    await wrapper.get('[data-test="unassigned-ip-filter"]').setValue('1')
    await flushPromises()

    expect(getIPCharacters).toHaveBeenCalledWith(1)
    expect(getGoodsList).toHaveBeenLastCalledWith({
      location__isnull: true,
      ip: 1,
      page: 1,
      page_size: 18,
    })

    await wrapper.get('[data-test="unassigned-status-draft"]').trigger('click')
    await flushPromises()

    expect(getGoodsList).toHaveBeenLastCalledWith({
      location__isnull: true,
      ip: 1,
      status: 'draft',
      page: 1,
      page_size: 18,
    })

    await wrapper.get('[data-test="unassigned-move-goods-1"]').trigger('click')
    await flushPromises()

    expect(moveLocationGoods).toHaveBeenCalledWith({
      goods_ids: ['goods-1'],
      target_location: locationNode.id,
    })
  })
})
