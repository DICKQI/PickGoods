import { describe, expect, it } from 'vitest'
import { ipLabel } from '@/utils/ip'

describe('ipLabel', () => {
  it('keeps official works untouched', () => {
    expect(ipLabel({ name: '崩坏：星穹铁道' })).toBe('崩坏：星穹铁道')
    expect(ipLabel({ name: '崩坏：星穹铁道', user_id: null })).toBe('崩坏：星穹铁道')
  })

  it('marks personal works so同名作品 can be told apart in selectors', () => {
    expect(ipLabel({ name: '我的原创作品', user_id: 7 })).toBe('我的原创作品（个人）')
  })
})
