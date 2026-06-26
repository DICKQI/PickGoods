import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShowcaseDetailView from '@/components/showcase/ShowcaseDetailView.vue'
import type { GoodsListItem, Showcase, ShowcaseGoods } from '@/api/types'

const showcaseManagerSource = readFileSync(resolve(process.cwd(), 'src/components/ShowcaseManager.vue'), 'utf8')

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
