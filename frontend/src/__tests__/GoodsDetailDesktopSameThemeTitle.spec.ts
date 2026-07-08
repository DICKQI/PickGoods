import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/components/goods-detail/GoodsDetailDesktop.vue'), 'utf8')

describe('GoodsDetailDesktop same-theme title overflow', () => {
  it('uses automatic ellipsis-to-scroll behavior for long same-theme goods names', () => {
    expect(source).toContain('isSameThemeNameScrollable(goods.id)')
    expect(source).toContain('setSameThemeNameRef(goods.id, el)')
    expect(source).toContain('sameThemeNameRefs')
    expect(source).toContain('ResizeObserver')
    expect(source).toContain('desktop-same-theme-name-track')
    expect(source).toContain('desktop-same-theme-name-scroll-text')
    expect(source).toContain('@keyframes desktopSameThemeNameScroll')
    expect(source).toContain('animation: desktopSameThemeNameScroll 5.4s ease-in-out infinite;')
    expect(source).not.toContain('.desktop-same-theme-card:hover .desktop-same-theme-name-text')
  })
})
