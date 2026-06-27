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
  content: { version: 2, layers: [] },
  revision: 1,
  preview_image: null,
  created_at: '2026-06-26T00:00:00Z',
  updated_at: '2026-06-26T00:00:00Z',
}

const textContent = (id: string, text: string): JournalPageContent => ({
  version: 2,
  layers: [{
    id,
    type: 'text',
    name: text,
    opacity: 1,
    z_index: 1,
    items: [{
      id: `${id}-item`,
      type: 'text',
      text,
      x: 10,
      y: 20,
      font_size: 32,
      fill: '#333333',
      rotation: 0,
    }],
  }],
})

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
  preview_image: null,
  summary: { layer_count: 0 },
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
        version: 2,
        layers: [{
          id: 'draw-1',
          type: 'draw',
          name: 'draw',
          opacity: 1,
          z_index: 1,
          items: [{ id: 'stroke-1', type: 'stroke', brush_type: 'pen', points: [1, 2], stroke: '#000000', stroke_width: 4, opacity: 1 }],
        }],
      } as JournalPageContent,
      revision: 2,
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

    const content = textContent('text-1', 'Hi')
    store.updateActivePageContent(content)
    expect(store.dirty).toBe(true)

    await store.saveActivePage()

    expect(patchJournalPage).toHaveBeenCalledWith('page-1', { content, revision: 1, create_version: true })
    expect(getJournalPageVersions).toHaveBeenCalledWith('page-1')
    expect(store.versions).toEqual([firstVersion])
    expect(store.dirty).toBe(false)
  })

  it('loads and restores page versions', async () => {
    const restoredPage: JournalPage = {
      ...firstPage,
      content: textContent('text-restored', 'restored'),
      revision: 2,
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

  it('queues overlapping saves and sends auto saves without creating versions', async () => {
    let resolveFirst!: (page: JournalPage) => void
    vi.mocked(patchJournalPage)
      .mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
      .mockResolvedValueOnce({ ...firstPage, revision: 3 })
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

    store.updateActivePageContent({
      ...textContent('text-1', 'one'),
    })
    const firstSave = store.saveActivePage({ createVersion: false })

    store.updateActivePageContent({
      ...textContent('text-2', 'two'),
    })
    const secondSave = store.saveActivePage({ createVersion: false })

    expect(patchJournalPage).toHaveBeenCalledTimes(1)
    resolveFirst({ ...firstPage, revision: 2 })
    await firstSave
    await secondSave

    expect(patchJournalPage).toHaveBeenCalledTimes(2)
    expect(patchJournalPage).toHaveBeenNthCalledWith(1, 'page-1', {
      content: expect.objectContaining({ layers: [expect.objectContaining({ id: 'text-1' })] }),
      revision: 1,
      create_version: false,
    })
    expect(patchJournalPage).toHaveBeenNthCalledWith(2, 'page-1', {
      content: expect.objectContaining({ layers: [expect.objectContaining({ id: 'text-2' })] }),
      revision: 2,
      create_version: false,
    })
  })
})
