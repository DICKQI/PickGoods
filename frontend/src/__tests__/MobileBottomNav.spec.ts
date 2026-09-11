import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { nextTick } from 'vue'
import MobileBottomNav from '@/components/MobileBottomNav.vue'
import { useAuthStore } from '@/stores/auth'
import { useMobileWorkspaceStore } from '@/stores/mobileWorkspace'

async function setup(club = false, path = '/showcase', autoHideOnScroll = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.token = 'test'
  auth.user = { id: 1, username: 'test', role: 'User', account_type: club ? 'club' : 'collector', approval_status: 'approved' }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
  await router.push(path)
  const wrapper = mount(MobileBottomNav, { props: { autoHideOnScroll }, global: { plugins: [pinia, router], stubs: { ElIcon: { template: '<i><slot /></i>' } } } })
  return { wrapper, router, store: useMobileWorkspaceStore() }
}

// jsdom 的 scrollY 只读，用 defineProperty 模拟页面滚动位置。
function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value })
}

function dispatchScrollTo(top: number) {
  setScrollY(top)
  window.dispatchEvent(new Event('scroll'))
}

// 连续向下滚动：每 50ms 一个事件（小于 120ms 的连续性断档阈值），
// 只在下一次事件前推进时间，结束后时钟停在最后一个事件上，返回最终滚动位置。
async function scrollDownContinuously(steps: number, distance = 40) {
  let top = window.scrollY
  for (let index = 0; index < steps; index++) {
    if (index > 0) vi.advanceTimersByTime(50)
    top += distance
    dispatchScrollTo(top)
    await nextTick()
  }
  return top
}

describe('fixed mobile navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    setScrollY(0)
  })
  it('uses four collector modules regardless of old preferences', async () => {
    localStorage.setItem('pickgoods:mobile-bottom-nav', '["theme"]')
    const { wrapper } = await setup()
    expect(wrapper.findAll('.nav-label').map(n => n.text())).toEqual(['社团', '云展柜', '整理', '我的'])
    // 没有用户滑动信号时，滚动位置恢复不能收起导航
    dispatchScrollTo(640)
    await flushPromises()
    expect(wrapper.classes()).not.toContain('is-scroll-hidden')
    wrapper.unmount()
  })
  it('uses three club modules and highlights the entire workbench', async () => {
    const { wrapper } = await setup(true, '/club/themes')
    expect(wrapper.findAll('.nav-label').map(n => n.text())).toEqual(['社团', '工作台', '我的'])
    expect(wrapper.get('[aria-current="page"]').text()).toBe('工作台')
    wrapper.unmount()
  })
  it('returns to the remembered tab and follows route changes', async () => {
    const { wrapper, router, store } = await setup()
    store.remember('organize', '/theme')
    await flushPromises()
    await wrapper.findAll('a')[2]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/theme')
    expect(wrapper.get('[aria-current="page"]').text()).toBe('整理')
    wrapper.unmount()
  })
  it('keeps the bar visible after a single light scroll', async () => {
    const { wrapper } = await setup(false, '/showcase?tab=barn', true)
    vi.useFakeTimers()
    try {
      window.dispatchEvent(new Event('touchstart'))
      dispatchScrollTo(30)
      await nextTick()
      expect(wrapper.classes()).not.toContain('is-scroll-hidden')
      // 没有连续下滑：再等多久也不会收起
      vi.advanceTimersByTime(1200)
      await nextTick()
      expect(wrapper.classes()).not.toContain('is-scroll-hidden')
    } finally {
      vi.useRealTimers()
    }
    wrapper.unmount()
  })
  it('hides after 300ms of continuous downward scrolling and returns 500ms after it stops', async () => {
    const { wrapper } = await setup(false, '/showcase?tab=barn', true)
    vi.useFakeTimers()
    try {
      window.dispatchEvent(new Event('touchstart'))
      // 6 个事件、累计 250ms：还没到 300ms 阈值
      await scrollDownContinuously(6)
      expect(wrapper.classes()).not.toContain('is-scroll-hidden')
      // 第 7 个事件累计到 300ms：收起
      vi.advanceTimersByTime(50)
      await scrollDownContinuously(1)
      expect(wrapper.classes()).toContain('is-scroll-hidden')
      // 继续下滑保持收起
      vi.advanceTimersByTime(50)
      await scrollDownContinuously(1)
      expect(wrapper.classes()).toContain('is-scroll-hidden')
      vi.advanceTimersByTime(499)
      await nextTick()
      expect(wrapper.classes()).toContain('is-scroll-hidden')
      vi.advanceTimersByTime(1)
      await nextTick()
      expect(wrapper.classes()).not.toContain('is-scroll-hidden')
    } finally {
      vi.useRealTimers()
    }
    wrapper.unmount()
  })
  it('keeps the bar visible when downward scrolls are not continuous', async () => {
    const { wrapper } = await setup(false, '/showcase?tab=barn', true)
    vi.useFakeTimers()
    try {
      window.dispatchEvent(new Event('touchstart'))
      for (let index = 0; index < 5; index++) {
        dispatchScrollTo(100 * (index + 1))
        await nextTick()
        expect(wrapper.classes()).not.toContain('is-scroll-hidden')
        // 两次下滑之间停顿 200ms（超过 120ms 断档阈值），累计时长不算连续
        vi.advanceTimersByTime(200)
      }
      expect(wrapper.classes()).not.toContain('is-scroll-hidden')
    } finally {
      vi.useRealTimers()
    }
    wrapper.unmount()
  })
  it('returns immediately when the user scrolls back up', async () => {
    const { wrapper } = await setup(false, '/showcase?tab=barn', true)
    vi.useFakeTimers()
    try {
      window.dispatchEvent(new Event('touchstart'))
      const top = await scrollDownContinuously(7)
      expect(wrapper.classes()).toContain('is-scroll-hidden')
      dispatchScrollTo(top - 60)
      await nextTick()
      expect(wrapper.classes()).not.toContain('is-scroll-hidden')
    } finally {
      vi.useRealTimers()
    }
    wrapper.unmount()
  })
  it('ignores the scroll restoration that follows a route change', async () => {
    const { wrapper, router } = await setup(false, '/showcase?tab=barn', true)
    vi.useFakeTimers()
    window.dispatchEvent(new Event('touchstart'))
    await scrollDownContinuously(7)
    expect(wrapper.classes()).toContain('is-scroll-hidden')
    vi.useRealTimers()
    await router.push('/clubs')
    await flushPromises()
    expect(wrapper.classes()).not.toContain('is-scroll-hidden')
    dispatchScrollTo(1800)
    await nextTick()
    expect(wrapper.classes()).not.toContain('is-scroll-hidden')
    wrapper.unmount()
  })
  it('returns immediately when the page stops hiding the bar', async () => {
    const { wrapper } = await setup(false, '/showcase?tab=barn', true)
    vi.useFakeTimers()
    try {
      window.dispatchEvent(new Event('touchstart'))
      await scrollDownContinuously(7)
      expect(wrapper.classes()).toContain('is-scroll-hidden')
      await wrapper.setProps({ autoHideOnScroll: false })
      expect(wrapper.classes()).not.toContain('is-scroll-hidden')
    } finally {
      vi.useRealTimers()
    }
    wrapper.unmount()
  })

  // 谷子卡片在 touchstart 上 stopPropagation（@touchstart.stop），
  // 冒泡监听收不到信号，收起效果会整个失效；捕获阶段必须照常工作。
  it('still marks user scrolling when a child stops touchstart propagation', async () => {
    const { wrapper } = await setup(false, '/showcase?tab=barn', true)
    const card = document.createElement('div')
    card.addEventListener('touchstart', event => event.stopPropagation())
    document.body.appendChild(card)
    vi.useFakeTimers()
    try {
      card.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }))
      await scrollDownContinuously(7)
      expect(wrapper.classes()).toContain('is-scroll-hidden')
    } finally {
      vi.useRealTimers()
      card.remove()
      wrapper.unmount()
    }
  })
})
