import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import JournalCanvas from '@/components/journal/JournalCanvas.vue'
import type { GoodsListItem, JournalPageContent } from '@/api/types'

vi.mock('vue-konva', () => ({
  VueKonva: {},
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

const mountCanvas = (modelValue = emptyContent) => mount(JournalCanvas, {
  props: {
    modelValue,
    width: 1080,
    height: 1440,
    background: '#fffaf0',
  },
  global: {
    stubs: {
      'v-stage': StageStub,
      'v-layer': { template: '<div class="layer-stub"><slot /></div>' },
      'v-rect': { template: '<div class="rect-stub" />' },
      'v-image': { template: '<div class="image-stub" />' },
      'v-line': { template: '<div class="line-stub" />' },
      'v-circle': { props: ['config'], template: '<div class="circle-stub" />' },
      'v-text': { template: '<div class="text-stub" />' },
      'v-transformer': { template: '<div class="transformer-stub" />' },
      'el-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
      'el-icon': { template: '<i><slot /></i>' },
    },
  },
})

const latestContent = (wrapper: ReturnType<typeof mountCanvas>) => {
  const events = wrapper.emitted('update:modelValue') || []
  return events[events.length - 1]?.[0] as JournalPageContent
}

describe('JournalCanvas', () => {
  beforeEach(() => {
    pointerPosition = { x: 0, y: 0 }
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
    expect(aligned?.items[0] && 'x' in aligned.items[0] ? aligned.items[0].x : undefined).toBe(540)
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
    const eraserButton = wrapper.findAll('button').find(button => button.text().includes('橡皮'))
    await eraserButton!.trigger('click')
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
    const eraserButton = wrapper.findAll('button').find(button => button.text().includes('橡皮') || button.text().includes('姗＄毊'))
    const autoFitScale = 760 / 1080

    pointerPosition = { x: 120, y: 80 }
    await eraserButton!.trigger('click')
    wrapper.vm.setEraserWidth(32)
    await wrapper.find('.stage-stub').trigger('mousemove')

    expect(wrapper.vm.eraserPreviewConfig).toMatchObject({
      x: Math.round(120 / autoFitScale),
      y: Math.round(80 / autoFitScale),
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
})
