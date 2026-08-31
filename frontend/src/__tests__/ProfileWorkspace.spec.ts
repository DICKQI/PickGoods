import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(resolve(process.cwd(), 'src/views/ProfileWorkspace.vue'), 'utf8')
const accountSource = readFileSync(resolve(process.cwd(), 'src/views/profile/ProfileAccount.vue'), 'utf8')
const clubsSource = readFileSync(resolve(process.cwd(), 'src/views/profile/ProfileClubs.vue'), 'utf8')

describe('个人中心', () => {
  it('提供账号信息和收藏社团两个入口，并隐藏社团账号专属收藏入口', () => {
    expect(workspaceSource).toContain('to="/profile/account"')
    expect(workspaceSource).toContain('v-if="!authStore.isClub"')
    expect(workspaceSource).toContain('to="/profile/clubs"')
  })

  it('账号页承载刷新、管理员后台和退出登录操作', () => {
    expect(accountSource).toContain('authStore.fetchCurrentUser()')
    expect(accountSource).toContain('authStore.isAdmin')
    expect(accountSource).toContain('authStore.logout()')
  })

  it('收藏列表展示人数和时间，并支持取消收藏及空状态', () => {
    expect(clubsSource).toContain('getMyFavoriteClubs')
    expect(clubsSource).toContain('unfavoriteClub')
    expect(clubsSource).toContain('favorite_count')
    expect(clubsSource).toContain('favorited_at')
    expect(clubsSource).toContain('还没有收藏社团')
  })
})
