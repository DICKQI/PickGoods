import { describe, expect, it, vi } from 'vitest'
import {
  getHeartBounds,
  getHeartPathDefinition,
  getHeartSvgPath,
  getPolygonPathDefinition,
  getPolygonPoints,
  getPolygonSvgPath,
  getPolygonSvgPoints,
  snapPolygonRotation,
  traceHeartPath,
  tracePolygonPath,
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

  it('多边形支持 3–8 个归一化顶点', () => {
    for (let sides = 3; sides <= 8; sides += 1) {
      const points = getPolygonPoints(sides, 0)
      expect(points).toHaveLength(sides)
      expect(Math.min(...points.map(point => point.x))).toBeCloseTo(0)
      expect(Math.max(...points.map(point => point.x))).toBeCloseTo(1)
      expect(Math.min(...points.map(point => point.y))).toBeCloseTo(0)
      expect(Math.max(...points.map(point => point.y))).toBeCloseTo(1)
    }
  })

  it('多边形旋转接近直角时吸附', () => {
    expect(snapPolygonRotation(88)).toBe(90)
    expect(snapPolygonRotation(-87)).toBe(-90)
    expect(snapPolygonRotation(-179)).toBe(-180)
    expect(snapPolygonRotation(45)).toBe(45)
  })

  it('SVG 与 Canvas 多边形使用同一组点', () => {
    const context = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    tracePolygonPath(context, 200, 100, 5, 45)

    expect(context.moveTo).toHaveBeenCalledTimes(1)
    expect(context.lineTo).toHaveBeenCalledTimes(4)
    expect(context.closePath).toHaveBeenCalledOnce()
    expect(getPolygonSvgPoints(5, 45)).toContain('%')
  })

  it('多边形圆角路径替换顶点并保持首尾闭合', () => {
    const straight = getPolygonSvgPath(6, 0, 0)
    const rounded = getPolygonSvgPath(6, 0, 20)
    const corners = getPolygonPathDefinition(6, 0, 20)

    expect(rounded).toContain(' Q ')
    expect(rounded.endsWith('Z')).toBe(true)
    expect(rounded).not.toBe(straight)
    expect(corners[0]?.start).not.toEqual(corners[0]?.control)
    expect(corners[0]?.end).not.toEqual(corners[0]?.control)
  })
})
