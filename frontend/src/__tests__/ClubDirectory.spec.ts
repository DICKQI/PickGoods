import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubDirectory from '@/views/ClubDirectory.vue'
import type { Club, ClubPreviewGoods, PaginatedResponse } from '@/api/types'

const { pushMock, messageSuccessMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  messageSuccessMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/clubs', () => ({
  getClubs: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: messageSuccessMock },
}))

import * as clubApi from '@/api/clubs'

const passthroughStub = (name: string, tag = 'span') => defineComponent({
  name,
  inheritAttrs: false,
  emits: ['click'],
  template: `<${tag} v-bind="$attrs" @click="$emit('click', $event)"><slot /></${tag}>`,
})

const ElInputStub = defineComponent({
  name: 'ElInput',
  inheritAttrs: false,
  props: { modelValue: { type: String, default: '' }, placeholder: { type: String, default: '' } },
  emits: ['update:modelValue', 'clear'],
  template: `
    <label class="el-input-stub">
      <slot name="prefix" />
      <input :value="modelValue" :placeholder="placeholder" @input="$emit('update:modelValue', $event.target.value)" />
      <button type="button" class="clear-input" @click="$emit('update:modelValue', ''); $emit('clear')">清空</button>
    </label>
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
  template: '<div class="empty-stub">{{ description }}</div>',
})

const ElPaginationStub = defineComponent({
  name: 'ElPagination',
  emits: ['update:current-page', 'current-change'],
  template: '<button class="pagination-stub" @click="$emit(\'update:current-page\', 2); $emit(\'current-change\', 2)">下一页</button>',
})

const previewGoods: ClubPreviewGoods[] = [
  { id: 'goods-1', name: '星轨徽章', preview_photo: 'https://cdn.example.com/hero.jpg', public_price: '88.00' },
  { id: 'goods-2', name: '流光色纸', preview_photo: null, public_price: null },
  { id: 'goods-3', name: '银河票根', preview_photo: null, public_price: '18.00' },
  { id: 'goods-4', name: '列车贴纸', preview_photo: null, public_price: '10.00' },
  { id: 'goods-5', name: '角色徽章', preview_photo: null, public_price: '39.00' },
]

const club: Club = {
  id: 1,
  name: '星光社团',
  avatar: null,
  description: '专注星穹铁道谷子',
  announcement: '周末有新谷上架',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  taobao_url: 'https://shop.taobao.com/star',
  xiaohongshu_url: null,
  weidian_url: 'https://weidian.com/star',
  store_links: [{ label: '自建店铺', url: 'https://example.com/store' }],
  address: '',
  business_hours: '',
  goods_count: 5,
  preview_goods: previewGoods,
  created_at: '2026-08-29T00:00:00Z',
  updated_at: '2026-08-29T00:00:00Z',
}

function clubs(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...club,
    id: index + 1,
    name: `社团 ${index + 1}`,
  }))
}

function pageResponse(results: Club[] = [club]): PaginatedResponse<Club> {
  return { count: results.length, page: 1, page_size: 10, next: null, previous: null, results }
}

async function mountPage(results: Club[] = [club], options: { mobile?: boolean } = {}) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: options.mobile ? 390 : 1024 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: options.mobile ? 844 : 800 })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: options.mobile ? 1 : 0 })
  vi.mocked(clubApi.getClubs).mockResolvedValue(pageResponse(results))
  const wrapper = mount(ClubDirectory, {
    global: {
      directives: { loading: {} },
      stubs: {
        ElButton: passthroughStub('ElButton', 'button'),
        ElEmpty: ElEmptyStub,
        ElIcon: passthroughStub('ElIcon'),
        ElImage: ElImageStub,
        ElInput: ElInputStub,
        ElPagination: ElPaginationStub,
      },
    },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

describe('ClubDirectory 社团目录', () => {
  beforeEach(() => {
    vi.mocked(clubApi.getClubs).mockReset()
    pushMock.mockReset()
    messageSuccessMock.mockReset()
  })

  it('展示五个最新预览、价格、占位图、平台入口和进入按钮', async () => {
    const wrapper = await mountPage()

    expect(wrapper.get('.club-identity__title h2').text()).toBe('星光社团')
    expect(wrapper.find('.preview-item__media img').attributes('src')).toBe('https://cdn.example.com/hero.jpg')
    expect(wrapper.find('.preview-item__media img').attributes('alt')).toBe('星轨徽章图片')
    expect(wrapper.findAll('.preview-item')).toHaveLength(5)
    expect(wrapper.find('.preview-item__price').text()).toBe('￥88.00')
    expect(wrapper.find('.preview-item').attributes('aria-label')).toBe('星轨徽章，￥88.00')
    expect(wrapper.find('.official-badge').exists()).toBe(false)
    expect(wrapper.find('.preview-item__placeholder')).toBeTruthy()
    expect(wrapper.find('a[aria-label^="淘宝"]').attributes('href')).toBe('https://shop.taobao.com/star')
    expect(wrapper.find('a[aria-label="自建店铺（在新窗口打开）"]').exists()).toBe(true)
    expect(wrapper.get('.enter-club-button').text()).toContain('进入')
    expect(wrapper.get('.enter-club-button').attributes('aria-label')).toBe('进入星光社团')
    expect(wrapper.text()).not.toContain('有新公告')
  })

  it('点击社团身份、预览和进入按钮都会打开详情', async () => {
    const wrapper = await mountPage()

    await wrapper.get('.club-identity').trigger('click')
    await wrapper.get('.preview-item').trigger('click')
    await wrapper.get('.enter-club-button').trigger('click')

    expect(pushMock).toHaveBeenCalledTimes(3)
    expect(pushMock).toHaveBeenLastCalledWith({ name: 'ClubDetail', params: { id: 1 } })
  })

  it('仅将无搜索第一页的前两个社团标记为移动端推荐位', async () => {
    const wrapper = await mountPage(clubs(4))

    const rows = wrapper.findAll('.club-shop')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.classes()).toContain('club-shop--featured')
    expect(rows[1]!.classes()).toContain('club-shop--featured')
    expect(rows[2]!.classes()).not.toContain('club-shop--featured')
    expect(rows[3]!.classes()).not.toContain('club-shop--featured')
  })

  it('搜索和清空搜索会回到第一页并带上查询条件', async () => {
    const resultClubs = clubs(4)
    const wrapper = await mountPage(resultClubs)
    vi.mocked(clubApi.getClubs).mockResolvedValue(pageResponse(resultClubs))

    const input = wrapper.get('input')
    await input.setValue('星光')
    expect(wrapper.findAll('.club-shop--featured')).toHaveLength(2)

    await wrapper.get('.directory-search').trigger('submit')
    await flushPromises()
    expect(clubApi.getClubs).toHaveBeenLastCalledWith({ page: 1, page_size: 10, search: '星光', ordering: 'name' })
    expect(wrapper.findAll('.club-shop--featured')).toHaveLength(0)

    await wrapper.get('.clear-input').trigger('click')
    await flushPromises()
    const initialQuery = vi.mocked(clubApi.getClubs).mock.calls[0]?.[0]
    expect(clubApi.getClubs).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 10,
      search: undefined,
      ordering: 'recommended',
      recommendation_seed: initialQuery?.recommendation_seed,
    })
    expect(wrapper.findAll('.club-shop--featured')).toHaveLength(2)
  })

  it('翻页复用当前目录推荐种子', async () => {
    const paginatedResults = clubs(11)
    const wrapper = await mountPage(paginatedResults)
    vi.mocked(clubApi.getClubs).mockResolvedValue(pageResponse())
    const initialQuery = vi.mocked(clubApi.getClubs).mock.calls[0]?.[0]

    await wrapper.get('.pagination-stub').trigger('click')
    await flushPromises()

    expect(clubApi.getClubs).toHaveBeenLastCalledWith({
      page: 2,
      page_size: 10,
      search: undefined,
      ordering: 'recommended',
      recommendation_seed: initialQuery?.recommendation_seed,
    })
    expect(wrapper.findAll('.club-shop--featured')).toHaveLength(0)
  })

  it('每次挂载生成新的推荐种子', async () => {
    const first = await mountPage()
    const firstSeed = vi.mocked(clubApi.getClubs).mock.calls[0]?.[0]?.recommendation_seed
    first.unmount()

    const second = await mountPage()
    const secondSeed = vi.mocked(clubApi.getClubs).mock.calls[1]?.[0]?.recommendation_seed
    second.unmount()

    expect(firstSeed).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
    expect(secondSeed).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
    expect(secondSeed).not.toBe(firstSeed)
  })

  it('搜索失败时保留当前结果和推荐位状态', async () => {
    const wrapper = await mountPage(clubs(4))
    vi.mocked(clubApi.getClubs).mockRejectedValueOnce(new Error('network error'))

    await wrapper.get('input').setValue('不存在的社团')
    await wrapper.get('.directory-search').trigger('submit')
    await flushPromises()

    expect(wrapper.findAll('.club-shop')).toHaveLength(4)
    expect(wrapper.findAll('.club-shop--featured')).toHaveLength(2)
  })

  it('移动端下拉刷新第一页并生成新的推荐种子', async () => {
    const resultClubs = clubs(4)
    const wrapper = await mountPage(resultClubs, { mobile: true })
    const initialSeed = vi.mocked(clubApi.getClubs).mock.calls[0]?.[0]?.recommendation_seed
    vi.mocked(clubApi.getClubs).mockResolvedValue(pageResponse(resultClubs))

    await wrapper.trigger('touchstart', { touches: [{ clientY: 10 }] })
    await wrapper.trigger('touchmove', { touches: [{ clientY: 170 }] })
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await nextTick()

    expect(wrapper.get('.club-pull-indicator').text()).toContain('释放刷新')

    await wrapper.trigger('touchend')
    await flushPromises()

    const refreshQuery = vi.mocked(clubApi.getClubs).mock.calls[1]?.[0]
    expect(refreshQuery).toMatchObject({
      page: 1,
      page_size: 10,
      search: undefined,
      ordering: 'recommended',
    })
    expect(refreshQuery?.recommendation_seed).not.toBe(initialSeed)
    expect(messageSuccessMock).toHaveBeenCalledWith('刷新成功')
  })

  it('没有匹配社团时展示空状态', async () => {
    const wrapper = await mountPage([])

    expect(wrapper.find('.empty-stub').text()).toBe('暂无匹配的社团')
    expect(wrapper.find('.club-shop').exists()).toBe(false)
  })
})
