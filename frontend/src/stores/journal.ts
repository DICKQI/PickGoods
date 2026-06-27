import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createJournalBook,
  createJournalPage,
  deleteJournalBook,
  deleteJournalPage,
  getJournalBooks,
  getJournalPages,
  getJournalPageVersions,
  patchJournalPage,
  restoreJournalPageVersion,
  deleteJournalPageVersion,
  uploadJournalPagePreview,
} from '@/api/journal'
import type { JournalBook, JournalPage, JournalPageContent, JournalPageVersion } from '@/api/types'

const emptyContent = (): JournalPageContent => ({ version: 1, layers: [] })

export const useJournalStore = defineStore('journal', () => {
  const books = ref<JournalBook[]>([])
  const pages = ref<JournalPage[]>([])
  const activeBookId = ref<string | null>(null)
  const activePageId = ref<string | null>(null)
  const loading = ref(false)
  const pageLoading = ref(false)
  const saving = ref(false)
  const dirty = ref(false)
  const error = ref<string | null>(null)
  const versions = ref<JournalPageVersion[]>([])
  const versionLoading = ref(false)

  const activeBook = computed(() => books.value.find(book => book.id === activeBookId.value) || null)
  const activePage = computed(() => pages.value.find(page => page.id === activePageId.value) || null)

  const setActiveBook = async (bookId: string) => {
    if (dirty.value) {
      await saveActivePage()
    }
    activeBookId.value = bookId
    await fetchPages(bookId)
  }

  const setActivePage = async (pageId: string) => {
    if (activePageId.value === pageId) return
    if (dirty.value) {
      await saveActivePage()
    }
    activePageId.value = pageId
    dirty.value = false
    await fetchVersions(pageId)
  }

  const fetchBooks = async () => {
    if (loading.value) return
    loading.value = true
    error.value = null
    try {
      const data = await getJournalBooks({ page: 1, page_size: 100 })
      books.value = data.results || []
      if (books.value.length > 0) {
        const nextBook = activeBookId.value && books.value.some(book => book.id === activeBookId.value)
          ? activeBookId.value
          : books.value[0]!.id
        await setActiveBook(nextBook)
      } else {
        activeBookId.value = null
        activePageId.value = null
        pages.value = []
        versions.value = []
      }
    } catch (e: any) {
      error.value = e?.message || '加载手帐失败'
      books.value = []
      pages.value = []
      versions.value = []
    } finally {
      loading.value = false
    }
  }

  const fetchPages = async (bookId = activeBookId.value) => {
    if (!bookId) return
    pageLoading.value = true
    error.value = null
    try {
      const data = await getJournalPages(bookId)
      pages.value = data
      activePageId.value = data[0]?.id || null
      dirty.value = false
      if (activePageId.value) {
        await fetchVersions(activePageId.value)
      } else {
        versions.value = []
      }
    } catch (e: any) {
      error.value = e?.message || '加载手帐页面失败'
      pages.value = []
      activePageId.value = null
      versions.value = []
    } finally {
      pageLoading.value = false
    }
  }

  const fetchVersions = async (pageId = activePageId.value) => {
    if (!pageId) {
      versions.value = []
      return
    }
    versionLoading.value = true
    error.value = null
    try {
      const data = await getJournalPageVersions(pageId)
      versions.value = data.results || []
    } catch (e: any) {
      error.value = e?.message || '加载版本历史失败'
      versions.value = []
    } finally {
      versionLoading.value = false
    }
  }

  const createBook = async (title: string, description = '') => {
    saving.value = true
    error.value = null
    try {
      const created = await createJournalBook({ title, description })
      books.value = [created, ...books.value.filter(book => book.id !== created.id)]
      activeBookId.value = created.id
      await fetchPages(created.id)
      return created
    } catch (e: any) {
      error.value = e?.message || '创建手帐失败'
      return null
    } finally {
      saving.value = false
    }
  }

  const removeBook = async (bookId: string) => {
    saving.value = true
    error.value = null
    try {
      await deleteJournalBook(bookId)
      books.value = books.value.filter(book => book.id !== bookId)
      if (activeBookId.value === bookId) {
        activeBookId.value = books.value[0]?.id || null
        if (activeBookId.value) {
          await fetchPages(activeBookId.value)
        } else {
          pages.value = []
          activePageId.value = null
          versions.value = []
        }
      }
      return true
    } catch (e: any) {
      error.value = e?.message || '删除手帐失败'
      return false
    } finally {
      saving.value = false
    }
  }

  const createPage = async () => {
    if (!activeBookId.value) return null
    saving.value = true
    error.value = null
    try {
      const page = await createJournalPage(activeBookId.value, { content: emptyContent() })
      pages.value = [...pages.value, page]
      activePageId.value = page.id
      dirty.value = false
      await fetchVersions(page.id)
      return page
    } catch (e: any) {
      error.value = e?.message || '创建页面失败'
      return null
    } finally {
      saving.value = false
    }
  }

  const removePage = async (pageId: string) => {
    if (pages.value.length <= 1) return false
    saving.value = true
    error.value = null
    try {
      await deleteJournalPage(pageId)
      pages.value = pages.value.filter(page => page.id !== pageId)
      if (activePageId.value === pageId) {
        activePageId.value = pages.value[0]?.id || null
        if (activePageId.value) {
          await fetchVersions(activePageId.value)
        } else {
          versions.value = []
        }
      }
      dirty.value = false
      return true
    } catch (e: any) {
      error.value = e?.message || '删除页面失败'
      return false
    } finally {
      saving.value = false
    }
  }

  const updateActivePageContent = (content: JournalPageContent) => {
    if (!activePageId.value) return
    pages.value = pages.value.map(page => (
      page.id === activePageId.value ? { ...page, content } : page
    ))
    dirty.value = true
  }

  const saveActivePage = async () => {
    const page = activePage.value
    if (!page) return null
    saving.value = true
    error.value = null
    try {
      const saved = await patchJournalPage(page.id, { content: page.content })
      pages.value = pages.value.map(item => (item.id === saved.id ? saved : item))
      dirty.value = false
      await fetchVersions(saved.id)
      return saved
    } catch (e: any) {
      error.value = e?.message || '保存页面失败'
      return null
    } finally {
      saving.value = false
    }
  }

  const uploadPreview = async (file: File) => {
    if (!activePageId.value) return null
    const saved = await uploadJournalPagePreview(activePageId.value, file)
    pages.value = pages.value.map(page => (page.id === saved.id ? saved : page))
    return saved
  }

  const restoreVersion = async (versionId: string) => {
    saving.value = true
    error.value = null
    try {
      const restored = await restoreJournalPageVersion(versionId)
      pages.value = pages.value.map(page => (page.id === restored.id ? restored : page))
      activePageId.value = restored.id
      dirty.value = false
      await fetchVersions(restored.id)
      return restored
    } catch (e: any) {
      error.value = e?.message || '恢复版本失败'
      return null
    } finally {
      saving.value = false
    }
  }

  const deleteVersion = async (versionId: string) => {
    saving.value = true
    error.value = null
    try {
      await deleteJournalPageVersion(versionId)
      versions.value = versions.value.filter(version => version.id !== versionId)
      return true
    } catch (e: any) {
      error.value = e?.message || '删除版本失败'
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    books,
    pages,
    activeBookId,
    activePageId,
    loading,
    pageLoading,
    saving,
    dirty,
    error,
    versions,
    versionLoading,
    activeBook,
    activePage,
    fetchBooks,
    fetchPages,
    fetchVersions,
    setActiveBook,
    setActivePage,
    createBook,
    removeBook,
    createPage,
    removePage,
    updateActivePageContent,
    saveActivePage,
    uploadPreview,
    restoreVersion,
    deleteVersion,
  }
})
