import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() },
  ElMessageBox: { confirm: vi.fn(() => Promise.resolve('confirm')) },
}))

vi.mock('@/composables/useResponsiveDevice', async () => {
  const { ref } = await import('vue')
  return {
    useResponsiveDevice: () => ({
      isMobile: ref(false),
      viewportWidth: ref(1440),
    }),
  }
})

vi.mock('@/views/goods-form/imageCropperAdapter', () => ({
  getCropperNumericState: vi.fn(() => ({ width: 800, height: 600 })),
  applyCropperStateFromSnapshot: vi.fn(() => true),
  exportCropperFile: vi.fn(async () => new File(['crop'], 'crop.png', { type: 'image/png' })),
  zoomCropper: vi.fn(() => true),
  moveCropper: vi.fn(() => true),
  rotateCropperTo: vi.fn(() => true),
  fitCropper: vi.fn(() => true),
}))

vi.mock('@/views/goods-form/imageRenderPipeline', () => ({
  getCropOutputDimensions: vi.fn(() => ({ width: 800, height: 600 })),
  processCroppedImage: vi.fn(async () => new File(['output'], 'main_photo.jpg', { type: 'image/jpeg' })),
}))

vi.mock('@/views/goods-form/imageUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/views/goods-form/imageUtils')>()
  return {
    ...actual,
    assertImageDecodable: vi.fn(async () => undefined),
    detectImageTransparency: vi.fn(async () => false),
  }
})

import ImageCropper from '@/views/goods-form/components/ImageCropper.vue'
import { moveCropper } from '@/views/goods-form/imageCropperAdapter'

const DialogStub = {
  props: ['modelValue', 'fullscreen'],
  emits: ['update:modelValue', 'opened', 'closed'],
  mounted() {
    ;(this as any).$emit('opened')
  },
  template: `
    <section v-if="modelValue" data-test="dialog">
      <header><slot name="header" /></header>
      <main><slot /></main>
    </section>
  `,
}

const CropperStub = {
  props: ['img', 'options'],
  mounted() {
    ;(this as any).options?.ready?.()
  },
  template: '<div data-test="cropper" />',
}

const ToolbarStub = {
  emits: ['confirm', 'cancel', 'undo', 'redo', 'reset', 'compare-start', 'compare-stop'],
  template: `
    <div>
      <button data-test="confirm" @click="$emit('confirm')">confirm</button>
      <button data-test="cancel" @click="$emit('cancel')">cancel</button>
    </div>
  `,
}

const InspectorStub = {
  emits: ['quick-rotate'],
  template: '<button data-test="rotate" @click="$emit(\'quick-rotate\', 90)">rotate</button>',
}

const passthrough = {
  template: '<div><slot /></div>',
}

function mountCropper() {
  return mount(ImageCropper, {
    props: {
      visible: true,
      imageFile: new File(['source'], 'source.jpg', { type: 'image/jpeg' }),
      imageUrl: 'https://example.com/source.jpg',
      maxOutputSize: 2000,
    },
    global: {
      stubs: {
        ElDialog: DialogStub,
        ElButton: {
          props: ['disabled', 'loading'],
          emits: ['click'],
          template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
        ElIcon: passthrough,
        ElTooltip: passthrough,
        VuePictureCropper: CropperStub,
        ImageEditToolbar: ToolbarStub,
        ImageEditToolRail: passthrough,
        ImageEditInspector: InspectorStub,
        ImageEditPreview: passthrough,
      },
    },
  })
}

const createMousePointerEvent = (
  type: string,
  x: number,
  y: number,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, {
    button: 2,
    buttons: 2,
    clientX: x,
    clientY: y,
    pointerId: 11,
    pointerType: 'mouse',
  })
  return event
}

describe('ImageCropper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('裁剪器就绪后确认会输出 File 并关闭弹窗', async () => {
    const wrapper = mountCropper()
    await flushPromises()

    expect(wrapper.find('[data-test="cropper"]').exists()).toBe(true)
    await wrapper.get('[data-test="confirm"]').trigger('click')
    await flushPromises()

    const output = wrapper.emitted('confirm')?.[0]?.[0] as File
    expect(output).toBeInstanceOf(File)
    expect(output.name).toBe('main_photo.jpg')
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })

  it('修改后取消会先确认放弃再关闭', async () => {
    const wrapper = mountCropper()
    await flushPromises()

    await wrapper.get('[data-test="rotate"]').trigger('click')
    await wrapper.get('[data-test="cancel"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
  })

  it('鼠标右键拖动画布会移动图片且左键模式仍保持裁剪', async () => {
    const wrapper = mountCropper()
    await flushPromises()
    const surface = wrapper.get('.cropper-wrapper').element as HTMLElement
    Object.assign(surface, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
    })

    surface.dispatchEvent(createMousePointerEvent('pointerdown', 100, 100))
    surface.dispatchEvent(createMousePointerEvent('pointermove', 126, 88))
    surface.dispatchEvent(createMousePointerEvent('pointerup', 126, 88))
    await flushPromises()

    expect(moveCropper).toHaveBeenCalledWith(expect.anything(), 26, -12)
  })

  it('输出预览固定在参数滚动区之前', async () => {
    const wrapper = mountCropper()
    await flushPromises()
    const inspector = wrapper.get('.image-editor-inspector').element
    const children = Array.from(inspector.children)

    expect(children[0]?.classList.contains('image-editor-inspector__preview')).toBe(true)
    expect(children[1]?.classList.contains('image-editor-inspector__scroll')).toBe(true)
  })
})
