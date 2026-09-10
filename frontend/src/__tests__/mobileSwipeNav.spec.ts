import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, ref } from 'vue'
import { useMobileSwipeNav } from '@/composables/useMobileSwipeNav'
import { mobileSwipeSequence, mobileSwipeStepIndex, type MobileIdentity } from '@/navigation/mobile'

const collector: MobileIdentity = { isClub: false, isAuthenticated: true }

interface NavHarness {
  wrapper: VueWrapper
  navigate: Mock
  element: HTMLElement
}

let harnesses: VueWrapper[] = []

afterEach(() => {
  for (const wrapper of harnesses) wrapper.unmount()
  harnesses = []
})

const createPointerEvent = (type: string, x: number, y: number, extra: Record<string, unknown> = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
  }, extra)
  return event
}

const createMouseEvent = (type: string) => new MouseEvent(type, { bubbles: true, cancelable: true })

function mountNav(config: {
  path?: string
  query?: Record<string, string>
  identity?: MobileIdentity
  enabled?: boolean
} = {}): NavHarness {
  const navigate = vi.fn()
  const surface = ref<HTMLElement | null>(null)
  const wrapper = mount(defineComponent({
    setup() {
      const route = { path: config.path ?? '/location', query: config.query ?? {} }
      const steps = computed(() => mobileSwipeSequence(config.identity ?? collector))
      const index = computed(() => mobileSwipeStepIndex(steps.value, route))
      useMobileSwipeNav({
        enabled: () => config.enabled ?? true,
        surface,
        steps,
        currentIndex: index,
        navigate,
      })
      return {}
    },
    template: '<div class="surface"><input class="field" /><canvas class="board" /><div class="scroll" /></div>',
  }), { attachTo: document.body })
  harnesses.push(wrapper)
  surface.value = wrapper.element as HTMLElement
  return { wrapper, navigate, element: wrapper.element as HTMLElement }
}

const down = (element: Element, x = 300, y = 300, extra: Record<string, unknown> = {}) =>
  element.dispatchEvent(createPointerEvent('pointerdown', x, y, extra))
const move = (x: number, y = 300, extra: Record<string, unknown> = {}) =>
  window.dispatchEvent(createPointerEvent('pointermove', x, y, extra))
const up = (x = 300, y = 300) => window.dispatchEvent(createPointerEvent('pointerup', x, y))

const createTouchEvent = (type: string, x: number, y = 300) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const point = { clientX: x, clientY: y }
  Object.assign(event, { touches: type === 'touchend' ? [] : [point], changedTouches: [point] })
  return event
}
const touchMove = (x: number, y = 300) => window.dispatchEvent(createTouchEvent('touchmove', x, y))
const touchEnd = () => window.dispatchEvent(createTouchEvent('touchend', 0))
const pointerCancel = (x = 300, y = 300) => window.dispatchEvent(createPointerEvent('pointercancel', x, y))

const swipe = (element: Element, dx: number, dy = 0, onDown: Record<string, unknown> = {}) => {
  down(element, 300, 300, onDown)
  move(300 + dx, 300 + dy)
  up(300 + dx, 300 + dy)
}

const expectedStep = (identity: MobileIdentity, route: { path: string; query?: Record<string, string> }, offset: number) => {
  const steps = mobileSwipeSequence(identity)
  const index = mobileSwipeStepIndex(steps, { path: route.path, query: route.query ?? {} })
  return steps[index + offset]
}

describe('useMobileSwipeNav', () => {
  it('switches to the next tab when swiping left past the threshold', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    swipe(element, -70)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(expectedStep(collector, { path: '/location' }, 1))
  })

  it('switches to the previous tab when swiping right, including across regions', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    swipe(element, 70)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(expectedStep(collector, { path: '/location' }, -1))
  })

  // 部分页面（展柜中部）的内部滚动容器会让浏览器提前接管横向平移，
  // 指针序列在越过阈值前就被 pointercancel 掐断；这时必须改用同一次手势的触摸流继续判定。
  it('continues the gesture on the touch stream after pointercancel', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    down(element, 400, 300)
    move(354)
    pointerCancel(354, 300)
    expect(navigate).not.toHaveBeenCalled()

    touchMove(300)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(expectedStep(collector, { path: '/location' }, 1))

    // 手势结束后触摸通道不再生效
    touchEnd()
    touchMove(180)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('keeps the touch stream out of gestures that still own their pointer sequence', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    down(element, 300, 300)
    move(340)
    touchMove(420)
    expect(navigate).not.toHaveBeenCalled()

    move(400)
    expect(navigate).toHaveBeenCalledTimes(1)
    touchMove(520)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('ignores horizontal movement below the switch distance', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    swipe(element, -40)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('hands vertical gestures back to native scrolling for the whole gesture', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    down(element)
    move(310, 380)
    move(180, 380)
    up(180, 380)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('switches at most once per gesture', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    down(element)
    move(230, 300)
    move(120, 300)
    move(40, 300)
    up(40, 300)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('does nothing at the first and last entry of the sequence', () => {
    const first = mountNav({ path: '/clubs' })
    swipe(first.element, 70)
    expect(first.navigate).not.toHaveBeenCalled()

    const last = mountNav({ path: '/settings' })
    swipe(last.element, -70)
    expect(last.navigate).not.toHaveBeenCalled()
  })

  it('stays idle on routes outside the sequence', () => {
    const { navigate, element } = mountNav({ path: '/goods/new' })
    swipe(element, -90)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('ignores gestures that start on form controls or opt-out areas', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    swipe(element.querySelector('input')!, -90)
    const optOut = document.createElement('div')
    optOut.dataset.swipeIgnore = ''
    element.appendChild(optOut)
    swipe(optOut, -90)
    expect(navigate).not.toHaveBeenCalled()
  })

  // 图表 canvas 自己是 touch-action:auto：看板卡片上到处都能滑，只有"自管手势"的元素才让路
  it('allows swiping from chart canvases', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    swipe(element.querySelector('canvas')!, -90)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('leaves the gesture to elements that declare touch-action:none', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    const handle = document.createElement('div')
    handle.dataset.testHandle = ''
    handle.style.touchAction = 'none'
    element.appendChild(handle)
    swipe(handle, -90)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('hands the gesture to a strip that really scrolls while dragging', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    const strip = element.querySelector<HTMLElement>('.scroll')!
    strip.style.overflowX = 'auto'
    Object.defineProperty(strip, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(strip, 'clientWidth', { value: 300, configurable: true })
    let scrolled = false
    Object.defineProperty(strip, 'scrollLeft', { configurable: true, get: () => (scrolled ? 60 : 0) })
    down(strip)
    scrolled = true
    move(210, 300)
    up(210, 300)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('still switches when the strip never moves, for example at its end', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    const strip = element.querySelector<HTMLElement>('.scroll')!
    strip.style.overflowX = 'auto'
    Object.defineProperty(strip, 'scrollWidth', { value: 600, configurable: true })
    Object.defineProperty(strip, 'clientWidth', { value: 300, configurable: true })
    Object.defineProperty(strip, 'scrollLeft', { value: 300, configurable: true })
    swipe(strip, -90)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('switches over page containers that only have a few pixels of layout overflow', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    const page = element.querySelector<HTMLElement>('.scroll')!
    page.style.overflowX = 'auto'
    Object.defineProperty(page, 'scrollWidth', { value: 302, configurable: true })
    Object.defineProperty(page, 'clientWidth', { value: 300, configurable: true })
    Object.defineProperty(page, 'scrollLeft', { value: 0, configurable: true })
    swipe(page, -90)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('switches over a page-level container that can scroll both ways', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    const page = element.querySelector<HTMLElement>('.scroll')!
    page.style.overflowX = 'auto'
    page.style.overflowY = 'auto'
    Object.defineProperty(page, 'scrollWidth', { value: 620, configurable: true })
    Object.defineProperty(page, 'clientWidth', { value: 300, configurable: true })
    Object.defineProperty(page, 'scrollHeight', { value: 2400, configurable: true })
    Object.defineProperty(page, 'clientHeight', { value: 700, configurable: true })
    let scrolled = false
    Object.defineProperty(page, 'scrollLeft', { configurable: true, get: () => (scrolled ? 30 : 0) })
    down(page)
    scrolled = true
    move(210, 300)
    up(210, 300)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('blocks the gesture only while a visible overlay covers the viewport', () => {
    const { navigate, element } = mountNav({ path: '/location' })
    const overlay = document.createElement('div')
    overlay.className = 'el-overlay'
    element.appendChild(overlay)
    // jsdom 没有真实布局，checkVisibility 恒为 false，这里按真实浏览器语义打桩。
    Object.defineProperty(overlay, 'checkVisibility', { configurable: true, value: () => true })
    Object.defineProperty(overlay, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 390, height: 800, top: 0, left: 0, right: 390, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }),
    })
    swipe(element, -90)
    expect(navigate).not.toHaveBeenCalled()

    Object.defineProperty(overlay, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 390, height: 800, top: 0, left: -390, right: 0, bottom: 800, x: -390, y: 0, toJSON: () => ({}) }),
    })
    swipe(element, -90)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('swallows the click that follows a switched gesture', () => {
    const { element, navigate } = mountNav({ path: '/location' })
    swipe(element, -70)
    expect(navigate).toHaveBeenCalledTimes(1)
    const click = createMouseEvent('click')
    document.body.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
  })

  it('does nothing while disabled or for non-primary mouse buttons', () => {
    const disabled = mountNav({ path: '/location', enabled: false })
    swipe(disabled.element, -90)
    expect(disabled.navigate).not.toHaveBeenCalled()

    const rightButton = mountNav({ path: '/location' })
    swipe(rightButton.element, -90, 0, { pointerType: 'mouse', button: 2 })
    expect(rightButton.navigate).not.toHaveBeenCalled()
  })

  it('detaches every listener once the component unmounts', () => {
    const { wrapper, navigate, element } = mountNav({ path: '/location' })
    swipe(element, -70)
    expect(navigate).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    window.dispatchEvent(createPointerEvent('pointerdown', 300, 300))
    window.dispatchEvent(createPointerEvent('pointermove', 100, 300))
    window.dispatchEvent(createPointerEvent('pointerup', 100, 300))
    expect(navigate).toHaveBeenCalledTimes(1)
  })
})
