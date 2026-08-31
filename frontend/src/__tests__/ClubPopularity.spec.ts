import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubPopularity from '@/views/club/ClubPopularity.vue'

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() },
}))

vi.mock('@/api/clubs', () => ({
  getMyClubPopularity: vi.fn(),
}))

import * as clubApi from '@/api/clubs'

const passthrough = (name: string, tag = 'div') => defineComponent({
  name,
  inheritAttrs: false,
  template: `<${tag} v-bind="$attrs"><slot /></${tag}>`,
})

const emptyComponent = (name: string) => defineComponent({ name, template: '<div />' })

describe('ClubPopularity 人气统计', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(clubApi.getMyClubPopularity).mockResolvedValue([
      { goods_id: 'goods-1', goods_name: '测试谷子', intended_user_count: 3, acquired_user_count: 5 },
    ])
  })

  it('使用已入手文案并以徽标展示两项统计', async () => {
    const wrapper = mount(ClubPopularity, {
      global: {
        directives: { loading: {} },
        stubs: {
          ElButton: passthrough('ElButton', 'button'),
          ElEmpty: passthrough('ElEmpty'),
          ElIcon: passthrough('ElIcon', 'span'),
          ElTable: emptyComponent('ElTable'),
          ElTableColumn: emptyComponent('ElTableColumn'),
          ElTag: passthrough('ElTag', 'span'),
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('意向入手 3 人')
    expect(wrapper.text()).toContain('已入手 5 人')
    expect(wrapper.text()).not.toContain('曾经入手')
    expect(wrapper.find('.stat-badge--intended').exists()).toBe(true)
    expect(wrapper.find('.stat-badge--acquired').exists()).toBe(true)
  })
})
