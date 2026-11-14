import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AddFab from '@/components/AddFab.vue'

const fabSource = readFileSync(resolve(process.cwd(), 'src/components/AddFab.vue'), 'utf8')

const DropdownStub = defineComponent({
  name: 'ElDropdownStub',
  emits: ['command'],
  setup(_props, { slots }) {
    return () =>
      h('div', { class: 'dropdown-stub' }, [
        slots.default?.(),
        h('div', { class: 'dropdown-menu-stub' }, slots.dropdown?.()),
      ])
  },
})

const passthrough = (tag = 'div') =>
  defineComponent({ template: `<${tag}><slot /></${tag}>` })

const mountFab = (props: Record<string, unknown> = {}) =>
  mount(AddFab, {
    props: { label: '新增 / 导入', ...props },
    global: {
      stubs: {
        'el-dropdown': DropdownStub,
        'el-dropdown-menu': passthrough('div'),
        'el-dropdown-item': defineComponent({
          props: { command: String, divided: Boolean },
          template: '<div class="dd-item"><slot /></div>',
        }),
        'el-icon': passthrough('i'),
        'el-tooltip': passthrough(),
      },
    },
  })

describe('AddFab', () => {
  it('renders a round icon button with an accessible label', () => {
    const wrapper = mountFab()

    const primary = wrapper.get('.app-fab--primary')
    expect(primary.attributes('aria-label')).toBe('新增 / 导入')
    expect(primary.find('.app-fab__icon').exists()).toBe(true)
  })

  it('emits click when there is no dropdown item', async () => {
    const wrapper = mountFab()

    await wrapper.get('.app-fab--primary').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('renders the dropdown items and forwards the selected command', () => {
    const wrapper = mountFab({
      items: [
        { command: 'bgm', label: '从 Bangumi 导入', tag: '推荐' },
        { command: 'ip', label: '新增作品 (IP)' },
      ],
    })

    const items = wrapper.findAll('.dd-item')
    expect(items).toHaveLength(2)
    expect(items[0]?.text()).toContain('从 Bangumi 导入')
    expect(items[0]?.text()).toContain('推荐')

    wrapper.findComponent(DropdownStub).vm.$emit('command', 'ip')

    expect(wrapper.emitted('command')?.[0]).toEqual(['ip'])
  })

  it('renders an optional refresh button that emits refresh', async () => {
    const wrapper = mountFab({ showRefresh: true, refreshLabel: '刷新作品列表' })

    const refresh = wrapper.get('.app-fab--refresh')
    expect(refresh.attributes('aria-label')).toBe('刷新作品列表')

    await refresh.trigger('click')

    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('marks the refresh button as busy while refreshing', () => {
    const wrapper = mountFab({ showRefresh: true, refreshing: true })

    expect(wrapper.get('.app-fab--refresh').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.app-fab__spin').exists()).toBe(true)
  })

  it('keeps the refresh button only when the primary action is hidden', () => {
    const wrapper = mountFab({ showPrimary: false, showRefresh: true })

    expect(wrapper.find('.app-fab--primary').exists()).toBe(false)
    expect(wrapper.find('.app-fab--refresh').exists()).toBe(true)
  })

  it('wraps each circle in its own stack item so the stack can animate', () => {
    const both = mountFab({ showRefresh: true })
    expect(both.findAll('.app-fab-stack > .app-fab-item')).toHaveLength(2)

    const onlyRefresh = mountFab({ showPrimary: false, showRefresh: true })
    expect(onlyRefresh.findAll('.app-fab-stack > .app-fab-item')).toHaveLength(1)
  })

  it('animates stack changes with the cloud-showcase fab-list motion', () => {
    // 与 Layout 里云展柜 fab-group 的动效同规格：新增/收起圆钮时缩放淡入淡出
    expect(fabSource).toContain('name="app-fab-list"')
    expect(fabSource).toMatch(/\.app-fab-list-move,[\s\S]*?\.app-fab-list-enter-active,[\s\S]*?\.app-fab-list-leave-active\s*\{[\s\S]*?transition:/)
    expect(fabSource).toContain('.app-fab-list-leave-active {')
    expect(fabSource).toMatch(/\.app-fab-list-enter-from\s*\{[\s\S]*?translateY\(18px\) scale\(0\.72\)/)
    expect(fabSource).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.app-fab-list-move/)
  })
})
