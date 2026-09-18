import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const achievementsSource = readFileSync(
  resolve(process.cwd(), 'src/views/profile/ProfileAchievements.vue'),
  'utf8',
)
const rewardsSource = readFileSync(resolve(process.cwd(), 'src/views/profile/ProfileRewards.vue'), 'utf8')
const adminSource = readFileSync(resolve(process.cwd(), 'src/views/admin/AdminGamification.vue'), 'utf8')
const journalPickerSource = readFileSync(
  resolve(process.cwd(), 'src/components/journal/JournalGoodsPicker.vue'),
  'utf8',
)

describe('游戏化页面', () => {
  it('成就页展示条件、复合进度和最多三枚公开徽章', () => {
    expect(achievementsSource).toContain('group.conditions')
    expect(achievementsSource).toContain('progress_percent')
    expect(achievementsSource).toContain('draftBadgeIds.length >= 3')
    expect(achievementsSource).toContain('store.setPublicBadges')
  })

  it('装扮库按奖励类型展示并支持装备与取消装备', () => {
    expect(rewardsSource).toContain("key: 'PROFILE_FRAME'")
    expect(rewardsSource).toContain('toggleEquip(reward)')
    expect(rewardsSource).toContain("JOURNAL_STICKER_PACK: '可在手帐素材中使用'")
  })

  it('管理员页面覆盖系列、规则、奖励素材和用户进度', () => {
    expect(adminSource).toContain('label="成就与活动"')
    expect(adminSource).toContain('addRuleGroup')
    expect(adminSource).toContain('triggerAssetUpload')
    expect(adminSource).toContain('label="用户进度"')
  })

  it('手帐贴纸选择器仅把已领取奖励转换为素材', () => {
    expect(journalPickerSource).toContain('gamificationStore?.ownedRewards')
    expect(journalPickerSource).toContain("reward.reward_type === 'JOURNAL_STICKER_PACK'")
    expect(journalPickerSource).toContain('allDecorStickers')
  })
})
