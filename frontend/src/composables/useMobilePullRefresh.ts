import { ref, unref, type Ref } from 'vue'

type MaybeRef<T> = T | Ref<T>

interface UseMobilePullRefreshOptions {
  enabled: MaybeRef<boolean>
  blocked?: MaybeRef<boolean> | (() => boolean)
  onRefresh: () => Promise<void> | void
  getScrollTop?: () => number
  maxPull?: number
  triggerDistance?: number
  resistance?: number
  resetDelay?: number
}

const getScrollTop = () => (
  window.pageYOffset ||
  document.documentElement.scrollTop ||
  document.body.scrollTop ||
  0
)

/** 顶部判定留 2px 容差：真机滚动回弹后常停在 0.5~1px，严格等于 0 会让下拉手势整段失效。 */
const SCROLL_TOP_TOLERANCE = 2

export function useMobilePullRefresh(options: UseMobilePullRefreshOptions) {
  const startY = ref(0)
  const pullDistance = ref(0)
  const isRefreshing = ref(false)
  const isDragging = ref(false)
  const isAnimating = ref(false)
  /** 本次触摸是否仍在跟踪（起点可能在页面中部，滚到顶部后依旧可以接上下拉）。 */
  const isTracking = ref(false)

  let rafId = 0
  let pendingDistance = 0

  const maxPull = options.maxPull ?? 80
  const triggerDistance = options.triggerDistance ?? 50
  const resistance = options.resistance ?? 0.4
  const resetDelay = options.resetDelay ?? 500

  const isEnabled = () => unref(options.enabled)
  const readScrollTop = () => options.getScrollTop?.() ?? getScrollTop()
  const isBlocked = () => {
    if (!options.blocked) return false
    return typeof options.blocked === 'function'
      ? options.blocked()
      : unref(options.blocked)
  }

  const flushRaf = () => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  const reset = () => {
    flushRaf()
    isAnimating.value = true
    pullDistance.value = 0
    startY.value = 0
    isDragging.value = false
    isTracking.value = false
  }

  const clearAnimating = () => {
    isAnimating.value = false
  }

  const handleTouchStart = (e: TouchEvent) => {
    if (!isEnabled() || isRefreshing.value || isBlocked()) return

    const firstTouch = e.touches?.[0]
    if (!firstTouch) return

    flushRaf()
    startY.value = firstTouch.clientY
    isTracking.value = true
    // 起点不在顶部也继续跟踪：页面滚回顶部后继续下拉同样算刷新手势。
    isDragging.value = readScrollTop() <= SCROLL_TOP_TOLERANCE
    pullDistance.value = 0
    isAnimating.value = false
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isEnabled() || isRefreshing.value || isBlocked() || !isTracking.value) return

    const firstTouch = e.touches?.[0]
    if (!firstTouch) return

    if (readScrollTop() > SCROLL_TOP_TOLERANCE) {
      // 还没滚到顶部：整段交还给原生滚动，并清掉已产生的位移
      startY.value = 0
      if (pullDistance.value !== 0) {
        flushRaf()
        pullDistance.value = 0
      }
      return
    }

    if (!isDragging.value || startY.value === 0) {
      // 手势途中才滚到顶部：从当前位置重新锚定，避免位移从页面中段开始累计
      isDragging.value = true
      startY.value = firstTouch.clientY
      return
    }

    const distance = firstTouch.clientY - startY.value

    if (distance > 0) {
      if (e.cancelable) e.preventDefault()
      pendingDistance = Math.min(distance * resistance, maxPull)
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          pullDistance.value = pendingDistance
          rafId = 0
        })
      }
      return
    }

    flushRaf()
    pullDistance.value = 0
  }

  const handleTouchEnd = async () => {
    flushRaf()
    isDragging.value = false
    isTracking.value = false
    if (!isEnabled() || isRefreshing.value || isBlocked()) {
      reset()
      return
    }

    if (pullDistance.value < triggerDistance) {
      reset()
      return
    }

    isRefreshing.value = true
    isAnimating.value = true
    pullDistance.value = triggerDistance

    try {
      await options.onRefresh()
    } finally {
      const finish = () => {
        isRefreshing.value = false
        reset()
      }

      if (resetDelay <= 0) {
        finish()
      } else {
        window.setTimeout(finish, resetDelay)
      }
    }
  }

  return {
    pullDistance,
    isRefreshing,
    isDragging,
    isAnimating,
    clearAnimating,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    reset,
  }
}
