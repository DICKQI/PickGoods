export interface ReadableMarqueeOptions {
  minDurationSeconds?: number
  movementRatio?: number
  pixelsPerSecond?: number
}

export const READABLE_MARQUEE_DEFAULTS = {
  minDurationSeconds: 8,
  movementRatio: 0.64,
  pixelsPerSecond: 34,
} as const

const roundToTenth = (value: number) => Math.round(value * 10) / 10

export function getReadableMarqueeDurationSeconds(
  distancePx: number,
  options: ReadableMarqueeOptions = {},
) {
  const minDurationSeconds = options.minDurationSeconds ?? READABLE_MARQUEE_DEFAULTS.minDurationSeconds
  const movementRatio = options.movementRatio ?? READABLE_MARQUEE_DEFAULTS.movementRatio
  const pixelsPerSecond = options.pixelsPerSecond ?? READABLE_MARQUEE_DEFAULTS.pixelsPerSecond

  const safeDistance = Math.max(0, distancePx)
  const movingSeconds = safeDistance / Math.max(1, pixelsPerSecond)
  const totalSeconds = movingSeconds / Math.max(0.01, Math.min(1, movementRatio))

  return roundToTenth(Math.max(minDurationSeconds, totalSeconds))
}

export function getReadableMarqueeDuration(
  distancePx: number,
  options: ReadableMarqueeOptions = {},
) {
  return `${getReadableMarqueeDurationSeconds(distancePx, options).toFixed(1)}s`
}
