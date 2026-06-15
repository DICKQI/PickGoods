import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CharacterStats from '@/views/CharacterStats.vue'
import { getCharacterStats } from '@/api/goods'

const routerPush = vi.hoisted(() => vi.fn())
const routerReplace = vi.hoisted(() => vi.fn())
const routerBack = vi.hoisted(() => vi.fn())
const routeId = vi.hoisted(() => ({ value: '10' }))
const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { id: routeId.value },
    query: routeQuery.value,
  }),
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
    back: routerBack,
  }),
}))

vi.mock('@/api/goods', () => ({
  getCharacterStats: vi.fn(),
}))

vi.mock('echarts', () => ({
  getInstanceByDom: vi.fn(() => null),
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}))

const makeStats = (overrides: Record<string, any> = {}) => ({
  character: {
    id: 10,
    name: '本命角色',
    avatar: '',
    gender: 'female',
    ip: { id: 1, name: '厨力测试IP', subject_type: 4 },
  },
  overview: {
    goods_count: 2,
    quantity_sum: 3,
    value_sum: '250.00',
    category_count: 2,
  },
  oshi_power: {
    score: 88,
    level: '神推',
    rank: 1,
    total_characters: 8,
    components: {
      value: { percentile: 100, weight: 0.45, contribution: 45 },
      quantity: { percentile: 80, weight: 0.25, contribution: 20 },
      goods_count: { percentile: 80, weight: 0.2, contribution: 16 },
      category_breadth: { percentile: 70, weight: 0.1, contribution: 7 },
    },
    raw_metrics: {
      goods_count: 2,
      quantity_sum: 3,
      value_sum: '250.00',
      category_count: 2,
    },
  },
  ip_heat: {
    ip: { id: 1, name: '厨力测试IP', subject_type: 4 },
    platform_heat: {
      score: 75,
      level: '热门',
      rank: 1,
      total_ips: 6,
      components: {
        collectors: { percentile: 100, weight: 0.45, contribution: 45 },
      },
      raw_metrics: {
        collectors_count: 3,
        goods_count: 5,
        quantity_sum: 10,
        value_sum: '600.00',
        recent_goods_count: 5,
      },
    },
    my_heat: {
      score: 42,
      level: '升温',
      rank: 2,
      total_ips: 4,
      components: {
        quantity: { percentile: 60, weight: 0.3, contribution: 18 },
      },
      raw_metrics: {
        goods_count: 3,
        quantity_sum: 4,
        value_sum: '280.00',
        recent_goods_count: 3,
        character_count: 3,
        category_count: 3,
      },
    },
  },
  distributions: {
    status: [{ status: 'in_cabinet', label: '在馆', goods_count: 1, quantity_sum: 2 }],
    is_official: [{ is_official: true, label: '官谷', goods_count: 1, quantity_sum: 2 }],
    category_top: [{
      category_id: 1,
      category__name: '徽章',
      category__path_name: '徽章',
      category__color_tag: '#D4AF37',
      goods_count: 1,
      quantity_sum: 2,
      value_sum: '200.00',
    }],
  },
  trends: {
    purchase_date: [{ bucket: '2026-01-01', goods_count: 2, quantity_sum: 3, value_sum: '250.00' }],
    created_at: [],
  },
  rankings: {
    global_top: [{ id: 10, name: '本命角色', ip_name: '厨力测试IP', score: 88, goods_count: 2, quantity_sum: 3, value_sum: '250.00' }],
    current: { id: 10, name: '本命角色', ip_name: '厨力测试IP', score: 88, goods_count: 2, quantity_sum: 3, value_sum: '250.00' },
  },
  ...overrides,
})

const mountView = async () => {
  const wrapper = mount(CharacterStats, {
    global: {
      directives: {
        loading: {},
      },
      stubs: {
        'el-avatar': { props: ['src'], template: '<div class="avatar-stub"><slot /></div>' },
        'el-button': { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        'el-card': { template: '<section class="card-stub"><slot name="header" /><slot /></section>' },
        'el-empty': { props: ['description'], template: '<div class="empty-stub">{{ description }}</div>' },
        'el-icon': { template: '<i><slot /></i>' },
        'el-progress': { props: ['percentage'], template: '<div class="progress-stub">{{ percentage }}</div>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('CharacterStats', () => {
  beforeEach(() => {
    routeId.value = '10'
    routeQuery.value = {}
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: 2,
    })
    routerPush.mockReset()
    routerReplace.mockReset()
    routerBack.mockReset()
    vi.mocked(getCharacterStats).mockReset()
  })

  it('loads the route character and renders oshi power plus IP heat', async () => {
    vi.mocked(getCharacterStats).mockResolvedValue(makeStats() as any)

    const wrapper = await mountView()

    expect(getCharacterStats).toHaveBeenCalledWith(10)
    expect(wrapper.text()).toContain('本命角色')
    expect(wrapper.text()).toContain('厨力测试IP')
    expect(wrapper.text()).toContain('神推')
    expect(wrapper.text()).toContain('88')
    expect(wrapper.text()).toContain('¥250.00')
    expect(wrapper.text()).toContain('平台热度')
    expect(wrapper.text()).toContain('75')
    expect(wrapper.text()).toContain('我的热度')
    expect(wrapper.text()).toContain('42')
    expect(wrapper.find('.score-ring').attributes('style')).toContain('--score: 88')
  })

  it('renders an empty state when the character has no visible goods', async () => {
    vi.mocked(getCharacterStats).mockResolvedValue(makeStats({
      overview: { goods_count: 0, quantity_sum: 0, value_sum: '0.00', category_count: 0 },
      oshi_power: {
        score: 0,
        level: '未开厨',
        rank: null,
        total_characters: 0,
        components: {},
        raw_metrics: { goods_count: 0, quantity_sum: 0, value_sum: '0.00', category_count: 0 },
      },
    }) as any)

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('未开厨')
    expect(wrapper.text()).toContain('暂无该角色的收藏数据')
  })

  it('renders an error state when loading fails', async () => {
    vi.mocked(getCharacterStats).mockRejectedValue(new Error('network down'))

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('角色厨力统计加载失败')
  })

  it('returns to the source page when returnTo is a safe local path', async () => {
    routeQuery.value = { returnTo: '/showcase?tab=stats' }
    vi.mocked(getCharacterStats).mockResolvedValue(makeStats() as any)

    const wrapper = await mountView()
    await wrapper.get('.back-button').trigger('click')

    expect(routerReplace).toHaveBeenCalledWith('/showcase?tab=stats')
    expect(routerBack).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('ignores unsafe returnTo values and falls back to browser history', async () => {
    routeQuery.value = { returnTo: 'https://evil.test/path' }
    vi.mocked(getCharacterStats).mockResolvedValue(makeStats() as any)

    const wrapper = await mountView()
    await wrapper.get('.back-button').trigger('click')

    expect(routerReplace).not.toHaveBeenCalled()
    expect(routerBack).toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('falls back to character management when browser history is unavailable', async () => {
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: 1,
    })
    vi.mocked(getCharacterStats).mockResolvedValue(makeStats() as any)

    const wrapper = await mountView()
    await wrapper.get('.back-button').trigger('click')

    expect(routerBack).not.toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledWith('/ipcharacter')
  })
})
