import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/Layout.vue'), 'utf8')
const workspaceSource = readFileSync(resolve(process.cwd(), 'src/views/OrganizeWorkspace.vue'), 'utf8')

describe('organize floating button host', () => {
  it('renders the organize AddFab outside <main> so no page transition can capture it', () => {
    // fixed 元素一旦落在带 transform 的过渡祖先里，就会被当成该祖先前后的包含块
    expect(layoutSource).toContain('<AddFab')
    expect(layoutSource.indexOf('<AddFab')).toBeGreaterThan(layoutSource.indexOf('</main>'))
    expect(layoutSource).toContain('v-if="showOrganizeFab && activeOrganizeFab"')
    expect(layoutSource).toContain('v-bind="activeOrganizeFab.props"')
    expect(layoutSource).toContain('v-on="activeOrganizeFab.handlers"')
  })

  it('provides the registration seam only while the organize route is active', () => {
    expect(layoutSource).toContain('createOrganizeFabRegistry')
    expect(layoutSource).toContain('provide(ORGANIZE_FAB_KEY, organizeFabRegistry)')
    expect(layoutSource).toContain("enabled: () => route.path.startsWith('/organize')")
    expect(layoutSource).toContain('const showOrganizeFab = computed(() => !isMobile.value && route.path.startsWith(\'/organize\'))')
    // 分栏跟随 URL 的 ?tab，和 OrganizeWorkspace 用同一套归一化逻辑
    expect(layoutSource).toContain('organizeFabSlotFor(() => normalizeOrganizeTab(route.query.tab))')
  })

  it('keeps the section panels free of their own floating buttons', () => {
    expect(workspaceSource).not.toContain('<AddFab')
    expect(workspaceSource).not.toContain('position: fixed')
  })
})
