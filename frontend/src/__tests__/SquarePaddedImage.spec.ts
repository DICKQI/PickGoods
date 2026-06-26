import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SquarePaddedImage from '@/components/SquarePaddedImage.vue'

const mountImage = (props = {}, attrs = {}) => mount(SquarePaddedImage, {
  props: {
    src: 'https://example.com/main.jpg',
    alt: 'main photo',
    ...props,
  },
  attrs,
  global: {
    stubs: {
      'el-icon': { template: '<i><slot /></i>' },
      Picture: { template: '<span />' },
      'el-image': defineComponent({
        name: 'ElImage',
        props: ['src', 'alt', 'fit', 'previewSrcList', 'initialIndex', 'loading'],
        template: '<div class="el-image-stub"><slot name="error" /></div>',
      }),
      WatermarkImage: defineComponent({
        name: 'WatermarkImage',
        props: ['src', 'alt', 'fit', 'userId'],
        template: '<div class="watermark-stub"></div>',
      }),
    },
  },
})

describe('SquarePaddedImage', () => {
  it('renders a square white contain image shell', () => {
    const wrapper = mountImage({
      previewSrcList: ['https://example.com/main.jpg'],
      initialIndex: 0,
      loading: 'lazy',
    }, {
      class: 'custom-image',
    })

    expect(wrapper.classes()).toContain('square-padded-image')
    expect(wrapper.classes()).toContain('custom-image')

    const image = wrapper.getComponent({ name: 'ElImage' })
    expect(image.props('fit')).toBe('contain')
    expect(image.props('src')).toBe('https://example.com/main.jpg')
    expect(image.props('alt')).toBe('main photo')
    expect(image.props('previewSrcList')).toEqual(['https://example.com/main.jpg'])
    expect(image.props('initialIndex')).toBe(0)
    expect(image.props('loading')).toBe('lazy')
  })

  it('uses contain fit for the watermark rendering path', () => {
    const wrapper = mountImage({
      watermark: true,
      watermarkUserId: 'ID:goods-1',
    })

    expect(wrapper.findComponent({ name: 'ElImage' }).exists()).toBe(false)

    const watermark = wrapper.getComponent({ name: 'WatermarkImage' })
    expect(watermark.props('fit')).toBe('contain')
    expect(watermark.props('src')).toBe('https://example.com/main.jpg')
    expect(watermark.props('alt')).toBe('main photo')
    expect(watermark.props('userId')).toBe('ID:goods-1')
  })

  it('shows the placeholder when there is no source image', () => {
    const wrapper = mountImage({ src: '' })

    expect(wrapper.findComponent({ name: 'ElImage' }).exists()).toBe(false)
    expect(wrapper.find('.square-padded-image__placeholder').exists()).toBe(true)
  })
})
