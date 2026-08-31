import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubDetail from '@/views/ClubDetail.vue'
import { useAuthStore } from '@/stores/auth'
import type { Club, ClubCatalogItem } from '@/api/types'

const { pushMock, routeMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  routeMock: { params: { id: '1' }, fullPath: '/clubs/1' },
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/clubs', () => ({
  getClub: vi.fn(),
  getClubGoods: vi.fn(),
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
  emits: ['update:modelValue', 'clear', 'keyup'],
  template: `
    <label class="el-input-stub">
      <slot name="prefix" />
      <input
        :value="modelValue"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
        @keyup="$emit('keyup', $event)"
      />
      <button type="button" class="clear-input" @click="$emit('update:modelValue', ''); $emit('clear')">清空</button>
    </label>
  `,
})

const ElSelectStub = defineComponent({
  name: 'ElSelect',
  inheritAttrs: false,
  props: { modelValue: { type: String, default: '' }, placeholder: { type: String, default: '' } },
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
  props: { label: { type: String, default: '' }, value: { type: String, default: '' } },
  template: '<option :value="value">{{ label }}</option>',
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
        ElEmpty: ElEmptyStub,
        ElIcon: passthroughStub('ElIcon', 'span'),
        ElImage: ElImageStub,
        ElInput: ElInputStub,
        ElOption: ElOptionStub,
        ElPagination: passthroughStub('ElPagination'),
        ElSelect: ElSelectStub,
        ElSkeleton: passthroughStub('ElSkeleton'),
        ElTag: passthroughStub('ElTag', 'span'),
      },
    },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

describe('ClubDetail 社团对外页', () => {
  beforeEach(() => {
    localStorage.clear()
    pushMock.mockReset()
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

  it('卡片和弹窗的加入谷仓按钮共享紧凑尺寸', () => {
    expect(source).toMatch(/class="import-button club-import-button brand-add-btn"/)
    expect(source).toMatch(/class="dialog-primary-button club-import-button brand-add-btn"/)
    expect(source).toMatch(/\.club-import-button\s*\{[\s\S]*?width:\s*96px;/)
    expect(source).toMatch(/\.club-import-button\s*\{[\s\S]*?--brand-add-min-height:\s*34px;[\s\S]*?--brand-add-font-size:\s*12px;/)
    expect(source).not.toMatch(/\.dialog-primary-button\s*\{[\s\S]*?--brand-add-min-height:\s*38px;/)
  })

  it('Hero 不重复展示统计，公开谷子数量突出显示在目录标题旁', () => {
    expect(source).not.toContain('club-hero__count')
    expect(source).toMatch(/\.section-heading__count\s*\{[\s\S]*?font-weight:\s*700;/)
    expect(source).toMatch(/\.section-heading__count\s*\{[\s\S]*?white-space:\s*nowrap;/)
  })

  it('搜索名称时将筛选条件发送给公开谷子接口且不提供库存状态筛选', async () => {
    const wrapper = await mountPage()
    const input = wrapper.get('input[placeholder="搜索名称、IP或品类"]')
    await input.setValue('流萤')
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()

    expect(clubApi.getClubGoods).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: '流萤' }))

    expect(wrapper.find('select[aria-label="全部状态"]').exists()).toBe(false)
    expect(clubApi.getClubGoods).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: '流萤' }))
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
    const input = wrapper.get('input[placeholder="搜索名称、IP或品类"]')
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
    ;(wrapper.vm as unknown as { goodsSearch: string }).goodsSearch = '最新'
    await (wrapper.vm as unknown as { searchClubGoods: () => Promise<void> }).searchClubGoods()

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
    expect(wrapper.get('.goods-detail-dialog__notes').text()).toContain('公开说明')
    expect(wrapper.get('.goods-detail-dialog').text()).toContain('流光主题')
    expect(wrapper.get('.goods-detail-dialog').text()).toContain('纸制品/镭射票')
    expect(wrapper.get('.goods-detail-dialog').text()).toContain('发布社团')
    expect(wrapper.get('.goods-detail-dialog').text()).toContain('星光社团')
    expect(wrapper.get('.goods-detail-dialog').text()).not.toContain('由 星光社团 公开展示')
    expect(wrapper.findAll('.goods-detail-dialog__photo-button')).toHaveLength(2)
    await wrapper.findAll('.goods-detail-dialog__photo-button')[1]!.trigger('click')
    expect((wrapper.vm as unknown as { activeDetailImage: string }).activeDetailImage).toBe('https://cdn.example.com/detail.jpg')
    expect(wrapper.findAll('.goods-detail-dialog__photo-button')[1]!.find('img').attributes('preview-src-list')).toBeUndefined()
    expect(wrapper.get('.goods-detail-dialog').text()).not.toContain('官谷')
    expect(wrapper.get('.goods-detail-dialog').text()).not.toContain('同人')
    expect(wrapper.get('.detail-dialog').text()).not.toContain('公开数量')
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

    expect(wrapper.get('.dialog-stub[aria-label="最新打开的谷子"]').text()).toContain('最新打开的谷子')
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
