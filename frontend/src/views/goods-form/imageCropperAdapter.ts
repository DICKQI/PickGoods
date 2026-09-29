import { cropper } from 'vue-picture-cropper'
import type { CropEditSnapshot, CropNumericState } from './cropHistory'

type CropperNumericMethod = 'getData' | 'getCropBoxData' | 'getCanvasData'

export interface CropperExportOptions {
  width: number
  height: number
  mimeType: string
  quality: number
}

const getNativeCropper = (componentRef: unknown) => {
  const value = componentRef as any
  if (!value) return null
  return value.cropper || value.$cropper || value.$refs?.cropper || value.setupState?.cropper || null
}

export const getCropperInstance = (componentRef?: unknown): any => {
  if (
    cropper
    && (
      typeof (cropper as any).getDataURL === 'function'
      || typeof (cropper as any).getBlob === 'function'
      || typeof (cropper as any).getFile === 'function'
    )
  ) {
    return cropper
  }

  const value = componentRef as any
  if (!value) return null
  return (
    value.$refs?.cropper
    || value.cropper
    || value.setupState?.cropper
    || value.__cropper
    || null
  )
}

export const getCropperNumericState = (
  componentRef: unknown,
  method: CropperNumericMethod,
): CropNumericState | null => {
  const instance = getCropperInstance(componentRef)
  if (!instance || typeof instance[method] !== 'function') return null
  try {
    const value = instance[method]()
    return value ? { ...value } : null
  } catch {
    return null
  }
}

const getSnapshotAspectRatio = (value: string): number | null => {
  if (value === 'circle' || value === '1:1') return 1
  const parts = value.replace('-ellipse', '').split(':').map(Number)
  if (!parts[0] || !parts[1]) return null
  return parts[0] / parts[1]
}

export const applyCropperStateFromSnapshot = (
  componentRef: unknown,
  snapshot: CropEditSnapshot,
): boolean => {
  const instance = getCropperInstance(componentRef)
  if (!instance) return false
  if (instance.ready !== true) return false
  const expectedAspectRatio = getSnapshotAspectRatio(snapshot.selectedAspectRatio)
  const instanceAspectRatio = Number(instance.options?.aspectRatio)
  if (
    expectedAspectRatio !== null
    && Number.isFinite(instanceAspectRatio)
    && Math.abs(expectedAspectRatio - instanceAspectRatio) > 1e-6
  ) {
    return false
  }

  try {
    let applied = false
    if (typeof instance.rotateTo === 'function') {
      instance.rotateTo(snapshot.filterState.rotation ?? 0)
      applied = true
    } else {
      return false
    }
    if (snapshot.canvasData && typeof instance.setCanvasData === 'function') {
      instance.setCanvasData({ ...snapshot.canvasData })
      applied = true
    } else if (snapshot.canvasData) {
      return false
    }
    if (snapshot.cropData && typeof instance.setData === 'function') {
      instance.setData({ ...snapshot.cropData })
      applied = true
    } else if (snapshot.cropData) {
      return false
    }
    if (snapshot.cropBoxData && typeof instance.setCropBoxData === 'function') {
      instance.setCropBoxData({ ...snapshot.cropBoxData })
      applied = true
    } else if (snapshot.cropBoxData) {
      return false
    }
    return applied || (!snapshot.canvasData && !snapshot.cropData && !snapshot.cropBoxData)
  } catch {
    return false
  }
}

const canvasToBlob = async (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
) => await new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(
    (blob) => (blob ? resolve(blob) : reject(new Error('裁剪结果编码失败'))),
    mimeType,
    quality,
  )
})

export const exportCropperFile = async (
  componentRef: unknown,
  options: CropperExportOptions,
): Promise<File> => {
  const instance = getCropperInstance(componentRef)
  if (!instance) throw new Error('图片裁剪器尚未准备完成')

  if (typeof instance.getFile === 'function') {
    try {
      const file = await instance.getFile(options)
      if (file instanceof File) return file
      if (file instanceof Blob) {
        return new File([file], 'image_edit_crop.png', { type: options.mimeType })
      }
    } catch {
      // Fall through to the remaining supported export paths.
    }
  }

  if (typeof instance.getBlob === 'function') {
    try {
      const blob = await instance.getBlob(options)
      if (blob instanceof Blob) {
        return new File([blob], 'image_edit_crop.png', { type: blob.type || options.mimeType })
      }
    } catch {
      // Fall through to the data URL path.
    }
  }

  if (typeof instance.getDataURL === 'function') {
    try {
      const dataUrl = instance.getDataURL(options)
      if (dataUrl) {
        const response = await fetch(dataUrl)
        const blob = await response.blob()
        return new File([blob], 'image_edit_crop.png', { type: options.mimeType })
      }
    } catch {
      // Fall through to the native cropper fallback.
    }
  }

  const nativeCropper = getNativeCropper(componentRef)
  if (nativeCropper && typeof nativeCropper.getCroppedCanvas === 'function') {
    const canvas = nativeCropper.getCroppedCanvas({
      width: options.width,
      height: options.height,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    })
    if (canvas) {
      const blob = await canvasToBlob(canvas, options.mimeType, options.quality)
      return new File([blob], 'image_edit_crop.png', { type: options.mimeType })
    }
  }

  throw new Error('无法读取当前裁剪结果，请重试')
}

export const zoomCropper = (componentRef: unknown, delta: number) => {
  const instance = getCropperInstance(componentRef)
  if (!instance || typeof instance.zoom !== 'function') return false
  instance.zoom(delta)
  return true
}

export const moveCropper = (
  componentRef: unknown,
  offsetX: number,
  offsetY: number,
) => {
  const instance = getCropperInstance(componentRef)
  if (
    !instance
    || instance.ready !== true
    || typeof instance.move !== 'function'
    || typeof instance.getCanvasData !== 'function'
  ) {
    return false
  }

  try {
    const before = instance.getCanvasData()
    instance.move(offsetX, offsetY)
    const after = instance.getCanvasData()
    if (!before || !after) return false

    const left = Number(before.left)
    const top = Number(before.top)
    const nextLeft = Number(after.left)
    const nextTop = Number(after.top)
    return (
      Math.abs(nextLeft - left) > 0.01
      || Math.abs(nextTop - top) > 0.01
    )
  } catch {
    return false
  }
}

export const rotateCropperTo = (componentRef: unknown, degrees: number) => {
  const instance = getCropperInstance(componentRef)
  if (!instance || instance.ready !== true || typeof instance.rotateTo !== 'function') return false
  try {
    instance.rotateTo(Number.isFinite(degrees) ? degrees : 0)
    return true
  } catch {
    return false
  }
}

export const fitCropper = (componentRef: unknown) => {
  const instance = getCropperInstance(componentRef)
  if (!instance || typeof instance.reset !== 'function') return false
  instance.reset()
  return true
}
