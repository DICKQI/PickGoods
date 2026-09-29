import { onBeforeUnmount, ref } from 'vue'

export interface CropperRightDragOptions {
  canDrag: () => boolean
  moveBy: (offsetX: number, offsetY: number) => boolean
  onMoved: () => void
  onDragEnd: () => void
}

export function useCropperRightDrag(options: CropperRightDragOptions) {
  const dragging = ref(false)
  let pointerId: number | null = null
  let captureTarget: HTMLElement | null = null
  let lastX = 0
  let lastY = 0
  let moved = false

  function handleWindowPointerEnd(event: PointerEvent) {
    if (event.pointerId === pointerId) {
      event.preventDefault()
      finish(true)
    }
  }

  const finish = (releaseCapture: boolean) => {
    if (!dragging.value) return

    const activePointerId = pointerId
    const target = captureTarget
    const shouldCommit = moved

    dragging.value = false
    pointerId = null
    captureTarget = null
    moved = false
    window.removeEventListener('pointerup', handleWindowPointerEnd, true)
    window.removeEventListener('pointercancel', handleWindowPointerEnd, true)

    if (
      releaseCapture
      && target
      && activePointerId !== null
      && target.hasPointerCapture?.(activePointerId)
    ) {
      try {
        target.releasePointerCapture(activePointerId)
      } catch {
        // Pointer capture may already have been released by the browser.
      }
    }

    if (shouldCommit) options.onDragEnd()
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 2 || event.pointerType !== 'mouse') return

    event.preventDefault()
    event.stopPropagation()
    if (!options.canDrag()) return

    dragging.value = true
    pointerId = event.pointerId
    captureTarget = event.currentTarget as HTMLElement | null
    lastX = event.clientX
    lastY = event.clientY
    moved = false

    window.addEventListener('pointerup', handleWindowPointerEnd, true)
    window.addEventListener('pointercancel', handleWindowPointerEnd, true)

    try {
      captureTarget?.setPointerCapture?.(event.pointerId)
    } catch {
      // Window-level pointerup still ends the drag if capture is unavailable.
    }
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragging.value || event.pointerId !== pointerId) return

    event.preventDefault()
    const offsetX = event.clientX - lastX
    const offsetY = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY

    if (!offsetX && !offsetY) return
    if (!options.moveBy(offsetX, offsetY)) return

    moved = true
    options.onMoved()
  }

  const handlePointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    event.preventDefault()
    finish(true)
  }

  const handleLostPointerCapture = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    finish(false)
  }

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
  }

  const dispose = () => {
    window.removeEventListener('pointerup', handleWindowPointerEnd, true)
    window.removeEventListener('pointercancel', handleWindowPointerEnd, true)
    dragging.value = false
    pointerId = null
    captureTarget = null
    moved = false
  }

  onBeforeUnmount(dispose)

  return {
    dragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleLostPointerCapture,
    handleContextMenu,
  }
}
