import { describe, expect, it } from 'vitest'
import { getContextMenuPosition } from '@/utils/contextMenuPosition'

const position = (overrides: Partial<Parameters<typeof getContextMenuPosition>[0]> = {}) =>
  getContextMenuPosition({
    x: 100,
    y: 100,
    menuWidth: 120,
    menuHeight: 80,
    viewportWidth: 400,
    viewportHeight: 300,
    ...overrides,
  })

describe('getContextMenuPosition', () => {
  it('opens next to an anchor in the normal case', () => {
    expect(position()).toEqual({ left: 106, top: 106 })
  })

  it('flips to the left near the right edge', () => {
    expect(position({ x: 380 })).toEqual({ left: 254, top: 106 })
  })

  it('flips above near the bottom edge', () => {
    expect(position({ y: 290 })).toEqual({ left: 106, top: 204 })
  })

  it('flips diagonally at the bottom-right corner', () => {
    expect(position({ x: 380, y: 290 })).toEqual({ left: 254, top: 204 })
  })

  it('keeps an oversized menu anchored to the safe area', () => {
    expect(position({ menuWidth: 500, menuHeight: 400 })).toEqual({ left: 8, top: 8 })
  })

  it('clamps invalid or negative anchor coordinates', () => {
    expect(position({ x: Number.NaN, y: -20 })).toEqual({ left: 8, top: 8 })
  })
})
