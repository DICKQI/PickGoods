import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ImageEditToolbar from '@/views/goods-form/components/ImageEditToolbar.vue'

const ButtonStub = {
  props: {
    disabled: Boolean,
    loading: Boolean,
    icon: [Object, Function],
  },
  emits: ['click', 'mousedown', 'mouseup', 'mouseleave', 'touchstart', 'touchend', 'touchcancel'],
  template: `
    <button
      type="button"
      :disabled="disabled"
      @click="$emit('click')"
      @mousedown="$emit('mousedown')"
      @mouseup="$emit('mouseup')"
      @mouseleave="$emit('mouseleave')"
    ><slot /></button>
  `,
}

function mountToolbar(overrides: Record<string, unknown> = {}) {
  return mount(ImageEditToolbar, {
    props: {
      canUndo: false,
      canRedo: false,
      confirming: false,
      ready: true,
      comparing: false,
      ...overrides,
    },
    global: {
      stubs: {
        ElButton: ButtonStub,
      },
    },
  })
}

describe('ImageEditToolbar', () => {
  it('历史不可用时禁用撤回和恢复', () => {
    const wrapper = mountToolbar()
    const buttons = wrapper.findAll('button')
    expect(buttons[0]!.attributes('disabled')).toBeDefined()
    expect(buttons[1]!.attributes('disabled')).toBeDefined()
  })

  it('按住对比按钮发送开始和结束事件', async () => {
    const wrapper = mountToolbar()
    const compareButton = wrapper.findAll('button').find(button => button.text().includes('按住看原图'))!

    await compareButton.trigger('mousedown')
    await compareButton.trigger('mouseup')

    expect(wrapper.emitted('compare-start')).toHaveLength(1)
    expect(wrapper.emitted('compare-stop')).toHaveLength(1)
  })

  it('准备完成后确认按钮发出确认事件', async () => {
    const wrapper = mountToolbar()
    const confirmButton = wrapper.findAll('button').find(button => button.text().includes('确认'))!
    await confirmButton.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
