import { describe, expect, it, vi } from 'vitest'
import {
  getHeartBounds,
  getHeartPathDefinition,
  getHeartSvgPath,
  traceHeartPath,
} from '@/views/goods-form/imageShape'

describe('imageShape', () => {
  it('心形百分比在画布内居中并限制到 30–100', () => {
    expect(getHeartBounds(200, 100, 50, 80)).toEqual({
      x: 50,
      y: 10,
      width: 100,
      height: 80,
    })
    expect(getHeartBounds(200, 100, 10, 120)).toEqual({
      x: 70,
      y: 0,
      width: 60,
      height: 100,
    })
  })

  it('SVG 路径随宽高百分比缩放且始终闭合', () => {
    const full = getHeartSvgPath(100, 100)
    const narrow = getHeartSvgPath(50, 80)

    expect(full).toContain('M 0.5 1')
    expect(full.endsWith('Z')).toBe(true)
    expect(narrow).not.toBe(full)
    expect(narrow).toContain('M 0.5 0.9')
  })

  it('Canvas 路径使用同一组归一化曲线', () => {
    const context = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const path = getHeartPathDefinition()

    traceHeartPath(context, { x: 0, y: 0, width: 100, height: 100 })

    expect(context.moveTo).toHaveBeenCalledWith(
      path.start.x * 100,
      path.start.y * 100,
    )
    expect(context.bezierCurveTo).toHaveBeenCalledTimes(path.curves.length)
    expect(context.closePath).toHaveBeenCalledOnce()
  })
})
