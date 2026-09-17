import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

export const CARD_TILT_HOVER_QUERY = '(hover: hover) and (pointer: fine)'
export const CARD_TILT_DESKTOP_QUERY = '(min-width: 769px)'
export const CARD_TILT_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const DEFAULT_MAX_TILT = 6
const DEFAULT_PERSPECTIVE = 900
const DEFAULT_IMAGE_PARALLAX = 3

export interface CardTiltOptions {
  /** 最大倾斜角度，单位 deg。 */
  maxTilt?: MaybeRefOrGetter<number>
  /** 透视距离，单位 px；数值越小透视越强。 */
  perspective?: MaybeRefOrGetter<number>
  /** 图片相对卡片的视差距离，单位 px。 */
  imageParallax?: MaybeRefOrGetter<number>
  /** 除设备能力外的业务开关，例如多选模式下关闭。 */
  enabled?: MaybeRefOrGetter<boolean>
}

export interface CardTiltApi {
  isTilting: Ref<boolean>
  handlePointerEnter: (event: PointerEvent) => void
  handlePointerMove: (event: PointerEvent) => void
  handlePointerLeave: () => void
  handlePointerCancel: () => void
}

interface MeasuredRect {
  left: number
  top: number
  width: number
  height: number
}

interface PointerPoint {
  x: number
  y: number
}

const readMediaQuery = (query: string): MediaQueryList | null => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(query)
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const clamp01 = (value: number) => clamp(value, 0, 1)

const toFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const isMousePointer = (event: PointerEvent) => event.pointerType === 'mouse'

/**
 * 卡片跟随鼠标的 3D 倾斜。
 *
 * 组合式函数只写 CSS 自定义属性，姿态与视觉全部保留在样式表中。指针事件通过
 * requestAnimationFrame 合并，频繁移动不会触发 Vue 组件重新渲染。
 */
export function useCardTilt(
  target: Ref<HTMLElement | null>,
  options: CardTiltOptions = {},
): CardTiltApi {
  const maxTilt = options.maxTilt ?? DEFAULT_MAX_TILT
  const perspective = options.perspective ?? DEFAULT_PERSPECTIVE
  const imageParallax = options.imageParallax ?? DEFAULT_IMAGE_PARALLAX
  const enabled = options.enabled ?? true

  const isTilting = ref(false)
  const hoverQuery = readMediaQuery(CARD_TILT_HOVER_QUERY)
  const desktopQuery = readMediaQuery(CARD_TILT_DESKTOP_QUERY)
  const reducedMotionQuery = readMediaQuery(CARD_TILT_REDUCED_MOTION_QUERY)
  const mediaQueries = [hoverQuery, desktopQuery, reducedMotionQuery].filter(
    (query): query is MediaQueryList => query !== null,
  )

  let rect: MeasuredRect | null = null
  let lastPoint: PointerPoint | null = null
  let pendingPoint: PointerPoint | null = null
  let frame: number | null = null
  let watchingViewport = false

  const isSupported = () => {
    if (!hoverQuery || !desktopQuery || !reducedMotionQuery) return false
    if (!hoverQuery.matches || !desktopQuery.matches || reducedMotionQuery.matches) return false
    return toValue(enabled) !== false
  }

  const measure = () => {
    const el = target.value
    if (!el) {
      rect = null
      return
    }

    // 卡片自身的 3D 变换会影响 getBoundingClientRect，测量前临时移除以获得稳定坐标。
    const previousTransform = el.style.transform
    el.style.transform = 'none'
    const box = el.getBoundingClientRect()
    el.style.transform = previousTransform

    if (box.width <= 0 || box.height <= 0) {
      rect = null
      return
    }

    rect = {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    }
  }

  const writeRestingVars = (el: HTMLElement) => {
    el.style.setProperty('--card-tilt-x', '0deg')
    el.style.setProperty('--card-tilt-y', '0deg')
    el.style.setProperty('--card-tilt-x-ratio', '0')
    el.style.setProperty('--card-tilt-y-ratio', '0')
    el.style.setProperty('--card-light-angle', '112deg')
    el.style.setProperty('--card-light-center', '50%')
    el.style.setProperty('--card-image-shift-x', '0px')
    el.style.setProperty('--card-image-shift-y', '0px')
  }

  const applyPoint = (point: PointerPoint) => {
    const el = target.value
    if (!el || !rect) return

    const nx = clamp01((point.x - rect.left) / rect.width)
    const ny = clamp01((point.y - rect.top) / rect.height)
    const horizontalRatio = (nx - 0.5) * 2
    const verticalRatio = (ny - 0.5) * 2
    const maxAngle = Math.max(0, toFiniteNumber(toValue(maxTilt), DEFAULT_MAX_TILT))
    const parallax = Math.max(0, toFiniteNumber(toValue(imageParallax), DEFAULT_IMAGE_PARALLAX))
    const perspectivePx = Math.max(
      1,
      toFiniteNumber(toValue(perspective), DEFAULT_PERSPECTIVE),
    )

    // 指针靠近哪条边，哪条边就向观察者抬起；图片反向移动，形成轻薄夹层的深度。
    el.style.setProperty('--card-tilt-x', `${(verticalRatio * maxAngle).toFixed(2)}deg`)
    el.style.setProperty('--card-tilt-y', `${(-horizontalRatio * maxAngle).toFixed(2)}deg`)
    el.style.setProperty('--card-tilt-x-ratio', verticalRatio.toFixed(4))
    el.style.setProperty('--card-tilt-y-ratio', horizontalRatio.toFixed(4))
    const lightAngle = clamp(112 - horizontalRatio * 15 + verticalRatio * 8, 97, 127)
    const lightCenter = clamp(50 + horizontalRatio * 12 + verticalRatio * 4, 34, 66)
    el.style.setProperty('--card-light-angle', `${lightAngle.toFixed(2)}deg`)
    el.style.setProperty('--card-light-center', `${lightCenter.toFixed(2)}%`)
    // 图片只做整数像素位移，避免非整数合成坐标让位图边缘发虚。
    el.style.setProperty(
      '--card-image-shift-x',
      `${Math.round(-horizontalRatio * parallax)}px`,
    )
    el.style.setProperty(
      '--card-image-shift-y',
      `${Math.round(-verticalRatio * parallax)}px`,
    )
    el.style.setProperty('--card-perspective', `${perspectivePx}px`)
  }

  const scheduleFrame = () => {
    if (frame !== null) return

    const requestFrame = typeof window !== 'undefined' ? window.requestAnimationFrame : undefined
    if (typeof requestFrame !== 'function') {
      if (pendingPoint) {
        const point = pendingPoint
        pendingPoint = null
        applyPoint(point)
      }
      return
    }

    frame = requestFrame.call(window, () => {
      frame = null
      if (!pendingPoint) return
      const point = pendingPoint
      pendingPoint = null
      applyPoint(point)
    })
  }

  const handleViewportChange = () => {
    if (!isTilting.value) return
    measure()
    if (lastPoint) {
      pendingPoint = lastPoint
      scheduleFrame()
    }
  }

  const stopViewportWatch = () => {
    if (!watchingViewport || typeof window === 'undefined') return
    watchingViewport = false
    window.removeEventListener('scroll', handleViewportChange, { capture: true })
    window.removeEventListener('resize', handleViewportChange)
    window.removeEventListener('blur', reset)
  }

  const reset = () => {
    if (frame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame?.(frame)
    }
    frame = null
    lastPoint = null
    pendingPoint = null
    rect = null
    isTilting.value = false
    stopViewportWatch()

    const el = target.value
    if (el) writeRestingVars(el)
  }

  const startViewportWatch = () => {
    if (watchingViewport || typeof window === 'undefined') return
    watchingViewport = true
    window.addEventListener('scroll', handleViewportChange, { passive: true, capture: true })
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('blur', reset)
  }

  const begin = (event: PointerEvent) => {
    if (!isMousePointer(event) || !isSupported()) return
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return

    measure()
    if (!rect) return

    isTilting.value = true
    startViewportWatch()

    const el = target.value
    if (!el) return

    writeRestingVars(el)
    const point = { x: event.clientX, y: event.clientY }
    lastPoint = point
    pendingPoint = point
    scheduleFrame()
  }

  const handlePointerEnter = (event: PointerEvent) => {
    begin(event)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!isMousePointer(event) || !isSupported()) return
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return

    if (!isTilting.value) {
      begin(event)
      return
    }

    const point = { x: event.clientX, y: event.clientY }
    lastPoint = point
    pendingPoint = point
    scheduleFrame()
  }

  const handlePointerLeave = () => {
    if (!isTilting.value && frame === null) return
    reset()
  }

  const handlePointerCancel = () => {
    reset()
  }

  const handleCapabilityChange = () => {
    if (!isSupported()) reset()
  }

  mediaQueries.forEach(query => query.addEventListener?.('change', handleCapabilityChange))

  watch(
    () => toValue(enabled),
    value => {
      if (value === false) reset()
    },
  )

  onBeforeUnmount(() => {
    mediaQueries.forEach(query => query.removeEventListener?.('change', handleCapabilityChange))
    reset()
  })

  return {
    isTilting,
    handlePointerEnter,
    handlePointerMove,
    handlePointerLeave,
    handlePointerCancel,
  }
}
