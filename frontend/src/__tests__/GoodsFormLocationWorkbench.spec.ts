import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/views/GoodsForm.vue'), 'utf8')

describe('GoodsForm location workbench affordances', () => {
  it('filters location tree by name, path and code', () => {
    expect(source).toContain(":filter-node-method=\"filterLocationNode\"")
    expect(source).toContain("filterLocationNode")
    expect(source).toContain("path_name")
    expect(source).toContain("code")
  })

  it('exposes recent and favorite location shortcuts', () => {
    expect(source).toContain("recentLocationNodes")
    expect(source).toContain("favoriteLocationNodes")
    expect(source).toContain("selectLocationShortcut")
  })

  it('records recently used locations after saving a goods item', () => {
    expect(source).toContain("markRecentLocation")
  })
})
