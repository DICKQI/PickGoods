import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf-8')

describe('admin console refactor contracts', () => {
  it('registers the overview, audit log, and nested goods editor routes', () => {
    const router = read('src/router/index.ts')
    expect(router).toContain("redirect: '/admin/overview'")
    expect(router).toContain("path: 'overview'")
    expect(router).toContain("path: 'audit-logs'")
    expect(router).toContain("path: 'goods/new'")
    expect(router).toContain("path: 'goods/:id/edit'")
  })

  it('uses grouped navigation and a desktop-first admin shell', () => {
    const shell = read('src/views/admin/AdminDashboard.vue')
    expect(shell).toContain("title: '工作台'")
    expect(shell).toContain("title: '用户与内容'")
    expect(shell).toContain("title: '运维与激励'")
    expect(shell).toContain('--admin-sidebar-width: 224px')
    expect(shell).toContain('@media (max-width: 900px)')
  })

  it('connects list pages to server-side filters, pagination, bulk, and export APIs', () => {
    const users = read('src/views/admin/UserManagement.vue')
    const goods = read('src/views/admin/GoodsManagement.vue')
    const crafts = read('src/views/admin/GoodsCraftManagement.vue')
    expect(users).toContain('getAdminUsers(requestParams.value)')
    expect(users).toContain('bulkAdminUsers')
    expect(users).toContain("exportAdminResource('users'")
    expect(goods).toContain('getAdminGoods(requestParams.value)')
    expect(goods).toContain('bulkAdminGoods')
    expect(goods).toContain("exportAdminResource('goods'")
    expect(crafts).toContain('bulkAdminGoodsCrafts')
    expect(crafts).toContain("exportAdminResource('goods-crafts'")
  })

  it('provides a typed gamification rule builder instead of raw JSON input', () => {
    const source = read('src/views/admin/AdminGamification.vue')
    expect(source).toContain('condition.filters.ip_ids')
    expect(source).toContain('condition.filters.character_ids')
    expect(source).toContain('condition.filters.category_ids')
    expect(source).toContain('condition.filters.is_official')
    expect(source).not.toContain('condition.filtersText')
    expect(source).toContain('bulkAdminGamificationAchievements')
  })

  it('keeps ownership read-only after creation and exposes an optional create owner', () => {
    const goods = read('src/views/GoodsForm.vue')
    const themes = read('src/views/admin/AdminThemeManagement.vue')

    expect(goods).toContain('showAdminOwnerSelect')
    expect(goods).toContain('submitData.user_id = adminOwnerId.value')
    expect(themes).toContain(':disabled="Boolean(form.id)"')
    expect(themes).toContain('if (!form.id) payload.user_id = form.user_id')
  })

  it('consumes admin tab deep links and applies runtime drawer selectors', () => {
    const ipCharacters = read('src/views/admin/AdminIPCharacterManagement.vue')
    const gamification = read('src/views/admin/AdminGamification.vue')
    const styles = read('src/styles/admin.css')

    expect(ipCharacters).toContain("route.query.tab === 'characters'")
    expect(gamification).toContain('route.query.tab')
    expect(styles).toContain('.admin-detail-drawer .el-drawer__body')
    expect(styles).not.toContain(':global(.admin-detail-drawer')
  })
})
