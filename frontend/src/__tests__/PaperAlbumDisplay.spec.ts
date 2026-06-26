import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { nextTick } from 'vue'
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
    vi.useRealTimers()
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width') ? false : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a paged double-page paper album and flips to later pockets after the page turn animation', async () => {
    vi.useFakeTimers()
    const wrapper = mountAlbum()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 2')
    expect(wrapper.find('[data-id="showcase-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-id="showcase-9"]').exists()).toBe(false)

    await wrapper.get('[data-test="paper-next-page"]').trigger('click')
    await nextTick()

    expect(wrapper.get('.paper-album').classes()).toContain('is-page-turning')
    expect(wrapper.get('.paper-album').classes()).toContain('is-turning-next')
    expect(wrapper.find('.paper-turn-layer').exists()).toBe(true)
    expect(wrapper.find('[data-id="showcase-9"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 2')

    await vi.advanceTimersByTimeAsync(520)
    await nextTick()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('2 / 2')
    expect(wrapper.find('[data-id="showcase-9"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="paper-next-page"]').attributes('disabled')).toBeDefined()
  })

  it('locks page turns during the animation and supports turning back afterward', async () => {
    vi.useFakeTimers()
    const wrapper = mountAlbum(Array.from({ length: 18 }, (_, i) => makeItem(i + 1)))

    await wrapper.get('[data-test="paper-next-page"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-test="paper-next-page"]').trigger('click')
    await nextTick()

    expect(wrapper.get('.paper-album').classes()).toContain('is-page-turning')
    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 3')

    await vi.advanceTimersByTimeAsync(520)
    await nextTick()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('2 / 3')
    expect(wrapper.find('[data-id="showcase-17"]').exists()).toBe(false)

    await wrapper.get('[data-test="paper-prev-page"]').trigger('click')
    await nextTick()

    expect(wrapper.get('.paper-album').classes()).toContain('is-turning-prev')
    expect(wrapper.find('.paper-turn-layer').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(520)
    await nextTick()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 3')
    expect(wrapper.find('[data-id="showcase-1"]').exists()).toBe(true)
  })

  it('keeps the non-turning page stable while preloading the revealed base page during turns', async () => {
    vi.useFakeTimers()
    const wrapper = mountAlbum(Array.from({ length: 18 }, (_, i) => makeItem(i + 1)))

    await wrapper.get('[data-test="paper-next-page"]').trigger('click')
    await nextTick()

    const baseLeftPage = wrapper.get('.paper-book > .paper-page:first-child')
    const baseRightPageDuringNext = wrapper.get('.paper-book > .paper-page:nth-child(2)')
    expect(baseLeftPage.find('[data-id="showcase-1"]').exists()).toBe(true)
    expect(baseLeftPage.find('[data-id="showcase-9"]').exists()).toBe(false)
    expect(baseRightPageDuringNext.find('[data-id="showcase-13"]').exists()).toBe(true)
    expect(baseRightPageDuringNext.find('[data-id="showcase-5"]').exists()).toBe(false)
    expect(wrapper.find('.paper-turn-layer [data-id="showcase-5"]').exists()).toBe(true)
    expect(wrapper.find('.paper-turn-layer [data-id="showcase-9"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(520)
    await nextTick()

    await wrapper.get('[data-test="paper-prev-page"]').trigger('click')
    await nextTick()

    const baseLeftPageDuringPrev = wrapper.get('.paper-book > .paper-page:first-child')
    const baseRightPage = wrapper.get('.paper-book > .paper-page:nth-child(2)')
    expect(baseLeftPageDuringPrev.find('[data-id="showcase-1"]').exists()).toBe(true)
    expect(baseLeftPageDuringPrev.find('[data-id="showcase-9"]').exists()).toBe(false)
    expect(baseRightPage.find('[data-id="showcase-13"]').exists()).toBe(true)
    expect(baseRightPage.find('[data-id="showcase-5"]').exists()).toBe(false)
    expect(wrapper.find('.paper-turn-layer [data-id="showcase-9"]').exists()).toBe(true)
    expect(wrapper.find('.paper-turn-layer [data-id="showcase-5"]').exists()).toBe(true)
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
    expect(source).toContain('perspective:')
    expect(source).toContain('transform-style: preserve-3d;')
    expect(source).toContain('rotateY')
    expect(source).toContain('backface-visibility: hidden;')
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
    expect(source).toContain('.paper-turn-shadow')
    expect(source).toContain('will-change: transform;')
    expect(source).toMatch(/\.paper-book::before\s*\{[\s\S]*top:\s*var\(--paper-book-padding\)/)
    expect(source).toMatch(/\.paper-book::before\s*\{[\s\S]*bottom:\s*var\(--paper-book-padding\)/)
    expect(source).toMatch(/@keyframes paper-turn-next\s*\{[\s\S]*transform: rotateY\(-180deg\);[\s\S]*\}/)
    expect(source).toMatch(/@keyframes paper-turn-prev\s*\{[\s\S]*transform: rotateY\(180deg\);[\s\S]*\}/)
    expect(source).not.toMatch(/@keyframes paper-turn-next\s*\{[\s\S]*box-shadow:/)
    expect(source).not.toMatch(/@keyframes paper-turn-prev\s*\{[\s\S]*box-shadow:/)
    expect(source).not.toContain('max-width: 850px;')
    expect(source).not.toContain('width: min(124px, 100%);')
    expect(paperBookBlock).not.toContain('transparent calc(50% - 1px)')
  })
})
