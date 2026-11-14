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

describe('IPCharacterManagement PC card grid', () => {
  it('replaces the desktop table with a Bangumi cover card grid', () => {
    expect(source).not.toContain('<el-table')
    expect(source).not.toContain('tableRef')
    expect(source).toContain('<!-- PC端：图片卡片网格（封面取自 Bangumi） -->')
    expect(source).toContain('class="desktop-view"')
    expect(source).toContain('<div ref="gridRef" class="ip-card-grid"')
    expect(source).toContain('<IPWorkCard')
    expect(source).toContain("import IPWorkCard from '@/components/IPWorkCard.vue'")
    expect(source).toContain("import IPCharactersDrawer from '@/components/IPCharactersDrawer.vue'")
  })

  it('keeps the grid responsive and shows covers without cropping', () => {
    const gridRule = cssRuleBlock(source, '.ip-card-grid {')

    expect(gridRule).toContain('display: grid;')
    expect(gridRule).toContain('grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));')
  })

  it('moves the table sort options into the toolbar pills', () => {
    expect(source).toContain('class="ip-toolbar"')
    expect(source).toContain('class="ip-sort-group"')
    expect(source).toContain('class="ip-sort-pill"')
    expect(source).toContain('@click="handleSortPillClick(option.prop)"')
    expect(source).toContain('const sortOptions')
    expect(source).toContain("sortState.value.order === 'ascending' ? 'descending' : 'ascending'")
  })

  it('only allows dragging while the default order is active', () => {
    expect(source).toContain("handle: '.ip-card-drag'")
    expect(source).toContain("draggable: '.ip-card'")
    expect(source).toContain('if (gridEl && !sortState.value.prop)')
    expect(source).toContain("handle: '.mobile-drag-handle'")
    expect(source).toContain('请切换回「默认」排序后再进行拖拽排序')
  })

  it('opens the character drawer from a card click', () => {
    expect(source).toContain('@open="openCharactersDrawer"')
    expect(source).toContain('@edit="handleEditIP"')
    expect(source).toContain('@remove="handleDeleteIP"')
    expect(source).toContain('@bgm-sync="handleOpenBGMSync"')
    expect(source).toContain('const drawerIPId = ref<number | null>(null)')
    expect(source).toContain('drawerIPId.value = ip.id')
    expect(source).toContain('v-model="drawerVisible"')
    expect(source).toContain('@add-character="handleAddCharacterForIP"')
    expect(source).toContain('@edit-character="handleEditCharacter"')
    expect(source).toContain('@delete-character="handleDeleteCharacter"')
  })

  it('auto-backfills missing covers on load and via the toolbar button', () => {
    expect(source).toContain('const COVER_RETRY_DAYS = 7')
    expect(source).toContain('const needsCoverFetch')
    expect(source).toContain('const autoBackfillCovers')
    expect(source).toContain('void autoBackfillCovers()')
    expect(source).toContain('if (!authStore.isAdmin || isMobile.value) return')
    expect(source).toContain('fetchIPCovers({ ids, limit: COVER_BATCH_LIMIT })')
    expect(source).toContain('while (result.remaining > 0 && round < COVER_MAX_ROUNDS)')
    expect(source).toContain('const untouched = ipList.value.filter((ip) => ids.includes(ip.id) && !handled.has(ip.id))')
    expect(source).toContain('metadataStore.applyIPCovers(items, now)')
    expect(source).toContain('@click="handleBackfillCovers"')
  })

  it('lets admins manage the cover from the IP editor dialog', () => {
    expect(source).toContain('ip-editor-section--cover')
    expect(source).toContain('handleFetchCoverForIP')
    expect(source).toContain('fetchIPCover(editingIPId.value)')
    expect(source).toContain('handleClearIPCover')
    expect(source).toContain('cover_image: ipFormData.value.cover_image ?? null')
  })

  it('passes the selected Bangumi cover along with the import payload', () => {
    expect(source).toContain('const bgmSelectedSubject = ref<BGMSubject | null>(null)')
    expect(source).toContain('bgmSelectedSubject.value = subject')
    expect(source).toContain('bgmSelectedSubject.value?.image || null')
  })

  it('keeps the mobile card list untouched', () => {
    expect(source).toContain('class="mobile-view pull-refresh-wrapper"')
    expect(source).toContain('class="ip-card-item"')
    expect(source).toContain('class="card-actions-panel"')
    expect(source).toContain('class="character-count-chip"')
    expect(source).toContain('class="mobile-view-inner"')
  })

  it('degrades quietly when the backend is too old for the cover endpoints', () => {
    // 老后端会把 POST /api/ips/fetch-covers/ 落到详情路由返回 405：
    // 前端必须静默识别、只提示一次、并停用补齐入口
    expect(source).toContain("import { isEndpointUnsupportedError } from '@/utils/request'")
    expect(source).toContain('const coverBackfillUnsupported = ref(false)')
    expect(source).toContain('if (coverBackfillUnsupported.value) return')
    expect(source).toContain('if (isEndpointUnsupportedError(err))')
    expect(source).toContain('当前服务端还不支持封面补齐，请更新后端后再试')
    expect(source).toContain(':disabled="coverBackfilling || coverBackfillUnsupported"')
    expect(source).toContain('服务端版本较旧，补齐封面暂不可用')

    const apiSource = readFileSync(join(process.cwd(), 'src/api/metadata.ts'), 'utf-8')
    expect(apiSource.match(/suppressGlobalError: true/g)).toHaveLength(2)
  })
})
