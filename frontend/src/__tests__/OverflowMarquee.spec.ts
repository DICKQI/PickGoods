import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OverflowMarquee from '@/components/ui/OverflowMarquee.vue'

const mockMeasurements = (clientWidth: number, scrollWidth: number) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('overflow-marquee__text') ? clientWidth : 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('overflow-marquee__text') ? scrollWidth : 0
  })
}

const settleMeasurement = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
}

describe('OverflowMarquee', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps non-overflowing text static', async () => {
    mockMeasurements(180, 120)
    const wrapper = mount(OverflowMarquee, { props: { text: '短标题' } })

    await settleMeasurement(wrapper)

    expect(wrapper.classes()).not.toContain('is-scrollable')
    expect(wrapper.attributes('title')).toBe('短标题')
  })

  it('starts the readable marquee only when text overflows', async () => {
    mockMeasurements(120, 240)
    const text = '很长很长的手办名称标题，需要自动横向滚动才能完整显示'
    const wrapper = mount(OverflowMarquee, { props: { text } })

    await settleMeasurement(wrapper)

    expect(wrapper.classes()).toContain('is-scrollable')
    expect(wrapper.findAll('.overflow-marquee__scroll-text')).toHaveLength(2)
    expect(wrapper.attributes('style')).toContain('--overflow-marquee-duration: 11.9s')
  })
})
