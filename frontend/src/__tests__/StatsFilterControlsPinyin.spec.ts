import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import StatsFilterControls from '@/components/StatsFilterControls.vue'

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
    remoteMethod: {
      type: Function,
      default: undefined,
    },
    filterable: {
      type: Boolean,
      default: false,
    },
  },
  template: `
    <div class="el-select-stub" :data-placeholder="placeholder" :data-filterable="String(filterable)">
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

const mountStatsFilterControls = () => {
  const searchCharacterStatsOptions = vi.fn()
  const wrapper = mount(StatsFilterControls, {
    props: {
      top: 10,
      selectedStatuses: [],
      purchaseDateRange: null,
      createdDateRange: null,
      ipOptions: [
        { id: 1, name: '原神', keywords: [{ id: 101, value: 'YS' }] },
        { id: 2, name: '崩坏：星穹铁道', keywords: [{ id: 201, value: 'HSR' }, { id: 202, value: '星铁' }] },
        { id: 3, name: '明日方舟' },
      ] as any,
      categoryTreeData: [
        { id: 21, label: '吧唧', pathName: '原神 / 吧唧' },
        { id: 22, label: '亚克力', pathName: '明日方舟 / 亚克力' },
      ],
      characterStatsTargetId: undefined,
      characterStatsOptions: [
        { id: 31, name: '派蒙', ip: { id: 1, name: '原神' }, gender: 'female' },
        { id: 32, name: '空', ip: { id: 1, name: '原神' }, gender: 'male' },
      ] as any,
      characterStatsLoading: false,
      searchCharacterStatsOptions,
    },
    global: {
      stubs: {
        'el-select': ElSelectStub,
        'el-option': ElOptionStub,
        'el-tree-select': ElTreeSelectStub,
        'el-slider': passthroughStub('el-slider'),
        'el-checkbox-group': passthroughStub('el-checkbox-group'),
        'el-checkbox-button': passthroughStub('el-checkbox-button'),
        'el-date-picker': passthroughStub('el-date-picker'),
        'el-button': passthroughStub('el-button'),
        'el-icon': passthroughStub('el-icon'),
      },
    },
  })

  return { wrapper, searchCharacterStatsOptions }
}

const findSelectByPlaceholder = (wrapper: ReturnType<typeof mount>, placeholder: string) =>
  wrapper.findAllComponents(ElSelectStub).find((component) => component.props('placeholder') === placeholder)

describe('StatsFilterControls 拼音筛选', () => {
  it('为 IP 和角色厨力接入自定义拼音过滤', async () => {
    const { wrapper, searchCharacterStatsOptions } = mountStatsFilterControls()

    const ipSelect = findSelectByPlaceholder(wrapper, '全部IP')
    const characterSelect = findSelectByPlaceholder(wrapper, '搜索角色名')

    expect(ipSelect?.props('filterable')).toBe(true)
    expect(typeof ipSelect?.props('filterMethod')).toBe('function')
    expect(characterSelect?.props('filterable')).toBe(true)
    expect(typeof characterSelect?.props('remoteMethod')).toBe('function')

    ipSelect?.props('filterMethod')?.('ys')
    await wrapper.vm.$nextTick()
    expect(ipSelect?.findAll('.el-option-stub').map((node) => node.attributes('data-label'))).toEqual(['原神'])

    ipSelect?.props('filterMethod')?.('xingtie')
    await wrapper.vm.$nextTick()
    expect(ipSelect?.findAll('.el-option-stub').map((node) => node.attributes('data-label'))).toEqual(['崩坏：星穹铁道'])

    characterSelect?.props('remoteMethod')?.('pm')
    await wrapper.vm.$nextTick()
    expect(searchCharacterStatsOptions).toHaveBeenCalledWith('pm')
    expect(characterSelect?.findAll('.el-option-stub').map((node) => node.attributes('data-label'))).toEqual(['派蒙 · 原神', '空 · 原神'])
  })

  it('为品类树接入拼音过滤', () => {
    const { wrapper } = mountStatsFilterControls()

    const categoryTreeSelect = wrapper.findAllComponents(ElTreeSelectStub)
      .find((component) => component.props('placeholder') === '全部品类')

    expect(categoryTreeSelect?.props('filterable')).toBe(true)
    expect(typeof categoryTreeSelect?.props('filterNodeMethod')).toBe('function')
    expect(categoryTreeSelect?.props('filterNodeMethod')?.('ys', { id: 21, label: '吧唧', pathName: '原神 / 吧唧' })).toBe(true)
    expect(categoryTreeSelect?.props('filterNodeMethod')?.('ykl', { id: 22, label: '亚克力', pathName: '明日方舟 / 亚克力' })).toBe(true)
    expect(categoryTreeSelect?.props('filterNodeMethod')?.('fz', { id: 21, label: '吧唧', pathName: '原神 / 吧唧' })).toBe(false)
  })
})
