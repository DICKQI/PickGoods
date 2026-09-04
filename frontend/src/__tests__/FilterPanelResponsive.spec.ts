import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/components/FilterPanel.vue'), 'utf8')

describe('FilterPanel responsive status controls', () => {
  it('provides an accessible icon for every status option', () => {
    expect(source).toContain('aria-label="在馆"')
    expect(source).toContain('aria-label="意向"')
    expect(source).toContain('aria-label="出街"')
    expect(source).toContain('aria-label="已售出"')
    expect(source.match(/class="status-chip__icon"/g)).toHaveLength(4)
  })

  it('uses four icon-only columns at compact desktop widths', () => {
    expect(source).toContain('@media (min-width: 769px) and (max-width: 1279px)')
    expect(source).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));')
    expect(source).toMatch(/\.status-chip__label\s*{\s*display: none;/)
    expect(source).toMatch(/\.status-chip__icon\s*{\s*display: inline-flex;/)
  })

  it('keeps the status controls visually compact while preserving mobile tap size', () => {
    expect(source).toMatch(/height: 30px;\s*min-height: 30px;\s*padding: 0 8px !important;\s*font-size: 12px;/)
    expect(source).toMatch(/height: 32px;\s*min-height: 32px;/)
  })

  it('uses a softer radius for all filter controls', () => {
    expect(source).toContain('--filter-control-radius: 12px;')
    expect(source).toContain(':global(.filter-panel .el-input__wrapper)')
    expect(source).toContain(':global(.filter-panel .el-select__wrapper)')
    expect(source).toContain('border-radius: var(--filter-control-radius) !important;')
  })
})
