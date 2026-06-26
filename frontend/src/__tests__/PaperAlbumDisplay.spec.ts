import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import PaperAlbumDisplay from '@/components/showcase/PaperAlbumDisplay.vue'
import type { GoodsListItem, ShowcaseGoods } from '@/api/types'

const componentSource = () => readFileSync(
  resolve(process.cwd(), 'src/components/showcase/PaperAlbumDisplay.vue'),
  'utf8',
)

const makeItem = (n: number, overrides: Partial<GoodsListItem> = {}): ShowcaseGoods => ({
  id: `showcase-${n}`,
  goods: {
    id: `goods-${n}`,
    name: `纸品 ${n}`,
    ip: { id: 1, name: '测试 IP' },
    characters: [],
    category: {
      id: n,
      name: '方卡',
      parent: null,
      path_name: '纸制品/方卡',
      shape_type: 'rectangle',
      color_tag: '#8E7DFF',
      order: n,
    },
    location_path: '卧室/A柜',
    main_photo: null,
    status: 'in_cabinet',
    quantity: 1,
    is_official: true,
    ...overrides,
  },
  category: null,
  order: n,
})

const mountAlbum = (items = Array.from({ length: 10 }, (_, i) => makeItem(i + 1)), readonly = false) => mount(PaperAlbumDisplay, {
  props: {
    items,
    showcaseId: 'showcase-1',
    readonly,
  },
  global: {
    stubs: {
      WatermarkImage: {
        props: ['src', 'alt'],
        template: '<img class="watermark-image-stub" :src="src" :alt="alt" />',
      },
      'el-button': {
        props: ['disabled'],
        emits: ['click'],
        template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
      },
      'el-icon': { template: '<i><slot /></i>' },
      'el-image': {
        props: ['src', 'alt'],
        template: '<img class="el-image-stub" :src="src" :alt="alt" />',
      },
      ArrowLeft: { template: '<span />' },
      ArrowRight: { template: '<span />' },
      Picture: { template: '<span />' },
    },
  },
})

describe('PaperAlbumDisplay', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width') ? false : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  it('renders a paged double-page paper album and flips to later pockets', async () => {
    const wrapper = mountAlbum()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 2')
    expect(wrapper.find('[data-id="showcase-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-id="showcase-9"]').exists()).toBe(false)

    await wrapper.get('[data-test="paper-next-page"]').trigger('click')

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('2 / 2')
    expect(wrapper.find('[data-id="showcase-9"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="paper-next-page"]').attributes('disabled')).toBeDefined()
  })

  it('uses watermarked images in readonly mode', () => {
    const wrapper = mountAlbum([
      makeItem(1, { main_photo: 'https://example.com/paper.jpg' }),
    ], true)

    expect(wrapper.find('.watermark-image-stub').exists()).toBe(true)
  })

  it('uses a roomy square paper image frame and keeps the book spine inside the page area', () => {
    const source = componentSource()
    const paperBookBlock = source.match(/\.paper-book\s*\{([\s\S]*?)\n\}/)?.[1] || ''

    expect(source).toMatch(/\.paper-card\s*\{[\s\S]*aspect-ratio:\s*1\s*\/\s*1/)
    expect(paperBookBlock).toContain('max-width: min(1120px, 100%);')
    expect(source).toContain('min-height: 440px;')
    expect(source).toContain('min-height: 188px;')
    expect(source).toContain('width: min(168px, 100%);')
    expect(source).toContain('width: min(128px, 100%);')
    expect(source).toMatch(/\.paper-book::before\s*\{[\s\S]*top:\s*var\(--paper-book-padding\)/)
    expect(source).toMatch(/\.paper-book::before\s*\{[\s\S]*bottom:\s*var\(--paper-book-padding\)/)
    expect(source).not.toContain('max-width: 850px;')
    expect(source).not.toContain('width: min(124px, 100%);')
    expect(paperBookBlock).not.toContain('transparent calc(50% - 1px)')
  })
})
