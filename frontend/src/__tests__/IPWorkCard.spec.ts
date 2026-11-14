import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IPWorkCard from '@/components/IPWorkCard.vue'
import type { IP } from '@/api/types'

const passthrough = (tag = 'span') => defineComponent({ template: `<${tag}><slot /></${tag}>` })

const baseIp: IP = {
  id: 1,
  name: '崩坏：星穹铁道',
  subject_type: 4,
  character_count: 184,
  bgm_subject_id: 360097,
  cover_image: 'https://lain.bgm.tv/pic/cover/l/d2/c9/360097_z4dYA.jpg',
  keywords: [
    { id: 1, value: 'HSR' },
    { id: 2, value: '崩铁' },
    { id: 3, value: '星铁' },
    { id: 4, value: '星穹铁道' },
  ],
}

const mountCard = (props: Record<string, unknown> = {}) =>
  mount(IPWorkCard, {
    props: { ip: baseIp, isAdmin: false, ...props },
    global: {
      stubs: {
        'el-tooltip': passthrough(),
        'el-icon': passthrough('i'),
      },
    },
  })

describe('IPWorkCard', () => {
  it('renders the Bangumi cover, type pill and character count', () => {
    const wrapper = mountCard()

    expect(wrapper.get('.ip-card-cover-image').attributes('src')).toBe(baseIp.cover_image)
    expect(wrapper.get('.ip-card-type').text()).toBe('游戏')
    expect(wrapper.get('.ip-card-count-value').text()).toBe('184')
    expect(wrapper.get('.ip-card-name').text()).toBe('崩坏：星穹铁道')
  })

  it('falls back to the first character when a card has no cover', () => {
    const wrapper = mountCard({ ip: { ...baseIp, cover_image: null } })

    expect(wrapper.find('.ip-card-cover-image').exists()).toBe(false)
    expect(wrapper.get('.ip-card-cover-initial').text()).toBe('崩')
  })

  it('falls back to the first character when the cover image fails to load', async () => {
    const wrapper = mountCard()

    await wrapper.get('.ip-card-cover-image').trigger('error')

    expect(wrapper.find('.ip-card-cover-image').exists()).toBe(false)
    expect(wrapper.get('.ip-card-cover-initial').text()).toBe('崩')
  })

  it('only shows the "暂无封面" hint to admins', () => {
    const anonymous = mountCard({ ip: { ...baseIp, cover_image: null } })
    const admin = mountCard({ ip: { ...baseIp, cover_image: null }, isAdmin: true })

    expect(anonymous.find('.ip-card-cover-hint').exists()).toBe(false)
    expect(admin.get('.ip-card-cover-hint').text()).toBe('暂无封面')
  })

  it('shows at most three keywords plus a +N counter', () => {
    const wrapper = mountCard()

    const chips = wrapper.findAll('.ip-card-keyword')
    expect(chips).toHaveLength(4)
    expect(chips[0]?.text()).toBe('HSR')
    expect(chips[2]?.text()).toBe('星铁')
    expect(chips[3]?.text()).toBe('+1')
    expect(chips[3]?.attributes('title')).toBe('HSR、崩铁、星铁、星穹铁道')
  })

  it('marks works without keywords', () => {
    const wrapper = mountCard({ ip: { ...baseIp, keywords: [] } })

    expect(wrapper.get('.ip-card-no-keyword').text()).toBe('暂无关键词')
  })

  it('emits open when the card, cover or name is clicked', async () => {
    const wrapper = mountCard()

    await wrapper.get('.ip-card').trigger('click')
    await wrapper.get('.ip-card-cover-hit').trigger('click')
    await wrapper.get('.ip-card-name').trigger('click')

    expect(wrapper.emitted('open')).toHaveLength(3)
    expect(wrapper.emitted('open')?.[0]).toEqual([baseIp])
  })

  it('hides admin-only actions from normal users and offers a plain open hint', () => {
    const wrapper = mountCard()

    expect(wrapper.find('.ip-card-drag').exists()).toBe(false)
    expect(wrapper.find('.ip-card-actions').exists()).toBe(false)
    expect(wrapper.get('.ip-card-open-hint').text()).toContain('查看角色')
  })

  it('renders the drag handle and action buttons for admins', () => {
    const wrapper = mountCard({ isAdmin: true, canEdit: true, canSync: true })

    expect(wrapper.find('.ip-card-drag').exists()).toBe(true)
    expect(wrapper.findAll('.ip-card-action')).toHaveLength(3)
  })

  it('hides the drag handle while a non-default sort is active', () => {
    const wrapper = mountCard({ isAdmin: true, canEdit: true, canSync: true, reorderable: false })

    expect(wrapper.find('.ip-card-drag').exists()).toBe(false)
    // 其它管理员操作不受影响
    expect(wrapper.findAll('.ip-card-action')).toHaveLength(3)
  })

  it('emits edit / remove / bgm-sync from the action buttons without opening the card', async () => {
    const wrapper = mountCard({ isAdmin: true, canEdit: true, canSync: true })
    const actions = wrapper.findAll('.ip-card-action')

    await actions[0]?.trigger('click')
    await actions[1]?.trigger('click')
    await actions[2]?.trigger('click')

    expect(wrapper.emitted('bgm-sync')?.[0]).toEqual([baseIp])
    expect(wrapper.emitted('edit')?.[0]).toEqual([baseIp])
    expect(wrapper.emitted('remove')?.[0]).toEqual([baseIp])
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('shows the "个人" badge only for user-created works', () => {
    expect(mountCard().find('.ip-card-personal-badge').exists()).toBe(false)

    const personal = mountCard({ ip: { ...baseIp, user_id: 7, is_personal: true } })

    expect(personal.get('.ip-card-personal-badge').text()).toBe('个人')
  })

  it('gives the owner edit rights on their personal work without the BGM entry', () => {
    const wrapper = mountCard({ ip: { ...baseIp, user_id: 7 }, canEdit: true })

    const actions = wrapper.findAll('.ip-card-action')
    expect(actions).toHaveLength(2)
    expect(wrapper.find('.ip-card-open-hint').exists()).toBe(false)
    // 个人 token 未配置时，页面不传 canSync，BGM 按钮不渲染
    expect(wrapper.find('[aria-label="从 Bangumi 更新角色"]').exists()).toBe(false)
  })

  it('hides the drag handle for owner-editable personal works', () => {
    const wrapper = mountCard({ ip: { ...baseIp, user_id: 7 }, canEdit: true })

    expect(wrapper.find('.ip-card-drag').exists()).toBe(false)
  })

  it('keeps the keyword tooltip and BGM badge for bound works', () => {
    const wrapper = mountCard()

    expect(wrapper.find('.ip-card-bgm-badge').exists()).toBe(true)
  })
})
