import { describe, expect, it } from 'vitest'
import { getEllipseMaskLayout } from '@/views/goods-form/imageMask'

describe('getEllipseMaskLayout', () => {
  it('预设椭圆保持现有正方形透明画布', () => {
    expect(getEllipseMaskLayout(800, 400)).toMatchObject({
      canvasWidth: 800,
      canvasHeight: 800,
      ellipseWidth: 800,
      ellipseHeight: 400,
      offsetX: 0,
      offsetY: 200,
    })
  })

  it('自定义椭圆保留实际裁切画布尺寸', () => {
    expect(getEllipseMaskLayout(800, 400, { preserveCanvasSize: true })).toMatchObject({
      canvasWidth: 800,
      canvasHeight: 400,
      ellipseWidth: 800,
      ellipseHeight: 400,
      offsetX: 0,
      offsetY: 0,
    })
  })
})
