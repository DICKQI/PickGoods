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
})
