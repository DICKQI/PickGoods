import request from '@/utils/request'
import type {
  NotificationReadResult,
  NotificationUnreadCount,
  PaginatedNotificationResponse,
  PaginatedPreorderResponse,
  Preorder,
  PreorderConvertInput,
  PreorderInput,
  PreorderOcrResult,
  PreorderStats,
  PreorderStatus,
} from './types'

// ==================== 预购（/api/preorders/）====================

// 获取预购统计概览（待补款数、本月到期等，纯读）
export function getPreorderStats() {
  return request.get<PreorderStats>('/api/preorders/stats/')
}

// 获取预购列表
export function listPreorders(params?: {
  page?: number
  page_size?: number
  status?: PreorderStatus
  search?: string
}) {
  return request.get<PaginatedPreorderResponse>('/api/preorders/', { params })
}

// 获取预购详情
export function getPreorder(id: string) {
  return request.get<Preorder>(`/api/preorders/${id}/`)
}

// 创建预购
export function createPreorder(data: PreorderInput) {
  return request.post<Preorder>('/api/preorders/', data)
}

// 更新预购
export function updatePreorder(id: string, data: Partial<PreorderInput>) {
  return request.patch<Preorder>(`/api/preorders/${id}/`, data)
}

// 删除预购
export function deletePreorder(id: string) {
  return request.delete(`/api/preorders/${id}/`)
}

// 标记已补款（不可逆）
export function markPreorderPaid(id: string) {
  return request.post<Preorder>(`/api/preorders/${id}/mark-paid/`)
}

// 取消预购
export function cancelPreorder(id: string) {
  return request.post<Preorder>(`/api/preorders/${id}/cancel/`)
}

// 转正为谷子
export function convertPreorderToGoods(id: string, data: PreorderConvertInput) {
  return request.post<Preorder>(`/api/preorders/${id}/convert-to-goods/`, data)
}

// 上传订单截图，识别定金单并返回预购字段（mode=preorder）
export function recognizePreorderImage(file: File) {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('mode', 'preorder')
  return request.post<PreorderOcrResult>('/api/ocr/recognize/', formData, {
    timeout: 120000,
    suppressGlobalError: true,
  })
}

// ==================== 通知（/api/notifications/）====================

// 获取通知列表（纯读，无副作用）
export function getNotifications(params?: {
  page?: number
  page_size?: number
  unread_only?: 0 | 1
}) {
  return request.get<PaginatedNotificationResponse>('/api/notifications/', { params })
}

// 获取未读数（后端在此接口执行惰性同步）
export function getUnreadCount() {
  return request.get<NotificationUnreadCount>('/api/notifications/unread-count/')
}

// 批量标记已读
export function markNotificationsRead(ids: number[]) {
  return request.post<NotificationReadResult>('/api/notifications/read/', { ids })
}

// 全部已读
export function markAllNotificationsRead() {
  return request.post<NotificationReadResult>('/api/notifications/read-all/')
}

// 通知类型 → 标签文案
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  preorder_soon: '即将补款',
  preorder_due: '已到补款期',
  preorder_cancelled: '已取消补款',
  preorder_converted: '已转正',
}
