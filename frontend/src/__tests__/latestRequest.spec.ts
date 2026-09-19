import { describe, expect, it } from 'vitest'
import { createLatestRequestGuard } from '@/composables/useLatestRequest'

describe('createLatestRequestGuard', () => {
  it('accepts only the latest request and can invalidate pending work', () => {
    const guard = createLatestRequestGuard()
    const first = guard.next()
    const second = guard.next()

    expect(guard.isLatest(first)).toBe(false)
    expect(guard.isLatest(second)).toBe(true)

    guard.invalidate()
    expect(guard.isLatest(second)).toBe(false)
  })
})
