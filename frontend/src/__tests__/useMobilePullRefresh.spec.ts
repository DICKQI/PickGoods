import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useMobilePullRefresh } from '@/composables/useMobilePullRefresh'

const touchEvent = (clientY: number) => ({
  touches: [{ clientY }],
  cancelable: true,
  preventDefault: vi.fn(),
} as unknown as TouchEvent)

describe('useMobilePullRefresh', () => {
  it('triggers refresh only after pulling past the threshold at the top', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const refresh = useMobilePullRefresh({
      enabled: ref(true),
      onRefresh,
      resetDelay: 0,
    })

    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 0 })

    refresh.handleTouchStart(touchEvent(10))
    const move = touchEvent(160)
    refresh.handleTouchMove(move)

    expect(move.preventDefault).toHaveBeenCalled()
    expect(refresh.pullDistance.value).toBe(60)

    await refresh.handleTouchEnd()
    await nextTick()

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(refresh.pullDistance.value).toBe(0)
    expect(refresh.isRefreshing.value).toBe(false)
  })

  it('ignores pull gestures when the page is already scrolled', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const refresh = useMobilePullRefresh({
      enabled: ref(true),
      onRefresh,
      resetDelay: 0,
    })

    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 12 })

    refresh.handleTouchStart(touchEvent(10))
    refresh.handleTouchMove(touchEvent(180))
    await refresh.handleTouchEnd()

    expect(onRefresh).not.toHaveBeenCalled()
    expect(refresh.pullDistance.value).toBe(0)
  })
})
