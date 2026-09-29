import type { CropEditSnapshot, CropFilterState, CropNumericState } from './cropHistory'
import {
  applyFiltersToImage,
  convertImageFile,
  isTransformStateDefault,
  resizeImageToMaxSide,
} from './imageUtils'
import {
  applyCircleMaskToBlob,
  applyEllipseMaskToBlob,
  applyHeartMaskToBlob,
  applyMarginToBlob,
  applyRoundedRectMaskToBlob,
} from './imageMask'
import { applyPerspectiveAndRotateToBlob } from './imageTransform'

export interface ImageDimensions {
  width: number
  height: number
}

export interface RenderImageOptions {
  maxOutputSize: number
  sourceHasTransparency?: boolean
  quality?: number
}

const toPositiveNumber = (value: number | undefined) => (
  Number.isFinite(value) && value && value > 0 ? value : null
)

export const scaleDimensionsToMaxSide = (
  width: number,
  height: number,
  maxSide: number,
): ImageDimensions => {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : maxSide)
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : maxSide)
  const safeMaxSide = Math.max(1, maxSide)
  const scale = Math.min(1, safeMaxSide / Math.max(safeWidth, safeHeight, 1))

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  }
}

const parseAspectRatioParts = (value: string): [number, number] | null => {
  const ratioText = value.replace('-ellipse', '')
  const parts = ratioText.split(':').map(Number)
  if (!parts[0] || !parts[1]) return null
  return [parts[0], parts[1]]
}

export const getCropOutputDimensions = (
  selectedAspectRatio: string,
  cropData: CropNumericState | null,
  cropBoxData: CropNumericState | null,
  maxSide: number,
): ImageDimensions => {
  const width = toPositiveNumber(cropData?.width ?? cropBoxData?.width)
  const height = toPositiveNumber(cropData?.height ?? cropBoxData?.height)

  if (width && height) {
    return scaleDimensionsToMaxSide(width, height, maxSide)
  }

  if (
    selectedAspectRatio === 'circle'
    || selectedAspectRatio === '1:1'
    || selectedAspectRatio === 'heart'
  ) {
    return { width: Math.max(1, maxSide), height: Math.max(1, maxSide) }
  }

  const fixedRatio = parseAspectRatioParts(selectedAspectRatio)
  if (fixedRatio) {
    const ratioScale = Math.max(1, maxSide) / Math.max(fixedRatio[0], fixedRatio[1])
    return {
      width: Math.max(1, Math.round(fixedRatio[0] * ratioScale)),
      height: Math.max(1, Math.round(fixedRatio[1] * ratioScale)),
    }
  }

  return { width: Math.max(1, maxSide), height: Math.max(1, maxSide) }
}

export const resolveOutputMime = (
  snapshot: Pick<
    CropEditSnapshot,
    | 'selectedAspectRatio'
    | 'enableRoundedRect'
    | 'roundedRadius'
    | 'enableMargin'
    | 'marginPercent'
  >,
  sourceHasTransparency = false,
): 'image/jpeg' | 'image/png' => {
  if (snapshot.enableMargin && snapshot.marginPercent > 0) return 'image/jpeg'

  const needsTransparentCanvas = (
    snapshot.selectedAspectRatio === 'circle'
    || snapshot.selectedAspectRatio === 'custom-ellipse'
    || snapshot.selectedAspectRatio === 'heart'
    || snapshot.selectedAspectRatio.endsWith('-ellipse')
    || (snapshot.enableRoundedRect && snapshot.roundedRadius > 0)
  )
  return needsTransparentCanvas || sourceHasTransparency ? 'image/png' : 'image/jpeg'
}

const asFile = (blob: Blob, name: string) => (
  blob instanceof File ? blob : new File([blob], name, { type: blob.type || 'image/png' })
)

export const processCroppedImage = async (
  croppedFile: File,
  snapshot: CropEditSnapshot,
  options: RenderImageOptions,
): Promise<File> => {
  let workingFile = croppedFile

  if (!isTransformStateDefault(snapshot.filterState)) {
    const transformed = await applyPerspectiveAndRotateToBlob(workingFile, {
      // Rotation is applied by CropperJS so crop coordinates and pointer input stay aligned.
      rotation: 0,
      perspectiveHorizontal: snapshot.filterState.perspectiveHorizontal,
      perspectiveVertical: snapshot.filterState.perspectiveVertical,
    })
    workingFile = asFile(transformed, 'image_edit_transform.png')
  }

  if (snapshot.selectedAspectRatio === 'circle') {
    const masked = await applyCircleMaskToBlob(workingFile)
    workingFile = asFile(masked, 'image_edit_circle.png')
  } else if (
    snapshot.selectedAspectRatio === 'custom-ellipse'
    || snapshot.selectedAspectRatio.endsWith('-ellipse')
  ) {
    const masked = await applyEllipseMaskToBlob(workingFile, {
      preserveCanvasSize: snapshot.selectedAspectRatio === 'custom-ellipse',
    })
    workingFile = asFile(masked, 'image_edit_ellipse.png')
  } else if (snapshot.selectedAspectRatio === 'heart') {
    const masked = await applyHeartMaskToBlob(workingFile, {
      widthPercent: snapshot.heartWidthPercent,
      heightPercent: snapshot.heartHeightPercent,
    })
    workingFile = asFile(masked, 'image_edit_heart.png')
  } else if (snapshot.enableRoundedRect && snapshot.roundedRadius > 0) {
    workingFile = await applyRoundedRectMaskToBlob(workingFile, snapshot.roundedRadius)
  }

  if (snapshot.enableMargin && snapshot.marginPercent > 0) {
    const marginBlob = await applyMarginToBlob(workingFile, snapshot.marginPercent)
    workingFile = asFile(marginBlob, 'image_edit_margin.png')
  }

  // Cap before the expensive per-color HSL pass; color operations preserve dimensions.
  const bounded = await resizeImageToMaxSide(workingFile, options.maxOutputSize)
  const filtered = await applyFiltersToImage(bounded, snapshot.filterState)
  const mime = resolveOutputMime(snapshot, options.sourceHasTransparency)
  return convertImageFile(
    filtered,
    mime,
    options.quality ?? 0.92,
    'main_photo',
  )
}

export const createImageEditSnapshot = (
  state: {
    selectedAspectRatio: string
    filterState: CropFilterState
    enableRoundedRect: boolean
    roundedRadius: number
    enableMargin: boolean
    marginPercent: number
    heartWidthPercent: number
    heartHeightPercent: number
  },
  cropData: CropNumericState | null,
  cropBoxData: CropNumericState | null,
  canvasData: CropNumericState | null,
): CropEditSnapshot => ({
  selectedAspectRatio: state.selectedAspectRatio,
  filterState: state.filterState,
  enableRoundedRect: state.enableRoundedRect,
  roundedRadius: state.roundedRadius,
  enableMargin: state.enableMargin,
  marginPercent: state.marginPercent,
  heartWidthPercent: state.heartWidthPercent,
  heartHeightPercent: state.heartHeightPercent,
  cropData,
  cropBoxData,
  canvasData,
})
