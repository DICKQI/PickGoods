import { defineComponent, h, nextTick, provide, ref, toHandlers } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AddFab from '@/components/AddFab.vue'
import {
  ORGANIZE_FAB_KEY,
  createOrganizeFabRegistry,
  useOrganizeFab,
} from '@/composables/useOrganizeFab'
import type { OrganizeTab } from '@/navigation/organize'

const fabStubs = {
  'el-dropdown': { template: '<div><slot /></div>' },
  'el-dropdown-menu': { template: '<div><slot /></div>' },
  'el-dropdown-item': { template: '<div><slot /></div>' },
  'el-icon': { template: '<i><slot /></i>' },
  'el-tooltip': { template: '<div><slot /></div>' },
}

let hostSlots: ReturnType<typeof createOrganizeFabRegistry> | null = null

/** 只注册、不渲染 DOM 的分栏替身，用来验证「配置交给外壳」。 */
const PanelStub = defineComponent({
  name: 'PanelStub',
  props: {
    tab: { type: String, required: true },
    label: { type: String, default: '' },
    showRefresh: { type: Boolean, default: false },
  },
  setup(props) {
    const { hosted } = useOrganizeFab(props.tab as OrganizeTab, () => ({
      props: { label: props.label, showRefresh: props.showRefresh },
      handlers: {},
    }))
    return () => h('span', { class: 'panel-hosted-flag' }, String(hosted))
  },
})

/** 外壳替身：按当前分栏挑一份注册描述渲染真实 AddFab。 */
const FabHarness = defineComponent({
  name: 'FabHarness',
  props: { tab: { type: String, required: true } },
  setup(props, { slots }) {
    const { registry, slotFor } = createOrganizeFabRegistry({ enabled: () => true })
    provide(ORGANIZE_FAB_KEY, registry)
    hostSlots = { registry, slotFor }
    const slot = slotFor(() => props.tab as OrganizeTab)
    return () => {
      const fab = slot.value
        ? h(AddFab, {
            ...slot.value.props,
            ...toHandlers(slot.value.handlers as Record<string, (...args: never[]) => void>),
          })
        : h('span', { class: 'no-fab' })
      return h('div', [fab, slots.default?.()])
    }
  },
})

const mountHarness = (tab: OrganizeTab) => mount(FabHarness, {
  props: { tab },
  slots: {
    default: () => [
      h(PanelStub, { tab: 'ip', label: '新增 / 导入', showRefresh: true }),
      h(PanelStub, { tab: 'category', label: '新增品类', showRefresh: true }),
      h(PanelStub, { tab: 'theme', label: '新增主题' }),
    ],
  },
  global: { stubs: fabStubs },
})

describe('createOrganizeFabRegistry', () => {
  it('follows the host enabled flag so standalone routes keep page-owned buttons', () => {
    const enabled = ref(true)
    const { registry } = createOrganizeFabRegistry({ enabled: () => enabled.value })

    expect(registry.accepts()).toBe(true)
    enabled.value = false
    expect(registry.accepts()).toBe(false)
  })

  it('resolves the registered slot for the requested tab and drops it on unregister', () => {
    const { registry, slotFor } = createOrganizeFabRegistry({ enabled: () => true })
    const slot = slotFor(() => 'ip' as OrganizeTab)

    expect(slot.value).toBeNull()

    registry.register('ip', () => ({ props: { label: '新增 / 导入' }, handlers: {} }))
    registry.register('theme', () => ({ props: { label: '新增主题' }, handlers: {} }))
    expect(slot.value?.props.label).toBe('新增 / 导入')

    registry.unregister('ip')
    expect(slot.value).toBeNull()
  })

  it('re-reads the registration so reactive state reaches the shell button', () => {
    const { registry, slotFor } = createOrganizeFabRegistry({ enabled: () => true })
    const refreshing = ref(false)
    registry.register('ip', () => ({ props: { label: '新增 / 导入', refreshing: refreshing.value }, handlers: {} }))

    const slot = slotFor(() => 'ip' as OrganizeTab)
    expect(slot.value?.props.refreshing).toBe(false)

    refreshing.value = true
    expect(slot.value?.props.refreshing).toBe(true)
  })
})

describe('useOrganizeFab', () => {
  it('keeps the inline fallback when no shell provides the registry', () => {
    const wrapper = mount(PanelStub, { props: { tab: 'ip', label: '新增 / 导入' } })

    expect(wrapper.get('.panel-hosted-flag').text()).toBe('false')
    wrapper.unmount()
  })

  it('hands the button over to the shell while the host accepts it', async () => {
    const wrapper = mountHarness('ip')
    await nextTick()

    expect(wrapper.findAll('.panel-hosted-flag').map(node => node.text())).toEqual(['true', 'true', 'true'])
    expect(wrapper.get('.app-fab--primary').attributes('aria-label')).toBe('新增 / 导入')
    expect(wrapper.find('.app-fab--refresh').exists()).toBe(true)
    wrapper.unmount()
  })

  it('swaps the floating button when the active tab changes', async () => {
    const wrapper = mountHarness('ip')
    await nextTick()
    expect(wrapper.get('.app-fab--primary').attributes('aria-label')).toBe('新增 / 导入')

    await wrapper.setProps({ tab: 'category' })
    expect(wrapper.get('.app-fab--primary').attributes('aria-label')).toBe('新增品类')

    // 主题分栏没有刷新圆钮，切过去后栈里只剩金色主按钮
    await wrapper.setProps({ tab: 'theme' })
    expect(wrapper.get('.app-fab--primary').attributes('aria-label')).toBe('新增主题')
    expect(wrapper.find('.app-fab--refresh').exists()).toBe(false)
    wrapper.unmount()
  })

  it('unregisters the panel button when the panel unmounts', async () => {
    const wrapper = mountHarness('ip')
    await nextTick()
    expect(wrapper.get('.app-fab--primary').attributes('aria-label')).toBe('新增 / 导入')

    wrapper.unmount()
    expect(hostSlots?.slotFor(() => 'ip' as OrganizeTab).value).toBeNull()
  })
})
