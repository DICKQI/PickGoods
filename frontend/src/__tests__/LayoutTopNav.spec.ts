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

const routerRoutes = [
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
]

const mountLayout = async ({
  width = 1197,
  height = 720,
  path = '/theme',
}: {
  width?: number
  height?: number
  path?: string
} = {}) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 0,
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: routerRoutes,
  })

  router.push(path)
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
        MobileBottomNav: true,
        RouterView: { template: '<div />' },
        Transition: false,
        TransitionGroup: false,
      },
    },
  })
}

const mountDesktopLayout = () => mountLayout({ width: 1197, path: '/theme' })
const mountMobileLayout = (path: string) => mountLayout({ width: 390, path })

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

  it('shows the app version badge on all desktop pages', async () => {
    const wrapper = await mountDesktopLayout()

    const versionBadge = wrapper.get('.app-version')
    // __APP_VERSION__ 由 vite.config.ts 的 define 注入（来源：package.json 的 version 字段）
    expect(versionBadge.text()).toBe(`v${__APP_VERSION__}`)
    expect(versionBadge.attributes('title')).toBe('版本号')
  })

  it('hides the app version badge on mobile pages other than login', async () => {
    const wrapper = await mountMobileLayout('/showcase')

    expect(wrapper.find('.app-version').exists()).toBe(false)
  })

  it('shows the app version badge on the mobile login page', async () => {
    const wrapper = await mountMobileLayout('/login')

    expect(wrapper.find('.app-version').exists()).toBe(true)
  })
})
