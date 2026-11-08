import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import GoodsMultiDisplayDialog from '@/components/GoodsMultiDisplayDialog.vue'
import type { GoodsListItem } from '@/api/types'

const dialogSource = () => readFileSync(resolve(process.cwd(), 'src/components/GoodsMultiDisplayDialog.vue'), 'utf8')

const ElDialogStub = defineComponent({
  props: {
    modelValue: Boolean,
    showClose: Boolean,
    appendToBody: Boolean,
    destroyOnClose: Boolean,
    width: String,
    top: String,
  },
  emits: ['update:modelValue'],
  template: `
    <section v-if="modelValue" class="el-dialog-stub">
      <header><slot name="header" /></header>
      <div class="el-dialog__body"><slot /></div>
    </section>
  `,
})

const stubs = {
  'el-dialog': ElDialogStub,
  // 让 @click 通过属性透传直接挂到原生 button，避免组件事件与原生事件各触发一次
  'el-button': { template: '<button class="el-button-stub"><slot /></button>' },
  'el-empty': { props: ['description'], template: '<div class="el-empty-stub">{{ description }}</div>' },
  'el-icon': { template: '<i class="el-icon-stub"><slot /></i>' },
  'el-image': {
    props: ['src', 'alt'],
    template: '<img class="el-image-stub" :src="src" :alt="alt" /><slot name="error" />',
  },
}

const makeGoods = (id: string, overrides: Partial<GoodsListItem> = {}): GoodsListItem => ({
  id,
  name: `谷子 ${id}`,
  ip: { id: 1, name: 'Project Sekai' },
  characters: [{ id: 11, name: 'Tenma Tsukasa', ip: { id: 1, name: 'Project Sekai' }, gender: 'other' }],
  category: { id: 100, name: '纸制品', parent: null, path_name: '纸制品', order: 1 },
  location_path: '',
  main_photo: '',
  status: 'in_cabinet',
  quantity: 1,
  ...overrides,
})

const mountDialog = (goodsList: GoodsListItem[]) => mount(GoodsMultiDisplayDialog, {
  props: { modelValue: true, goodsList },
  global: { stubs },
})

const cssBlock = (source: string, selector: string) => {
  const start = source.indexOf(selector)
  expect(start).toBeGreaterThan(-1)
  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  expect(open).toBeGreaterThan(start)
  expect(close).toBeGreaterThan(open)
  return source.slice(open + 1, close)
}

const mediaBlock = (source: string, query: string) => {
  const start = source.indexOf(`@media ${query}`)
  expect(start).toBeGreaterThan(-1)
  let depth = 0
  let end = start
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    if (source[i] === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  return source.slice(start, end + 1)
}

describe('GoodsMultiDisplayDialog remove button visibility', () => {
  it('hides the remove button until the card is hovered on fine-pointer devices', () => {
    const source = dialogSource()
    const hoverBlock = mediaBlock(source, '(hover: hover) and (pointer: fine)')

    expect(hoverBlock).toContain('.display-item .remove-btn')
    expect(hoverBlock).toContain('opacity: 0;')
    expect(hoverBlock).toContain('pointer-events: none;')
    expect(hoverBlock).toContain('.display-item:hover .remove-btn')
    expect(hoverBlock).toContain('.display-item:focus-within .remove-btn')
    expect(hoverBlock).toContain('opacity: 1;')
    expect(hoverBlock).toContain('pointer-events: auto;')
  })

  it('keeps the remove button visible on touch devices without hover', () => {
    const source = dialogSource()
    const touchBlock = mediaBlock(source, '(hover: none)')

    expect(touchBlock).toContain('.display-item .remove-btn')
    expect(touchBlock).toContain('opacity: 1;')
    expect(touchBlock).toContain('pointer-events: auto;')
  })

  it('no longer ships the always-visible grid override and respects reduced motion', () => {
    const source = dialogSource()

    expect(cssBlock(source, '.display-grid--grid .remove-btn {')).not.toContain('opacity')
    expect(mediaBlock(source, '(prefers-reduced-motion: reduce)')).toMatch(/\.remove-btn\s*\{[^}]*transition:\s*none;/)
  })

  it('animates opacity so the button fades in with the rest of the card feedback', () => {
    const source = dialogSource()

    expect(cssBlock(source, '.remove-btn {')).toContain('opacity 0.16s ease')
  })
})

describe('GoodsMultiDisplayDialog interactions', () => {
  it('renders one labelled remove button per goods item', () => {
    const wrapper = mountDialog([makeGoods('a'), makeGoods('b')])
    const buttons = wrapper.findAll('.remove-btn')

    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.attributes('aria-label')).toBe('移除 谷子 a')
    expect(buttons[1]!.attributes('aria-label')).toBe('移除 谷子 b')
  })

  it('emits remove with the goods id when a remove button is clicked', async () => {
    const wrapper = mountDialog([makeGoods('a'), makeGoods('b')])

    await wrapper.findAll('.remove-btn')[1]!.trigger('click')

    expect(wrapper.emitted('remove')).toEqual([['b']])
  })

  it('emits clear and closes through the header actions', async () => {
    const wrapper = mountDialog([makeGoods('a')])

    await wrapper.get('.clear-btn').trigger('click')
    await wrapper.get('.close-btn').trigger('click')

    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('switches the grid class when the density toggle changes', async () => {
    const wrapper = mountDialog([makeGoods('a')])
    const options = wrapper.findAll('.density-option')

    expect(wrapper.get('.display-grid').classes()).toContain('display-grid--standard')

    await options[2]!.trigger('click')

    expect(wrapper.get('.display-grid').classes()).toContain('display-grid--grid')
  })

  it('shows the empty state and no remove buttons when nothing is selected', () => {
    const wrapper = mountDialog([])

    expect(wrapper.get('.el-empty-stub').text()).toContain('暂无已选谷子')
    expect(wrapper.findAll('.remove-btn')).toHaveLength(0)
  })
})
