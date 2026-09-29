import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ImageEditInspector from '@/views/goods-form/components/ImageEditInspector.vue'
import { createDefaultFilterState } from '@/views/goods-form/imageUtils'

const ButtonStub = {
  props: { disabled: Boolean },
  emits: ['click'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

const SliderStub = {
  props: ['modelValue', 'min', 'max', 'disabled'],
  emits: ['update:modelValue', 'change'],
  template: `
    <input
      type="range"
      :value="modelValue"
      :disabled="disabled"
      @input="$emit('update:modelValue', Number($event.target.value))"
      @change="$emit('change')"
    />
  `,
}

function mountInspector(
  activeTool = 'crop',
  overrides: Record<string, unknown> = {},
) {
  return mount(ImageEditInspector, {
    props: {
      activeTool: activeTool as any,
      selectedAspectRatio: 'free',
      filterState: createDefaultFilterState(),
      activeHslColor: 'red',
      enableRoundedRect: false,
      roundedRadius: 20,
      enableMargin: false,
      marginPercent: 8,
      heartWidthPercent: 100,
      heartHeightPercent: 100,
      sourceHasTransparency: false,
      ...overrides,
    },
    global: {
      stubs: {
        ElButton: ButtonStub,
        ElIcon: { template: '<span><slot /></span>' },
        ElSlider: SliderStub,
        ElSwitch: {
          props: ['modelValue', 'disabled'],
          emits: ['update:modelValue'],
          template: '<button type="button" role="switch" :disabled="disabled" @click="$emit(\'update:modelValue\', !modelValue)" />',
        },
      },
    },
  })
}

describe('ImageEditInspector', () => {
  it('裁剪页展示全部现有比例并发出比例变更', async () => {
    const wrapper = mountInspector()
    const baseOptions = wrapper.get('.ratio-grid').findAll('.ratio-option')

    expect(baseOptions.map(option => option.text())).toEqual([
      expect.stringContaining('自由'),
      expect.stringContaining('1:1'),
      expect.stringContaining('圆形'),
      expect.stringContaining('心形'),
    ])

    await baseOptions[1]!.trigger('click')
    expect(wrapper.emitted('update:selectedAspectRatio')?.[0]).toEqual(['1:1'])
  })

  it('椭圆聚合区默认折叠，展开后保留预设与自定义入口', async () => {
    const wrapper = mountInspector()
    const toggle = wrapper.get('.ellipse-group__toggle')
    const body = wrapper.get('.ellipse-group__body')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(body.isVisible()).toBe(false)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(body.attributes('style')).not.toContain('display: none')
    expect(body.text()).toContain('47:65')
    expect(body.text()).toContain('63:93')
    expect(body.text()).toContain('自定义')

    await body.findAll('.ratio-option')[2]!.trigger('click')
    const ratioEvents = wrapper.emitted('update:selectedAspectRatio') ?? []
    expect(ratioEvents[ratioEvents.length - 1]).toEqual(['custom-ellipse'])
  })

  it('心形模式展示宽高滑杆并发送更新事件', async () => {
    const wrapper = mountInspector('crop', {
      selectedAspectRatio: 'heart',
      heartWidthPercent: 80,
      heartHeightPercent: 90,
    })
    const sliders = wrapper.get('.heart-size-panel').findAll('input[type="range"]')

    expect(sliders).toHaveLength(2)
    await sliders[0]!.setValue('65')
    await sliders[1]!.setValue('72')

    expect(wrapper.emitted('update:heartWidthPercent')?.[0]).toEqual([65])
    expect(wrapper.emitted('update:heartHeightPercent')?.[0]).toEqual([72])
    expect(wrapper.emitted('commit')).toHaveLength(2)
  })

  it('高级色彩默认折叠并可展开', async () => {
    const wrapper = mountInspector('adjust')
    const toggle = wrapper.get('.advanced-section__toggle')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.hsl-tabs').isVisible()).toBe(true)
  })

  it('快捷旋转按 90 度发送事件', async () => {
    const wrapper = mountInspector()
    await wrapper.findAll('.quick-actions button')[0]!.trigger('click')
    expect(wrapper.emitted('quick-rotate')?.[0]).toEqual([-90])
  })

  it('外形页展示透明画布提示', () => {
    const wrapper = mountInspector('shape')
    expect(wrapper.text()).toContain('当前结果不包含透明区域')
  })
})
