import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import JournalCanvas from '@/components/journal/JournalCanvas.vue'
import type { GoodsListItem, JournalPageContent } from '@/api/types'

vi.mock('vue-konva', () => ({
  VueKonva: {},
}))

const content: JournalPageContent = {
  version: 1,
  layers: [],
}

const goods: GoodsListItem = {
  id: 'goods-1',
  name: '喜欢的谷子',
  ip: { id: 1, name: 'IP' },
  characters: [],
  category: { id: 1, name: '小卡', parent: null, path_name: '小卡', order: 1 },
  location_path: '',
  main_photo: '/media/goods/main/a.png',
  status: 'in_cabinet',
  quantity: 1,
  is_official: true,
}

const mountCanvas = (modelValue = content) => mount(JournalCanvas, {
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

describe('JournalCanvas', () => {
  it('adds a goods sticker layer through the exposed API', async () => {
    const wrapper = mountCanvas()

    wrapper.vm.addGoodsSticker(goods)
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('update:modelValue') || []
    const emitted = events[events.length - 1]?.[0] as JournalPageContent
    expect(emitted.layers).toHaveLength(1)
    expect(emitted.layers[0]).toMatchObject({
      type: 'sticker',
      goods_id: 'goods-1',
      src: '/media/goods/main/a.png',
      width: 260,
      height: 260,
      z_index: 1,
    })
  })

  it('adds text and drawing layers without mutating the original content object', () => {
    const wrapper = mountCanvas(content)

    wrapper.vm.addTextLayer('今天也很喜欢')
    wrapper.vm.addDrawLayer([1, 2, 3, 4], '#8e7dff', 8)

    const events = wrapper.emitted('update:modelValue') || []
    const emitted = events[events.length - 1]?.[0] as JournalPageContent
    expect(content.layers).toEqual([])
    expect(emitted.layers.map(layer => layer.type)).toEqual(['text', 'draw'])
  })

  it('updates the selected layer properties through the exposed API', () => {
    const wrapper = mountCanvas({
      version: 1,
      layers: [
        {
          id: 'sticker-1',
          type: 'sticker',
          goods_id: 'goods-1',
          src: '/media/goods/main/a.png',
          x: 10,
          y: 20,
          width: 120,
          height: 130,
          rotation: 0,
          opacity: 1,
          z_index: 1,
        },
      ],
    })

    wrapper.vm.selectLayer('sticker-1')
    wrapper.vm.updateSelectedLayer({
      opacity: 0.4,
      rotation: 18,
      width: 240,
      height: 260,
    })

    const events = wrapper.emitted('update:modelValue') || []
    const emitted = events[events.length - 1]?.[0] as JournalPageContent
    expect(emitted.layers[0]).toMatchObject({
      id: 'sticker-1',
      opacity: 0.4,
      rotation: 18,
      width: 240,
      height: 260,
    })
    expect(wrapper.vm.selectedLayer?.id).toBe('sticker-1')
  })

  it('reorders selected layers by z-index', () => {
    const wrapper = mountCanvas({
      version: 1,
      layers: [
        { id: 'bottom', type: 'text', text: 'bottom', x: 0, y: 0, font_size: 24, fill: '#111111', rotation: 0, z_index: 1 },
        { id: 'middle', type: 'text', text: 'middle', x: 0, y: 0, font_size: 24, fill: '#111111', rotation: 0, z_index: 2 },
        { id: 'top', type: 'text', text: 'top', x: 0, y: 0, font_size: 24, fill: '#111111', rotation: 0, z_index: 3 },
      ],
    })

    wrapper.vm.selectLayer('middle')
    wrapper.vm.moveSelectedLayer('top')

    let events = wrapper.emitted('update:modelValue') || []
    let emitted = events[events.length - 1]?.[0] as JournalPageContent
    expect(emitted.layers.find(layer => layer.id === 'middle')?.z_index).toBe(3)
    expect(emitted.layers.find(layer => layer.id === 'top')?.z_index).toBe(2)

    wrapper.vm.moveSelectedLayer('bottom')
    events = wrapper.emitted('update:modelValue') || []
    emitted = events[events.length - 1]?.[0] as JournalPageContent
    expect(emitted.layers.find(layer => layer.id === 'middle')?.z_index).toBe(1)
    expect(emitted.layers.find(layer => layer.id === 'bottom')?.z_index).toBe(2)
  })
})
