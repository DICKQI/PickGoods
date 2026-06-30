import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FilterPanel from '@/components/FilterPanel.vue'
import { useGuziStore } from '@/stores/guzi'
import { useLocationStore } from '@/stores/location'
import { useMetadataStore } from '@/stores/metadata'

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
  },
}))

const ElCardStub = defineComponent({
  name: 'ElCardStub',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, [
      h('div', { class: 'el-card-stub__header' }, slots.header?.()),
      h('div', { class: 'el-card-stub__body' }, slots.default?.()),
    ])
  },
})

const ElSelectStub = defineComponent({
  name: 'ElSelectStub',
  props: {
    modelValue: {
      type: [String, Number, Boolean, Array],
      default: undefined,
    },
    placeholder: {
      type: String,
      default: '',
    },
    filterMethod: {
      type: Function,
      default: undefined,
    },
    filterable: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'change'],
  template: `
    <div
      class="el-select-stub"
      :data-placeholder="placeholder"
      :data-filterable="String(filterable)"
      :data-disabled="String(disabled)"
    >
      <slot />
    </div>
  `,
})

const ElOptionStub = defineComponent({
  name: 'ElOptionStub',
  props: {
    label: {
      type: String,
      default: '',
    },
    value: {
      type: [String, Number, Boolean],
      default: undefined,
    },
  },
  template: '<div class="el-option-stub" :data-label="label" :data-value="String(value ?? \'\')">{{ label }}</div>',
})

const ElTreeSelectStub = defineComponent({
  name: 'ElTreeSelectStub',
  props: {
    data: {
      type: Array,
      default: () => [],
    },
    placeholder: {
      type: String,
      default: '',
    },
    filterable: {
      type: Boolean,
      default: false,
    },
    filterNodeMethod: {
      type: Function,
      default: undefined,
    },
  },
  template: `
    <div
      class="el-tree-select-stub"
      :data-placeholder="placeholder"
      :data-filterable="String(filterable)"
    />
  `,
})

const passthroughStub = (name: string) => defineComponent({
  name,
  setup(_, { slots }) {
    return () => h('div', { class: `${name}-stub` }, slots.default?.())
  },
})

const mountFilterPanel = async () => {
  setActivePinia(createPinia())

  const metadataStore = useMetadataStore()
  metadataStore.ips = [
    {
      id: 1,
      name: '原神',
      keywords: [
        { id: 101, value: 'YS' },
      ],
    } as any,
    {
      id: 2,
      name: '崩坏：星穹铁道',
      keywords: [
        { id: 201, value: 'HSR' },
        { id: 202, value: '崩铁' },
        { id: 203, value: '星铁' },
      ],
    } as any,
    { id: 3, name: '明日方舟' } as any,
  ]
  metadataStore.charactersByIP = {
    1: [
      { id: 11, name: '空', ip: { id: 1, name: '原神' }, gender: 'other' },
      { id: 12, name: '派蒙', ip: { id: 1, name: '原神' }, gender: 'female' },
    ] as any,
  }
  metadataStore.categories = [
    { id: 21, name: '吧唧', path_name: '原神 / 吧唧', parent: null, order: 1 },
    { id: 22, name: '亚克力', path_name: '明日方舟 / 亚克力', parent: null, order: 2 },
  ] as any
  metadataStore.themes = [
    { id: 31, name: '海灯节' } as any,
    { id: 32, name: '音律联觉' } as any,
  ]
  metadataStore.fetchAll = vi.fn().mockResolvedValue(undefined) as any
  metadataStore.fetchIPCharacters = vi.fn().mockResolvedValue(undefined) as any

  const locationStore = useLocationStore()
  locationStore.fetchNodes = vi.fn().mockResolvedValue(undefined) as any
  locationStore.nodes = []

  const guziStore = useGuziStore()
  guziStore.filters = {
    ip: 1,
  } as any
  guziStore.searchGuzi = vi.fn() as any
  guziStore.resetFilters = vi.fn() as any
  guziStore.setViewMode = vi.fn() as any

  const wrapper = mount(FilterPanel, {
    global: {
      stubs: {
        transition: false,
        'el-card': ElCardStub,
        'el-select': ElSelectStub,
        'el-option': ElOptionStub,
        'el-tree-select': ElTreeSelectStub,
        'el-button': passthroughStub('el-button'),
        'el-icon': passthroughStub('el-icon'),
        'el-checkbox-group': passthroughStub('el-checkbox-group'),
        'el-checkbox-button': passthroughStub('el-checkbox-button'),
      },
    },
  })

  await flushPromises()
  return { wrapper, metadataStore, guziStore }
}

const findSelectByPlaceholder = (wrapper: ReturnType<typeof mount>, placeholder: string) =>
  wrapper.findAllComponents(ElSelectStub).find((component) => component.props('placeholder') === placeholder)

describe('FilterPanel 拼音筛选', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('为 IP、角色、主题接入自定义筛选，并支持拼音过滤选项', async () => {
    const { wrapper } = await mountFilterPanel()

    const ipSelect = findSelectByPlaceholder(wrapper, '选择IP')
    const characterSelect = findSelectByPlaceholder(wrapper, '选择角色')
    const themeSelect = findSelectByPlaceholder(wrapper, '选择主题')

    expect(ipSelect?.props('filterable')).toBe(true)
    expect(characterSelect?.props('filterable')).toBe(true)
    expect(themeSelect?.props('filterable')).toBe(true)
    expect(typeof ipSelect?.props('filterMethod')).toBe('function')
    expect(typeof characterSelect?.props('filterMethod')).toBe('function')
    expect(typeof themeSelect?.props('filterMethod')).toBe('function')

    ipSelect?.props('filterMethod')?.('ys')
    await flushPromises()
    expect(ipSelect?.findAll('.el-option-stub').map((node) => node.attributes('data-label'))).toEqual(['原神'])

    ipSelect?.props('filterMethod')?.('hsr')
    await flushPromises()
    expect(ipSelect?.findAll('.el-option-stub').map((node) => node.attributes('data-label'))).toEqual(['崩坏：星穹铁道'])

    ipSelect?.props('filterMethod')?.('xingtie')
    await flushPromises()
    expect(ipSelect?.findAll('.el-option-stub').map((node) => node.attributes('data-label'))).toEqual(['崩坏：星穹铁道'])

    characterSelect?.props('filterMethod')?.('pm')
    await flushPromises()
    expect(characterSelect?.findAll('.el-option-stub').map((node) => node.attributes('data-label'))).toEqual(['派蒙'])

    themeSelect?.props('filterMethod')?.('hdj')
    await flushPromises()
    expect(themeSelect?.findAll('.el-option-stub').map((node) => node.attributes('data-label'))).toEqual(['海灯节'])
  })

  it('为品类树接入拼音过滤，并在重置时清空关键字', async () => {
    const { wrapper, guziStore } = await mountFilterPanel()

    const categoryTreeSelect = wrapper.findAllComponents(ElTreeSelectStub)
      .find((component) => component.props('placeholder') === '选择品类')
    const ipSelect = findSelectByPlaceholder(wrapper, '选择IP')
    const themeSelect = findSelectByPlaceholder(wrapper, '选择主题')

    expect(categoryTreeSelect?.props('filterable')).toBe(true)
    expect(typeof categoryTreeSelect?.props('filterNodeMethod')).toBe('function')
    expect(categoryTreeSelect?.props('filterNodeMethod')?.('ys', { id: 21, label: '吧唧' })).toBe(true)
    expect(categoryTreeSelect?.props('filterNodeMethod')?.('fz', { id: 21, label: '吧唧' })).toBe(false)

    ipSelect?.props('filterMethod')?.('ys')
    themeSelect?.props('filterMethod')?.('hdj')
    await flushPromises()

    await wrapper.find('.reset-btn').trigger('click')
    await flushPromises()

    expect(guziStore.resetFilters).toHaveBeenCalledTimes(1)
    expect(ipSelect?.findAll('.el-option-stub').map((node) => node.attributes('data-label'))).toEqual(['原神', '崩坏：星穹铁道', '明日方舟'])
    expect(themeSelect?.findAll('.el-option-stub').map((node) => node.attributes('data-label'))).toEqual(['海灯节', '音律联觉'])
  })
})
