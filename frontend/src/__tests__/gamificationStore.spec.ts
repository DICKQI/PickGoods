import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGamificationStore } from '@/stores/gamification'
import type { GamificationOverview, GamificationReward, GamificationSummary } from '@/api/types'

vi.mock('@/api/gamification', () => ({
  getGamificationSummary: vi.fn(),
  getGamificationOverview: vi.fn(),
  getGamificationRewards: vi.fn(),
  claimGamificationAchievement: vi.fn(),
  updateGamificationEquipment: vi.fn(),
  updatePublicBadges: vi.fn(),
  markGamificationSeen: vi.fn(),
}))

import {
  claimGamificationAchievement,
  getGamificationOverview,
  getGamificationRewards,
  getGamificationSummary,
  markGamificationSeen,
  updateGamificationEquipment,
  updatePublicBadges,
} from '@/api/gamification'

const reward: GamificationReward = {
  id: 1,
  code: 'profile-frame-star-orbit',
  name: '星轨',
  description: '',
  reward_type: 'PROFILE_FRAME',
  rarity: 'epic',
  preset_key: 'star-orbit',
  order: 10,
  owned: true,
}

const summary = (overrides: Partial<GamificationSummary> = {}): GamificationSummary => ({
  enabled: true,
  metrics: {
    goods_quantity: 1,
    valid_altars: 1,
    spend_amount: 100,
    distinct_ip_count: 1,
    distinct_character_count: 1,
  },
  unseen_count: 1,
  recent_unlocked: null,
  equipment: [{ id: 1, slot: 'PROFILE_FRAME', reward, equipped_at: '2026-01-01T00:00:00Z' }],
  public_badge_ids: [],
  ...overrides,
})

const overview: GamificationOverview = {
  enabled: true,
  metrics: summary().metrics,
  achievements: [],
}

describe('useGamificationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads summary, overview and reward entitlements', async () => {
    vi.mocked(getGamificationSummary).mockResolvedValue(summary())
    vi.mocked(getGamificationOverview).mockResolvedValue(overview)
    vi.mocked(getGamificationRewards).mockResolvedValue({ results: [reward] })
    const store = useGamificationStore()

    await Promise.all([store.loadSummary(true), store.loadOverview(true), store.loadRewards(true)])

    expect(store.enabled).toBe(true)
    expect(store.ownedRewards.map(item => item.id)).toEqual([1])
    expect(store.equipped('PROFILE_FRAME')?.id).toBe(1)
  })

  it('keeps owned rewards available after they are disabled', async () => {
    vi.mocked(getGamificationRewards).mockResolvedValue({
      results: [{ ...reward, is_active: false }],
    })
    const store = useGamificationStore()

    await store.loadRewards(true)

    expect(store.ownedRewards.map(item => item.id)).toEqual([1])
  })

  it('refreshes all user state after claiming an achievement', async () => {
    vi.mocked(claimGamificationAchievement).mockResolvedValue({
      achievement: {} as never,
      rewards: [],
    })
    vi.mocked(getGamificationSummary).mockResolvedValue(summary({ unseen_count: 0 }))
    vi.mocked(getGamificationOverview).mockResolvedValue(overview)
    vi.mocked(getGamificationRewards).mockResolvedValue({ results: [reward] })
    const store = useGamificationStore()

    await store.claim(9)

    expect(claimGamificationAchievement).toHaveBeenCalledWith(9)
    expect(getGamificationSummary).toHaveBeenCalled()
    expect(getGamificationOverview).toHaveBeenCalled()
    expect(getGamificationRewards).toHaveBeenCalled()
  })

  it('updates equipment and public badges without dropping local ownership', async () => {
    vi.mocked(updateGamificationEquipment).mockResolvedValue({ equipment: null })
    vi.mocked(updatePublicBadges).mockResolvedValue({ results: [] })
    vi.mocked(getGamificationSummary).mockResolvedValue(summary({ public_badge_ids: [1] }))
    vi.mocked(getGamificationRewards).mockResolvedValue({ results: [reward] })
    const store = useGamificationStore()

    await store.equip('PROFILE_FRAME', 1)
    await store.setPublicBadges([1])

    expect(updateGamificationEquipment).toHaveBeenCalledWith('PROFILE_FRAME', 1)
    expect(updatePublicBadges).toHaveBeenCalledWith([1])
    expect(store.summary.public_badge_ids).toEqual([1])
  })

  it('marks unseen unlocks as read', async () => {
    vi.mocked(getGamificationSummary).mockResolvedValue(summary())
    vi.mocked(markGamificationSeen).mockResolvedValue({ updated: 1 })
    const store = useGamificationStore()
    await store.loadSummary(true)

    await store.markSeen()

    expect(markGamificationSeen).toHaveBeenCalledOnce()
    expect(store.summary.unseen_count).toBe(0)
  })

  it('waits for an in-flight load before applying a forced refresh', async () => {
    let resolveFirst!: (value: GamificationSummary) => void
    vi.mocked(getGamificationSummary)
      .mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
      .mockResolvedValueOnce(summary({ unseen_count: 2 }))
    const store = useGamificationStore()

    const first = store.loadSummary(true)
    const forced = store.loadSummary(true)
    resolveFirst(summary({ unseen_count: 1 }))
    await Promise.all([first, forced])

    expect(getGamificationSummary).toHaveBeenCalledTimes(2)
    expect(store.summary.unseen_count).toBe(2)
  })
})
