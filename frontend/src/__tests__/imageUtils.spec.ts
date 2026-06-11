import { describe, it, expect } from 'vitest'
import {
  clamp01,
  normalizeHue,
  rgbToHsl,
  hslToRgb,
  classifyHueToColorName,
  isAllHslAdjustmentsZero,
  isFilterStateDefault,
  isColorFilterStateDefault,
  isTransformStateDefault,
  createDefaultFilterState,
  computeCropperStyle,
} from '@/views/goods-form/imageUtils'
import { createDefaultHslAdjustments } from '@/views/goods-form/cropHistory'

describe('clamp01', () => {
  it('负数返回 0', () => expect(clamp01(-0.5)).toBe(0))
  it('大于 1 返回 1', () => expect(clamp01(1.5)).toBe(1))
  it('NaN 返回 0', () => expect(clamp01(NaN)).toBe(0))
  it('0 返回 0', () => expect(clamp01(0)).toBe(0))
  it('1 返回 1', () => expect(clamp01(1)).toBe(1))
  it('中间值不变', () => expect(clamp01(0.5)).toBe(0.5))
})

describe('normalizeHue', () => {
  it('0 不变', () => expect(normalizeHue(0)).toBe(0))
  it('360 取模为 0', () => expect(normalizeHue(360)).toBe(0))
  it('负数加 360', () => expect(normalizeHue(-90)).toBe(270))
  it('大于 360 取模', () => expect(normalizeHue(450)).toBe(90))
  it('Infinity 返回 0', () => expect(normalizeHue(Infinity)).toBe(0))
})

describe('rgbToHsl / hslToRgb', () => {
  it('纯红 (255,0,0)', () => {
    const hsl = rgbToHsl(255, 0, 0)
    expect(hsl.h).toBeCloseTo(0, 0)
    expect(hsl.s).toBeCloseTo(1, 1)
    expect(hsl.l).toBeCloseTo(0.5, 1)
  })

  it('纯绿 (0,255,0)', () => {
    const hsl = rgbToHsl(0, 255, 0)
    expect(hsl.h).toBeCloseTo(120, 0)
  })

  it('纯蓝 (0,0,255)', () => {
    const hsl = rgbToHsl(0, 0, 255)
    expect(hsl.h).toBeCloseTo(240, 0)
  })

  it('灰色 (128,128,128) 饱和度为 0', () => {
    const hsl = rgbToHsl(128, 128, 128)
    expect(hsl.s).toBe(0)
  })

  it('白色 (255,255,255)', () => {
    const hsl = rgbToHsl(255, 255, 255)
    expect(hsl.l).toBeCloseTo(1, 1)
  })

  it('黑色 (0,0,0)', () => {
    const hsl = rgbToHsl(0, 0, 0)
    expect(hsl.l).toBe(0)
  })

  it('hslToRgb 纯红', () => {
    const rgb = hslToRgb(0, 1, 0.5)
    expect(rgb.r).toBe(255)
    expect(rgb.g).toBe(0)
    expect(rgb.b).toBe(0)
  })

  it('hslToRgb 灰色 (s=0)', () => {
    const rgb = hslToRgb(0, 0, 0.5)
    expect(rgb.r).toBe(128)
    expect(rgb.g).toBe(128)
    expect(rgb.b).toBe(128)
  })

  it('互为逆运算', () => {
    const original = { r: 100, g: 150, b: 200 }
    const hsl = rgbToHsl(original.r, original.g, original.b)
    const back = hslToRgb(hsl.h, hsl.s, hsl.l)
    expect(back.r).toBe(original.r)
    expect(back.g).toBe(original.g)
    expect(back.b).toBe(original.b)
  })
})

describe('classifyHueToColorName', () => {
  it('0° → red', () => expect(classifyHueToColorName(0)).toBe('red'))
  it('30° → orange', () => expect(classifyHueToColorName(30)).toBe('orange'))
  it('60° → yellow', () => expect(classifyHueToColorName(60)).toBe('yellow'))
  it('120° → green', () => expect(classifyHueToColorName(120)).toBe('green'))
  it('180° → cyan', () => expect(classifyHueToColorName(180)).toBe('cyan'))
  it('240° → blue', () => expect(classifyHueToColorName(240)).toBe('blue'))
  it('300° → purple', () => expect(classifyHueToColorName(300)).toBe('purple'))
  it('350° → red', () => expect(classifyHueToColorName(350)).toBe('red'))
})

describe('isAllHslAdjustmentsZero', () => {
  it('全零返回 true', () => {
    expect(isAllHslAdjustmentsZero(createDefaultHslAdjustments())).toBe(true)
  })

  it('任一非零返回 false', () => {
    const hsl = createDefaultHslAdjustments()
    hsl.red.h = 10
    expect(isAllHslAdjustmentsZero(hsl)).toBe(false)
  })

  it('null 返回 true', () => {
    expect(isAllHslAdjustmentsZero(null as any)).toBe(true)
  })
})

describe('isFilterStateDefault / isColorFilterStateDefault / isTransformStateDefault', () => {
  const defaultState = createDefaultFilterState()

  it('默认状态全部为 true', () => {
    expect(isFilterStateDefault(defaultState)).toBe(true)
    expect(isColorFilterStateDefault(defaultState)).toBe(true)
    expect(isTransformStateDefault(defaultState)).toBe(true)
  })

  it('修改 brightness → color 非默认', () => {
    const state = { ...defaultState, brightness: 120 }
    expect(isColorFilterStateDefault(state)).toBe(false)
    expect(isFilterStateDefault(state)).toBe(false)
  })

  it('修改 rotation → transform 非默认', () => {
    const state = { ...defaultState, rotation: 45 }
    expect(isTransformStateDefault(state)).toBe(false)
    expect(isFilterStateDefault(state)).toBe(false)
    expect(isColorFilterStateDefault(state)).toBe(true)
  })
})

describe('computeCropperStyle', () => {
  const defaultState = createDefaultFilterState()

  it('无调整时返回基础样式', () => {
    const style = computeCropperStyle(defaultState)
    expect(style['--brightness']).toBe('100%')
    expect(style['--contrast']).toBe('100%')
    expect(style.transform).toBeUndefined()
  })

  it('有旋转时含 rotate transform', () => {
    const state = { ...defaultState, rotation: 45 }
    const style = computeCropperStyle(state)
    expect(style.transform).toContain('rotate(45deg)')
  })

  it('有透视时含 rotateY', () => {
    const state = { ...defaultState, perspectiveHorizontal: 50 }
    const style = computeCropperStyle(state)
    expect(style.transform).toContain('rotateY')
  })

  it('有垂直透视时含 rotateX', () => {
    const state = { ...defaultState, perspectiveVertical: -30 }
    const style = computeCropperStyle(state)
    expect(style.transform).toContain('rotateX')
  })
})
