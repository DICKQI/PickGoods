import request from '@/utils/request'
import type { PaginatedResponse } from './types'

export interface AdminUser {
  id: number
  username: string
  role: {
    id: number
    name: string
    created_at: string
  }
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AdminRole {
  id: number
  name: string
  created_at: string
}

export interface AdminUserListParams {
  page?: number
  page_size?: number
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

export interface BGMSyncSettings {
  auto_sync_enabled: boolean
  frequency: 'daily' | 'every_3_days' | 'weekly'
  last_run_at: string | null
  next_run_at: string | null
  concurrency_limit: number
  request_interval_ms: number
  updated_at: string
  /** 已绑定 BGM 的 IP 数量（后端 SerializerMethodField 额外返回） */
  bound_ip_count?: number
}

export interface BGMSyncJobItem {
  id: number
  job: number
  ip: number | null
  ip_name_snapshot: string
  bgm_subject_id: number | null
  status: 'success' | 'no_change' | 'skipped_unbound' | 'error'
  created_count: number
  linked_count: number
  subject_type_updated: boolean
  error_message: string | null
  duration_ms: number
  created_at: string
}

export interface BGMSyncJob {
  id: number
  trigger: 'scheduled' | 'manual'
  status: 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled'
  started_at: string
  finished_at: string | null
  /** 后端 serializer 已展平为 username 字符串；未登录触发为 null */
  triggered_by: string | null
  total_ips: number
  success_count: number
  failed_count: number
  skipped_count: number
  created_total: number
  linked_total: number
  error_message: string | null
}

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
