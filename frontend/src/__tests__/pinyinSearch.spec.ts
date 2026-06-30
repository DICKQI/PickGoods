import { describe, expect, it } from 'vitest'
import { matchesTextOrPinyin } from '@/utils/pinyinSearch'

describe('matchesTextOrPinyin', () => {
  it('支持中文直搜', () => {
    expect(matchesTextOrPinyin('原', '原神')).toBe(true)
  })

  it('支持拼音首字母匹配', () => {
    expect(matchesTextOrPinyin('ys', '原神')).toBe(true)
  })

  it('支持全拼匹配', () => {
    expect(matchesTextOrPinyin('yuanshen', '原神')).toBe(true)
  })

  it('支持大小写混输', () => {
    expect(matchesTextOrPinyin('YuanShen', '原神')).toBe(true)
    expect(matchesTextOrPinyin('YS', '原神')).toBe(true)
  })

  it('支持多候选字段匹配', () => {
    expect(matchesTextOrPinyin('ys', ['徽章', '原神 / 徽章'])).toBe(true)
  })

  it('支持 IP 检索关键词的英文缩写和中文别名匹配', () => {
    expect(matchesTextOrPinyin('hsr', ['崩坏：星穹铁道', 'HSR', '崩铁', '星铁'])).toBe(true)
    expect(matchesTextOrPinyin('xingtie', ['崩坏：星穹铁道', '星铁'])).toBe(true)
    expect(matchesTextOrPinyin('bt', ['崩坏：星穹铁道', '崩铁'])).toBe(true)
  })

  it('对空关键字直接返回 true，对空文本安全返回 false', () => {
    expect(matchesTextOrPinyin('', '原神')).toBe(true)
    expect(matchesTextOrPinyin('ys', '')).toBe(false)
    expect(matchesTextOrPinyin('ys', undefined)).toBe(false)
  })

  it('不匹配无关关键字', () => {
    expect(matchesTextOrPinyin('fz', '原神')).toBe(false)
  })
})
