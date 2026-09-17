import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import GoodsCard from '@/components/GoodsCard.vue'
import type { GoodsListItem } from '@/api/types'

const goods: GoodsListItem = {
  id: 'goods-1',
  name: '测试谷子',
  ip: { id: 1, name: '测试 IP' },
  characters: [{ id: 1, name: '角色', ip: { id: 1, name: '测试 IP' }, gender: 'other' }],
  category: { id: 1, name: '亚克力', parent: null, path_name: '亚克力', order: 1 },
  location_path: '柜子/第一层',
  main_photo: null,
  status: 'in_cabinet',
  quantity: 1,
  is_official: true,
}

const HOVER_QUERY = '(hover: hover) and (pointer: fine)'
const DESKTOP_QUERY = '(min-width: 769px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const stubMatchMedia = (overrides: Record<string, boolean> = {}) => {
  const matches: Record<string, boolean> = {
    [HOVER_QUERY]: true,
    [DESKTOP_QUERY]: true,
    [REDUCED_MOTION_QUERY]: false,
    ...overrides,
  }

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matches[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const mountCard = (props: Partial<InstanceType<typeof GoodsCard>['$props']> = {}) =>
  mount(GoodsCard, {
    props: {
      goods,
      ...props,
    },
    global: {
      stubs: {
        'el-icon': { template: '<i><slot /></i>' },
        'el-image': { template: '<div><slot name="error" /></div>' },
        WatermarkImage: true,
      },
    },
  })

const stubRect = (el: HTMLElement) => {
  el.getBoundingClientRect = () =>
    ({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
      right: 300,
      bottom: 150,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    }) as DOMRect
}

const flushFrames = async () => {
  if (typeof window.requestAnimationFrame === 'function') {
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
  }
}

interface PointerInit {
  pointerType?: string
  clientX?: number
  clientY?: number
}

const dispatchPointer = async (
  target: HTMLElement,
  type: string,
  init: PointerInit = {},
) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerType: { value: init.pointerType ?? 'mouse' },
    clientX: { value: init.clientX ?? 0 },
    clientY: { value: init.clientY ?? 0 },
  })
  target.dispatchEvent(event)
  await nextTick()
}

const readNumber = (el: HTMLElement, variable: string, fallback = Number.NaN) => {
  const raw = el.style.getPropertyValue(variable)
  if (!raw) return fallback
  return Number.parseFloat(raw)
}

const goodsCardSource = () =>
  readFileSync(resolve(process.cwd(), 'src/components/GoodsCard.vue'), 'utf8')

const cloudShowcaseSource = () =>
  readFileSync(resolve(process.cwd(), 'src/views/CloudShowcase.vue'), 'utf8')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GoodsCard 指针跟随 3D', () => {
  it('默认关闭，不渲染高光层也不响应指针', async () => {
    stubMatchMedia()
    const wrapper = mountCard()
    const el = wrapper.element as HTMLElement
    stubRect(el)

    expect(wrapper.classes()).not.toContain('is-interactive-3d')
    expect(wrapper.find('.card-acrylic-glare').exists()).toBe(false)

    await dispatchPointer(el, 'pointerenter', {
      pointerType: 'mouse',
      clientX: 300,
      clientY: 150,
    })
    await dispatchPointer(el, 'pointermove', {
      pointerType: 'mouse',
      clientX: 300,
      clientY: 150,
    })
    await flushFrames()

    expect(wrapper.classes()).not.toContain('is-tilting')
    expect(el.style.getPropertyValue('--card-tilt-y')).toBe('')
  })

  it('开启后同步倾斜、高光和图片视差，鼠标离开后复位', async () => {
    stubMatchMedia()
    const wrapper = mountCard({ interactive3d: true })
    const el = wrapper.element as HTMLElement
    stubRect(el)

    expect(wrapper.classes()).toContain('is-interactive-3d')
    expect(wrapper.find('.card-acrylic-glare').exists()).toBe(true)

    await dispatchPointer(el, 'pointerenter', {
      pointerType: 'mouse',
      clientX: 300,
      clientY: 150,
    })
    await dispatchPointer(el, 'pointermove', {
      pointerType: 'mouse',
      clientX: 300,
      clientY: 150,
    })
    await flushFrames()

    expect(wrapper.classes()).toContain('is-tilting')
    expect(readNumber(el, '--card-tilt-x')).toBeCloseTo(6, 2)
    expect(readNumber(el, '--card-tilt-y')).toBeCloseTo(-6, 2)
    expect(el.style.getPropertyValue('--card-glare-x')).toBe('100.00%')
    expect(el.style.getPropertyValue('--card-glare-y')).toBe('100.00%')
    expect(readNumber(el, '--card-image-shift-x')).toBeCloseTo(-3, 2)
    expect(readNumber(el, '--card-image-shift-y')).toBeCloseTo(-3, 2)

    await dispatchPointer(el, 'pointerleave', { pointerType: 'mouse' })

    expect(wrapper.classes()).not.toContain('is-tilting')
    expect(readNumber(el, '--card-tilt-x', 0)).toBe(0)
    expect(readNumber(el, '--card-tilt-y', 0)).toBe(0)
    expect(readNumber(el, '--card-image-shift-x', 0)).toBe(0)
    expect(el.style.getPropertyValue('--card-glare-x')).toBe('50%')
  })

  it('多选模式禁用倾斜并隐藏高光层', async () => {
    stubMatchMedia()
    const wrapper = mountCard({ interactive3d: true, selectable: true })
    const el = wrapper.element as HTMLElement
    stubRect(el)

    expect(wrapper.find('.card-acrylic-glare').exists()).toBe(false)

    await dispatchPointer(el, 'pointerenter', {
      pointerType: 'mouse',
      clientX: 300,
      clientY: 150,
    })
    await dispatchPointer(el, 'pointermove', {
      pointerType: 'mouse',
      clientX: 300,
      clientY: 150,
    })
    await flushFrames()

    expect(wrapper.classes()).not.toContain('is-tilting')
    expect(el.style.getPropertyValue('--card-tilt-y')).toBe('')
  })

  it('触屏指针不触发倾斜', async () => {
    stubMatchMedia()
    const wrapper = mountCard({ interactive3d: true })
    const el = wrapper.element as HTMLElement
    stubRect(el)

    await dispatchPointer(el, 'pointerenter', {
      pointerType: 'touch',
      clientX: 300,
      clientY: 150,
    })
    await dispatchPointer(el, 'pointermove', {
      pointerType: 'touch',
      clientX: 300,
      clientY: 150,
    })
    await flushFrames()

    expect(wrapper.classes()).not.toContain('is-tilting')
    expect(el.style.getPropertyValue('--card-tilt-y')).toBe('')
  })

  it('reduced motion 下保持静态', async () => {
    stubMatchMedia({ [REDUCED_MOTION_QUERY]: true })
    const wrapper = mountCard({ interactive3d: true })
    const el = wrapper.element as HTMLElement
    stubRect(el)

    await dispatchPointer(el, 'pointerenter', {
      pointerType: 'mouse',
      clientX: 300,
      clientY: 150,
    })
    await dispatchPointer(el, 'pointermove', {
      pointerType: 'mouse',
      clientX: 300,
      clientY: 150,
    })
    await flushFrames()

    expect(wrapper.classes()).not.toContain('is-tilting')
    expect(el.style.getPropertyValue('--card-tilt-y')).toBe('')
  })

  it('样式包含动态高光、图片视差、亚克力降级与 reduced-motion 分支', () => {
    const source = goodsCardSource()

    expect(source).toContain('interactive3d?: boolean')
    expect(source).toContain('.card-acrylic-glare')
    expect(source).toContain('perspective(var(--card-perspective, 900px))')
    expect(source).toContain('rotateX(var(--card-tilt-x, 0deg))')
    expect(source).toContain('rotateY(var(--card-tilt-y, 0deg))')
    expect(source).toContain('--card-lift: -6px;')
    expect(source).not.toContain('--card-scale')
    expect(source).not.toContain('scale(1.025)')
    expect(source).toContain('translate3d(\n        var(--card-image-shift-x, 0px)')
    expect(source).toContain('--card-glare-x, 50%')
    expect(source).toMatch(/\.card-acrylic-glare\s*\{[\s\S]*?z-index:\s*1;/)
    expect(source).toContain('mix-blend-mode: screen;')
    const glareBlockIndex = source.indexOf('.card-acrylic-glare {')
    const glareBlock = source.slice(
      glareBlockIndex,
      source.indexOf('}', glareBlockIndex),
    )
    expect(glareBlock).not.toContain('filter')
    expect(source).toContain('backdrop-filter: blur(18px) saturate(1.3);')
    expect(source).toContain('transform 0.42s cubic-bezier(0.2, 0.8, 0.2, 1)')
    expect(source).toContain(
      '@media (hover: hover) and (pointer: fine) and (min-width: 769px)',
    )
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
    expect(source).toContain(
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))',
    )

    const imageIndex = source.indexOf('<SquarePaddedImage')
    const glareIndex = source.indexOf('class="card-acrylic-glare"')
    const tagIndex = source.indexOf('class="attr-tag"')
    expect(imageIndex).toBeGreaterThan(-1)
    expect(glareIndex).toBeGreaterThan(imageIndex)
    expect(tagIndex).toBeGreaterThan(glareIndex)
  })
})

describe('CloudShowcase 接入', () => {
  it('只有桌面 GoodsCard 开启 interactive3d，移动端和其它卡片保持默认', () => {
    const source = cloudShowcaseSource()
    const desktopIndex = source.indexOf('<GoodsCard')
    const mobileIndex = source.indexOf('<MobileGoodsCard')

    expect(desktopIndex).toBeGreaterThan(-1)
    expect(mobileIndex).toBeGreaterThan(-1)

    const desktopBlock = source.slice(desktopIndex, source.indexOf('/>', desktopIndex))
    const mobileBlock = source.slice(mobileIndex, source.indexOf('/>', mobileIndex))

    expect(desktopBlock).toContain(':interactive-3d="true"')
    expect(mobileBlock).not.toContain('interactive-3d')
    expect(source).not.toContain('has-aurora')
  })
})
