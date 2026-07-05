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

const mockMobileViewport = () => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

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

  it('renders six pockets per desktop page and flips to later pockets after the page turn animation', async () => {
    vi.useFakeTimers()
    const wrapper = mountAlbum(Array.from({ length: 13 }, (_, i) => makeItem(i + 1)))

    expect(wrapper.get('[data-test="paper-section-title"]').text()).toContain('PAPER ARCHIVE ALBUM')
    expect(wrapper.get('[data-test="paper-section-title"]').text()).toContain('纸制品收纳册')
    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 2')
    expect(wrapper.get('.paper-book > .paper-page:first-child').findAll('.paper-pocket')).toHaveLength(6)
    expect(wrapper.get('.paper-book > .paper-page:nth-child(2)').findAll('.paper-pocket')).toHaveLength(6)
    expect(wrapper.find('[data-id="showcase-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-id="showcase-12"]').exists()).toBe(true)
    expect(wrapper.find('[data-id="showcase-13"]').exists()).toBe(false)

    await wrapper.get('[data-test="paper-next-page"]').trigger('click')
    await nextTick()

    expect(wrapper.get('.paper-album').classes()).toContain('is-page-turning')
    expect(wrapper.get('.paper-album').classes()).toContain('is-turning-next')
    expect(wrapper.find('.paper-turn-layer').exists()).toBe(true)
    expect(wrapper.find('[data-id="showcase-13"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 2')

    await vi.advanceTimersByTimeAsync(620)
    await nextTick()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('2 / 2')
    expect(wrapper.find('[data-id="showcase-13"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="paper-next-page"]').attributes('disabled')).toBeDefined()
  })

  it('locks page turns during the animation and supports turning back afterward', async () => {
    vi.useFakeTimers()
    const wrapper = mountAlbum(Array.from({ length: 30 }, (_, i) => makeItem(i + 1)))

    await wrapper.get('[data-test="paper-next-page"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-test="paper-next-page"]').trigger('click')
    await nextTick()

    expect(wrapper.get('.paper-album').classes()).toContain('is-page-turning')
    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 3')

    await vi.advanceTimersByTimeAsync(620)
    await nextTick()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('2 / 3')
    expect(wrapper.find('[data-id="showcase-25"]').exists()).toBe(false)

    await wrapper.get('[data-test="paper-prev-page"]').trigger('click')
    await nextTick()

    expect(wrapper.get('.paper-album').classes()).toContain('is-turning-prev')
    expect(wrapper.find('.paper-turn-layer').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(620)
    await nextTick()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 3')
    expect(wrapper.find('[data-id="showcase-1"]').exists()).toBe(true)
  })

  it('keeps the non-turning page stable while preloading the revealed base page during turns', async () => {
    vi.useFakeTimers()
    const wrapper = mountAlbum(Array.from({ length: 30 }, (_, i) => makeItem(i + 1)))

    await wrapper.get('[data-test="paper-next-page"]').trigger('click')
    await nextTick()

    const baseLeftPage = wrapper.get('.paper-book > .paper-page:first-child')
    const baseRightPageDuringNext = wrapper.get('.paper-book > .paper-page:nth-child(2)')
    expect(baseLeftPage.find('[data-id="showcase-1"]').exists()).toBe(true)
    expect(baseLeftPage.find('[data-id="showcase-13"]').exists()).toBe(false)
    expect(baseRightPageDuringNext.find('[data-id="showcase-19"]').exists()).toBe(true)
    expect(baseRightPageDuringNext.find('[data-id="showcase-7"]').exists()).toBe(false)
    expect(wrapper.find('.paper-turn-layer [data-id="showcase-7"]').exists()).toBe(true)
    expect(wrapper.find('.paper-turn-layer [data-id="showcase-13"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(620)
    await nextTick()

    await wrapper.get('[data-test="paper-prev-page"]').trigger('click')
    await nextTick()

    const baseLeftPageDuringPrev = wrapper.get('.paper-book > .paper-page:first-child')
    const baseRightPage = wrapper.get('.paper-book > .paper-page:nth-child(2)')
    expect(baseLeftPageDuringPrev.find('[data-id="showcase-1"]').exists()).toBe(true)
    expect(baseLeftPageDuringPrev.find('[data-id="showcase-13"]').exists()).toBe(false)
    expect(baseRightPage.find('[data-id="showcase-19"]').exists()).toBe(true)
    expect(baseRightPage.find('[data-id="showcase-7"]').exists()).toBe(false)
    expect(wrapper.find('.paper-turn-layer [data-id="showcase-13"]').exists()).toBe(true)
    expect(wrapper.find('.paper-turn-layer [data-id="showcase-7"]').exists()).toBe(true)
  })

  it('uses watermarked images in readonly mode', () => {
    const wrapper = mountAlbum([
      makeItem(1, { main_photo: 'https://example.com/paper.jpg' }),
    ], true)

    expect(wrapper.find('.watermark-image-stub').exists()).toBe(true)
  })

  it('renders a compact six-slot single mobile page and flips to later paper goods', async () => {
    vi.useFakeTimers()
    mockMobileViewport()
    const wrapper = mountAlbum(Array.from({ length: 7 }, (_, i) => makeItem(i + 1)))

    expect(wrapper.findAll('.paper-book > .paper-page')).toHaveLength(1)
    expect(wrapper.get('.paper-book > .paper-page:first-child').findAll('.paper-pocket')).toHaveLength(6)
    expect(wrapper.find('[data-id="showcase-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-id="showcase-6"]').exists()).toBe(true)
    expect(wrapper.find('[data-id="showcase-7"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 2')

    await wrapper.get('[data-test="paper-next-page"]').trigger('click')
    await nextTick()

    expect(wrapper.get('.paper-album').classes()).toContain('is-page-turning')
    expect(wrapper.find('.paper-turn-layer').exists()).toBe(true)
    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 2')

    await vi.advanceTimersByTimeAsync(420)
    await nextTick()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('2 / 2')
    expect(wrapper.find('[data-id="showcase-7"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="paper-next-page"]').attributes('disabled')).toBeDefined()
  })

  it('supports horizontal swipe paging on mobile without reacting to vertical scrolls', async () => {
    vi.useFakeTimers()
    mockMobileViewport()
    const wrapper = mountAlbum(Array.from({ length: 13 }, (_, i) => makeItem(i + 1)))
    const album = wrapper.get('.paper-album')

    await album.trigger('touchstart', {
      touches: [{ clientX: 220, clientY: 160 }],
    })
    await album.trigger('touchend', {
      changedTouches: [{ clientX: 150, clientY: 166 }],
    })
    await nextTick()

    expect(wrapper.get('.paper-album').classes()).toContain('is-turning-next')

    await vi.advanceTimersByTimeAsync(420)
    await nextTick()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('2 / 3')
    expect(wrapper.find('[data-id="showcase-7"]').exists()).toBe(true)

    await album.trigger('touchstart', {
      touches: [{ clientX: 150, clientY: 120 }],
    })
    await album.trigger('touchend', {
      changedTouches: [{ clientX: 162, clientY: 210 }],
    })
    await nextTick()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('2 / 3')

    await album.trigger('touchstart', {
      touches: [{ clientX: 130, clientY: 166 }],
    })
    await album.trigger('touchend', {
      changedTouches: [{ clientX: 205, clientY: 160 }],
    })
    await nextTick()

    expect(wrapper.get('.paper-album').classes()).toContain('is-turning-prev')

    await vi.advanceTimersByTimeAsync(420)
    await nextTick()

    expect(wrapper.get('[data-test="paper-album-page-indicator"]').text()).toContain('1 / 3')
  })

  it('uses a roomy square paper image frame and keeps the book spine inside the page area', () => {
    const source = componentSource()
    const paperBookBlock = source.match(/\.paper-book\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    const paperTurnNextBlock = source.match(/@keyframes paper-turn-next\s*\{[\s\S]*?\n\}/)?.[0] || ''
    const paperTurnPrevBlock = source.match(/@keyframes paper-turn-prev\s*\{[\s\S]*?\n\}/)?.[0] || ''

    expect(source).toMatch(/\.paper-card\s*\{[\s\S]*aspect-ratio:\s*1\s*\/\s*1/)
    expect(paperBookBlock).toContain('width: 100%;')
    expect(paperBookBlock).toContain('max-width: min(1520px, 100%);')
    expect(source).toContain('min-height: var(--paper-page-min-height);')
    expect(source).toContain('min-height: var(--paper-pocket-min-height);')
    expect(source).toContain('width: min(var(--paper-card-size), 100%);')
    expect(source).toContain('width: min(100%, var(--paper-mobile-card-size));')
    expect(source).toContain('perspective:')
    expect(source).toContain('transform-style: preserve-3d;')
    expect(source).toContain('rotateY')
    expect(source).toContain('backface-visibility: hidden;')
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
    expect(source).toContain('.paper-turn-shadow')
    expect(source).toContain('will-change: transform;')
    expect(source).toContain('PAPER ARCHIVE ALBUM')
    expect(source).toMatch(/\.section-kicker\s*\{[\s\S]*font-size:\s*12px/)
    expect(source).toMatch(/\.section-kicker\s*\{[\s\S]*font-weight:\s*800/)
    expect(source).toMatch(/\.section-kicker\s*\{[\s\S]*text-transform:\s*uppercase/)
    expect(source).toMatch(/\.section-heading-copy\s*\{[\s\S]*gap:\s*4px/)
    expect(source).toMatch(/\.paper-book::before\s*\{[\s\S]*top:\s*var\(--paper-book-padding\)/)
    expect(source).toMatch(/\.paper-book::before\s*\{[\s\S]*bottom:\s*var\(--paper-book-padding\)/)
    expect(source).toMatch(/@keyframes paper-turn-next\s*\{[\s\S]*transform: rotateY\(-180deg\) scaleX\(1\);[\s\S]*\}/)
    expect(source).toMatch(/@keyframes paper-turn-prev\s*\{[\s\S]*transform: rotateY\(180deg\) scaleX\(1\);[\s\S]*\}/)
    expect(paperTurnNextBlock).not.toContain('box-shadow:')
    expect(paperTurnPrevBlock).not.toContain('box-shadow:')
    expect(source).not.toContain('max-width: 850px;')
    expect(source).not.toContain('width: min(124px, 100%);')
    expect(paperBookBlock).not.toContain('transparent calc(50% - 1px)')
  })

  it('scales the PC album stage for large screens with richer page motion affordances', () => {
    const source = componentSource()
    const paperBookBlock = source.match(/\.paper-book\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    const paperItemBlock = source.match(/\.paper-item\s*\{([\s\S]*?)\n\}/)?.[1] || ''

    expect(paperBookBlock).toContain('--paper-card-size: clamp(158px, 9.6vw, 190px);')
    expect(paperBookBlock).toContain('--paper-pocket-min-height: clamp(172px, 10.8vw, 206px);')
    expect(paperBookBlock).toContain('--paper-page-min-height: clamp(620px, 41vw, 700px);')
    expect(paperBookBlock).toContain('width: 100%;')
    expect(paperBookBlock).toContain('max-width: min(1520px, 100%);')
    expect(source).toContain('min-height: var(--paper-page-min-height);')
    expect(source).toContain('grid-template-rows: repeat(3, minmax(0, 1fr));')
    expect(source).toContain('width: min(var(--paper-card-size), 100%);')
    expect(source).not.toContain('width: var(--paper-card-size);')
    expect(paperItemBlock).toContain('will-change: transform, filter;')
    expect(source).toContain('transition: transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.26s ease;')
    expect(source).toContain('transform: translateY(-10px) scale(1.035) rotateX(1deg);')
    expect(source).toContain('filter: drop-shadow(0 18px 18px rgba(31, 38, 62, 0.18));')
    expect(source).toContain('animation-timing-function: cubic-bezier(0.16, 0.72, 0.18, 1);')
    expect(source).toMatch(/@keyframes paper-turn-next\s*\{[\s\S]*50%\s*\{[\s\S]*rotateY\(-96deg\)[\s\S]*scaleX\(0\.985\)[\s\S]*\}/)
    expect(source).toMatch(/@keyframes paper-turn-prev\s*\{[\s\S]*50%\s*\{[\s\S]*rotateY\(96deg\)[\s\S]*scaleX\(0\.985\)[\s\S]*\}/)
    expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\.paper-item\s*\{[\s\S]*transition-duration:\s*1ms;[\s\S]*filter:\s*none;[\s\S]*\}/)
  })

  it('defines a touch-first compact mobile album layout and lighter page turn motion', () => {
    const source = componentSource()
    const mobileBlock = source.match(/@media \(max-width: 768px\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''

    expect(source).toContain('--paper-mobile-card-size: min(40vw, 150px);')
    expect(source).toContain('--paper-mobile-gap: clamp(8px, 2.8vw, 12px);')
    expect(source).toContain('--paper-mobile-padding: clamp(10px, 3.2vw, 14px);')
    expect(source).toContain('grid-template-areas:')
    expect(source).toContain('"book book"')
    expect(source).toContain('"prev next"')
    expect(source).toContain('grid-area: book;')
    expect(source).toContain('grid-area: prev;')
    expect(source).toContain('grid-area: next;')
    expect(source).toContain('grid-template-rows: repeat(3, auto);')
    expect(source).toContain('width: min(100%, var(--paper-mobile-card-size));')
    expect(source).toContain('aspect-ratio: 1 / 1;')
    expect(source).toContain('animation-name: paper-mobile-turn-next;')
    expect(source).toContain('animation-name: paper-mobile-turn-prev;')
    expect(source).toMatch(/@keyframes paper-mobile-turn-next\s*\{[\s\S]*52%\s*\{[\s\S]*opacity:\s*0\.96[\s\S]*translateX\(-14%\)[\s\S]*rotateY\(-18deg\)/)
    expect(source).toMatch(/@keyframes paper-mobile-turn-prev\s*\{[\s\S]*52%\s*\{[\s\S]*opacity:\s*0\.96[\s\S]*translateX\(14%\)[\s\S]*rotateY\(18deg\)/)
    expect(mobileBlock).not.toContain('min-height: 380px;')
    expect(mobileBlock).not.toContain('grid-template-columns: 32px minmax(0, 1fr) 32px;')
    expect(source).not.toContain('top: 50%;')
    expect(source).not.toContain('transform: translateY(-50%);')
  })
})
