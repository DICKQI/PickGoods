import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const viewSource = readFileSync(join(process.cwd(), 'src/views/CategoryManagement.vue'), 'utf-8')
const nodeSource = readFileSync(join(process.cwd(), 'src/components/CategoryMobileNode.vue'), 'utf-8')

describe('CategoryManagement mobile layout', () => {
  it('renders mobile categories through a recursive tree component instead of a flat-only list', () => {
    expect(viewSource).toContain('<CategoryMobileNode')
    expect(viewSource).toContain('v-for="item in displayedTree"')
    expect(viewSource).toContain('class="mobile-sortable-group mobile-root-group"')
    expect(viewSource).not.toContain('v-for="item in flatDisplayedList"')
  })

  it('keeps the child category expansion as an animated in-card section', () => {
    expect(nodeSource).toContain('<Transition name="category-expand">')
    expect(nodeSource).toContain('class="mobile-category-children-shell"')
    expect(nodeSource).toContain('class="mobile-category-children mobile-sortable-group"')
    expect(nodeSource).toContain('class="card-meta-line"')
    expect(nodeSource).toContain('.category-expand-enter-active')
  })
})
