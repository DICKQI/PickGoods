import request from '@/utils/request'
import type {
  AdminGamificationAchievement,
  AdminGamificationAchievementInput,
  AdminGamificationReward,
  AdminGamificationSet,
  ClubGamificationOverview,
  PaginatedResponse,
} from './types'

export function getClubGamification(clubId: number) {
  return request.get<ClubGamificationOverview>(`/api/clubs/${clubId}/gamification/`)
}

export function getClubGamificationSets(params?: {
  page?: number
  page_size?: number
  search?: string
}) {
  return request.get<PaginatedResponse<AdminGamificationSet>>(
    '/api/clubs/me/gamification/sets/',
    { params },
  )
}

export function createClubGamificationSet(data: Partial<AdminGamificationSet>) {
  return request.post<AdminGamificationSet>('/api/clubs/me/gamification/sets/', data)
}

export function updateClubGamificationSet(id: number, data: Partial<AdminGamificationSet>) {
  return request.patch<AdminGamificationSet>(`/api/clubs/me/gamification/sets/${id}/`, data)
}

export function deleteClubGamificationSet(id: number) {
  return request.delete(`/api/clubs/me/gamification/sets/${id}/`)
}

export function getClubGamificationAchievements(params?: {
  page?: number
  page_size?: number
  search?: string
  set?: number
}) {
  return request.get<PaginatedResponse<AdminGamificationAchievement>>(
    '/api/clubs/me/gamification/achievements/',
    { params },
  )
}

export function createClubGamificationAchievement(data: AdminGamificationAchievementInput) {
  return request.post<AdminGamificationAchievement>(
    '/api/clubs/me/gamification/achievements/',
    data,
  )
}

export function updateClubGamificationAchievement(
  id: number,
  data: AdminGamificationAchievementInput,
) {
  return request.patch<AdminGamificationAchievement>(
    `/api/clubs/me/gamification/achievements/${id}/`,
    data,
  )
}

export function deleteClubGamificationAchievement(id: number) {
  return request.delete(`/api/clubs/me/gamification/achievements/${id}/`)
}

export function getClubGamificationRewards(params?: {
  page?: number
  page_size?: number
  search?: string
  reward_type?: string
}) {
  return request.get<PaginatedResponse<AdminGamificationReward>>(
    '/api/clubs/me/gamification/rewards/',
    { params },
  )
}

export function createClubGamificationReward(data: FormData) {
  return request.post<AdminGamificationReward>(
    '/api/clubs/me/gamification/rewards/',
    data,
  )
}

export function updateClubGamificationReward(id: number, data: FormData) {
  return request.patch<AdminGamificationReward>(
    `/api/clubs/me/gamification/rewards/${id}/`,
    data,
  )
}

export function deleteClubGamificationReward(id: number) {
  return request.delete(`/api/clubs/me/gamification/rewards/${id}/`)
}

export function uploadClubGamificationRewardAsset(id: number, data: FormData) {
  return request.post<{ id: number; name: string; image_url: string; order: number }>(
    `/api/clubs/me/gamification/rewards/${id}/assets/`,
    data,
  )
}

export function deleteClubGamificationRewardAsset(rewardId: number, assetId: number) {
  return request.delete(
    `/api/clubs/me/gamification/rewards/${rewardId}/assets/${assetId}/`,
  )
}
