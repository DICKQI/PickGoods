import request from '@/utils/request'
import type {
  Club,
  ClubCatalogInput,
  ClubCatalogItem,
  ClubCatalogPublicItem,
  ClubBatchDeleteResponse,
  ClubBatchUnlistResponse,
  ClubImportTemplate,
  ClubFavoriteItem,
  ClubPopularityItem,
  GoodsCreateResponse,
  GoodsStatus,
  PaginatedResponse,
} from './types'

export function getClubs(params?: { page?: number; page_size?: number; search?: string }) {
  return request.get<PaginatedResponse<Club>>('/api/clubs/', { params })
}

export function getClub(id: number) {
  return request.get<Club>(`/api/clubs/${id}/`)
}

export function favoriteClub(id: number) {
  return request.put<Club>(`/api/clubs/${id}/favorite/`)
}

export function unfavoriteClub(id: number) {
  return request.delete<Club>(`/api/clubs/${id}/favorite/`)
}

export function getMyFavoriteClubs(params?: { page?: number; page_size?: number }) {
  return request.get<PaginatedResponse<ClubFavoriteItem>>('/api/clubs/me/favorites/', { params })
}

export function getClubGoods(id: number, params?: { page?: number; page_size?: number; search?: string }) {
  return request.get<PaginatedResponse<ClubCatalogPublicItem>>(`/api/clubs/${id}/goods/`, { params })
}

export function getClubGoodsDetail(clubId: number, goodsId: string) {
  return request.get<ClubCatalogPublicItem>(`/api/clubs/${clubId}/goods/${goodsId}/`)
}

export function getMyClubGoods(params?: { page?: number; page_size?: number; search?: string }) {
  return request.get<PaginatedResponse<ClubCatalogItem>>('/api/clubs/me/goods/', { params })
}

export function getMyClubGoodsDetail(id: string) {
  return request.get<ClubCatalogItem>(`/api/clubs/me/goods/${id}/`)
}

export function createClubGoods(data: ClubCatalogInput) {
  const payload = { ...data }
  delete (payload as { main_photo?: File | null }).main_photo
  return request.post<ClubCatalogItem>('/api/clubs/me/goods/', payload)
}

export function updateClubGoods(id: string, data: Partial<ClubCatalogInput>) {
  const payload = { ...data }
  delete (payload as { main_photo?: File | null }).main_photo
  return request.patch<ClubCatalogItem>(`/api/clubs/me/goods/${id}/`, payload)
}

export function deleteClubGoods(id: string) {
  return request.delete(`/api/clubs/me/goods/${id}/`)
}

export function batchDeleteClubGoods(goodsIds: string[]) {
  return request.post<ClubBatchDeleteResponse>(
    '/api/clubs/me/goods/batch-delete/',
    { goods_ids: goodsIds },
    { suppressGlobalError: true },
  )
}

export function batchUnlistClubGoods(goodsIds: string[]) {
  return request.post<ClubBatchUnlistResponse>(
    '/api/clubs/me/goods/batch-unlist/',
    { goods_ids: goodsIds },
    { suppressGlobalError: true },
  )
}

export function uploadClubGoodsMainPhoto(id: string, file: File) {
  const form = new FormData()
  form.append('main_photo', file)
  return request.post<ClubCatalogItem>(`/api/clubs/me/goods/${id}/upload-main-photo/`, form)
}

export function uploadClubGoodsAdditionalPhotos(id: string, files: File[]) {
  const form = new FormData()
  files.forEach(file => form.append('additional_photos', file))
  return request.post<ClubCatalogItem>(`/api/clubs/me/goods/${id}/upload-additional-photos/`, form)
}

export function deleteClubGoodsAdditionalPhoto(id: string, photoId: number) {
  return request.delete<ClubCatalogItem>(`/api/clubs/me/goods/${id}/additional-photos/${photoId}/`)
}

export function getClubGoodsImportTemplate(clubId: number, goodsId: string) {
  return request.get<ClubImportTemplate>(`/api/clubs/${clubId}/goods/${goodsId}/import-template/`)
}

export interface ClubImportPayload {
  status: GoodsStatus
  quantity?: number
  confirm_duplicate?: boolean
  name?: string
  ip_id?: number
  category_id?: number
  character_ids?: number[]
  theme_id?: number | null
  price?: string | null
  purchase_date?: string | null
  notes?: string | null
  is_official?: boolean
}

export function importClubGoods(goodsId: string, data: ClubImportPayload) {
  return request.post<GoodsCreateResponse>(`/api/clubs/goods/${goodsId}/import/`, data, { suppressGlobalError: true })
}

export function getMyClub() {
  return request.get<Club>('/api/clubs/me/')
}

export function updateMyClub(data: Partial<Omit<Club, 'id' | 'avatar' | 'goods_count' | 'created_at' | 'updated_at'>>) {
  return request.patch<Club>('/api/clubs/me/', data)
}

export function uploadMyClubAvatar(file: File) {
  const form = new FormData()
  form.append('avatar', file)
  return request.post<Club>('/api/clubs/me/avatar/', form)
}

export function getMyClubPopularity() {
  return request.get<ClubPopularityItem[]>('/api/clubs/me/popularity/')
}
