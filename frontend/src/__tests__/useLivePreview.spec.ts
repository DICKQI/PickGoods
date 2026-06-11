import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useLivePreview } from '@/views/goods-form/composables/useLivePreview'

describe('useLivePreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初始状态', () => {
    const { livePreviewUrl, livePreviewLoading } = useLivePreview()
    expect(livePreviewUrl.value).toBe('')
    expect(livePreviewLoading.value).toBe(false)
  })

  it('scheduleRefresh 在延迟后调用回调', () => {
    const { scheduleRefresh } = useLivePreview()
    const fn = vi.fn()

    scheduleRefresh(fn, 100)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('scheduleRefresh 防抖：连续调用只执行最后一次', () => {
    const { scheduleRefresh } = useLivePreview()
    const fn1 = vi.fn()
    const fn2 = vi.fn()

    scheduleRefresh(fn1, 100)
    scheduleRefresh(fn2, 100)

    vi.advanceTimersByTime(100)
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it('cancelRefresh 取消待执行的刷新', () => {
    const { scheduleRefresh, cancelRefresh } = useLivePreview()
    const fn = vi.fn()

    scheduleRefresh(fn, 100)
    cancelRefresh()

    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
  })

  it('cancelRefresh 无待执行时不会报错', () => {
    const { cancelRefresh } = useLivePreview()
    expect(() => cancelRefresh()).not.toThrow()
  })

  it('clearUrl 清除 URL', () => {
    const { livePreviewUrl, clearUrl } = useLivePreview()
    livePreviewUrl.value = 'http://example.com/img.png'
    clearUrl()
    expect(livePreviewUrl.value).toBe('')
  })

  it('clearUrl 对 blob URL 调用 revokeObjectURL', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { livePreviewUrl, clearUrl } = useLivePreview()
    livePreviewUrl.value = 'blob:http://localhost/abc-123'
    clearUrl()
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/abc-123')
    expect(livePreviewUrl.value).toBe('')
    revokeSpy.mockRestore()
  })

  it('clearUrl 对非 blob URL 不调用 revokeObjectURL', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { livePreviewUrl, clearUrl } = useLivePreview()
    livePreviewUrl.value = 'http://example.com/img.png'
    clearUrl()
    expect(revokeSpy).not.toHaveBeenCalled()
    revokeSpy.mockRestore()
  })
})
