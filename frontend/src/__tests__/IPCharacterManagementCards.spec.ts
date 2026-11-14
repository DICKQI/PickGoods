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
    // 非默认排序时卡片右上角的拖拽把手直接不渲染
    expect(source).toContain(':reorderable="!sortState.prop"')

    const cardSource = readFileSync(join(process.cwd(), 'src/components/IPWorkCard.vue'), 'utf-8')
    expect(cardSource).toContain('v-if="isAdmin && reorderable"')
    expect(cardSource).toContain('reorderable?: boolean')
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
    expect(source).toContain(
      'fetchIPCovers({ ids: pending, limit: COVER_BATCH_LIMIT, force: options.force })',
    )
    expect(source).toContain('round < COVER_MAX_ROUNDS &&')
    expect(source).toContain('result.checked > 0 &&')
    expect(source).toContain('(options.force ? pending.length > 0 : result.remaining > 0)')
    expect(source).toContain(
      'const untouched = ipList.value.filter((ip) => ids.includes(ip.id) && !handled.has(ip.id))',
    )
    expect(source).toContain('metadataStore.applyIPCovers(recorded, now)')
    expect(source).toContain('@click="handleBackfillCovers"')
  })

  it('never throttles works whose cover lookup failed because of the network', () => {
    // 断网那次补齐会把 cover_checked_at 写满，导致「所有作品都已有封面啦」却一张没补；
    // 后端只对 updated/no_match 记时间戳，前端也不能把 error 标成已检查，手动补齐要 force
    expect(source).toContain("const recorded = items.filter((item) => item.status !== 'error')")
    expect(source).toContain('const recordedIds = new Set(recorded.map((item) => item.id))')
    expect(source).toContain('return recordedIds.has(ip.id) ? { ...next, cover_checked_at: now } : next')
    expect(source).toContain('const ids = ipList.value.filter((ip) => !ip.cover_image).map((ip) => ip.id)')
    expect(source).toContain(
      'const summary = await backfillCovers(ids, { silent: true, force: true })',
    )
    expect(source).toContain('summary.errors) parts.push(`${summary.errors} 部网络失败，可稍后重试`)')
    expect(source).toContain('summary.noMatch) parts.push(`${summary.noMatch} 部 BGM 无匹配`)')
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

  it('scopes write actions to official IPs vs personal IPs', () => {
    // 权限收敛成三个 helper：新建入口、单卡编辑、BGM 更新
    expect(source).toContain('const canCreateIP = computed(')
    expect(source).toContain('authStore.personalIpEnabled')
    expect(source).toContain('const canEditIP = (ip: IP) =>')
    expect(source).toContain('ip.user_id === authStore.user?.id')
    expect(source).toContain('const canSyncBGM = (ip: IP) =>')
    expect(source).toContain('const canImportFromBGM = computed(')

    // 桌面卡片 / 抽屉 / 移动端展开区都按 helper 渲染，而不是 authStore.isAdmin
    expect(source).toContain(':can-edit="canEditIP(item)"')
    expect(source).toContain(':can-sync="canSyncBGM(item)"')
    expect(source).toContain(':can-manage="drawerIP ? canEditIP(drawerIP) : false"')
    expect(source).toContain('v-if="canEditIP(item)"')
    expect(source).toContain('v-if="canEditIP(item) || canSyncBGM(item)"')
    expect(source).toContain('v-if="canCreateIP"')

    // 角色弹窗只列本人可写的 IP，并用 ipLabel 区分同名
    expect(source).toContain('const characterIpOptions = computed<IP[]>(() =>')
    expect(source).toContain(':label="ipLabel(ip)"')

    // 拖拽排序仍然只给管理员（batch-update-order 是管理员接口）
    expect(source).toContain(':reorderable="!sortState.prop"')
    expect(source).toContain('class="card-drag-handle mobile-drag-handle" v-if="authStore.isAdmin"')
    expect(source).toContain('if (typeof window === \'undefined\' || !authStore.isAdmin) return')
  })
})
