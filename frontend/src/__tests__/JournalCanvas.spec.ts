import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
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

const mountCanvas = (modelValue = emptyContent) => mount(JournalCanvas, {
  props: {
    modelValue,
    width: 1080,
    height: 1440,
    background: '#fffaf0',
  },
  global: {
    stubs: {
      'v-stage': { template: '<div class="stage-stub"><slot /></div>' },
      'v-layer': { template: '<div class="layer-stub"><slot /></div>' },
      'v-rect': { template: '<div class="rect-stub" />' },
      'v-image': { template: '<div class="image-stub" />' },
      'v-line': { template: '<div class="line-stub" />' },
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
})
