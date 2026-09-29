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
  template: '<input type="range" :value="modelValue" :disabled="disabled" />',
}

function mountInspector(activeTool = 'crop') {
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
      sourceHasTransparency: false,
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
    const options = wrapper.findAll('.ratio-option')

    expect(options.map(option => option.text())).toEqual([
      expect.stringContaining('自由'),
      expect.stringContaining('1:1'),
      expect.stringContaining('圆形'),
      expect.stringContaining('47:65'),
      expect.stringContaining('63:93'),
    ])

    await options[1]!.trigger('click')
    expect(wrapper.emitted('update:selectedAspectRatio')?.[0]).toEqual(['1:1'])
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
