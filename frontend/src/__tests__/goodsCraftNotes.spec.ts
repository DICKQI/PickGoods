import { describe, expect, it } from 'vitest'
import { applyCraftToNotes } from '@/views/goods-form/craftNotes'

describe('applyCraftToNotes', () => {
  it('generates the default notes template when notes are blank', () => {
    expect(applyCraftToNotes('', '烫金')).toBe('店铺：\n工艺：烫金\n画师：\n主题：')
  })

  it('replaces an existing full-width craft line', () => {
    const notes = '店铺：A店\n工艺：旧工艺\n画师：太太\n主题：夏日'

    expect(applyCraftToNotes(notes, '镭射')).toBe('店铺：A店\n工艺：镭射\n画师：太太\n主题：夏日')
  })

  it('replaces an existing half-width craft line', () => {
    const notes = '店铺：A店\n工艺: 旧工艺\n其他：保留'

    expect(applyCraftToNotes(notes, '珠光')).toBe('店铺：A店\n工艺：珠光\n其他：保留')
  })

  it('appends a craft line when the notes have no craft line', () => {
    const notes = '店铺：A店\n画师：太太'

    expect(applyCraftToNotes(notes, '烫银')).toBe('店铺：A店\n画师：太太\n工艺：烫银')
  })
})
