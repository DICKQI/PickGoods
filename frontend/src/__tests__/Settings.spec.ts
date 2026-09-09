import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Settings from '@/views/Settings.vue'
import { useAuthStore } from '@/stores/auth'


vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
    },
  }
})

const ElCheckboxStub = defineComponent({
  name: 'ElCheckbox',
  props: {
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    ariaLabel: { type: String, default: '' },
  },
  emits: ['change'],
  template: `
    <label>
      <input
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        :aria-label="ariaLabel"
        @change="$emit('change', $event.target.checked)"
      />
      <slot />
    </label>
  `,
})

const passthroughStub = (name: string, tag = 'div') => defineComponent({
  name,
  template: `<${tag}><slot name="header" /><slot /></${tag}>`,
})

const mountSettings = (accountType?: 'collector' | 'club') => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore()
  if (accountType) {
    authStore.user = {
      id: 1,
      username: accountType,
      role: 'User',
      account_type: accountType,
      approval_status: 'approved',
    }
  }

  return mount(Settings, {
    global: {
      plugins: [pinia],
      stubs: {
        ElCard: passthroughStub('ElCard', 'section'),
        ElForm: passthroughStub('ElForm', 'form'),
        ElFormItem: passthroughStub('ElFormItem'),
        ElInput: passthroughStub('ElInput'),
        ElIcon: passthroughStub('ElIcon', 'i'),
        ElDivider: passthroughStub('ElDivider', 'hr'),
        ElButton: defineComponent({
          name: 'ElButton',
          props: { disabled: { type: Boolean, default: false } },
          template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        }),
        ElCheckbox: ElCheckboxStub,
      },
    },
  })
}

describe('Settings navigation migration', () => {
  beforeEach(() => localStorage.clear())
  it('retires preferences and exposes the project link for every identity', () => {
    for (const identity of ['collector', 'club', undefined] as const) {
      const wrapper = mountSettings(identity)
      expect(wrapper.find('.mobile-nav-settings-card').exists()).toBe(false)
      expect(wrapper.get('a[href="https://github.com/DICKQI/PickGoods"]').attributes('rel')).toContain('noopener')
      expect(wrapper.text()).toContain('后端服务配置')
      wrapper.unmount()
    }
  })
  it('does not alter old preferences or unrelated stored settings', () => {
    localStorage.setItem('pickgoods:mobile-bottom-nav', '["theme"]')
    localStorage.setItem('unrelated', 'keep')
    const wrapper = mountSettings()
    expect(wrapper.text()).toContain('登录账号')
    expect(localStorage.getItem('pickgoods:mobile-bottom-nav')).toBe('["theme"]')
    expect(localStorage.getItem('unrelated')).toBe('keep')
    wrapper.unmount()
  })
})
