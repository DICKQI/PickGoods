import { describe, expect, it } from 'vitest'
import {
  getCropOutputDimensions,
  resolveOutputMime,
  scaleDimensionsToMaxSide,
} from '@/views/goods-form/imageRenderPipeline'

describe('scaleDimensionsToMaxSide', () => {
  it('不会放大小尺寸图片', () => {
    expect(scaleDimensionsToMaxSide(800, 400, 2000)).toEqual({ width: 800, height: 400 })
  })

  it('按最长边等比例缩小', () => {
    expect(scaleDimensionsToMaxSide(4000, 2000, 2000)).toEqual({ width: 2000, height: 1000 })
  })
})

describe('getCropOutputDimensions', () => {
  it('优先使用实际裁切尺寸且不放大', () => {
    expect(getCropOutputDimensions(
      'free',
      { width: 640, height: 480 },
      null,
      2000,
    )).toEqual({ width: 640, height: 480 })
  })

  it('固定比例在没有裁切数据时按最长边计算', () => {
    expect(getCropOutputDimensions('47:65-ellipse', null, null, 2000)).toEqual({
      width: 1446,
      height: 2000,
    })
  })

  it('心形没有裁切数据时按正方形最长边计算', () => {
    expect(getCropOutputDimensions('heart', null, null, 2000)).toEqual({
      width: 2000,
      height: 2000,
    })
  })

  it('优先使用 getData 的尺寸而不是裁切框尺寸', () => {
    expect(getCropOutputDimensions(
      'free',
      { width: 1200, height: 800 },
      { width: 900, height: 700 },
      1000,
    )).toEqual({ width: 1000, height: 667 })
  })
})

describe('resolveOutputMime', () => {
  const base = {
    selectedAspectRatio: 'free',
    enableRoundedRect: false,
    roundedRadius: 20,
    enableMargin: false,
    marginPercent: 8,
  }

  it('普通照片输出 JPEG', () => {
    expect(resolveOutputMime(base, false)).toBe('image/jpeg')
  })

  it('原图带透明度时输出 PNG', () => {
    expect(resolveOutputMime(base, true)).toBe('image/png')
  })

  it('圆形与椭圆输出 PNG', () => {
    expect(resolveOutputMime({ ...base, selectedAspectRatio: 'circle' }, false)).toBe('image/png')
    expect(resolveOutputMime({ ...base, selectedAspectRatio: '47:65-ellipse' }, false)).toBe('image/png')
    expect(resolveOutputMime({ ...base, selectedAspectRatio: 'custom-ellipse' }, false)).toBe('image/png')
    expect(resolveOutputMime({ ...base, selectedAspectRatio: 'heart' }, false)).toBe('image/png')
  })

  it('启用圆角时输出 PNG', () => {
    expect(resolveOutputMime({
      ...base,
      enableRoundedRect: true,
      roundedRadius: 12,
    }, false)).toBe('image/png')
  })

  it('启用白色边距后输出不透明 JPEG', () => {
    expect(resolveOutputMime({
      ...base,
      selectedAspectRatio: 'circle',
      enableMargin: true,
      marginPercent: 8,
    }, true)).toBe('image/jpeg')
  })
})
