import { computed, nextTick, onBeforeUnmount, ref, type ComputedRef, type Ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useShowcaseStore } from '@/stores/showcase'
import type { ShowcaseGoods, ShowcaseMoveGoodsInput } from '@/api/types'

interface DragGhostState {
  src: string | null
  alt: string
  ring: string
  width: number
  height: number
  x: number
  y: number
  radius: string
}

export interface DisplayDragSortOptions {
  items: ComputedRef<ShowcaseGoods[]> | Ref<ShowcaseGoods[]>
  showcaseId: ComputedRef<string | null | undefined> | Ref<string | null | undefined>
  readonly: ComputedRef<boolean> | Ref<boolean>
  itemSelector: string
  ghostSize: () => { width: number; height: number; radius?: string }
  defaultRing?: string
  errorMessage?: string
  onHoverEdge?: (x: number, y: number) => void
}

export const buildShowcaseMovePayload = (
  orderedItems: ShowcaseGoods[],
  movedShowcaseGoodsId: string,
): ShowcaseMoveGoodsInput | null => {
  const idx = orderedItems.findIndex((g) => g.id === movedShowcaseGoodsId)
  if (idx < 0 || orderedItems.length <= 1) return null

  if (idx > 0) {
    const anchor = orderedItems[idx - 1]
    if (!anchor) return null
    return {
      goods_id: orderedItems[idx]!.goods.id,
      anchor_goods_id: anchor.goods.id,
      position: 'after',
    }
  }

  const anchor = orderedItems[idx + 1]
  if (!anchor) return null
  return {
    goods_id: orderedItems[idx]!.goods.id,
    anchor_goods_id: anchor.goods.id,
    position: 'before',
  }
}

export function useShowcaseDisplayDragSort(options: DisplayDragSortOptions) {
  const showcaseStore = useShowcaseStore()
  const localOrder = ref<ShowcaseGoods[]>([])
  const dragging = ref(false)
  const dragItemId = ref<string | null>(null)
  const dragGhost = ref<DragGhostState | null>(null)

  let pendingDragItem: ShowcaseGoods | null = null
  let pointerStart = { x: 0, y: 0 }
  let grabOffset = { x: 0, y: 0 }
  const flipRects = new Map<string, DOMRect>()
  let suppressClickUntil = 0
  let playRafId: number | null = null

  watch(options.items, (v) => {
    if (!dragging.value) localOrder.value = v.slice()
  }, { immediate: true })

  const isReadonly = computed(() => options.readonly.value)

  const onPointerDown = (e: PointerEvent, item: ShowcaseGoods) => {
    if (isReadonly.value || e.button !== 0) return
    pendingDragItem = item
    pointerStart = { x: e.clientX, y: e.clientY }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    grabOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const startDrag = (item: ShowcaseGoods, x: number, y: number) => {
    dragging.value = true
    dragItemId.value = item.id
    const size = options.ghostSize()
    dragGhost.value = {
      src: item.goods.main_photo || null,
      alt: item.goods.name,
      ring: item.goods.category?.color_tag || options.defaultRing || '#d4af37',
      width: size.width,
      height: size.height,
      radius: size.radius || '50%',
      x: x - grabOffset.x,
      y: y - grabOffset.y,
    }
  }

  const computeDropIndex = (x: number, y: number): number => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    if (!el) return -1
    const target = el.closest(options.itemSelector) as HTMLElement | null
    if (!target || target.classList.contains('is-dragging')) return -1
    const targetId = target.dataset.id
    if (!targetId) return -1
    const others = localOrder.value.filter((g) => g.id !== dragItemId.value)
    const oIdx = others.findIndex((g) => g.id === targetId)
    if (oIdx < 0) return -1
    const rect = target.getBoundingClientRect()
    const after = x > rect.left + rect.width / 2
    return after ? oIdx + 1 : oIdx
  }

  const flipFirst = () => {
    flipRects.clear()
    const nodes = document.querySelectorAll<HTMLElement>(`${options.itemSelector}:not(.is-dragging)`)
    nodes.forEach((n) => {
      n.style.transition = 'none'
      n.style.transform = ''
      const id = n.dataset.id
      if (id) flipRects.set(id, n.getBoundingClientRect())
    })
  }

  const flipPlay = () => {
    if (playRafId !== null) {
      cancelAnimationFrame(playRafId)
      playRafId = null
    }
    nextTick(() => {
      const nodes = document.querySelectorAll<HTMLElement>(`${options.itemSelector}:not(.is-dragging)`)
      const animated: HTMLElement[] = []
      nodes.forEach((n) => {
        const id = n.dataset.id
        if (!id) return
        const oldRect = flipRects.get(id)
        if (!oldRect) return
        const newRect = n.getBoundingClientRect()
        const dx = oldRect.left - newRect.left
        const dy = oldRect.top - newRect.top
        if (dx === 0 && dy === 0) return
        n.style.transition = 'none'
        n.style.transform = `translate(${dx}px, ${dy}px)`
        animated.push(n)
      })
      if (animated.length > 0) {
        void animated[0]!.offsetWidth
      }
      playRafId = requestAnimationFrame(() => {
        playRafId = null
        animated.forEach((n) => {
          n.style.transition = 'transform 0.25s ease'
          n.style.transform = ''
        })
      })
      flipRects.clear()
    })
  }

  const applyReorder = (item: ShowcaseGoods, dropIdx: number) => {
    const others = localOrder.value.filter((g) => g.id !== item.id)
    const clamped = Math.max(0, Math.min(dropIdx, others.length))
    localOrder.value = [...others.slice(0, clamped), item, ...others.slice(clamped)]
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!pendingDragItem) return
    if (e.buttons === 0) {
      onPointerUp()
      return
    }
    const x = e.clientX
    const y = e.clientY

    if (!dragging.value) {
      const dist = Math.hypot(x - pointerStart.x, y - pointerStart.y)
      if (dist < 6) return
      startDrag(pendingDragItem, x, y)
    }

    if (dragging.value && dragGhost.value) {
      dragGhost.value.x = x - grabOffset.x
      dragGhost.value.y = y - grabOffset.y
      options.onHoverEdge?.(x, y)

      const dropIdx = computeDropIndex(x, y)
      if (dropIdx >= 0) {
        const currentIdx = localOrder.value.findIndex((g) => g.id === pendingDragItem!.id)
        if (dropIdx !== currentIdx) {
          flipFirst()
          applyReorder(pendingDragItem!, dropIdx)
          flipPlay()
        }
      }
    }
  }

  const commitReorder = async (item: ShowcaseGoods) => {
    const arr = localOrder.value
    const origIds = options.items.value.map((g) => g.id)
    const newIds = arr.map((g) => g.id)
    const changed = origIds.some((id, i) => id !== newIds[i])
    if (!changed) return

    const payload = buildShowcaseMovePayload(arr, item.id)
    const showcaseId = options.showcaseId.value
    if (!payload || !showcaseId) return

    const res = await showcaseStore.moveGoods(showcaseId, payload)
    if (!res) {
      localOrder.value = options.items.value.slice()
      ElMessage.error(options.errorMessage || '排序更新失败，已恢复')
    }
  }

  const onPointerUp = async () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)

    if (dragging.value && pendingDragItem) {
      suppressClickUntil = Date.now() + 300
      const item = pendingDragItem
      dragging.value = false
      dragItemId.value = null
      dragGhost.value = null
      pendingDragItem = null
      await commitReorder(item)
    } else {
      pendingDragItem = null
    }
  }

  const shouldSuppressClick = () => Date.now() < suppressClickUntil

  const cleanupDrag = () => {
    if (playRafId !== null) {
      cancelAnimationFrame(playRafId)
      playRafId = null
    }
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    dragging.value = false
    dragItemId.value = null
    dragGhost.value = null
    pendingDragItem = null
  }

  onBeforeUnmount(cleanupDrag)

  return {
    localOrder,
    dragging,
    dragItemId,
    dragGhost,
    onPointerDown,
    shouldSuppressClick,
    cleanupDrag,
  }
}
