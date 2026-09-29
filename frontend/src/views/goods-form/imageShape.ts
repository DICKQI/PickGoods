export const MIN_HEART_DIMENSION_PERCENT = 30
export const MAX_HEART_DIMENSION_PERCENT = 100

export interface ShapeBounds {
  x: number
  y: number
  width: number
  height: number
}

interface HeartPathPoint {
  x: number
  y: number
}

interface HeartPathCurve {
  control1: HeartPathPoint
  control2: HeartPathPoint
  end: HeartPathPoint
}

export interface HeartPathDefinition {
  start: HeartPathPoint
  curves: HeartPathCurve[]
}

const HEART_PATH: HeartPathDefinition = {
  start: { x: 0.5, y: 1 },
  curves: [
    {
      control1: { x: 0.43, y: 0.88 },
      control2: { x: 0.08, y: 0.69 },
      end: { x: 0.04, y: 0.4 },
    },
    {
      control1: { x: 0, y: 0.18 },
      control2: { x: 0.14, y: 0.04 },
      end: { x: 0.31, y: 0.04 },
    },
    {
      control1: { x: 0.42, y: 0.04 },
      control2: { x: 0.48, y: 0.1 },
      end: { x: 0.5, y: 0.2 },
    },
    {
      control1: { x: 0.52, y: 0.1 },
      control2: { x: 0.58, y: 0.04 },
      end: { x: 0.69, y: 0.04 },
    },
    {
      control1: { x: 0.86, y: 0.04 },
      control2: { x: 1, y: 0.18 },
      end: { x: 0.96, y: 0.4 },
    },
    {
      control1: { x: 0.92, y: 0.69 },
      control2: { x: 0.57, y: 0.88 },
      end: { x: 0.5, y: 1 },
    },
  ],
}

const clampHeartPercent = (value: number) => {
  const safeValue = Number.isFinite(value) ? value : MAX_HEART_DIMENSION_PERCENT
  return Math.max(MIN_HEART_DIMENSION_PERCENT, Math.min(MAX_HEART_DIMENSION_PERCENT, safeValue))
}

const formatPathNumber = (value: number) => Number(value.toFixed(6)).toString()

const mapPoint = (
  point: HeartPathPoint,
  bounds: ShapeBounds,
): HeartPathPoint => ({
  x: bounds.x + point.x * bounds.width,
  y: bounds.y + point.y * bounds.height,
})

export const getHeartBounds = (
  width: number,
  height: number,
  widthPercent = MAX_HEART_DIMENSION_PERCENT,
  heightPercent = MAX_HEART_DIMENSION_PERCENT,
): ShapeBounds => {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1)
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1)
  const boundedWidth = safeWidth * (clampHeartPercent(widthPercent) / 100)
  const boundedHeight = safeHeight * (clampHeartPercent(heightPercent) / 100)

  return {
    x: (safeWidth - boundedWidth) / 2,
    y: (safeHeight - boundedHeight) / 2,
    width: boundedWidth,
    height: boundedHeight,
  }
}

export const getHeartPathDefinition = (): HeartPathDefinition => ({
  start: { ...HEART_PATH.start },
  curves: HEART_PATH.curves.map((curve) => ({
    control1: { ...curve.control1 },
    control2: { ...curve.control2 },
    end: { ...curve.end },
  })),
})

export const getHeartSvgPath = (
  widthPercent = MAX_HEART_DIMENSION_PERCENT,
  heightPercent = MAX_HEART_DIMENSION_PERCENT,
): string => {
  const bounds = getHeartBounds(1, 1, widthPercent, heightPercent)
  const start = mapPoint(HEART_PATH.start, bounds)
  const commands = [
    `M ${formatPathNumber(start.x)} ${formatPathNumber(start.y)}`,
  ]

  for (const curve of HEART_PATH.curves) {
    const control1 = mapPoint(curve.control1, bounds)
    const control2 = mapPoint(curve.control2, bounds)
    const end = mapPoint(curve.end, bounds)
    commands.push(
      `C ${formatPathNumber(control1.x)} ${formatPathNumber(control1.y)} `
      + `${formatPathNumber(control2.x)} ${formatPathNumber(control2.y)} `
      + `${formatPathNumber(end.x)} ${formatPathNumber(end.y)}`,
    )
  }

  commands.push('Z')
  return commands.join(' ')
}

export const traceHeartPath = (
  context: CanvasRenderingContext2D,
  bounds: ShapeBounds,
) => {
  const start = mapPoint(HEART_PATH.start, bounds)
  context.beginPath()
  context.moveTo(start.x, start.y)

  for (const curve of HEART_PATH.curves) {
    const control1 = mapPoint(curve.control1, bounds)
    const control2 = mapPoint(curve.control2, bounds)
    const end = mapPoint(curve.end, bounds)
    context.bezierCurveTo(
      control1.x,
      control1.y,
      control2.x,
      control2.y,
      end.x,
      end.y,
    )
  }

  context.closePath()
}
