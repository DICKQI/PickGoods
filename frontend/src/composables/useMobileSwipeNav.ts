import {
  getCurrentInstance,
  onBeforeUnmount,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
import type { MobileSwipeStep } from '@/navigation/mobile'

/** 起手 8px 内轴锁：横向位移必须明显大于纵向，否则整段手势交还给原生滚动。 */
const AXIS_LOCK_DISTANCE = 8
const AXIS_LOCK_RATIO = 1.2
/** 认领后横向位移到该距离立即切页（页面不跟手，也不做速度判定）。 */
const SWITCH_DISTANCE = 56
/** 横向容器在这个手势里真的滚动了这么多，才算它接管了手势。 */
const SCROLL_CONSUME_DELTA = 8
/** 纵向溢出超过这个值就当作页面级滚动容器，不再让它的横向溢出吃掉手势。 */
const VERTICAL_SCROLL_TOLERANCE = 8
const MAX_SCROLL_ANCESTORS = 6
/** 触发后短暂压掉落点补发的 click，避免被当成点击按钮。 */
const CLICK_SUPPRESS_MS = 350

/** 手势起点落在这些区域时不接管：表单控件、显式声明的自管区域、弹层、横向滚动区。 */
const IGNORE_SELECTOR = [
  'input', 'textarea', 'select', '[contenteditable="true"]',
  '.el-overlay', '.el-drawer', '[data-swipe-ignore]',
  '.note-rail', '.mobile-filter-strip', '.workspace-tabs', '[data-swipe-scroll]',
].join(', ')

/**
 * 自己声明 `touch-action: none` 的元素会把整段手势留给自己（画布平移、拖拽手柄、抽屉把手），
 * 切页手势必须让路。图表 canvas 默认是 `auto`，所以看板卡片上的滑动依然能切页。
 */
const MAX_GESTURE_OWNER_DEPTH = 6
const declaresOwnGesture = (element: Element) => {
  // 行内声明先看（jsdom 不解析 touch-action 的 computed 值），类样式交给 getComputedStyle。
  if ((element as HTMLElement).style?.touchAction === 'none') return true
  const computed = window.getComputedStyle(element)
  return computed.touchAction === 'none' || computed.getPropertyValue('touch-action') === 'none'
}
const ownsItsGesture = (target: Element) => {
  let current: Element | null = target
  for (let depth = 0; current && depth < MAX_GESTURE_OWNER_DEPTH; depth += 1) {
    if (declaresOwnGesture(current)) return true
    current = current.parentElement
  }
  return false
}

/** 覆盖整屏的遮罩（部分未 Teleport 到 body，会落在页面内部）。 */
const BLOCKING_OVERLAY_SELECTOR = [
  '.el-overlay', '.el-drawer', '.mobile-action-backdrop',
  '.mobile-filter-backdrop', '.mobile-stats-filter-backdrop',
].join(', ')

export interface MobileSwipeNavOptions {
  enabled: MaybeRefOrGetter<boolean>
  /** 手势面板：只有起点落在这个元素内才参与。 */
  surface: Ref<HTMLElement | null>
  steps: MaybeRefOrGetter<MobileSwipeStep[]>
  /** 当前路由在序列中的下标，-1 表示不参与。 */
  currentIndex: MaybeRefOrGetter<number>
  navigate: (step: MobileSwipeStep) => void
}

export interface MobileSwipeNavApi {
  /** 立即结束当前手势状态（例如外部导航后）。 */
  reset: () => void
}

/** 关闭后的 Element Plus 遮罩仍留在 DOM 中，必须确认它真的渲染（含祖先 display:none）。 */
const isVisibleInLayout = (element: Element) => {
  const htmlElement = element as HTMLElement
  if (typeof htmlElement.checkVisibility === 'function') {
    return htmlElement.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  }
  let current: Element | null = element
  while (current) {
    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    current = current.parentElement
  }
  return true
}

/** 只有真正盖在屏幕上的遮罩才拦截手势；别处滑出屏幕的残留遮罩不能锁死整条手势通道。 */
const isOverlayOnScreen = (element: Element) => {
  if (!isVisibleInLayout(element)) return false
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  if (rect.right <= 0 || rect.left >= window.innerWidth) return false
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false
  return true
}

const hasVisibleOverlay = () => {
  if (typeof document === 'undefined') return false
  for (const overlay of Array.from(document.querySelectorAll(BLOCKING_OVERLAY_SELECTOR))) {
    if (isOverlayOnScreen(overlay)) return true
  }
  return false
}

/**
 * 收集起点上方可横向滚动的容器及其起始位置。
 * 判定放在手势过程中做（见 scrolledDuringGesture）：只要容器真的滚了，就让给它。
 * 页面级容器（同时还能纵向滚动，例如展柜的 .scroll-content）不算：它们的横向溢出
 * 只是布局副作用，不能因此让整片内容区吞掉切页手势。
 */
const collectHorizontalScrollers = (target: Element) => {
  const found: Array<{ element: HTMLElement; left: number }> = []
  let current: Element | null = target
  for (let depth = 0; current && depth < MAX_SCROLL_ANCESTORS; depth += 1) {
    const { overflowX } = window.getComputedStyle(current)
    if ((overflowX === 'auto' || overflowX === 'scroll')
      && current.scrollWidth - current.clientWidth > 0
      && current.scrollHeight - current.clientHeight <= VERTICAL_SCROLL_TOLERANCE) {
      found.push({ element: current as HTMLElement, left: current.scrollLeft })
    }
    current = current.parentElement
  }
  return found
}

/**
 * 移动端手势切页：横向滑动越过阈值立即切到序列里的上/下一个标签，
 * 页面不跟随位移；跨大区也走同一条序列（见 mobileSwipeSequence）。
 */
export function useMobileSwipeNav(options: MobileSwipeNavOptions): MobileSwipeNavApi {
  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let startTarget: Element | null = null
  let locked = false
  let abandoned = false
  let handled = false
  let suppressClickUntil = 0
  let scrollWatch: Array<{ element: HTMLElement; left: number }> = []
  /** 指针通道被 pointercancel 收走后，改用同一手势的触摸通道继续跟踪。 */
  let trackingByTouch = false

  const isEnabled = () => toValue(options.enabled) === true
  const scrolledDuringGesture = () =>
    scrollWatch.some(item => Math.abs(item.element.scrollLeft - item.left) >= SCROLL_CONSUME_DELTA)

  function detach() {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerCancel)
    window.removeEventListener('touchmove', handleTouchMove)
    window.removeEventListener('touchend', handleTouchEnd)
    window.removeEventListener('touchcancel', handleTouchEnd)
    pointerId = null
    startTarget = null
    scrollWatch = []
    locked = false
    abandoned = false
    handled = false
    trackingByTouch = false
  }

  function reset() {
    detach()
  }

  function handlePointerDown(event: PointerEvent) {
    if (pointerId !== null || !isEnabled()) return
    if (event.isPrimary === false) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest(IGNORE_SELECTOR) || ownsItsGesture(target) || hasVisibleOverlay()) return
    pointerId = event.pointerId ?? 0
    startX = event.clientX
    startY = event.clientY
    startTarget = target
    scrollWatch = collectHorizontalScrollers(target)
    locked = false
    abandoned = false
    handled = false
    trackingByTouch = false
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    window.addEventListener('pointercancel', handlePointerCancel, { passive: true })
    // 指针流可能被浏览器提前收走（见 handlePointerCancel），触摸流是同一手势的备份通道。
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true })
  }

  /** 指针与触摸两条通道共用同一套判定，保证被 pointercancel 打断后手势仍能走完。 */
  function trackMove(clientX: number, clientY: number) {
    if (handled || abandoned) return
    const dx = clientX - startX
    const dy = clientY - startY
    if (!locked) {
      if (Math.abs(dx) < AXIS_LOCK_DISTANCE && Math.abs(dy) < AXIS_LOCK_DISTANCE) return
      // 纵向优先：整段手势交还给原生滚动与下拉刷新。
      if (Math.abs(dx) <= AXIS_LOCK_RATIO * Math.abs(dy)) {
        abandoned = true
        return
      }
      locked = true
    }
    if (Math.abs(dx) < SWITCH_DISTANCE) return
    // 一次手势只处理一次：即使没切页（边界或容器接管）也不再重复判定。
    handled = true
    if (!startTarget || scrolledDuringGesture()) return
    const steps = toValue(options.steps) ?? []
    const index = toValue(options.currentIndex)
    if (index < 0) return
    const next = steps[index + (dx < 0 ? 1 : -1)]
    if (!next) return
    suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS
    options.navigate(next)
  }

  function handlePointerMove(event: PointerEvent) {
    if (pointerId === null || (event.pointerId ?? 0) !== pointerId) return
    trackMove(event.clientX, event.clientY)
  }

  function handleTouchMove(event: TouchEvent) {
    if (!trackingByTouch) return
    const point = event.touches?.[0]
    if (!point) return
    trackMove(point.clientX, point.clientY)
  }

  function handleTouchEnd() {
    if (!trackingByTouch) return
    detach()
  }

  function handlePointerUp(event: PointerEvent) {
    if (pointerId === null || (event.pointerId ?? 0) !== pointerId) return
    detach()
  }

  /**
   * 部分页面的内部滚动容器（例如展柜的 .scroll-content）会让浏览器提前接管横向平移，
   * 指针序列在越过阈值前就被 pointercancel 掐断。此时指针通道已不可用，
   * 但同一次手势的 touchmove 仍在派发，于是切换到触摸坐标继续判定。
   */
  function handlePointerCancel(event: PointerEvent) {
    if (pointerId === null || (event.pointerId ?? 0) !== pointerId) return
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerCancel)
    pointerId = null
    trackingByTouch = true
  }

  /** 拖动结束浏览器仍会补一个 click，落在按钮/链接上会误触。 */
  function swallowSwipeClick(event: MouseEvent) {
    if (Date.now() >= suppressClickUntil) return
    event.preventDefault()
    event.stopPropagation()
  }

  const handleSurfaceDown = (event: Event) => handlePointerDown(event as PointerEvent)
  watch(options.surface, (element, previous) => {
    previous?.removeEventListener('pointerdown', handleSurfaceDown)
    element?.addEventListener('pointerdown', handleSurfaceDown, { passive: true })
    // sync：模板 ref 赋值即挂载监听，避免刚进入页面时第一次触摸丢失。
  }, { immediate: true, flush: 'sync' })

  if (typeof window !== 'undefined') window.addEventListener('click', swallowSwipeClick, true)

  const cleanup = () => {
    detach()
    options.surface.value?.removeEventListener('pointerdown', handleSurfaceDown)
    if (typeof window !== 'undefined') window.removeEventListener('click', swallowSwipeClick, true)
  }
  if (getCurrentInstance()) onBeforeUnmount(cleanup)

  return { reset }
}
