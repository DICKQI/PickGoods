import { ref, unref, type Ref } from 'vue'

type MaybeRef<T> = T | Ref<T>

interface UseMobilePullRefreshOptions {
  enabled: MaybeRef<boolean>
  blocked?: MaybeRef<boolean> | (() => boolean)
  onRefresh: () => Promise<void> | void
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

export function useMobilePullRefresh(options: UseMobilePullRefreshOptions) {
  const startY = ref(0)
  const pullDistance = ref(0)
  const isRefreshing = ref(false)
  const isDragging = ref(false)
  const isAnimating = ref(false)

  let rafId = 0
  let pendingDistance = 0

  const maxPull = options.maxPull ?? 80
  const triggerDistance = options.triggerDistance ?? 50
  const resistance = options.resistance ?? 0.4
  const resetDelay = options.resetDelay ?? 500

  const isEnabled = () => unref(options.enabled)
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
  }

  const clearAnimating = () => {
    isAnimating.value = false
  }

  const handleTouchStart = (e: TouchEvent) => {
    if (!isEnabled() || isRefreshing.value || isBlocked()) return

    if (getScrollTop() > 0) {
      reset()
      return
    }

    const firstTouch = e.touches?.[0]
    if (!firstTouch) return

    isDragging.value = true
    isAnimating.value = false
    startY.value = firstTouch.clientY
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isEnabled() || isRefreshing.value || isBlocked() || !isDragging.value || startY.value === 0) return
    if (getScrollTop() > 0) return

    const firstTouch = e.touches?.[0]
    if (!firstTouch) return
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
