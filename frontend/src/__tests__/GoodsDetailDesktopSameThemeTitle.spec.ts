import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/components/goods-detail/GoodsDetailDesktop.vue'), 'utf8')

const cssRuleBlock = (selector: string) => {
  const start = source.indexOf(`${selector} {`)
  if (start === -1) return ''
  const end = source.indexOf('\n}', start)
  return end === -1 ? source.slice(start) : source.slice(start, end + 2)
}

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

  it('moves the desktop theme chip into the chip row and only scrolls it when overflowing', () => {
    const chipRowRule = cssRuleBlock('.desktop-chip-row')
    const fixedChipRule = cssRuleBlock('.desktop-chip:not(.is-theme)')
    const themeChipRule = cssRuleBlock('.desktop-theme-chip')

    expect(source).toContain('class="desktop-chip is-theme desktop-theme-chip"')
    expect(source).toContain(':class="{ \'is-scrollable\': isDesktopThemeNameScrollable }"')
    expect(source).toContain('desktopThemeNameTextRef')
    expect(source).toContain('desktop-theme-chip-track')
    expect(source).toContain('desktop-theme-chip-scroll-text')
    expect(source).toContain('@keyframes desktopThemeChipScroll')
    expect(source).toContain('animation: desktopThemeChipScroll 5.4s ease-in-out infinite;')
    expect(source).not.toContain('class="desktop-summary-row is-theme-row"')
    expect(chipRowRule).toContain('flex-wrap: nowrap;')
    expect(fixedChipRule).toContain('flex: 0 0 auto;')
    expect(fixedChipRule).toContain('max-width: none;')
    expect(themeChipRule).toContain('flex: 0 1 auto;')
    expect(themeChipRule).toContain('min-width: 0;')
  })
})
