import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import GoodsDrawer from '@/components/GoodsDrawer.vue'
import { getGoodsList } from '@/api/goods'

const { mockFetchGoodsDetail, desktopDetail } = vi.hoisted(() => {
  const desktopDetail = {
    id: 'desktop-id',
    name: '鬼切《绀宇切芒》满赠吧唧',
    status: 'in_cabinet',
    main_photo: '/media/main.png',
    additional_photos: [
      { id: 1, image: '/media/detail-1.png', label: '背面' },
      { id: 2, image: '/media/detail-2.png', label: '包装' },
    ],
    quantity: 2,
    is_official: false,
    price: '68.00',
    purchase_date: '2026-05-31',
    notes: '店铺：December十二月 TB店\n工艺：星幻磨砂覆膜',
    location: 12,
    location_path: '卧室/A1柜/第三层',
    created_at: '2026-05-31T00:00:00Z',
    updated_at: '2026-05-31T00:00:00Z',
    ip: { id: 1, name: '阴阳师' },
    characters: [{ id: 1, name: '鬼切', gender: 'male', ip: { id: 1, name: '阴阳师' } }],
    category: {
      id: 1,
      name: '58mm吧唧',
      parent: null,
      path_name: '吧唧/58mm吧唧',
      color_tag: '#2FB8D5',
      order: 1,
    },
    theme: { id: 7, name: '绀宇切芒' },
    user: { id: 1, username: 'admin' },
  }

  return {
    desktopDetail,
    mockFetchGoodsDetail: vi.fn().mockResolvedValue(desktopDetail),
  }
})

vi.mock('@/api/goods', () => ({
  getGoodsDetail: vi.fn().mockResolvedValue(null),
  getGoodsList: vi.fn().mockResolvedValue({ results: [] }),
}))

vi.mock('@/stores/guzi', () => ({
  useGuziStore: () => ({
    fetchGoodsDetail: mockFetchGoodsDetail,
  }),
}))

const setDesktopViewport = () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })
}

const flushDetailLoad = async () => {
  await Promise.resolve()
  await new Promise(resolve => window.setTimeout(resolve, 0))
}

const mountDrawer = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  router.push('/')
  await router.isReady()

  setActivePinia(createPinia())

  const wrapper = mount(GoodsDrawer, {
    attachTo: document.body,
    props: {
      modelValue: true,
      goodsId: 'desktop-id',
    },
    global: {
      plugins: [router],
      stubs: {
        'el-drawer': {
          props: ['modelValue', 'size'],
          emits: ['close', 'open'],
          template: `
            <aside v-if="modelValue" class="drawer-stub" :data-size="size">
              <header class="drawer-header-stub"><slot name="header" /></header>
              <slot />
            </aside>
          `,
        },
        'el-skeleton': { template: '<div class="skeleton-stub" />' },
        'el-empty': { props: ['description'], template: '<div class="empty-stub">{{ description }}</div>' },
        'el-image': {
          props: ['src'],
          template: '<img class="el-image-stub" :src="src" />',
        },
        'el-icon': { template: '<i><slot /></i>' },
        'el-tag': { template: '<span class="tag-stub"><slot /></span>' },
        'el-collapse': { template: '<div><slot /></div>' },
        'el-collapse-item': { template: '<div><slot name="title" /><slot /></div>' },
        SquarePaddedImage: {
          props: ['src', 'alt'],
          template: '<img class="square-image-stub" :src="src" :alt="alt" />',
        },
        Close: { template: '<span />' },
        Picture: { template: '<span />' },
        Collection: { template: '<span />' },
      },
    },
  })

  await flushDetailLoad()
  await wrapper.vm.$nextTick()

  return wrapper
}

describe('GoodsDrawer desktop detail panel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    setDesktopViewport()
    mockFetchGoodsDetail.mockResolvedValue(desktopDetail)
    vi.mocked(getGoodsList).mockResolvedValue({
      results: [
        desktopDetail,
        {
          ...desktopDetail,
          id: 'same-theme-id',
          name: '同主题收藏亚克力挂件',
          main_photo: '/media/same-theme.png',
        },
      ],
    } as any)
  })

  it('renders the redesigned desktop panel instead of the mobile sheet', async () => {
    const wrapper = await mountDrawer()

    expect(wrapper.get('.drawer-stub').attributes('data-size')).toBe('clamp(720px, 48vw, 880px)')
    expect(wrapper.find('.desktop-detail-panel').exists()).toBe(true)
    expect(wrapper.find('.mobile-header-area').exists()).toBe(false)
  })

  it('shows the core asset fields and image rail on desktop', async () => {
    const wrapper = await mountDrawer()
    const text = wrapper.text()

    expect(text).not.toContain('收藏档案')
    expect(text).toContain('鬼切《绀宇切芒》满赠吧唧')
    expect(text).toContain('在馆')
    expect(text).toContain('同人')
    expect(text).toContain('阴阳师')
    expect(text).toContain('鬼切')
    expect(text).toContain('58mm吧唧')
    expect(text).toContain('绀宇切芒')
    expect(text).toContain('¥ 68.00')
    expect(text).toContain('2026-05-31')
    expect(text).toContain('x2')
    expect(text).toContain('卧室/A1柜/第三层')
    expect(text).toContain('店铺：December十二月 TB店')
    expect(text).not.toContain('收藏身份')
    expect(text).not.toContain('入手记录')
    expect(wrapper.findAll('.desktop-thumbnail')).toHaveLength(2)
    expect(wrapper.find('.desktop-profile-area .desktop-thumbnail-panel').exists()).toBe(true)
    expect(wrapper.find('.desktop-media-area .desktop-thumbnail-panel').exists()).toBe(false)
    expect(wrapper.findAll('.desktop-chip-row .desktop-chip')).toHaveLength(2)
    expect(wrapper.find('.desktop-chip-row .is-theme').exists()).toBe(false)
    expect(wrapper.find('.desktop-summary-row .desktop-theme-chip').exists()).toBe(true)
    expect(wrapper.find('.desktop-summary-row .is-location').exists()).toBe(false)
    expect(wrapper.find('.desktop-stat-value[title="卧室/A1柜/第三层"]').exists()).toBe(true)
  })

  it('keeps additional photos under the desktop details and pages through many images', async () => {
    const additionalPhotos = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      image: `/media/detail-${index + 1}.png`,
      label: `附图 ${index + 1}`,
    }))
    mockFetchGoodsDetail.mockResolvedValue({
      ...desktopDetail,
      additional_photos: additionalPhotos,
    })

    const wrapper = await mountDrawer()

    expect(wrapper.find('.desktop-profile-area .desktop-thumbnail-panel').exists()).toBe(true)
    expect(wrapper.findAll('.desktop-thumbnail')).toHaveLength(4)
    expect(wrapper.find('.desktop-thumbnail-prev').exists()).toBe(true)
    expect(wrapper.find('.desktop-thumbnail-next').exists()).toBe(true)
    expect(wrapper.text()).toContain('附图 1')
    expect(wrapper.text()).not.toContain('附图 5')

    await wrapper.get('.desktop-thumbnail-next').trigger('click')

    expect(wrapper.text()).toContain('附图 5')
    expect(wrapper.text()).not.toContain('附图 1')
  })

  it('shows same-theme goods and switches detail when an item is clicked', async () => {
    const wrapper = await mountDrawer()

    expect(wrapper.get('.same-theme-count').text()).toBe('1')
    expect(wrapper.text()).toContain('同主题收藏亚克力挂件')

    await wrapper.get('.desktop-same-theme-card').trigger('click')

    expect(mockFetchGoodsDetail).toHaveBeenCalledWith('same-theme-id')
  })
})
