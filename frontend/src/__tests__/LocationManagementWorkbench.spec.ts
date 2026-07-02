import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/views/LocationManagement.vue'), 'utf8')

function extractCssBlock(selector: string) {
  const start = source.indexOf(selector)
  if (start === -1) return ''
  const openBrace = source.indexOf('{', start)
  const closeBrace = source.indexOf('}', openBrace)
  return source.slice(openBrace + 1, closeBrace)
}

describe('LocationManagement workbench source contract', () => {
  it('consumes route highlight query and expands the matched path', () => {
    expect(source).toContain("useRoute")
    expect(source).toContain("highlight")
    expect(source).toContain("getNodeByPathName")
    expect(source).toContain("setCurrentKey")
    expect(source).toContain("scrollCurrentTreeNodeIntoView")
  })

  it('uses summary, paginated location goods and batch move APIs', () => {
    expect(source).toContain("getLocationNodeSummary")
    expect(source).toContain("moveLocationGoods")
    expect(source).toContain("locationPagination")
    expect(source).toContain("selectedGoodsIds")
    expect(source).toContain("handleBatchMoveToUnassigned")
  })

  it('renders unassigned goods as a centered dense dialog instead of a drawer', () => {
    expect(source).toContain('data-test="unassigned-goods-dialog"')
    expect(source).toContain('class="unassigned-goods-dialog"')
    expect(source).toContain('width="min(1080px, calc(100vw - 32px))"')
    expect(source).toContain('align-center')
    expect(source).not.toContain('<el-drawer')
    expect(source).not.toContain('drawer-goods-list')
  })

  it('loads unassigned goods from the generic goods list with null-location filtering', () => {
    expect(source).toContain("getGoodsList")
    expect(source).toContain("location__isnull: true")
    expect(source).not.toContain("getLocationUnassignedGoods")
  })

  it('opens unassigned goods and paginates without passing click events as page numbers', () => {
    expect(source).not.toContain('@click="loadUnassignedGoods"')
    expect(source).not.toContain('@click="() => loadUnassignedGoods(1)"')
    expect(source).toContain('@click="openUnassignedGoodsDialog"')
    expect(source).toContain('@current-change="fetchUnassignedGoods"')
  })

  it('keeps the empty state passive and promotes adding goods after selecting a location', () => {
    const emptyStart = source.indexOf('<section v-else class="empty-workbench">')
    const emptyEnd = source.indexOf('</section>', emptyStart)
    const emptyBlock = source.slice(emptyStart, emptyEnd)

    expect(source).not.toContain('查看待整理谷子')
    expect(emptyBlock).not.toContain('openUnassignedGoodsDialog')
    expect(source).toContain('class="add-goods-entry"')
    expect(source).toContain('type="primary"')
    expect(source).toContain('添加谷子')
    expect(source).toContain('class="add-goods-count"')
    expect(source).toContain('待整理 {{ unassignedPagination.count }}')
    const addGoodsEntryBlock = extractCssBlock('.add-goods-entry')
    expect(addGoodsEntryBlock).toContain('min-width: 132px;')
    expect(addGoodsEntryBlock).toContain('border: 1px solid rgba(212, 175, 55, 0.46);')
    expect(addGoodsEntryBlock).toContain('rgba(255, 248, 230, 0.98)')
    expect(addGoodsEntryBlock).toContain('color: #7a5b08;')
    expect(addGoodsEntryBlock).not.toContain('#111827')
    expect(extractCssBlock('.add-goods-count')).toContain('background: rgba(212, 175, 55, 0.16);')
  })

  it('renders the location create entry as a branded compact button', () => {
    expect(source).toContain('data-test="location-create-button"')
    expect(source).toContain('class="brand-add-btn brand-add-btn--compact location-create-btn"')
    expect(source).toContain('class="brand-add-btn__content location-create-btn__content"')
    expect(source).toContain('class="location-create-btn__icon"')
    expect(source).toContain('class="location-create-btn__label"')
    expect(source).toContain('<span class="location-create-btn__label">新增位置</span>')
    expect(source).not.toContain('<el-button type="primary" size="small" :icon="Plus" @click="handleAddNode">新增</el-button>')
  })

  it('adds search, IP, role, category, official and status filters to the unassigned dialog', () => {
    expect(source).toContain("unassignedFilters")
    expect(source).toContain("selectedUnassignedStatuses")
    expect(source).toContain("unassignedCategoryTreeData")
    expect(source).toContain("handleUnassignedIPChange")
    expect(source).toContain("resetUnassignedFilters")
    expect(source).toContain('data-test="unassigned-search-input"')
    expect(source).toContain('data-test="unassigned-ip-filter"')
    expect(source).toContain('data-test="unassigned-character-filter"')
    expect(source).toContain('data-test="unassigned-category-filter"')
    expect(source).toContain('data-test="unassigned-official-filter"')
    expect(source).toContain('data-test="unassigned-status-draft"')
  })

  it('uses compact dialog cards instead of full GoodsCard cards for unassigned goods', () => {
    expect(source).toContain("unassigned-result-card")
    expect(source).toContain("unassigned-thumb")
    expect(source).toContain("moveUnassignedGoodsToCurrent")
    expect(source).not.toContain('class="drawer-goods-row"')
  })

  it('adds status, IP and category quick filters for goods in a location', () => {
    expect(source).toContain("goodsStatusFilter")
    expect(source).toContain("goodsIpFilter")
    expect(source).toContain("goodsCategoryFilter")
    expect(source).toContain("goodsStatusOptions")
  })

  it('opens the reusable goods detail drawer from location goods cards', () => {
    expect(source).toContain("GoodsDrawer")
    expect(source).toContain("detailDrawerVisible")
    expect(source).toContain("selectedGoodsId")
  })

  it('styles the location edit dialog like an optimized segmented form', () => {
    expect(source).toContain('class="location-node-dialog"')
    expect(source).toContain('data-test="location-node-dialog"')
    expect(source).toContain('class="location-dialog-header"')
    expect(source).toContain('class="location-dialog-form-grid"')
    expect(source).toContain('class="location-form-section location-form-section--identity"')
    expect(source).toContain('class="location-form-section location-form-section--structure"')
    expect(source).toContain('class="location-form-section location-form-section--notes"')
    expect(source).toContain('favorite-location-field')
    expect(source).toContain('class="location-dialog-footer"')
    expect(source).toContain(':global(.location-node-dialog .el-dialog)')
  })

  it('keeps the location edit dialog header and footer chrome quiet', () => {
    expect(extractCssBlock(':global(.location-node-dialog .el-dialog__header)')).toContain('background: transparent;')
    expect(extractCssBlock(':global(.location-node-dialog .el-dialog__footer)')).toContain('background: transparent;')
    expect(extractCssBlock(':global(.location-node-dialog .el-dialog__footer)')).toContain('box-shadow: none;')
    expect(extractCssBlock('.location-dialog-submit')).toContain('background: transparent;')
    expect(extractCssBlock('.location-dialog-submit')).toContain('box-shadow: none;')
  })

  it('keeps number fields and the favorite switch visually stable', () => {
    expect(source.match(/class="location-number-input"/g)).toHaveLength(2)
    expect(source).toContain('class="favorite-location-switch"')
    expect(source).toContain('class="favorite-switch-control"')
    expect(source).not.toContain('class="favorite-switch-state"')
    expect(source).toContain(':controls="false"')
    expect(source).not.toContain('controls-position="right"')
    expect(source).toContain('.location-number-input')
    expect(source).toContain('width: 100%;')
    expect(source).toContain('display: block;')
    expect(source).toContain('inline-prompt')
    expect(source).toContain('active-text="开"')
    expect(source).toContain('inactive-text="关"')
    const favoriteSwitchBlock = extractCssBlock('.favorite-location-switch')
    expect(favoriteSwitchBlock).toContain('--el-switch-on-color: #ead39a;')
    expect(favoriteSwitchBlock).toContain('--el-switch-off-color: #dbe4ef;')
    expect(source).not.toContain('.location-number-input :deep(.el-input-number__increase)')
    expect(source).not.toContain('.location-number-input :deep(.el-input-number__decrease)')
    expect(extractCssBlock('.favorite-location-switch :deep(.el-switch__core)')).toContain('min-width: 46px;')
    expect(extractCssBlock('.favorite-location-switch :deep(.el-switch__action)')).toContain('left: 3px;')
    expect(extractCssBlock('.favorite-location-switch.is-checked :deep(.el-switch__core .el-switch__action)')).toContain(
      'left: calc(100% - 23px);',
    )
    expect(extractCssBlock('.favorite-location-switch :deep(.el-switch__inner)')).toContain('color: #334155;')
    expect(source).toContain('.favorite-location-switch :deep(.el-switch__inner-wrapper)')
    const checkedSwitchCoreBlock = extractCssBlock('.favorite-location-switch.is-checked :deep(.el-switch__core)')
    expect(checkedSwitchCoreBlock).toContain('border-color: #d8b873;')
    expect(checkedSwitchCoreBlock).toContain('#f7eac3')
    expect(checkedSwitchCoreBlock).toContain('#ead39a')
    expect(extractCssBlock('.favorite-location-switch.is-checked :deep(.el-switch__inner)')).toContain('color: #4a3410;')
  })

  it('orders structure fields as parent, order, capacity, type and favorite toggle', () => {
    const parentIndex = source.indexOf('label="父节点位置"')
    const orderIndex = source.indexOf('label="显示顺序"')
    const capacityIndex = source.indexOf('label="容量"')
    const typeIndex = source.indexOf('label="位置类型"')
    const favoriteIndex = source.indexOf('label="常用位置"')
    const notesSectionIndex = source.indexOf('location-form-section location-form-section--notes')

    expect(parentIndex).toBeGreaterThan(-1)
    expect(parentIndex).toBeLessThan(orderIndex)
    expect(orderIndex).toBeLessThan(capacityIndex)
    expect(capacityIndex).toBeLessThan(typeIndex)
    expect(typeIndex).toBeLessThan(favoriteIndex)
    expect(favoriteIndex).toBeLessThan(notesSectionIndex)
    expect(source).not.toContain('class="favorite-location-row"')
  })
})
