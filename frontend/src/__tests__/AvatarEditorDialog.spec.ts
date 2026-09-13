import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AvatarEditorDialog from '@/components/profile/AvatarEditorDialog.vue'

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() },
}))
vi.mock('vue-picture-cropper', () => ({
  default: {
    props: ['img', 'options'],
    template: '<div data-test="crop-canvas" :data-src="img"></div>',
  },
  cropper: {
    getBlob: vi.fn(),
  },
}))

import { ElMessage } from 'element-plus'
import { cropper } from 'vue-picture-cropper'

const mockedCropper = cropper as unknown as {
  getBlob: ReturnType<typeof vi.fn>
}

const passthrough = (tag = 'div') => ({ template: `<${tag}><slot /></${tag}>` })
const ButtonStub = {
  props: { loading: Boolean, disabled: Boolean },
  emits: ['click'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}
const DialogStub = {
  props: { modelValue: Boolean },
  emits: ['update:modelValue', 'open', 'closed'],
  template: '<section v-if="modelValue" data-test="avatar-editor-dialog"><slot /></section>',
}
const AvatarStub = {
  props: { src: String },
  template: '<span class="avatar-preview-stub" :data-src="src"><slot /></span>',
}

function mountDialog(overrides: { currentAvatar?: string } = {}) {
  return mount(AvatarEditorDialog, {
    props: {
      modelValue: true,
      currentAvatar: overrides.currentAvatar,
      fallbackText: 'A',
      uploading: false,
      removing: false,
    },
    global: {
      stubs: {
        ElAvatar: AvatarStub,
        ElButton: ButtonStub,
        ElDialog: DialogStub,
        ElIcon: passthrough('span'),
      },
    },
  })
}

function chooseFile(wrapper: ReturnType<typeof mountDialog>, file: File) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [file],
  })
  return input.trigger('change')
}

describe('AvatarEditorDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:avatar-preview'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('无头像时展示首字母和上传入口', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('当前使用默认首字母头像')
    expect(wrapper.text()).toContain('上传头像')
    expect(wrapper.get('.avatar-preview-stub').text()).toContain('A')
  })

  it('已有头像时展示当前头像和恢复默认入口', () => {
    const wrapper = mountDialog({ currentAvatar: '/media/users/avatars/old.png' })
    expect(wrapper.get('.avatar-preview-stub').attributes('data-src')).toBe('/media/users/avatars/old.png')
    expect(wrapper.text()).toContain('恢复默认头像')
  })

  it('拒绝超过 5MB 的图片且不进入裁剪', async () => {
    const wrapper = mountDialog()
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 })

    await chooseFile(wrapper, file)

    expect(ElMessage.error).toHaveBeenCalledWith('头像文件不能超过 5MB')
    expect(wrapper.find('[data-test="crop-canvas"]').exists()).toBe(false)
  })

  it('拒绝非图片文件', async () => {
    const wrapper = mountDialog()

    await chooseFile(wrapper, new File(['text'], 'avatar.txt', { type: 'text/plain' }))

    expect(ElMessage.error).toHaveBeenCalledWith('请选择图片文件')
    expect(wrapper.find('[data-test="crop-canvas"]').exists()).toBe(false)
  })

  it('选择合法图片后裁剪并输出文件', async () => {
    const wrapper = mountDialog()
    mockedCropper.getBlob.mockResolvedValue(new Blob(['cropped'], { type: 'image/png' }))

    await chooseFile(wrapper, new File(['avatar'], 'avatar.png', { type: 'image/png' }))

    expect(wrapper.get('[data-test="crop-canvas"]').attributes('data-src')).toBe('blob:avatar-preview')
    await wrapper.findAll('button').find(button => button.text().includes('保存头像'))!.trigger('click')
    await flushPromises()

    expect(mockedCropper.getBlob).toHaveBeenCalledWith(expect.objectContaining({
      width: 1024,
      height: 1024,
    }))
    const output = wrapper.emitted('confirm')?.[0]?.[0] as File
    expect(output).toBeInstanceOf(File)
    expect(output.name).toBe('avatar.png')
    expect(output.type).toBe('image/png')
  })
})
