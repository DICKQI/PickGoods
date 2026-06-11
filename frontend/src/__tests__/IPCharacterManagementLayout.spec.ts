import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourcePath = join(process.cwd(), 'src/views/IPCharacterManagement.vue')
const source = readFileSync(sourcePath, 'utf-8')

describe('IPCharacterManagement mobile layout', () => {
  it('does not render or reserve space for the side pinyin index', () => {
    expect(source).not.toContain('az-index-bar')
    expect(source).not.toContain('az-index-item')
    expect(source).not.toContain('data-index-anchor')
    expect(source).not.toContain('showIndexBar')
    expect(source).not.toContain('has-index-bar')
  })

  it('keeps the mobile character count as a labeled metric separate from card controls', () => {
    expect(source).toContain('class="card-actions-panel"')
    expect(source).toContain('class="character-count-chip"')
    expect(source).toContain('class="count-label">角色</span>')
    expect(source).toContain('class="card-control-row"')
    expect(source).not.toContain('character-count-badge')
  })
})
