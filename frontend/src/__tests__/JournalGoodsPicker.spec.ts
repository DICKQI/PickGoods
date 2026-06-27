import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import JournalGoodsPicker from '@/components/journal/JournalGoodsPicker.vue'
import { getGoodsList } from '@/api/goods'

vi.mock('@/api/goods', () => ({
  getGoodsList: vi.fn(),
}))

describe('JournalGoodsPicker', () => {
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
})
