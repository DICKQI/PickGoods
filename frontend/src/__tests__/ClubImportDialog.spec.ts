import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import ClubImportDialog from '@/views/goods-form/components/ClubImportDialog.vue'
import type { ClubGoodsListItem } from '@/api/types'
import { getClubGoods, getClubs } from '@/api/clubs'
import { useClubImportQueueStore } from '@/stores/clubImportQueue'

vi.mock('@/api/clubs', () => ({
  getClubGoods: vi.fn(),
  getClubs: vi.fn(),
}))

const getClubsMock = vi.mocked(getClubs)
const getClubGoodsMock = vi.mocked(getClubGoods)

const passthrough = (name: string, tag = 'div') => defineComponent({
  name,
  inheritAttrs: false,
  setup(_, { slots, attrs }) {
    return () => h(tag, attrs, slots.default?.())
  },
})

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup(props, { slots, attrs }) {
    return () => props.modelValue
      ? h('section', { ...attrs, class: ['el-dialog-stub', attrs.class] }, [
        slots.header?.(),
        slots.default?.(),
        slots.footer?.(),
      ])
      : null
  },
})

const ElInputStub = defineComponent({
  name: 'ElInput',
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue', 'clear'],
  setup(props, { emit, slots, attrs }) {
    return () => h('label', attrs, [slots.prefix?.(), h('input', {
      value: props.modelValue,
      disabled: props.disabled,
      onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
    })])
  },
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  setup(_, { slots, attrs }) {
    return () => h('button', attrs, slots.default?.())
  },
})

const ElCheckboxStub = defineComponent({
  name: 'ElCheckbox',
  props: ['modelValue', 'indeterminate'],
  emits: ['change'],
  setup(props, { emit, slots, attrs }) {
    return () => h('label', attrs, [h('input', {
      type: 'checkbox',
      checked: props.modelValue,
      onChange: (event: Event) => emit('change', (event.target as HTMLInputElement).checked),
    }), slots.default?.()])
  },
})

const ElRadioGroupStub = defineComponent({
  name: 'ElRadioGroup',
  props: ['modelValue'],
  emits: ['update:modelValue', 'change'],
  setup(_, { slots, attrs }) {
    return () => h('div', attrs, slots.default?.())
  },
})

const ElRadioButtonStub = defineComponent({ name: 'ElRadioButton', setup(_, { slots }) { return () => h('button', slots.default?.()) } })
const ElPaginationStub = defineComponent({ name: 'ElPagination', setup() { return () => h('nav') } })
const ElImageStub = defineComponent({ name: 'ElImage', props: ['src', 'alt'], setup(props) { return () => h('img', { src: props.src, alt: props.alt }) } })
const ElTagStub = passthrough('ElTag', 'span')
const ElIconStub = passthrough('ElIcon', 'i')
const ElEmptyStub = passthrough('ElEmpty', 'div')

const club = {
  id: 2,
  name: '星屑社团',
  avatar: '/media/club.png',
  description: '公开目录',
  announcement: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  taobao_url: null,
  xiaohongshu_url: null,
  weidian_url: null,
  store_links: [],
  address: '',
  business_hours: '',
  goods_count: 2,
  created_at: '',
  updated_at: '',
}

const goods = [
  {
    id: 'goods-1', name: '金属徽章', description: '', ip: { id: 1, name: '测试 IP' }, characters: [{ id: 1, name: '角色', ip: { id: 1, name: '测试 IP' }, gender: 'other' as const }], category: { id: 1, name: '徽章', parent: null, path_name: '徽章', order: 0 },
    theme: null, main_photo: '/media/badge.png', additional_photos: [], public_price: '39.00', is_imported: false,
  },
  {
    id: 'goods-2', name: '亚克力立牌', description: '', ip: { id: 1, name: '测试 IP' }, characters: [], category: { id: 2, name: '立牌', parent: null, path_name: '立牌', order: 1 },
    theme: null, main_photo: null, additional_photos: [], public_price: null, is_imported: true, imported_quantity: 2,
  },
]

function mountDialog() {
  return mount(ClubImportDialog, {
    props: { modelValue: true },
    global: {
      plugins: [createPinia()],
      stubs: {
        ElDialog: ElDialogStub,
        ElInput: ElInputStub,
        ElButton: ElButtonStub,
        ElCheckbox: ElCheckboxStub,
        ElRadioGroup: ElRadioGroupStub,
        ElRadioButton: ElRadioButtonStub,
        ElPagination: ElPaginationStub,
        ElImage: ElImageStub,
        ElTag: ElTagStub,
        ElIcon: ElIconStub,
        ElEmpty: ElEmptyStub,
      },
      directives: {
        loading: () => {},
      },
    },
  })
}

describe('ClubImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    getClubsMock.mockResolvedValue({ count: 1, page: 1, page_size: 20, next: null, previous: null, results: [club] })
    getClubGoodsMock.mockResolvedValue({ count: 2, page: 1, page_size: 20, next: null, previous: null, results: goods })
  })

  it('loads paginated clubs and the first club goods with rich list metadata', async () => {
    const wrapper = mountDialog()
    await nextTick()
    await nextTick()

    expect(getClubsMock).toHaveBeenCalledWith({ page: 1, page_size: 20, search: undefined })
    expect(getClubGoodsMock).toHaveBeenCalledWith(2, {
      page: 1,
      page_size: 20,
      search: undefined,
      imported: 'all',
    })
    expect(wrapper.text()).toContain('金属徽章')
    expect(wrapper.text()).toContain('测试 IP · 徽章')
    expect(wrapper.text()).toContain('已导入 · 2件')
    expect(wrapper.find('img[src="/media/badge.png"]').exists()).toBe(true)
  })

  it('keeps selections and starts a persisted queue from the footer', async () => {
    const wrapper = mountDialog()
    await nextTick()
    await nextTick()

    await wrapper.findAll('.club-import-goods-row')[0]!.trigger('click')
    expect(wrapper.find('.club-import-footer__selection strong').text()).toBe('1')
    const buttons = wrapper.findAll('.club-import-footer__actions button')
    await buttons[1]!.trigger('click')
    await nextTick()

    const emitted = wrapper.emitted('process')
    expect(emitted).toHaveLength(1)
    const queueStore = useClubImportQueueStore()
    expect(queueStore.items).toHaveLength(1)
    expect(queueStore.items[0]?.goodsId).toBe('goods-1')
    expect(queueStore.queueId).toBe(emitted![0]![0])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
