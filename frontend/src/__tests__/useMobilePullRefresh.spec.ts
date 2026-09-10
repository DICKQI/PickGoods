import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useMobilePullRefresh } from '@/composables/useMobilePullRefresh'

const touchEvent = (clientY: number) => ({
  touches: [{ clientY }],
  cancelable: true,
  preventDefault: vi.fn(),
} as unknown as TouchEvent)

const flushRaf = async () => {
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve())
  })
  await nextTick()
}

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

    await flushRaf()
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

  it('starts pulling after the page scrolls back to the top within the same gesture', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const refresh = useMobilePullRefresh({
      enabled: ref(true),
      onRefresh,
      resetDelay: 0,
    })

    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 40 })

    refresh.handleTouchStart(touchEvent(10))
    refresh.handleTouchMove(touchEvent(120))
    expect(refresh.pullDistance.value).toBe(0)

    // 页面滚回顶部后继续下拉：重新锚定起点，从当前位置开始累计位移
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 0 })
    refresh.handleTouchMove(touchEvent(140))
    refresh.handleTouchMove(touchEvent(340))
    await flushRaf()

    // 从重新锚定的 140 起算 200px，受 maxPull 限制到 80
    expect(refresh.pullDistance.value).toBe(80)

    await refresh.handleTouchEnd()
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('tolerates a sub-pixel scroll offset at the top', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const refresh = useMobilePullRefresh({
      enabled: ref(true),
      onRefresh,
      resetDelay: 0,
    })

    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 1 })

    refresh.handleTouchStart(touchEvent(10))
    refresh.handleTouchMove(touchEvent(160))
    await flushRaf()

    expect(refresh.pullDistance.value).toBe(60)

    await refresh.handleTouchEnd()
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
