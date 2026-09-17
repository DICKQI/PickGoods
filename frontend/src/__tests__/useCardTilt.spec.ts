import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  CARD_TILT_DESKTOP_QUERY,
  CARD_TILT_HOVER_QUERY,
  CARD_TILT_REDUCED_MOTION_QUERY,
  useCardTilt,
  type CardTiltApi,
  type CardTiltOptions,
} from '@/composables/useCardTilt'

interface Capabilities {
  hover: boolean
  fine: boolean
  wide: boolean
  reduced: boolean
}

const DEFAULT_CAPABILITIES: Capabilities = {
  hover: true,
  fine: true,
  wide: true,
  reduced: false,
}

let capabilities = { ...DEFAULT_CAPABILITIES }

const readMatches = (query: string) => {
  if (query.includes('prefers-reduced-motion')) return capabilities.reduced
  if (query.includes('min-width')) return capabilities.wide
  if (query.includes('hover: hover')) return capabilities.hover
  if (query.includes('pointer: fine')) return capabilities.fine
  return false
}

const stubMatchMedia = (overrides: Partial<Capabilities> = {}) => {
  capabilities = { ...DEFAULT_CAPABILITIES, ...overrides }
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: readMatches(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const RECT = { left: 100, top: 50, width: 200, height: 100 }

const stubRect = (el: HTMLElement, overrides: Partial<typeof RECT> = {}) => {
  const rect = { ...RECT, ...overrides }
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect
}

interface Harness {
  wrapper: VueWrapper
  el: HTMLElement
  api: CardTiltApi
}

const mountHarness = (options: CardTiltOptions = {}): Harness => {
  const elRef = ref<HTMLElement | null>(null)
  let api: CardTiltApi | null = null

  const wrapper = mount(
    defineComponent({
      setup() {
        api = useCardTilt(elRef, options)
        return () =>
          h('div', {
            ref: elRef,
            class: 'tilt-target',
            onPointerenter: api?.handlePointerEnter,
            onPointermove: api?.handlePointerMove,
            onPointerleave: api?.handlePointerLeave,
            onPointercancel: api?.handlePointerCancel,
          })
      },
    }),
  )

  return {
    wrapper,
    el: wrapper.element as HTMLElement,
    api: api as unknown as CardTiltApi,
  }
}

const readNumber = (el: HTMLElement, variable: string, fallback = Number.NaN) => {
  const raw = el.style.getPropertyValue(variable)
  if (!raw) return fallback
  return Number.parseFloat(raw)
}

const flushTiltFrame = async () => {
  if (typeof window.requestAnimationFrame === 'function') {
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()))
  }
  await nextTick()
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

const enterAndMoveTo = async (harness: Harness, x: number, y: number) => {
  await dispatchPointer(harness.el, 'pointerenter', {
    pointerType: 'mouse',
    clientX: x,
    clientY: y,
  })
  await dispatchPointer(harness.el, 'pointermove', {
    pointerType: 'mouse',
    clientX: x,
    clientY: y,
  })
  await flushTiltFrame()
}

beforeEach(() => {
  stubMatchMedia()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCardTilt', () => {
  it('按鼠标位置写入倾斜、鼠标跟随光、图片视差与透视变量', async () => {
    const harness = mountHarness()
    stubRect(harness.el)

    await enterAndMoveTo(harness, 300, 150)

    expect(harness.api.isTilting.value).toBe(true)
    expect(readNumber(harness.el, '--card-tilt-x')).toBeCloseTo(6, 2)
    expect(readNumber(harness.el, '--card-tilt-y')).toBeCloseTo(-6, 2)
    expect(readNumber(harness.el, '--card-tilt-x-ratio')).toBeCloseTo(1, 3)
    expect(readNumber(harness.el, '--card-tilt-y-ratio')).toBeCloseTo(1, 3)
    expect(harness.el.style.getPropertyValue('--card-glare-x')).toBe('100.00%')
    expect(harness.el.style.getPropertyValue('--card-glare-y')).toBe('100.00%')
    expect(readNumber(harness.el, '--card-image-shift-x')).toBeCloseTo(-3, 2)
    expect(readNumber(harness.el, '--card-image-shift-y')).toBeCloseTo(-3, 2)
    expect(harness.el.style.getPropertyValue('--card-perspective')).toBe('900px')
  })

  it('指针在左上角时倾斜和图片视差方向相反', async () => {
    const harness = mountHarness()
    stubRect(harness.el)

    await enterAndMoveTo(harness, 100, 50)

    expect(readNumber(harness.el, '--card-tilt-x')).toBeCloseTo(-6, 2)
    expect(readNumber(harness.el, '--card-tilt-y')).toBeCloseTo(6, 2)
    expect(readNumber(harness.el, '--card-image-shift-x')).toBeCloseTo(3, 2)
    expect(readNumber(harness.el, '--card-image-shift-y')).toBeCloseTo(3, 2)
  })

  it('把卡片外坐标夹在边界内，不超出最大角度', async () => {
    const harness = mountHarness({ maxTilt: 4, imageParallax: 2 })
    stubRect(harness.el)

    await enterAndMoveTo(harness, 9999, -9999)

    expect(Math.abs(readNumber(harness.el, '--card-tilt-x'))).toBeLessThanOrEqual(4)
    expect(Math.abs(readNumber(harness.el, '--card-tilt-y'))).toBeLessThanOrEqual(4)
    expect(Math.abs(readNumber(harness.el, '--card-image-shift-x'))).toBeLessThanOrEqual(2)
  })

  it('触屏和手写笔指针不启动倾斜', async () => {
    const harness = mountHarness()
    stubRect(harness.el)

    await dispatchPointer(harness.el, 'pointerenter', {
      pointerType: 'touch',
      clientX: 300,
      clientY: 150,
    })
    await dispatchPointer(harness.el, 'pointermove', {
      pointerType: 'pen',
      clientX: 300,
      clientY: 150,
    })
    await flushTiltFrame()

    expect(harness.api.isTilting.value).toBe(false)
    expect(harness.el.style.getPropertyValue('--card-tilt-y')).toBe('')
  })

  it('不支持精细悬停指针时不启动倾斜', async () => {
    stubMatchMedia({ hover: false })
    const harness = mountHarness()
    stubRect(harness.el)

    await enterAndMoveTo(harness, 300, 150)

    expect(harness.api.isTilting.value).toBe(false)
    expect(harness.el.style.getPropertyValue('--card-tilt-y')).toBe('')
  })

  it('窄视口和 reduced motion 下不启动倾斜', async () => {
    stubMatchMedia({ wide: false })
    const narrowHarness = mountHarness()
    stubRect(narrowHarness.el)
    await enterAndMoveTo(narrowHarness, 300, 150)
    expect(narrowHarness.api.isTilting.value).toBe(false)

    stubMatchMedia({ reduced: true })
    const reducedHarness = mountHarness()
    stubRect(reducedHarness.el)
    await enterAndMoveTo(reducedHarness, 300, 150)
    expect(reducedHarness.api.isTilting.value).toBe(false)
  })

  it('同一帧内的多次移动只排一次 rAF', async () => {
    if (typeof window.requestAnimationFrame !== 'function') return

    const harness = mountHarness()
    stubRect(harness.el)
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')

    await dispatchPointer(harness.el, 'pointerenter', {
      pointerType: 'mouse',
      clientX: 110,
      clientY: 60,
    })
    for (let index = 0; index < 6; index += 1) {
      await dispatchPointer(harness.el, 'pointermove', {
        pointerType: 'mouse',
        clientX: 120 + index,
        clientY: 70 + index,
      })
    }

    expect(rafSpy).toHaveBeenCalledTimes(1)
    await flushTiltFrame()
  })

  it('矩形尺寸为 0 时放弃倾斜且不写入无效值', async () => {
    const harness = mountHarness()
    stubRect(harness.el, { width: 0, height: 0 })

    await enterAndMoveTo(harness, 300, 150)

    expect(harness.api.isTilting.value).toBe(false)
    expect(harness.el.style.getPropertyValue('--card-tilt-y')).toBe('')
  })

  it('页面滚动后按新位置重测并更新姿态', async () => {
    const harness = mountHarness()
    let left = 100
    harness.el.getBoundingClientRect = () =>
      ({
        ...RECT,
        left,
        right: left + RECT.width,
        bottom: RECT.top + RECT.height,
        x: left,
        y: RECT.top,
        toJSON: () => ({}),
      }) as DOMRect

    await enterAndMoveTo(harness, 200, 100)
    expect(readNumber(harness.el, '--card-tilt-y')).toBeCloseTo(0, 2)

    left = 200
    window.dispatchEvent(new Event('scroll'))
    await flushTiltFrame()

    expect(readNumber(harness.el, '--card-tilt-y')).toBeCloseTo(6, 2)
    expect(readNumber(harness.el, '--card-image-shift-x')).toBeCloseTo(3, 2)
  })

  it('业务开关关闭后立即复位并移除监听', async () => {
    const enabled = ref(true)
    const harness = mountHarness({ enabled })
    stubRect(harness.el)

    await enterAndMoveTo(harness, 300, 150)
    expect(harness.api.isTilting.value).toBe(true)

    enabled.value = false
    await nextTick()

    expect(harness.api.isTilting.value).toBe(false)
    expect(readNumber(harness.el, '--card-tilt-y', 0)).toBe(0)
    expect(readNumber(harness.el, '--card-image-shift-x', 0)).toBe(0)
  })

  it('pointercancel 和窗口失焦都会复位', async () => {
    const harness = mountHarness()
    stubRect(harness.el)

    await enterAndMoveTo(harness, 300, 150)
    await dispatchPointer(harness.el, 'pointercancel', { pointerType: 'mouse' })
    expect(harness.api.isTilting.value).toBe(false)

    await enterAndMoveTo(harness, 300, 150)
    window.dispatchEvent(new Event('blur'))
    expect(harness.api.isTilting.value).toBe(false)
    expect(readNumber(harness.el, '--card-tilt-y', 0)).toBe(0)
  })

  it('卸载后移除媒体查询监听', () => {
    const removeListener = vi.fn()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: readMatches(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: removeListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    const harness = mountHarness()
    harness.wrapper.unmount()

    expect(removeListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(CARD_TILT_HOVER_QUERY).toBe('(hover: hover) and (pointer: fine)')
    expect(CARD_TILT_DESKTOP_QUERY).toBe('(min-width: 769px)')
    expect(CARD_TILT_REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)')
  })
})
