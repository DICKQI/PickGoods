import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/components/FilterPanel.vue'), 'utf8')
const sharedStyles = readFileSync(resolve(process.cwd(), 'src/styles/filterPanel.css'), 'utf8')

describe('FilterPanel responsive status controls', () => {
  it('provides an accessible icon for every status option', () => {
    expect(source).toContain('aria-label="在馆"')
    expect(source).toContain('aria-label="意向"')
    expect(source).toContain('aria-label="出街"')
    expect(source).toContain('aria-label="已售出"')
    expect(source.match(/class="status-chip__icon"/g)).toHaveLength(4)
  })

  it('shares the statistics dashboard surface and typography hooks', () => {
    expect(source).toContain('app-filter-surface')
    expect(source).toContain('app-filter-header')
    expect(source).toContain('app-filter-actions')
    expect(source).toContain('app-filter-fields')
    expect(source).toContain('app-filter-status')
    expect(source).toContain('<transition name="app-filter-collapse">')
  })

  it('uses four icon-only columns at compact desktop widths', () => {
    expect(sharedStyles).toContain('@media (min-width: 769px) and (max-width: 1279px)')
    expect(sharedStyles).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));')
    expect(sharedStyles).toMatch(/\.app-filter-status \.status-chip__label,[\s\S]*?display: none;/)
    expect(sharedStyles).toMatch(/\.app-filter-status \.status-chip__icon,[\s\S]*?display: inline-flex;/)
  })

  it('keeps the status controls on one line inside 32px pills', () => {
    expect(sharedStyles).toMatch(/height: 32px;\s*padding: 0 11px;\s*border: 1px solid #d8dee8;/)
    expect(sharedStyles).toMatch(/font-size: 12px;/)
    expect(source).not.toContain('statusDotPulse')
    expect(source).not.toContain('status-chip--in-cabinet.is-checked')
  })

  it('uses the shared softer radius for all filter controls', () => {
    expect(sharedStyles).toContain('.app-filter-fields .el-input__wrapper')
    expect(sharedStyles).toContain('.app-filter-fields .el-select__wrapper')
    expect(sharedStyles).toContain('border-radius: 10px;')
    expect(source).not.toContain('--filter-control-radius')
  })
})
