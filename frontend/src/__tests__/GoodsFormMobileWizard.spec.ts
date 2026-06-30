import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GoodsForm from '@/views/GoodsForm.vue'
import { classifyGoodsImage, createGoods, updateGoods } from '@/api/goods'
import { copyThemeImagesFromGoods, getThemeTemplate, patchTheme, saveThemeTemplate } from '@/api/metadata'
import { ElMessage, ElMessageBox } from 'element-plus'
import { updateBaseURL } from '@/utils/request'
import type { ThemeTemplatePayload } from '@/api/types'

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
  getCharacterList: vi.fn(async () => [
    { id: 10, name: '五条悟', ip: { id: 1, name: '咒术回战' } },
    { id: 11, name: '夏油杰', ip: { id: 1, name: '咒术回战' } },
  ]),
  getCategoryList: vi.fn(async () => [
    { id: 100, name: '吧唧', parent: null, path_name: '吧唧', order: 0 },
    { id: 101, name: '圆形吧唧', parent: 100, path_name: '吧唧/圆形吧唧', order: 0 },
    { id: 102, name: '75mm吧唧', parent: 101, path_name: '吧唧/圆形吧唧/75mm吧唧', order: 0 },
    { id: 200, name: '镭射票', parent: null, path_name: '镭射票', order: 1 },
  ]),
  getThemeList: vi.fn(async () => [{ id: 6, name: '群星邀约', description: null }]),
  createTheme: vi.fn(async ({ name }: { name: string }) => ({ id: 7, name })),
  patchTheme: vi.fn(async (id: number, data: any) => ({ id, name: 'patched-theme', ...data })),
  getThemeTemplate: vi.fn(async () => ({ template: null, images: [] })),
  saveThemeTemplate: vi.fn(async (_themeId: number, data: any) => ({
    id: 1,
    theme: _themeId,
    ...data,
    ip: { id: data.ip_id, name: '咒术回战' },
    characters: data.character_ids.map((id: number) => ({
      id,
      name: id === 10 ? '五条悟' : '夏油杰',
      ip: { id: data.ip_id, name: '咒术回战' },
      avatar: null,
      gender: 'other',
    })),
  })),
  copyThemeImagesFromGoods: vi.fn(async () => ({ copied_count: 0 })),
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
    recentNodes: [],
    favoriteNodes: [],
    fetchNodes: vi.fn(async () => undefined),
    markRecentLocation: vi.fn(),
  }),
}))

vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
    ElMessageBox: {
      confirm: vi.fn(async () => undefined),
    },
  }
})

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
          props: ['modelValue', 'placeholder', 'size'],
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

const existingTemplatePayload: ThemeTemplatePayload = {
  template: {
    id: 1,
    theme: 7,
    name: '模板谷子',
    ip: { id: 1, name: '咒术回战' },
    characters: [
      { id: 10, name: '五条悟', ip: { id: 1, name: '咒术回战' }, avatar: null, gender: 'other' },
      { id: 11, name: '夏油杰', ip: { id: 1, name: '咒术回战' }, avatar: null, gender: 'other' },
    ],
    purchase_date: '2026-06-18',
    is_official: true,
    notes: '模板备注',
    created_at: '2026-06-18T00:00:00Z',
    updated_at: '2026-06-18T00:00:00Z',
  },
  images: [],
}

describe('GoodsForm mobile create wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeParams = {}
    vi.mocked(ElMessageBox.confirm).mockResolvedValue(undefined as never)
    vi.mocked(getThemeTemplate).mockResolvedValue({ template: null, images: [] })
    vi.mocked(patchTheme).mockClear()
    vi.mocked(patchTheme).mockResolvedValue({ id: 7, name: 'patched-theme' } as any)
    vi.mocked(saveThemeTemplate).mockClear()
    vi.mocked(copyThemeImagesFromGoods).mockClear()
    updateBaseURL('http://api.test')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['theme-image'], { type: 'image/jpeg' }),
    })))
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:theme-image')
    globalThis.URL.revokeObjectURL = vi.fn()
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

  it('auto-fills an empty goods name from one character, existing theme, and root category', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    vm.formData.name = ''
    vm.formData.ip = 1
    vm.formData.characters = [10]
    vm.formData.category = 200
    vm.formData.theme = 6
    await flushAsyncWork()

    expect(vm.formData.name).toBe('五条悟《群星邀约》镭射票')
  })

  it('uses the root category name when auto-filling from a child category', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    vm.formData.name = ''
    vm.formData.ip = 1
    vm.formData.characters = [10]
    vm.formData.category = 102
    vm.formData.theme = 6
    await flushAsyncWork()

    expect(vm.formData.name).toBe('五条悟《群星邀约》吧唧')
  })

  it('auto-fills from a newly typed theme name', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    vm.formData.name = ''
    vm.formData.ip = 1
    vm.formData.characters = [10]
    vm.formData.category = 200
    await vm.handleThemeChange('新主题')
    await flushAsyncWork()

    expect(vm.formData.name).toBe('五条悟《新主题》镭射票')
  })

  it('keeps auto-generated names in sync until the user edits the name', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    vm.formData.name = ''
    vm.formData.ip = 1
    vm.formData.characters = [10]
    vm.formData.category = 200
    vm.formData.theme = 6
    await flushAsyncWork()
    expect(vm.formData.name).toBe('五条悟《群星邀约》镭射票')

    vm.formData.category = 102
    await flushAsyncWork()
    expect(vm.formData.name).toBe('五条悟《群星邀约》吧唧')

    vm.formData.name = '用户自己写的名称'
    await flushAsyncWork()
    vm.formData.category = 200
    vm.formData.theme = '另一个主题'
    await flushAsyncWork()

    expect(vm.formData.name).toBe('用户自己写的名称')
  })

  it('allows auto-filling again after the user clears the name', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    vm.formData.name = '用户自己写的名称'
    await flushAsyncWork()
    vm.formData.ip = 1
    vm.formData.characters = [10]
    vm.formData.category = 200
    vm.formData.theme = 6
    await flushAsyncWork()
    expect(vm.formData.name).toBe('用户自己写的名称')

    vm.formData.name = ''
    await flushAsyncWork()

    expect(vm.formData.name).toBe('五条悟《群星邀约》镭射票')
  })

  it('does not auto-fill for multiple characters and clears an old auto-generated name', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    vm.formData.name = ''
    vm.formData.ip = 1
    vm.formData.characters = [10]
    vm.formData.category = 200
    vm.formData.theme = 6
    await flushAsyncWork()
    expect(vm.formData.name).toBe('五条悟《群星邀约》镭射票')

    vm.formData.characters = [10, 11]
    await flushAsyncWork()

    expect(vm.formData.name).toBe('')
  })

  it('asks to save a theme template after publishing with a theme created in this form', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    await fillRequiredBasicFields(wrapper)
    vm.formData.name = '新主题谷子'
    vm.formData.theme = '夏日主题'
    vm.formData.purchase_date = '2026-06-18'
    vm.formData.is_official = true
    vm.formData.notes = '模板备注'
    await nextTick()

    await vm.submitByMode('publish')
    await flushAsyncWork()

    expect(vi.mocked(createGoods)).toHaveBeenCalledWith(expect.objectContaining({
      theme_id: 7,
      merge_strategy: 'auto',
    }))
    expect(vi.mocked(ElMessageBox.confirm)).toHaveBeenCalledWith(
      expect.stringContaining('主题模板'),
      expect.any(String),
      expect.any(Object),
    )
    expect(vi.mocked(saveThemeTemplate)).toHaveBeenCalledWith(7, {
      name: '新主题谷子',
      ip_id: 1,
      character_ids: [10],
      purchase_date: '2026-06-18',
      is_official: true,
      notes: '模板备注',
    })
    expect(vi.mocked(copyThemeImagesFromGoods)).toHaveBeenCalledWith(7, 'new-id')
  })

  it('syncs notes into the newly created theme after publishing', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    await fillRequiredBasicFields(wrapper)
    vm.formData.theme = '鍚屾澶囨敞涓婚'
    vm.formData.notes = '店铺：A\n工艺：烫金'
    await nextTick()

    await vm.submitByMode('publish')
    await flushAsyncWork()

    expect(vi.mocked(patchTheme)).toHaveBeenCalledWith(7, {
      description: '店铺：A\n工艺：烫金',
    })
  })

  it('does not sync blank or default notes into the newly created theme', async () => {
    const blankWrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const blankVm = blankWrapper.vm as any
    await fillRequiredBasicFields(blankWrapper)
    blankVm.formData.theme = '绌虹櫧澶囨敞涓婚'
    blankVm.formData.notes = '   '
    await nextTick()

    await blankVm.submitByMode('publish')
    await flushAsyncWork()

    expect(vi.mocked(patchTheme)).not.toHaveBeenCalled()

    vi.clearAllMocks()
    vi.mocked(ElMessageBox.confirm).mockResolvedValue(undefined as never)
    vi.mocked(getThemeTemplate).mockResolvedValue({ template: null, images: [] })

    const defaultWrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const defaultVm = defaultWrapper.vm as any
    await fillRequiredBasicFields(defaultWrapper)
    defaultVm.formData.theme = '榛樿澶囨敞涓婚'
    defaultVm.formData.notes = '店铺：\n工艺：\n画师：\n主题：'
    await nextTick()

    await defaultVm.submitByMode('publish')
    await flushAsyncWork()

    expect(vi.mocked(patchTheme)).not.toHaveBeenCalled()
  })

  it('does not sync notes when publishing with an existing theme', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    await fillRequiredBasicFields(wrapper)
    vm.formData.theme = 7
    vm.formData.notes = '已有主题不应覆盖'
    await nextTick()

    await vm.submitByMode('publish')
    await flushAsyncWork()

    expect(vi.mocked(patchTheme)).not.toHaveBeenCalled()
  })

  it('syncs notes into a newly created theme when saving a draft', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    await fillRequiredBasicFields(wrapper)
    vm.formData.theme = '鑽夌澶囨敞涓婚'
    vm.formData.notes = '草稿里的主题备注'
    await nextTick()

    await vm.submitByMode('draft')
    await flushAsyncWork()

    expect(vi.mocked(patchTheme)).toHaveBeenCalledWith(7, {
      description: '草稿里的主题备注',
    })
  })

  it('does not sync notes when the new goods is merged into an existing goods item', async () => {
    vi.mocked(createGoods).mockResolvedValueOnce({
      id: 'existing-id',
      saved_as_draft: false,
      merged: true,
    } as any)
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    await fillRequiredBasicFields(wrapper)
    vm.formData.theme = '鍚堝苟涓婚'
    vm.formData.notes = '合并时不写主题'
    await nextTick()

    await vm.submitByMode('publish')
    await flushAsyncWork()

    expect(vi.mocked(patchTheme)).not.toHaveBeenCalled()
  })

  it('keeps the create flow moving when syncing new theme notes fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(patchTheme).mockRejectedValueOnce(new Error('sync failed'))
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    await fillRequiredBasicFields(wrapper)
    vm.formData.theme = '澶辫触涓婚'
    vm.formData.notes = '同步失败也继续'
    await nextTick()

    await vm.submitByMode('publish')
    await flushAsyncWork()

    expect(vi.mocked(patchTheme)).toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('保存主题备注失败:', expect.any(Error))
    expect(vi.mocked(ElMessage.warning)).toHaveBeenCalledWith('主题备注保存失败')
    expect(pushMock).toHaveBeenCalledWith({ name: 'CloudShowcase' })
    consoleError.mockRestore()
  })

  it('does not save a template when the user declines the new-theme prompt', async () => {
    vi.mocked(ElMessageBox.confirm).mockRejectedValueOnce('cancel')
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    await fillRequiredBasicFields(wrapper)
    vm.formData.theme = '拒绝模板主题'
    await nextTick()

    await vm.submitByMode('publish')
    await flushAsyncWork()

    expect(vi.mocked(saveThemeTemplate)).not.toHaveBeenCalled()
    expect(vi.mocked(copyThemeImagesFromGoods)).not.toHaveBeenCalled()
  })

  it('runs the new-theme template flow after editing with a newly created theme', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
      params: { id: 'existing-id' },
    })
    await flushAsyncWork()
    const vm = wrapper.vm as any
    await fillRequiredBasicFields(wrapper)
    vm.formData.name = 'Edited Goods'
    vm.formData.theme = 'Edited Fresh Theme'
    vm.formData.purchase_date = '2026-06-19'
    vm.formData.is_official = true
    vm.formData.notes = 'Edited theme notes'
    await nextTick()

    await vm.submitByMode('publish')
    await flushAsyncWork()

    expect(vi.mocked(updateGoods)).toHaveBeenCalledWith('existing-id', expect.objectContaining({
      theme_id: 7,
    }))
    expect(vi.mocked(patchTheme)).toHaveBeenCalledWith(7, {
      description: 'Edited theme notes',
    })
    expect(vi.mocked(saveThemeTemplate)).toHaveBeenCalledWith(7, {
      name: 'Edited Goods',
      ip_id: 1,
      character_ids: [10],
      purchase_date: '2026-06-19',
      is_official: true,
      notes: 'Edited theme notes',
    })
    expect(vi.mocked(copyThemeImagesFromGoods)).toHaveBeenCalledWith(7, 'existing-id')
  })

  it('syncs new theme notes but does not save a template when editing as draft', async () => {
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
      params: { id: 'existing-id' },
    })
    await flushAsyncWork()
    const vm = wrapper.vm as any
    await fillRequiredBasicFields(wrapper)
    vm.formData.theme = 'Edited Draft Theme'
    vm.formData.notes = 'Edited draft notes'
    await nextTick()

    await vm.submitByMode('draft')
    await flushAsyncWork()

    expect(vi.mocked(updateGoods)).toHaveBeenCalledWith('existing-id', expect.objectContaining({
      theme_id: 7,
      status: 'draft',
    }))
    expect(vi.mocked(patchTheme)).toHaveBeenCalledWith(7, {
      description: 'Edited draft notes',
    })
    expect(vi.mocked(saveThemeTemplate)).not.toHaveBeenCalled()
    expect(vi.mocked(copyThemeImagesFromGoods)).not.toHaveBeenCalled()
  })

  it('fills only blank fields when selecting a theme with an existing template', async () => {
    vi.mocked(getThemeTemplate).mockResolvedValue(existingTemplatePayload)
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    vm.formData.name = '用户已填名称'
    vm.formData.ip = 1
    vm.formData.characters = [10]
    vm.formData.purchase_date = ''
    vm.formData.is_official = false
    vm.formData.notes = ''
    await nextTick()

    await vm.handleThemeChange(7)
    await flushAsyncWork()

    expect(vm.formData.name).toBe('用户已填名称')
    expect(vm.formData.ip).toBe(1)
    expect(vm.formData.characters).toEqual([10])
    expect(vm.formData.purchase_date).toBe('2026-06-18')
    expect(vm.formData.is_official).toBe(true)
    expect(vm.formData.notes).toBe('模板备注')
  })

  it('does not overwrite a template-provided name with the auto-generated name', async () => {
    vi.mocked(getThemeTemplate).mockResolvedValue({
      ...existingTemplatePayload,
      template: {
        ...existingTemplatePayload.template!,
        name: '模板里的完整名称',
      },
    })
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any
    vm.formData.name = ''
    await nextTick()

    await vm.handleThemeChange(7)
    await flushAsyncWork()
    vm.formData.category = 200
    await flushAsyncWork()

    expect(vm.formData.name).toBe('模板里的完整名称')
  })

  it('can add selected theme images into the current additional photo queue', async () => {
    vi.mocked(getThemeTemplate).mockResolvedValue({
      ...existingTemplatePayload,
      images: [{ id: 101, image: '/media/themes/extra/poster.jpg', label: '海报' }],
    })
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any

    await vm.handleThemeChange(7)
    await flushAsyncWork()
    expect(vm.themeImagePickerVisible).toBe(true)

    vm.selectedThemeImageIds = [101]
    await vm.applySelectedThemeImages()
    await flushAsyncWork()

    expect(fetch).toHaveBeenCalledWith('http://api.test/media/themes/extra/poster.jpg')
    expect(vm.newAdditionalPhotoFiles).toHaveLength(1)
    expect(vm.newAdditionalPhotoFiles[0].label).toBe('海报')
  })

  it('keeps the theme image picker open and warns when selected theme image fetch fails', async () => {
    vi.mocked(getThemeTemplate).mockResolvedValue({
      ...existingTemplatePayload,
      images: [{ id: 101, image: '/media/themes/extra/missing.jpg', label: '缺失图' }],
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      blob: async () => new Blob(),
    })))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const wrapper = await mountGoodsForm({
      width: 1440,
      height: 900,
      maxTouchPoints: 0,
    })
    const vm = wrapper.vm as any

    await vm.handleThemeChange(7)
    await flushAsyncWork()
    vm.selectedThemeImageIds = [101]
    await expect(vm.applySelectedThemeImages()).resolves.toBeUndefined()
    await flushAsyncWork()

    expect(fetch).toHaveBeenCalledWith('http://api.test/media/themes/extra/missing.jpg')
    expect(vi.mocked(ElMessage.warning)).toHaveBeenCalledWith('主题图片加入失败')
    expect(vm.themeImagePickerVisible).toBe(true)
    expect(vm.newAdditionalPhotoFiles).toHaveLength(0)
    expect(consoleError).toHaveBeenCalledWith('主题图片加入失败:', expect.any(Error))
    consoleError.mockRestore()
  })
})
