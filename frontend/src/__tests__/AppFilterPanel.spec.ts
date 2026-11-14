import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppFilterPanel from '@/components/AppFilterPanel.vue'

const CardStub = defineComponent({
  props: { shadow: String, bodyStyle: Object },
  template:
    '<div class="card-stub"><div class="card-header"><slot name="header" /></div><div class="card-body"><slot /></div></div>',
})

const ButtonStub = defineComponent({
  props: { disabled: Boolean, text: Boolean, circle: Boolean, size: String },
  emits: ['click'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
})

const passthrough = (tag = 'span') =>
  defineComponent({ template: `<${tag}><slot /></${tag}>` })

const mountPanel = (props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) =>
  mount(AppFilterPanel, {
    props: { title: '筛选作品', ...props },
    slots: {
      default: () => h('div', { class: 'field-stub' }, '关键词输入'),
      ...slots,
    },
    global: {
      stubs: {
        'el-card': CardStub,
        'el-button': ButtonStub,
        'el-icon': passthrough('i'),
        'el-tooltip': passthrough(),
        transition: true,
      },
    },
  })

describe('AppFilterPanel', () => {
  it('renders the title, fields and default expanded state', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('.app-filter-title').text()).toBe('筛选作品')
    expect(wrapper.find('.field-stub').exists()).toBe(true)
    expect(wrapper.get('.app-filter-collapse-wrapper').attributes('style') ?? '').not.toContain(
      'display: none',
    )
    expect(wrapper.get('.app-filter-surface').classes()).toContain('app-filter-panel')
  })

  it('renders the meta and actions slots in the header', () => {
    const wrapper = mountPanel(
      {},
      {
        meta: () => h('span', { class: 'meta-stub' }, '共 5 个'),
        actions: () => h('button', { class: 'action-stub' }, '全部展开'),
      },
    )

    expect(wrapper.get('.meta-stub').text()).toBe('共 5 个')
    expect(wrapper.get('.action-stub').text()).toBe('全部展开')
  })

  it('emits update:collapsed and hides the fields when collapsed', async () => {
    const wrapper = mountPanel({ collapsed: false })

    await wrapper.get('.app-filter-toggle-btn').trigger('click')
    expect(wrapper.emitted('update:collapsed')?.[0]).toEqual([true])

    await wrapper.setProps({ collapsed: true })
    expect(wrapper.get('.app-filter-collapse-wrapper').attributes('style')).toContain('display: none')
    expect(wrapper.get('.app-filter-surface').classes()).toContain('is-collapsed')
  })

  it('hides the collapse toggle when collapsible is false', () => {
    const wrapper = mountPanel({ collapsible: false })

    expect(wrapper.find('.app-filter-toggle-btn').exists()).toBe(false)
  })

  it('emits reset and disables the button when nothing is active', async () => {
    const wrapper = mountPanel()
    await wrapper.get('.app-filter-reset-btn').trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)

    await wrapper.setProps({ resetDisabled: true })
    expect(wrapper.get('.app-filter-reset-btn').attributes('disabled')).toBeDefined()
  })
})
