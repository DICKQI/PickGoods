import type { HslAdjustments, HslColorKey } from './cropHistory'
import { createDefaultHslAdjustments } from './cropHistory'

// ── HSL color utilities ──

export const clamp01 = (v: number) => {
  if (Number.isNaN(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

export const normalizeHue = (h: number) => {
  if (!Number.isFinite(h)) return 0
  let x = h % 360
  if (x < 0) x += 360
  return x
}

export const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h /= 6
  }

  return {
    h: h * 360,
    s,
    l,
  }
}

export const hslToRgb = (h: number, s: number, l: number) => {
  h = normalizeHue(h) / 360
  s = clamp01(s)
  l = clamp01(l)

  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  const r = hue2rgb(p, q, h + 1 / 3)
  const g = hue2rgb(p, q, h)
  const b = hue2rgb(p, q, h - 1 / 3)

  return {
    r: Math.round(clamp01(r) * 255),
    g: Math.round(clamp01(g) * 255),
    b: Math.round(clamp01(b) * 255),
  }
}

export const classifyHueToColorName = (h: number) => {
  const hue = normalizeHue(h)
  if (hue >= 345 || hue < 15) return 'red'
  if (hue < 45) return 'orange'
  if (hue < 75) return 'yellow'
  if (hue < 150) return 'green'
  if (hue < 210) return 'cyan'
  if (hue < 270) return 'blue'
  return 'purple'
}

const HSL_COLOR_KEYS: HslColorKey[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
]

const HSL_HUE_ANCHORS: Array<{ key: HslColorKey; hue: number }> = [
  { key: 'red', hue: 0 },
  { key: 'orange', hue: 30 },
  { key: 'yellow', hue: 60 },
  { key: 'green', hue: 120 },
  { key: 'cyan', hue: 180 },
  { key: 'blue', hue: 240 },
  { key: 'purple', hue: 300 },
  { key: 'red', hue: 360 },
]

const buildHslWeightTable = () => {
  return Array.from({ length: 360 }, (_, hue): Record<HslColorKey, number> => {
    const normalizedHue = normalizeHue(hue)
    const weights: Record<HslColorKey, number> = {
      red: 0,
      orange: 0,
      yellow: 0,
      green: 0,
      cyan: 0,
      blue: 0,
      purple: 0,
    }

    for (let index = 0; index < HSL_HUE_ANCHORS.length - 1; index += 1) {
      const left = HSL_HUE_ANCHORS[index]
      const right = HSL_HUE_ANCHORS[index + 1]
      if (!left || !right || normalizedHue < left.hue || normalizedHue > right.hue) continue

      const span = right.hue - left.hue
      const rightWeight = span > 0 ? (normalizedHue - left.hue) / span : 0
      const leftWeight = 1 - rightWeight
      weights[left.key] += leftWeight
      weights[right.key] += rightWeight
      break
    }

    return weights
  })
}

const HSL_WEIGHT_TABLE = buildHslWeightTable()

export const getHslAdjustmentWeights = (hue: number): Record<HslColorKey, number> => {
  const normalizedHue = normalizeHue(hue)
  return HSL_WEIGHT_TABLE[Math.min(359, Math.floor(normalizedHue))]!
}

// ── Filter state ──

export interface CropFilterStateInput {
  brightness: number
  contrast: number
  saturation: number
  hslAdjustments: HslAdjustments
  rotation?: number
  perspectiveHorizontal: number
  perspectiveVertical: number
}

export const createDefaultFilterState = () => ({
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hslAdjustments: createDefaultHslAdjustments(),
  rotation: 0,
  perspectiveHorizontal: 0,
  perspectiveVertical: 0,
})

export const isAllHslAdjustmentsZero = (hslAdjustments: HslAdjustments) => {
  if (!hslAdjustments) return true
  for (const key of Object.keys(hslAdjustments) as (keyof HslAdjustments)[]) {
    const entry = hslAdjustments[key] || { h: 0, s: 0, l: 0 }
    if ((entry.h ?? 0) !== 0 || (entry.s ?? 0) !== 0 || (entry.l ?? 0) !== 0) {
      return false
    }
  }
  return true
}

export const isFilterStateDefault = (state: CropFilterStateInput) => {
  return (
    isColorFilterStateDefault(state) &&
    (state.rotation ?? 0) === 0 &&
    (state.perspectiveHorizontal ?? 0) === 0 &&
    (state.perspectiveVertical ?? 0) === 0
  )
}

export const isColorFilterStateDefault = (state: CropFilterStateInput) => {
  return (
    state.brightness === 100 &&
    state.contrast === 100 &&
    state.saturation === 100 &&
    isAllHslAdjustmentsZero(state.hslAdjustments)
  )
}

export const isTransformStateDefault = (state: CropFilterStateInput) => {
  return (
    (state.rotation ?? 0) === 0 &&
    (state.perspectiveHorizontal ?? 0) === 0 &&
    (state.perspectiveVertical ?? 0) === 0
  )
}

// ── Pixel-level HSL adjustment ──

export const applyHslPerColorToImageData = (
  imageData: ImageData,
  hslAdjustments: HslAdjustments,
): ImageData => {
  const { data } = imageData
  if (!hslAdjustments || isAllHslAdjustmentsZero(hslAdjustments)) {
    return imageData
  }

  const length = data.length
  for (let i = 0; i < length; i += 4) {
    const alpha = data[i + 3]
    if (alpha === 0) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const hsl = rgbToHsl(r || 0, g || 0, b || 0)
    if (hsl.s < 0.002) continue

    const weights = getHslAdjustmentWeights(hsl.h)
    let adjustH = 0
    let adjustS = 0
    let adjustL = 0

    const saturationStrength = Math.min(1, hsl.s / 0.12)
    for (const key of HSL_COLOR_KEYS) {
      const weight = weights[key]
      if (!weight) continue
      const entry = hslAdjustments[key]
      if (!entry) continue
      adjustH += (entry.h ?? 0) * weight * saturationStrength
      adjustS += (entry.s ?? 0) * weight * saturationStrength
      adjustL += (entry.l ?? 0) * weight * saturationStrength
    }

    if (!adjustH && !adjustS && !adjustL) {
      continue
    }

    const nextH = normalizeHue(hsl.h + adjustH)
    let nextS = hsl.s * (1 + adjustS / 100)
    let nextL = hsl.l * (1 + adjustL / 100)

    nextS = clamp01(nextS)
    nextL = clamp01(nextL)

    const rgb = hslToRgb(nextH, nextS, nextL)
    data[i] = rgb.r
    data[i + 1] = rgb.g
    data[i + 2] = rgb.b
  }

  return imageData
}

// ── Image I/O ──

export const blobToImageBitmap = async (blob: Blob): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(blob)
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('图片解码失败'))
      el.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const assertImageDecodable = async (blob: Blob): Promise<void> => {
  const bitmapOrImg = await blobToImageBitmap(blob)
  if ('close' in bitmapOrImg && typeof bitmapOrImg.close === 'function') {
    bitmapOrImg.close()
  }
}

export const detectImageTransparency = async (blob: Blob, sampleMaxSide = 256): Promise<boolean> => {
  let bitmapOrImg: ImageBitmap | HTMLImageElement | null = null
  try {
    bitmapOrImg = await blobToImageBitmap(blob)
    const sourceWidth = Math.max(1, Number((bitmapOrImg as any).width) || 1)
    const sourceHeight = Math.max(1, Number((bitmapOrImg as any).height) || 1)
    const scale = Math.min(1, sampleMaxSide / Math.max(sourceWidth, sourceHeight))
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return blob.type === 'image/png' || blob.type === 'image/webp'

    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(bitmapOrImg as any, 0, 0, width, height)
    const pixels = ctx.getImageData(0, 0, width, height).data
    for (let index = 3; index < pixels.length; index += 4) {
      if ((pixels[index] ?? 255) < 255) return true
    }
    return false
  } catch {
    return blob.type === 'image/png' || blob.type === 'image/webp'
  } finally {
    if (bitmapOrImg && 'close' in bitmapOrImg && typeof bitmapOrImg.close === 'function') {
      bitmapOrImg.close()
    }
  }
}

export const convertImageFile = async (
  input: Blob,
  mimeType: string,
  quality = 0.92,
  fileName = 'main_photo',
): Promise<File> => {
  const normalizedMime = mimeType === 'image/png' ? 'image/png' : 'image/jpeg'
  if (input.type === normalizedMime && input instanceof File) {
    return new File([input], fileName, { type: normalizedMime })
  }

  const bitmapOrImg = await blobToImageBitmap(input)
  const width = Math.max(1, Number((bitmapOrImg as any).width) || 1)
  const height = Math.max(1, Number((bitmapOrImg as any).height) || 1)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  if (normalizedMime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmapOrImg as any, 0, 0, width, height)

  const output = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片编码失败'))),
      normalizedMime,
      quality,
    )
  })
  if ('close' in bitmapOrImg && typeof bitmapOrImg.close === 'function') {
    bitmapOrImg.close()
  }
  const extension = normalizedMime === 'image/png' ? 'png' : 'jpg'
  return new File([output], `${fileName}.${extension}`, { type: normalizedMime })
}

export const resizeImageToMaxSide = async (
  input: Blob,
  maxSide: number,
): Promise<File> => {
  const bitmapOrImg = await blobToImageBitmap(input)
  const width = Math.max(1, Number((bitmapOrImg as any).width) || 1)
  const height = Math.max(1, Number((bitmapOrImg as any).height) || 1)
  const safeMaxSide = Math.max(1, maxSide)
  const scale = Math.min(1, safeMaxSide / Math.max(width, height, 1))
  if (scale >= 1) {
    if ('close' in bitmapOrImg && typeof bitmapOrImg.close === 'function') bitmapOrImg.close()
    return input instanceof File ? input : new File([input], 'image_edit.png', { type: input.type || 'image/png' })
  }

  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.clearRect(0, 0, targetWidth, targetHeight)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmapOrImg as any, 0, 0, targetWidth, targetHeight)

  const output = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片缩放失败'))),
      'image/png',
      0.94,
    )
  })
  if ('close' in bitmapOrImg && typeof bitmapOrImg.close === 'function') bitmapOrImg.close()
  return new File([output], 'image_edit.png', { type: 'image/png' })
}

// ── Filters pipeline ──

export const applyFiltersToImage = async (
  file: File,
  filterState: CropFilterStateInput,
): Promise<File> => {
  if (isColorFilterStateDefault(filterState)) {
    return file
  }

  const bitmapOrImg = await blobToImageBitmap(file)
  const width = (bitmapOrImg as any).width
  const height = (bitmapOrImg as any).height

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  ctx.filter = `brightness(${filterState.brightness}%) contrast(${filterState.contrast}%) saturate(${filterState.saturation}%)`
  ctx.drawImage(bitmapOrImg as any, 0, 0, width, height)

  try {
    const imageData = ctx.getImageData(0, 0, width, height)
    const adjusted = applyHslPerColorToImageData(imageData, filterState.hslAdjustments)
    ctx.putImageData(adjusted, 0, 0)
  } catch {
    if (!isAllHslAdjustmentsZero(filterState.hslAdjustments)) {
      throw new Error('无法读取图片像素，请确认图片可访问后重试')
    }
  }

  ctx.filter = 'none'

  const mime = file.type || 'image/png'
  const outBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('应用滤镜失败'))), mime, 0.92)
  })

  return new File([outBlob], file.name, { type: mime })
}

// ── Cropper CSS style helper ──

export const computeCropperStyle = (
  filterState: CropFilterStateInput,
) => {
  const baseBrightness = filterState.brightness
  const baseContrast = filterState.contrast
  const baseSaturation = filterState.saturation

  const hslAdj = filterState.hslAdjustments
  let sumH = 0
  let sumS = 0
  let sumL = 0
  let count = 0

  if (hslAdj) {
    for (const key of Object.keys(hslAdj) as (keyof HslAdjustments)[]) {
      const entry = hslAdj[key]
      if (!entry) continue
      if ((entry.h ?? 0) !== 0 || (entry.s ?? 0) !== 0 || (entry.l ?? 0) !== 0) {
        sumH += entry.h ?? 0
        sumS += entry.s ?? 0
        sumL += entry.l ?? 0
        count++
      }
    }
  }

  const avgH = count ? sumH / count : 0
  const avgS = count ? sumS / count : 0
  const avgL = count ? sumL / count : 0

  const cssBrightness = Math.max(0, baseBrightness * (1 + avgL / 100))
  const cssSaturation = Math.max(0, baseSaturation * (1 + avgS / 100))
  const cssHueRotate = avgH

  return {
    '--brightness': `${cssBrightness}%`,
    '--contrast': `${baseContrast}%`,
    '--saturate': `${cssSaturation}%`,
    '--hue-rotate': `${cssHueRotate}deg`,
    transformOrigin: 'center center',
  }
}
