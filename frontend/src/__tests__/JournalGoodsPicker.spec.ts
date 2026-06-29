import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import JournalGoodsPicker from '@/components/journal/JournalGoodsPicker.vue'
import { getGoodsList } from '@/api/goods'
import type { GoodsListItem } from '@/api/types'

vi.mock('@/api/goods', () => ({
  getGoodsList: vi.fn(),
}))

const goodsItem = (id: string, name: string): GoodsListItem => ({
  id,
  name,
  ip: { id: 1, name: 'IP' },
  characters: [],
  category: { id: 1, name: 'Card', parent: null, path_name: 'Card', order: 1 },
  location_path: '',
  main_photo: `/media/goods/main/${id}.png`,
  status: 'in_cabinet',
  quantity: 1,
  is_official: true,
})

describe('JournalGoodsPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('requests lightweight journal assets with image and taxonomy filters', async () => {
    vi.mocked(getGoodsList).mockResolvedValue({
      count: 0,
      page: 1,
      page_size: 18,
      next: null,
      previous: null,
      results: [],
    })

    mount(JournalGoodsPicker, {
      props: {
        ipId: 7,
        characterId: 12,
        categoryId: 3,
        themeId: 5,
        onlyWithImage: true,
      },
      global: {
        stubs: {
          'el-input': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div />' },
          'el-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
          'el-option': { template: '<option><slot /></option>' },
          'el-select': { props: ['modelValue'], emits: ['update:modelValue'], template: '<select><slot /></select>' },
          'el-skeleton': true,
          'el-empty': true,
          'el-image': true,
          'el-icon': true,
        },
      },
    })
    await flushPromises()

    expect(getGoodsList).toHaveBeenCalledWith({
      page: 1,
      page_size: 18,
      search: undefined,
      status__in: 'in_cabinet,outdoor',
      has_main_photo: true,
      fields: 'journal_asset',
      ip: 7,
      character: 12,
      category: 3,
      theme: 5,
    })
  })

  it('loads additional pages and appends results', async () => {
    vi.mocked(getGoodsList)
      .mockResolvedValueOnce({
        count: 2,
        page: 1,
        page_size: 18,
        next: 2,
        previous: null,
        results: [goodsItem('goods-1', 'Badge')],
      })
      .mockResolvedValueOnce({
        count: 2,
        page: 2,
        page_size: 18,
        next: null,
        previous: 1,
        results: [goodsItem('goods-2', 'Card')],
      })

    const wrapper = mount(JournalGoodsPicker, {
      global: {
        stubs: {
          'el-input': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div />' },
          'el-button': { emits: ['click'], template: '<button class="load-more" @click="$emit(\'click\')"><slot /></button>' },
          'el-option': { template: '<option><slot /></option>' },
          'el-select': { props: ['modelValue'], emits: ['update:modelValue'], template: '<select><slot /></select>' },
          'el-skeleton': true,
          'el-empty': true,
          'el-image': { template: '<img />' },
          'el-icon': true,
        },
      },
    })
    await flushPromises()

    await wrapper.find('.load-more').trigger('click')
    await flushPromises()

    expect(getGoodsList).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }))
    expect(wrapper.findAll('.picker-item')).toHaveLength(2)
  })

  it('records recently used goods when inserting an asset', async () => {
    vi.mocked(getGoodsList).mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 18,
      next: null,
      previous: null,
      results: [goodsItem('goods-1', 'Badge')],
    })

    const wrapper = mount(JournalGoodsPicker, {
      global: {
        stubs: {
          'el-input': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div />' },
          'el-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
          'el-option': { template: '<option><slot /></option>' },
          'el-select': { props: ['modelValue'], emits: ['update:modelValue'], template: '<select><slot /></select>' },
          'el-skeleton': true,
          'el-empty': true,
          'el-image': { template: '<img />' },
          'el-icon': true,
        },
      },
    })
    await flushPromises()

    await wrapper.find('.picker-item').trigger('click')

    const recent = JSON.parse(localStorage.getItem('journal:recent-goods') || '[]')
    expect(recent).toEqual([
      expect.objectContaining({ id: 'goods-1', name: 'Badge', main_photo: '/media/goods/main/goods-1.png' }),
    ])
  })

  it('renders recently used goods above the asset grid and inserts them again', async () => {
    localStorage.setItem('journal:recent-goods', JSON.stringify([
      { id: 'goods-recent', name: 'Recent Badge', main_photo: '/media/goods/main/recent.png' },
    ]))
    vi.mocked(getGoodsList).mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 18,
      next: null,
      previous: null,
      results: [goodsItem('goods-1', 'Badge')],
    })

    const wrapper = mount(JournalGoodsPicker, {
      global: {
        stubs: {
          'el-input': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div />' },
          'el-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
          'el-option': { template: '<option><slot /></option>' },
          'el-select': { props: ['modelValue'], emits: ['update:modelValue'], template: '<select><slot /></select>' },
          'el-skeleton': true,
          'el-empty': true,
          'el-image': { props: ['src'], template: '<img :src="src" />' },
          'el-icon': true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('.recent-goods-strip').exists()).toBe(true)
    expect(wrapper.find('.recent-goods-item').text()).toContain('Recent Badge')

    await wrapper.find('.recent-goods-item').trigger('click')

    expect(wrapper.emitted('insertGoods')?.[0]?.[0]).toMatchObject({
      id: 'goods-recent',
      name: 'Recent Badge',
      main_photo: '/media/goods/main/recent.png',
    })
  })

  it('offers sticker and upload sections beside goods assets', async () => {
    vi.mocked(getGoodsList).mockResolvedValue({
      count: 0,
      page: 1,
      page_size: 18,
      next: null,
      previous: null,
      results: [],
    })

    const wrapper = mount(JournalGoodsPicker, {
      global: {
        stubs: {
          'el-input': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div />' },
          'el-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
          'el-option': { template: '<option><slot /></option>' },
          'el-select': { props: ['modelValue'], emits: ['update:modelValue'], template: '<select><slot /></select>' },
          'el-skeleton': true,
          'el-empty': true,
          'el-image': true,
          'el-icon': true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('.picker-tabs').text()).toContain('谷子')
    expect(wrapper.find('.picker-tabs').text()).toContain('贴纸')
    expect(wrapper.find('.picker-tabs').text()).toContain('上传')

    await wrapper.find('[data-test="picker-tab-stickers"]').trigger('click')
    await wrapper.find('.decor-sticker-item').trigger('click')
    expect(wrapper.emitted('insertDecorSticker')?.[0]?.[0]).toMatchObject({
      type: 'decor',
      src: expect.stringContaining('data:image/svg+xml'),
    })
  })
})
