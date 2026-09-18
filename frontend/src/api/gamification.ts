import request from '@/utils/request'
import type {
  AdminGamificationAchievement,
  AdminGamificationAchievementInput,
  AdminGamificationReward,
  AdminGamificationSet,
  AdminGamificationUser,
  GamificationClaimResponse,
  GamificationEquipment,
  GamificationEquipmentSlot,
  GamificationOverview,
  GamificationReward,
  GamificationRewardList,
  GamificationSummary,
  PaginatedResponse,
} from './types'

export function getGamificationSummary() {
  return request.get<GamificationSummary>('/api/gamification/summary/')
}

export function getGamificationOverview() {
  return request.get<GamificationOverview>('/api/gamification/overview/')
}

export function getGamificationRewards() {
  return request.get<GamificationRewardList>('/api/gamification/rewards/')
}

export function claimGamificationAchievement(id: number) {
  return request.post<GamificationClaimResponse>(`/api/gamification/achievements/${id}/claim/`)
}

export function updateGamificationEquipment(slot: GamificationEquipmentSlot, rewardId: number | null) {
  return request.put<{ equipment: GamificationEquipment | null }>('/api/gamification/equipment/', {
    slot,
    reward_id: rewardId,
  })
}

export function updatePublicBadges(rewardIds: number[]) {
  return request.put<{ results: Array<{ id: number; order: number; reward: GamificationReward }> }>(
    '/api/gamification/public-badges/',
    { reward_ids: rewardIds },
  )
}

export function markGamificationSeen() {
  return request.post<{ updated: number }>('/api/gamification/seen/')
}

// ==================== 管理员接口 ====================

export function getAdminGamificationSets(params?: { page?: number; page_size?: number; search?: string }) {
  return request.get<PaginatedResponse<AdminGamificationSet>>('/api/admin/gamification/sets/', { params })
}

export function createAdminGamificationSet(data: Partial<AdminGamificationSet>) {
  return request.post<AdminGamificationSet>('/api/admin/gamification/sets/', data)
}

export function updateAdminGamificationSet(id: number, data: Partial<AdminGamificationSet>) {
  return request.patch<AdminGamificationSet>(`/api/admin/gamification/sets/${id}/`, data)
}

export function deleteAdminGamificationSet(id: number) {
  return request.delete(`/api/admin/gamification/sets/${id}/`)
}

export function getAdminGamificationAchievements(params?: {
  page?: number
  page_size?: number
  search?: string
  set?: number
}) {
  return request.get<PaginatedResponse<AdminGamificationAchievement>>(
    '/api/admin/gamification/achievements/',
    { params },
  )
}

export function createAdminGamificationAchievement(data: AdminGamificationAchievementInput) {
  return request.post<AdminGamificationAchievement>('/api/admin/gamification/achievements/', data)
}

export function updateAdminGamificationAchievement(id: number, data: AdminGamificationAchievementInput) {
  return request.patch<AdminGamificationAchievement>(`/api/admin/gamification/achievements/${id}/`, data)
}

export function deleteAdminGamificationAchievement(id: number) {
  return request.delete(`/api/admin/gamification/achievements/${id}/`)
}

export function getAdminGamificationRewards(params?: {
  page?: number
  page_size?: number
  search?: string
  reward_type?: string
}) {
  return request.get<PaginatedResponse<AdminGamificationReward>>('/api/admin/gamification/rewards/', { params })
}

export function createAdminGamificationReward(data: FormData) {
  return request.post<AdminGamificationReward>('/api/admin/gamification/rewards/', data)
}

export function updateAdminGamificationReward(id: number, data: FormData) {
  return request.patch<AdminGamificationReward>(`/api/admin/gamification/rewards/${id}/`, data)
}

export function deleteAdminGamificationReward(id: number) {
  return request.delete(`/api/admin/gamification/rewards/${id}/`)
}

export function uploadAdminGamificationRewardAsset(id: number, data: FormData) {
  return request.post<{ id: number; name: string; image_url: string; order: number }>(
    `/api/admin/gamification/rewards/${id}/assets/`,
    data,
  )
}

export function deleteAdminGamificationRewardAsset(rewardId: number, assetId: number) {
  return request.delete(`/api/admin/gamification/rewards/${rewardId}/assets/${assetId}/`)
}

export function getAdminGamificationUsers(params?: { page?: number; page_size?: number; search?: string }) {
  return request.get<PaginatedResponse<AdminGamificationUser>>('/api/admin/gamification/users/', { params })
}
