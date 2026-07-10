import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/goods-detail/GoodsDetailDesktop.vue'),
  'utf8',
)

const cssRuleBlock = (selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))

  expect(match, `missing CSS rule for ${selector}`).not.toBeNull()

  return match?.[1] ?? ''
}

describe('GoodsDetailDesktop summary alignment', () => {
  it('vertically centers summary labels with chip values', () => {
    expect(cssRuleBlock('.desktop-summary-row')).toContain('align-items: center;')
  })

  it('aligns plain values with the text inside character chips', () => {
    expect(cssRuleBlock('.desktop-summary-row dd:not(.desktop-character-list)')).toContain(
      'padding-inline-start: 10px;',
    )
  })
})
