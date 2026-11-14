import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { h, nextTick } from 'vue'
import { ORGANIZE_TABS, normalizeOrganizeTab } from '@/navigation/organize'
import OrganizeWorkspace from '@/views/OrganizeWorkspace.vue'

// 三个资料库页面本体体量很大，这里只验证容器的分栏逻辑。
// 替身用 render 函数（不是模板字符串），避免测试环境缺少运行时模板编译。
vi.mock('@/views/IPCharacterManagement.vue', async () => {
  const { h } = await import('vue')
  return { __esModule: true, default: { name: 'StubIp', render: () => h('div', { 'data-test': 'panel-ip' }) } }
})
vi.mock('@/views/CategoryManagement.vue', async () => {
  const { h } = await import('vue')
  return { __esModule: true, default: { name: 'StubCategory', render: () => h('div', { 'data-test': 'panel-category' }) } }
})
vi.mock('@/views/ThemeManagement.vue', async () => {
  const { h } = await import('vue')
  return { __esModule: true, default: { name: 'StubTheme', render: () => h('div', { 'data-test': 'panel-theme' }) } }
})

const workspaceSource = readFileSync(resolve(process.cwd(), 'src/views/OrganizeWorkspace.vue'), 'utf8')
const mobileNavSource = readFileSync(resolve(process.cwd(), 'src/navigation/mobile.ts'), 'utf8')
const routerSource = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')
const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/Layout.vue'), 'utf8')

const setViewport = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })
}

// v-show 的可见性在 jsdom 里看 inline display 最可靠，isVisible() 会误判。
const visibleOf = (wrapper: VueWrapper, key: string) => {
  const section = wrapper.find(`[data-test="panel-${key}"]`).element.closest('.organize-section') as HTMLElement | null
  return section?.style.display !== 'none'
}

// 被替身的分栏组件仍会走一次真实的模块加载，用 waitFor 等它挂载完成。
async function waitForPanel(wrapper: VueWrapper, key: string) {
  await vi.waitFor(() => {
    expect(wrapper.find(`[data-test="panel-${key}"]`).exists()).toBe(true)
  }, { timeout: 5000, interval: 10 })
  await nextTick()
}

async function mountWorkspace(path = '/organize') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/organize', name: 'OrganizeWorkspace', component: OrganizeWorkspace },
      { path: '/location', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  const wrapper = mount(OrganizeWorkspace, {
    global: {
      plugins: [router],
      stubs: {
        'el-tabs': { template: '<div class="stub-tabs"><slot /></div>' },
        'el-tab-pane': { template: '<div class="stub-pane" />' },
        // 用 VTU 的过渡替身，离开动画立即收尾，v-show 才会同步写 display: none。
        transition: true,
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('organize tab contract', () => {
  it('normalizes the tab query and falls back to IP', () => {
    expect(normalizeOrganizeTab('ip')).toBe('ip')
    expect(normalizeOrganizeTab('category')).toBe('category')
    expect(normalizeOrganizeTab('theme')).toBe('theme')
    for (const value of [undefined, null, '', 'nope', ['theme'], 3]) expect(normalizeOrganizeTab(value)).toBe('ip')
  })

  it('keeps three tabs pointing at the merged route', () => {
    expect(ORGANIZE_TABS.map(tab => [tab.key, tab.label, tab.to])).toEqual([
      ['ip', 'IP与角色', '/organize?tab=ip'],
      ['category', '品类', '/organize?tab=category'],
      ['theme', '主题', '/organize?tab=theme'],
    ])
  })
})

describe('organize workspace panel switching', () => {
  beforeEach(() => setViewport(1197))

  it('mounts only the active panel first and defers the others', async () => {
    const { wrapper } = await mountWorkspace()
    await waitForPanel(wrapper, 'ip')
    expect(visibleOf(wrapper, 'ip')).toBe(true)
    expect(wrapper.find('[data-test="panel-category"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="panel-theme"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('activates a visited panel without dropping the previous one', async () => {
    const { wrapper, router } = await mountWorkspace()
    await waitForPanel(wrapper, 'ip')
    await router.push('/organize?tab=category')
    await waitForPanel(wrapper, 'category')
    expect(wrapper.findAll('[data-test="panel-ip"]')).toHaveLength(1)
    expect(visibleOf(wrapper, 'ip')).toBe(false)
    expect(visibleOf(wrapper, 'category')).toBe(true)
    expect(wrapper.find('[data-test="panel-theme"]').exists()).toBe(false)

    await router.push('/organize?tab=ip')
    await flushPromises()
    await nextTick()
    // 回到先前的分栏不会重新挂载，状态得以保留
    expect(wrapper.findAll('[data-test="panel-ip"]')).toHaveLength(1)
    expect(visibleOf(wrapper, 'ip')).toBe(true)
    wrapper.unmount()
  })

  it('fills in the default tab when the URL has none', async () => {
    const { router, wrapper } = await mountWorkspace()
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBe('ip')
    wrapper.unmount()
  })

  it('hides the desktop tab strip on mobile while keeping the panels', async () => {
    setViewport(390)
    const { wrapper } = await mountWorkspace('/organize?tab=theme')
    await waitForPanel(wrapper, 'theme')
    expect(wrapper.find('.organize-tabs').exists()).toBe(false)
    expect(visibleOf(wrapper, 'theme')).toBe(true)
    wrapper.unmount()
  })
})

describe('organize workspace source contract', () => {
  it('renders every panel behind a shared cross-fade transition', () => {
    expect(workspaceSource.match(/<Transition name="organize-tab-fade">/g)).toHaveLength(3)
    for (const key of ['ip', 'category', 'theme']) {
      expect(workspaceSource).toContain(`v-if="visitedTabs.has('${key}')"`)
      expect(workspaceSource).toContain(`v-show="activeTab === '${key}'"`)
    }
    expect(workspaceSource).toContain('<el-tabs v-if="!isMobile"')
    expect(workspaceSource).toContain("router.replace({ path: '/organize'")
  })

  it('keeps the cloud-showcase grade cross fade and a mobile-only opacity fade', () => {
    expect(workspaceSource).toMatch(/\.organize-tab-fade-leave-active\s*\{[\s\S]*?position:\s*absolute;/)
    expect(workspaceSource).toMatch(/\.organize-tab-fade-leave-active\s*\{[\s\S]*?top:\s*0;[\s\S]*?bottom:\s*0;/)
    expect(workspaceSource).toMatch(/\.organize-tab-fade-leave-active\s*\{[\s\S]*?overflow:\s*hidden;/)
    expect(workspaceSource).toMatch(/\.organize-tab-fade-leave-active\s*\{[\s\S]*?pointer-events:\s*none;/)
    expect(workspaceSource).toMatch(/\.organize-tab-fade-enter-from\s*\{[\s\S]*?translateY\(8px\)/)
    expect(workspaceSource).toMatch(/\.organize-tab-fade-leave-to\s*\{[\s\S]*?translateY\(-8px\)/)
    expect(workspaceSource).toMatch(/\.organize-tab-fade-enter-active\s*\{[\s\S]*?opacity 0\.18s ease 0\.07s/)
    expect(workspaceSource).toMatch(/\.organize-tab-fade-leave-active\s*\{[\s\S]*?opacity 0\.09s ease/)
    // 触屏只做透明度过渡，不能出现位移动画
    expect(workspaceSource).toMatch(/@media \(hover: none\), \(max-width: 768px\)\s*\{[\s\S]*?transition: opacity 0\.14s ease 0\.04s;/)
    expect(workspaceSource).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.organize-tab-fade-enter-active,[\s\S]*?\.organize-tab-fade-leave-active\s*\{[\s\S]*?transition: none;/)
  })

  it('registers /organize and redirects the legacy library routes', () => {
    expect(routerSource).toContain("path: '/organize'")
    expect(routerSource).toContain("name: 'OrganizeWorkspace'")
    expect(routerSource).toContain('preserveOnQueryChange: true')
    for (const [legacy, tab] of [['/ipcharacter', 'ip'], ['/category', 'category'], ['/theme', 'theme']]) {
      expect(routerSource).toContain(`path: '${legacy}'`)
      expect(routerSource).toContain(`tab: '${tab}'`)
    }
    // 三个资料库不再各自挂在路由上（ThemeManagement 仍服务于 /club/themes）
    for (const view of ['IPCharacterManagement', 'CategoryManagement']) {
      expect(routerSource).not.toContain(`import('@/views/${view}.vue')`)
    }
  })

  it('collapses the desktop menu into a single entry', () => {
    expect(layoutSource).toContain('index="/organize"')
    expect(layoutSource).toContain('整理')
    for (const index of ['/ipcharacter', '/category', '/theme']) {
      expect(layoutSource).not.toContain(`index="${index}"`)
    }
    expect(layoutSource).toMatch(/currentPath\.startsWith\('\/organize'\)[\s\S]{0,400}?return '\/organize'/)
  })

  it('routes the mobile tabs through the merged route', () => {
    expect(mobileNavSource).toContain("{ key: 'ip', label: 'IP与角色', to: '/organize?tab=ip' }")
    expect(mobileNavSource).toContain("{ key: 'category', label: '品类', to: '/organize?tab=category' }")
    expect(mobileNavSource).toContain("{ key: 'theme', label: '主题', to: '/organize?tab=theme' }")
    expect(mobileNavSource).toContain('OrganizeWorkspace')
  })
})
