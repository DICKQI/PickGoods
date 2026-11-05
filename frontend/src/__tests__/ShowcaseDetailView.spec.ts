import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ShowcaseDetailView from '@/components/showcase/ShowcaseDetailView.vue'
import type { GoodsListItem, Showcase, ShowcaseGoods } from '@/api/types'

const showcaseManagerSource = readFileSync(resolve(process.cwd(), 'src/components/ShowcaseManager.vue'), 'utf8')
const showcaseDetailSource = readFileSync(resolve(process.cwd(), 'src/components/showcase/ShowcaseDetailView.vue'), 'utf8')
const mobileFullscreenSource = readFileSync(resolve(process.cwd(), 'src/components/showcase/ShowcaseMobileFullscreenDisplay.vue'), 'utf8')
const paperAlbumSource = readFileSync(resolve(process.cwd(), 'src/components/showcase/PaperAlbumDisplay.vue'), 'utf8')
const roundBadgeStyleSource = readFileSync(resolve(process.cwd(), 'src/styles/roundBadge.css'), 'utf8')
const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8')

const makeGoods = (overrides: Partial<GoodsListItem> = {}): GoodsListItem => ({
  id: overrides.id || 'goods-1',
  name: overrides.name || '测试谷子',
  ip: { id: 1, name: '测试 IP' },
  characters: [{ id: 1, name: '测试角色', ip: { id: 1, name: '测试 IP' }, gender: 'other' }],
  category: {
    id: 1,
    name: '吧唧',
    parent: null,
    path_name: '吧唧/58mm',
    shape_type: 'round',
    color_tag: '#D4AF37',
    order: 1,
    ...overrides.category,
  },
  location_path: '卧室/A柜',
  main_photo: null,
  status: 'in_cabinet',
  quantity: 1,
  is_official: true,
  ...overrides,
})

const makeShowcaseGoods = (
  id: string,
  goodsOverrides: Partial<GoodsListItem> = {},
): ShowcaseGoods => ({
  id: `showcase-goods-${id}`,
  goods: makeGoods({ id: `goods-${id}`, ...goodsOverrides }),
  category: null,
  order: Number(id),
})

const showcase: Showcase = {
  id: 'showcase-1',
  name: '流光痛柜',
  description: '把最喜欢的吧唧放在第一眼能看到的位置。',
  cover_image: 'https://example.com/cover.jpg',
  is_public: false,
  showcase_goods: [],
}

const setMobileViewport = () => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('max-width: 768px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const stubDesktopTiltMedia = () => {
  const matches: Record<string, boolean> = {
    '(hover: hover) and (pointer: fine)': true,
    '(min-width: 769px)': true,
    '(prefers-reduced-motion: reduce)': false,
  }
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matches[query] ?? false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const stubRect = (el: HTMLElement) => {
  el.getBoundingClientRect = () =>
    ({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
      right: 300,
      bottom: 150,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    }) as DOMRect
}

const dispatchPointer = async (
  target: HTMLElement,
  type: string,
  init: { pointerType?: string; clientX?: number; clientY?: number } = {},
) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerType: { value: init.pointerType ?? 'mouse' },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
  })
  target.dispatchEvent(event)
  await nextTick()
}

const flushFrames = async () => {
  if (typeof window.requestAnimationFrame === 'function') {
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
  }
}

const readNumber = (el: HTMLElement, variable: string, fallback = Number.NaN) => {
  const raw = el.style.getPropertyValue(variable)
  if (!raw) return fallback
  return Number.parseFloat(raw)
}

const mountDetail = (props: Partial<InstanceType<typeof ShowcaseDetailView>['$props']> = {}) => {
  setActivePinia(createPinia())

  return mount(ShowcaseDetailView, {
    props: {
      loading: false,
      showcase,
      goods: [
        makeShowcaseGoods('1'),
        makeShowcaseGoods('2', {
          category: {
            id: 2,
            name: '亚克力立牌',
            parent: null,
            path_name: '亚克力/立牌',
            shape_type: 'rectangle',
            color_tag: '#A29BFE',
            order: 2,
          },
        }),
      ],
      readonly: false,
      ...props,
    },
    global: {
      stubs: {
        GoodsCard: {
          props: ['goods', 'enableWatermark'],
          template: '<article class="goods-card-stub" :data-watermark="enableWatermark">{{ goods.name }}</article>',
        },
        WatermarkImage: {
          props: ['src', 'alt'],
          template: '<img class="watermark-image-stub" :src="src" :alt="alt" />',
        },
        'el-button': {
          emits: ['click'],
          template: '<button :class="$attrs.class" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        'el-dropdown': {
          template: '<div class="el-dropdown-stub"><slot /><slot name="dropdown" /></div>',
        },
        'el-dropdown-menu': {
          template: '<div class="el-dropdown-menu-stub"><slot /></div>',
        },
        'el-dropdown-item': {
          emits: ['click'],
          template: '<button class="el-dropdown-item-stub" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        'el-empty': {
          props: ['description'],
          template: '<div class="el-empty-stub">{{ description }}<slot /></div>',
        },
        'el-icon': { template: '<i><slot /></i>' },
        'el-image': {
          props: ['src', 'alt'],
          template: '<img class="el-image-stub" :src="src" :alt="alt" />',
        },
        'el-image-viewer': {
          props: ['urlList'],
          emits: ['close'],
          template: '<div data-test="fullscreen-main-photo-viewer" :data-url-list="urlList.join(\'|\')"><button data-test="fullscreen-main-photo-close" @click="$emit(\'close\')" /></div>',
        },
        'el-skeleton': { template: '<div class="skeleton-stub" />' },
        'el-tag': { template: '<span class="el-tag-stub"><slot /></span>' },
        Teleport: true,
      },
    },
  })
}

describe('ShowcaseDetailView 沉浸式详情', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '(max-width: 768px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  it('在私有展柜中展示沉浸式头图区、统计和关键操作', () => {
    const wrapper = mountDetail()

    expect(wrapper.get('[data-test="showcase-detail-hero"]').text()).toContain('流光痛柜')
    expect(wrapper.get('[data-test="hero-description"]').text()).toContain('把最喜欢的吧唧放在第一眼能看到的位置。')
    expect(wrapper.get('[data-test="hero-visibility"]').text()).toContain('私密收藏')
    expect(wrapper.get('[data-test="hero-total-count"]').text()).toContain('2')
    expect(wrapper.get('[data-test="hero-round-count"]').text()).toContain('1')
    expect(wrapper.get('[data-test="hero-other-count"]').text()).toContain('1')
    expect(wrapper.find('[data-test="add-goods-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="edit-showcase-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="delete-showcase-action"]').exists()).toBe(true)
  })

  it('点击详情页编辑入口时向外抛出 editShowcase 事件', async () => {
    const wrapper = mountDetail()

    await wrapper.get('[data-test="edit-showcase-button"]').trigger('click')

    expect(wrapper.emitted('editShowcase')).toHaveLength(1)
  })

  it('公共只读展柜隐藏管理操作但保留统计信息', () => {
    const wrapper = mountDetail({
      readonly: true,
      showcase: {
        ...showcase,
        is_public: true,
      },
    })

    expect(wrapper.get('[data-test="hero-visibility"]').text()).toContain('公开展示')
    expect(wrapper.get('[data-test="hero-total-count"]').text()).toContain('2')
    expect(wrapper.find('[data-test="add-goods-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="edit-showcase-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="delete-showcase-action"]').exists()).toBe(false)
    expect(wrapper.get('.goods-card-stub').attributes('data-watermark')).toBe('true')
  })

  it('空展柜显示沉浸式空状态和添加入口', () => {
    const wrapper = mountDetail({ goods: [] })

    expect(wrapper.get('[data-test="empty-showcase-panel"]').text()).toContain('这个展柜还没有摆上谷子')
    expect(wrapper.find('[data-test="empty-add-goods-button"]').exists()).toBe(true)
  })

  it('按吧唧和其他谷子拆分展示数量', () => {
    const wrapper = mountDetail()

    expect(wrapper.get('[data-test="round-section-title"]').text()).toContain('吧唧展架')
    expect(wrapper.get('[data-test="round-section-title"]').text()).toContain('1 枚')
    expect(wrapper.get('[data-test="other-section-title"]').text()).toContain('其他谷子')
    expect(wrapper.get('[data-test="other-section-title"]').text()).toContain('1 件')
  })

  it('按吧唧、纸制品和其他谷子拆分展示数量', () => {
    const wrapper = mountDetail({
      goods: [
        makeShowcaseGoods('1'),
        makeShowcaseGoods('2', {
          category: {
            id: 2,
            name: '方卡',
            parent: null,
            path_name: '纸制品/方卡',
            shape_type: 'rectangle',
            color_tag: '#8E7DFF',
            order: 2,
          },
        }),
        makeShowcaseGoods('3', {
          category: {
            id: 3,
            name: '亚克力立牌',
            parent: null,
            path_name: '亚克力/立牌',
            shape_type: 'rectangle',
            color_tag: '#A29BFE',
            order: 3,
          },
        }),
      ],
    })

    expect(wrapper.get('[data-test="hero-total-count"]').text()).toContain('3')
    expect(wrapper.get('[data-test="hero-round-count"]').text()).toContain('1')
    expect(wrapper.get('[data-test="hero-paper-count"]').text()).toContain('1')
    expect(wrapper.get('[data-test="hero-other-count"]').text()).toContain('1')
    expect(wrapper.get('[data-test="round-section-title"]').text()).toContain('ROUND BADGE SHELF')
    expect(wrapper.get('[data-test="round-section-title"]').text()).toContain('吧唧展架')
    expect(wrapper.get('[data-test="paper-section-title"]').text()).toContain('纸制品收纳册')
    expect(wrapper.get('[data-test="other-section-title"]').text()).toContain('其他谷子')
    expect(wrapper.get('[data-test="other-section-title"]').text()).toContain('1 件')
  })

  it('展柜不再显示官谷/同人角点，数量角标保留', () => {
    const wrapper = mountDetail({
      goods: [
        makeShowcaseGoods('1', { quantity: 2 }),
        makeShowcaseGoods('2', {
          category: {
            id: 2,
            name: '方卡',
            parent: null,
            path_name: '纸制品/方卡',
            shape_type: 'rectangle',
            color_tag: '#8E7DFF',
            order: 2,
          },
          quantity: 2,
        }),
      ],
    })

    expect(wrapper.find('.badge-item').exists()).toBe(true)
    expect(wrapper.find('.badge-official-dot').exists()).toBe(false)
    expect(wrapper.find('.paper-official-dot').exists()).toBe(false)
    expect(wrapper.get('.badge-qty').text()).toBe('x2')
    expect(wrapper.get('.paper-qty').text()).toBe('x2')
  })

  it('展柜组件源码不再包含官谷/同人角点样式', () => {
    for (const source of [showcaseDetailSource, paperAlbumSource, mobileFullscreenSource]) {
      expect(source).not.toContain('official-dot')
    }
  })

  it('吧唧使用分层 3D 金属结构，每枚都有镜面高光层', () => {
    const wrapper = mountDetail({
      goods: [makeShowcaseGoods('1'), makeShowcaseGoods('2')],
    })

    const items = wrapper.findAll('.badge-item')
    expect(items).toHaveLength(2)
    for (const item of items) {
      expect(item.classes()).toContain('pg-round-badge-host')
      const badge = item.get('.badge-photo')
      expect(badge.classes()).toContain('pg-round-badge')
      expect(badge.attributes('title')).toBeUndefined()
      expect(badge.find('.pg-badge-glare').attributes('aria-hidden')).toBe('true')
    }
    expect(showcaseDetailSource).toContain('class="badge-ghost pg-round-badge"')
  })

  it('吧唧 3D 样式集中定义并覆盖金属圈、弧面与降级分支', () => {
    expect(mainSource).toContain("./styles/roundBadge.css")
    for (const token of [
      'conic-gradient',
      'mix-blend-mode: screen',
      '--pg-badge-rim',
      'radial-gradient',
      '--card-tilt-x',
      '--card-glare-x',
      'prefers-reduced-motion',
    ]) {
      expect(roundBadgeStyleSource).toContain(token)
    }
  })

  it('桌面悬停时吧唧随鼠标轻微倾斜，高光跟随并在离开后复位', async () => {
    stubDesktopTiltMedia()
    const wrapper = mountDetail({ goods: [makeShowcaseGoods('1')] })
    const item = wrapper.get('.badge-item').element as HTMLElement
    stubRect(item)

    await dispatchPointer(item, 'pointerenter', { clientX: 300, clientY: 150 })
    await dispatchPointer(item, 'pointermove', { clientX: 300, clientY: 150 })
    await flushFrames()

    expect(item.classList.contains('is-tilting')).toBe(true)
    expect(readNumber(item, '--card-tilt-x')).toBeCloseTo(6, 2)
    expect(readNumber(item, '--card-tilt-y')).toBeCloseTo(-6, 2)
    expect(item.style.getPropertyValue('--card-glare-x')).toBe('100.00%')
    expect(item.style.getPropertyValue('--card-glare-y')).toBe('100.00%')

    await dispatchPointer(item, 'pointerleave')
    await flushFrames()

    expect(item.classList.contains('is-tilting')).toBe(false)
    expect(readNumber(item, '--card-tilt-x', 0)).toBe(0)
    expect(readNumber(item, '--card-tilt-y', 0)).toBe(0)
    expect(item.style.getPropertyValue('--card-glare-x')).toBe('')
  })

  it('触屏或非精细指针环境下不启用吧唧倾斜', async () => {
    const wrapper = mountDetail({ goods: [makeShowcaseGoods('1')] })
    const item = wrapper.get('.badge-item').element as HTMLElement
    stubRect(item)

    await dispatchPointer(item, 'pointerenter', { clientX: 300, clientY: 150 })
    await dispatchPointer(item, 'pointermove', { clientX: 300, clientY: 150 })
    await flushFrames()

    expect(item.classList.contains('is-tilting')).toBe(false)
    expect(item.style.getPropertyValue('--card-tilt-x')).toBe('')
    expect(item.style.getPropertyValue('--card-tilt-y')).toBe('')
  })

  it('吧唧倾斜复用 useCardTilt 且在拖拽期间关闭', () => {
    expect(showcaseDetailSource).toContain("import { useCardTilt } from '@/composables/useCardTilt'")
    expect(showcaseDetailSource).toContain('useCardTilt(tiltTarget')
    expect(showcaseDetailSource).toContain('enabled: () => !dragging.value')
    expect(showcaseDetailSource).toContain('watch(dragging')
    expect(roundBadgeStyleSource).toContain('var(--card-tilt-x')
    expect(roundBadgeStyleSource).toContain('var(--card-glare-x')
  })

  it('移动端可以将吧唧展架切到全屏大图陈列', async () => {
    setMobileViewport()
    const wrapper = mountDetail({
      goods: [
        makeShowcaseGoods('1', { main_photo: 'https://example.com/badge-1.jpg' }),
        makeShowcaseGoods('2', { main_photo: 'https://example.com/badge-2.jpg' }),
        makeShowcaseGoods('3', { main_photo: 'https://example.com/badge-3.jpg' }),
      ],
    })

    await wrapper.get('[data-test="round-fullscreen-button"]').trigger('click')
    await nextTick()

    const fullscreen = wrapper.get('[data-test="showcase-mobile-fullscreen-round"]')
    expect(fullscreen.text()).toContain('吧唧展架')
    expect(fullscreen.findAll('[data-test="fullscreen-round-item"]')).toHaveLength(3)
    expect(fullscreen.findAll('.fullscreen-round-item.pg-round-badge-host')).toHaveLength(3)
    expect(fullscreen.findAll('.round-photo.pg-round-badge')).toHaveLength(3)
    expect(fullscreen.find('.round-photo').attributes('title')).toBeUndefined()
    expect(fullscreen.findAll('.pg-badge-glare')).toHaveLength(3)
    expect(fullscreen.find('[data-test="fullscreen-density-dense"]').exists()).toBe(true)
    expect(fullscreen.find('.fullscreen-official-dot').exists()).toBe(false)

    await wrapper.get('[data-test="fullscreen-close-button"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-test="showcase-mobile-fullscreen-round"]').exists()).toBe(false)
  })

  it('移动端可以将纸制品收纳册切到全屏单页完整陈列', async () => {
    setMobileViewport()
    const wrapper = mountDetail({
      goods: [
        makeShowcaseGoods('1', {
          category: {
            id: 1,
            name: '方卡',
            parent: null,
            path_name: '纸制品/方卡',
            shape_type: 'rectangle',
            color_tag: '#8E7DFF',
            order: 1,
          },
          main_photo: 'https://example.com/paper-1.jpg',
        }),
        makeShowcaseGoods('2', {
          category: {
            id: 2,
            name: '小卡',
            parent: null,
            path_name: '纸制品/小卡',
            shape_type: 'rectangle',
            color_tag: '#8E7DFF',
            order: 2,
          },
          main_photo: 'https://example.com/paper-2.jpg',
        }),
        makeShowcaseGoods('3', {
          category: {
            id: 3,
            name: '拍立得',
            parent: null,
            path_name: '纸制品/拍立得',
            shape_type: 'rectangle',
            color_tag: '#8E7DFF',
            order: 3,
          },
          main_photo: 'https://example.com/paper-3.jpg',
        }),
        makeShowcaseGoods('4', {
          category: {
            id: 4,
            name: '色纸',
            parent: null,
            path_name: '纸制品/色纸',
            shape_type: 'rectangle',
            color_tag: '#8E7DFF',
            order: 4,
          },
          main_photo: 'https://example.com/paper-4.jpg',
        }),
        makeShowcaseGoods('5', {
          category: {
            id: 5,
            name: '明信片',
            parent: null,
            path_name: '纸制品/明信片',
            shape_type: 'rectangle',
            color_tag: '#8E7DFF',
            order: 5,
          },
          main_photo: 'https://example.com/paper-5.jpg',
        }),
      ],
    })

    await wrapper.get('[data-test="paper-fullscreen-button"]').trigger('click')
    await nextTick()

    const fullscreen = wrapper.get('[data-test="showcase-mobile-fullscreen-paper"]')
    expect(fullscreen.text()).toContain('纸制品收纳册')
    expect(fullscreen.findAll('[data-test="fullscreen-paper-item"]')).toHaveLength(5)
    expect(fullscreen.find('.pg-round-badge').exists()).toBe(false)
    expect(fullscreen.find('.fullscreen-official-dot').exists()).toBe(false)
    expect(fullscreen.find('[data-test="fullscreen-page-indicator"]').exists()).toBe(false)
    expect(fullscreen.find('[data-test="fullscreen-prev-page"]').exists()).toBe(false)
    expect(fullscreen.find('[data-test="fullscreen-next-page"]').exists()).toBe(false)
  })

  it('does not split fullscreen display backgrounds at fixed viewport percentages', () => {
    expect(mobileFullscreenSource).not.toContain('#232016 42%')
    expect(mobileFullscreenSource).not.toContain('#262447 40%')
    expect(mobileFullscreenSource).toContain('--fullscreen-body-bg')
    expect(mobileFullscreenSource).toContain('background: var(--fullscreen-body-bg);')
  })

  it('locks mobile fullscreen display order to prevent accidental drag sorting', () => {
    expect(mobileFullscreenSource).not.toContain('useShowcaseDisplayDragSort')
    expect(mobileFullscreenSource).not.toContain('@pointerdown=')
    expect(mobileFullscreenSource).not.toContain('dragGhost')
    expect(mobileFullscreenSource).not.toContain('is-drag-active')
    expect(mobileFullscreenSource).not.toContain('is-dragging')
    expect(mobileFullscreenSource).toContain("{ cursor: readonly ? 'default' : 'pointer' }")
  })

  it('animates mobile fullscreen display enter and leave transitions', () => {
    expect(showcaseDetailSource).toContain('<Transition name="mobile-fullscreen-display" appear>')
    expect(showcaseDetailSource).toContain('.mobile-fullscreen-display-enter-active')
    expect(showcaseDetailSource).toContain('.mobile-fullscreen-display-leave-active')
    expect(showcaseDetailSource).toContain('@keyframes mobile-fullscreen-display-in')
    expect(showcaseDetailSource).toContain('@keyframes mobile-fullscreen-display-out')
  })

  it('hides the native scrollbar in mobile fullscreen display', () => {
    expect(mobileFullscreenSource).toContain('scrollbar-width: none;')
    expect(mobileFullscreenSource).toContain('-ms-overflow-style: none;')
    expect(mobileFullscreenSource).toContain('.fullscreen-body::-webkit-scrollbar')
    expect(mobileFullscreenSource).toContain('display: none;')
  })

  it('全屏点击谷子时打开主图预览而不是详情抽屉', async () => {
    setMobileViewport()
    const wrapper = mountDetail({
      goods: [
        makeShowcaseGoods('1', { main_photo: 'https://example.com/badge-main.jpg' }),
      ],
    })

    await wrapper.get('[data-test="round-fullscreen-button"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-test="fullscreen-round-item"]').trigger('click')
    await nextTick()

    expect(wrapper.get('[data-test="fullscreen-main-photo-viewer"]').attributes('data-url-list')).toBe('https://example.com/badge-main.jpg')
    expect(wrapper.emitted('openGoods')).toBeUndefined()
  })

  it('公共只读展柜全屏时继续加水印并不打开详情', async () => {
    setMobileViewport()
    const wrapper = mountDetail({
      readonly: true,
      goods: [
        makeShowcaseGoods('1', { main_photo: 'https://example.com/badge-1.jpg' }),
      ],
    })

    await wrapper.get('[data-test="round-fullscreen-button"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-test="fullscreen-round-item"]').trigger('click')

    expect(wrapper.find('.watermark-image-stub').exists()).toBe(true)
    expect(wrapper.emitted('openGoods')).toBeUndefined()
  })

  it('ShowcaseManager 将详情页编辑事件接到展柜编辑弹窗', () => {
    expect(showcaseManagerSource).toContain('@edit-showcase="openEditShowcase"')
  })

  it('ShowcaseManager 详情页脱离卡片和独立滚动容器', () => {
    const detailBranch = showcaseManagerSource.match(/<!-- 详情页 -->[\s\S]*?<\/Transition>/)?.[0] || ''

    expect(detailBranch).toContain('showcase-detail-stage')
    expect(detailBranch).not.toContain('detail-card')
    expect(detailBranch).not.toContain('scroll-content')
  })
})
