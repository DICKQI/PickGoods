import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '@/stores/journal'
import type { JournalBook, JournalPage, JournalPageContent, JournalPageVersion } from '@/api/types'

vi.mock('@/api/journal', () => ({
  createJournalBook: vi.fn(),
  getJournalBooks: vi.fn(),
  getJournalPages: vi.fn(),
  getJournalPageVersions: vi.fn(),
  patchJournalPage: vi.fn(),
  restoreJournalPageVersion: vi.fn(),
  deleteJournalPageVersion: vi.fn(),
  deleteJournalBook: vi.fn(),
  uploadJournalPagePreview: vi.fn(),
}))

import {
  createJournalBook,
  getJournalBooks,
  getJournalPages,
  getJournalPageVersions,
  patchJournalPage,
  restoreJournalPageVersion,
  deleteJournalPageVersion,
} from '@/api/journal'

const firstPage: JournalPage = {
  id: 'page-1',
  book: 'book-1',
  title: '第 1 页',
  page_no: 1,
  width: 1080,
  height: 1440,
  background: '#fffaf0',
  content: { version: 1, layers: [] },
  preview_image: null,
  created_at: '2026-06-26T00:00:00Z',
  updated_at: '2026-06-26T00:00:00Z',
}

const book: JournalBook = {
  id: 'book-1',
  title: '旅行手帐',
  description: '贴谷子',
  cover_image: null,
  order: -1000,
  page_count: 1,
  created_at: '2026-06-26T00:00:00Z',
  updated_at: '2026-06-26T00:00:00Z',
}

const firstVersion: JournalPageVersion = {
  id: 'version-1',
  page: 'page-1',
  version_no: 1,
  content: { version: 1, layers: [] },
  preview_image: null,
  created_at: '2026-06-26T00:00:00Z',
}

describe('useJournalStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads books and selects the first book page', async () => {
    vi.mocked(getJournalBooks).mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 20,
      next: null,
      previous: null,
      results: [book],
    })
    vi.mocked(getJournalPages).mockResolvedValue([firstPage])

    const store = useJournalStore()
    await store.fetchBooks()

    expect(store.books).toEqual([book])
    expect(store.activeBookId).toBe('book-1')
    expect(store.pages).toEqual([firstPage])
    expect(store.activePage?.id).toBe('page-1')
  })

  it('creates a book then loads its pages', async () => {
    vi.mocked(createJournalBook).mockResolvedValue(book)
    vi.mocked(getJournalPages).mockResolvedValue([firstPage])

    const store = useJournalStore()
    await store.createBook('旅行手帐')

    expect(createJournalBook).toHaveBeenCalledWith({ title: '旅行手帐', description: '' })
    expect(store.books[0]).toEqual(book)
    expect(store.activeBookId).toBe('book-1')
    expect(store.activePage?.id).toBe('page-1')
  })

  it('saves page content and clears dirty state', async () => {
    vi.mocked(patchJournalPage).mockResolvedValue({
      ...firstPage,
      content: {
        version: 1,
        layers: [{ id: 'draw-1', type: 'draw', points: [1, 2], stroke: '#000', stroke_width: 4, opacity: 1, z_index: 1 }],
      } as JournalPageContent,
    })
    vi.mocked(getJournalPageVersions).mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 50,
      next: null,
      previous: null,
      results: [firstVersion],
    })
    const store = useJournalStore()
    store.pages = [firstPage]
    store.activePageId = 'page-1'

    const content: JournalPageContent = {
      version: 1,
      layers: [{ id: 'text-1', type: 'text', text: 'Hi', x: 10, y: 20, font_size: 32, fill: '#333', rotation: 0, z_index: 1 }],
    }
    store.updateActivePageContent(content)
    expect(store.dirty).toBe(true)

    await store.saveActivePage()

    expect(patchJournalPage).toHaveBeenCalledWith('page-1', { content })
    expect(getJournalPageVersions).toHaveBeenCalledWith('page-1')
    expect(store.versions).toEqual([firstVersion])
    expect(store.dirty).toBe(false)
  })

  it('loads and restores page versions', async () => {
    const restoredPage: JournalPage = {
      ...firstPage,
      content: {
        version: 1,
        layers: [
          {
            id: 'text-restored',
            type: 'text',
            text: 'restored',
            x: 10,
            y: 20,
            font_size: 32,
            fill: '#333333',
            rotation: 0,
            z_index: 1,
          },
        ],
      },
    }
    vi.mocked(getJournalPageVersions).mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 50,
      next: null,
      previous: null,
      results: [firstVersion],
    })
    vi.mocked(restoreJournalPageVersion).mockResolvedValue(restoredPage)

    const store = useJournalStore()
    store.pages = [firstPage]
    store.activePageId = 'page-1'
    store.dirty = true

    await store.fetchVersions()
    const restored = await store.restoreVersion('version-1')

    expect(store.versions).toEqual([firstVersion])
    expect(restoreJournalPageVersion).toHaveBeenCalledWith('version-1')
    expect(restored).toEqual(restoredPage)
    expect(store.activePage?.content).toEqual(restoredPage.content)
    expect(store.dirty).toBe(false)
    expect(getJournalPageVersions).toHaveBeenCalledTimes(2)
  })

  it('deletes a page version from the local version list', async () => {
    vi.mocked(deleteJournalPageVersion).mockResolvedValue({} as never)

    const store = useJournalStore()
    store.versions = [
      firstVersion,
      { ...firstVersion, id: 'version-2', version_no: 2 },
    ]

    const deleted = await store.deleteVersion('version-1')

    expect(deleted).toBe(true)
    expect(deleteJournalPageVersion).toHaveBeenCalledWith('version-1')
    expect(store.versions.map(version => version.id)).toEqual(['version-2'])
  })
})
