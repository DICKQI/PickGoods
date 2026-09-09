import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
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
  { path: '/clubs/1', component: { template: '<div data-test="club-detail" />' }, meta: { hideTopNavOnMobile: true, preserveOnQueryChange: true } },
  { path: '/clubs', component: { template: '<div data-test="club-directory" />' } },
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
  realRouting = false,
}: {
  width?: number
  height?: number
  path?: string
  realRouting?: boolean
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
        RouterView: realRouting ? false : { template: '<div />' },
        Transition: !realRouting,
        TransitionGroup: false,
      },
    },
  })
}

const mountDesktopLayout = () => mountLayout({ width: 1197, path: '/theme' })
const mountMobileLayout = (path: string) => mountLayout({ width: 390, path })

describe('Layout top navigation', () => {
  it('社团详情仅移动端隐藏顶部栏，返回目录后恢复', async () => {
    const wrapper = await mountMobileLayout('/clubs/1')
    expect(wrapper.find('.navbar').exists()).toBe(false)
    expect(wrapper.get('main').classes()).toContain('no-top-nav')
    expect(wrapper.get('main').classes()).toContain('mobile-detail-safe-area')
    expect(wrapper.get('main').classes()).toContain('has-bottom-nav')
    await wrapper.vm.$router.push('/clubs')
    await flushPromises()
    expect(wrapper.find('.navbar').exists()).toBe(true)
    expect(wrapper.get('main').classes()).not.toContain('no-top-nav')
    wrapper.unmount()
  })

  it('目录离场期间保留顶部间距，详情入场前释放，导航独立淡出', async () => {
    const wrapper = await mountLayout({ width: 390, path: '/clubs', realRouting: true })
    const originalGetComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const styles = originalGetComputedStyle(element, pseudo)
      if (element === wrapper.get('main').element) {
        Object.defineProperty(styles, 'paddingTop', { value: '64px' })
      }
      return styles
    })
    await wrapper.vm.$router.push('/clubs/1')
    await nextTick()
    expect(wrapper.find('[data-test="club-directory"]').exists()).toBe(true)
    expect(wrapper.get('main').element.style.paddingTop).toBe('64px')
    expect(wrapper.get('.navbar').classes()).toContain('navbar-visibility-leave-active')

    // jsdom has no stylesheet transitions; Vue completes after two animation frames.
    await new Promise(resolve => setTimeout(resolve, 100))
    await flushPromises()
    expect(wrapper.find('[data-test="club-detail"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="club-directory"]').exists()).toBe(false)
    expect(wrapper.get('main').element.style.paddingTop).toBe('')
    expect(wrapper.find('.navbar').exists()).toBe(false)

    vi.restoreAllMocks()
    await wrapper.vm.$router.push('/clubs')
    await nextTick()
    expect(wrapper.get('.navbar').classes()).toContain('navbar-visibility-enter-active')
    await new Promise(resolve => setTimeout(resolve, 100))
    await flushPromises()
    expect(wrapper.find('[data-test="club-directory"]').exists()).toBe(true)
    expect(wrapper.get('main').classes()).not.toContain('no-top-nav')
    expect(wrapper.get('main').element.style.paddingTop).toBe('')
    wrapper.unmount()
  })

  it('只更新详情筛选参数时不锁定页面顶部间距', async () => {
    const wrapper = await mountLayout({ width: 390, path: '/clubs/1', realRouting: true })
    await wrapper.vm.$router.push('/clubs/1?search=test')
    await flushPromises()
    expect(wrapper.get('main').element.style.paddingTop).toBe('')
    expect(wrapper.find('[data-test="club-detail"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('PC 社团详情保留顶部导航，改变窗口尺寸后同步切换', async () => {
    const wrapper = await mountLayout({ path: '/clubs/1' })
    expect(wrapper.find('.navbar').exists()).toBe(true)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(wrapper.find('.navbar').exists()).toBe(false)
    wrapper.unmount()
  })

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
    expect(routerSource).toMatch(/name:\s*'ClubDetail',[\s\S]*?meta:\s*\{\s*title:\s*'社团详情',\s*preserveOnQueryChange:\s*true,\s*hideTopNavOnMobile:\s*true\s*\}/)
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
