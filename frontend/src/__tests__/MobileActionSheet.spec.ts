import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { markRaw } from 'vue'
import { Edit, Delete } from '@element-plus/icons-vue'
import MobileActionSheet from '@/components/MobileActionSheet.vue'

describe('MobileActionSheet', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders actions and emits the selected action key', async () => {
    const wrapper = mount(MobileActionSheet, {
      attachTo: document.body,
      props: {
        modelValue: true,
        title: '对「测试主题」进行操作',
        actions: [
          { key: 'edit', label: '编辑主题', icon: markRaw(Edit) },
          { key: 'delete', label: '删除主题', icon: markRaw(Delete), tone: 'danger' },
        ],
      },
      global: {
        stubs: {
          'el-icon': { template: '<i><slot /></i>' },
          Transition: false,
        },
      },
    })

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-label')).toBe('对「测试主题」进行操作')
    expect(document.body.querySelectorAll('.mobile-action-sheet__item')).toHaveLength(2)

    await document.body.querySelectorAll<HTMLButtonElement>('.mobile-action-sheet__item')[1]?.click()

    expect(wrapper.emitted('select')?.[0]).toEqual(['delete'])
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('marks the primary and danger actions with distinct tones', () => {
    mount(MobileActionSheet, {
      attachTo: document.body,
      props: {
        modelValue: true,
        title: '操作',
        actions: [
          { key: 'add', label: '新增子类', icon: markRaw(Edit), tone: 'primary' },
          { key: 'delete', label: '删除品类', icon: markRaw(Delete), tone: 'danger' },
        ],
      },
      global: {
        stubs: {
          'el-icon': { template: '<i><slot /></i>' },
          Transition: false,
        },
      },
    })

    const actions = document.body.querySelectorAll('.mobile-action-sheet__item')
    expect(actions[0]?.classList.contains('mobile-action-sheet__item--primary')).toBe(true)
    expect(actions[1]?.classList.contains('mobile-action-sheet__item--danger')).toBe(true)
  })

  it('renders confirm mode when message is provided', async () => {
    const wrapper = mount(MobileActionSheet, {
      attachTo: document.body,
      props: {
        modelValue: true,
        title: '删除预购',
        actions: [],
        message: '确定删除「流萤手办」？相关通知将一并删除。',
        confirmText: '删除',
        cancelText: '再想想',
        confirmTone: 'danger',
      },
      global: {
        stubs: {
          'el-icon': { template: '<i><slot /></i>' },
          Transition: false,
        },
      },
    })

    expect(document.body.textContent).toContain('确定删除「流萤手办」？相关通知将一并删除。')
    expect(document.body.querySelectorAll('.mobile-action-sheet__item')).toHaveLength(0)

    const buttons = document.body.querySelectorAll<HTMLButtonElement>('.mobile-action-sheet__confirm-btn')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.textContent).toContain('再想想')
    expect(buttons[1]?.textContent).toContain('删除')
    expect(buttons[1]?.classList.contains('mobile-action-sheet__confirm-btn--danger')).toBe(true)

    await buttons[1]?.click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('confirm mode cancel button closes without emitting confirm', async () => {
    const wrapper = mount(MobileActionSheet, {
      attachTo: document.body,
      props: {
        modelValue: true,
        title: '标记已补款',
        actions: [],
        message: '此操作不可撤销',
      },
      global: {
        stubs: {
          'el-icon': { template: '<i><slot /></i>' },
          Transition: false,
        },
      },
    })

    const buttons = document.body.querySelectorAll<HTMLButtonElement>('.mobile-action-sheet__confirm-btn')
    await buttons[0]?.click()
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })
})
