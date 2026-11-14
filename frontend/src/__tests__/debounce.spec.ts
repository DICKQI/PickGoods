import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from '@/utils/debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('only runs the last call after the wait window', () => {
    const spy = vi.fn()
    const run = debounce(spy, 250)

    run('a')
    run('b')
    vi.advanceTimersByTime(200)
    run('c')
    expect(spy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(250)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('c')
  })

  it('cancel() drops the pending call', () => {
    const spy = vi.fn()
    const run = debounce(spy, 100)

    run('x')
    run.cancel()
    vi.advanceTimersByTime(500)

    expect(spy).not.toHaveBeenCalled()
  })

  it('flush() runs the pending call immediately', () => {
    const spy = vi.fn()
    const run = debounce(spy, 100)

    run('now')
    run.flush()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('now')

    vi.advanceTimersByTime(200)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
