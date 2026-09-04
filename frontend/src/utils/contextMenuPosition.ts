export interface ContextMenuPositionOptions {
  x: number
  y: number
  menuWidth: number
  menuHeight: number
  viewportWidth: number
  viewportHeight: number
  gap?: number
  safeArea?: number
}

export interface ContextMenuPosition {
  left: number
  top: number
}

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback

/** Position a fixed context menu beside its anchor without leaving the viewport. */
export const getContextMenuPosition = ({
  x,
  y,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
  gap = 6,
  safeArea = 8,
}: ContextMenuPositionOptions): ContextMenuPosition => {
  const width = Math.max(0, finite(menuWidth, 0))
  const height = Math.max(0, finite(menuHeight, 0))
  const viewportW = Math.max(0, finite(viewportWidth, 0))
  const viewportH = Math.max(0, finite(viewportHeight, 0))
  const margin = Math.max(0, finite(safeArea, 0))
  const offset = Math.max(0, finite(gap, 0))
  const anchorX = finite(x, 0)
  const anchorY = finite(y, 0)

  const maxLeft = Math.max(margin, viewportW - width - margin)
  const maxTop = Math.max(margin, viewportH - height - margin)

  let left = anchorX + offset
  if (left > maxLeft) left = anchorX - width - offset

  let top = anchorY + offset
  if (top > maxTop) top = anchorY - height - offset

  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop),
  }
}
