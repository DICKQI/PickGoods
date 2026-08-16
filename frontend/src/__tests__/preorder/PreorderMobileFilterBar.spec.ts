import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PreorderMobileFilterBar from '@/components/preorder/PreorderMobileFilterBar.vue'

const mountBar = (props: Record<string, unknown> = {}) =>
  mount(PreorderMobileFilterBar, {
    props: {
      statusFilter: '',
      searchKeyword: '',
      total: 0,
      ...props,
    },
    global: {
      stubs: {
        'el-icon': { template: '<i><slot /></i>' },
        Transition: false,
      },
    },
  })

describe('PreorderMobileFilterBar', () => {
  it('渲染五个状态胶囊并展示总数', () => {
    const wrapper = mountBar({ total: 7 })
    const chips = wrapper.findAll('.preorder-mobile-filterbar__chip')
    expect(chips.map((c) => c.text())).toEqual(['全部', '待补款', '已补款', '已转正', '已取消'])
    expect(wrapper.text()).toContain('共 7 条 · 按补款时间从近到远')
  })

  it('点击胶囊 emit update:statusFilter 与 statusChange', async () => {
    const wrapper = mountBar()
    const chips = wrapper.findAll('.preorder-mobile-filterbar__chip')
    await chips[1]!.trigger('click')
    expect(wrapper.emitted('update:statusFilter')?.[0]).toEqual(['pending'])
    expect(wrapper.emitted('statusChange')?.[0]).toEqual(['pending'])
    await wrapper.setProps({ statusFilter: 'pending' })
    expect(wrapper.findAll('.preorder-mobile-filterbar__chip')[1]!.classes()).toContain('is-selected')
  })

  it('搜索默认收起，点图标展开并聚焦输入框', async () => {
    const wrapper = mountBar()
    expect(wrapper.find('.preorder-mobile-filterbar__search').exists()).toBe(false)
    await wrapper.find('.preorder-mobile-filterbar__search-toggle').trigger('click')
    expect(wrapper.find('.preorder-mobile-filterbar__search').exists()).toBe(true)
  })

  it('输入搜索词 emit update:searchKeyword 与 search，清空 emit clear', async () => {
    const wrapper = mountBar()
    await wrapper.find('.preorder-mobile-filterbar__search-toggle').trigger('click')
    await wrapper.find('.preorder-mobile-filterbar__input').setValue('流萤')
    expect(wrapper.emitted('update:searchKeyword')?.[0]).toEqual(['流萤'])
    expect(wrapper.emitted('search')).toHaveLength(1)

    await wrapper.setProps({ searchKeyword: '流萤' })
    await wrapper.find('.preorder-mobile-filterbar__clear').trigger('click')
    expect(wrapper.emitted('update:searchKeyword')?.[1]).toEqual([''])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('父组件更新 searchKeyword 后输入框同步显示', async () => {
    const wrapper = mountBar({ searchKeyword: '流萤' })
    await wrapper.find('.preorder-mobile-filterbar__search-toggle').trigger('click')
    const input = wrapper.find('.preorder-mobile-filterbar__input')
    expect((input.element as HTMLInputElement).value).toBe('流萤')

    await wrapper.setProps({ searchKeyword: '' })
    expect((input.element as HTMLInputElement).value).toBe('')
  })
})
