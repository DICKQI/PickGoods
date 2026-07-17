import { describe, expect, it } from 'vitest'
import {
  READABLE_MARQUEE_DEFAULTS,
  getReadableMarqueeDuration,
  getReadableMarqueeDurationSeconds,
} from '@/utils/readableMarquee'

describe('readable marquee duration', () => {
  it('keeps short overflows from scrolling too quickly', () => {
    expect(getReadableMarqueeDurationSeconds(120)).toBe(8)
    expect(getReadableMarqueeDuration(120)).toBe('8.0s')
  })

  it('scales duration with travel distance so long text keeps the same readable speed', () => {
    const mediumDistance = 360
    const longDistance = 720

    const mediumDuration = getReadableMarqueeDurationSeconds(mediumDistance)
    const longDuration = getReadableMarqueeDurationSeconds(longDistance)

    const mediumSpeed = mediumDistance / (mediumDuration * READABLE_MARQUEE_DEFAULTS.movementRatio)
    const longSpeed = longDistance / (longDuration * READABLE_MARQUEE_DEFAULTS.movementRatio)

    expect(longDuration).toBeGreaterThan(mediumDuration)
    expect(mediumSpeed).toBeCloseTo(READABLE_MARQUEE_DEFAULTS.pixelsPerSecond, 0)
    expect(longSpeed).toBeCloseTo(READABLE_MARQUEE_DEFAULTS.pixelsPerSecond, 0)
  })
})
