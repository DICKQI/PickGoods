import { computed, defineComponent, h, inject, onMounted, provide, ref, type InjectionKey, type PropType, type VNode } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PreorderManagement from '@/views/PreorderManagement.vue'
import PreorderEditorForm from '@/components/preorder/PreorderEditorForm.vue'
import ConvertGoodsForm from '@/components/preorder/ConvertGoodsForm.vue'

// jsdom 未实现 scrollIntoView：高亮定位的异步调用会抛未处理异常污染套件（既有问题）
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined
}

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessageBox: {
      ...actual.ElMessageBox,
      confirm: vi.fn().mockResolvedValue('confirm'),
      alert: vi.fn(),
    },
    ElMessage: {
      ...actual.ElMessage,
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  }
})

vi.mock('@/composables/useResponsiveDevice', () => ({
  useResponsiveDevice: () => ({ isMobile: computed(() => false) }),
}))

vi.mock('@/api/reminder', () => ({
  listPreorders: vi.fn(),
  getPreorder: vi.fn(),
  getPreorderStats: vi.fn().mockResolvedValue({
    pending_count: 0,
    due_this_month: 0,
    due_this_quarter: 0,
    converted_count: 0,
    total_pending_balance: '0.00',
  }),
  createPreorder: vi.fn(),
  updatePreorder: vi.fn(),
  deletePreorder: vi.fn(),
  markPreorderPaid: vi.fn(),
  cancelPreorder: vi.fn(),
  convertPreorderToGoods: vi.fn(),
  recognizePreorderImage: vi.fn(),
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationsRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  NOTIFICATION_TYPE_LABELS: {},
}))

vi.mock('@/api/metadata', () => ({
  getIPList: vi.fn().mockResolvedValue([{ id: 1, name: '测试IP', keywords: [] }]),
  getCharacterList: vi.fn().mockResolvedValue([]),
  getIPCharacters: vi.fn().mockResolvedValue([{ id: 11, name: '测试角色', ip: { id: 1 } }]),
  getCategoryList: vi.fn().mockResolvedValue([{ id: 21, name: '手办', parent: null, order: 0 }]),
  getThemeList: vi.fn().mockResolvedValue([]),
}))

import {
  cancelPreorder,
  convertPreorderToGoods,
  createPreorder,
  getPreorderStats,
  listPreorders,
  markPreorderPaid,
  recognizePreorderImage,
} from '@/api/reminder'
import { ElMessage } from 'element-plus'
import type { Preorder, PreorderOcrResult } from '@/api/types'

const makePreorder = (id: string, overrides: Partial<Preorder> = {}): Preorder => ({
  id,
  name: '流萤手办',
  platform: '淘宝',
  shop_name: '示例店',
  order_no: 'ORD-001',
  deposit_amount: '100.00',
  balance_amount: '50.00',
  time_granularity: 'month',
  estimated_month: '2026-08-01',
  status: 'pending',
  paid_at: null,
  goods_id: null,
  goods_name: null,
  notes: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...overrides,
})

const paginated = (results: Preorder[]) => ({
  count: results.length,
  page: 1,
  page_size: 12,
  next: null,
  previous: null,
  results,
})

// ─── Element Plus 组件 Stub ───
const ElButtonStub = defineComponent({
  props: ['disabled', 'loading', 'type', 'size', 'icon', 'text'],
  emits: ['click'],
  template: '<button class="el-button-stub" :disabled="disabled || loading" @click="$emit(\'click\', $event)"><slot /></button>',
})

const ElDialogStub = defineComponent({
  props: { modelValue: Boolean, title: String, width: String },
  emits: ['update:modelValue'],
  template: '<section v-if="modelValue" class="el-dialog-stub"><header v-if="$slots.header"><slot name="header" /></header><header v-else>{{ title }}</header><slot /><footer><slot name="footer" /></footer></section>',
})

const ElFormStub = defineComponent({
  props: ['model', 'rules', 'labelWidth'],
  methods: {
    validate: () => Promise.resolve(true),
    clearValidate: () => undefined,
  },
  template: '<form class="el-form-stub"><slot /></form>',
})

const ElFormItemStub = defineComponent({
  props: ['label', 'prop', 'required'],
  template: '<label class="el-form-item-stub"><span>{{ label }}</span><slot /></label>',
})

const ElInputStub = defineComponent({
  props: ['modelValue', 'placeholder', 'clearable', 'maxlength', 'type'],
  emits: ['update:modelValue'],
  template: '<input class="el-input-stub" :type="type || \'text\'" :placeholder="placeholder" :value="modelValue ?? \'\'" @input="$emit(\'update:modelValue\', $event.target.value)" /><slot />',
})

const ElInputNumberStub = defineComponent({
  props: ['modelValue', 'min', 'precision', 'controls', 'placeholder'],
  emits: ['update:modelValue'],
  template: '<input class="el-input-number-stub" :placeholder="placeholder" :value="modelValue ?? \'\'" @input="$emit(\'update:modelValue\', $event.target.value === \'\' ? null : Number($event.target.value))" />',
})

const ElSelectStub = defineComponent({
  props: ['modelValue', 'placeholder', 'disabled', 'filterable', 'allowCreate', 'clearable'],
  emits: ['update:modelValue', 'change'],
  methods: {
    parseValue(value: string) {
      if (value === '') return undefined
      try { return JSON.parse(value) } catch { return value }
    },
  },
  template: '<select class="el-select-stub" :disabled="disabled" :value="modelValue === undefined ? \'\' : JSON.stringify(modelValue)" @change="$emit(\'update:modelValue\', parseValue($event.target.value)); $emit(\'change\', parseValue($event.target.value))"><option value=""></option><slot /></select>',
})

const ElOptionStub = defineComponent({
  props: ['label', 'value'],
  template: '<option :value="JSON.stringify(value)">{{ label }}</option>',
})

const ElDatePickerStub = defineComponent({
  props: ['modelValue', 'type', 'valueFormat', 'placeholder', 'clearable'],
  emits: ['update:modelValue', 'change'],
  template: '<input class="el-date-picker-stub" :placeholder="placeholder" :value="modelValue || \'\'" @change="$emit(\'update:modelValue\', $event.target.value)" />',
})

const ElTreeSelectStub = defineComponent({
  props: {
    modelValue: [Number, String, null],
    data: { type: Array as PropType<Array<{ id: number; name: string; children?: unknown[] }>>, default: () => [] },
  },
  emits: ['update:modelValue', 'change'],
  computed: {
    flatOptions() {
      const flatten = (nodes: Array<{ id: number; name: string; children?: unknown[] }>): Array<{ id: number; name: string }> =>
        nodes.flatMap((node) => [node, ...(node.children ? flatten(node.children as Array<{ id: number; name: string; children?: unknown[] }>) : [])])
      return flatten(this.data)
    },
  },
  template: '<select class="el-tree-select-stub" :value="modelValue ?? \'\'" @change="$emit(\'update:modelValue\', $event.target.value ? Number($event.target.value) : undefined)"><option value=""></option><option v-for="option in flatOptions" :key="option.id" :value="option.id">{{ option.name }}</option></select>',
})

const ElRadioGroupStub = defineComponent({
  props: { modelValue: { default: '' } },
  emits: ['update:modelValue', 'change'],
  provide() {
    return {
      radioGroupModel: () => this.modelValue,
      radioGroupChange: (value: string) => {
        this.$emit('update:modelValue', value)
        this.$emit('change', value)
      },
    }
  },
  template: '<div class="el-radio-group-stub"><slot /></div>',
})

const ElRadioButtonStub = defineComponent({
  props: ['value'],
  inject: ['radioGroupModel', 'radioGroupChange'],
  template: '<button class="el-radio-button" type="button" @click="radioGroupChange(value)"><slot /></button>',
})

const ElSegmentedStub = defineComponent({
  props: {
    modelValue: { default: '' },
    options: { type: Array as PropType<Array<{ label: string; value: string }>>, default: () => [] },
  },
  emits: ['update:modelValue', 'change'],
  template:
    '<div class="el-segmented-stub"><button v-for="opt in options" :key="opt.value" type="button" :class="{ \'is-selected\': modelValue === opt.value }" @click="$emit(\'update:modelValue\', opt.value); $emit(\'change\', opt.value)">{{ opt.label }}</button></div>',
})

type ColumnRender = (scope: Record<string, unknown>) => VNode[]
const REGISTER_COLUMN_KEY: InjectionKey<(render: ColumnRender | undefined) => void> =
  Symbol('registerColumn') as unknown as InjectionKey<(render: ColumnRender | undefined) => void>

const ElTableStub = defineComponent({
  props: ['data', 'rowKey', 'rowClassName'],
  setup(props, { slots }) {
    const columns = ref<Array<{ render: ColumnRender | undefined }>>([])
    provide(REGISTER_COLUMN_KEY, (render: ColumnRender | undefined) => {
      columns.value.push({ render })
    })
    const rowClass = (row: Preorder) => {
      const fn = props.rowClassName as ((arg: { row: Preorder }) => string) | undefined
      return typeof fn === 'function' ? fn({ row }) : ''
    }
    return () => {
      const rows = ((props.data as Preorder[]) || []).map((row, index) =>
        h(
          'tr',
          { key: row.id, class: rowClass(row) },
          columns.value.map((col, ci) =>
            h('td', { key: ci }, col.render ? col.render({ row, column: {}, $index: index }) : [])
          )
        )
      )
      // 必须渲染默认插槽（列定义），否则 el-table-column 子组件不会挂载注册
      return h('table', { class: 'el-table-stub' }, [h('tbody', rows), slots.default?.()])
    }
  },
})

const ElTableColumnStub = defineComponent({
  props: ['label', 'prop', 'minWidth', 'width', 'sortable', 'fixed', 'sortBy'],
  setup(_, { slots }) {
    const register = inject(REGISTER_COLUMN_KEY)
    onMounted(() => {
      register?.((slots.default ?? undefined) as unknown as ColumnRender | undefined)
    })
    return () => null
  },
})

const ElTagStub = defineComponent({
  props: ['type', 'size', 'effect'],
  template: '<span class="el-tag-stub"><slot /></span>',
})

const ElEmptyStub = defineComponent({
  props: ['description', 'imageSize'],
  template: '<section class="el-empty-stub">{{ description }}<slot /></section>',
})

const ElAlertStub = defineComponent({
  props: ['title', 'type', 'closable', 'showIcon'],
  template: '<div class="el-alert-stub">{{ title }}<slot /></div>',
})

const ElUploadStub = defineComponent({
  props: ['showFileList', 'autoUpload', 'accept', 'onChange'],
  methods: {
    clearFiles: () => undefined,
  },
  template:
    '<div class="el-upload-stub"><button type="button" class="el-upload-trigger" @click="onChange && onChange({ raw: { name: \'order.jpg\', type: \'image/jpeg\' } })"><slot /></button></div>',
})

const mountPage = async (query: Record<string, string> = {}) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/preorders', component: { template: '<div />' } }],
  })
  await router.push({ path: '/preorders', query })
  await router.isReady()

  setActivePinia(createPinia())

  const wrapper = mount(PreorderManagement, {
    global: {
      plugins: [router],
      directives: { loading: {} },
      stubs: {
        'el-button': ElButtonStub,
        'el-dialog': ElDialogStub,
        'el-form': ElFormStub,
        'el-form-item': ElFormItemStub,
        'el-input': ElInputStub,
        'el-input-number': ElInputNumberStub,
        'el-select': ElSelectStub,
        'el-option': ElOptionStub,
        'el-date-picker': ElDatePickerStub,
        'el-tree-select': ElTreeSelectStub,
        'el-radio-group': ElRadioGroupStub,
        'el-radio-button': ElRadioButtonStub,
        'el-segmented': ElSegmentedStub,
        'el-table': ElTableStub,
        'el-table-column': ElTableColumnStub,
        'el-tag': ElTagStub,
        'el-empty': ElEmptyStub,
        'el-alert': ElAlertStub,
        'el-upload': ElUploadStub,
        'el-pagination': true,
        'el-icon': { template: '<i><slot /></i>' },
        Teleport: true,
      },
    },
  })
  return { wrapper, router }
}

// 表单逻辑已抽取到子组件：通过 defineExpose 的 editor/convert 访问状态
const getEditor = (wrapper: ReturnType<typeof mount>) =>
  (wrapper.findComponent(PreorderEditorForm).vm as unknown as { editor: any }).editor
const getConvert = (wrapper: ReturnType<typeof mount>) =>
  (wrapper.findComponent(ConvertGoodsForm).vm as unknown as { convert: any }).convert

describe('PreorderManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染预购列表（桌面表格）', async () => {
    vi.mocked(listPreorders).mockResolvedValue(
      paginated([makePreorder('p-1'), makePreorder('p-2', { status: 'paid' })]),
    )
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('流萤手办')
    expect(wrapper.text()).toContain('待补款')
    expect(wrapper.text()).toContain('已补款')
    expect(wrapper.text()).toContain('2026年8月')
    expect(wrapper.find('.el-table-stub').exists()).toBe(true)
  })

  it('按状态显隐操作按钮（状态机）', async () => {
    vi.mocked(listPreorders).mockResolvedValue(
      paginated([
        makePreorder('p-pending'),
        makePreorder('p-paid', { status: 'paid', paid_at: '2026-07-01T00:00:00Z' }),
        makePreorder('p-converted', { status: 'converted', goods_id: 'g-1', goods_name: '流萤手办' }),
      ]),
    )
    const { wrapper } = await mountPage()
    await flushPromises()
    const text = wrapper.text()
    // pending 行可标记补款 / 取消，但没有转正按钮
    expect(text).toContain('标记补款')
    expect(text).toContain('取消')
    // paid 行可转正；converted 行可查看谷子（补款不可逆，paid 行无取消）
    expect(text).toContain('转正为谷子')
    expect(text).toContain('查看谷子')
  })

  it('状态筛选改变时重新拉取并携带 status 参数', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(listPreorders).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 12,
      status: undefined,
      search: undefined,
    })
    const paidSegment = wrapper.findAll('.el-segmented-stub button').find((w) => w.text() === '已补款')!
    await paidSegment.trigger('click')
    await flushPromises()
    expect(listPreorders).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 12,
      status: 'paid',
      search: undefined,
    })
  })

  it('渲染统计概览指标（待补款/本月到期/已转正/待补尾款）', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    vi.mocked(getPreorderStats).mockResolvedValue({
      pending_count: 8,
      due_this_month: 2,
      due_this_quarter: 1,
      converted_count: 3,
      total_pending_balance: '2450.50',
    })
    const { wrapper } = await mountPage()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('待补款')
    expect(text).toContain('本月到期')
    expect(text).toContain('本季到期')
    expect(text).toContain('已转正')
    expect(text).toContain('待补尾款')
    expect(text).toContain('¥2450.50')
    expect(getPreorderStats).toHaveBeenCalledTimes(1)
  })

  it('新增对话框提交调用 createPreorder 且月份归一化为当月1日', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    vi.mocked(createPreorder).mockResolvedValue(makePreorder('p-new'))
    const { wrapper } = await mountPage()
    await flushPromises()
    const addButton = wrapper.findAll('button').find((w) => w.text().includes('新增预购'))!
    await addButton.trigger('click')
    await flushPromises()
    expect(wrapper.find('.el-dialog-stub').exists()).toBe(true)
    // 通过表单子组件暴露的编辑器状态填写（避免与 element-plus 控件内部交互耦合）
    const editor = getEditor(wrapper)
    editor.form.name = '花火手办'
    editor.form.deposit_amount = 200
    editor.form.balance_amount = 50
    editor.form.estimated_month = '2026-09'
    editor.form.platform = '淘宝'
    const saveButton = wrapper.findAll('button').find((w) => w.text() === '保存')!
    await saveButton.trigger('click')
    await flushPromises()
    expect(createPreorder).toHaveBeenCalled()
    const payload = vi.mocked(createPreorder).mock.calls[0]![0]
    expect(payload.name).toBe('花火手办')
    expect(payload.deposit_amount).toBe(200)
    expect(payload.estimated_month).toBe('2026-09-01')
  })

  it('标记补款需确认后调用接口', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    vi.mocked(markPreorderPaid).mockResolvedValue(makePreorder('p-1', { status: 'paid' }))
    const { wrapper } = await mountPage()
    await flushPromises()
    const markButton = wrapper.findAll('button').find((w) => w.text() === '标记补款')!
    await markButton.trigger('click')
    await flushPromises()
    expect(markPreorderPaid).toHaveBeenCalledWith('p-1')
  })

  it('取消预购需确认后调用接口', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    vi.mocked(cancelPreorder).mockResolvedValue(makePreorder('p-1', { status: 'cancelled' }))
    const { wrapper } = await mountPage()
    await flushPromises()
    const cancelButton = wrapper.findAll('button').find((w) => w.text() === '取消')!
    await cancelButton.trigger('click')
    await flushPromises()
    expect(cancelPreorder).toHaveBeenCalledWith('p-1')
  })

  it('转正对话框预填名称，提交调用 convertPreorderToGoods', async () => {
    vi.mocked(listPreorders).mockResolvedValue(
      paginated([makePreorder('p-1', { status: 'paid', paid_at: '2026-07-01T00:00:00Z' })]),
    )
    vi.mocked(convertPreorderToGoods).mockResolvedValue(
      makePreorder('p-1', { status: 'converted', goods_id: 'g-1', goods_name: '流萤手办' }),
    )
    const { wrapper } = await mountPage()
    await flushPromises()
    const convertButton = wrapper.findAll('button').find((w) => w.text().includes('转正为谷子'))!
    await convertButton.trigger('click')
    await flushPromises()
    expect(wrapper.find('.el-dialog-stub').exists()).toBe(true)
    // 名称预填自预购
    const convert = getConvert(wrapper)
    expect(convert.convertForm.name).toBe('流萤手办')
    // 补选 IP / 品类后提交（草稿模式角色可空）
    convert.convertForm.ip = 1
    convert.convertForm.category = 21
    convert.convertForm.characters = []
    const submitButton = wrapper.findAll('button').find((w) => w.text() === '转正')!
    await submitButton.trigger('click')
    await flushPromises()
    expect(convertPreorderToGoods).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({ name: '流萤手办', ip: 1, category: 21, status: 'draft' }),
    )
  })

  it('通知跳转带 highlight 时高亮对应行', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    const { wrapper } = await mountPage({ highlight: 'p-1' })
    await flushPromises()
    expect(wrapper.find('tr.preorder-row-highlight').exists()).toBe(true)
  })

  it('highlight 目标不在第一页时跨页定位后高亮', async () => {
    const page1 = Array.from({ length: 12 }, (_, i) =>
      makePreorder('p-' + String(i + 1).padStart(2, '0')),
    )
    vi.mocked(listPreorders)
      .mockResolvedValueOnce(paginated(page1))
      .mockResolvedValueOnce(paginated([...page1, makePreorder('p-99')]))
      .mockResolvedValueOnce(paginated([makePreorder('p-99')]))
    const { wrapper } = await mountPage({ highlight: 'p-99' })
    await flushPromises()
    // 第一次：首页列表；第二次：跨页探测（最大 page_size）；第三次：跳转目标页
    expect(listPreorders).toHaveBeenNthCalledWith(1, {
      page: 1,
      page_size: 12,
      status: undefined,
      search: undefined,
    })
    expect(listPreorders).toHaveBeenNthCalledWith(2, { page_size: 100 })
    expect(listPreorders).toHaveBeenNthCalledWith(3, {
      page: 2,
      page_size: 12,
      status: undefined,
      search: undefined,
    })
    expect(wrapper.find('tr.preorder-row-highlight').exists()).toBe(true)
  })

  it('已停留在页面时再次点击通知触发重新定位（watch query.highlight）', async () => {
    vi.mocked(listPreorders).mockResolvedValue(
      paginated([makePreorder('p-1'), makePreorder('p-2')]),
    )
    const { wrapper, router } = await mountPage()
    await flushPromises()
    expect(wrapper.find('tr.preorder-row-highlight').exists()).toBe(false)
    // 模拟通知中心点击第二条通知：仅 query 变化，组件复用
    await router.push({ path: '/preorders', query: { highlight: 'p-2' } })
    await flushPromises()
    expect(wrapper.find('tr.preorder-row-highlight').exists()).toBe(true)
    // 目标已在当前列表，直接高亮，无需重新拉取
    expect(listPreorders).toHaveBeenCalledTimes(1)
  })

  it('季度粒度预购在列表中显示季度文案', async () => {
    vi.mocked(listPreorders).mockResolvedValue(
      paginated([makePreorder('p-q', { time_granularity: 'quarter', estimated_month: '2026-07-01' })]),
    )
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('2026年 Q3')
  })

  it('按季度粒度提交时转换为季度首月', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    vi.mocked(createPreorder).mockResolvedValue(makePreorder('p-new'))
    const { wrapper } = await mountPage()
    await flushPromises()
    await wrapper.findAll('button').find((w) => w.text().includes('新增预购'))!.trigger('click')
    await flushPromises()
    const editor = getEditor(wrapper)
    editor.form.name = '季度手办'
    editor.form.deposit_amount = 300
    editor.form.time_granularity = 'quarter'
    editor.form.estimated_month = '2026-Q3'
    await wrapper.findAll('button').find((w) => w.text() === '保存')!.trigger('click')
    await flushPromises()
    const payload = vi.mocked(createPreorder).mock.calls[0]![0]
    expect(payload.time_granularity).toBe('quarter')
    expect(payload.estimated_month).toBe('2026-07-01')
  })

  it('编辑季度粒度预购时回填季度格式', async () => {
    vi.mocked(listPreorders).mockResolvedValue(
      paginated([makePreorder('p-q', { time_granularity: 'quarter', estimated_month: '2026-07-01' })]),
    )
    const { wrapper } = await mountPage()
    await flushPromises()
    const editButton = wrapper.findAll('button').find((w) => w.text() === '编辑')!
    await editButton.trigger('click')
    await flushPromises()
    const editor = getEditor(wrapper)
    expect(editor.form.time_granularity).toBe('quarter')
    expect(editor.form.estimated_month).toBe('2026-Q3')
  })

  it('季度下拉从当前季度起向后生成未来 3 年共 12 项且格式为 YYYY-Qn（契约）', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    const { wrapper } = await mountPage()
    await flushPromises()
    await wrapper.findAll('button').find((w) => w.text().includes('新增预购'))!.trigger('click')
    await flushPromises()
    const editor = getEditor(wrapper)
    const options = editor.quarterOptions.value as Array<{ label: string; value: string }>
    // 从当前季度起向后 12 个季度（未来 3 年），首项即当前季度，不含已过期季度
    const now = new Date()
    const currentQuarter = `Q${Math.floor(now.getMonth() / 3) + 1}`
    expect(options).toHaveLength(12)
    expect(options[0]?.value).toBe(`${now.getFullYear()}-${currentQuarter}`)
    expect(options[0]?.label).toBe(`${now.getFullYear()}年 ${currentQuarter}`)
    options.forEach((o) => expect(o.value).toMatch(/^\d{4}-Q[1-4]$/))
  })

  it('编辑已过期季度的记录时回填原季度并在下拉中标注（已过期）', async () => {
    vi.mocked(listPreorders).mockResolvedValue(
      paginated([makePreorder('p-old', { time_granularity: 'quarter', estimated_month: '2025-10-01' })]),
    )
    const { wrapper } = await mountPage()
    await flushPromises()
    await wrapper.findAll('button').find((w) => w.text() === '编辑')!.trigger('click')
    await flushPromises()
    const editor = getEditor(wrapper)
    expect(editor.form.time_granularity).toBe('quarter')
    expect(editor.form.estimated_month).toBe('2025-Q4')
    const expired = (editor.quarterOptions.value as Array<{ label: string; value: string }>).find(
      (o) => o.value === '2025-Q4'
    )
    expect(expired).toBeDefined()
    expect(expired?.label).toContain('已过期')
  })

  it('上传订单截图识别后自动填入表单（月粒度）', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    vi.mocked(recognizePreorderImage).mockResolvedValue({
      preorder: {
        name: '流萤粘土人手办',
        platform: '淘宝',
        shop_name: 'miHoYo旗舰店',
        order_no: '5127621876609013146',
        deposit_amount: '60',
        balance_amount: '309',
        estimated_month: '2027-04',
        time_granularity: 'month',
        raw_text: '...',
        warnings: [],
      },
    })
    const { wrapper } = await mountPage()
    await flushPromises()
    await wrapper.findAll('button').find((w) => w.text().includes('新增预购'))!.trigger('click')
    await flushPromises()
    // 识别入口默认收起：先展开面板再上传
    await wrapper.find('.preorder-ocr-toggle').trigger('click')
    await flushPromises()
    await wrapper.find('.el-upload-trigger').trigger('click')
    await flushPromises()
    const editor = getEditor(wrapper)
    expect(editor.form.name).toBe('流萤粘土人手办')
    expect(editor.form.platform).toBe('淘宝')
    expect(editor.form.shop_name).toBe('miHoYo旗舰店')
    expect(editor.form.order_no).toBe('5127621876609013146')
    expect(editor.form.deposit_amount).toBe(60)
    expect(editor.form.balance_amount).toBe(309)
    expect(editor.form.time_granularity).toBe('month')
    expect(editor.form.estimated_month).toBe('2027-04')
    expect(ElMessage.success).toHaveBeenCalledWith('已自动填入 7 个字段，请核对后保存')
  })

  it('截图识别为季度粒度时转换为表单季度值，未识别字段保留手填值', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    vi.mocked(recognizePreorderImage).mockResolvedValue({
      preorder: {
        name: '流萤粘土人手办',
        platform: null,
        shop_name: null,
        order_no: null,
        deposit_amount: '60',
        balance_amount: null,
        estimated_month: '2027-04',
        time_granularity: 'quarter',
        raw_text: '...',
        warnings: ['未识别到尾款金额，可留空后手动补充'],
      },
    })
    const { wrapper } = await mountPage()
    await flushPromises()
    await wrapper.findAll('button').find((w) => w.text().includes('新增预购'))!.trigger('click')
    await flushPromises()
    const editor = getEditor(wrapper)
    // 未识别字段（尾款）保留手填值
    editor.form.balance_amount = 123
    await wrapper.find('.preorder-ocr-toggle').trigger('click')
    await flushPromises()
    await wrapper.find('.el-upload-trigger').trigger('click')
    await flushPromises()
    expect(editor.form.name).toBe('流萤粘土人手办')
    expect(editor.form.deposit_amount).toBe(60)
    expect(editor.form.balance_amount).toBe(123)
    expect(editor.form.time_granularity).toBe('quarter')
    expect(editor.form.estimated_month).toBe('2027-Q2')
    expect(editor.ocrWarnings.value).toContain('未识别到尾款金额，可留空后手动补充')
    expect(wrapper.find('.preorder-ocr-warnings').text()).toContain('识别提示')
    expect(ElMessage.warning).toHaveBeenCalledWith('已自动填入 3 个字段，请核对下方提示')
  })

  it('截图识别失败时展示接口错误信息', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    vi.mocked(recognizePreorderImage).mockRejectedValue({
      response: { data: { detail: '未能识别到定金/尾款信息，请确认是定金订单截图' } },
    })
    const { wrapper } = await mountPage()
    await flushPromises()
    await wrapper.findAll('button').find((w) => w.text().includes('新增预购'))!.trigger('click')
    await flushPromises()
    await wrapper.find('.preorder-ocr-toggle').trigger('click')
    await flushPromises()
    await wrapper.find('.el-upload-trigger').trigger('click')
    await flushPromises()
    expect(ElMessage.error).toHaveBeenCalledWith('未能识别到定金/尾款信息，请确认是定金订单截图')
  })

  it('识别进行中重复上传会提示且不发起第二次请求', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([]))
    let resolveOcr: (value: PreorderOcrResult) => void = () => undefined
    vi.mocked(recognizePreorderImage).mockImplementation(
      () => new Promise<PreorderOcrResult>((resolve) => { resolveOcr = resolve }),
    )
    const { wrapper } = await mountPage()
    await flushPromises()
    await wrapper.findAll('button').find((w) => w.text().includes('新增预购'))!.trigger('click')
    await flushPromises()
    await wrapper.find('.preorder-ocr-toggle').trigger('click')
    await flushPromises()
    await wrapper.find('.el-upload-trigger').trigger('click')
    await flushPromises()
    await wrapper.find('.el-upload-trigger').trigger('click')
    await flushPromises()
    expect(recognizePreorderImage).toHaveBeenCalledTimes(1)
    expect(ElMessage.warning).toHaveBeenCalledWith('正在识别中，请稍候再上传')
    resolveOcr({
      preorder: {
        name: '流萤粘土人手办',
        deposit_amount: '60',
        balance_amount: null,
        estimated_month: '2027-04',
        time_granularity: 'month',
        raw_text: '',
        warnings: [],
      },
    })
    await flushPromises()
  })

  it('对话框关闭后迟到的识别结果不会污染编辑表单（会话守卫）', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    let resolveOcr: (value: PreorderOcrResult) => void = () => undefined
    vi.mocked(recognizePreorderImage).mockImplementation(
      () => new Promise<PreorderOcrResult>((resolve) => { resolveOcr = resolve }),
    )
    const { wrapper } = await mountPage()
    await flushPromises()
    // 新增对话框 → 展开识别面板 → 触发识别（请求挂起）
    await wrapper.findAll('button').find((w) => w.text().includes('新增预购'))!.trigger('click')
    await flushPromises()
    await wrapper.find('.preorder-ocr-toggle').trigger('click')
    await flushPromises()
    await wrapper.find('.el-upload-trigger').trigger('click')
    await flushPromises()
    // 关闭对话框 → 打开编辑 p-1（会话切换）
    await wrapper.find('.preorder-editor-cancel').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((w) => w.text() === '编辑')!.trigger('click')
    await flushPromises()
    const editor = getEditor(wrapper)
    expect(editor.form.name).toBe('流萤手办')
    // 迟到响应返回：不得覆盖编辑表单
    resolveOcr({
      preorder: {
        name: '流萤粘土人手办',
        deposit_amount: '60',
        balance_amount: null,
        estimated_month: '2027-04',
        time_granularity: 'month',
        raw_text: '',
        warnings: [],
      },
    })
    await flushPromises()
    expect(editor.form.name).toBe('流萤手办')
    expect(editor.form.deposit_amount).toBe(100)
  })

  it('旧识别请求的 finally 不清空新会话的上传文件（会话守卫）', async () => {
    vi.mocked(listPreorders).mockResolvedValue(paginated([makePreorder('p-1')]))
    let resolveOcr: (value: PreorderOcrResult) => void = () => undefined
    vi.mocked(recognizePreorderImage).mockImplementation(
      () => new Promise<PreorderOcrResult>((resolve) => { resolveOcr = resolve }),
    )
    const { wrapper } = await mountPage()
    await flushPromises()
    // 新增对话框 → 展开识别面板 → 触发识别（请求挂起）
    await wrapper.findAll('button').find((w) => w.text().includes('新增预购'))!.trigger('click')
    await flushPromises()
    await wrapper.find('.preorder-ocr-toggle').trigger('click')
    await flushPromises()
    await wrapper.find('.el-upload-trigger').trigger('click')
    await flushPromises()
    // 关闭对话框 → 打开编辑 p-1（会话切换）→ 展开识别面板，拿到新会话的 upload 实例
    await wrapper.find('.preorder-editor-cancel').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((w) => w.text() === '编辑')!.trigger('click')
    await flushPromises()
    await wrapper.find('.preorder-ocr-toggle').trigger('click')
    await flushPromises()
    const upload = getEditor(wrapper).ocrUploadRef.value
    expect(upload).toBeTruthy()
    const clearSpy = vi.spyOn(upload, 'clearFiles')
    // 迟到响应返回：新会话的上传文件列表不得被旧请求的 finally 清空
    resolveOcr({
      preorder: {
        name: '流萤粘土人手办',
        deposit_amount: '60',
        balance_amount: null,
        estimated_month: '2027-04',
        time_granularity: 'month',
        raw_text: '',
        warnings: [],
      },
    })
    await flushPromises()
    expect(clearSpy).not.toHaveBeenCalled()
  })
})
