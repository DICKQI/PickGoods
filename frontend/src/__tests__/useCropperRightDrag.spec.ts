import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useCropperRightDrag } from '@/views/goods-form/composables/useCropperRightDrag'

const wrappers: VueWrapper[] = []

const createPointerEvent = (
  type: string,
  x: number,
  y: number,
  button = 2,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, {
    button,
    buttons: button === 2 ? 2 : 1,
    clientX: x,
    clientY: y,
    pointerId: 7,
    pointerType: 'mouse',
  })
  return event
}

function mountHarness(canDrag = true) {
  const moveBy = vi.fn((offsetX: number, offsetY: number) => offsetX !== 0 || offsetY !== 0)
  const onMoved = vi.fn()
  const onDragEnd = vi.fn()
  const canDragRef = ref(canDrag)

  const wrapper = mount(defineComponent({
    setup() {
      const drag = useCropperRightDrag({
        canDrag: () => canDragRef.value,
        moveBy,
        onMoved,
        onDragEnd,
      })
      return {
        ...drag,
        canDragRef,
      }
    },
    template: `
      <div
        class="surface"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerEnd"
        @pointercancel="handlePointerEnd"
        @lostpointercapture="handleLostPointerCapture"
        @contextmenu="handleContextMenu"
      />
    `,
  }), { attachTo: document.body })
  wrappers.push(wrapper)

  const surface = wrapper.get('.surface').element as HTMLElement
  const setPointerCapture = vi.fn()
  const releasePointerCapture = vi.fn()
  const hasPointerCapture = vi.fn(() => true)
  Object.assign(surface, {
    setPointerCapture,
    releasePointerCapture,
    hasPointerCapture,
  })

  return {
    wrapper,
    surface,
    moveBy,
    onMoved,
    onDragEnd,
    canDragRef,
    setPointerCapture,
    releasePointerCapture,
  }
}

afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount()
  wrappers.length = 0
})

describe('useCropperRightDrag', () => {
  it('忽略左键并保留原有裁剪交互', () => {
    const harness = mountHarness()
    harness.surface.dispatchEvent(createPointerEvent('pointerdown', 100, 100, 0))

    expect(harness.setPointerCapture).not.toHaveBeenCalled()
    expect(harness.moveBy).not.toHaveBeenCalled()
  })

  it('右键按相邻坐标增量移动图片并在松手后提交一次历史', () => {
    const harness = mountHarness()
    harness.surface.dispatchEvent(createPointerEvent('pointerdown', 100, 100))
    harness.surface.dispatchEvent(createPointerEvent('pointermove', 130, 80))
    harness.surface.dispatchEvent(createPointerEvent('pointermove', 120, 95))
    harness.surface.dispatchEvent(createPointerEvent('pointerup', 120, 95))

    expect(harness.setPointerCapture).toHaveBeenCalledWith(7)
    expect(harness.moveBy).toHaveBeenNthCalledWith(1, 30, -20)
    expect(harness.moveBy).toHaveBeenNthCalledWith(2, -10, 15)
    expect(harness.onMoved).toHaveBeenCalledTimes(2)
    expect(harness.onDragEnd).toHaveBeenCalledTimes(1)
    expect(harness.releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it('没有实际移动时不产生历史记录', () => {
    const harness = mountHarness()
    harness.surface.dispatchEvent(createPointerEvent('pointerdown', 100, 100))
    harness.surface.dispatchEvent(createPointerEvent('pointerup', 100, 100))

    expect(harness.onDragEnd).not.toHaveBeenCalled()
  })

  it('Pointer Capture 丢失或取消时结束一次拖拽', () => {
    const first = mountHarness()
    first.surface.dispatchEvent(createPointerEvent('pointerdown', 100, 100))
    first.surface.dispatchEvent(createPointerEvent('pointermove', 110, 100))
    first.surface.dispatchEvent(createPointerEvent('lostpointercapture', 110, 100))
    first.surface.dispatchEvent(createPointerEvent('pointerup', 110, 100))

    expect(first.onDragEnd).toHaveBeenCalledTimes(1)

    const second = mountHarness()
    second.surface.dispatchEvent(createPointerEvent('pointerdown', 100, 100))
    second.surface.dispatchEvent(createPointerEvent('pointermove', 90, 100))
    second.surface.dispatchEvent(createPointerEvent('pointercancel', 90, 100))

    expect(second.onDragEnd).toHaveBeenCalledTimes(1)
  })

  it('未就绪时忽略右键拖图但仍屏蔽上下文菜单', () => {
    const harness = mountHarness(false)
    const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })

    harness.surface.dispatchEvent(createPointerEvent('pointerdown', 100, 100))
    harness.surface.dispatchEvent(contextMenu)

    expect(harness.setPointerCapture).not.toHaveBeenCalled()
    expect(contextMenu.defaultPrevented).toBe(true)
  })
})
