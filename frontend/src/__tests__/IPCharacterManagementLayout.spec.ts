import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourcePath = join(process.cwd(), 'src/views/IPCharacterManagement.vue')
const source = readFileSync(sourcePath, 'utf-8').replace(/\r\n/g, '\n')

const cssRuleBlock = (content: string, selector: string) => {
  const start = content.indexOf(selector)
  if (start === -1) return ''
  const open = content.indexOf('{', start)
  if (open === -1) return ''

  let depth = 0
  for (let i = open; i < content.length; i += 1) {
    if (content[i] === '{') depth += 1
    if (content[i] === '}') {
      depth -= 1
      if (depth === 0) return content.slice(open + 1, i)
    }
  }
  return ''
}

describe('IPCharacterManagement mobile layout', () => {
  it('does not render or reserve space for the side pinyin index', () => {
    expect(source).not.toContain('az-index-bar')
    expect(source).not.toContain('az-index-item')
    expect(source).not.toContain('data-index-anchor')
    expect(source).not.toContain('showIndexBar')
    expect(source).not.toContain('has-index-bar')
  })

  it('renders the mobile card with a labeled character count separate from the controls', () => {
    const cardSource = readFileSync(join(process.cwd(), 'src/components/IPWorkCardMobile.vue'), 'utf-8')

    expect(cardSource).toContain('class="ip-mobile-count"')
    expect(cardSource).toContain('class="ip-mobile-count-value"')
    expect(cardSource).toContain('class="ip-mobile-count-label">角色</span>')
    expect(cardSource).toContain('class="ip-mobile-actions"')
    expect(cardSource).not.toContain('character-count-badge')
  })

  it('renders the mobile list as a two-column cover masonry', () => {
    const cardSource = readFileSync(join(process.cwd(), 'src/components/IPWorkCardMobile.vue'), 'utf-8')
    const masonryRule = cssRuleBlock(source, '.mp-masonry {')

    expect(source).toContain('class="mp-masonry"')
    expect(source).toContain('class="mp-masonry-column"')
    expect(source).toContain('v-for="(column, columnIndex) in mobileIPColumns"')
    expect(source).toContain('const mobileIPColumns = computed(() => [')
    expect(source).toContain('ref="mobileMasonryRef"')
    expect(source).toContain('<IPWorkCardMobile')
    // 两列并排 + 每列独立纵向排列，才是瀑布流
    expect(masonryRule).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(cssRuleBlock(source, '.mp-masonry-column {')).toContain('flex-direction: column;')
    // 封面按原始比例：不写死方图、不裁剪
    expect(cardSource).toContain('class="ip-mobile-cover-img"')
    expect(cssRuleBlock(cardSource, '.ip-mobile-cover-img {')).toContain('height: auto;')
    expect(cssRuleBlock(cardSource, '.ip-mobile-cover-img {')).not.toContain('object-fit: cover')
    // 旧的整行列表 / 吸顶 / 左滑结构彻底下线
    expect(source).not.toContain('ip-card-sticky-shell')
    expect(source).not.toContain('ip-swipe-item')
    expect(source).not.toContain('openSwipeId')
    expect(source).not.toContain('class="mobile-view-inner"')
  })

  it('drags cards across the two masonry columns and rebuilds a row-major order', () => {
    expect(source).toContain("group: { name: 'ip-masonry', pull: true, put: true }")
    expect(source).toContain("draggable: '.ip-mobile-card'")
    expect(source).toContain("handle: '.mobile-drag-handle'")
    expect(source).toContain('const collectMasonryOrder = () =>')
    expect(source).toContain('const handleMasonryReorder = async () =>')
    expect(source).toContain("querySelectorAll<HTMLElement>('.mp-masonry .ip-mobile-card[data-ip-id]')")
    expect(source).toContain('Math.abs(a.top - b.top) > 8')
    expect(source).toContain('batchUpdateIPOrder(items)')
  })

  it('opens the single character drawer for a tapped card instead of expanding in place', () => {
    // 移动端不再就地展开角色列表（瀑布局里会撑破列宽），统一走 btt 抽屉
    expect(source).not.toContain('expandedIPs')
    expect(source).not.toContain('handleMobileCardClick')
    expect(source).not.toContain('handleTableExpandChange')
    expect(source).toContain('@open="openCharactersDrawer(item)"')
    expect(source).toContain('const openCharactersDrawer = async (ip: IP) =>')
    expect(source).toContain('drawerIPId.value = ip.id')
    expect(source).toContain('const drawerIPId = ref<number | null>(null)')
  })

  it('uses a compact mobile create button with a bottom action sheet', () => {
    expect(source).toContain("import MobileActionSheet from '@/components/MobileActionSheet.vue'")
    expect(source).toContain('const mobileAddSheetVisible = ref(false)')
    expect(source).toContain('const ipMobileCreateActions = computed<IPMobileCreateAction[]>(')
    // 移动端标题由便签栏承担，新增入口是搜索行里的圆形按钮 + 底部 ActionSheet
    expect(source).not.toContain('class="header-section"')
    expect(source).toContain('class="mobile-inline-create"')
    expect(source).toContain('@click="openMobileAddSheet"')
    expect(source).toContain('v-model="mobileAddSheetVisible"')
    expect(source).toContain('@select="handleMobileCreateAction"')
  })

  it('moves the desktop create entry into a bottom-right floating button', () => {
    expect(source).toContain("import AddFab, { type AddFabItem, type AddFabProps } from '@/components/AddFab.vue'")
    expect(source).toContain('const ipFabItems = computed<AddFabItem[]>(')
    // 按钮配置注册给 Layout 外壳渲染，页面只在没有被外壳接管时回退渲染
    expect(source).toContain('const ipFabProps = computed<AddFabProps>(')
    expect(source).toContain("useOrganizeFab('ip'")
    expect(source).toContain('<AddFab')
    expect(source).toContain('v-if="!isMobile && !fabHosted"')
    expect(source).toContain('v-bind="ipFabProps"')
    expect(source).toContain('v-on="ipFabHandlers"')
    expect(source).toContain("label: '新增 / 导入'")
    expect(source).toContain('showPrimary: canCreateIP.value')
    // 「从 Bangumi 导入」要有 token：管理员用系统 token，普通账号必须自己配置
    expect(source).toContain('canImportFromBGM')
    expect(source).toContain('showRefresh: true')
    expect(source).toContain('command: handleActionCommand')
    expect(source).toContain('refresh: handleRefresh')
    // 旧的页头新增按钮与独立刷新悬浮球已下线
    expect(source).not.toContain('class="header-actions desktop-create-actions"')
    expect(source).not.toContain('refresh-fab')
  })

  it('drops the drag-sort hint copy from the desktop toolbar', () => {
    expect(source).not.toContain('拖拽卡片右上角把手可调整顺序')
    // 排序中的提示与补封面提示仍保留
    expect(source).toContain('当前按{{ sortLabel }}排序，拖拽排序已暂停')
    expect(source).toContain('正在从 Bangumi 补齐封面…')
  })

  it('keeps the mobile search button inline and compacts the filter card', () => {
    expect(source).toContain('.search-card {')
    expect(source).toContain('.search-flex {')
    expect(source).toContain('grid-template-columns: minmax(0, 1fr) auto;')
    expect(source).toContain('grid-row: 2;')
    expect(source).not.toContain('.search-flex,\n  .filter-flex {\n    flex-direction: column;')
  })

  it('hides the desktop page heading and rebuilds the desktop filter panel', () => {
    expect(source).toContain('class="app-visually-hidden"')
    expect(source).not.toContain('class="header-section"')
    expect(source).toContain("import AppFilterPanel from '@/components/AppFilterPanel.vue'")
    expect(source).toContain('title="筛选作品"')
    expect(source).toContain('v-model:collapsed="filterCollapsed"')
    expect(source).toContain(':reset-disabled="!hasActiveFilters"')
    expect(source).toContain('@reset="handleResetFilters"')
    // 作品类型从下拉菜单改成胶囊多选
    expect(source).toContain('class="app-filter-status app-filter-status--text-chips ip-filter-types"')
    expect(source).toContain('v-for="option in SUBJECT_TYPE_OPTIONS"')
    // 类型下拉只剩在移动端卡片里
    expect(source).toContain('<el-card v-if="isMobile" class="search-card" shadow="never">')
    expect(source.indexOf('title="筛选作品"')).toBeLessThan(
      source.indexOf('<el-card v-if="isMobile" class="search-card" shadow="never">'),
    )
  })

  it('uses a branded header shell for both Bangumi import and sync dialogs instead of plain title strings', () => {
    expect(source).toContain('class="custom-dialog bgm-dialog"')
    expect(source).toContain('<template #header>')
    expect(source).toContain('class="bgm-dialog-header"')
    expect(source).toContain('class="bgm-dialog-kicker"')
    expect(source).toContain('class="bgm-dialog-title"')
    expect(source).toContain('class="bgm-dialog-subtitle"')
    expect(source).toContain("{{ bgmDialogMode === 'import' ? 'Bangumi Import' : 'Bangumi Sync' }}")
    expect(source).toContain("{{ bgmDialogMode === 'import' ? '从 Bangumi 导入IP' : '从 Bangumi 更新角色' }}")
  })

  it('uses themed roomy PC shells for IP, character, and Bangumi entry forms', () => {
    expect(source).toContain(":class=\"['custom-dialog', 'ip-editor-dialog', { 'is-ip-editor-mobile': isMobile }]\"")
    expect(source).toContain(":class=\"['custom-dialog', 'character-editor-dialog', { 'is-character-editor-mobile': isMobile }]\"")
    expect(source).toContain('class="ip-editor-desktop-header"')
    expect(source).toContain('class="character-editor-desktop-header"')
    expect(source).toContain('class="bgm-dialog-header-icon"')
    expect(source).toContain('class="ip-editor-section ip-editor-section--identity"')
    expect(source).toContain('class="ip-editor-section ip-editor-section--keywords"')
    expect(source).toContain('character-editor-avatar-card')
    expect(source).toContain('character-editor-section--identity')
    expect(source).toContain('class="ip-editor-footer"')
    expect(source).toContain('class="character-editor-footer"')
    expect(source).toContain(':global(.ip-editor-dialog .el-dialog),')
    expect(source).toContain(':global(.el-dialog.ip-editor-dialog),')
    expect(source).toContain(':global(.character-editor-dialog .el-dialog),')
    expect(source).toContain(':global(.el-dialog.character-editor-dialog)')
    expect(source).toContain(':global(.ip-editor-dialog .el-dialog__body),')
    expect(source).toContain('max-height: calc(100vh - 156px);')
  })

  it('renders the Bangumi import search form with the same sections as the IP editor', () => {
    // 导入弹窗的搜索区与 IP 表单同构：区块标题 + 说明 + 两列表单（标签在上）
    expect(source).toContain('class="ip-editor-form bgm-import-form"')
    expect(source).toContain('label-position="top"')
    expect(source).toContain('class="ip-editor-section"')
    expect(source).toContain('class="bgm-step-search"')

    // 「增量更新」弹窗仍沿用左侧标签的流式面板：只剩它一处 label-width
    expect(source).toContain('class="bgm-flow-panel"')
    expect(source).toContain('class="bgm-search-form"')
    expect(source.match(/label-width="136px"/g)?.length).toBe(1)
    expect(source).toContain('white-space: nowrap;')

    expect(source).toContain('class="bgm-dialog-footer"')
    expect(source).toContain('class="bgm-dialog-cancel"')
    expect(source).toContain('class="bgm-dialog-submit brand-add-btn brand-add-btn--compact"')
    expect(source.match(/class="bgm-dialog-footer"/g)?.length).toBe(2)
  })

  it('vertically centers Bangumi form labels with their input controls', () => {
    expect(source).toContain('.bgm-search-form :deep(.el-form-item__label) {')
    expect(source).toContain('display: inline-flex;')
    expect(source).toContain('align-items: center;')
    expect(source).toContain('min-height: 40px;')
  })

  it('keeps Bangumi footer actions aligned on the same height and center axis', () => {
    const footerRuleStart = source.indexOf('.bgm-dialog-footer {')
    const footerRuleEnd = source.indexOf('}', footerRuleStart)
    const footerRule = source.slice(footerRuleStart, footerRuleEnd)
    const cancelRuleStart = source.indexOf('.bgm-dialog-cancel {')
    const cancelRuleEnd = source.indexOf('}', cancelRuleStart)
    const cancelRule = source.slice(cancelRuleStart, cancelRuleEnd)

    expect(footerRuleStart).toBeGreaterThan(-1)
    expect(cancelRuleStart).toBeGreaterThan(-1)
    expect(footerRule).toContain('align-items: center;')
    expect(cancelRule).toContain('display: inline-flex;')
    expect(cancelRule).toContain('align-items: center;')
    expect(cancelRule).toContain('justify-content: center;')
    expect(cancelRule).toContain('min-height: 40px;')
  })

  it('keeps Bangumi sync alert, diff list, and result summary inside dedicated branded containers', () => {
    expect(source).toContain('class="bgm-sync-alert-card"')
    expect(source).toContain('class="bgm-results-shell"')
    expect(source).toContain('class="import-summary bgm-summary-card"')
    expect(source).toContain('class="character-list-container bgm-sync-list"')
    expect(source).toContain('class="bgm-character-item bgm-sync-item"')
  })

  it('uses full-width mobile bottom sheets for IP, character, and Bangumi import forms', () => {
    expect(source).toContain("{ 'is-ip-editor-mobile': isMobile }")
    expect(source).toContain("{ 'is-character-editor-mobile': isMobile }")
    expect(source).toContain("{ 'is-bgm-import-mobile': isMobile }")

    const ipRule = cssRuleBlock(source, ':global(.el-dialog.is-ip-editor-mobile)')
    const characterRule = cssRuleBlock(source, ':global(.el-dialog.is-character-editor-mobile)')
    const bgmRule = cssRuleBlock(source, ':global(.el-dialog.is-bgm-import-mobile)')

    for (const rule of [ipRule, characterRule, bgmRule]) {
      expect(rule).toContain('width: 100vw')
      expect(rule).toContain('max-height: 88vh')
      expect(rule).toContain('padding: 0;')
      expect(rule).toContain('margin: 0 !important;')
      expect(rule).toContain('border-radius: 24px 24px 0 0;')
    }
    expect(source).toContain('@media (max-width: 768px), (pointer: coarse)')
  })

  it('adds mobile hero headers while preserving PC headers for the three entry forms', () => {
    expect(source).toContain('class="ip-editor-mobile-hero"')
    expect(source).toContain('class="ip-editor-mobile-hero-icon"')
    expect(source).toContain('class="character-editor-mobile-hero"')
    expect(source).toContain('class="character-editor-mobile-hero-icon"')
    expect(source).toContain('class="bgm-import-mobile-hero"')
    expect(source).toContain('class="bgm-import-mobile-hero-icon"')
    expect(source).toContain('class="ip-editor-desktop-header"')
    expect(source).toContain('class="character-editor-desktop-header"')
    expect(source).toContain('class="bgm-dialog-header"')
  })

  it('animates the redesigned mobile form sheets vertically without affecting desktop dialogs', () => {
    expect(source).toContain(':global(.dialog-fade-enter-active .el-dialog.is-ip-editor-mobile)')
    expect(source).toContain(':global(.dialog-fade-enter-active .el-dialog.is-character-editor-mobile)')
    expect(source).toContain(':global(.dialog-fade-enter-active .el-dialog.is-bgm-import-mobile)')
    expect(source).toContain(':global(.dialog-fade-leave-active .el-dialog.is-ip-editor-mobile)')
    expect(source).toContain(':global(.dialog-fade-leave-active .el-dialog.is-character-editor-mobile)')
    expect(source).toContain(':global(.dialog-fade-leave-active .el-dialog.is-bgm-import-mobile)')
    expect(source).toContain('translateY(100%)')
    expect(source).toContain('translateY(0)')
  })

  it('disables body scroll locking for mobile form sheets to prevent background resize jitter', () => {
    expect(source).toContain('<el-dialog\n      v-model="ipDialogVisible"')
    expect(source).toContain('<el-dialog\n      v-model="bgmDialogVisible"')
    expect(source).toContain('<el-dialog\n      v-model="characterDialogVisible"')
    expect(source).toContain(':lock-scroll="!isMobile"')
  })
})
