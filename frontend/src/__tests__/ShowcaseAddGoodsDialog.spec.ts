import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, type PropType } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShowcaseAddGoodsDialog from '@/components/showcase/ShowcaseAddGoodsDialog.vue'
import { getGoodsList } from '@/api/goods'
import { getCategoryList, getIPCharacters, getIPList, getThemeList } from '@/api/metadata'
import type { Category, Character, GoodsListItem, IP, PaginatedResponse } from '@/api/types'

const showcaseManagerSource = () => readFileSync(resolve(process.cwd(), 'src/components/ShowcaseManager.vue'), 'utf8')
const addGoodsDialogSource = () => readFileSync(resolve(process.cwd(), 'src/components/showcase/ShowcaseAddGoodsDialog.vue'), 'utf8')

vi.mock('@/api/goods', () => ({
  getGoodsList: vi.fn(),
}))

vi.mock('@/api/metadata', () => ({
  getIPList: vi.fn(),
  getIPCharacters: vi.fn(),
  getCategoryList: vi.fn(),
  getThemeList: vi.fn(),
}))

const ips: IP[] = [
  { id: 1, name: 'Project Sekai' },
  { id: 2, name: 'Ensemble Stars' },
]
const firstIP = ips[0]!

const characters: Character[] = [
  { id: 11, name: 'Tenma Tsukasa', ip: firstIP, gender: 'other' },
  { id: 12, name: 'Otori Emu', ip: firstIP, gender: 'other' },
]
const firstCharacter = characters[0]!

const categories: Category[] = [
  { id: 100, name: '纸制品', parent: null, path_name: '纸制品', order: 1 },
  { id: 101, name: '方卡', parent: 100, path_name: '纸制品/方卡', order: 2 },
]
const paperCardCategory = categories[1]!

const makeGoods = (id: string, overrides: Partial<GoodsListItem> = {}): GoodsListItem => ({
  id,
  name: `Goods ${id}`,
  main_photo: '',
  is_official: true,
  quantity: 1,
  ip: firstIP,
  characters: [firstCharacter],
  category: paperCardCategory,
  location_path: '',
  status: 'in_cabinet',
  ...overrides,
})

const paginated = (results: GoodsListItem[]): PaginatedResponse<GoodsListItem> => ({
  count: results.length,
  page: 1,
  page_size: 18,
  next: null,
  previous: null,
  results,
})

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
    placeholder: String,
  },
  emits: ['update:modelValue', 'change'],
  methods: {
    parseValue(value: string) {
      return value ? Number(value) : undefined
    },
  },
  computed: {
    flatOptions(): Array<{ id: number; label: string }> {
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

const mountDialog = async (props: Partial<InstanceType<typeof ShowcaseAddGoodsDialog>['$props']> = {}) => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.mocked(getIPList).mockResolvedValue(ips)
  vi.mocked(getIPCharacters).mockResolvedValue(characters)
  vi.mocked(getCategoryList).mockResolvedValue(categories)
  vi.mocked(getThemeList).mockResolvedValue([])
  vi.mocked(getGoodsList).mockResolvedValue(paginated([makeGoods('goods-1'), makeGoods('goods-2')]))

  const wrapper = mount(ShowcaseAddGoodsDialog, {
    props: {
      modelValue: true,
      existingGoodsIds: [],
      mutating: false,
      ...props,
    },
    global: {
      stubs: {
        'el-alert': { props: ['title'], template: '<div class="el-alert-stub">{{ title }}</div>' },
        'el-button': {
          props: ['disabled', 'loading', 'type', 'size'],
          emits: ['click'],
          template: '<button class="el-button-stub" :disabled="disabled || loading" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        'el-dialog': ElDialogStub,
        'el-empty': { props: ['description'], template: '<div class="el-empty-stub">{{ description }}</div>' },
        'el-form': { template: '<form><slot /></form>' },
        'el-form-item': { props: ['label'], template: '<label class="el-form-item-stub"><span>{{ label }}</span><slot /></label>' },
        'el-icon': { template: '<i><slot /></i>' },
        'el-image': { props: ['src', 'fit'], template: '<img class="el-image-stub" :src="src" />' },
        'el-input': ElInputStub,
        'el-option': ElOptionStub,
        'el-pagination': {
          props: ['currentPage', 'pageSize', 'total'],
          emits: ['update:currentPage', 'currentChange'],
          template: '<button class="pager-next" @click="$emit(\'currentChange\', 2)">next</button>',
        },
        'el-select': ElSelectStub,
        'el-skeleton': { template: '<div class="el-skeleton-stub" />' },
        'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
        'el-tree-select': ElTreeSelectStub,
        'el-checkbox-group': ElCheckboxGroupStub,
        'el-checkbox-button': ElCheckboxButtonStub,
        Teleport: true,
      },
    },
  })

  await flushPromises()
  return wrapper
}

describe('ShowcaseAddGoodsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens as a centered dialog and fetches in-cabinet goods by default', async () => {
    const wrapper = await mountDialog()

    expect(wrapper.find('[data-test="showcase-add-goods-dialog"]').exists()).toBe(true)
    expect(wrapper.findComponent(ElDialogStub).props('alignCenter')).toBe(true)
    expect(wrapper.text()).toContain('从谷仓选购')
    expect(getGoodsList).toHaveBeenCalledWith({
      status: 'in_cabinet',
      page: 1,
      page_size: 18,
    })
  })

  it('sends search and selected filters to getGoodsList', async () => {
    const wrapper = await mountDialog()
    vi.mocked(getGoodsList).mockClear()

    await wrapper.get('[data-test="add-goods-search-input"] input').setValue('徽章')
    await wrapper.get('[data-test="add-goods-ip-filter"]').setValue('1')
    await flushPromises()
    await wrapper.get('[data-test="add-goods-character-filter"]').setValue('11')
    await wrapper.get('[data-test="add-goods-category-filter"]').setValue('101')
    await wrapper.get('[data-test="add-goods-official-filter"]').setValue('true')
    await wrapper.get('[data-test="add-goods-status-outdoor"]').trigger('click')
    await flushPromises()

    expect(getGoodsList).toHaveBeenLastCalledWith({
      search: '徽章',
      ip: 1,
      character: 11,
      category: 101,
      status__in: 'in_cabinet,outdoor',
      is_official: true,
      page: 1,
      page_size: 18,
    })
  })

  it('clears character and reloads character options when IP changes', async () => {
    const wrapper = await mountDialog()

    await wrapper.get('[data-test="add-goods-ip-filter"]').setValue('1')
    await flushPromises()
    await wrapper.get('[data-test="add-goods-character-filter"]').setValue('11')

    vi.mocked(getGoodsList).mockClear()
    await wrapper.get('[data-test="add-goods-ip-filter"]').setValue('2')
    await flushPromises()

    expect(getIPCharacters).toHaveBeenCalledWith(2)
    expect(getGoodsList).toHaveBeenLastCalledWith({
      ip: 2,
      status: 'in_cabinet',
      page: 1,
      page_size: 18,
    })
  })

  it('disables the add button for goods that already exist in showcase', async () => {
    const wrapper = await mountDialog({ existingGoodsIds: ['goods-1'] })

    const existingCard = wrapper.get('[data-test="add-goods-card-goods-1"]')
    expect(existingCard.text()).toContain('已在展柜')
    expect(existingCard.get('[data-test="add-goods-action-goods-1"]').attributes('disabled')).toBeDefined()
  })

  it('emits add and marks the result as added after parent updates existing ids', async () => {
    const wrapper = await mountDialog()

    await wrapper.get('[data-test="add-goods-action-goods-2"]').trigger('click')
    expect(wrapper.emitted('add')?.[0]).toEqual(['goods-2'])

    await wrapper.setProps({ existingGoodsIds: ['goods-2'] })
    const addedCard = wrapper.get('[data-test="add-goods-card-goods-2"]')
    expect(addedCard.text()).toContain('已在展柜')
    expect(addedCard.get('[data-test="add-goods-action-goods-2"]').attributes('disabled')).toBeDefined()
  })

  it('ShowcaseManager uses the centered add-goods dialog instead of the old drawer', () => {
    const source = showcaseManagerSource()

    expect(source).toContain('ShowcaseAddGoodsDialog')
    expect(source).toContain(':existing-goods-ids="existingShowcaseGoodsIds"')
    expect(source).not.toContain('<el-drawer')
    expect(source).not.toContain('addDrawerVisible')
  })

  it('keeps the selection dialog layout roomy enough for readable cards and filters', () => {
    const source = addGoodsDialogSource()

    expect(source).toContain('class="filter-fields-grid"')
    expect(source).toContain('class="status-filter-strip"')
    expect(source).toContain('class="status-filter-title"')
    expect(source).toContain('class="result-card-main"')
    expect(source).toContain('class="result-card-footer"')
    expect(source).toContain('grid-template-columns: minmax(150px, 1fr) minmax(150px, 1fr) minmax(220px, 1.25fr) minmax(150px, 0.9fr);')
    expect(source).toContain('grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));')
    expect(source).toContain('.filter-fields-grid')
    expect(source).toContain('.status-filter-strip')
    expect(source).toContain('background: rgba(255, 255, 255, 0.68);')
    expect(source).not.toContain('class="filter-row filter-row--primary"')
    expect(source).not.toContain('class="filter-row filter-row--status"')
    expect(source).not.toContain('.filter-row--primary')
    expect(source).not.toContain('.filter-row--status')
    expect(source).not.toContain('.filter-row--secondary')
    expect(source).not.toContain('grid-template-columns: minmax(300px, 1fr) minmax(180px, 240px);')
    expect(source).not.toContain('grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));')
    expect(source).not.toContain('grid-template-columns: minmax(0, 1fr) auto;')
  })
})
