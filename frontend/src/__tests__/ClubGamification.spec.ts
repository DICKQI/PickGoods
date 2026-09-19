import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  resolve(process.cwd(), 'src/views/club/ClubGamification.vue'),
  'utf8',
)
const publicSource = readFileSync(
  resolve(process.cwd(), 'src/views/ClubDetail.vue'),
  'utf8',
)
const workspaceSource = readFileSync(
  resolve(process.cwd(), 'src/views/club/ClubWorkspace.vue'),
  'utf8',
)
const routerSource = readFileSync(
  resolve(process.cwd(), 'src/router/index.ts'),
  'utf8',
)
const apiSource = readFileSync(
  resolve(process.cwd(), 'src/api/clubGamification.ts'),
  'utf8',
)

describe('社团成就与奖励', () => {
  it('提供独立社团管理路由与工作区入口', () => {
    expect(routerSource).toContain("path: 'gamification'")
    expect(routerSource).toContain("name: 'ClubGamification'")
    expect(workspaceSource).toContain("to: '/club/gamification'")
    expect(workspaceSource).toContain("label: '成就奖励'")
  })

  it('社团管理页只配置自家商品指标并支持素材与预设', () => {
    expect(pageSource).toContain("'CLUB_GOODS_QUANTITY'")
    expect(pageSource).toContain("'CLUB_SPEND_AMOUNT'")
    expect(pageSource).toContain('catalog_item_ids')
    expect(pageSource).toContain('uploadClubGamificationRewardAsset')
    expect(pageSource).toContain('presetOptionsByType')
  })

  it('公开社团页加载活动并可在有进度时领取', () => {
    expect(publicSource).toContain('getClubGamification')
    expect(publicSource).toContain('claimClubAchievement')
    expect(publicSource).toContain('achievement.can_claim')
    expect(publicSource).toContain('社团成就')
  })

  it('管理 API 全部限定在 clubs/me 路径', () => {
    expect(apiSource).toContain("'/api/clubs/me/gamification/sets/'")
    expect(apiSource).toContain("'/api/clubs/me/gamification/achievements/'")
    expect(apiSource).toContain("'/api/clubs/me/gamification/rewards/'")
  })
})
