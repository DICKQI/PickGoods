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
    ['/location', 'tabs'], ['/organize', 'tabs'], ['/characters/1/stats', 'detail'],
    ['/goods/new', 'editor'], ['/goods/drafts', 'detail'], ['/goods/1/edit', 'editor'], ['/preorders', 'tabs'], ['/settings', 'tabs'],
    ['/profile/account', 'tabs'], ['/profile/clubs', 'tabs'], ['/club/profile', 'tabs'], ['/club/goods', 'tabs'],
    ['/club/goods/new', 'editor'], ['/club/goods/1/edit', 'editor'], ['/club/gamification', 'tabs'], ['/club/themes', 'tabs'], ['/club/popularity', 'tabs'],
    ['/admin/users', 'standalone'], ['/admin/goods', 'standalone'], ['/admin/ip', 'standalone'], ['/admin/categories', 'standalone'],
    ['/admin/themes', 'standalone'], ['/admin/goods-crafts', 'standalone'], ['/admin/bgm-sync', 'standalone'],
  ])('%s has the expected mobile frame', (path, mode) => expect(mobileHeaderMode(path)).toBe(mode))
  it('groups the merged organize route and its legacy aliases', () => {
    for (const path of ['/organize', '/location', '/ipcharacter', '/category', '/theme', '/ip', '/character']) expect(mobileModule({ path, query: {} })).toBe('organize')
    expect(mobileModule({ path: '/preorders', query: {} })).toBe('showcase')
  })
  it('derives the organize tab key from the merged route query', () => {
    expect(activeMobileTab({ path: '/organize', query: {} })).toBe('ip')
    expect(activeMobileTab({ path: '/organize', query: { tab: 'category' } })).toBe('category')
    expect(activeMobileTab({ path: '/organize', query: { tab: 'nope' } })).toBe('ip')
    expect(activeMobileTab({ path: '/location', query: {} })).toBe('location')
  })
  it('keeps the organize tab bar as four entries with merged URLs', () => {
    expect(mobileTabs('organize', { isClub: false, isAuthenticated: true }).map(item => [item.key, item.to])).toEqual([
      ['location', '/location'],
      ['ip', '/organize?tab=ip'],
      ['category', '/organize?tab=category'],
      ['theme', '/organize?tab=theme'],
    ])
  })
  it('normalizes malformed showcase links to the barn', () => {
    for (const tab of [undefined, 'nope', ['stats', 'barn']]) expect(activeMobileTab({ path: '/showcase', query: { tab: tab ?? null } })).toBe('barn')
    expect(activeMobileTab({ path: '/showcase', query: { tab: 'journal' } })).toBe('journal')
  })
  it('uses immersive shell only for the mobile journal editor', () => {
    expect(isMobileJournalEditor({ path: '/showcase', query: { tab: 'journal', book: 'book-1' } })).toBe(true)
    expect(isMobileJournalEditor({ path: '/showcase', query: { tab: 'journal' } })).toBe(false)
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
    expect(mobileTabs('workbench', { isClub: true, isAuthenticated: true }).map(item => item.key)).toEqual(['goods', 'gamification', 'themes', 'popularity', 'profile'])
    expect(mobileTabs('profile', { isClub: true, isAuthenticated: true }).map(item => item.key)).toEqual(['account', 'settings'])
  })
  it('clears remembered destinations and scroll without touching local settings', () => {
    const store = useMobileWorkspaceStore()
    localStorage.setItem('unrelated', 'keep')
    store.remember('organize', '/organize?tab=theme')
    store.saveScroll('/organize?tab=theme', 560)
    store.reset()
    expect(store.destinations).toEqual({})
    expect(store.scrollPositions).toEqual({})
    expect(store.epoch).toBe(1)
    expect(localStorage.getItem('unrelated')).toBe('keep')
  })
  it('remembers only workspaces and resets on identity changes', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
    await router.push('/organize?tab=theme')
    const wrapper = mount(defineComponent({ setup() { useMobileWorkspace(ref(true)); return {} }, template: '<div />' }), { global: { plugins: [router] } })
    const store = useMobileWorkspaceStore()
    await flushPromises()
    expect(store.destinations.organize).toBe('/organize?tab=theme')
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
