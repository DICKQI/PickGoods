import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MobileGoodsCard from '@/components/MobileGoodsCard.vue'
import type { GoodsListItem } from '@/api/types'

const goods: GoodsListItem = {
  id: 'goods-1',
  name: '测试谷子',
  ip: { id: 1, name: '测试 IP' },
  characters: [
    { id: 1, name: '角色一', ip: { id: 1, name: '测试 IP' }, gender: 'other' },
    { id: 2, name: '角色二', ip: { id: 1, name: '测试 IP' }, gender: 'other' },
  ],
  category: { id: 1, name: '亚克力', parent: null, path_name: '亚克力', color_tag: '#D4AF37', order: 1 },
  location_path: '柜子/第一层',
  main_photo: null,
  status: 'in_cabinet',
  quantity: 3,
  is_official: true,
}

const mountCard = (props: Partial<InstanceType<typeof MobileGoodsCard>['$props']> = {}) =>
  mount(MobileGoodsCard, {
    props: {
      goods,
      ...props,
    },
    global: {
      stubs: {
        'el-icon': { template: '<i><slot /></i>' },
        SquarePaddedImage: { template: '<img class="square-padded-image-stub" />' },
      },
    },
  })

const mockTitleMeasurements = ({
  hostWidth,
  textWidth,
}: {
  hostWidth: number
  textWidth: number
}) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('mobile-goods-title')) return hostWidth
    return 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('mobile-title-measure')) return textWidth
    return 0
  })
}

describe('MobileGoodsCard', () => {
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

  it('marks selected cards with selectable and selected classes', () => {
    const wrapper = mountCard({ selectable: true, selected: true })

    expect(wrapper.classes()).toContain('is-selectable')
    expect(wrapper.classes()).toContain('is-selected')
  })

  it('renders the compact quantity badge when quantity is greater than one', () => {
    const wrapper = mountCard()

    expect(wrapper.get('.mobile-quantity-badge').text()).toBe('x3')
  })

  it('shows the last location segment and emits locationClick from the location chip', async () => {
    const wrapper = mountCard()

    const locationChip = wrapper.get('.mobile-location-chip')
    expect(locationChip.text()).toContain('第一层')

    await locationChip.trigger('click')

    expect(wrapper.emitted('locationClick')?.[0]).toEqual([goods.location_path])
  })

  it('selects the card instead of opening location in selection mode', async () => {
    const wrapper = mountCard({ selectable: true })

    await wrapper.get('.mobile-location-chip').trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual([goods])
    expect(wrapper.emitted('locationClick')).toBeUndefined()
  })

  it('does not render a location chip when location_path is empty', () => {
    const wrapper = mountCard({ goods: { ...goods, location_path: '' } })

    expect(wrapper.find('.mobile-location-chip').exists()).toBe(false)
  })

  it('renders official and unofficial attribute labels', () => {
    expect(mountCard({ goods: { ...goods, is_official: true } }).get('.mobile-attr-tag').text()).toContain('官谷')
    expect(mountCard({ goods: { ...goods, is_official: false } }).get('.mobile-attr-tag').text()).toContain('同人')
  })

  it('keeps short single-line titles static', async () => {
    mockTitleMeasurements({ hostWidth: 160, textWidth: 80 })
    const wrapper = mountCard()

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mobile-goods-title').classes()).not.toContain('is-overflowing')
    expect(wrapper.findAll('.mobile-title-marquee')).toHaveLength(1)
  })

  it('uses a marquee track for overflowing single-line titles', async () => {
    mockTitleMeasurements({ hostWidth: 100, textWidth: 240 })
    const wrapper = mountCard({
      goods: {
        ...goods,
        name: 'A very very very very long goods title that should scroll on mobile',
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mobile-goods-title').classes()).toContain('is-overflowing')
    expect(wrapper.get('.mobile-title-marquee').text()).toContain('A very very very very long goods title')
    expect(wrapper.findAll('.mobile-title-marquee')).toHaveLength(2)
  })

  it('hides the menu button when showMenu is false or selection mode is active', () => {
    expect(mountCard().find('.mobile-menu-button').exists()).toBe(true)
    expect(mountCard({ showMenu: false }).find('.mobile-menu-button').exists()).toBe(false)
    expect(mountCard({ selectable: true }).find('.mobile-menu-button').exists()).toBe(false)
  })

  it('emits contextMenu from the menu button', async () => {
    const wrapper = mountCard()

    await wrapper.get('.mobile-menu-button').trigger('click', { clientX: 24, clientY: 48 })

    expect(wrapper.emitted('contextMenu')?.[0]).toEqual([{ goods, x: 24, y: 48 }])
  })

  it('emits contextMenu after a long press', async () => {
    vi.useFakeTimers()
    const wrapper = mountCard()

    await wrapper.trigger('touchstart', { touches: [{ clientX: 12, clientY: 34 }] })
    vi.advanceTimersByTime(600)

    expect(wrapper.emitted('contextMenu')?.[0]).toEqual([{ goods, x: 12, y: 34 }])
    vi.useRealTimers()
  })
})
