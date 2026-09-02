import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import MobileBottomNav from '@/components/MobileBottomNav.vue'
import { useAuthStore } from '@/stores/auth'
import { useMobileNavStore } from '@/stores/mobileNav'

const routes = [
  '/clubs',
  '/showcase',
  '/location',
  '/ipcharacter',
  '/theme',
  '/club/goods',
  '/club/popularity',
  '/club/profile',
].map(path => ({ path, component: { template: '<div />' } }))

const mountNavigation = async (accountType: 'collector' | 'club') => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore()
  authStore.user = {
    id: 1,
    username: accountType,
    role: 'User',
    account_type: accountType,
    approval_status: 'approved',
  }

  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(accountType === 'club' ? '/club/goods' : '/showcase')
  await router.isReady()

  const wrapper = mount(MobileBottomNav, {
    global: {
      plugins: [pinia, router],
      stubs: {
        ElIcon: { template: '<i><slot /></i>' },
      },
    },
  })

  return { wrapper, mobileNavStore: useMobileNavStore() }
}

describe('MobileBottomNav', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the collector default entries', async () => {
    const { wrapper } = await mountNavigation('collector')

    expect(wrapper.findAll('.nav-label').map(item => item.text())).toEqual([
      '社团',
      '云展柜',
      '位置',
      'IP与角色',
      '主题',
    ])
  })

  it('updates immediately when the collector selection changes', async () => {
    const { wrapper, mobileNavStore } = await mountNavigation('collector')

    mobileNavStore.setSelectedKeys(['clubs', 'theme'])
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.nav-label').map(item => item.text())).toEqual(['社团', '主题'])
  })

  it('keeps the fixed club navigation regardless of collector preferences', async () => {
    localStorage.setItem('pickgoods:mobile-bottom-nav', '["theme"]')

    const { wrapper } = await mountNavigation('club')

    expect(wrapper.findAll('.nav-label').map(item => item.text())).toEqual([
      '社团谷子',
      '人气',
      '资料',
      '社团',
    ])
  })
})
