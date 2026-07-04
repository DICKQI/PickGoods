import { defineComponent, h, inject, nextTick, provide } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GoodsCraftManagement from '@/views/admin/GoodsCraftManagement.vue'
import {
  createAdminGoodsCraft,
  deleteAdminGoodsCraft,
  getAdminGoodsCrafts,
  updateAdminGoodsCraft,
} from '@/api/admin'

vi.mock('@/api/admin', () => ({
  getAdminGoodsCrafts: vi.fn(async () => ({
    count: 1,
    results: [
      {
        id: 1,
        name: '烫金',
        order: 10,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
  })),
  createAdminGoodsCraft: vi.fn(async data => ({
    id: 2,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...data,
  })),
  updateAdminGoodsCraft: vi.fn(async (_id, data) => ({
    id: _id,
    name: 'updated',
    order: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...data,
  })),
  deleteAdminGoodsCraft: vi.fn(async () => undefined),
}))

vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
    },
    ElMessageBox: {
      confirm: vi.fn(async () => undefined),
    },
  }
})

vi.mock('@/utils/datetime', () => ({
  formatDateTime: (value: string) => value,
}))

const passthroughStub = (name: string, tag = 'div') => defineComponent({
  name,
  setup(_, { slots }) {
    return () => h(tag, slots.default?.())
  },
})

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { slots, expose }) {
    expose({
      validate: vi.fn(async () => true),
    })
    return () => h('form', slots.default?.())
  },
})

const ElInputStub = defineComponent({
  name: 'ElInput',
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue', 'keyup', 'clear'],
  setup(props, { emit, slots }) {
    return () => h('label', [
      h('input', {
        placeholder: props.placeholder,
        value: props.modelValue ?? '',
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
        onKeyup: (event: KeyboardEvent) => emit('keyup', event),
      }),
      h('button', { type: 'button', class: 'clear-input', onClick: () => emit('clear') }, 'clear'),
      slots.prefix?.(),
    ])
  },
})

const ElTableStub = defineComponent({
  name: 'ElTable',
  props: ['data'],
  setup(props, { slots }) {
    const TableRowRenderer = defineComponent({
      name: 'TableRowRenderer',
      props: ['row'],
      setup(rowProps) {
        provide('tableRow', rowProps.row)
        return () => h('div', { class: 'table-row' }, slots.default?.())
      },
    })
    return () => h('div', (props.data ?? []).map((row: any) => h(TableRowRenderer, { row })))
  },
})

const ElTableColumnStub = defineComponent({
  name: 'ElTableColumn',
  props: ['prop', 'label'],
  setup(props, { slots }) {
    const row = inject<any>('tableRow', null)
    return () => h('div', { class: `column-${props.label ?? props.prop ?? 'default'}` }, slots.default?.({ row }))
  },
})

const ElPaginationStub = defineComponent({
  name: 'ElPagination',
  props: ['currentPage', 'pageSize'],
  emits: ['update:currentPage', 'update:pageSize', 'size-change', 'current-change'],
  setup(_, { emit }) {
    return () => h('div', [
      h('button', {
        type: 'button',
        class: 'change-page-size',
        onClick: () => {
          emit('update:pageSize', 50)
          emit('size-change', 50)
        },
      }, 'size'),
      h('button', {
        type: 'button',
        class: 'change-page',
        onClick: () => {
          emit('update:currentPage', 2)
          emit('current-change', 2)
        },
      }, 'page'),
    ])
  },
})

const mountGoodsCraftManagement = () => mount(GoodsCraftManagement, {
  global: {
    directives: {
      loading: {},
    },
    stubs: {
      AdminPageHeader: passthroughStub('AdminPageHeader'),
      ElButton: passthroughStub('ElButton', 'button'),
      ElIcon: passthroughStub('ElIcon'),
      ElInput: ElInputStub,
      ElCard: passthroughStub('ElCard'),
      ElEmpty: passthroughStub('ElEmpty'),
      ElTable: ElTableStub,
      ElTableColumn: ElTableColumnStub,
      ElTag: passthroughStub('ElTag', 'span'),
      ElPagination: ElPaginationStub,
      ElDialog: passthroughStub('ElDialog'),
      ElForm: ElFormStub,
      ElFormItem: passthroughStub('ElFormItem'),
      ElInputNumber: passthroughStub('ElInputNumber', 'input'),
      ElSwitch: passthroughStub('ElSwitch', 'input'),
    },
  },
})

describe('GoodsCraftManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads goods crafts on mount', async () => {
    mountGoodsCraftManagement()
    await vi.waitFor(() => {
      expect(getAdminGoodsCrafts).toHaveBeenCalledWith({
        page: 1,
        page_size: 20,
        search: undefined,
      })
    })
  })

  it('submits create, update, and delete actions with API payloads', async () => {
    const wrapper = mountGoodsCraftManagement()
    await vi.waitFor(() => expect(getAdminGoodsCrafts).toHaveBeenCalled())

    await (wrapper.vm as any).handleAdd()
    ;(wrapper.vm as any).formData.name = '镭射'
    ;(wrapper.vm as any).formData.order = 30
    ;(wrapper.vm as any).formData.is_active = true
    await (wrapper.vm as any).handleSubmit()
    expect(createAdminGoodsCraft).toHaveBeenCalledWith({
      name: '镭射',
      order: 30,
      is_active: true,
    })

    await (wrapper.vm as any).handleEdit({
      id: 1,
      name: '烫金',
      order: 10,
      is_active: true,
    })
    ;(wrapper.vm as any).formData.name = '烫银'
    ;(wrapper.vm as any).formData.order = 5
    ;(wrapper.vm as any).formData.is_active = false
    await (wrapper.vm as any).handleSubmit()
    expect(updateAdminGoodsCraft).toHaveBeenCalledWith(1, {
      name: '烫银',
      order: 5,
      is_active: false,
    })

    await (wrapper.vm as any).handleDelete({ id: 1, name: '烫银' })
    expect(deleteAdminGoodsCraft).toHaveBeenCalledWith(1)
  })

  it('rejects blank craft names after trimming on the client', async () => {
    const wrapper = mountGoodsCraftManagement()
    const rule = (wrapper.vm as any).formRules.name.find((item: any) => item.validator)

    await expect(new Promise((resolve, reject) => {
      rule.validator({}, '   ', (error?: Error) => {
        if (error) reject(error)
        else resolve(undefined)
      })
    })).rejects.toThrow('请输入工艺名称')
  })

  it('wires search, table actions, and pagination through the rendered template', async () => {
    const wrapper = mountGoodsCraftManagement()
    await vi.waitFor(() => expect(getAdminGoodsCrafts).toHaveBeenCalled())

    vi.mocked(getAdminGoodsCrafts).mockClear()
    const searchInput = wrapper.get('input[placeholder="搜索工艺名称..."]')
    await searchInput.setValue('烫')
    await wrapper.get('.admin-search-flex button').trigger('click')
    expect(getAdminGoodsCrafts).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      search: '烫',
    })

    vi.mocked(getAdminGoodsCrafts).mockClear()
    await wrapper.get('.change-page-size').trigger('click')
    await nextTick()
    expect(getAdminGoodsCrafts).toHaveBeenCalledWith({
      page: 1,
      page_size: 50,
      search: '烫',
    })

    vi.mocked(updateAdminGoodsCraft).mockClear()
    await wrapper.get('button[title="停用"]').trigger('click')
    expect(updateAdminGoodsCraft).toHaveBeenCalledWith(1, { is_active: false })

    vi.mocked(deleteAdminGoodsCraft).mockClear()
    await wrapper.get('button[title="删除"]').trigger('click')
    expect(deleteAdminGoodsCraft).toHaveBeenCalledWith(1)
  })
})
