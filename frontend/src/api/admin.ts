import request from '@/utils/request'
import type {
  PaginatedResponse,
  AdminAuditLog,
  AdminBulkActionResponse,
  AdminCharacterListItem,
  AdminExportResource,
  AdminGoodsListItem,
  AdminIPListItem,
  AdminListQuery,
  AdminOverviewResponse,
  AdminThemeListItem,
  AdminUser,
  AdminRole,
  GoodsCraft,
  BGMSyncSettings,
  BGMSyncJob,
  BGMSyncJobItem,
} from './types'

// 数据模型类型统一来自 ./types，此处再导出，以便组件从 '@/api/admin' 统一导入，
// 避免在 admin.ts 与 types.ts 两处重复定义同一接口。
export type { AdminUser, AdminRole, GoodsCraft, BGMSyncSettings, BGMSyncJob, BGMSyncJobItem } from './types'

export interface AdminUserListParams extends AdminListQuery {
  role?: number
  account_type?: 'collector' | 'club'
  approval_status?: 'pending' | 'approved'
  is_active?: boolean
  created_at__gte?: string
  created_at__lte?: string
}

// ==================== 用户 / 角色管理 ====================

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

export function approveAdminUser(id: number) {
  return request.post<AdminUser>(`/api/admin/users/${id}/approve/`)
}

export function rejectAdminUser(id: number) {
  return request.post(`/api/admin/users/${id}/reject/`)
}

export function getAdminRoles() {
  return request.get<AdminRole[]>('/api/admin/roles/')
}

export function getAdminOverview(range: '7d' | '30d' = '30d') {
  return request.get<AdminOverviewResponse>('/api/admin/overview/', {
    params: { range },
  })
}

export interface AdminAuditLogListParams extends AdminListQuery {
  actor?: number
  action?: string
  resource_type?: string
  resource_id?: string
  created_at__gte?: string
  created_at__lte?: string
}

export function getAdminAuditLogs(params?: AdminAuditLogListParams) {
  return request.get<PaginatedResponse<AdminAuditLog>>(
    '/api/admin/audit-logs/',
    { params },
  )
}

export function bulkAdminUsers(
  ids: number[],
  action: 'enable' | 'disable' | 'approve',
) {
  return request.post<AdminBulkActionResponse>('/api/admin/users/bulk-action/', {
    ids,
    action,
  })
}

// ==================== 全站数据列表 ====================

export interface AdminGoodsListParams extends AdminListQuery {
  user?: number
  ip?: number
  category?: number
  theme?: number
  character?: number
  status?: string
  is_official?: boolean
  has_main_photo?: boolean
  purchase_date__gte?: string
  purchase_date__lte?: string
  created_at__gte?: string
  created_at__lte?: string
}

export function getAdminGoods(params?: AdminGoodsListParams) {
  return request.get<PaginatedResponse<AdminGoodsListItem>>('/api/admin/goods/', {
    params,
  })
}

export function bulkAdminGoods(
  ids: string[],
  action: 'status' | 'category' | 'theme',
  value: string | number | null,
) {
  const payload: Record<string, unknown> = { ids, action }
  if (action === 'status') payload.status = value
  if (action === 'category') payload.category_id = value
  if (action === 'theme') payload.theme_id = value
  return request.post<AdminBulkActionResponse>(
    '/api/admin/goods/bulk-action/',
    payload,
  )
}

export interface AdminIPListParams extends AdminListQuery {
  subject_type?: number
  subject_type__in?: string
  is_bgm_bound?: boolean
  has_characters?: boolean
  created_at__gte?: string
  created_at__lte?: string
}

export function getAdminIPs(params?: AdminIPListParams) {
  return request.get<PaginatedResponse<AdminIPListItem>>('/api/admin/ips/', {
    params,
  })
}

export interface AdminCharacterListParams extends AdminListQuery {
  ip?: number
  gender?: string
  is_bgm_bound?: boolean
  created_at__gte?: string
  created_at__lte?: string
}

export function getAdminCharacters(params?: AdminCharacterListParams) {
  return request.get<PaginatedResponse<AdminCharacterListItem>>(
    '/api/admin/characters/',
    { params },
  )
}

export interface AdminThemeListParams extends AdminListQuery {
  user?: number
  created_at__gte?: string
  created_at__lte?: string
}

export function getAdminThemes(params?: AdminThemeListParams) {
  return request.get<PaginatedResponse<AdminThemeListItem>>(
    '/api/admin/themes/',
    { params },
  )
}

export interface AdminCategoryListParams extends AdminListQuery {
  parent?: number
  parent__isnull?: boolean
  shape_type?: string
}

export type AdminCategoryListResponse = Array<import('./types').Category>

export function getAdminCategories(params?: AdminCategoryListParams) {
  return request.get<AdminCategoryListResponse>('/api/admin/categories/', {
    params,
  })
}

export function exportAdminResource(
  resource: AdminExportResource,
  params?: AdminListQuery,
) {
  const exportParams = { ...(params || {}) }
  delete exportParams.page
  delete exportParams.page_size
  return request.get<Blob>(`/api/admin/exports/${resource}/`, {
    params: exportParams,
    responseType: 'blob',
  })
}

export interface AdminGoodsCraftListParams {
  page?: number
  page_size?: number
  search?: string
  is_active?: boolean
  ordering?: string
  created_at__gte?: string
  created_at__lte?: string
}

export interface CreateAdminGoodsCraftData {
  name: string
  order?: number
  is_active?: boolean
}

export interface UpdateAdminGoodsCraftData {
  name?: string
  order?: number
  is_active?: boolean
}

export function getAdminGoodsCrafts(params?: AdminGoodsCraftListParams) {
  return request.get<PaginatedResponse<GoodsCraft>>('/api/admin/goods-crafts/', { params })
}

export function createAdminGoodsCraft(data: CreateAdminGoodsCraftData) {
  return request.post<GoodsCraft>('/api/admin/goods-crafts/', data)
}

export function updateAdminGoodsCraft(id: number, data: UpdateAdminGoodsCraftData) {
  return request.patch<GoodsCraft>(`/api/admin/goods-crafts/${id}/`, data)
}

export function deleteAdminGoodsCraft(id: number) {
  return request.delete(`/api/admin/goods-crafts/${id}/`)
}

export function bulkAdminGoodsCrafts(
  ids: number[],
  action: 'enable' | 'disable',
) {
  return request.post<AdminBulkActionResponse>(
    '/api/admin/goods-crafts/bulk-action/',
    { ids, action },
  )
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
