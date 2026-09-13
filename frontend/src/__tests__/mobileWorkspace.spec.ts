import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { activeMobileTab, isMobileJournalEditor, mobileHeaderMode, mobileModule, mobileModules, mobileNavAutoHides, mobileTabs } from '@/navigation/mobile'
import { useMobileWorkspaceStore } from '@/stores/mobileWorkspace'
import { useMobileWorkspace } from '@/composables/useMobileWorkspace'
import { useAuthStore } from '@/stores/auth'

describe('mobile workspace route contract', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it.each([
    ['/login', 'standalone'], ['/showcase', 'tabs'], ['/clubs', 'tabs'], ['/clubs/1', 'detail'],
    ['/location', 'tabs'], ['/ipcharacter', 'tabs'], ['/characters/1/stats', 'detail'], ['/category', 'tabs'], ['/theme', 'tabs'],
    ['/goods/new', 'editor'], ['/goods/drafts', 'detail'], ['/goods/1/edit', 'editor'], ['/preorders', 'tabs'], ['/settings', 'tabs'],
    ['/profile/account', 'tabs'], ['/profile/clubs', 'tabs'], ['/club/profile', 'tabs'], ['/club/goods', 'tabs'],
    ['/club/goods/new', 'editor'], ['/club/goods/1/edit', 'editor'], ['/club/themes', 'tabs'], ['/club/popularity', 'tabs'],
    ['/admin/users', 'standalone'], ['/admin/goods', 'standalone'], ['/admin/ip', 'standalone'], ['/admin/categories', 'standalone'],
    ['/admin/themes', 'standalone'], ['/admin/goods-crafts', 'standalone'], ['/admin/bgm-sync', 'standalone'],
  ])('%s has the expected mobile frame', (path, mode) => expect(mobileHeaderMode(path)).toBe(mode))
  it('groups all old organize routes without changing URLs', () => {
    for (const path of ['/location', '/ipcharacter', '/category', '/theme', '/ip', '/character']) expect(mobileModule({ path, query: {} })).toBe('organize')
    expect(mobileModule({ path: '/preorders', query: {} })).toBe('showcase')
  })
  it('normalizes malformed showcase links to the barn', () => {
    for (const tab of [undefined, 'nope', ['stats', 'barn']]) expect(activeMobileTab({ path: '/showcase', query: { tab: tab ?? null } })).toBe('barn')
    expect(activeMobileTab({ path: '/showcase', query: { tab: 'journal' } })).toBe('journal')
  })
  it('uses immersive shell only for the mobile journal editor', () => {
    expect(isMobileJournalEditor({ path: '/showcase', query: { tab: 'journal' } })).toBe(true)
    for (const tab of ['showcase', 'barn', 'stats', undefined]) {
      expect(isMobileJournalEditor({ path: '/showcase', query: { tab: tab ?? null } })).toBe(false)
    }
    expect(isMobileJournalEditor({ path: '/preorders', query: {} })).toBe(false)
  })
  it('hides the bottom bar on scroll only inside the barn', () => {
    expect(mobileNavAutoHides({ path: '/showcase', query: {} })).toBe(true)
    expect(mobileNavAutoHides({ path: '/showcase', query: { tab: 'barn' } })).toBe(true)
    for (const tab of ['showcase', 'stats', 'journal']) expect(mobileNavAutoHides({ path: '/showcase', query: { tab } })).toBe(false)
    for (const path of ['/preorders', '/location', '/clubs', '/profile/account']) expect(mobileNavAutoHides({ path, query: {} })).toBe(false)
  })
  it('keeps service settings reachable for anonymous users and isolates club tabs', () => {
    expect(mobileModules({ isClub: false, isAuthenticated: false }).find(item => item.key === 'profile')?.to).toBe('/settings')
    expect(mobileTabs('profile', { isClub: true, isAuthenticated: true }).map(item => item.key)).toEqual(['account', 'settings'])
  })
  it('clears remembered destinations and scroll without touching local settings', () => {
    const store = useMobileWorkspaceStore()
    localStorage.setItem('unrelated', 'keep')
    store.remember('organize', '/theme')
    store.saveScroll('/theme', 560)
    store.reset()
    expect(store.destinations).toEqual({})
    expect(store.scrollPositions).toEqual({})
    expect(store.epoch).toBe(1)
    expect(localStorage.getItem('unrelated')).toBe('keep')
  })
  it('remembers only workspaces and resets on identity changes', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
    await router.push('/theme')
    const wrapper = mount(defineComponent({ setup() { useMobileWorkspace(ref(true)); return {} }, template: '<div />' }), { global: { plugins: [router] } })
    const store = useMobileWorkspaceStore()
    await flushPromises()
    expect(store.destinations.organize).toBe('/theme')
    await router.push('/goods/new')
    await flushPromises()
    expect(store.destinations.showcase).toBeUndefined()
    useAuthStore().token = 'new-session'
    await flushPromises()
    expect(store.destinations).toEqual({})
    wrapper.unmount()
    vi.restoreAllMocks()
  })
})
