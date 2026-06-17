import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GoodsForm from '@/views/GoodsForm.vue'
import { classifyGoodsImage, createGoods } from '@/api/goods'

const pushMock = vi.fn()
let routeParams: Record<string, string | undefined> = {}

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
    back: vi.fn(),
  }),
  useRoute: () => ({
    params: routeParams,
  }),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}))

vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: vi.fn(),
  },
  CameraResultType: {
    Uri: 'uri',
  },
  CameraSource: {
    Camera: 'camera',
    Photos: 'photos',
  },
}))

vi.mock('@/api/metadata', () => ({
  getIPList: vi.fn(async () => [{ id: 1, name: '咒术回战' }]),
  getCharacterList: vi.fn(async () => [{ id: 10, name: '五条悟', ip: { id: 1, name: '咒术回战' } }]),
  getCategoryList: vi.fn(async () => [{ id: 100, name: '吧唧', parent: null, order: 0 }]),
  getThemeList: vi.fn(async () => []),
  createTheme: vi.fn(async ({ name }: { name: string }) => ({ id: 7, name })),
}))

vi.mock('@/api/goods', () => ({
  createGoods: vi.fn(async () => ({ id: 'new-id', saved_as_draft: false, merged: false })),
  updateGoods: vi.fn(async () => ({})),
  getGoodsDetail: vi.fn(async () => ({
    name: '已有谷子',
    ip: { id: 1, name: '咒术回战' },
    characters: [{ id: 10, name: '五条悟' }],
    category: { id: 100, name: '吧唧' },
    theme: null,
    status: 'in_cabinet',
    location: null,
    quantity: 1,
    price: null,
    purchase_date: '',
    is_official: false,
    notes: '',
    main_photo: '',
    additional_photos: [],
  })),
  uploadMainPhoto: vi.fn(async () => ({})),
  recognizeOrderImage: vi.fn(async () => ({})),
  classifyGoodsImage: vi.fn(async () => ({
    shape_type: 'round',
    confidence: 0.82,
    suggestions: [{ id: 100, name: '吧唧', path_name: '吧唧' }],
  })),
}))

vi.mock('@/stores/location', () => ({
  useLocationStore: () => ({
    treeData: [],
    fetchNodes: vi.fn(async () => undefined),
  }),
}))

const isMissing = (value: unknown) => {
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'string') return value.trim() === ''
  return value === undefined || value === null
}

const ElFormStub = defineComponent({
  name: 'ElForm',
  props: {
    model: {
      type: Object,
      required: true,
    },
  },
  setup(props, { slots, expose }) {
    const validateFields = (fields?: string | string[]) => {
      const fieldList = Array.isArray(fields) ? fields : fields ? [fields] : ['name', 'ip', 'characters', 'category', 'status']
      const invalid = fieldList.some((field) => isMissing((props.model as Record<string, unknown>)[field]))
      return invalid ? Promise.reject(new Error('invalid form')) : Promise.resolve(true)
    }

    expose({
      validate: () => validateFields(),
      validateField: validateFields,
      resetFields: vi.fn(),
    })

    return () => h('form', { class: 'goods-el-form' }, slots.default?.())
  },
})

const ElFormItemStub = defineComponent({
  name: 'ElFormItem',
  props: {
    label: String,
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'el-form-item' }, [
      props.label ? h('label', { class: 'el-form-item__label' }, props.label) : null,
      slots.default?.(),
    ])
  },
})

const passthroughStub = (name: string, tag = 'div') => defineComponent({
  name,
  setup(_, { slots }) {
    return () => h(tag, slots.default?.())
  },
})

const mountGoodsForm = async ({
  width,
  height,
  maxTouchPoints,
  params = {},
}: {
  width: number
  height: number
  maxTouchPoints: number
  params?: Record<string, string | undefined>
}) => {
  routeParams = params
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints })
  window.scrollTo = vi.fn()
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('pointer: coarse') ? maxTouchPoints > 0 : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))

  const wrapper = mount(GoodsForm, {
    global: {
      stubs: {
        ElForm: ElFormStub,
        ElFormItem: ElFormItemStub,
        ElRow: passthroughStub('ElRow'),
        ElCol: passthroughStub('ElCol'),
        ElInput: defineComponent({
          name: 'ElInput',
          props: ['modelValue', 'placeholder'],
          emits: ['update:modelValue'],
          setup(props, { emit }) {
            return () => h('input', {
              placeholder: props.placeholder,
              value: props.modelValue,
              onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
            })
          },
        }),
        ElSelect: passthroughStub('ElSelect'),
        ElOption: passthroughStub('ElOption'),
        ElTreeSelect: passthroughStub('ElTreeSelect'),
        ElRadioGroup: passthroughStub('ElRadioGroup'),
        ElRadioButton: passthroughStub('ElRadioButton', 'button'),
        ElInputNumber: passthroughStub('ElInputNumber'),
        ElDatePicker: passthroughStub('ElDatePicker'),
        ElSwitch: passthroughStub('ElSwitch'),
        ElUpload: passthroughStub('ElUpload'),
        ElButton: passthroughStub('ElButton', 'button'),
        ElDropdown: passthroughStub('ElDropdown'),
        ElDropdownMenu: passthroughStub('ElDropdownMenu'),
        ElDropdownItem: passthroughStub('ElDropdownItem'),
        ElDrawer: passthroughStub('ElDrawer'),
        ElDialog: passthroughStub('ElDialog'),
        ElImage: passthroughStub('ElImage'),
        ElImageViewer: passthroughStub('ElImageViewer'),
        ElIcon: passthroughStub('ElIcon', 'i'),
        ElTag: passthroughStub('ElTag', 'span'),
        ImageCropper: true,
        OcrBatchImportDialog: true,
        OcrFillDialog: true,
      },
    },
  })

  await nextTick()
  return wrapper
}

const fillRequiredBasicFields = async (wrapper: any) => {
  const vm = wrapper.vm as any
  vm.formData.name = '亚克力立牌'
  vm.formData.ip = 1
  vm.formData.characters = [10]
  vm.formData.category = 100
  vm.formData.status = 'in_cabinet'
  await nextTick()
}

const flushAsyncWork = async () => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

describe('GoodsForm mobile create wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeParams = {}
  })

  it('renders mobile creation as a step wizard starting with basic information only', async () => {
    const wrapper = await mountGoodsForm({
      width: 390,
      height: 844,
      maxTouchPoints: 1,
    })

    expect(wrapper.classes()).not.toContain('goods-form--desktop-workbench')
    expect(wrapper.find('.desktop-action-footer').exists()).toBe(false)
    expect(wrapper.text()).toContain('基础信息')
    expect(wrapper.text()).toContain('1/4')
    expect(wrapper.text()).toContain('下一步')
    expect(wrapper.find('.form-section--basic').isVisible()).toBe(true)
    expect(wrapper.find('.form-section--basic .form-section-title-text').text()).toBe('基础信息')
    expect(wrapper.find('.form-section--basic .form-section-header-copy').text()).toContain('IP、角色与品类等核心信息')
    expect(wrapper.find('.form-section--meta').isVisible()).toBe(false)
    expect(wrapper.find('.form-section--images').isVisible()).toBe(false)
    expect(wrapper.find('.form-section--notes').isVisible()).toBe(false)
  })

  it('adds animated section transition wrappers and a subtle primary action in mobile creation', async () => {
    const wrapper = await mountGoodsForm({
      width: 390,
      height: 844,
      maxTouchPoints: 1,
    })

    expect(wrapper.findAll('.create-wizard-section-stage')).toHaveLength(4)
    const primaryButtonClasses = wrapper.get('button.mobile-form-dock-btn--publish').classes()
    expect(primaryButtonClasses).toContain('mobile-form-dock-btn--subtle')
    expect(primaryButtonClasses).not.toContain('mobile-form-dock-btn--glass')
    expect(primaryButtonClasses).not.toContain('mobile-form-dock-btn--champagne')
  })

  it('uses stacked section header copy on narrow mobile screens', async () => {
    const wrapper = await mountGoodsForm({
      width: 360,
      height: 800,
      maxTouchPoints: 1,
    })

    const header = wrapper.get('.form-section--basic .form-section-header')
    expect(header.classes()).toContain('form-section-header--stacked')
    expect(header.find('.form-section-title-text').text()).toBe('基础信息')
    expect(header.find('.form-section-subtitle').text()).toBe('IP、角色与品类等核心信息')
  })

  it('keeps mobile edit mode as the full single-page form', async () => {
    const wrapper = await mountGoodsForm({
      width: 390,
      height: 844,
      maxTouchPoints: 1,
      params: { id: 'existing-id' },
    })

    expect(wrapper.text()).toContain('编辑谷子')
    expect(wrapper.text()).toContain('基础信息')
    expect(wrapper.text()).toContain('数量与购入')
    expect(wrapper.text()).toContain('图片')
    expect(wrapper.text()).toContain('备注')
    expect(wrapper.text()).not.toContain('1/4')
  })

  it('编辑已有谷子确认主图时不触发图片品类识别', async () => {
    const wrapper = await mountGoodsForm({
      width: 390,
      height: 844,
      maxTouchPoints: 1,
      params: { id: 'existing-id' },
    })
    vi.mocked(classifyGoodsImage).mockClear()

    const file = new File(['image'], 'main.png', { type: 'image/png' })
    ;(wrapper.vm as any).handleCropDialogConfirm(file, 'blob:preview')
    await flushAsyncWork()

    expect(vi.mocked(classifyGoodsImage)).not.toHaveBeenCalled()
  })

  it('新建时已有品类不会再次触发图片品类识别', async () => {
    const wrapper = await mountGoodsForm({
      width: 390,
      height: 844,
      maxTouchPoints: 1,
    })
    const vm = wrapper.vm as any
    vm.formData.category = 100
    await nextTick()

    const file = new File(['image'], 'main.png', { type: 'image/png' })
    vm.handleCropDialogConfirm(file, 'blob:preview')
    await flushAsyncWork()

    expect(vi.mocked(classifyGoodsImage)).not.toHaveBeenCalled()
  })

  it('移除主图时清空图片品类识别建议', async () => {
    const wrapper = await mountGoodsForm({
      width: 390,
      height: 844,
      maxTouchPoints: 1,
    })
    const vm = wrapper.vm as any

    const file = new File(['image'], 'main.png', { type: 'image/png' })
    vm.handleCropDialogConfirm(file, 'blob:preview')
    await flushAsyncWork()

    expect(vm.classifyResult?.suggestions?.length).toBe(1)
    vm.handleMainPhotoRemove()
    await nextTick()

    expect(vm.classifyResult).toBeNull()
  })

  it('keeps desktop creation as the full single-page form', async () => {
    const wrapper = await mountGoodsForm({
      width: 1024,
      height: 768,
      maxTouchPoints: 0,
    })

    expect(wrapper.text()).toContain('新增谷子')
    expect(wrapper.classes()).toContain('goods-form--desktop-workbench')
    expect(wrapper.find('.goods-form-workbench').exists()).toBe(true)
    expect(wrapper.find('.goods-form-main-column').exists()).toBe(true)
    expect(wrapper.find('.goods-form-side-column').exists()).toBe(true)
    expect(wrapper.text()).toContain('基础信息')
    expect(wrapper.text()).toContain('数量与购入')
    expect(wrapper.text()).toContain('图片')
    expect(wrapper.text()).toContain('备注')
    expect(wrapper.text()).not.toContain('1/4')
  })

  it('submits a desktop draft through the image card action footer', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })

    await fillRequiredBasicFields(wrapper)

    const actionFooter = wrapper.get('.form-section--images .desktop-action-footer')
    const actionButtons = actionFooter.findAll('.sticky-btn--secondary')
    expect(actionButtons).toHaveLength(4)

    await actionButtons[3]!.trigger('click')
    await nextTick()
    await Promise.resolve()

    expect(vi.mocked(createGoods)).toHaveBeenCalledWith(expect.objectContaining({
      name: '亚克力立牌',
      ip_id: 1,
      category_id: 100,
      status: 'draft',
    }))
    expect(vi.mocked(createGoods)).toHaveBeenCalledWith(expect.not.objectContaining({
      merge_strategy: 'auto',
    }))
  })

  it('renders desktop actions as an image card footer', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })

    const actionFooter = wrapper.get('.form-section--images .desktop-action-footer')
    expect(actionFooter.find('.desktop-action-footer__minor').exists()).toBe(true)
    expect(actionFooter.find('.desktop-action-footer__primary').exists()).toBe(true)
    expect(wrapper.find('.sticky-action-bar--side-dock').exists()).toBe(false)
    expect(wrapper.find('.goods-el-form + .sticky-action-bar').exists()).toBe(false)
  })

  it('stacks desktop image upload zones inside the right rail', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })

    const mediaStack = wrapper.get('.goods-form-side-column .goods-form-media-stack')
    expect(mediaStack.find('.goods-form-main-photo-pane').exists()).toBe(true)
    expect(mediaStack.find('.goods-form-additional-photos-pane').exists()).toBe(true)
    expect(mediaStack.find('.main-photo-card-shell').exists()).toBe(true)
    expect(mediaStack.find('.additional-photos-section').exists()).toBe(true)
  })

  it('uses a desktop metadata field grid with row spacing hook', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })

    const metaSection = wrapper.get('.form-section--meta')
    expect(metaSection.find('.meta-field-grid').exists()).toBe(true)
  })

  it('does not advance from the basic step when required fields are missing', async () => {
    const wrapper = await mountGoodsForm({
      width: 390,
      height: 844,
      maxTouchPoints: 1,
    })

    await wrapper.get('button.mobile-form-dock-btn--publish').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('基础信息')
    expect(wrapper.text()).toContain('1/4')
    expect(wrapper.find('.form-section--basic').isVisible()).toBe(true)
    expect(wrapper.find('.form-section--meta').isVisible()).toBe(false)
  })

  it('advances step by step when each step is valid', async () => {
    const wrapper = await mountGoodsForm({
      width: 390,
      height: 844,
      maxTouchPoints: 1,
    })

    await fillRequiredBasicFields(wrapper)
    await wrapper.get('button.mobile-form-dock-btn--publish').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('2/4')
    expect(wrapper.find('.form-section--meta').isVisible()).toBe(true)

    await wrapper.get('button.mobile-form-dock-btn--publish').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('3/4')
    expect(wrapper.find('.form-section--images').isVisible()).toBe(true)

    await wrapper.get('button.mobile-form-dock-btn--publish').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('4/4')
    expect(wrapper.find('.form-section--notes').isVisible()).toBe(true)
    expect(wrapper.text()).toContain('保存草稿')
    expect(wrapper.text()).toContain('发布')
  })

  it('publishes from the final wizard step through the existing submit path', async () => {
    const wrapper = await mountGoodsForm({
      width: 390,
      height: 844,
      maxTouchPoints: 1,
    })

    await fillRequiredBasicFields(wrapper)
    await wrapper.get('button.mobile-form-dock-btn--publish').trigger('click')
    await wrapper.get('button.mobile-form-dock-btn--publish').trigger('click')
    await wrapper.get('button.mobile-form-dock-btn--publish').trigger('click')
    await wrapper.get('button.mobile-form-dock-btn--publish').trigger('click')
    await nextTick()
    await Promise.resolve()

    expect(vi.mocked(createGoods)).toHaveBeenCalledWith(expect.objectContaining({
      name: '亚克力立牌',
      ip_id: 1,
      character_ids: [10],
      category_id: 100,
      merge_strategy: 'auto',
    }))
  })
})
