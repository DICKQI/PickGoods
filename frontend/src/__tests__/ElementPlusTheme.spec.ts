import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/element-plus-theme.css'), 'utf8')

describe('Element Plus primary button theme', () => {
  it('only fills regular primary buttons and leaves link/text variants transparent', () => {
    const filledPrimarySelector = '.el-button--primary:not(.is-plain):not(.is-link):not(.is-text)'

    expect(themeSource).toContain(`${filledPrimarySelector} {`)
    expect(themeSource).toContain(`${filledPrimarySelector}:hover`)
    expect(themeSource).toContain(`${filledPrimarySelector}:focus`)
    expect(themeSource).not.toContain('.el-button--primary:not(.is-plain) {')
    expect(themeSource).not.toContain('.el-button--primary:not(.is-plain):hover')
    expect(themeSource).not.toContain('.el-button--primary:not(.is-plain):focus')
  })
})
