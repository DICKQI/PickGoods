import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, type PropType } from 'vue'
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
  useResponsiveDevice: () => ({ isMobile: computed(() => true) }),
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
const otherIp: IP = { id: 2, name: 'Ensemble Stars' }
const character: Character = { id: 11, name: 'Tenma Tsukasa', ip, gender: 'other' }
const category: Category = { id: 100, name: '徽章', parent: null, path_name: '徽章', order: 1 }

const locationNode: StorageNode = {
  id: 7,
  name: 'A 柜',
  code: 'A-01',
  parent: null,
  path_name: '卧室/A 柜',
  order: 1,
  goods_count: 1,
  descendant_goods_count: 2,
  is_favorite: true,
}

const childLocationNode: StorageNode = {
  id: 8,
  name: '第一层',
  code: 'A-01-01',
  parent: 7,
  path_name: '卧室/A 柜/第一层',
  order: 1,
  goods_count: 1,
  descendant_goods_count: 1,
}

const makeGoods = (id: string, overrides: Partial<GoodsListItem> = {}): GoodsListItem => ({
  id,
  name: `Goods ${id}`,
  main_photo: '',
  is_official: true,
  quantity: 1,
  ip,
  characters: [character],
  category,
  location_path: locationNode.path_name,
  status: 'draft',
  ...overrides,
})

const goodsOne = makeGoods('goods-1')
const goodsTwo = makeGoods('goods-2', {
  name: 'Filtered goods',
  ip: otherIp,
  status: 'in_cabinet',
})

const paginated = (results: GoodsListItem[], page = 1): PaginatedResponse<GoodsListItem> => ({
  count: results.length,
  page,
  page_size: 18,
  next: null,
  previous: null,
  results,
})

const ElButtonStub = defineComponent({
  props: ['disabled', 'loading', 'type', 'size', 'icon', 'text'],
  emits: ['click'],
  template: `
    <button class="el-button-stub" :disabled="disabled || loading" @click="$emit('click', $event)">
      <slot />
    </button>
  `,
})

const ElDialogStub = defineComponent({
  props: {
    modelValue: Boolean,
    title: String,
    width: String,
    fullscreen: Boolean,
  },
  emits: ['update:modelValue'],
  template: `
    <section
      v-if="modelValue"
      class="el-dialog-stub"
      :data-fullscreen="String(Boolean(fullscreen))"
      v-bind="$attrs"
    >
      <header>{{ title }}<slot name="header" /></header>
      <slot />
      <footer><slot name="footer" /></footer>
    </section>
  `,
})

const ElDrawerStub = defineComponent({
  props: {
    modelValue: Boolean,
    title: String,
    direction: String,
    size: String,
  },
  emits: ['update:modelValue'],
  template: `
    <aside
      v-if="modelValue"
      class="el-drawer-stub"
      :data-direction="direction"
      :data-size="size"
      v-bind="$attrs"
    >
      <header>{{ title }}<slot name="header" /></header>
      <slot />
      <footer><slot name="footer" /></footer>
    </aside>
  `,
})

const ElInputStub = defineComponent({
  props: ['modelValue', 'placeholder', 'clearable', 'prefixIcon', 'type'],
  emits: ['update:modelValue', 'keyup'],
  template: `
    <label>
      <input
        class="el-input-stub"
        :type="type || 'text'"
        :placeholder="placeholder"
        :value="modelValue ?? ''"
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
      :value="modelValue === undefined ? '' : JSON.stringify(modelValue)"
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
    modelValue: [Number, String, null],
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

const ElTreeStub = defineComponent({
  props: ['data', 'filterNodeMethod'],
  emits: ['nodeClick'],
  data() {
    return { keyword: '' }
  },
  methods: {
    filter(keyword: string) {
      this.keyword = keyword
    },
    setCurrentKey() {},
    getNode() {
      return { expanded: false }
    },
    flatten(nodes: TreeSelectNode[]): TreeSelectNode[] {
      return nodes.flatMap((node) => [node, ...(node.children ? this.flatten(node.children) : [])])
    },
  },
  computed: {
    visibleNodes(): TreeSelectNode[] {
      return this.flatten(this.data || []).filter((node: TreeSelectNode) => {
        if (!this.keyword) return true
        return this.filterNodeMethod ? this.filterNodeMethod(this.keyword, node) : node.label.includes(this.keyword)
      })
    },
  },
  template: `
    <div class="el-tree-stub">
      <button
        v-for="item in visibleNodes"
        :key="item.id"
        class="tree-node-button"
        :data-test="'mobile-picker-node-' + item.id"
        type="button"
        @click="$emit('nodeClick', item)"
      >
        {{ item.label }}
      </button>
    </div>
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

const MobileActionSheetStub = defineComponent({
  props: {
    modelValue: Boolean,
    title: String,
    actions: {
      type: Array as PropType<Array<{ key: string; label: string; tone?: string }>>,
      default: () => [],
    },
  },
  emits: ['update:modelValue', 'select'],
  template: `
    <section v-if="modelValue" class="mobile-action-sheet-stub" :aria-label="title">
      <button
        v-for="action in actions"
        :key="action.key"
        class="mobile-action-sheet-item"
        :data-action-key="action.key"
        :data-tone="action.tone || 'default'"
        type="button"
        @click="$emit('select', action.key); $emit('update:modelValue', false)"
      >
        {{ action.label }}
      </button>
    </section>
  `,
})

const mountView = async () => {
  setActivePinia(createPinia())
  localStorage.clear()

  vi.mocked(getLocationTree).mockResolvedValue([locationNode, childLocationNode])
  vi.mocked(getLocationNodeDetail).mockImplementation(async (id: number) => (
    id === childLocationNode.id ? childLocationNode : locationNode
  ))
  vi.mocked(getLocationNodeSummary).mockResolvedValue({
    node_id: locationNode.id,
    direct_goods_count: 1,
    descendant_goods_count: 2,
    child_node_count: 1,
    capacity: 8,
    capacity_usage_ratio: 0.25,
    status_distribution: {},
    recent_goods: [goodsOne],
  })
  vi.mocked(getLocationNodeGoods).mockResolvedValue(paginated([goodsOne, goodsTwo]))
  vi.mocked(moveLocationGoods).mockResolvedValue({ moved_count: 1, target_location: locationNode.id })

  vi.mocked(getIPList).mockResolvedValue([ip, otherIp])
  vi.mocked(getIPCharacters).mockResolvedValue([character])
  vi.mocked(getCategoryList).mockResolvedValue([category])
  vi.mocked(getThemeList).mockResolvedValue([])
  vi.mocked(getGoodsList).mockResolvedValue(paginated([makeGoods('unassigned-1')]))

  const wrapper = mount(LocationManagement, {
    global: {
      stubs: {
        'el-alert': { props: ['title'], template: '<div class="el-alert-stub">{{ title }}</div>' },
        'el-button': ElButtonStub,
        'el-col': { template: '<div><slot /></div>' },
        'el-dialog': ElDialogStub,
        'el-drawer': ElDrawerStub,
        'el-empty': { props: ['description'], template: '<section class="el-empty-stub">{{ description }}<slot /></section>' },
        'el-form': { template: '<form><slot /></form>' },
        'el-form-item': { props: ['label'], template: '<label class="el-form-item-stub"><span>{{ label }}</span><slot /></label>' },
        'el-icon': { template: '<i><slot /></i>' },
        'el-image': { props: ['src', 'fit'], template: '<img class="el-image-stub" :src="src" />' },
        'el-input': ElInputStub,
        'el-input-number': { props: ['modelValue'], template: '<input class="el-input-number-stub" />' },
        'el-option': ElOptionStub,
        'el-pagination': true,
        'el-row': { template: '<div><slot /></div>' },
        'el-segmented': { props: ['modelValue', 'options'], emits: ['update:modelValue', 'change'], template: '<div class="el-segmented-stub" />' },
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
        MobileActionSheet: MobileActionSheetStub,
        Teleport: true,
      },
    },
  })

  await flushPromises()
  return wrapper
}

describe('LocationManagement mobile workbench', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses a mobile-first shell with picker, filter and node action entry points', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('.location-workbench--mobile').exists()).toBe(true)
    expect(wrapper.find('.location-workbench--desktop').exists()).toBe(false)
    expect(wrapper.find('.location-sidebar').exists()).toBe(false)

    expect(wrapper.get('[data-test="mobile-location-picker-trigger"]').text()).toContain('切换位置')
    expect(wrapper.get('[data-test="mobile-filter-trigger"]').text()).toContain('筛选')
    expect(wrapper.get('[data-test="mobile-node-actions-trigger"]').text()).toContain('更多')
  })

  it('renders compact mobile goods items instead of the warehouse goods card', async () => {
    const wrapper = await mountView()

    const items = wrapper.findAll('[data-test="location-mobile-goods-item"]')
    expect(items).toHaveLength(2)
    expect(wrapper.findAll('.goods-card-stub')).toHaveLength(0)
    const firstItem = wrapper.get('[data-test="location-mobile-goods-item"]')
    expect(firstItem.text()).toContain('Goods goods-1')
    expect(firstItem.text()).toContain('草稿')
    expect(firstItem.text()).toContain('Project Sekai')
  })

  it('opens goods detail from compact mobile goods items', async () => {
    const wrapper = await mountView()

    await wrapper.get('[data-test="location-mobile-goods-item"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('.goods-drawer-stub').exists()).toBe(true)
  })

  it('selects a location from the mobile picker and closes the picker', async () => {
    const wrapper = await mountView()

    await wrapper.get('[data-test="mobile-location-picker-trigger"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="mobile-location-picker"]').exists()).toBe(true)

    await wrapper.get('[data-test="mobile-location-picker"] input[placeholder="搜索位置、路径或编号"]').setValue('第一层')
    await flushPromises()

    expect(wrapper.find('[data-test="mobile-picker-node-7"]').exists()).toBe(false)
    await wrapper.get('[data-test="mobile-picker-node-8"]').trigger('click')
    await flushPromises()

    expect(getLocationNodeDetail).toHaveBeenLastCalledWith(childLocationNode.id)
    expect(wrapper.find('[data-test="mobile-location-picker"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="mobile-selected-location"]').text()).toContain('第一层')
  })

  it('opens mobile node actions through an action sheet and marks delete as danger', async () => {
    const wrapper = await mountView()

    await wrapper.get('[data-test="mobile-node-actions-trigger"]').trigger('click')
    await flushPromises()

    const sheet = wrapper.get('.mobile-action-sheet-stub')
    expect(sheet.text()).toContain('编辑')
    expect(sheet.text()).toContain('移动')
    expect(sheet.get('[data-action-key="delete"]').attributes('data-tone')).toBe('danger')
  })

  it('moves goods from the inline mobile summary batch controls', async () => {
    const wrapper = await mountView()

    await wrapper.get('[data-test="location-mobile-goods-select"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="mobile-batch-bar"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="mobile-inline-batch-panel"]').text()).toContain('已选 1 件')

    await wrapper.get('[data-test="mobile-batch-target"]').setValue(String(childLocationNode.id))
    await wrapper.get('[data-test="mobile-batch-move"]').trigger('click')
    await flushPromises()

    expect(moveLocationGoods).toHaveBeenCalledWith({
      goods_ids: ['goods-1'],
      target_location: childLocationNode.id,
    })
  })

  it('applies and clears goods filters from the mobile filter panel', async () => {
    const wrapper = await mountView()

    await wrapper.get('[data-test="mobile-filter-trigger"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-test="mobile-filter-search"] input').setValue('Filtered')
    await wrapper.get('[data-test="mobile-filter-status"]').setValue(JSON.stringify('in_cabinet'))
    await flushPromises()

    expect(wrapper.get('[data-test="mobile-filter-trigger"]').text()).toContain('2')
    expect(wrapper.findAll('[data-test="location-mobile-goods-item"]')).toHaveLength(1)
    expect(wrapper.get('[data-test="location-mobile-goods-item"]').text()).toContain('Filtered goods')

    await wrapper.get('[data-test="mobile-filter-reset"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="mobile-filter-trigger"]').text()).not.toContain('2')
    expect(wrapper.findAll('[data-test="location-mobile-goods-item"]')).toHaveLength(2)
  })

  it('opens the unassigned goods dialog as fullscreen on mobile', async () => {
    const wrapper = await mountView()

    await wrapper.get('[data-test="mobile-add-goods"]').trigger('click')
    await flushPromises()

    const dialog = wrapper.get('[data-test="unassigned-goods-dialog"]')
    expect(dialog.attributes('data-fullscreen')).toBe('true')
    expect(dialog.classes()).toContain('unassigned-goods-dialog--mobile')
    expect(dialog.text()).toContain('放入当前位置')
  })
})
