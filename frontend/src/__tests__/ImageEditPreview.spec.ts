import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ImageEditPreview from '@/views/goods-form/components/ImageEditPreview.vue'

const passthrough = {
  template: '<span><slot /></span>',
}

function mountPreview(props: { url: string; loading: boolean; error?: string }) {
  return mount(ImageEditPreview, {
    props,
    global: {
      stubs: {
        ElButton: {
          emits: ['click'],
          template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
        },
        ElIcon: passthrough,
      },
    },
  })
}

describe('ImageEditPreview', () => {
  it('加载时显示占位状态', () => {
    const wrapper = mountPreview({ url: '', loading: true })
    expect(wrapper.text()).toContain('调整参数后生成预览')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('失败时保留上一次有效预览并提供重试', async () => {
    const wrapper = mountPreview({
      url: 'blob:last-valid',
      loading: false,
      error: '预览生成失败',
    })

    expect(wrapper.get('img').attributes('src')).toBe('blob:last-valid')
    expect(wrapper.text()).toContain('当前展示上一次有效预览')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
