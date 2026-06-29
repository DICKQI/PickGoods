import request from '@/utils/request'
import type {
  JournalBook,
  JournalBookInput,
  JournalPage,
  JournalPageInput,
  JournalPublicShare,
  PaginatedJournalBookResponse,
  PaginatedJournalPageVersionResponse,
} from './types'

export function getJournalBooks(params?: { page?: number; page_size?: number }) {
  return request.get<PaginatedJournalBookResponse>('/api/journals/', { params })
}

export function createJournalBook(data: JournalBookInput) {
  return request.post<JournalBook>('/api/journals/', data)
}

export function patchJournalBook(id: string, data: Partial<JournalBookInput>) {
  return request.patch<JournalBook>(`/api/journals/${id}/`, data)
}

export function uploadJournalBookCover(id: string, file: File) {
  const formData = new FormData()
  formData.append('cover_image', file)
  return request.post<JournalBook>(`/api/journals/${id}/upload-cover/`, formData)
}

export function deleteJournalBook(id: string) {
  return request.delete(`/api/journals/${id}/`)
}

export function getJournalPages(bookId: string, params?: { fields?: 'summary' }) {
  return request.get<JournalPage[]>(`/api/journals/${bookId}/pages/`, { params })
}

export function createJournalPage(bookId: string, data?: JournalPageInput) {
  return request.post<JournalPage>(`/api/journals/${bookId}/pages/`, data || {})
}

export function getJournalPage(id: string) {
  return request.get<JournalPage>(`/api/journal-pages/${id}/`)
}

export function patchJournalPage(id: string, data: JournalPageInput) {
  return request.patch<JournalPage>(`/api/journal-pages/${id}/`, data)
}

export function deleteJournalPage(id: string) {
  return request.delete(`/api/journal-pages/${id}/`)
}

export function createJournalPageDuplicate(id: string) {
  return request.post<JournalPage>(`/api/journal-pages/${id}/duplicate/`)
}

export function reorderJournalPages(bookId: string, pageIds: string[]) {
  return request.post<JournalPage[]>(`/api/journals/${bookId}/pages/reorder/`, { page_ids: pageIds })
}

export function uploadJournalPagePreview(id: string, file: File) {
  const formData = new FormData()
  formData.append('preview_image', file)
  return request.post<JournalPage>(`/api/journal-pages/${id}/upload-preview/`, formData)
}

export function getJournalPageVersions(pageId: string) {
  return request.get<PaginatedJournalPageVersionResponse>(`/api/journal-pages/${pageId}/versions/`)
}

export function getJournalPageVersion(versionId: string) {
  return request.get<PaginatedJournalPageVersionResponse['results'][number]>(
    `/api/journal-page-versions/${versionId}/`,
  )
}

export function restoreJournalPageVersion(versionId: string) {
  return request.post<JournalPage>(`/api/journal-page-versions/${versionId}/restore/`)
}

export function deleteJournalPageVersion(versionId: string) {
  return request.delete(`/api/journal-page-versions/${versionId}/`)
}

export function createJournalPublicShare(pageId: string) {
  return request.post<JournalPublicShare>(`/api/journal-pages/${pageId}/share/`)
}

export function getPublicJournalPage(token: string) {
  return request.get<JournalPage>(`/api/journal-public/${token}/`)
}
