import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubWorkspace from '@/views/club/ClubWorkspace.vue'
import { useAuthStore } from '@/stores/auth'

const { routeMock, pushMock } = vi.hoisted(() => ({
  routeMock: { name: 'ClubGoods', params: {} },
  pushMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
  useRouter: () => ({ push: pushMock }),
}))

const passthroughStub = (name: string, tag = 'div') => defineComponent({
  name,
  template: `<${tag}><slot /></${tag}>`,
})

describe('ClubWorkspace 社团工作区导航', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'club', role: 'User', account_type: 'club', club: { name: '测试社团' } } as any
    routeMock.name = 'ClubGoods'
    pushMock.mockReset()
  })

  function mountWorkspace() {
    return mount(ClubWorkspace, {
      global: {
        stubs: {
          ElButton: passthroughStub('ElButton', 'button'),
          ElIcon: passthroughStub('ElIcon', 'span'),
          RouterLink: defineComponent({
            props: { to: { type: String, default: '' } },
            template: '<a :href="to"><slot /></a>',
          }),
          RouterView: passthroughStub('RouterView'),
        },
      },
    })
  }

  it('编辑或新增社团谷子时隐藏工作区三个 TAB', () => {
    routeMock.name = 'ClubGoodsEdit'
    const wrapper = mountWorkspace()

    expect(wrapper.find('.workspace-tabs').exists()).toBe(false)
  })

  it('社团谷子列表页仍显示工作区导航', () => {
    const wrapper = mountWorkspace()

    expect(wrapper.findAll('.workspace-tabs a')).toHaveLength(3)
    expect(wrapper.find('.workspace-tab-slider').attributes('style')).toContain('translateX(0%)')
    expect(wrapper.text()).toContain('社团谷子')
    expect(wrapper.text()).toContain('人气统计')
    expect(wrapper.text()).toContain('社团资料')
  })

  it('根据当前子路由移动唯一滑块，并把内容切换限制在嵌套路由区域', async () => {
    routeMock.name = 'ClubPopularity'
    const wrapper = mountWorkspace()

    expect(wrapper.find('.workspace-tab-slider').attributes('style')).toContain('translateX(100%)')
    expect(wrapper.find('.workspace-tab.is-active').text()).toContain('人气统计')
    expect(wrapper.findAll('.workspace-tabs a')).toHaveLength(3)
  })
})
