import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const viewSource = readFileSync(join(process.cwd(), 'src/views/CategoryManagement.vue'), 'utf-8')
const nodeSource = readFileSync(join(process.cwd(), 'src/components/CategoryMobileNode.vue'), 'utf-8')

function cssRuleBlock(source: string, selector: string) {
  const start = source.indexOf(selector)
  expect(start).toBeGreaterThan(-1)

  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  expect(open).toBeGreaterThan(start)
  expect(close).toBeGreaterThan(open)

  return source.slice(open + 1, close)
}

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

  it('shows category goods counts and requests all-user counts on the admin route', () => {
    expect(viewSource).toContain('谷子件数')
    expect(viewSource).toContain("goods_count_scope: 'all'")
    expect(viewSource).toContain('isAdminCategoryRoute')
    expect(nodeSource).toContain('件谷子')
    expect(nodeSource).toContain('node.goods_count')
  })

  it('defines the mobile category editor as a bottom sheet with structured sections', () => {
    expect(viewSource).toContain('category-editor-dialog')
    expect(viewSource).toContain('is-category-editor-mobile')
    expect(viewSource).toContain('category-editor-hero')
    expect(viewSource).toContain('category-editor-section')
    expect(viewSource).toContain('category-editor-sheet-enter')
    expect(viewSource).toContain('category-editor-sheet-leave')
    expect(cssRuleBlock(viewSource, ':global(.el-dialog.is-category-editor-mobile)')).toContain('padding: 0;')
    expect(viewSource).toContain('保存品类')
    expect(viewSource).toContain('设为顶级')
    expect(viewSource).toContain('将创建在')
  })

  it('defines the PC category editor as a themed roomy form dialog', () => {
    expect(viewSource).toContain(":width=\"isMobile ? '100vw' : '680px'\"")
    expect(viewSource).toContain('class="category-editor-desktop-header"')
    expect(viewSource).toContain('class="category-editor-desktop-icon"')
    expect(viewSource).toContain('class="category-editor-desktop-title"')
    expect(viewSource).toContain('category-editor-section--identity')
    expect(viewSource).toContain('category-editor-section--hierarchy')
    expect(viewSource).toContain('category-editor-section--display')
    expect(viewSource).toContain('class="category-editor-field-grid"')
    expect(viewSource).toContain(':global(.category-editor-dialog:not(.is-category-editor-mobile) .el-dialog)')
    expect(viewSource).toContain('max-width: calc(100vw - 48px);')
  })
})
