import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileAccount from '@/views/profile/ProfileAccount.vue'
import { useAuthStore } from '@/stores/auth'

const routerPush = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerPush }) }))
vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))
vi.mock('@/api/auth', () => ({
  removeCurrentUserAvatar: vi.fn(),
  updateCurrentAccount: vi.fn(),
  uploadCurrentUserAvatar: vi.fn(),
}))

import {
  removeCurrentUserAvatar,
  updateCurrentAccount,
  uploadCurrentUserAvatar,
} from '@/api/auth'
import { ElMessage, ElMessageBox } from 'element-plus'

const passthrough = (tag = 'div') => ({ template: `<${tag}><slot /></${tag}>` })
const ButtonStub = {
  props: { loading: Boolean },
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
}
const InputStub = {
  inheritAttrs: false,
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
const DrawerStub = {
  props: {
    modelValue: Boolean,
    direction: String,
    size: [String, Number],
  },
  emits: ['update:modelValue', 'closed'],
  template: `
    <section
      v-if="modelValue"
      data-test="account-editor-drawer"
      :data-direction="direction"
      :data-size="size"
    >
      <slot />
    </section>
  `,
}
const AvatarStub = {
  props: {
    src: String,
    size: [String, Number],
  },
  template: '<span class="avatar-stub" :data-src="src"><slot /></span>',
}
const AvatarEditorStub = {
  props: {
    modelValue: Boolean,
    currentAvatar: String,
    fallbackText: String,
    uploading: Boolean,
    removing: Boolean,
  },
  emits: ['update:modelValue', 'confirm', 'remove'],
  template: `
    <section v-if="modelValue" data-test="avatar-editor">
      <button type="button" data-test="avatar-confirm" @click="$emit('confirm', {})">
        保存头像
      </button>
      <button type="button" data-test="avatar-remove" @click="$emit('remove')">恢复默认头像</button>
    </section>
  `,
}

interface MountOptions {
  accountType?: 'collector' | 'club'
  role?: 'User' | 'Admin'
  clubName?: string
  clubAvatar?: string
  userAvatar?: string
}

function mountPage(options: MountOptions = {}) {
  const {
    accountType = 'collector',
    role = 'User',
    clubName,
    clubAvatar,
    userAvatar,
  } = options
  setActivePinia(createPinia())
  const authStore = useAuthStore()
  authStore.user = {
    id: 1,
    username: accountType === 'club' ? 'club-user' : 'collector-user',
    role,
    account_type: accountType,
    approval_status: 'approved',
    avatar: userAvatar,
    club: accountType === 'club'
      ? { id: 9, name: clubName || '星屑社', avatar: clubAvatar }
      : null,
  }
  const wrapper = mount(ProfileAccount, {
    global: {
      stubs: {
        AvatarEditorDialog: AvatarEditorStub,
        ElAvatar: AvatarStub,
        ElButton: ButtonStub,
        ElDrawer: DrawerStub,
        ElForm: passthrough('form'),
        ElFormItem: passthrough(),
        ElIcon: passthrough('span'),
        ElInput: InputStub,
      },
    },
  })
  return { wrapper, authStore }
}

type AccountForm = {
  username: string
  current_password: string
  new_password: string
  confirm_password: string
}

type AccountVm = {
  accountForm: AccountForm
  accountEditorVisible: boolean
  updateAccount: () => Promise<void>
}

describe('ProfileAccount 账号页', () => {
  beforeEach(() => vi.clearAllMocks())

  it('先用账号摘要和分组展示信息，点击后才打开登录信息抽屉', async () => {
    const { wrapper } = mountPage()

    expect(wrapper.get('[data-test="account-summary"]').text()).toContain('collector-user')
    expect(wrapper.get('[data-test="account-management"]').text()).toContain('账号与安全')
    expect(wrapper.find('[data-test="account-editor-drawer"]').exists()).toBe(false)

    await wrapper.get('[data-test="account-edit-trigger"]').trigger('click')
    await flushPromises()

    const drawer = wrapper.get('[data-test="account-editor-drawer"]')
    expect(drawer.get('h2').text()).toBe('登录信息')
    expect(drawer.attributes('data-direction')).toBe('rtl')
    expect(drawer.attributes('data-size')).toBe('480px')
  })

  it('仅修改登录用户名时同步当前用户并保持登录', async () => {
    const { wrapper, authStore } = mountPage()
    await wrapper.get('[data-test="account-edit-trigger"]').trigger('click')
    const vm = wrapper.vm as unknown as AccountVm
    Object.assign(vm.accountForm, {
      username: 'collector-renamed',
      current_password: 'old-pass',
      new_password: '',
      confirm_password: '',
    })
    vi.mocked(updateCurrentAccount).mockResolvedValue({ ...authStore.user!, username: 'collector-renamed' })

    await vm.updateAccount()
    await flushPromises()

    expect(updateCurrentAccount).toHaveBeenCalledWith({
      username: 'collector-renamed',
      current_password: 'old-pass',
    })
    expect(authStore.user?.username).toBe('collector-renamed')
    expect(vm.accountForm.current_password).toBe('')
    expect(vm.accountForm.new_password).toBe('')
    expect(vm.accountEditorVisible).toBe(false)
    expect(ElMessage.success).toHaveBeenCalledWith('登录信息已更新')
  })

  it('修改密码后清理会话并跳转登录页', async () => {
    const { wrapper, authStore } = mountPage()
    authStore.setToken('old-token')
    await wrapper.get('[data-test="account-edit-trigger"]').trigger('click')
    const vm = wrapper.vm as unknown as AccountVm
    Object.assign(vm.accountForm, {
      username: 'collector-renamed',
      current_password: 'old-pass',
      new_password: 'new-pass',
      confirm_password: 'new-pass',
    })
    vi.mocked(updateCurrentAccount).mockResolvedValue({ ...authStore.user!, username: 'collector-renamed' })

    await vm.updateAccount()
    await flushPromises()

    expect(updateCurrentAccount).toHaveBeenCalledWith({
      username: 'collector-renamed',
      current_password: 'old-pass',
      new_password: 'new-pass',
    })
    expect(authStore.token).toBeNull()
    expect(authStore.user).toBeNull()
    expect(routerPush).toHaveBeenCalledWith('/login')
    expect(ElMessage.success).toHaveBeenCalledWith('密码已更新，请重新登录')
  })

  it('密码确认不一致或缺少当前密码时不请求账号接口', async () => {
    const { wrapper } = mountPage()
    await wrapper.get('[data-test="account-edit-trigger"]').trigger('click')
    const vm = wrapper.vm as unknown as AccountVm
    Object.assign(vm.accountForm, {
      username: 'collector-renamed',
      current_password: 'old-pass',
      new_password: 'new-pass',
      confirm_password: 'different-pass',
    })

    await vm.updateAccount()

    expect(updateCurrentAccount).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith('两次输入的新密码不一致')

    Object.assign(vm.accountForm, {
      current_password: '',
      confirm_password: 'new-pass',
    })
    await vm.updateAccount()

    expect(updateCurrentAccount).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith('请输入当前密码')
  })

  it('社团账号使用社团名称和头像，并显示专属登录信息文案', async () => {
    const { wrapper, authStore } = mountPage({
      accountType: 'club',
      clubName: '星屑收藏社',
      clubAvatar: '/media/club-avatar.png',
    })

    expect(wrapper.get('[data-test="account-summary"]').text()).toContain('星屑收藏社')
    expect(wrapper.get('[data-test="account-summary"]').text()).toContain('@club-user')
    expect(wrapper.get('.avatar-stub').attributes('data-src')).toBe('/media/club-avatar.png')
    expect(wrapper.find('[data-test="avatar-edit-trigger"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="avatar-editor"]').exists()).toBe(false)

    await wrapper.get('[data-test="account-edit-trigger"]').trigger('click')
    expect(wrapper.get('[data-test="account-editor-drawer"]').text()).toContain('社团登录信息')
    expect(wrapper.get('[data-test="account-management"]').text()).toContain('修改社团帐号的登录用户名或设置新密码')

    vi.mocked(updateCurrentAccount).mockResolvedValue({
      ...authStore.user!,
      username: 'club-renamed',
    })
    const vm = wrapper.vm as unknown as AccountVm
    Object.assign(vm.accountForm, {
      username: 'club-renamed',
      current_password: 'old-pass',
      new_password: '',
      confirm_password: '',
    })

    await vm.updateAccount()
    await flushPromises()

    expect(updateCurrentAccount).toHaveBeenCalledWith({
      username: 'club-renamed',
      current_password: 'old-pass',
    })
    expect(authStore.user?.username).toBe('club-renamed')
  })

  it('仅管理员显示管理后台入口', () => {
    const collector = mountPage()
    expect(collector.wrapper.find('[data-test="admin-entry"]').exists()).toBe(false)

    const admin = mountPage({ role: 'Admin' })
    expect(admin.wrapper.get('[data-test="admin-entry"]').text()).toContain('进入管理后台')
    expect(admin.wrapper.find('[data-test="avatar-edit-trigger"]').exists()).toBe(true)
  })

  it('吃谷人和管理员可以打开头像编辑并上传新头像', async () => {
    const { wrapper, authStore } = mountPage({ userAvatar: '/media/users/avatars/old.png' })
    expect(wrapper.get('.avatar-stub').attributes('data-src')).toBe('/media/users/avatars/old.png')

    await wrapper.get('[data-test="avatar-edit-trigger"]').trigger('click')
    expect(wrapper.find('[data-test="avatar-editor"]').exists()).toBe(true)
    vi.mocked(uploadCurrentUserAvatar).mockResolvedValue({
      ...authStore.user!,
      avatar: '/media/users/avatars/new.png',
    })

    await wrapper.get('[data-test="avatar-confirm"]').trigger('click')
    await flushPromises()

    expect(uploadCurrentUserAvatar).toHaveBeenCalledOnce()
    expect(vi.mocked(uploadCurrentUserAvatar).mock.calls[0]?.[0]).toBeTruthy()
    expect(authStore.user?.avatar).toBe('/media/users/avatars/new.png')
    expect(wrapper.find('[data-test="avatar-editor"]').exists()).toBe(false)
    expect(ElMessage.success).toHaveBeenCalledWith('头像已更新')
  })

  it('头像上传失败时保留编辑弹窗并显示后端错误', async () => {
    const { wrapper } = mountPage()
    vi.mocked(uploadCurrentUserAvatar).mockRejectedValue({
      response: { data: { avatar: ['头像文件无效'] } },
    })

    await wrapper.get('[data-test="avatar-edit-trigger"]').trigger('click')
    await wrapper.get('[data-test="avatar-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="avatar-editor"]').exists()).toBe(true)
    expect(ElMessage.error).toHaveBeenCalledWith('头像文件无效')
  })

  it('已有头像时可以确认恢复默认头像', async () => {
    const { wrapper, authStore } = mountPage({ userAvatar: '/media/users/avatars/old.png' })
    vi.mocked(ElMessageBox.confirm).mockResolvedValue(undefined as never)
    vi.mocked(removeCurrentUserAvatar).mockResolvedValue({
      ...authStore.user!,
      avatar: null,
    })

    await wrapper.get('[data-test="avatar-edit-trigger"]').trigger('click')
    await wrapper.get('[data-test="avatar-remove"]').trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).toHaveBeenCalledWith(
      '确定要恢复为默认首字母头像吗？',
      '恢复默认头像',
      expect.objectContaining({ confirmButtonText: '恢复默认', cancelButtonText: '取消', type: 'warning' }),
    )
    expect(removeCurrentUserAvatar).toHaveBeenCalledOnce()
    expect(authStore.user?.avatar).toBeNull()
    expect(ElMessage.success).toHaveBeenCalledWith('已恢复默认头像')
  })

  it('刷新当前用户后同步摘要和表单用户名', async () => {
    const { wrapper, authStore } = mountPage()
    vi.spyOn(authStore, 'fetchCurrentUser').mockImplementation(async () => {
      authStore.user = { ...authStore.user!, username: 'refreshed-user' }
      return true
    })

    await wrapper.get('[data-test="refresh-account"]').trigger('click')
    await flushPromises()

    const vm = wrapper.vm as unknown as AccountVm
    expect(wrapper.get('[data-test="account-summary"]').text()).toContain('refreshed-user')
    expect(vm.accountForm.username).toBe('refreshed-user')
    expect(ElMessage.success).toHaveBeenCalledWith('已刷新')
  })

  it('退出登录仍先二次确认再清理会话', async () => {
    const { wrapper, authStore } = mountPage()
    vi.mocked(ElMessageBox.confirm).mockResolvedValue(undefined as never)
    const logout = vi.spyOn(authStore, 'logout').mockResolvedValue()

    await wrapper.get('[data-test="logout-account"]').trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).toHaveBeenCalledWith(
      '确定要退出登录吗？',
      '提示',
      expect.objectContaining({ confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }),
    )
    expect(logout).toHaveBeenCalledOnce()
  })
})
