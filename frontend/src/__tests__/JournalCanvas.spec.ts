import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import JournalCanvas from '@/components/journal/JournalCanvas.vue'
import type { GoodsListItem, JournalPageContent } from '@/api/types'

vi.mock('vue-konva', () => ({
  VueKonva: {},
}))

const konvaMocks = vi.hoisted(() => ({
  toDataURL: vi.fn(() => 'data:image/png;base64,ZmFrZQ=='),
  destroy: vi.fn(),
  stageCtor: vi.fn(),
}))

vi.mock('konva', () => ({
  default: {
    Stage: vi.fn(function StageMock(config: unknown) {
      konvaMocks.stageCtor(config)
      return {
        add: vi.fn(),
        toDataURL: konvaMocks.toDataURL,
        destroy: konvaMocks.destroy,
      }
    }),
    Layer: vi.fn(function LayerMock() {
      return {
        add: vi.fn(),
        draw: vi.fn(),
      }
    }),
  },
}))

const emptyContent = {
  version: 2,
  layers: [],
} as JournalPageContent

const goods: GoodsListItem = {
  id: 'goods-1',
  name: 'Badge',
  ip: { id: 1, name: 'IP' },
  characters: [],
  category: { id: 1, name: 'Card', parent: null, path_name: 'Card', order: 1 },
  location_path: '',
  main_photo: '/media/goods/main/a.png',
  status: 'in_cabinet',
  quantity: 1,
  is_official: true,
}

const textLayer = (id: string, text: string, zIndex: number, x = 0, y = 0) => ({
  id,
  type: 'text',
  name: text,
  opacity: 1,
  z_index: zIndex,
  items: [{
    id: `${id}-item`,
    type: 'text',
    text,
    x,
    y,
    font_size: 24,
    fill: '#111111',
    rotation: 0,
  }],
})

let pointerPosition = { x: 0, y: 0 }
const StageStub = {
  emits: ['mousedown', 'mousemove', 'mouseup', 'mouseleave', 'touchstart', 'touchmove', 'touchend', 'click', 'tap'],
  setup(_props: unknown, { emit, slots, expose }: any) {
    expose({
      getNode: () => ({
        getPointerPosition: () => pointerPosition,
      }),
    })
    const emitPointer = (eventName: string, event: Event) => emit(eventName, { evt: event })
    return () => h('div', {
      class: 'stage-stub',
      onMousedown: (event: MouseEvent) => emitPointer('mousedown', event),
      onMousemove: (event: MouseEvent) => emitPointer('mousemove', event),
      onMouseup: (event: MouseEvent) => emitPointer('mouseup', event),
      onMouseleave: (event: MouseEvent) => emitPointer('mouseleave', event),
      onTouchstart: (event: TouchEvent) => emitPointer('touchstart', event),
      onTouchmove: (event: TouchEvent) => emitPointer('touchmove', event),
      onTouchend: (event: TouchEvent) => emitPointer('touchend', event),
    }, slots.default?.())
  },
}

const mountCanvas = (modelValue = emptyContent, extraProps: Record<string, unknown> = {}) => mount(JournalCanvas, {
  props: {
    modelValue,
    width: 1080,
    height: 1440,
    background: '#fffaf0',
    ...extraProps,
  },
  global: {
    stubs: {
      'v-stage': StageStub,
      'v-layer': { template: '<div class="layer-stub"><slot /></div>' },
      'v-group': {
        props: ['config'],
        setup(_props: unknown, { slots, expose }: any) {
          expose({
            getNode: () => ({
              clone: vi.fn(() => ({ id: 'export-page-group' })),
            }),
          })
          return () => h('div', { class: 'group-stub' }, slots.default?.())
        },
      },
      'v-rect': { template: '<div class="rect-stub" />' },
      'v-image': { template: '<div class="image-stub" />' },
      'v-line': { props: ['config'], template: '<div class="line-stub" />' },
      'v-circle': { props: ['config'], template: '<div class="circle-stub" />' },
      'v-text': { template: '<div class="text-stub" />' },
      'v-transformer': { template: '<div class="transformer-stub" />' },
      'el-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
      'el-icon': { template: '<i><slot /></i>' },
      'el-popover': { template: '<div class="popover-stub"><slot name="reference" /><slot /></div>' },
      'el-tooltip': { props: ['content'], template: '<span class="tooltip-stub" :data-content="content"><slot /></span>' },
    },
  },
})

const latestContent = (wrapper: ReturnType<typeof mountCanvas>) => {
  const events = wrapper.emitted('update:modelValue') || []
  return events[events.length - 1]?.[0] as JournalPageContent
}

const findToolButton = (wrapper: ReturnType<typeof mountCanvas>, label: string) => (
  wrapper.findAll('.tooltip-stub')
    .find(item => item.attributes('data-content') === label)
    ?.find('button')
)

describe('JournalCanvas', () => {
  beforeEach(() => {
    pointerPosition = { x: 0, y: 0 }
    konvaMocks.toDataURL.mockClear()
    konvaMocks.destroy.mockClear()
    konvaMocks.stageCtor.mockClear()
  })

  it('adds a goods sticker as one logical sticker layer containing one sticker item', async () => {
    const wrapper = mountCanvas()

    wrapper.vm.addGoodsSticker(goods)
    await wrapper.vm.$nextTick()

    const emitted = latestContent(wrapper)
    expect(emitted.version).toBe(2)
    expect(emitted.layers).toHaveLength(1)
    expect(emitted.layers[0]).toMatchObject({
      type: 'sticker',
      opacity: 1,
      z_index: 1,
      items: [
        expect.objectContaining({
          type: 'sticker',
          goods_id: 'goods-1',
          src: '/media/goods/main/a.png',
          width: 260,
          height: 260,
        }),
      ],
    })
  })

  it('renders configured page background styles as Konva pattern primitives', () => {
    const dotWrapper = mountCanvas(emptyContent, { width: 144, height: 144, backgroundStyle: 'dot' })
    expect(dotWrapper.vm.backgroundPattern.dots).toHaveLength(4)
    expect(dotWrapper.vm.backgroundPattern.lines).toHaveLength(0)

    const gridWrapper = mountCanvas(emptyContent, { width: 144, height: 144, backgroundStyle: 'grid' })
    expect(gridWrapper.vm.backgroundPattern.lines.map(line => line.points)).toEqual([
      [48, 0, 48, 144],
      [96, 0, 96, 144],
      [0, 48, 144, 48],
      [0, 96, 144, 96],
    ])

    const noteWrapper = mountCanvas(emptyContent, { width: 200, height: 144, backgroundStyle: 'note' })
    const lastLine = noteWrapper.vm.backgroundPattern.lines[noteWrapper.vm.backgroundPattern.lines.length - 1]
    expect(lastLine).toMatchObject({
      points: [24, 0, 24, 144],
    })
  })

  it('extends the visible canvas around out-of-page content but not hidden layers', () => {
    const outsideSticker = {
      id: 'sticker-outside',
      type: 'sticker',
      name: '外侧贴纸',
      opacity: 1,
      z_index: 1,
      items: [{
        id: 'sticker-outside-item',
        type: 'sticker',
        goods_id: 'goods-1',
        src: '/media/goods/main/a.png',
        x: 1100,
        y: -100,
        width: 260,
        height: 260,
        rotation: 0,
      }],
    }
    const wrapper = mountCanvas({ version: 2, layers: [outsideSticker] } as JournalPageContent)

    expect(wrapper.vm.canvasExpanded).toBe(true)
    expect(wrapper.vm.canvasBounds).toEqual({
      x: 0,
      y: -124,
      width: 1384,
      height: 1564,
    })

    const hiddenWrapper = mountCanvas({
      version: 2,
      layers: [{ ...outsideSticker, visible: false }],
    } as JournalPageContent)
    expect(hiddenWrapper.vm.canvasExpanded).toBe(false)
    expect(hiddenWrapper.vm.canvasBounds).toEqual({
      x: 0,
      y: 0,
      width: 1080,
      height: 1440,
    })
  })

  it('groups the toolbar, adds semantic tooltips, and keeps tool status in the toolbar', async () => {
    const wrapper = mountCanvas(emptyContent)

    expect(wrapper.find('.toolbar-tools').exists()).toBe(true)
    expect(wrapper.find('.toolbar-brush').exists()).toBe(true)
    expect(wrapper.find('.toolbar-palette').exists()).toBe(true)
    expect(wrapper.findAll('.tooltip-stub').map(item => item.attributes('data-content'))).toEqual(
      expect.arrayContaining(['选择', '画笔', '橡皮', '文字', '删除图层']),
    )

    expect(wrapper.find('.canvas-status-chip').exists()).toBe(false)
    expect(wrapper.find('.toolbar-brush').text()).toContain('钢笔 · 8px')
    const eraserButton = findToolButton(wrapper, '橡皮')
    await eraserButton!.trigger('click')
    expect(wrapper.find('.toolbar-brush').text()).toContain('橡皮 · 20px')
  })

  it('uses the compact mobile canvas, centers inserted assets, and supports pinch zoom', async () => {
    const wrapper = mountCanvas(emptyContent, { mobile: true })
    expect(wrapper.find('.journal-canvas-toolbar').exists()).toBe(false)
    expect(wrapper.get('.journal-canvas-shell').classes()).toContain('is-mobile')

    wrapper.vm.addGoodsSticker(goods)
    const inserted = latestContent(wrapper).layers[0]!.items[0]
    expect(inserted).toMatchObject({
      x: (1080 - 260) / 2,
      y: (1440 - 260) / 2,
    })

    const viewport = wrapper.get('.journal-canvas-viewport').element
    const touchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'touches', { value: touches })
      return event
    }
    viewport.dispatchEvent(touchEvent('touchstart', [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }]))
    viewport.dispatchEvent(touchEvent('touchmove', [{ clientX: 80, clientY: 100 }, { clientX: 220, clientY: 100 }]))
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.zoomLevel).toBeCloseTo(1.4)

    wrapper.vm.resetViewport()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.zoomLevel).toBe(1)
  })

  it('pans the canvas when dragging the blank background with the select tool', async () => {
    const wrapper = mountCanvas(emptyContent)
    const stage = wrapper.get('.stage-stub')
    const viewport = wrapper.get('.journal-canvas-viewport')

    await stage.trigger('mousedown', { clientX: 120, clientY: 100, button: 0 })
    await stage.trigger('mousemove', { clientX: 180, clientY: 142, button: 0 })

    expect(wrapper.vm.panning).toBe(true)
    expect(wrapper.vm.canvasOffset).toEqual({ x: 72, y: 54 })
    expect(viewport.classes()).toContain('is-panning')

    await stage.trigger('mouseup', { clientX: 180, clientY: 142, button: 0 })
    expect(wrapper.vm.panning).toBe(false)
    expect(viewport.classes()).not.toContain('is-panning')
  })

  it('uses the middle mouse button to pan without drawing while a brush tool is active', async () => {
    const wrapper = mountCanvas(emptyContent)
    const stage = wrapper.get('.stage-stub')
    const brushButton = findToolButton(wrapper, '画笔')
    await brushButton!.trigger('click')

    await stage.trigger('mousedown', { button: 1, clientX: 120, clientY: 90 })
    await stage.trigger('mousemove', { button: 1, clientX: 170, clientY: 130 })

    expect(wrapper.vm.panning).toBe(true)
    expect(wrapper.vm.canvasOffset).toEqual({ x: 62, y: 52 })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await stage.trigger('mouseup', { button: 1, clientX: 170, clientY: 130 })
    expect(wrapper.vm.panning).toBe(false)
  })

  it('uses a fixed viewport stage and converts pointers through the world transform', () => {
    const wrapper = mountCanvas(emptyContent)
    wrapper.vm.canvasOffset.x = 50
    wrapper.vm.canvasOffset.y = 30
    pointerPosition = { x: 220, y: 150 }

    expect(wrapper.vm.stageConfig).toMatchObject({ width: 760, height: 520 })
    expect(wrapper.vm.getPointer()).toEqual({
      x: Math.round((220 - 50) / wrapper.vm.scale),
      y: Math.round((150 - 30) / wrapper.vm.scale),
    })
  })

  it('zooms at the Ctrl wheel cursor and leaves a normal wheel untouched', async () => {
    const wrapper = mountCanvas(emptyContent)
    const viewport = wrapper.get('.journal-canvas-viewport')
    const point = { clientX: 240, clientY: 140 }
    const worldBefore = {
      x: (point.clientX - wrapper.vm.canvasOffset.x) / wrapper.vm.scale,
      y: (point.clientY - wrapper.vm.canvasOffset.y) / wrapper.vm.scale,
    }
    const wheelEvent = new Event('wheel', { bubbles: true, cancelable: true })
    Object.assign(wheelEvent, { ...point, deltaY: -120, deltaMode: 0, ctrlKey: true, metaKey: false })

    viewport.element.dispatchEvent(wheelEvent)
    await wrapper.vm.$nextTick()

    expect(wheelEvent.defaultPrevented).toBe(true)
    expect(wrapper.vm.zoomLevel).toBeGreaterThan(1)
    expect((point.clientX - wrapper.vm.canvasOffset.x) / wrapper.vm.scale).toBeCloseTo(worldBefore.x, 5)
    expect((point.clientY - wrapper.vm.canvasOffset.y) / wrapper.vm.scale).toBeCloseTo(worldBefore.y, 5)

    const zoomAfterCtrlWheel = wrapper.vm.zoomLevel
    const normalWheel = new Event('wheel', { bubbles: true, cancelable: true })
    Object.assign(normalWheel, { ...point, deltaY: -120, deltaMode: 0, ctrlKey: false, metaKey: false })
    viewport.element.dispatchEvent(normalWheel)
    await wrapper.vm.$nextTick()

    expect(normalWheel.defaultPrevented).toBe(false)
    expect(wrapper.vm.zoomLevel).toBe(zoomAfterCtrlWheel)
  })

  it('clamps zoom buttons and wheel zoom to the supported range', () => {
    const wrapper = mountCanvas(emptyContent)

    wrapper.vm.setZoom(100)
    expect(wrapper.vm.zoomLevel).toBe(3)

    wrapper.vm.setZoom(0.001)
    expect(wrapper.vm.zoomLevel).toBe(0.2)
  })

  it('auto-pans while a layer drag reaches the viewport edge', () => {
    const wrapper = mountCanvas(emptyContent)
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(77)
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const startOffset = wrapper.vm.canvasOffset.x
    pointerPosition = { x: 2, y: 220 }

    wrapper.vm.handleLayerDragMove()

    expect(wrapper.vm.canvasOffset.x).toBeLessThan(startOffset)
    expect(frame).toHaveBeenCalledTimes(1)

    wrapper.vm.handlePointerEnd()
    expect(cancel).toHaveBeenCalledWith(77)
    frame.mockRestore()
    cancel.mockRestore()
  })

  it('adds text layers and drawing strokes without mutating the original content object', () => {
    const wrapper = mountCanvas(emptyContent)

    wrapper.vm.addTextLayer('today')
    wrapper.vm.addDrawLayer([1, 2, 3, 4], '#8e7dff', 8)

    const emitted = latestContent(wrapper)
    expect(emptyContent.layers).toEqual([])
    expect(emitted.layers.map(layer => layer.type)).toEqual(['text', 'draw'])
    expect(emitted.layers[1]).toMatchObject({
      type: 'draw',
      items: [expect.objectContaining({ type: 'stroke', points: [1, 2, 3, 4] })],
    })
  })

  it('appends repeated drawing strokes to one logical drawing layer', () => {
    const wrapper = mountCanvas(emptyContent)

    wrapper.vm.addDrawLayer([1, 2, 3, 4], '#8e7dff', 8)
    wrapper.vm.addDrawLayer([5, 6, 7, 8], '#D4AF37', 12)

    const emitted = latestContent(wrapper)
    expect(emitted.version).toBe(2)
    expect(emitted.layers).toHaveLength(1)
    expect(emitted.layers[0]).toMatchObject({
      type: 'draw',
      name: '画笔层 1',
      items: [
        expect.objectContaining({ type: 'stroke', points: [1, 2, 3, 4] }),
        expect.objectContaining({ type: 'stroke', points: [5, 6, 7, 8] }),
      ],
    })
  })

  it('applies brush presets and palette colors to new stroke items', () => {
    const wrapper = mountCanvas(emptyContent)

    wrapper.vm.setBrushType('watercolor')
    wrapper.vm.selectPaletteColor('#D4AF37')
    wrapper.vm.setBrushWidth(18)
    wrapper.vm.addDrawLayer([1, 2, 3, 4])

    const emitted = latestContent(wrapper)
    expect(emitted.layers[0]!.items[0]).toMatchObject({
      type: 'stroke',
      brush_type: 'watercolor',
      stroke: '#D4AF37',
      stroke_width: 18,
      opacity: 0.46,
    })
    expect(wrapper.vm.recentColors).toContain('#D4AF37')
  })

  it('does not draw into a locked drawing layer', () => {
    const wrapper = mountCanvas(emptyContent)

    wrapper.vm.addDrawLayer([1, 2, 3, 4])
    wrapper.vm.toggleSelectedLayerLock()
    wrapper.vm.addDrawLayer([5, 6, 7, 8])

    const emitted = latestContent(wrapper)
    expect(emitted.layers).toHaveLength(1)
    expect(emitted.layers[0]!.items).toHaveLength(1)
  })

  it('adds an empty brush layer that receives later strokes', () => {
    const wrapper = mountCanvas(emptyContent)

    wrapper.vm.addBrushLayer()
    let emitted = latestContent(wrapper)

    expect(emitted.layers).toHaveLength(1)
    expect(emitted.layers[0]).toMatchObject({
      type: 'draw',
      name: '画笔层 1',
      items: [],
    })
    expect(wrapper.vm.selectedLayer?.id).toBe(emitted.layers[0]!.id)

    wrapper.vm.addDrawLayer([1, 2, 3, 4], '#8e7dff', 8)
    emitted = latestContent(wrapper)
    expect(emitted.layers).toHaveLength(1)
    expect(emitted.layers[0]!.items).toHaveLength(1)
  })

  it('undoes and redoes logical layer edits', () => {
    const wrapper = mountCanvas(emptyContent)

    wrapper.vm.addTextLayer('first')
    wrapper.vm.addTextLayer('second')
    expect(wrapper.vm.layers).toHaveLength(2)

    wrapper.vm.undo()
    expect(wrapper.vm.layers).toHaveLength(1)
    expect(wrapper.vm.canRedo).toBe(true)

    wrapper.vm.redo()
    expect(wrapper.vm.layers).toHaveLength(2)
  })

  it('copies, renames, locks, hides, and aligns selected logical layers', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [
        textLayer('text-1', 'A', 1, 120, 80),
        textLayer('text-2', 'B', 2, 420, 180),
      ],
    } as unknown as JournalPageContent)

    wrapper.vm.selectLayer('text-1')
    wrapper.vm.renameSelectedLayer('Title')
    wrapper.vm.toggleSelectedLayerLock()
    wrapper.vm.toggleSelectedLayerVisibility()
    wrapper.vm.duplicateSelectedLayer()

    let emitted = latestContent(wrapper)
    expect(emitted.layers.find(layer => layer.id === 'text-1')).toMatchObject({
      name: 'Title',
      locked: true,
      visible: false,
    })
    expect(emitted.layers).toHaveLength(3)
    expect(emitted.layers.find(layer => layer.name === 'Title 副本')!.items[0]!.id).not.toBe('text-1-item')

    wrapper.vm.selectLayer('text-2')
    wrapper.vm.alignSelectedLayer('center')
    emitted = latestContent(wrapper)
    const aligned = emitted.layers.find(layer => layer.id === 'text-2')
    expect(aligned?.items[0] && 'x' in aligned.items[0] ? aligned.items[0].x : undefined).toBe(528)
  })

  it('copies and pastes selected layers with keyboard shortcuts', async () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [textLayer('text-1', 'A', 1, 10, 20)],
    } as unknown as JournalPageContent)

    wrapper.vm.selectLayer('text-1')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }))
    await wrapper.vm.$nextTick()

    let emitted = latestContent(wrapper)
    expect(emitted.layers).toHaveLength(2)
    expect(emitted.layers[1]!.items[0]).toMatchObject({ x: 34, y: 44 })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }))
    await wrapper.vm.$nextTick()
    emitted = latestContent(wrapper)
    expect(emitted.layers).toHaveLength(3)
  })

  it('updates selected sticker item properties through the exposed layer API', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [{
        id: 'sticker-1',
        type: 'sticker',
        name: 'Sticker',
        opacity: 1,
        z_index: 1,
        items: [{
          id: 'sticker-1-item',
          type: 'sticker',
          goods_id: 'goods-1',
          src: '/media/goods/main/a.png',
          x: 10,
          y: 20,
          width: 120,
          height: 130,
          rotation: 0,
        }],
      }],
    } as JournalPageContent)

    wrapper.vm.selectLayer('sticker-1')
    wrapper.vm.updateSelectedLayer({
      opacity: 0.4,
      rotation: 18,
      width: 240,
      height: 260,
    })

    const emitted = latestContent(wrapper)
    expect(emitted.layers[0]).toMatchObject({ id: 'sticker-1', opacity: 0.4 })
    expect(emitted.layers[0]!.items[0]).toMatchObject({ rotation: 18, width: 240, height: 260 })
    expect(wrapper.vm.selectedLayer?.id).toBe('sticker-1')
  })

  it('reorders selected logical layers by z-index', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [
        textLayer('bottom', 'bottom', 1),
        textLayer('middle', 'middle', 2),
        textLayer('top', 'top', 3),
      ],
    } as unknown as JournalPageContent)

    wrapper.vm.selectLayer('middle')
    wrapper.vm.moveSelectedLayer('top')

    let emitted = latestContent(wrapper)
    expect(emitted.layers.find(layer => layer.id === 'middle')?.z_index).toBe(3)
    expect(emitted.layers.find(layer => layer.id === 'top')?.z_index).toBe(2)

    wrapper.vm.moveSelectedLayer('bottom')
    emitted = latestContent(wrapper)
    expect(emitted.layers.find(layer => layer.id === 'middle')?.z_index).toBe(1)
    expect(emitted.layers.find(layer => layer.id === 'bottom')?.z_index).toBe(2)
  })

  it('migrates v1 flat content into v2 logical layers for editing', () => {
    const wrapper = mountCanvas({
      version: 1,
      layers: [
        { id: 'draw-old-1', type: 'draw', brush_type: 'pen', points: [1, 2], stroke: '#111111', stroke_width: 4, opacity: 1, z_index: 1 },
        { id: 'draw-old-2', type: 'draw', brush_type: 'pencil', points: [3, 4], stroke: '#222222', stroke_width: 6, opacity: 0.7, z_index: 2 },
        { id: 'text-old', type: 'text', text: 'old', x: 10, y: 20, font_size: 32, fill: '#333333', rotation: 0, z_index: 3 },
      ],
    } as unknown as JournalPageContent)

    expect(wrapper.vm.layers).toHaveLength(2)
    expect(wrapper.vm.layers[1]).toMatchObject({
      type: 'draw',
      name: '导入画笔层',
      items: [
        expect.objectContaining({ id: 'draw-old-1-stroke', type: 'stroke' }),
        expect.objectContaining({ id: 'draw-old-2-stroke', type: 'stroke' }),
      ],
    })
  })

  it('multi-selects movable layers and nudges them with keyboard-sized steps', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [
        textLayer('text-1', 'A', 1, 10, 20),
        textLayer('text-2', 'B', 2, 30, 40),
      ],
    } as unknown as JournalPageContent)

    wrapper.vm.selectLayer('text-1')
    wrapper.vm.selectLayer('text-2', true)
    wrapper.vm.nudgeSelectedLayers(10, 0)

    const emitted = latestContent(wrapper)
    const first = emitted.layers.find(layer => layer.id === 'text-1')!.items[0]
    const second = emitted.layers.find(layer => layer.id === 'text-2')!.items[0]
    expect(wrapper.vm.selectedLayerIds).toEqual(['text-1', 'text-2'])
    expect(first).toMatchObject({ x: 20, y: 20 })
    expect(second).toMatchObject({ x: 40, y: 40 })
  })

  it('does not nudge locked or hidden selected layers', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [
        { ...textLayer('locked', 'A', 1, 10, 20), locked: true },
        { ...textLayer('hidden', 'B', 2, 30, 40), visible: false },
      ],
    } as unknown as JournalPageContent)

    wrapper.vm.selectLayer('locked')
    wrapper.vm.selectLayer('hidden', true)
    wrapper.vm.nudgeSelectedLayers(10, 10)

    const emitted = latestContent(wrapper)
    expect(emitted.layers.find(layer => layer.id === 'locked')!.items[0]).toMatchObject({ x: 10, y: 20 })
    expect(emitted.layers.find(layer => layer.id === 'hidden')!.items[0]).toMatchObject({ x: 30, y: 40 })
  })

  it('aligns and distributes multiple selected layers', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [
        textLayer('left', 'A', 1, 10, 20),
        textLayer('middle', 'B', 2, 120, 40),
        textLayer('right', 'C', 3, 310, 60),
      ],
    } as unknown as JournalPageContent)

    wrapper.vm.selectLayer('left')
    wrapper.vm.selectLayer('middle', true)
    wrapper.vm.selectLayer('right', true)
    wrapper.vm.alignSelectedLayers('top')
    wrapper.vm.distributeSelectedLayers('horizontal')

    const emitted = latestContent(wrapper)
    const positions = emitted.layers
      .sort((a, b) => a.z_index - b.z_index)
      .map(layer => layer.items[0])
    expect(positions.map(item => item && 'y' in item ? item.y : null)).toEqual([20, 20, 20])
    expect(positions.map(item => item && 'x' in item ? item.x : null)).toEqual([10, 160, 310])
  })

  it('computes snap guides against canvas center and sibling layer edges', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [
        textLayer('moving', 'A', 1, 536, 100),
        textLayer('sibling', 'B', 2, 200, 300),
      ],
    } as unknown as JournalPageContent)

    const snap = wrapper.vm.getSnapPosition('moving', { x: 536, y: 298 })

    expect(snap.x).toBe(540)
    expect(snap.y).toBe(300)
    expect(snap.guides.length).toBeGreaterThan(0)
  })

  it('erases a hit stroke item without deleting the draw layer', () => {
    const wrapper = mountCanvas(emptyContent)

    wrapper.vm.addDrawLayer([6, 6, 10, 10], '#8e7dff', 8)
    wrapper.vm.addDrawLayer([100, 100, 110, 110], '#8e7dff', 8)
    wrapper.vm.eraseStrokeAtPoint(10, 10)

    const emitted = latestContent(wrapper)
    expect(emitted.layers).toHaveLength(1)
    expect(emitted.layers[0]!.items).toHaveLength(1)
    expect(emitted.layers[0]!.items[0]).toMatchObject({ points: [100, 100, 110, 110] })
  })

  it('erases strokes only from the currently selected draw layer', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [
        {
          id: 'draw-1',
          type: 'draw',
          name: 'draw layer 1',
          opacity: 1,
          z_index: 1,
          items: [{
            id: 'stroke-1',
            type: 'stroke',
            brush_type: 'pen',
            points: [0, 0, 100, 0],
            stroke: '#111111',
            stroke_width: 8,
            opacity: 1,
          }],
        },
        {
          id: 'draw-2',
          type: 'draw',
          name: 'draw layer 2',
          opacity: 1,
          z_index: 2,
          items: [{
            id: 'stroke-2',
            type: 'stroke',
            brush_type: 'pen',
            points: [0, 0, 100, 0],
            stroke: '#222222',
            stroke_width: 8,
            opacity: 1,
          }],
        },
      ],
    } as unknown as JournalPageContent)

    wrapper.vm.selectLayer('draw-2')
    wrapper.vm.setEraserWidth(20)
    wrapper.vm.eraseStrokeAtPoint(50, 0)

    const emitted = latestContent(wrapper)
    expect(emitted.layers.find(layer => layer.id === 'draw-1')!.items[0]).toMatchObject({
      id: 'stroke-1',
      points: [0, 0, 100, 0],
    })
    expect(emitted.layers.find(layer => layer.id === 'draw-2')!.items.map(item => item.type === 'stroke' ? item.points : [])).toEqual([
      [0, 0, 40, 0],
      [60, 0, 100, 0],
    ])
  })

  it('erases only the touched stroke segment and keeps untouched stroke segments', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [{
        id: 'draw-1',
        type: 'draw',
        name: '画笔层 1',
        opacity: 1,
        z_index: 1,
        items: [{
          id: 'stroke-1',
          type: 'stroke',
          brush_type: 'pen',
          points: [0, 0, 25, 0, 50, 0, 75, 0, 100, 0],
          stroke: '#111111',
          stroke_width: 8,
          opacity: 1,
        }],
      }],
    } as unknown as JournalPageContent)

    wrapper.vm.setEraserWidth(12)
    wrapper.vm.selectLayer('draw-1')
    wrapper.vm.eraseStrokeAtPoint(50, 0)

    const emitted = latestContent(wrapper)
    expect(emitted.layers[0]!.items).toHaveLength(2)
    expect(emitted.layers[0]!.items.map(item => item.type === 'stroke' ? item.points : [])).toEqual([
      [0, 0, 25, 0, 44, 0],
      [56, 0, 75, 0, 100, 0],
    ])
  })

  it('clips a long sparse stroke at the eraser bounds instead of deleting the full segment', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [{
        id: 'draw-1',
        type: 'draw',
        name: 'draw layer 1',
        opacity: 1,
        z_index: 1,
        items: [{
          id: 'stroke-1',
          type: 'stroke',
          brush_type: 'pen',
          points: [0, 0, 100, 0],
          stroke: '#111111',
          stroke_width: 8,
          opacity: 1,
        }],
      }],
    } as unknown as JournalPageContent)

    wrapper.vm.setEraserWidth(20)
    wrapper.vm.selectLayer('draw-1')
    wrapper.vm.eraseStrokeAtPoint(50, 0)

    const emitted = latestContent(wrapper)
    expect(emitted.layers[0]!.items).toHaveLength(2)
    expect(emitted.layers[0]!.items.map(item => item.type === 'stroke' ? item.points : [])).toEqual([
      [0, 0, 40, 0],
      [60, 0, 100, 0],
    ])
  })

  it('does not erase on pointer move until the eraser is pressed', async () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [{
        id: 'draw-1',
        type: 'draw',
        name: '画笔层 1',
        opacity: 1,
        z_index: 1,
        items: [{
          id: 'stroke-1',
          type: 'stroke',
          brush_type: 'pen',
          points: [0, 0, 100, 0],
          stroke: '#111111',
          stroke_width: 8,
          opacity: 1,
        }],
      }],
    } as unknown as JournalPageContent)

    wrapper.vm.selectLayer('draw-1')
    const eraserButton = findToolButton(wrapper, '橡皮')
    await eraserButton!.trigger('click')
    pointerPosition = { x: 12, y: 12 }
    await wrapper.find('.stage-stub').trigger('mousemove')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.find('.stage-stub').trigger('mousedown')
    const emitted = latestContent(wrapper)
    expect(emitted.layers[0]!.items).toHaveLength(1)
    expect(emitted.layers[0]!.items[0]).toMatchObject({ points: [10, 0, 100, 0] })
  })

  it('uses the configured eraser width when checking stroke hits', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [{
        id: 'draw-1',
        type: 'draw',
        name: '画笔层 1',
        opacity: 1,
        z_index: 1,
        items: [{
          id: 'stroke-1',
          type: 'stroke',
          brush_type: 'pen',
          points: [0, 0, 100, 0],
          stroke: '#111111',
          stroke_width: 8,
          opacity: 1,
        }],
      }],
    } as unknown as JournalPageContent)

    wrapper.vm.setEraserWidth(20)
    wrapper.vm.selectLayer('draw-1')
    wrapper.vm.eraseStrokeAtPoint(50, 20)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.vm.setEraserWidth(50)
    wrapper.vm.eraseStrokeAtPoint(50, 20)
    const emitted = latestContent(wrapper)
    expect(emitted.layers[0]!.items).toHaveLength(2)
    expect(emitted.layers[0]!.items.map(item => item.type === 'stroke' ? item.points : [])).toEqual([
      [0, 0, 35, 0],
      [65, 0, 100, 0],
    ])
  })

  it('shows an eraser preview circle that follows the pointer and matches eraser width', async () => {
    const wrapper = mountCanvas(emptyContent)
    const eraserButton = findToolButton(wrapper, '橡皮')
    const autoFitScale = (760 - 24) / 1080

    pointerPosition = { x: 120, y: 80 }
    await eraserButton!.trigger('click')
    wrapper.vm.setEraserWidth(32)
    await wrapper.find('.stage-stub').trigger('mousemove')

    expect(wrapper.vm.eraserPreviewConfig).toMatchObject({
      x: Math.round((120 - 12) / autoFitScale),
      y: Math.round((80 - 12) / autoFitScale),
      radius: 16,
      visible: true,
      listening: false,
    })

    await wrapper.find('.stage-stub').trigger('mouseleave')
    expect(wrapper.vm.eraserPreviewConfig.visible).toBe(false)
  })

  it('keeps extended text style fields when updating selected layers', () => {
    const wrapper = mountCanvas({
      version: 2,
      layers: [
        textLayer('text-1', 'A', 1, 10, 20),
      ],
    } as unknown as JournalPageContent)

    wrapper.vm.selectLayer('text-1')
    wrapper.vm.updateSelectedLayer({
      font_family: 'serif',
      font_weight: '700',
      width: 320,
      line_height: 1.4,
      align: 'center',
    })

    const emitted = latestContent(wrapper)
    expect(emitted.layers[0]!.items[0]).toMatchObject({
      font_family: 'serif',
      font_weight: '700',
      width: 320,
      line_height: 1.4,
      align: 'center',
    })
  })

  it('exports with a chosen pixel ratio while hiding helper overlays', async () => {
    global.fetch = vi.fn(async () => ({
      blob: async () => new Blob(['fake'], { type: 'image/png' }),
    })) as unknown as typeof fetch
    const wrapper = mountCanvas(emptyContent)
    wrapper.vm.setEraserWidth(32)
    wrapper.vm.panCanvas(240, -180)
    wrapper.vm.setZoom(2.5)

    await wrapper.vm.exportPngBlob(3)

    expect(konvaMocks.stageCtor).toHaveBeenCalledWith(expect.objectContaining({
      width: 1080,
      height: 1440,
    }))
    expect(konvaMocks.toDataURL).toHaveBeenCalledWith({ pixelRatio: 3 })
    expect(konvaMocks.destroy).toHaveBeenCalled()
    expect(wrapper.vm.exporting).toBe(false)
  })
})
