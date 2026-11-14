import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IPCharactersDrawer from '@/components/IPCharactersDrawer.vue'
import type { Character, IP } from '@/api/types'

const passthrough = (tag = 'span') => defineComponent({ template: `<${tag}><slot /></${tag}>` })

const DrawerStub = defineComponent({
  props: { modelValue: Boolean, direction: String, size: String },
  template: '<div class="drawer-stub" :data-open="String(modelValue)"><slot /></div>',
})

const InputStub = defineComponent({
  inheritAttrs: false,
  props: { modelValue: String, placeholder: String, size: String, clearable: Boolean },
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})

const ButtonStub = defineComponent({
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
})

const ip: IP = {
  id: 1,
  name: '崩坏：星穹铁道',
  subject_type: 4,
  character_count: 2,
  bgm_subject_id: 360097,
  cover_image: 'https://lain.bgm.tv/pic/cover/l/d2/c9/360097_z4dYA.jpg',
  keywords: [{ id: 1, value: '星铁' }],
}

const characters: Character[] = [
  { id: 11, name: '流萤', ip, gender: 'female', avatar: 'https://lain.bgm.tv/a.jpg' },
  { id: 12, name: '花火', ip, gender: 'female', avatar: null },
]

const mountDrawer = (props: Record<string, unknown> = {}) =>
  mount(IPCharactersDrawer, {
    props: { modelValue: true, ip, characters, isAdmin: false, ...props },
    global: {
      stubs: {
        'el-drawer': DrawerStub,
        'el-input': InputStub,
        'el-button': ButtonStub,
        'el-avatar': passthrough('span'),
        'el-icon': passthrough('i'),
        'el-empty': defineComponent({
          props: { description: String },
          template: '<div class="empty-stub">{{ description }}</div>',
        }),
      },
      directives: { loading: {} },
    },
  })

describe('IPCharactersDrawer', () => {
  it('shows the work header with cover, type, keyword and BGM badge', () => {
    const wrapper = mountDrawer()

    expect(wrapper.get('.ip-drawer-title').text()).toBe('崩坏：星穹铁道')
    expect(wrapper.get('.ip-drawer-cover img').attributes('src')).toBe(ip.cover_image)
    expect(wrapper.get('.ip-drawer-type').text()).toBe('游戏')
    expect(wrapper.get('.ip-drawer-count').text()).toBe('2 个角色')
    expect(wrapper.get('.ip-drawer-keyword').text()).toBe('星铁')
    expect(wrapper.find('.ip-drawer-bgm').exists()).toBe(true)
  })

  it('falls back to the first character when the work has no cover', () => {
    const wrapper = mountDrawer({ ip: { ...ip, cover_image: null } })

    expect(wrapper.find('.ip-drawer-cover img').exists()).toBe(false)
    expect(wrapper.get('.ip-drawer-cover-initial').text()).toBe('崩')
  })

  it('renders every character tile', () => {
    const wrapper = mountDrawer()

    const tiles = wrapper.findAll('.ip-drawer-tile')
    expect(tiles).toHaveLength(2)
    expect(tiles[0]?.text()).toContain('流萤')
    expect(tiles[1]?.text()).toContain('花火')
  })

  it('filters characters by name', async () => {
    const wrapper = mountDrawer()

    await wrapper.get('input').setValue('流萤')

    const tiles = wrapper.findAll('.ip-drawer-tile')
    expect(tiles).toHaveLength(1)
    expect(tiles[0]?.text()).toContain('流萤')
  })

  it('shows a filtered empty state when nothing matches', async () => {
    const wrapper = mountDrawer()

    await wrapper.get('input').setValue('不存在的角色')

    expect(wrapper.find('.ip-drawer-tile').exists()).toBe(false)
    expect(wrapper.get('.empty-stub').text()).toBe('没有匹配的角色')
  })

  it('shows the plain empty state for works without characters', () => {
    const wrapper = mountDrawer({ characters: [] })

    expect(wrapper.get('.empty-stub').text()).toBe('该作品下暂无角色')
  })

  it('lets admins add, edit and delete characters', async () => {
    const wrapper = mountDrawer({ isAdmin: true })

    await wrapper.get('.ip-drawer-add').trigger('click')
    await wrapper.findAll('.ip-drawer-tile')[0]?.trigger('click')
    await wrapper.findAll('.ip-drawer-tile-delete')[0]?.trigger('click')

    expect(wrapper.emitted('add-character')?.[0]).toEqual([ip])
    expect(wrapper.emitted('edit-character')?.[0]).toEqual([characters[0]])
    expect(wrapper.emitted('delete-character')?.[0]).toEqual([characters[0]])
  })

  it('keeps tiles read-only for normal users', async () => {
    const wrapper = mountDrawer()

    expect(wrapper.find('.ip-drawer-add').exists()).toBe(false)
    expect(wrapper.find('.ip-drawer-tile-delete').exists()).toBe(false)

    await wrapper.findAll('.ip-drawer-tile')[0]?.trigger('click')

    expect(wrapper.emitted('edit-character')).toBeUndefined()
  })

  it('emits update:modelValue when the close button is used', async () => {
    const wrapper = mountDrawer()

    await wrapper.get('.ip-drawer-close').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })
})
