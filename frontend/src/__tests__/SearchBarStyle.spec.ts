import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const searchBarSource = readFileSync(resolve(process.cwd(), 'src/components/SearchBar.vue'), 'utf8')
const cloudShowcaseSource = readFileSync(resolve(process.cwd(), 'src/views/CloudShowcase.vue'), 'utf8')

describe('SearchBar rounded control styling', () => {
  it('uses the shared soft radius on the actual Element Plus input wrapper', () => {
    expect(searchBarSource).toContain('--search-control-radius: 12px;')
    expect(searchBarSource).toContain(':global(.search-bar .el-input__wrapper)')
    expect(searchBarSource).toContain('border-radius: var(--search-control-radius) !important;')
  })

  it('keeps the mobile expanded search field on the same radius', () => {
    expect(cloudShowcaseSource).toContain('border-radius: var(--search-control-radius, 12px) !important;')
  })
})
