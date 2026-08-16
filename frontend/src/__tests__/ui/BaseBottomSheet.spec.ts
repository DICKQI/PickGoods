import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseBottomSheet from '@/components/ui/BaseBottomSheet.vue'

const mountSheet = (props: Record<string, unknown> = {}) =>
  mount(BaseBottomSheet, {
    attachTo: document.body,
    props: {
      modelValue: true,
      title: '新增预购',
      subtitle: '登记外部平台下单的手办定金',
      ...props,
    },
    global: {
      stubs: {
        'el-icon': { template: '<i><slot /></i>' },
        Transition: false,
        Teleport: true,
      },
    },
  })

describe('BaseBottomSheet', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  it('打开时渲染面板并锁定 body 滚动，关闭恢复', async () => {
    const wrapper = mountSheet()
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-label')).toBe('新增预购')
    expect(document.body.textContent).toContain('登记外部平台下单的手办定金')
    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.setProps({ modelValue: false })
    expect(document.body.style.overflow).toBe('')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('点背板、关闭按钮或 Escape 关闭并 emit update:modelValue', async () => {
    const wrapper = mountSheet()
    const closeButton = document.body.querySelector<HTMLButtonElement>('.base-bottom-sheet__close')!
    await closeButton.click()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    await wrapper.setProps({ modelValue: false })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    await wrapper.setProps({ modelValue: true })
    const backdrop = document.body.querySelector<HTMLButtonElement>('.base-bottom-sheet__backdrop')!
    await backdrop.click()
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([false])
    await wrapper.setProps({ modelValue: false })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    await wrapper.setProps({ modelValue: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('update:modelValue')?.[2]).toEqual([false])
  })

  it('渲染 default 与 footer 插槽', () => {
    mount(BaseBottomSheet, {
      attachTo: document.body,
      props: { modelValue: true, title: '表单' },
      slots: {
        default: '<div class="sheet-body-content">正文</div>',
        footer: '<button class="sheet-footer-btn">保存</button>',
      },
      global: {
        stubs: {
          'el-icon': { template: '<i><slot /></i>' },
          Transition: false,
          Teleport: true,
        },
      },
    })
    expect(document.body.querySelector('.sheet-body-content')?.textContent).toBe('正文')
    expect(document.body.querySelector('.sheet-footer-btn')?.textContent).toBe('保存')
  })
})
