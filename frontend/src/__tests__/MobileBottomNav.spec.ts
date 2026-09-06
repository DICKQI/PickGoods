import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
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
  '/club/themes',
  '/club/popularity',
  '/club/profile',
].map(path => ({ path, component: { template: '<div />' } }))

const mountNavigation = async (
  accountType: 'collector' | 'club',
  options: { autoHideOnScroll?: boolean } = {},
) => {
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
    props: options,
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

  afterEach(() => {
    vi.useRealTimers()
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
      '主题',
      '人气',
      '资料',
      '社团',
    ])
  })

  it('社团主题入口可切换并显示激活状态', async () => {
    const { wrapper } = await mountNavigation('club')

    await wrapper.findAll('.nav-item')[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.nav-item')[1]!.classes()).toContain('active')
  })

  it('谷仓滚动时隐藏，并在滚动停止后自动展开', async () => {
    vi.useFakeTimers()
    const { wrapper } = await mountNavigation('collector', { autoHideOnScroll: true })
    const nav = wrapper.get('.mobile-bottom-nav')

    window.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()

    expect(nav.classes()).toContain('is-scroll-hidden')

    vi.advanceTimersByTime(300)
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(200)
    await wrapper.vm.$nextTick()
    expect(nav.classes()).toContain('is-scroll-hidden')

    vi.advanceTimersByTime(299)
    await wrapper.vm.$nextTick()
    expect(nav.classes()).toContain('is-scroll-hidden')

    vi.advanceTimersByTime(1)
    await wrapper.vm.$nextTick()
    expect(nav.classes()).not.toContain('is-scroll-hidden')

    window.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ autoHideOnScroll: false })
    expect(nav.classes()).not.toContain('is-scroll-hidden')

    wrapper.unmount()
  })
})
