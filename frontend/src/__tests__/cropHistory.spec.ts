import { describe, it, expect } from 'vitest'
import {
  createDefaultHslAdjustments,
  cloneCropSnapshot,
  normalizeCropSnapshot,
  areCropSnapshotsEqual,
  pushCropHistorySnapshot,
  moveCropHistoryBackward,
  moveCropHistoryForward,
  type CropEditSnapshot,
  type CropHistoryState,
  type CropFilterState,
} from '@/views/goods-form/cropHistory'

const makeDefaultFilterState = (): CropFilterState => ({
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hslAdjustments: createDefaultHslAdjustments(),
  rotation: 0,
  perspectiveHorizontal: 0,
  perspectiveVertical: 0,
})

const makeSnapshot = (overrides: Partial<CropEditSnapshot> = {}): CropEditSnapshot => ({
  selectedAspectRatio: 'free',
  filterState: makeDefaultFilterState(),
  enableRoundedRect: false,
  roundedRadius: 0,
  enableMargin: false,
  marginPercent: 0,
  cropData: null,
  cropBoxData: null,
  canvasData: null,
  ...overrides,
})

describe('createDefaultHslAdjustments', () => {
  it('7 个颜色通道全部为 0', () => {
    const hsl = createDefaultHslAdjustments()
    const keys = Object.keys(hsl) as (keyof typeof hsl)[]
    expect(keys).toHaveLength(7)
    for (const key of keys) {
      expect(hsl[key]).toEqual({ h: 0, s: 0, l: 0 })
    }
  })
})

describe('cloneCropSnapshot', () => {
  it('深拷贝 — 修改副本不影响原件', () => {
    const original = makeSnapshot({
      roundedRadius: 50,
      cropData: { x: 10, y: 20 },
    })
    const cloned = cloneCropSnapshot(original)
    cloned.roundedRadius = 999
    cloned.cropData!.x = 999
    expect(original.roundedRadius).toBe(50)
    expect(original.cropData!.x).toBe(10)
  })

  it('hslAdjustments 深拷贝', () => {
    const original = makeSnapshot()
    original.filterState.hslAdjustments.red.h = 42
    const cloned = cloneCropSnapshot(original)
    cloned.filterState.hslAdjustments.red.h = 0
    expect(original.filterState.hslAdjustments.red.h).toBe(42)
  })
})

describe('normalizeCropSnapshot', () => {
  it('数值四舍五入到千分位', () => {
    const snap = makeSnapshot({
      roundedRadius: 33.3336,
      marginPercent: 12.9999,
      filterState: {
        ...makeDefaultFilterState(),
        brightness: 100.5555,
        rotation: 15.7777,
      },
    })
    const normalized = normalizeCropSnapshot(snap)
    expect(normalized.roundedRadius).toBe(33.334)
    expect(normalized.marginPercent).toBe(13)
    expect(normalized.filterState.brightness).toBe(100.556)
    expect(normalized.filterState.rotation).toBe(15.778)
  })

  it('null cropData 保持 null', () => {
    const snap = makeSnapshot({ cropData: null })
    const normalized = normalizeCropSnapshot(snap)
    expect(normalized.cropData).toBeNull()
  })
})

describe('areCropSnapshotsEqual', () => {
  it('相同快照返回 true', () => {
    const a = makeSnapshot()
    const b = makeSnapshot()
    expect(areCropSnapshotsEqual(a, b)).toBe(true)
  })

  it('不同 roundedRadius 返回 false', () => {
    const a = makeSnapshot({ roundedRadius: 10 })
    const b = makeSnapshot({ roundedRadius: 20 })
    expect(areCropSnapshotsEqual(a, b)).toBe(false)
  })

  it('微小浮点差异被归一化后相等', () => {
    const a = makeSnapshot({ roundedRadius: 10.0001 })
    const b = makeSnapshot({ roundedRadius: 10.0002 })
    // 两者归一化后都是 10
    expect(areCropSnapshotsEqual(a, b)).toBe(true)
  })

  it('null 值比较', () => {
    expect(areCropSnapshotsEqual(null, null)).toBe(true)
    expect(areCropSnapshotsEqual(null, makeSnapshot())).toBe(false)
  })
})

describe('pushCropHistorySnapshot', () => {
  it('添加到 past，清空 future', () => {
    const history: CropHistoryState = { past: [], future: [makeSnapshot()] }
    const snap = makeSnapshot({ roundedRadius: 10 })
    const result = pushCropHistorySnapshot(history, snap)
    expect(result.past).toHaveLength(1)
    expect(result.future).toEqual([])
  })

  it('重复快照不添加', () => {
    const snap = makeSnapshot()
    const history: CropHistoryState = { past: [snap], future: [] }
    const result = pushCropHistorySnapshot(history, makeSnapshot())
    expect(result.past).toHaveLength(1)
  })

  it('不同快照正常添加', () => {
    const history: CropHistoryState = { past: [makeSnapshot()], future: [] }
    const result = pushCropHistorySnapshot(history, makeSnapshot({ roundedRadius: 50 }))
    expect(result.past).toHaveLength(2)
  })
})

describe('moveCropHistoryBackward', () => {
  it('past > 1 时：past 减少，future 增加', () => {
    const s1 = makeSnapshot({ roundedRadius: 1 })
    const s2 = makeSnapshot({ roundedRadius: 2 })
    const history: CropHistoryState = { past: [s1, s2], future: [] }
    const result = moveCropHistoryBackward(history)
    expect(result.past).toHaveLength(1)
    expect(result.future).toHaveLength(1)
  })

  it('past <= 1 时不变', () => {
    const history: CropHistoryState = { past: [makeSnapshot()], future: [] }
    const result = moveCropHistoryBackward(history)
    expect(result.past).toHaveLength(1)
    expect(result.future).toHaveLength(0)
  })
})

describe('moveCropHistoryForward', () => {
  it('future 非空时：future 减少，past 增加', () => {
    const s1 = makeSnapshot({ roundedRadius: 1 })
    const s2 = makeSnapshot({ roundedRadius: 2 })
    const history: CropHistoryState = { past: [s1], future: [s2] }
    const result = moveCropHistoryForward(history)
    expect(result.past).toHaveLength(2)
    expect(result.future).toHaveLength(0)
  })

  it('future 为空时不变', () => {
    const history: CropHistoryState = { past: [makeSnapshot()], future: [] }
    const result = moveCropHistoryForward(history)
    expect(result.past).toHaveLength(1)
    expect(result.future).toHaveLength(0)
  })
})
