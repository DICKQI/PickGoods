import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import Layout from '@/components/Layout.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'

const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/Layout.vue'), 'utf8')
const routerSource = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')
const globalStyleSource = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')

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
        NotificationCenter: { template: '<div data-test="notification-center" />' },
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

  it('preserves the club detail view when only filter query parameters change', () => {
    expect(layoutSource).toContain(':key="pageComponentKey(route)"')
    expect(layoutSource).toContain('if (currentRoute.matched.length > 1)')
    expect(routerSource).toMatch(/name:\s*'ClubDetail',[\s\S]*?meta:\s*\{\s*title:\s*'社团详情',\s*preserveOnQueryChange:\s*true\s*\}/)
  })

  it('does not reserve a desktop scrollbar gutter when scrollbars are hidden', () => {
    expect(globalStyleSource).toContain('scrollbar-gutter: auto;')
  })

  it('keeps native navbar, content, and sticky page tabs on one top offset', () => {
    expect(layoutSource).toContain("<div class=\"layout\" :class=\"{ 'layout-native': isNativePlatform }\">")
    expect(layoutSource).toContain('padding-top: var(--app-navbar-height);')
    expect(layoutSource).not.toContain("getPropertyValue('env(safe-area-inset-top)')")
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

  it('does not render or poll notifications for a club account', async () => {
    const wrapper = await mountDesktopLayout()
    const authStore = useAuthStore()
    const notificationStore = useNotificationStore()
    const startPolling = vi.spyOn(notificationStore, 'startPolling').mockImplementation(() => {})
    vi.spyOn(notificationStore, 'stopPolling').mockImplementation(() => {})

    authStore.setToken('club-token')
    authStore.user = {
      id: 1,
      username: 'club-user',
      role: 'User',
      account_type: 'club',
      approval_status: 'approved',
    }
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-test="notification-center"]').exists()).toBe(false)
    expect(startPolling).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders and polls notifications for a collector account after profile hydration', async () => {
    const wrapper = await mountDesktopLayout()
    const authStore = useAuthStore()
    const notificationStore = useNotificationStore()
    const startPolling = vi.spyOn(notificationStore, 'startPolling').mockImplementation(() => {})

    authStore.setToken('collector-token')
    // Token 到达与用户资料到达可能不是同一个 tick，轮询条件必须跟随角色变化。
    await wrapper.vm.$nextTick()
    expect(startPolling).not.toHaveBeenCalled()

    authStore.user = {
      id: 2,
      username: 'collector-user',
      role: 'User',
      account_type: 'collector',
      approval_status: 'approved',
    }
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-test="notification-center"]').exists()).toBe(true)
    expect(startPolling).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
