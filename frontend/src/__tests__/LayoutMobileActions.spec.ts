import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import Layout from '@/components/Layout.vue'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}))

const mountMobileLayout = async () => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 390,
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/showcase',
        component: { template: '<div />' },
      },
      {
        path: '/goods/new',
        component: { template: '<div />' },
      },
      {
        path: '/settings',
        component: { template: '<div />' },
      },
      {
        path: '/login',
        component: { template: '<div />' },
      },
    ],
  })

  router.push('/showcase')
  await router.isReady()

  setActivePinia(createPinia())

  const wrapper = mount(Layout, {
    global: {
      plugins: [router],
      stubs: {
        'el-button': { template: '<button><slot /></button>' },
        'el-icon': { template: '<i><slot /></i>' },
        'el-menu': { template: '<nav><slot /></nav>' },
        'el-menu-item': { template: '<button><slot /></button>' },
        MobileBottomNav: true,
        RouterView: { template: '<div />' },
        Transition: false,
        TransitionGroup: false,
      },
    },
  })

  window.dispatchEvent(new CustomEvent('cloud-showcase:tab-changed', { detail: { tab: 'barn' } }))
  await wrapper.vm.$nextTick()

  return wrapper
}

describe('Layout mobile action menu', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes the floating action state and opened action tray semantics', async () => {
    const wrapper = await mountMobileLayout()

    const fab = wrapper.get('button.mobile-action-fab')
    expect(fab.attributes('aria-expanded')).toBe('false')
    expect(fab.attributes('aria-controls')).toBe('mobile-action-sheet')

    await fab.trigger('click')

    expect(fab.attributes('aria-expanded')).toBe('true')
    const sheet = wrapper.get('#mobile-action-sheet')
    expect(sheet.attributes('role')).toBe('menu')
    expect(sheet.attributes('aria-label')).toBe('首页快捷操作')

    const actions = sheet.findAll('.mobile-action-item')
    expect(actions).toHaveLength(3)
    expect(actions.map((action) => action.attributes('aria-label'))).toEqual([
      '刷新当前列表',
      '新增谷子',
      '进入批量展示',
    ])
  })
})
