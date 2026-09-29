import { computed, nextTick, ref, type Ref } from 'vue'
import {
  areCropSnapshotsEqual,
  cloneCropSnapshot,
  moveCropHistoryBackward,
  moveCropHistoryForward,
  pushCropHistorySnapshot,
  type CropEditSnapshot,
  type CropFilterState,
  type CropNumericState,
} from '@/views/goods-form/cropHistory'

export interface CropHistoryContext {
  cropDialogVisible: Ref<boolean>
  selectedAspectRatio: Ref<string>
  filterState: Ref<CropFilterState>
  enableRoundedRect: Ref<boolean>
  roundedRadius: Ref<number>
  enableMargin: Ref<boolean>
  marginPercent: Ref<number>
  heartWidthPercent: Ref<number>
  heartHeightPercent: Ref<number>
  getCropperNumericState: (method: 'getData' | 'getCropBoxData' | 'getCanvasData') => CropNumericState | null
  applyCropperStateFromSnapshot: (snapshot: CropEditSnapshot) => boolean
}

export function useCropHistory(ctx: CropHistoryContext) {
  const cropHistoryPast = ref<CropEditSnapshot[]>([])
  const cropHistoryFuture = ref<CropEditSnapshot[]>([])
  const isCropEditDirty = ref(false)
  const suppressCropHistory = ref(false)

  let pendingCropSnapshotApply: CropEditSnapshot | null = null
  let initialSnapshot: CropEditSnapshot | null = null

  const canUndoCropEdit = computed(() => cropHistoryPast.value.length > 1)
  const canRedoCropEdit = computed(() => cropHistoryFuture.value.length > 0)

  const cloneNumericState = (value: CropNumericState | null | undefined) => (
    value ? { ...value } : null
  )

  const createCropEditSnapshot = (): CropEditSnapshot => ({
    selectedAspectRatio: ctx.selectedAspectRatio.value,
    filterState: ctx.filterState.value,
    enableRoundedRect: ctx.enableRoundedRect.value,
    roundedRadius: ctx.roundedRadius.value,
    enableMargin: ctx.enableMargin.value,
    marginPercent: ctx.marginPercent.value,
    heartWidthPercent: ctx.heartWidthPercent.value,
    heartHeightPercent: ctx.heartHeightPercent.value,
    cropData: cloneNumericState(ctx.getCropperNumericState('getData')),
    cropBoxData: cloneNumericState(ctx.getCropperNumericState('getCropBoxData')),
    canvasData: cloneNumericState(ctx.getCropperNumericState('getCanvasData')),
  })

  const updateDirtyFromSnapshot = (snapshot: CropEditSnapshot) => {
    isCropEditDirty.value = initialSnapshot
      ? !areCropSnapshotsEqual(initialSnapshot, snapshot)
      : false
  }

  const markCropEditDirty = () => {
    if (!suppressCropHistory.value) isCropEditDirty.value = true
  }

  const resetCropHistorySession = () => {
    cropHistoryPast.value = []
    cropHistoryFuture.value = []
    isCropEditDirty.value = false
    suppressCropHistory.value = false
    pendingCropSnapshotApply = null
    initialSnapshot = null
  }

  const commitCropHistorySnapshot = () => {
    if (!ctx.cropDialogVisible.value || suppressCropHistory.value) return

    const snapshot = createCropEditSnapshot()
    if (!initialSnapshot) initialSnapshot = cloneCropSnapshot(snapshot)
    const nextHistory = pushCropHistorySnapshot(
      {
        past: cropHistoryPast.value,
        future: cropHistoryFuture.value,
      },
      snapshot,
    )

    cropHistoryPast.value = nextHistory.past
    cropHistoryFuture.value = nextHistory.future
    updateDirtyFromSnapshot(snapshot)
  }

  const initializeCropHistory = () => {
    if (cropHistoryPast.value.length === 0) {
      commitCropHistorySnapshot()
    }
  }

  const finishCropSnapshotRestore = () => {
    pendingCropSnapshotApply = null
    suppressCropHistory.value = false
  }

  const applyFilterState = (state: CropFilterState) => {
    const next: CropFilterState = {
      ...state,
      hslAdjustments: Object.fromEntries(
        (Object.keys(state.hslAdjustments) as Array<keyof CropFilterState['hslAdjustments']>)
          .map((key) => [key, { ...state.hslAdjustments[key] }]),
      ) as CropFilterState['hslAdjustments'],
    }
    ctx.filterState.value = next
  }

  const restoreCropEditSnapshot = async (snapshot: CropEditSnapshot) => {
    suppressCropHistory.value = true
    pendingCropSnapshotApply = cloneCropSnapshot(snapshot)

    ctx.selectedAspectRatio.value = snapshot.selectedAspectRatio
    applyFilterState(snapshot.filterState)
    ctx.enableRoundedRect.value = snapshot.enableRoundedRect
    ctx.roundedRadius.value = snapshot.roundedRadius
    ctx.enableMargin.value = snapshot.enableMargin
    ctx.marginPercent.value = snapshot.marginPercent
    ctx.heartWidthPercent.value = snapshot.heartWidthPercent ?? 100
    ctx.heartHeightPercent.value = snapshot.heartHeightPercent ?? 100

    await nextTick()

    if (pendingCropSnapshotApply && ctx.applyCropperStateFromSnapshot(pendingCropSnapshotApply)) {
      const restored = pendingCropSnapshotApply
      finishCropSnapshotRestore()
      updateDirtyFromSnapshot(restored)
    }
  }

  const handleCropUndo = async () => {
    if (!canUndoCropEdit.value) return

    const nextHistory = moveCropHistoryBackward({
      past: cropHistoryPast.value,
      future: cropHistoryFuture.value,
    })

    cropHistoryPast.value = nextHistory.past
    cropHistoryFuture.value = nextHistory.future
    if (nextHistory.current) {
      await restoreCropEditSnapshot(nextHistory.current)
      updateDirtyFromSnapshot(nextHistory.current)
    }
  }

  const handleCropRedo = async () => {
    if (!canRedoCropEdit.value) return

    const nextHistory = moveCropHistoryForward({
      past: cropHistoryPast.value,
      future: cropHistoryFuture.value,
    })

    cropHistoryPast.value = nextHistory.past
    cropHistoryFuture.value = nextHistory.future
    if (nextHistory.current) {
      await restoreCropEditSnapshot(nextHistory.current)
      updateDirtyFromSnapshot(nextHistory.current)
    }
  }

  const handleCropperReady = () => {
    if (pendingCropSnapshotApply) {
      if (ctx.applyCropperStateFromSnapshot(pendingCropSnapshotApply)) {
        const restored = pendingCropSnapshotApply
        finishCropSnapshotRestore()
        updateDirtyFromSnapshot(restored)
      }
      return true
    }

    initializeCropHistory()
    return false
  }

  return {
    cropHistoryPast,
    cropHistoryFuture,
    canUndoCropEdit,
    canRedoCropEdit,
    isCropEditDirty,
    resetCropHistorySession,
    initializeCropHistory,
    commitCropHistorySnapshot,
    markCropEditDirty,
    handleCropUndo,
    handleCropRedo,
    handleCropperReady,
  }
}
