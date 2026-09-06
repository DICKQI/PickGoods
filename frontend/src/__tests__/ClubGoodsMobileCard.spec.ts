import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ClubGoodsMobileCard from '@/components/club/ClubGoodsMobileCard.vue'
import type { ClubCatalogItem } from '@/api/types'

const item: ClubCatalogItem = {
  id: 'mobile-item',
  name: '限定镭射票',
  description: '',
  ip: { id: 1, name: '崩坏：星穹铁道' },
  characters: [],
  category: { id: 1, name: '票根', parent: null, path_name: '票根', order: 1 },
  theme: null,
  main_photo: '/media/item.jpg',
  additional_photos: [],
  public_price: '88.00',
  is_official: false,
  publication_status: 'listed',
  order: 0,
  created_at: '',
  updated_at: '',
}

const passthrough = (tag = 'span') => defineComponent({ template: `<${tag}><slot /></${tag}>` })
const ImageStub = defineComponent({
  inheritAttrs: false,
  props: { src: String, lazy: Boolean },
  template: '<img :src="src" :data-lazy="String(lazy)" />',
})
const CheckboxStub = defineComponent({
  props: { modelValue: Boolean, disabled: Boolean },
  emits: ['change'],
  template: '<input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'change\', $event.target.checked)" />',
})

function mountCard(overrides: Record<string, unknown> = {}) {
  return mount(ClubGoodsMobileCard, {
    props: {
      item,
      popularity: { goods_id: item.id, goods_name: item.name, publication_status: 'listed', intended_user_count: 3, acquired_user_count: 2 },
      selectionMode: false,
      selected: false,
      selectionDisabled: false,
      canMoveUp: true,
      canMoveDown: true,
      ...overrides,
    },
    global: { stubs: { ElIcon: passthrough(), ElTag: passthrough(), ElImage: ImageStub, ElCheckbox: CheckboxStub } },
  })
}

describe('ClubGoodsMobileCard', () => {
  it('展示核心信息、人气和懒加载图片', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('限定镭射票')
    expect(wrapper.text()).toContain('崩坏：星穹铁道 · 票根')
    expect(wrapper.text()).toContain('¥88.00')
    expect(wrapper.text()).toContain('已上架')
    expect(wrapper.text()).toContain('意向 3')
    expect(wrapper.text()).toContain('已入手 2')
    expect(wrapper.get('img').attributes('data-lazy')).toBe('true')
  })

  it('更多和上下移动按钮分别发出操作事件', async () => {
    const wrapper = mountCard()
    await wrapper.get('[aria-label="打开限定镭射票操作菜单"]').trigger('click')
    await wrapper.get('[aria-label="上移"]').trigger('click')
    await wrapper.get('[aria-label="下移"]').trigger('click')
    expect(wrapper.emitted('menu')).toHaveLength(1)
    expect(wrapper.emitted('move')).toEqual([['up'], ['down']])
  })

  it('选择模式支持整卡选择并呈现选中和禁用状态', async () => {
    const wrapper = mountCard({ selectionMode: true, selected: true })
    expect(wrapper.classes()).toContain('is-selected')
    await wrapper.trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([[false]])

    await wrapper.setProps({ selected: false, selectionDisabled: true })
    expect(wrapper.classes()).toContain('is-disabled')
    await wrapper.trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([[false]])
  })

  it('无图片时展示占位区域', () => {
    const wrapper = mountCard({ item: { ...item, main_photo: null } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[aria-label="暂无图片"]').attributes('aria-label')).toBe('暂无图片')
  })
})
