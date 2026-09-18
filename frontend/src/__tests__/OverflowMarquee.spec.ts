import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import OverflowMarquee from '@/components/ui/OverflowMarquee.vue'

const mockMeasurements = (clientWidth: number, scrollWidth: number) => {
  const measurements = { clientWidth, scrollWidth }
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('overflow-marquee__text') ? measurements.clientWidth : 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('overflow-marquee__text') ? measurements.scrollWidth : 0
  })

  return {
    setScrollWidth: (value: number) => {
      measurements.scrollWidth = value
    },
  }
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

  it('keeps overflowing text static when auto scroll is disabled', async () => {
    mockMeasurements(120, 240)
    const wrapper = mount(OverflowMarquee, {
      props: {
        text: '很长很长的位置路径，需要关闭自动滚动时保持省略',
        autoScroll: false,
      },
    })

    await settleMeasurement(wrapper)

    expect(wrapper.classes()).not.toContain('is-scrollable')
    expect(wrapper.findAll('.overflow-marquee__scroll-text')).toHaveLength(2)
  })

  it('recalculates scrolling when auto scroll is enabled later', async () => {
    mockMeasurements(120, 240)
    const wrapper = mount(OverflowMarquee, {
      props: {
        text: '位置页完整路径',
        autoScroll: false,
      },
    })

    await settleMeasurement(wrapper)
    expect(wrapper.classes()).not.toContain('is-scrollable')

    await wrapper.setProps({ autoScroll: true })
    await settleMeasurement(wrapper)

    expect(wrapper.classes()).toContain('is-scrollable')
  })

  it('recalculates scrolling when the text changes', async () => {
    const measurements = mockMeasurements(120, 40)
    const wrapper = mount(OverflowMarquee, {
      props: {
        text: '短',
      },
    })

    await settleMeasurement(wrapper)
    expect(wrapper.classes()).not.toContain('is-scrollable')

    measurements.setScrollWidth(240)
    await wrapper.setProps({ text: '更新后需要自动滚动的完整位置路径' })
    await settleMeasurement(wrapper)

    expect(wrapper.classes()).toContain('is-scrollable')
  })

  it('disables marquee animations for reduced motion', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ui/OverflowMarquee.vue'), 'utf8')

    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
    expect(source).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none;/,
    )
  })
})
