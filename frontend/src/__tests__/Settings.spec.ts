import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Settings from '@/views/Settings.vue'
import { useAuthStore } from '@/stores/auth'
import { MOBILE_NAV_STORAGE_KEY, useMobileNavStore } from '@/stores/mobileNav'

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

describe('Settings mobile navigation preferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('removes the usage instructions and shows preferences only to collectors', () => {
    const collector = mountSettings('collector')
    expect(collector.text()).not.toContain('使用说明')
    expect(collector.find('.mobile-nav-settings-card').exists()).toBe(true)
    expect(collector.findAll('.mobile-nav-option')).toHaveLength(6)
    expect(collector.get('input[aria-label="品类底部导航"]').attributes('checked')).toBeUndefined()

    expect(mountSettings('club').find('.mobile-nav-settings-card').exists()).toBe(false)
    expect(mountSettings().find('.mobile-nav-settings-card').exists()).toBe(false)
  })

  it('saves changes immediately and prevents removing the last entry', async () => {
    const wrapper = mountSettings('collector')
    const firstCheckbox = wrapper.get('input[aria-label="社团底部导航"]')

    await firstCheckbox.setValue(false)

    expect(useMobileNavStore().selectedKeys).toEqual(['showcase', 'location', 'ipcharacter', 'theme'])
    expect(localStorage.getItem(MOBILE_NAV_STORAGE_KEY)).toBe('["showcase","location","ipcharacter","theme"]')

    useMobileNavStore().setSelectedKeys(['theme'])
    await wrapper.vm.$nextTick()

    expect(wrapper.get('input[aria-label="主题底部导航"]').attributes('disabled')).toBeDefined()
  })
})
