import request from '@/utils/request'
import type {
  PaginatedResponse,
  AdminUser,
  AdminRole,
  BGMSyncSettings,
  BGMSyncJob,
  BGMSyncJobItem,
} from './types'

// 数据模型类型统一来自 ./types，此处再导出，以便组件从 '@/api/admin' 统一导入，
// 避免在 admin.ts 与 types.ts 两处重复定义同一接口。
export type { AdminUser, AdminRole, BGMSyncSettings, BGMSyncJob, BGMSyncJobItem } from './types'

// ==================== 用户 / 角色管理 ====================

export interface AdminUserListParams {
  page?: number
  page_size?: number
  /** 按用户名模糊匹配（后端 SearchFilter，icontains） */
  search?: string
}

export interface CreateAdminUserData {
  username: string
  password: string
  role_id: number
}

export interface UpdateAdminUserData {
  role_id?: number
  is_active?: boolean
  password?: string
}

export function getAdminUsers(params?: AdminUserListParams) {
  return request.get<PaginatedResponse<AdminUser>>('/api/admin/users/', { params })
}

export function getAdminUserDetail(id: number) {
  return request.get<AdminUser>(`/api/admin/users/${id}/`)
}

export function createAdminUser(data: CreateAdminUserData) {
  return request.post<AdminUser>('/api/admin/users/', data)
}

export function updateAdminUser(id: number, data: UpdateAdminUserData) {
  return request.patch<AdminUser>(`/api/admin/users/${id}/`, data)
}

export function getAdminRoles() {
  return request.get<AdminRole[]>('/api/admin/roles/')
}

// ==================== BGM 自动同步 ====================

export interface BGMSyncSettingsUpdate {
  auto_sync_enabled?: boolean
  frequency?: 'daily' | 'every_3_days' | 'weekly'
  request_interval_ms?: number
}

export interface BGMSyncJobListParams {
  page?: number
  page_size?: number
  status?: string
  trigger?: string
  started_at__gte?: string
  started_at__lte?: string
}

export interface BGMSyncJobItemListParams {
  page?: number
  page_size?: number
  status?: string
  ip_name_snapshot?: string
}

// 单例配置：后端为 APIView，路由无 pk 占位，直接挂在 bgm-sync/settings/
export function getBGMSyncSettings() {
  return request.get<BGMSyncSettings>('/api/admin/bgm-sync/settings/')
}

export function updateBGMSyncSettings(data: BGMSyncSettingsUpdate) {
  return request.patch<BGMSyncSettings>(
    '/api/admin/bgm-sync/settings/',
    data,
  )
}

export function runBGMSyncNow() {
  return request.post<BGMSyncJob>('/api/admin/bgm-sync/run-now/')
}

export function listBGMSyncJobs(params?: BGMSyncJobListParams) {
  return request.get<PaginatedResponse<BGMSyncJob>>('/api/admin/bgm-sync/jobs/', { params })
}

export function getBGMSyncJob(id: number) {
  return request.get<BGMSyncJob>(`/api/admin/bgm-sync/jobs/${id}/`)
}

export function listBGMSyncJobItems(jobId: number, params?: BGMSyncJobItemListParams) {
  return request.get<PaginatedResponse<BGMSyncJobItem>>(
    `/api/admin/bgm-sync/jobs/${jobId}/items/`,
    { params },
  )
}
