import { describe, expect, it } from 'vitest'
import { mobileModule, mobileReturnTarget } from '@/navigation/mobile'
describe('character stats navigation source', () => {
  it('returns to the showcase stats tab', () => {
    const route = { path: '/characters/1/stats', query: { returnTo: '/showcase?tab=stats' } }
    expect(mobileModule(route)).toBe('showcase')
    expect(mobileReturnTarget(route)).toBe('/showcase?tab=stats')
  })
  it('defaults to organize and rejects unrelated or external return targets', () => {
    for (const returnTo of [undefined, 'https://example.com', '//example.com', '/showcase-unknown']) {
      const route = { path: '/characters/1/stats', query: { returnTo: returnTo ?? null } }
      expect(mobileModule(route)).toBe('organize')
      expect(mobileReturnTarget(route)).toBe('/ipcharacter')
    }
  })
})
