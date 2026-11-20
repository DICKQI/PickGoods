import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IPWorkCardMobile from '@/components/IPWorkCardMobile.vue'
import type { IP } from '@/api/types'

const passthrough = (tag = 'span') => defineComponent({ template: `<${tag}><slot /></${tag}>` })

const baseIp: IP = {
  id: 1,
  name: '崩坏：星穹铁道',
  subject_type: 4,
  character_count: 184,
  bgm_subject_id: 360097,
  cover_image: '/media/ips/covers/7d0c4b8e9a.jpg',
  keywords: [
    { id: 1, value: 'HSR' },
    { id: 2, value: '崩铁' },
    { id: 3, value: '星铁' },
  ],
}

const mountCard = (props: Record<string, unknown> = {}) =>
  mount(IPWorkCardMobile, {
    props: { ip: baseIp, ...props },
    global: {
      stubs: {
        'el-icon': passthrough('i'),
      },
    },
  })

describe('IPWorkCardMobile', () => {
  it('renders the server-hosted cover, type pill, name and character count', () => {
    const wrapper = mountCard()

    expect(wrapper.get('.ip-mobile-cover-img').attributes('src')).toBe(baseIp.cover_image)
    expect(wrapper.get('.ip-mobile-type').text()).toBe('游戏')
    expect(wrapper.get('.ip-mobile-name').text()).toBe('崩坏：星穹铁道')
    expect(wrapper.get('.ip-mobile-count-value').text()).toBe('184')
    expect(wrapper.get('.ip-mobile-count-label').text()).toBe('角色')
  })

  it('keeps the cover at its natural aspect ratio instead of cropping it', () => {
    const wrapper = mountCard()
    const cover = wrapper.get('.ip-mobile-cover-img')

    // 瀑布流靠原始比例错落：图片只约束宽度，高度交给图片自身
    expect(cover.attributes('loading')).toBe('lazy')
    expect(wrapper.find('.ip-mobile-cover-fallback').exists()).toBe(false)
  })

  it('falls back to the first character when a card has no cover', () => {
    const wrapper = mountCard({ ip: { ...baseIp, cover_image: null } })

    expect(wrapper.find('.ip-mobile-cover-img').exists()).toBe(false)
    expect(wrapper.get('.ip-mobile-cover-initial').text()).toBe('崩')
  })

  it('falls back to the first character when the cover image fails to load', async () => {
    const wrapper = mountCard()

    await wrapper.get('.ip-mobile-cover-img').trigger('error')

    expect(wrapper.find('.ip-mobile-cover-img').exists()).toBe(false)
    expect(wrapper.get('.ip-mobile-cover-initial').text()).toBe('崩')
  })

  it('shows at most two keywords plus a +N counter', () => {
    const wrapper = mountCard()
    const tags = wrapper.findAll('.ip-mobile-tag')

    expect(tags.map((tag) => tag.text())).toEqual(['HSR', '崩铁', '+1'])
  })

  it('marks personal works and only shows the personal badge for them', () => {
    const official = mountCard()
    const personal = mountCard({ ip: { ...baseIp, user_id: 7 } })

    expect(official.find('.ip-mobile-personal').exists()).toBe(false)
    expect(personal.get('.ip-mobile-personal').text()).toBe('个人')
  })

  it('opens the character drawer from the cover and from the body', async () => {
    const wrapper = mountCard()

    await wrapper.get('.ip-mobile-cover').trigger('click')
    await wrapper.get('.ip-mobile-body').trigger('click')

    const events = wrapper.emitted('open') ?? []
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual([baseIp])
  })

  it('only exposes the action menu to cards the account may manage', async () => {
    const readOnly = mountCard()
    const admin = mountCard({ canEdit: true, canSync: true, isAdmin: true })

    expect(readOnly.find('.ip-mobile-menu').exists()).toBe(false)

    await admin.get('.ip-mobile-menu').trigger('click')
    expect(admin.emitted('menu')).toEqual([[baseIp]])
  })

  it('only renders the drag handle for reorderable official works', () => {
    const anonymous = mountCard()
    const admin = mountCard({ isAdmin: true })
    const personalAdmin = mountCard({ isAdmin: true, ip: { ...baseIp, user_id: 7 } })
    const sortedAdmin = mountCard({ isAdmin: true, reorderable: false })

    expect(anonymous.find('.mobile-drag-handle').exists()).toBe(false)
    expect(admin.find('.mobile-drag-handle').exists()).toBe(true)
    expect(personalAdmin.find('.mobile-drag-handle').exists()).toBe(false)
    expect(sortedAdmin.find('.mobile-drag-handle').exists()).toBe(false)
  })
})
