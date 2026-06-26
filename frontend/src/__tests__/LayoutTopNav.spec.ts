import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const mountDesktopLayout = async () => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1197,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 720,
  })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 0,
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/showcase',
        component: { template: '<div />' },
      },
      {
        path: '/theme',
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

  router.push('/theme')
  await router.isReady()

  setActivePinia(createPinia())

  return mount(Layout, {
    global: {
      plugins: [router],
      stubs: {
        'el-button': { template: '<button><slot /></button>' },
        'el-icon': { template: '<i><slot /></i>' },
        'el-menu': {
          props: ['ellipsis'],
          template: '<nav data-test="desktop-top-menu" :data-ellipsis="String(ellipsis)"><slot /></nav>',
        },
        'el-menu-item': {
          props: ['index'],
          template: '<button :data-index="index"><slot /></button>',
        },
        RouterView: { template: '<div />' },
        Transition: false,
        TransitionGroup: false,
      },
    },
  })
}

describe('Layout top navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the theme entry in the top menu with the shorter label', async () => {
    const wrapper = await mountDesktopLayout()

    const topMenu = wrapper.get('[data-test="desktop-top-menu"]')
    const themeItem = wrapper.get('[data-index="/theme"]')

    expect(topMenu.attributes('data-ellipsis')).toBe('false')
    expect(themeItem.text()).toBe('主题')
    expect(topMenu.text()).not.toContain('主题管理')
  })
})
