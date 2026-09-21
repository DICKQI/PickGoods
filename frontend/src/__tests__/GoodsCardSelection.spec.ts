import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import GoodsCard from '@/components/GoodsCard.vue'
import OverflowMarquee from '@/components/ui/OverflowMarquee.vue'
import type { GoodsListItem } from '@/api/types'

const goods: GoodsListItem = {
  id: 'goods-1',
  name: '测试谷子',
  ip: { id: 1, name: '测试 IP' },
  characters: [{ id: 1, name: '角色', ip: { id: 1, name: '测试 IP' }, gender: 'other' }],
  category: { id: 1, name: '亚克力', parent: null, path_name: '亚克力', order: 1 },
  location_path: '柜子/第一层',
  main_photo: null,
  status: 'in_cabinet',
  quantity: 1,
  is_official: true,
}

const mountCard = (props: Partial<InstanceType<typeof GoodsCard>['$props']> = {}) =>
  mount(GoodsCard, {
    props: {
      goods,
      ...props,
    },
    global: {
      stubs: {
        'el-icon': { template: '<i><slot /></i>' },
        'el-image': { template: '<div><slot name="error" /></div>' },
        WatermarkImage: true,
      },
    },
  })

const goodsCardSource = () =>
  readFileSync(resolve(process.cwd(), 'src/components/GoodsCard.vue'), 'utf8')

describe('GoodsCard selection mode', () => {
  it('emits click in normal mode', async () => {
    const wrapper = mountCard()

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')?.[0]).toEqual([goods])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('emits select instead of click in selection mode', async () => {
    const wrapper = mountCard({ selectable: true })

    await wrapper.trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual([goods])
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('marks the card as selected', () => {
    const wrapper = mountCard({ selectable: true, selected: true })

    expect(wrapper.classes()).toContain('is-selectable')
    expect(wrapper.classes()).toContain('is-selected')
  })

  it('keeps the inline location layout and disables auto scroll by default', () => {
    const deepGoods = {
      ...goods,
      location_path: '家/卧室/A 柜/第三层',
    }
    const wrapper = mountCard({ goods: deepGoods })
    const locationButton = wrapper.get('.location-box')
    const marquee = wrapper.findComponent(OverflowMarquee)

    expect(wrapper.get('.card-footer').classes()).not.toContain('is-location-stacked')
    expect(locationButton.element.tagName).toBe('BUTTON')
    expect(locationButton.attributes('type')).toBe('button')
    expect(locationButton.attributes('aria-label')).toBe(`定位到 ${deepGoods.location_path}`)
    expect(marquee.props('text')).toBe('卧室 › A 柜 › 第三层')
    expect(marquee.props('autoScroll')).toBe(false)
  })

  it('shows the complete path and enables auto scroll in stacked mode', async () => {
    const deepGoods = {
      ...goods,
      location_path: '家/卧室/A 柜/第三层',
    }
    const wrapper = mountCard({ goods: deepGoods, locationLayout: 'stacked' })
    const marquee = wrapper.findComponent(OverflowMarquee)

    expect(wrapper.get('.card-footer').classes()).toContain('is-location-stacked')
    expect(wrapper.get('.location-box').classes()).toContain('is-stacked')
    expect(marquee.props('text')).toBe('家 › 卧室 › A 柜 › 第三层')
    expect(marquee.props('autoScroll')).toBe(true)

    await wrapper.get('.location-box').trigger('click')

    expect(wrapper.emitted('locationClick')?.[0]).toEqual([deepGoods.location_path])
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('does not render a location row without a location path', () => {
    const wrapper = mountCard({ goods: { ...goods, location_path: '' } })

    expect(wrapper.find('.location-box').exists()).toBe(false)
    expect(wrapper.findComponent(OverflowMarquee).exists()).toBe(false)
  })

  it('keeps the preparation overlay while blocking card navigation', async () => {
    const wrapper = mountCard({ loading: true })

    expect(wrapper.text()).toContain('谷子正在准备中~')
    expect(wrapper.find('.card-loading-overlay').exists()).toBe(true)

    await wrapper.trigger('click')
    await wrapper.trigger('contextmenu')

    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.emitted('contextMenu')).toBeUndefined()
  })

  it('保留 PC 卡片交互入口并隐藏未定位占位', () => {
    const source = goodsCardSource()

    expect(source).toContain('contextMenu')
    expect(source).toContain('locationClick')
    expect(source).toContain('showMenu?: boolean')
    expect(source).toContain("'is-selected'")
    expect(source).toContain('location-marquee')
    expect(source).toContain('OverflowMarquee')
    expect(source).toContain('category-tag-text')
    expect(source).toContain("class=\"card-footer\"")
    expect(source).toContain("'has-location': goods.location_path")
    expect(source).toContain("'is-location-stacked': isLocationStacked && goods.location_path")
    expect(source).toContain('grid-template-columns: minmax(94px, 42%) minmax(0, 1fr);')
    expect(source).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(source).toContain("locationLayout?: 'inline' | 'stacked'")
    expect(source).toContain("locationLayout: 'inline'")
    expect(source).toContain('max-width: min(126px, 100%);')
    expect(source).toContain('box-sizing: border-box;')
    expect(source).toContain('category-tag-track')
    expect(source).toContain('is-scrollable')
    expect(source).toContain('@keyframes categoryTagScroll')
    expect(source).toContain('ResizeObserver')
    expect(source).toContain('animation: categoryTagScroll 4.8s ease-in-out infinite;')
    expect(source).toContain('character-value-track')
    expect(source).toContain('getReadableMarqueeDuration')
    expect(source).toContain('characterScrollDuration')
    expect(source).not.toContain('location-box--empty')
    expect(source).not.toContain('未定位')
  })
})
