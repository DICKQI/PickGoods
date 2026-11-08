import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf-8')

const ADMIN_PAGES = [
  'AdminIPCharacterManagement',
  'GoodsManagement',
  'UserManagement',
  'AdminThemeManagement',
  'GoodsCraftManagement',
  'AdminAuditLogs',
]

/**
 * 估算 el-button(link) 的渲染宽度。
 * 系数按真实浏览器实测校准：
 *   「详情」= 34px（2 汉字）
 *   「BGM 同步」= 69.78px（3 字母 + 空格 + 2 汉字）
 * 解得每汉字约 11px、每非汉字字符（含空格）约 9px、常量 12px。
 */
function estimateButtonWidth(label: string): number {
  const chars = [...label]
  const cjk = chars.filter((ch) => /[\u4e00-\u9fa5]/.test(ch)).length
  const other = chars.length - cjk
  return cjk * 11 + other * 9 + 12
}

interface ActionColumn {
  width: number
  labels: string[]
}

/**
 * 从模板中提取所有「操作」列：声明宽度 + 该列内各 el-button 的文本。
 * 只统计 label="操作" 的列，且仅当该列内部使用 .admin-action-inline
 * （否则走 Element Plus 默认的相邻 margin，不在本测试关注范围内）。
 */
function parseActionColumns(source: string): ActionColumn[] {
  const columns: ActionColumn[] = []
  const columnStart = /<el-table-column\s+label="操作"[^>]*>/g
  let match: RegExpExecArray | null

  while ((match = columnStart.exec(source)) !== null) {
    const widthMatch = /width="(\d+)"/.exec(match[0])
    if (!widthMatch) continue

    // 截取该列的模板片段：到对应的 </el-table-column> 为止
    const rest = source.slice(match.index + match[0].length)
    const end = rest.indexOf('</el-table-column>')
    const block = end === -1 ? rest : rest.slice(0, end)
    if (!block.includes('admin-action-inline')) continue

    const labels: string[] = []
    const buttonPattern = /<el-button\b[^>]*>([\s\S]*?)<\/el-button>/g
    let button: RegExpExecArray | null
    while ((button = buttonPattern.exec(block)) !== null) {
      // 保留按钮文本内部的空格（如「BGM 同步」），空格同样占宽度
      const text = (button[1] ?? '')
        .replace(/\{\{[\s\S]*?\}\}/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (text) labels.push(text)
    }

    columns.push({ width: Number(widthMatch[1]), labels })
  }

  return columns
}

describe('admin action column layout', () => {
  it('cancels the Element Plus sibling button margin so gap alone controls spacing', () => {
    // EP 默认 .el-button + .el-button { margin-left: 12px }，与 .admin-action-inline 的
    // gap 叠加后间距变成 20px，固定列宽下会向左溢出并被 .el-table .cell 的
    // overflow: hidden 裁掉，导致最左侧按钮点不到。
    const styles = read('src/styles/admin.css')
    expect(styles).toMatch(
      /\.admin-action-inline\s+\.el-button\s*\+\s*\.el-button\s*\{[^}]*margin-left:\s*0/,
    )
  })

  it('gives every .admin-action-inline operation column enough width for its buttons', () => {
    for (const page of ADMIN_PAGES) {
      const source = read(`src/views/admin/${page}.vue`)
      const columns = parseActionColumns(source)

      for (const column of columns) {
        if (column.labels.length === 0) continue

        const gap = 8
        const horizontalPadding = 24 // .el-table .cell 的左右各 12px
        const required =
          column.labels.reduce((sum, label) => sum + estimateButtonWidth(label), 0) +
          gap * (column.labels.length - 1) +
          horizontalPadding

        // 断言对象本身携带上下文，失败时能直接看出是哪一页、差多少
        expect({
          page,
          buttons: column.labels.join('/'),
          width: column.width,
          required,
          enough: column.width >= required,
        }).toMatchObject({ enough: true })
      }
    }
  })

  it('parses the IP page operation column with its four actions', () => {
    const columns = parseActionColumns(
      read('src/views/admin/AdminIPCharacterManagement.vue'),
    )
    expect(columns).toHaveLength(1)
    expect(columns[0]?.labels).toEqual(['详情', '编辑', 'BGM 同步', '删除'])
  })

  it('keeps headroom on the IP operation column instead of sitting on the edge', () => {
    // 去掉重复 margin 后，4 个按钮实测需要 219.78px。声明 220 只剩 0.22px 余量，
    // 字体渲染或 EP 版本微调就会再次溢出，所以要求至少留 20px 余量。
    const columns = parseActionColumns(
      read('src/views/admin/AdminIPCharacterManagement.vue'),
    )
    const column = columns[0]
    expect(column).toBeDefined()
    if (!column) return
    const required =
      column.labels.reduce((sum, label) => sum + estimateButtonWidth(label), 0) +
      8 * (column.labels.length - 1) +
      24
    // 断言对象带上下文，失败时能直接看到宽度与需求
    expect({
      page: 'AdminIPCharacterManagement',
      width: column.width,
      required,
      enoughHeadroom: column.width - required >= 20,
    }).toMatchObject({ enoughHeadroom: true })
  })
})

describe('IP detail drawer', () => {
  const source = read('src/views/admin/AdminIPCharacterManagement.vue')

  it('loads the detail and character list in parallel instead of serially', () => {
    expect(source).toContain('Promise.all([')
    expect(source).toContain('getIPDetail(row.id),')
    expect(source).toContain('getIPCharacters(row.id),')
  })

  it('opens the drawer immediately with a loading state', () => {
    // 抽屉必须在请求前打开，否则长列表 IP 点击后长时间无反馈
    const fn = source.slice(source.indexOf('async function openIPDetail'))
    const drawerOpen = fn.indexOf('ipDetailVisible.value = true')
    const firstAwait = fn.indexOf('await')
    expect(drawerOpen).toBeGreaterThan(-1)
    expect(firstAwait).toBeGreaterThan(-1)
    expect(drawerOpen).toBeLessThan(firstAwait)
    expect(source).toContain('v-loading="ipDetailLoading"')
  })

  it('renders a retryable error state instead of failing silently', () => {
    expect(source).toContain('ipDetailError')
    expect(source).toContain(':title="ipDetailError"')
    expect(source).toContain("ipDetailError.value = 'IP 详情加载失败，请稍后重试。'")
  })

  it('types the character list as Character rather than asserting the admin list type', () => {
    // /api/ips/{id}/characters/ 返回 CharacterSimpleSerializer，没有 created_at
    expect(source).toContain('const ipCharacters = ref<Character[]>([])')
    expect(source).not.toContain('as AdminCharacterListItem[]')
  })
})
