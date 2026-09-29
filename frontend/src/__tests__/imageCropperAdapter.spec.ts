import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CropEditSnapshot } from '@/views/goods-form/cropHistory'
import { createDefaultFilterState } from '@/views/goods-form/imageUtils'

const mockCropper = vi.hoisted(() => ({
  ready: false,
  rotateTo: vi.fn(),
  setCanvasData: vi.fn(),
  setData: vi.fn(),
  setCropBoxData: vi.fn(),
  move: vi.fn(),
  getCanvasData: vi.fn(),
  getBlob: vi.fn(),
}))

vi.mock('vue-picture-cropper', () => ({
  cropper: mockCropper,
}))

import {
  applyCropperStateFromSnapshot,
  getCropperInstance,
  moveCropper,
  registerCropperInstance,
  rotateCropperTo,
} from '@/views/goods-form/imageCropperAdapter'

const snapshot = (overrides: Partial<CropEditSnapshot> = {}): CropEditSnapshot => ({
  selectedAspectRatio: '1:1',
  filterState: { ...createDefaultFilterState(), rotation: 90 },
  enableRoundedRect: false,
  roundedRadius: 20,
  enableMargin: false,
  marginPercent: 8,
  heartWidthPercent: 100,
  heartHeightPercent: 100,
  cropData: { x: 1, y: 2, width: 100, height: 100 },
  cropBoxData: { left: 1, top: 2, width: 100, height: 100 },
  canvasData: { left: 0, top: 0, width: 200, height: 200 },
  ...overrides,
})

describe('imageCropperAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCropper.ready = false
  ;(mockCropper as any).options = { aspectRatio: 1 }
    delete (mockCropper as any).getDataURL
    delete (mockCropper as any).getFile
  })

  it('Cropper 尚未 ready 时拒绝恢复并保留待应用快照', () => {
    expect(applyCropperStateFromSnapshot(null, snapshot())).toBe(false)
    expect(mockCropper.rotateTo).not.toHaveBeenCalled()
  })

  it('可按组件引用绑定当前 Cropper 实例', () => {
    const componentRef = {}
    expect(registerCropperInstance(componentRef)).toBe(true)
    expect(getCropperInstance(componentRef)).toBe(mockCropper)
  })

  it('Cropper ready 后先恢复旋转，再恢复裁切几何', () => {
    mockCropper.ready = true
    const target = snapshot()
    const calls: string[] = []
    mockCropper.rotateTo.mockImplementation(() => calls.push('rotate'))
    mockCropper.setCanvasData.mockImplementation(() => calls.push('canvas'))
    mockCropper.setData.mockImplementation(() => calls.push('data'))
    mockCropper.setCropBoxData.mockImplementation(() => calls.push('box'))

    expect(applyCropperStateFromSnapshot(null, target)).toBe(true)
    expect(calls).toEqual(['rotate', 'canvas', 'data', 'box'])
  })

  it('拒绝把旧比例的裁切状态恢复到新 Cropper 上', () => {
    mockCropper.ready = true
    ;(mockCropper as any).options = { aspectRatio: 47 / 65 }
    expect(applyCropperStateFromSnapshot(null, snapshot())).toBe(false)
    expect(mockCropper.rotateTo).not.toHaveBeenCalled()
  })

  it('心形按正方形校验，自定义椭圆允许自由比例', () => {
    mockCropper.ready = true
    expect(applyCropperStateFromSnapshot(
      null,
      snapshot({ selectedAspectRatio: 'heart' }),
    )).toBe(true)

    ;(mockCropper as any).options = { aspectRatio: Number.NaN }
    expect(applyCropperStateFromSnapshot(
      null,
      snapshot({ selectedAspectRatio: 'custom-ellipse' }),
    )).toBe(true)
  })

  it('旋转到绝对角度前要求 Cropper ready', () => {
    expect(rotateCropperTo(null, 90)).toBe(false)
    mockCropper.ready = true
    expect(rotateCropperTo(null, 90)).toBe(true)
    expect(mockCropper.rotateTo).toHaveBeenCalledWith(90)
  })

  it('右键拖图通过原生 move 移动且位置变化时返回 true', () => {
    expect(moveCropper(null, 16, -8)).toBe(false)
    mockCropper.ready = true
    mockCropper.getCanvasData
      .mockReturnValueOnce({ left: 10, top: 20 })
      .mockReturnValueOnce({ left: 26, top: 12 })

    expect(moveCropper(null, 16, -8)).toBe(true)
    expect(mockCropper.move).toHaveBeenCalledWith(16, -8)
  })

  it('图片到达边界时 move 不产生历史变化', () => {
    mockCropper.ready = true
    mockCropper.getCanvasData
      .mockReturnValueOnce({ left: 10, top: 20 })
      .mockReturnValueOnce({ left: 10, top: 20 })

    expect(moveCropper(null, 16, -8)).toBe(false)
  })
})
