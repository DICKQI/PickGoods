import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubDirectory from '@/views/ClubDirectory.vue'
import type { Club, ClubPreviewGoods, PaginatedResponse } from '@/api/types'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/clubs', () => ({
  getClubs: vi.fn(),
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

const previewGoods: ClubPreviewGoods[] = [
  { id: 'goods-1', name: '星轨徽章', preview_photo: 'https://cdn.example.com/hero.jpg', public_price: '88.00' },
  { id: 'goods-2', name: '流光色纸', preview_photo: null, public_price: null },
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
  goods_count: 2,
  preview_goods: previewGoods,
  created_at: '2026-08-29T00:00:00Z',
  updated_at: '2026-08-29T00:00:00Z',
}

function pageResponse(results: Club[] = [club]): PaginatedResponse<Club> {
  return { count: results.length, page: 1, page_size: 10, next: null, previous: null, results }
}

async function mountPage(results: Club[] = [club]) {
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
        ElPagination: passthroughStub('ElPagination'),
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
  })

  it('展示最新预览、价格、占位图和平台入口', async () => {
    const wrapper = await mountPage()

    expect(wrapper.get('.club-identity__title h2').text()).toBe('星光社团')
    expect(wrapper.find('.preview-item__media img').attributes('src')).toBe('https://cdn.example.com/hero.jpg')
    expect(wrapper.find('.preview-item__media img').attributes('alt')).toBe('星轨徽章图片')
    expect(wrapper.findAll('.preview-item')).toHaveLength(2)
    expect(wrapper.find('.preview-item__price').text()).toBe('￥88.00')
    expect(wrapper.find('.official-badge').exists()).toBe(false)
    expect(wrapper.find('.preview-item__placeholder')).toBeTruthy()
    expect(wrapper.find('a[aria-label^="淘宝"]').attributes('href')).toBe('https://shop.taobao.com/star')
    expect(wrapper.find('a[aria-label="自建店铺（在新窗口打开）"]').exists()).toBe(true)
    expect(wrapper.find('.enter-club-button').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('有新公告')
  })

  it('点击社团身份和预览都会打开详情', async () => {
    const wrapper = await mountPage()

    await wrapper.get('.club-identity').trigger('click')
    await wrapper.get('.preview-item').trigger('click')

    expect(pushMock).toHaveBeenCalledTimes(2)
    expect(pushMock).toHaveBeenLastCalledWith({ name: 'ClubDetail', params: { id: 1 } })
  })

  it('搜索和清空搜索会回到第一页并带上查询条件', async () => {
    const wrapper = await mountPage()
    vi.mocked(clubApi.getClubs).mockResolvedValue(pageResponse())

    const input = wrapper.get('input')
    await input.setValue('星光')
    await wrapper.get('.directory-search').trigger('submit')
    await flushPromises()
    expect(clubApi.getClubs).toHaveBeenLastCalledWith({ page: 1, page_size: 10, search: '星光' })

    await wrapper.get('.clear-input').trigger('click')
    await flushPromises()
    expect(clubApi.getClubs).toHaveBeenLastCalledWith({ page: 1, page_size: 10, search: undefined })
  })

  it('没有匹配社团时展示空状态', async () => {
    const wrapper = await mountPage([])

    expect(wrapper.find('.empty-stub').text()).toBe('暂无匹配的社团')
    expect(wrapper.find('.club-shop').exists()).toBe(false)
  })
})
