import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubDetail from '@/views/ClubDetail.vue'
import { useAuthStore } from '@/stores/auth'
import type { Club, ClubCatalogItem } from '@/api/types'

const { pushMock, replaceMock, routeMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  routeMock: { params: { id: '1' }, query: {} as Record<string, string>, fullPath: '/clubs/1' },
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}))

vi.mock('@/api/clubs', () => ({
  getClub: vi.fn(),
  getClubGoods: vi.fn(),
  getClubGoodsFacets: vi.fn(),
  getClubGoodsDetail: vi.fn(),
  favoriteClub: vi.fn(),
  unfavoriteClub: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import * as clubApi from '@/api/clubs'

const source = readFileSync(resolve(process.cwd(), 'src/views/ClubDetail.vue'), 'utf8')
const detailDrawerSource = readFileSync(resolve(process.cwd(), 'src/components/club/ClubGoodsDetailDrawer.vue'), 'utf8')

const club: Club = {
  id: 1,
  name: '星光社团',
  avatar: null,
  description: '专注星穹铁道谷子',
  announcement: '周末有新谷上架',
  contact_name: '小星',
  contact_phone: '13800000000',
  contact_email: 'club@example.com',
  taobao_url: null,
  xiaohongshu_url: null,
  weidian_url: null,
  store_links: [{ label: '官方店铺', url: 'https://example.com/store' }],
  address: '测试路 1 号',
  business_hours: '09:00-18:00',
  goods_count: 1,
  created_at: '2026-08-29T00:00:00Z',
  updated_at: '2026-08-29T00:00:00Z',
}

const goods: ClubCatalogItem = {
  id: 'goods-1',
  name: '流萤镭射票',
  ip: { id: 1, name: '崩坏：星穹铁道' },
  characters: [{ id: 1, name: '流萤', ip: { id: 1, name: '崩坏：星穹铁道' }, gender: 'female' }],
  category: {
    id: 1,
    name: '镭射票',
    parent: null,
    path_name: '纸制品/镭射票',
    shape_type: 'rectangle',
    color_tag: '#D4AF37',
    order: 1,
  },
  theme: null,
  main_photo: null,
  description: '公开说明',
  additional_photos: [],
  public_price: '88.00',
  is_official: true,
  publication_status: 'listed',
  order: 0,
  created_at: '2026-08-29T00:00:00Z',
  updated_at: '2026-08-29T00:00:00Z',
}

const goodsDetail: ClubCatalogItem = {
  ...goods,
  description: '限定款，公开说明。',
  theme: { id: 9, name: '流光主题', description: '主题说明', created_at: '2026-08-29T00:00:00Z' },
  main_photo: 'https://cdn.example.com/main.jpg',
  additional_photos: [{ id: 7, image: 'https://cdn.example.com/detail.jpg', label: '细节图' }],
}

const passthroughStub = (name: string, tag = 'div') => defineComponent({
  name,
  emits: ['click'],
  template: `<${tag} v-bind="$attrs" @click="$emit('click', $event)"><slot /></${tag}>`,
})

const ElInputStub = defineComponent({
  name: 'ElInput',
  inheritAttrs: false,
  props: { modelValue: { type: String, default: '' }, placeholder: { type: String, default: '' } },
  emits: ['update:modelValue', 'blur', 'clear', 'keyup'],
  template: `
    <label class="el-input-stub">
      <slot name="prefix" />
      <input
        :value="modelValue"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
        @blur="$emit('blur', $event)"
        @keyup="$emit('keyup', $event)"
      />
      <button type="button" class="clear-input" @click="$emit('update:modelValue', ''); $emit('clear')">清空</button>
    </label>
  `,
})

const ElSelectStub = defineComponent({
  name: 'ElSelect',
  inheritAttrs: false,
  props: { modelValue: { type: [String, Number], default: '' }, placeholder: { type: String, default: '' } },
  emits: ['update:modelValue', 'change'],
  template: `
    <select
      :aria-label="placeholder"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value); $emit('change', $event.target.value)"
    >
      <option value="">{{ placeholder }}</option>
      <slot />
    </select>
  `,
})

const ElOptionStub = defineComponent({
  name: 'ElOption',
  props: { label: { type: String, default: '' }, value: { type: [String, Number, Boolean], default: '' } },
  template: '<option :value="value">{{ label }}</option>',
})

const ElTreeSelectStub = defineComponent({
  name: 'ElTreeSelect',
  props: { modelValue: { type: [String, Number], default: '' }, placeholder: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: '<select :aria-label="placeholder" :value="modelValue" @change="$emit(\'update:modelValue\', Number($event.target.value) || undefined)"><option value="">{{ placeholder }}</option></select>',
})

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  template: `
    <section v-if="modelValue" class="dialog-stub" role="dialog" :aria-label="title">
      <h2>{{ title }}</h2>
      <slot />
      <footer><slot name="footer" /></footer>
    </section>
  `,
})

const ElImageStub = defineComponent({
  name: 'ElImage',
  props: { src: { type: String, default: '' }, alt: { type: String, default: '' } },
  template: '<img :src="src" :alt="alt" />',
})

const ElEmptyStub = defineComponent({
  name: 'ElEmpty',
  props: { description: { type: String, default: '' } },
  template: '<div class="empty-stub"><span>{{ description }}</span><slot /></div>',
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function mockSuccessfulLoad(items: ClubCatalogItem[] = [goods]) {
  vi.mocked(clubApi.getClub).mockResolvedValue(club)
  vi.mocked(clubApi.getClubGoods).mockResolvedValue({
    count: items.length,
    page: 1,
    page_size: 20,
    next: null,
    previous: null,
    results: items,
  })
  vi.mocked(clubApi.getClubGoodsDetail).mockResolvedValue(goodsDetail)
  vi.mocked(clubApi.getClubGoodsFacets).mockResolvedValue({
    ips: [{ id: 1, name: '崩坏：星穹铁道', count: items.length }],
    characters: [{ id: 1, name: '流萤', ip_id: 1, count: items.length }],
    categories: [{ id: 1, name: '镭射票', path_name: '纸制品/镭射票', parent: null, count: items.length }],
    themes: [],
    price_bounds: { min: '88.00', max: '88.00' },
  })
}

async function mountPage(options: { authenticated?: boolean; clubAccount?: boolean } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore()
  if (options.authenticated) {
    authStore.setToken('test-token')
    authStore.user = {
      id: 1,
      username: options.clubAccount ? 'club-user' : 'collector-user',
      role: 'User',
      account_type: options.clubAccount ? 'club' : 'collector',
      approval_status: 'approved',
    }
  }

  const wrapper = mount(ClubDetail, {
    global: {
      plugins: [pinia],
      directives: { loading: {} },
      stubs: {
        ElButton: passthroughStub('ElButton', 'button'),
        ElDialog: ElDialogStub,
        ElDrawer: ElDialogStub,
        ElEmpty: ElEmptyStub,
        ElIcon: passthroughStub('ElIcon', 'span'),
        ElImage: ElImageStub,
        ElInput: ElInputStub,
        ElOption: ElOptionStub,
        ElPagination: passthroughStub('ElPagination'),
        ElSelect: ElSelectStub,
        ElSkeleton: passthroughStub('ElSkeleton'),
        ElTag: passthroughStub('ElTag', 'span'),
        ElTooltip: passthroughStub('ElTooltip'),
        ElTreeSelect: ElTreeSelectStub,
      },
    },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

describe('ClubDetail 社团对外页', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 768 })
    localStorage.clear()
    pushMock.mockReset()
    replaceMock.mockReset()
    routeMock.query = {}
    vi.clearAllMocks()
    mockSuccessfulLoad()
  })

  it('展示社团品牌信息、公告、公开资料和谷子卡片', async () => {
    const wrapper = await mountPage()

    expect(wrapper.get('#club-title').text()).toBe('星光社团')
    expect(wrapper.get('.announcement').text()).toContain('周末有新谷上架')
    expect(wrapper.find('.club-hero__count').exists()).toBe(false)
    expect(wrapper.get('.section-heading__count').text()).toBe('共 1 款')
    expect(wrapper.get('.profile-panel').text()).toContain('club@example.com')
    expect(wrapper.get('a[href="tel:13800000000"]').attributes('href')).toBe('tel:13800000000')
    expect(wrapper.get('a[href="mailto:club@example.com"]').attributes('href')).toBe('mailto:club@example.com')
    expect(wrapper.get('.store-link').attributes('rel')).toBe('noreferrer')
    expect(wrapper.get('.store-link').attributes('aria-label')).toContain('在新窗口打开')
    expect(wrapper.get('.goods-card').text()).toContain('流萤镭射票')
    expect(wrapper.get('.goods-card').text()).not.toContain('官谷')
    expect(wrapper.get('.goods-card').text()).not.toContain('同人')
    expect(wrapper.find('.goods-card__quantity').exists()).toBe(false)
  })

  it('按淘宝、小红书、微店顺序展示已配置平台并保留其他入口', async () => {
    vi.mocked(clubApi.getClub).mockResolvedValue({
      ...club,
      taobao_url: 'https://shop.taobao.com/demo',
      xiaohongshu_url: 'https://www.xiaohongshu.com/user/demo',
      weidian_url: null,
    })
    const wrapper = await mountPage()
    const links = wrapper.findAll('.store-link')

    expect(links).toHaveLength(3)
    expect(links[0]!.text()).toContain('淘宝')
    expect(links[1]!.text()).toContain('小红书')
    expect(links[2]!.text()).toContain('官方店铺')
    expect(links[0]!.find('img').attributes('src')).toBe('/brand/taobao.png')
    expect(links[1]!.find('img').attributes('src')).toBe('/brand/xiaohongshu.png')
    expect(links[0]!.attributes('href')).toBe('https://shop.taobao.com/demo')
    expect(links[0]!.attributes('target')).toBe('_blank')
    expect(links[0]!.attributes('rel')).toBe('noreferrer')
    expect(links[0]!.attributes('aria-label')).toContain('淘宝')
  })

  it('没有平台入口和其他链接时不渲染店铺区域', async () => {
    vi.mocked(clubApi.getClub).mockResolvedValue({ ...club, store_links: [] })
    const wrapper = await mountPage()
    expect(wrapper.find('.store-links').exists()).toBe(false)
    expect(wrapper.get('.profile-empty').text()).toContain('暂未公开')
  })

  it('店铺入口只保留 logo，不显示外层边框和底色', () => {
    expect(source).toMatch(/\.store-link\s*\{[\s\S]*?border:\s*0;/)
    expect(source).toMatch(/\.store-link\s*\{[\s\S]*?background:\s*transparent;/)
    expect(source).toContain('.store-link__logo')
  })

  it('公告按内容宽度展示且移动端不再依赖硬编码外边距', () => {
    expect(source).toMatch(/\.announcement\s*\{[\s\S]*?display:\s*inline-flex;/)
    expect(source).toMatch(/\.announcement\s*\{[\s\S]*?width:\s*fit-content;/)
    expect(source).toMatch(/\.announcement\s*\{[\s\S]*?max-width:\s*100%;/)
    expect(source).not.toContain('.club-hero__count { margin-left:')
  })

  it('卡片和详情抽屉分别使用适合所在场景的加入谷仓按钮', () => {
    expect(source).toMatch(/class="import-button club-import-button brand-add-btn"/)
    expect(source).toMatch(/\.club-import-button\s*\{[\s\S]*?width:\s*96px;/)
    expect(source).toMatch(/\.club-import-button\s*\{[\s\S]*?--brand-add-min-height:\s*34px;[\s\S]*?--brand-add-font-size:\s*12px;/)
    expect(detailDrawerSource).toMatch(/class="detail-action__import brand-add-btn"/)
    expect(detailDrawerSource).toMatch(/\.detail-action__import\s*\{[\s\S]*?width:\s*112px;[\s\S]*?--brand-add-min-height:\s*38px;/)
    expect(detailDrawerSource).toContain('class="detail-inline-action desktop-inline-action"')
    expect(detailDrawerSource).not.toContain('class="detail-action-bar"')
    expect(detailDrawerSource).toMatch(/\.desktop-profile-area\s*\{[\s\S]*?align-self:\s*stretch;/)
    expect(detailDrawerSource).toMatch(/\.desktop-inline-action\s*\{[\s\S]*?margin-top:\s*auto;/)
  })

  it('列表与详情金额统一使用金色主题变量', () => {
    expect(source).toMatch(/\.goods-card__price\s*\{[\s\S]*?color:\s*var\(--primary-gold-dark\);/)
    expect(detailDrawerSource).toMatch(/\.detail-price-card strong\.is-price\s*\{[\s\S]*?color:\s*var\(--primary-gold-dark,\s*#b8941f\);/)
    expect(detailDrawerSource).not.toContain('var(--accent-purple-dark) !important')
  })

  it('Hero 不重复展示统计，公开谷子数量突出显示在目录标题旁', () => {
    expect(source).not.toContain('club-hero__count')
    expect(source).toMatch(/\.section-heading__count\s*\{[\s\S]*?font-weight:\s*700;/)
    expect(source).toMatch(/\.section-heading__count\s*\{[\s\S]*?white-space:\s*nowrap;/)
  })

  it('大屏详情页扩展内容宽度并固定展示四列谷子', () => {
    expect(source).toMatch(/\.club-detail-page\s*\{[\s\S]*?max-width:\s*1680px;/)
    expect(source).toMatch(/\.detail-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(220px,\s*250px\) minmax\(0,\s*1fr\);/)
    expect(source).toMatch(/@media \(min-width:\s*1360px\)\s*\{[\s\S]*?\.goods-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/)
  })

  it('社团筛选面板使用谷仓同款高度过渡并带轻微缩放', () => {
    expect(source).toContain('<div v-if="!isMobile && filtersExpanded" class="filter-collapse-wrapper">')
    expect(source).toMatch(/\.filter-collapse-wrapper\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0,\s*1fr\);/)
    expect(source).toMatch(/\.filter-collapse-wrapper > \.desktop-filter-panel\s*\{[\s\S]*?transform-origin:\s*top center;/)
    expect(source).toMatch(/\.filter-collapse-enter-active,[\s\S]*?transition:\s*grid-template-rows 0\.3s ease, margin-bottom 0\.3s ease, opacity 0\.3s ease;/)
    expect(source).toMatch(/\.filter-collapse-enter-from,[\s\S]*?grid-template-rows:\s*minmax\(0,\s*0fr\);/)
    expect(source).toMatch(/\.filter-collapse-enter-from,[\s\S]*?\.filter-collapse-leave-to\s*\{[\s\S]*?margin-bottom:\s*4px;/)
    expect(source).toMatch(/\.filter-collapse-enter-to,[\s\S]*?\.filter-collapse-leave-from\s*\{[\s\S]*?margin-bottom:\s*20px;/)
    expect(source).toMatch(/\.filter-collapse-enter-from > \.desktop-filter-panel,[\s\S]*?transform:\s*translateY\(-6px\) scale\(0\.98\);/)
    expect(source).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?\.filter-collapse-enter-from > \.desktop-filter-panel,[\s\S]*?transform:\s*none;/)
  })

  it('桌面筛选面板默认收起，排序按钮与搜索栏平铺', () => {
    expect(source).toContain('const filtersExpanded = ref(false)')
    expect(source).toContain('<div v-if="!isMobile" class="goods-sort-group" role="group" aria-label="谷子排序">')
    expect(source).toContain('class="goods-sort-button"')
    expect(source).toContain('class="goods-sort-button goods-sort-button--direction"')
    expect(source).toContain("toggleOrdering('time')")
    expect(source).toContain("toggleOrdering('price')")
    expect(source).not.toContain('class="reset-filter-button"')
  })

  it('点击排序按钮在社团顺序、上架时间和价格方向之间切换', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as unknown as {
      filters: { ordering: string }
      setOrdering: (ordering: string) => void
      toggleOrdering: (type: 'time' | 'price') => void
    }

    vm.setOrdering('default')
    expect(vm.filters.ordering).toBe('default')
    vm.toggleOrdering('time')
    await flushPromises()
    expect(vm.filters.ordering).toBe('newest')
    vm.toggleOrdering('time')
    await flushPromises()
    expect(vm.filters.ordering).toBe('oldest')
    vm.toggleOrdering('price')
    await flushPromises()
    expect(vm.filters.ordering).toBe('price_asc')
    vm.toggleOrdering('price')
    await flushPromises()
    expect(vm.filters.ordering).toBe('price_desc')
  })

  it('已选择排序时不显示额外的重置按钮', async () => {
    routeMock.query = { ordering: 'newest' }
    const wrapper = await mountPage()

    expect(wrapper.find('.reset-filter-button').exists()).toBe(false)
    expect(wrapper.findAll('.goods-sort-button')).toHaveLength(3)
  })

  it('搜索名称时将筛选条件发送给公开谷子接口且不提供库存状态筛选', async () => {
    const wrapper = await mountPage()
    const input = wrapper.get('input[placeholder="搜索名称、IP、角色、品类或主题"]')
    await input.setValue('流萤')
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()

    expect(clubApi.getClubGoods).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: '流萤' }))

    expect(wrapper.find('select[aria-label="全部状态"]').exists()).toBe(false)
    expect(clubApi.getClubGoods).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: '流萤' }))
  })

  it('从 URL 恢复筛选和分页且首次只请求一次列表', async () => {
    routeMock.query = {
      search: '流萤',
      ip: '1',
      character: '1',
      category: '1',
      price_min: '80',
      ordering: 'price_asc',
      page: '2',
    }
    await mountPage()

    expect(clubApi.getClubGoods).toHaveBeenCalledTimes(1)
    expect(clubApi.getClubGoods).toHaveBeenCalledWith(1, expect.objectContaining({
      search: '流萤',
      ip: 1,
      character: 1,
      category: 1,
      price_min: '80',
      ordering: 'price_asc',
      page: 2,
    }))
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('空公开价格输入框聚焦后失焦不会刷新谷子列表', async () => {
    const wrapper = await mountPage()
    const requestCount = vi.mocked(clubApi.getClubGoods).mock.calls.length
    await wrapper.get('.filter-toggle-button').trigger('click')
    await nextTick()
    const priceInput = wrapper.get('input[placeholder="最低 88.00"]')

    await priceInput.trigger('focus')
    await priceInput.trigger('blur')
    await flushPromises()

    expect(clubApi.getClubGoods).toHaveBeenCalledTimes(requestCount)
    expect(wrapper.find('.goods-grid--skeleton').exists()).toBe(false)
  })

  it('根据 facets 清理 URL 中已失效的筛选项', async () => {
    routeMock.query = { ip: '999', character: '1', category: '999', imported: 'imported', page: '3' }
    await mountPage()

    expect(replaceMock).toHaveBeenCalledWith(expect.objectContaining({ query: { page: '3' } }))
    expect(clubApi.getClubGoods).toHaveBeenCalledTimes(1)
    expect(clubApi.getClubGoods).toHaveBeenCalledWith(1, expect.objectContaining({
      ip: undefined,
      character: undefined,
      category: undefined,
      imported: undefined,
      page: 3,
    }))
  })

  it('移动端筛选使用草稿，关闭不生效，应用后再请求', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 })
    const wrapper = await mountPage()
    vi.mocked(clubApi.getClubGoods).mockClear()
    const vm = wrapper.vm as unknown as {
      filters: Record<string, unknown>
      mobileDraftFilters: Record<string, unknown>
      mobileFilterVisible: boolean
      applyMobileFilters: () => Promise<void>
    }

    await wrapper.get('.filter-toggle-button').trigger('click')
    vm.mobileDraftFilters = { ...vm.mobileDraftFilters, ip: 1 }
    vm.mobileFilterVisible = false
    await nextTick()
    expect(vm.filters.ip).toBeUndefined()
    expect(clubApi.getClubGoods).not.toHaveBeenCalled()

    vm.mobileDraftFilters = { ...vm.mobileDraftFilters, ip: 1 }
    await vm.applyMobileFilters()
    expect(clubApi.getClubGoods).toHaveBeenCalledWith(1, expect.objectContaining({ ip: 1, page: 1 }))
  })

  it('卡片展示角色摘要、主题、公开价格和当前用户导入状态', async () => {
    const richGoods = {
      ...goods,
      characters: [
        goods.characters[0]!,
        { ...goods.characters[0]!, id: 2, name: '银狼' },
        { ...goods.characters[0]!, id: 3, name: '卡芙卡' },
      ],
      theme: { id: 9, name: '流光主题', description: '', created_at: '2026-08-29T00:00:00Z' },
      public_price: '88.00',
      is_imported: true,
      imported_quantity: 3,
    }
    mockSuccessfulLoad([richGoods])
    vi.mocked(clubApi.getClubGoodsFacets).mockResolvedValue({
      ips: [{ id: 1, name: '崩坏：星穹铁道', count: 1 }],
      characters: richGoods.characters.map(character => ({ id: character.id, name: character.name, ip_id: 1, count: 1 })),
      categories: [{ id: 1, name: '镭射票', path_name: '纸制品/镭射票', parent: null, count: 1 }],
      themes: [{ id: 9, name: '流光主题', count: 1 }],
      price_bounds: { min: '88.00', max: '88.00' },
      imported_counts: { imported: 1, unimported: 0 },
    })
    const wrapper = await mountPage({ authenticated: true })

    expect(wrapper.get('.goods-card__characters').text()).toContain('流萤、银狼 +1')
    expect(wrapper.get('.goods-card__theme').text()).toBe('流光主题')
    expect(wrapper.get('.goods-card__price').text()).toBe('¥88.00')
    expect(wrapper.get('.goods-card__imported').text()).toContain('已导入 · 3 件')
  })

  it('筛选无结果时提供明确空状态和清除筛选入口', async () => {
    vi.mocked(clubApi.getClubGoods).mockResolvedValue({
      count: 0,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [],
    })
    const wrapper = await mountPage()
    const input = wrapper.get('input[placeholder="搜索名称、IP、角色、品类或主题"]')
    await input.setValue('不存在')
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.get('.empty-stub').text()).toContain('没有找到匹配的公开谷子')
    await wrapper.get('.empty-stub button').trigger('click')
    await flushPromises()
    expect(clubApi.getClubGoods).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: undefined }))
  })

  it('只接收最新一次搜索响应，旧响应不会覆盖结果', async () => {
    const first = deferred<Awaited<ReturnType<typeof clubApi.getClubGoods>>>()
    vi.mocked(clubApi.getClubGoods).mockReturnValueOnce(first.promise)
    const wrapper = await mountPage()

    const secondResult = {
      count: 1,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [{ ...goods, id: 'goods-new', name: '最新搜索结果' }],
    }
    vi.mocked(clubApi.getClubGoods).mockResolvedValueOnce(secondResult)
    const vm = wrapper.vm as unknown as {
      filters: { search: string }
      applyFilters: (value: Record<string, unknown>) => Promise<boolean>
    }
    await vm.applyFilters({ ...vm.filters, search: '最新' })

    first.resolve({
      count: 1,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [{ ...goods, id: 'goods-old', name: '过期搜索结果' }],
    })
    await flushPromises()

    expect(wrapper.text()).toContain('最新搜索结果')
    expect(wrapper.text()).not.toContain('过期搜索结果')
  })

  it('使用原生按钮承载卡片详情操作，保留 Enter 和 Space 键盘语义', async () => {
    const wrapper = await mountPage()
    const trigger = wrapper.get('.goods-card__detail-trigger')

    expect(trigger.element.tagName).toBe('BUTTON')
    expect(trigger.attributes('type')).toBe('button')
    expect(trigger.attributes('aria-label')).toContain('流萤镭射票')
    await trigger.trigger('click')
    await flushPromises()
    expect(clubApi.getClubGoodsDetail).toHaveBeenCalledWith(1, 'goods-1')
    const drawer = wrapper.get('.club-goods-detail-drawer')
    expect(drawer.attributes('direction')).toBe('rtl')
    expect(drawer.attributes('size')).toBe('clamp(720px, 48vw, 880px)')
    expect(drawer.get('.detail-notes-card').text()).toContain('公开说明')
    expect(drawer.text()).toContain('流光主题')
    expect(drawer.text()).toContain('镭射票')
    expect(drawer.text()).toContain('发布社团')
    expect(drawer.text()).toContain('星光社团')
    expect(drawer.text()).not.toContain('由 星光社团 公开展示')
    expect(drawer.findAll('.detail-thumbnail')).toHaveLength(1)
    expect(drawer.get('.detail-thumbnail img').attributes('initial-index')).toBe('1')
    expect(drawer.get('.detail-price-card strong').classes()).toContain('is-price')
    expect(drawer.text()).not.toContain('官谷')
    expect(drawer.text()).not.toContain('同人')
    expect(drawer.text()).not.toContain('公开数量')
  })

  it('快速打开不同谷子时只展示最新详情', async () => {
    const first = deferred<ClubCatalogItem>()
    vi.mocked(clubApi.getClubGoodsDetail).mockReturnValueOnce(first.promise)
    const wrapper = await mountPage()

    await wrapper.get('.goods-card__detail-trigger').trigger('click')
    const latest = { ...goodsDetail, id: 'goods-2', name: '最新打开的谷子' }
    vi.mocked(clubApi.getClubGoodsDetail).mockResolvedValueOnce(latest)
    await (wrapper.vm as unknown as { openGoodsDetail: (item: ClubCatalogItem) => Promise<void> }).openGoodsDetail({
      ...goods,
      id: 'goods-2',
      name: '最新打开的谷子',
    })
    first.resolve(goodsDetail)
    await flushPromises()

    expect(wrapper.get('.dialog-stub[aria-label="最新打开的谷子详情"]').text()).toContain('最新打开的谷子')
    expect((wrapper.vm as unknown as { selectedDetail: ClubCatalogItem }).selectedDetail.id).toBe('goods-2')
  })

  it('未登录导入时跳转登录并保留当前社团地址', async () => {
    const wrapper = await mountPage()
    await wrapper.get('.import-button').trigger('click')

    expect(pushMock).toHaveBeenCalledWith({ name: 'Login', query: { redirect: '/clubs/1' } })
  })

  it('吃谷人可收藏社团并即时更新人数，重复点击由 loading 防抖', async () => {
    vi.mocked(clubApi.getClub).mockResolvedValue({ ...club, favorite_count: 2, is_favorited: false })
    vi.mocked(clubApi.favoriteClub).mockResolvedValue({ ...club, favorite_count: 3, is_favorited: true })
    const wrapper = await mountPage({ authenticated: true })

    await wrapper.get('.favorite-button').trigger('click')
    await flushPromises()

    expect(clubApi.favoriteClub).toHaveBeenCalledWith(1)
    expect(wrapper.get('.favorite-count').text()).toContain('3')
    expect(wrapper.get('.favorite-button').text()).toContain('已收藏')
    expect(wrapper.get('.favorite-button').attributes('aria-pressed')).toBe('true')
  })

  it('社团账号可浏览公开页但不显示导入操作', async () => {
    const wrapper = await mountPage({ authenticated: true, clubAccount: true })

    expect(wrapper.get('.goods-card').text()).toContain('流萤镭射票')
    expect(wrapper.find('.import-button').exists()).toBe(false)
    expect(wrapper.find('.favorite-button').exists()).toBe(false)
    await wrapper.get('.goods-card__detail-trigger').trigger('click')
    await flushPromises()
    expect(wrapper.find('.detail-action__import').exists()).toBe(false)
  })

  it('从详情抽屉加入谷仓时沿用公开页导入确认流程', async () => {
    const wrapper = await mountPage({ authenticated: true })

    await wrapper.get('.goods-card__detail-trigger').trigger('click')
    await flushPromises()
    await wrapper.get('.detail-action__import').trigger('click')

    expect(wrapper.find('.club-goods-detail-drawer').exists()).toBe(false)
    expect(wrapper.get('.import-dialog').text()).toContain('流萤镭射票')
  })

  it('未登录收藏社团时跳转登录并保留当前社团地址', async () => {
    const wrapper = await mountPage()
    await wrapper.get('.favorite-button').trigger('click')
    expect(pushMock).toHaveBeenCalledWith({ name: 'Login', query: { redirect: '/clubs/1' } })
  })

  it('从公开页导入时进入个人库存编辑表单', async () => {
    const wrapper = await mountPage({ authenticated: true })

    await wrapper.get('.import-button').trigger('click')
    await wrapper.get('.import-dialog .dialog-primary-button').trigger('click')
    await flushPromises()

    expect(pushMock).toHaveBeenCalledWith({ name: 'GoodsNew', query: { club_id: '1', club_goods_id: 'goods-1' } })
  })

  it('社团信息加载失败时显示页内错误和重试操作', async () => {
    vi.mocked(clubApi.getClub).mockRejectedValueOnce({ response: { data: { detail: '社团不存在或已下线' } } })
    const wrapper = await mountPage()

    expect(wrapper.get('.state-panel--error').text()).toContain('社团不存在或已下线')
    vi.mocked(clubApi.getClub).mockResolvedValueOnce(club)
    await wrapper.get('.state-panel__action').trigger('click')
    await flushPromises()
    expect(wrapper.get('#club-title').text()).toBe('星光社团')
  })
})
