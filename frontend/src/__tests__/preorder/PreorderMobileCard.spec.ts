import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import PreorderMobileCard from '@/components/preorder/PreorderMobileCard.vue'
import type { Preorder } from '@/api/types'

const makePreorder = (overrides: Partial<Preorder> = {}): Preorder => ({
  id: 'p-1',
  name: '流萤手办',
  platform: '淘宝',
  shop_name: '示例店',
  order_no: 'ORD-001',
  deposit_amount: '350.00',
  balance_amount: '700.00',
  time_granularity: 'month',
  estimated_month: '2026-08-01',
  status: 'pending',
  paid_at: null,
  goods_id: null,
  goods_name: null,
  notes: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...overrides,
})

const mountCard = (item: Preorder, extraProps: Record<string, unknown> = {}) =>
  mount(PreorderMobileCard, {
    props: { item, ...extraProps },
    global: {
      stubs: {
        'el-icon': { template: '<i><slot /></i>' },
        'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
      },
    },
  })

const swipe = async (wrapper: ReturnType<typeof mountCard>) => {
  await wrapper.find('.preorder-mobile-card').trigger('touchstart', {
    touches: [{ clientX: 200, clientY: 100 }],
    changedTouches: [{ clientX: 200, clientY: 100 }],
  })
  await wrapper.find('.preorder-mobile-card').trigger('touchmove', {
    touches: [{ clientX: 100, clientY: 102 }],
    changedTouches: [{ clientX: 100, clientY: 102 }],
  })
  await wrapper.find('.preorder-mobile-card').trigger('touchend', {
    touches: [],
    changedTouches: [{ clientX: 100, clientY: 102 }],
  })
}

describe('PreorderMobileCard', () => {
  it('pending 卡片渲染主操作与金额信息', () => {
    const wrapper = mountCard(makePreorder())
    expect(wrapper.text()).toContain('流萤手办')
    expect(wrapper.text()).toContain('待补款')
    expect(wrapper.text()).toContain('2026年8月补款')
    expect(wrapper.text()).toContain('¥350.00')
    expect(wrapper.text()).toContain('¥700.00')
    expect(wrapper.text()).toContain('淘宝')
    expect(wrapper.text()).toContain('订单 ORD-001')
    expect(wrapper.find('.preorder-mobile-card__primary').text()).toBe('标记补款')
  })

  it('过期待补款显示已到期警示；季度粒度显示补款期', () => {
    const monthDue = mountCard(makePreorder({ estimated_month: '2026-01-01' }))
    expect(monthDue.find('.preorder-mobile-card__due-tag').text()).toBe('已到期')
    expect(monthDue.find('.preorder-mobile-card').classes()).toContain('is-due')

    const quarterDue = mountCard(
      makePreorder({ time_granularity: 'quarter', estimated_month: '2026-07-01' })
    )
    expect(quarterDue.find('.preorder-mobile-card__due-tag').text()).toBe('补款期')
  })

  it('按状态渲染主操作：paid 转正、converted 查看谷子、cancelled 无主操作', () => {
    expect(
      mountCard(makePreorder({ status: 'paid' })).find('.preorder-mobile-card__primary').text()
    ).toBe('转正为谷子')
    expect(
      mountCard(makePreorder({ status: 'converted', goods_id: 'g-1' }))
        .find('.preorder-mobile-card__primary')
        .text()
    ).toBe('查看谷子')
    expect(
      mountCard(makePreorder({ status: 'cancelled' })).find('.preorder-mobile-card__primary').exists()
    ).toBe(false)
  })

  it('主操作与 ⋯ 菜单分别 emit primary / menu', async () => {
    const wrapper = mountCard(makePreorder())
    await wrapper.find('.preorder-mobile-card__primary').trigger('click')
    await wrapper.find('.preorder-mobile-card__more').trigger('click')
    expect(wrapper.emitted('primary')).toHaveLength(1)
    expect(wrapper.emitted('menu')).toHaveLength(1)
  })

  it('尾款为 0 时显示 ¥0.00 而不是未知', () => {
    const wrapper = mountCard(makePreorder({ balance_amount: '0.00' }))
    expect(wrapper.text()).toContain('¥0.00')
    expect(wrapper.text()).not.toContain('未知')
  })

  it('左滑露出编辑/删除并 emit swipeAction', async () => {
    const wrapper = mountCard(makePreorder())
    await swipe(wrapper)
    const article = wrapper.find('.preorder-mobile-card')
    expect(article.attributes('style')).toContain('translateX(-144px)')
    expect(wrapper.emitted('swipeStart')).toHaveLength(1)
    await wrapper.find('.preorder-mobile-card__swipe-btn.is-edit').trigger('click')
    expect(wrapper.emitted('swipeAction')?.[0]).toEqual(['edit'])
  })

  it('closeSwipe 复位左滑状态', async () => {
    const wrapper = mountCard(makePreorder())
    await swipe(wrapper)
    expect(wrapper.find('.preorder-mobile-card').attributes('style')).toContain('translateX(-144px)')
    ;(wrapper.vm as unknown as { closeSwipe: () => void }).closeSwipe()
    await nextTick()
    expect(wrapper.find('.preorder-mobile-card').attributes('style')).toContain('translateX(0px)')
  })

  it('高亮 prop 渲染高亮 class', () => {
    const wrapper = mountCard(makePreorder(), { highlight: true })
    expect(wrapper.find('.preorder-mobile-card').classes()).toContain('is-highlight')
  })
})
