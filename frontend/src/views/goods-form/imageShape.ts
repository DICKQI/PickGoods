export const MIN_HEART_DIMENSION_PERCENT = 30
export const MAX_HEART_DIMENSION_PERCENT = 100
export const MIN_POLYGON_SIDES = 3
export const MAX_POLYGON_SIDES = 8
export const POLYGON_ROTATION_SNAP_THRESHOLD = 3
export const POLYGON_ROTATION_SNAP_ANGLES = [-180, -90, 0, 90, 180]

export interface ShapeBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ShapePoint {
  x: number
  y: number
}

export interface PolygonPathCorner {
  start: ShapePoint
  control: ShapePoint
  end: ShapePoint
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

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

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

export const normalizePolygonSides = (value: number) => {
  const rounded = Number.isFinite(value) ? Math.round(value) : MIN_POLYGON_SIDES
  return Math.max(MIN_POLYGON_SIDES, Math.min(MAX_POLYGON_SIDES, rounded))
}

export const normalizePolygonRotation = (value: number) => {
  if (!Number.isFinite(value)) return 0
  let normalized = value % 360
  if (normalized > 180) normalized -= 360
  if (normalized < -180) normalized += 360
  return normalized
}

export const snapPolygonRotation = (
  value: number,
  threshold = POLYGON_ROTATION_SNAP_THRESHOLD,
) => {
  const normalized = normalizePolygonRotation(value)
  const safeThreshold = Math.max(0, Number.isFinite(threshold) ? threshold : 0)

  for (const angle of POLYGON_ROTATION_SNAP_ANGLES) {
    if (Math.abs(normalized - angle) <= safeThreshold) return angle
  }
  return normalized
}

export const getPolygonPoints = (
  sides: number,
  rotation = 0,
): ShapePoint[] => {
  const sideCount = normalizePolygonSides(sides)
  const rotationRadians = (normalizePolygonRotation(rotation) * Math.PI) / 180
  const rawPoints = Array.from({ length: sideCount }, (_, index) => {
    const angle = -Math.PI / 2 + rotationRadians + (index * Math.PI * 2) / sideCount
    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
    }
  })

  const xValues = rawPoints.map((point) => point.x)
  const yValues = rawPoints.map((point) => point.y)
  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const width = Math.max(Number.EPSILON, maxX - minX)
  const height = Math.max(Number.EPSILON, maxY - minY)

  return rawPoints.map((point) => ({
    x: clampUnit((point.x - minX) / width),
    y: clampUnit((point.y - minY) / height),
  }))
}

export const getPolygonSvgPoints = (
  sides: number,
  rotation = 0,
) => getPolygonPoints(sides, rotation)
  .map((point) => (
    `${formatPathNumber(point.x * 100)}% ${formatPathNumber(point.y * 100)}%`
  ))
  .join(', ')

export const getPolygonPathDefinition = (
  sides: number,
  rotation = 0,
  cornerRadiusPercent = 0,
): PolygonPathCorner[] => {
  const points = getPolygonPoints(sides, rotation)
  const pointCount = points.length
  const radiusPercent = Math.max(0, Math.min(50, Number.isFinite(cornerRadiusPercent)
    ? cornerRadiusPercent
    : 0))

  return points.map((point, index) => {
    const previous = points[(index - 1 + pointCount) % pointCount]!
    const next = points[(index + 1) % pointCount]!
    const toPrevious = {
      x: previous.x - point.x,
      y: previous.y - point.y,
    }
    const toNext = {
      x: next.x - point.x,
      y: next.y - point.y,
    }
    const previousLength = Math.hypot(toPrevious.x, toPrevious.y)
    const nextLength = Math.hypot(toNext.x, toNext.y)
    const safePreviousLength = Math.max(Number.EPSILON, previousLength)
    const safeNextLength = Math.max(Number.EPSILON, nextLength)
    const cornerOffset = Math.min(previousLength, nextLength) * (radiusPercent / 100)

    return {
      start: {
        x: point.x + (toPrevious.x / safePreviousLength) * cornerOffset,
        y: point.y + (toPrevious.y / safePreviousLength) * cornerOffset,
      },
      control: { ...point },
      end: {
        x: point.x + (toNext.x / safeNextLength) * cornerOffset,
        y: point.y + (toNext.y / safeNextLength) * cornerOffset,
      },
    }
  })
}

export const getPolygonSvgPath = (
  sides: number,
  rotation = 0,
  cornerRadiusPercent = 0,
) => {
  const corners = getPolygonPathDefinition(sides, rotation, cornerRadiusPercent)
  const first = corners[0]
  if (!first) return ''

  const commands = [
    `M ${formatPathNumber(first.start.x)} ${formatPathNumber(first.start.y)}`,
  ]

  corners.forEach((corner, index) => {
    const nextCorner = corners[(index + 1) % corners.length]
    commands.push(
      `Q ${formatPathNumber(corner.control.x)} ${formatPathNumber(corner.control.y)} `
      + `${formatPathNumber(corner.end.x)} ${formatPathNumber(corner.end.y)}`,
    )
    if (nextCorner && index < corners.length - 1) {
      commands.push(
        `L ${formatPathNumber(nextCorner.start.x)} ${formatPathNumber(nextCorner.start.y)}`,
      )
    }
  })

  commands.push('Z')
  return commands.join(' ')
}

export const tracePolygonPath = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sides: number,
  rotation = 0,
  cornerRadiusPercent = 0,
) => {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1)
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1)
  const corners = getPolygonPathDefinition(sides, rotation, cornerRadiusPercent)
  const first = corners[0]
  if (!first) return

  context.beginPath()
  context.moveTo(first.start.x * safeWidth, first.start.y * safeHeight)
  corners.forEach((corner, index) => {
    const nextCorner = corners[(index + 1) % corners.length]
    context.quadraticCurveTo(
      corner.control.x * safeWidth,
      corner.control.y * safeHeight,
      corner.end.x * safeWidth,
      corner.end.y * safeHeight,
    )
    if (nextCorner && index < corners.length - 1) {
      context.lineTo(
        nextCorner.start.x * safeWidth,
        nextCorner.start.y * safeHeight,
      )
    }
  })
  context.closePath()
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
