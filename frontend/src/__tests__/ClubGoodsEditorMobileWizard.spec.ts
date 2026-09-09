import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubGoodsEditor from '@/views/club/ClubGoodsEditor.vue'

const {
  createClubGoodsMock,
  fetchAllMock,
  fetchIPCharactersMock,
  pushMock,
  validateFieldMock,
  validateMock,
} = vi.hoisted(() => ({
  createClubGoodsMock: vi.fn(),
  fetchAllMock: vi.fn(),
  fetchIPCharactersMock: vi.fn(),
  pushMock: vi.fn(),
  validateFieldMock: vi.fn(),
  validateMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/composables/useResponsiveDevice', () => ({
  useResponsiveDevice: () => ({ isMobile: { value: true } }),
}))

vi.mock('@/stores/metadata', () => ({
  useMetadataStore: () => ({
    ips: [{ id: 1, name: '测试 IP' }],
    categories: [{ id: 2, name: '徽章', path_name: '徽章' }],
    themes: [],
    fetchAll: fetchAllMock,
    fetchIPCharacters: fetchIPCharactersMock,
  }),
}))

vi.mock('@/api/clubs', () => ({
  createClubGoods: createClubGoodsMock,
  deleteClubGoodsAdditionalPhoto: vi.fn(),
  getMyClubGoodsDetail: vi.fn(),
  updateClubGoods: vi.fn(),
  uploadClubGoodsAdditionalPhotos: vi.fn(),
  uploadClubGoodsMainPhoto: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn(), success: vi.fn() },
}))

const passthrough = (name: string, tag = 'div') => defineComponent({
  name,
  template: `<${tag}><slot /></${tag}>`,
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  inheritAttrs: false,
  emits: ['click'],
  template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
})

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_props, { expose, slots }) {
    expose({ validateField: validateFieldMock, validate: validateMock })
    return () => h('form', slots.default?.())
  },
})

async function mountEditor() {
  const wrapper = mount(ClubGoodsEditor, {
    global: {
      directives: { loading: {} },
      stubs: {
        ElButton: ElButtonStub,
        ElCol: passthrough('ElCol'),
        ElDatePicker: passthrough('ElDatePicker'),
        ElForm: ElFormStub,
        ElFormItem: passthrough('ElFormItem'),
        ElIcon: passthrough('ElIcon', 'i'),
        ElInput: passthrough('ElInput'),
        ElOption: passthrough('ElOption'),
        ElRadioButton: passthrough('ElRadioButton'),
        ElRadioGroup: passthrough('ElRadioGroup'),
        ElRow: passthrough('ElRow'),
        ElSelect: passthrough('ElSelect'),
        ElUpload: passthrough('ElUpload'),
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('ClubGoodsEditor 移动端新增向导', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    fetchAllMock.mockResolvedValue(undefined)
    fetchIPCharactersMock.mockResolvedValue([])
    validateFieldMock.mockResolvedValue(true)
    validateMock.mockResolvedValue(true)
    createClubGoodsMock.mockResolvedValue({ id: 'new-goods' })
  })

  it('将新增流程拆分为基础信息、图片、说明与发布三步', async () => {
    const wrapper = await mountEditor()

    expect(wrapper.classes()).toContain('editor-page--create-wizard')
    expect(wrapper.findAll('.editor-wizard-progress__item')).toHaveLength(3)
    expect(wrapper.get('.editor-wizard-heading').text()).toContain('基础信息')
    expect(wrapper.get('.editor-wizard-heading').text()).toContain('1/3')
    expect(wrapper.get('.form-section--basic').isVisible()).toBe(true)
    expect(wrapper.get('.form-section--images').isVisible()).toBe(false)
    expect(wrapper.get('.form-section--publish').isVisible()).toBe(false)
    expect(wrapper.find('.mobile-form-dock-btn--back').exists()).toBe(false)
    expect(wrapper.get('.mobile-form-dock-btn--publish').text()).toBe('下一步')
  })

  it('逐步校验并在最终步骤按发布状态保存', async () => {
    const wrapper = await mountEditor()
    const vm = wrapper.vm as any
    Object.assign(vm.form, { name: '测试谷子', ip_id: 1, category_id: 2 })

    await wrapper.get('.mobile-form-dock-btn--publish').trigger('click')
    await flushPromises()
    expect(validateFieldMock).toHaveBeenCalledWith(['name', 'ip_id', 'character_ids', 'category_id'])
    expect(wrapper.get('.editor-wizard-heading').text()).toContain('图片')
    expect(wrapper.get('.form-section--images').isVisible()).toBe(true)

    await wrapper.get('.mobile-form-dock-btn--publish').trigger('click')
    await flushPromises()
    expect(wrapper.get('.editor-wizard-heading').text()).toContain('说明与发布')
    expect(wrapper.get('.form-section--publish').isVisible()).toBe(true)
    expect(wrapper.get('.form-section--notes').isVisible()).toBe(true)
    expect(wrapper.get('.mobile-form-dock-btn--publish').text()).toBe('保存草稿')

    vm.form.publication_status = 'listed'
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.mobile-form-dock-btn--publish').text()).toBe('保存并上架')

    await wrapper.get('.mobile-form-dock-btn--publish').trigger('click')
    await flushPromises()
    expect(createClubGoodsMock).toHaveBeenCalledWith(expect.objectContaining({
      name: '测试谷子',
      publication_status: 'listed',
    }))
    expect(pushMock).toHaveBeenCalledWith('/club/goods')
  })

  it('切换步骤时旧区块立即脱离布局且不使用模糊残影', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/club/ClubGoodsEditor.vue'), 'utf8')

    expect(source).toContain('.editor-wizard-section-leave-active { position: absolute; width: 100%; opacity: 0; pointer-events: none; transition: none; }')
    expect(source).not.toMatch(/editor-wizard-section-(?:enter|leave)[^{]*\{[^}]*filter:/)
  })
})
