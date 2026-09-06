import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileAccount from '@/views/profile/ProfileAccount.vue'
import { useAuthStore } from '@/stores/auth'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))
vi.mock('@/api/auth', () => ({ updateCurrentAccount: vi.fn() }))

import { updateCurrentAccount } from '@/api/auth'
import { ElMessage } from 'element-plus'

const passthrough = (tag = 'div') => ({ template: `<${tag}><slot /></${tag}>` })
const ButtonStub = {
  props: { loading: Boolean },
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>',
}
const InputStub = {
  inheritAttrs: false,
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

function mountPage(accountType: 'collector' | 'club' = 'collector') {
  setActivePinia(createPinia())
  const authStore = useAuthStore()
  authStore.user = {
    id: 1,
    username: accountType === 'club' ? 'club-user' : 'collector-user',
    role: 'User',
    account_type: accountType,
    approval_status: 'approved',
  }
  const wrapper = mount(ProfileAccount, {
    global: {
      stubs: {
        ElButton: ButtonStub,
        ElForm: passthrough('form'),
        ElFormItem: passthrough(),
        ElIcon: passthrough('span'),
        ElInput: InputStub,
      },
    },
  })
  return { wrapper, authStore }
}

describe('ProfileAccount 登录信息管理', () => {
  beforeEach(() => vi.clearAllMocks())

  it('吃谷人可以修改登录用户名和密码并同步当前用户', async () => {
    const { wrapper, authStore } = mountPage()
    const vm = wrapper.vm as unknown as {
      accountForm: { username: string; current_password: string; new_password: string; confirm_password: string }
      updateAccount: () => Promise<void>
    }
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
    expect(authStore.user?.username).toBe('collector-renamed')
    expect(vm.accountForm.current_password).toBe('')
    expect(vm.accountForm.new_password).toBe('')
    expect(ElMessage.success).toHaveBeenCalledWith('登录信息已更新')
  })

  it('新密码确认不一致时不请求账号接口', async () => {
    const { wrapper } = mountPage()
    const vm = wrapper.vm as unknown as {
      accountForm: { username: string; current_password: string; new_password: string; confirm_password: string }
      updateAccount: () => Promise<void>
    }
    Object.assign(vm.accountForm, {
      username: 'collector-renamed',
      current_password: 'old-pass',
      new_password: 'new-pass',
      confirm_password: 'different-pass',
    })

    await vm.updateAccount()

    expect(updateCurrentAccount).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith('两次输入的新密码不一致')
  })

  it('社团账号不显示登录信息修改入口', () => {
    const { wrapper } = mountPage('club')
    expect(wrapper.find('[data-test="collector-account-management"]').exists()).toBe(false)
  })
})
