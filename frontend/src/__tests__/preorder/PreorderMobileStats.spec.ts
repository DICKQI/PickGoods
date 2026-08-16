import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PreorderMobileStats from '@/components/preorder/PreorderMobileStats.vue'
import type { PreorderStats } from '@/api/types'

const stats: PreorderStats = {
  pending_count: 3,
  due_this_month: 1,
  due_this_quarter: 2,
  converted_count: 5,
  total_pending_balance: '1050.00',
}

const mountStats = () =>
  mount(PreorderMobileStats, {
    props: { stats },
    global: {
      stubs: {
        'el-icon': { template: '<i><slot /></i>' },
        Transition: false,
      },
    },
  })

describe('PreorderMobileStats', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('默认收起：只显示三个主指标', () => {
    const wrapper = mountStats()
    expect(wrapper.text()).toContain('待补款')
    expect(wrapper.text()).toContain('本月到期')
    expect(wrapper.text()).toContain('本季到期')
    expect(wrapper.text()).not.toContain('待补尾款')
  })

  it('点展开显示次级指标并持久化到 localStorage', async () => {
    const wrapper = mountStats()
    await wrapper.find('.preorder-mobile-stats__toggle').trigger('click')
    expect(wrapper.text()).toContain('待补尾款')
    expect(wrapper.text()).toContain('¥1050.00')
    expect(wrapper.text()).toContain('已转正')
    expect(localStorage.getItem('preorder:mobile:statsExpanded')).toBe('1')
  })

  it('读取 localStorage 展开状态', () => {
    localStorage.setItem('preorder:mobile:statsExpanded', '1')
    const wrapper = mountStats()
    expect(wrapper.text()).toContain('待补尾款')
  })
})
