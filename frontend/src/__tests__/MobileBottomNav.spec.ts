import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import MobileBottomNav from '@/components/MobileBottomNav.vue'
import { useAuthStore } from '@/stores/auth'
import { useMobileWorkspaceStore } from '@/stores/mobileWorkspace'

async function setup(club = false, path = '/showcase') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.token = 'test'
  auth.user = { id: 1, username: 'test', role: 'User', account_type: club ? 'club' : 'collector', approval_status: 'approved' }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
  await router.push(path)
  const wrapper = mount(MobileBottomNav, { global: { plugins: [pinia, router], stubs: { ElIcon: { template: '<i><slot /></i>' } } } })
  return { wrapper, router, store: useMobileWorkspaceStore() }
}
describe('fixed mobile navigation', () => {
  beforeEach(() => localStorage.clear())
  it('uses four collector modules regardless of old preferences', async () => {
    localStorage.setItem('pickgoods:mobile-bottom-nav', '["theme"]')
    const { wrapper } = await setup()
    expect(wrapper.findAll('.nav-label').map(n => n.text())).toEqual(['社团', '云展柜', '整理', '我的'])
    window.dispatchEvent(new Event('scroll'))
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
})
