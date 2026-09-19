import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import {
  claimGamificationAchievement,
  getGamificationOverview,
  getGamificationRewards,
  getGamificationSummary,
  markGamificationSeen,
  updateGamificationEquipment,
  updatePublicBadges,
} from '@/api/gamification'
import type {
  GamificationEquipmentSlot,
  GamificationOverview,
  GamificationReward,
  GamificationSummary,
} from '@/api/types'

const emptySummary = (): GamificationSummary => ({
  enabled: false,
  metrics: {
    goods_quantity: 0,
    valid_altars: 0,
    spend_amount: 0,
    distinct_ip_count: 0,
    distinct_character_count: 0,
  },
  unseen_count: 0,
  recent_unlocked: null,
  equipment: [],
  public_badge_ids: [],
})

const emptyOverview = (): GamificationOverview => ({
  enabled: false,
  metrics: emptySummary().metrics,
  achievements: [],
})

export const useGamificationStore = defineStore('gamification', () => {
  const summary = ref<GamificationSummary>(emptySummary())
  const overview = ref<GamificationOverview>(emptyOverview())
  const rewards = ref<GamificationReward[]>([])
  const loading = ref(false)
  const overviewLoading = ref(false)
  const rewardsLoading = ref(false)
  const summaryLoaded = ref(false)
  const overviewLoaded = ref(false)
  const rewardsLoaded = ref(false)
  let summaryInFlight: Promise<GamificationSummary> | null = null
  let overviewInFlight: Promise<GamificationOverview> | null = null
  let rewardsInFlight: Promise<GamificationReward[]> | null = null

  const enabled = computed(() => summary.value.enabled)
  const ownedRewards = computed(() => rewards.value.filter(
    item => item.owned,
  ))

  function equipped(slot: GamificationEquipmentSlot) {
    return summary.value.equipment.find(item => item.slot === slot)?.reward || null
  }

  async function loadSummary(force = false) {
    if (summaryInFlight) {
      if (!force) return summaryInFlight
      await summaryInFlight
    }
    if (!force && summaryLoaded.value) return summary.value
    loading.value = true
    summaryInFlight = (async () => {
      try {
        summary.value = await getGamificationSummary()
        summaryLoaded.value = true
      } catch {
        // Keep the latest known state on transient failures.
      }
      return summary.value
    })().finally(() => {
      loading.value = false
      summaryInFlight = null
    })
    return summaryInFlight
  }

  async function loadOverview(force = false) {
    if (overviewInFlight) {
      if (!force) return overviewInFlight
      await overviewInFlight
    }
    if (!force && overviewLoaded.value) return overview.value
    overviewLoading.value = true
    overviewInFlight = (async () => {
      try {
        overview.value = await getGamificationOverview()
        overviewLoaded.value = true
      } catch {
        // Keep the latest known state on transient failures.
      }
      return overview.value
    })().finally(() => {
      overviewLoading.value = false
      overviewInFlight = null
    })
    return overviewInFlight
  }

  async function loadRewards(force = false) {
    if (rewardsInFlight) {
      if (!force) return rewardsInFlight
      await rewardsInFlight
    }
    if (!force && rewardsLoaded.value) return rewards.value
    rewardsLoading.value = true
    rewardsInFlight = (async () => {
      try {
        rewards.value = (await getGamificationRewards()).results
        rewardsLoaded.value = true
      } catch {
        // Keep the latest known state on transient failures.
      }
      return rewards.value
    })().finally(() => {
      rewardsLoading.value = false
      rewardsInFlight = null
    })
    return rewardsInFlight
  }

  async function claim(achievementId: number) {
    const result = await claimGamificationAchievement(achievementId)
    await Promise.all([loadOverview(true), loadSummary(true), loadRewards(true)])
    return result
  }

  async function equip(slot: GamificationEquipmentSlot, rewardId: number | null) {
    await updateGamificationEquipment(slot, rewardId)
    await Promise.all([loadSummary(true), loadRewards(true)])
  }

  async function setPublicBadges(ids: number[]) {
    await updatePublicBadges(ids)
    await loadSummary(true)
  }

  async function markSeen() {
    if (!summary.value.unseen_count) return
    await markGamificationSeen()
    summary.value = { ...summary.value, unseen_count: 0 }
  }

  async function refreshAfterMutation() {
    const previousUnseen = summaryLoaded.value ? summary.value.unseen_count : 0
    const next = await loadSummary(true)
    if (next.unseen_count > previousUnseen && next.recent_unlocked) {
      ElMessage.success(`新成就解锁：${next.recent_unlocked.name}`)
    }
    return next
  }

  return {
    summary,
    overview,
    rewards,
    loading,
    overviewLoading,
    rewardsLoading,
    enabled,
    ownedRewards,
    equipped,
    loadSummary,
    loadOverview,
    loadRewards,
    claim,
    equip,
    setPublicBadges,
    markSeen,
    refreshAfterMutation,
  }
})
