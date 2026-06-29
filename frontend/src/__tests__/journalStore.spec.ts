import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '@/stores/journal'
import type { JournalBook, JournalPage, JournalPageContent, JournalPageVersion } from '@/api/types'

vi.mock('@/api/journal', () => ({
  createJournalBook: vi.fn(),
  createJournalPageDuplicate: vi.fn(),
  getJournalBooks: vi.fn(),
  patchJournalBook: vi.fn(),
  getJournalPage: vi.fn(),
  getJournalPages: vi.fn(),
  getJournalPageVersions: vi.fn(),
  patchJournalPage: vi.fn(),
  reorderJournalPages: vi.fn(),
  restoreJournalPageVersion: vi.fn(),
  deleteJournalPageVersion: vi.fn(),
  deleteJournalBook: vi.fn(),
  deleteJournalPage: vi.fn(),
  uploadJournalPagePreview: vi.fn(),
}))

import {
  createJournalBook,
  createJournalPageDuplicate,
  getJournalPage,
  getJournalBooks,
  patchJournalBook,
  getJournalPages,
  getJournalPageVersions,
  patchJournalPage,
  reorderJournalPages,
  restoreJournalPageVersion,
  deleteJournalPageVersion,
  deleteJournalPage,
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

  it('renames a book from the local book list', async () => {
    vi.mocked(patchJournalBook).mockResolvedValue({ ...book, title: '夏日手帐' })
    const store = useJournalStore()
    store.books = [book]
    store.activeBookId = 'book-1'

    const result = await store.renameBook('book-1', '夏日手帐')

    expect(result?.title).toBe('夏日手帐')
    expect(patchJournalBook).toHaveBeenCalledWith('book-1', { title: '夏日手帐' })
    expect(store.books[0]?.title).toBe('夏日手帐')
    expect(store.activeBook?.title).toBe('夏日手帐')
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

    expect(patchJournalPage).toHaveBeenCalledWith('page-1', expect.objectContaining({
      content,
      width: firstPage.width,
      height: firstPage.height,
      background: firstPage.background,
      background_style: 'plain',
      title: firstPage.title,
      revision: 1,
      create_version: true,
    }))
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

  it('deletes the active page and selects the next remaining page', async () => {
    vi.mocked(deleteJournalPage).mockResolvedValue({} as never)
    vi.mocked(getJournalPageVersions).mockResolvedValue({
      count: 1,
      page: 1,
      page_size: 50,
      next: null,
      previous: null,
      results: [firstVersion],
    })

    const secondPage: JournalPage = { ...firstPage, id: 'page-2', title: '第 2 页', page_no: 2 }
    const thirdPage: JournalPage = { ...firstPage, id: 'page-3', title: '第 3 页', page_no: 3 }
    const store = useJournalStore()
    store.pages = [firstPage, secondPage, thirdPage]
    store.activePageId = 'page-2'

    const deleted = await store.removePage('page-2')

    expect(deleted).toBe(true)
    expect(deleteJournalPage).toHaveBeenCalledWith('page-2')
    expect(store.pages.map(page => page.id)).toEqual(['page-1', 'page-3'])
    expect(store.activePageId).toBe('page-3')
    expect(getJournalPageVersions).toHaveBeenCalledWith('page-3')
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
    expect(patchJournalPage).toHaveBeenNthCalledWith(1, 'page-1', expect.objectContaining({
      content: expect.objectContaining({ layers: [expect.objectContaining({ id: 'text-1' })] }),
      width: firstPage.width,
      height: firstPage.height,
      background: firstPage.background,
      background_style: 'plain',
      title: firstPage.title,
      revision: 1,
      create_version: false,
    }))
    expect(patchJournalPage).toHaveBeenNthCalledWith(2, 'page-1', expect.objectContaining({
      content: expect.objectContaining({ layers: [expect.objectContaining({ id: 'text-2' })] }),
      width: firstPage.width,
      height: firstPage.height,
      background: firstPage.background,
      background_style: 'plain',
      title: firstPage.title,
      revision: 2,
      create_version: false,
    }))
  })

  it('loads summary pages and fetches page detail when activating a summary row', async () => {
    const summaryPage = { ...firstPage, content: undefined as unknown as JournalPageContent }
    vi.mocked(getJournalPages).mockResolvedValue([summaryPage])
    vi.mocked(getJournalPage).mockResolvedValue({ ...firstPage, content: textContent('text-1', 'detail') })
    vi.mocked(getJournalPageVersions).mockResolvedValue({
      count: 0,
      page: 1,
      page_size: 50,
      next: null,
      previous: null,
      results: [],
    })

    const store = useJournalStore()
    store.activeBookId = 'book-1'
    await store.fetchPages('book-1')
    await store.setActivePage('page-1')

    expect(getJournalPages).toHaveBeenCalledWith('book-1', { fields: 'summary' })
    expect(getJournalPage).toHaveBeenCalledWith('page-1')
    expect(store.activePage?.content!.layers[0]?.id).toBe('text-1')
  })

  it('duplicates a page and selects the duplicated copy', async () => {
    const duplicated: JournalPage = { ...firstPage, id: 'page-2', title: '第 2 页', page_no: 2 }
    vi.mocked(createJournalPageDuplicate).mockResolvedValue(duplicated)
    vi.mocked(getJournalPageVersions).mockResolvedValue({
      count: 0,
      page: 1,
      page_size: 50,
      next: null,
      previous: null,
      results: [],
    })

    const store = useJournalStore()
    store.pages = [firstPage]
    store.activePageId = 'page-1'

    const result = await store.duplicatePage('page-1')

    expect(result).toEqual(duplicated)
    expect(createJournalPageDuplicate).toHaveBeenCalledWith('page-1')
    expect(store.pages.map(page => page.id)).toEqual(['page-1', 'page-2'])
    expect(store.activePageId).toBe('page-2')
  })

  it('renames a page without creating a version snapshot', async () => {
    vi.mocked(patchJournalPage).mockResolvedValue({ ...firstPage, title: '旅行手帐' })
    const store = useJournalStore()
    store.pages = [firstPage]

    const result = await store.renamePage('page-1', '旅行手帐')

    expect(result?.title).toBe('旅行手帐')
    expect(patchJournalPage).toHaveBeenCalledWith('page-1', {
      title: '旅行手帐',
      revision: 1,
      create_version: false,
    })
    expect(store.pages[0]?.title).toBe('旅行手帐')
  })

  it('reorders pages locally from the backend response', async () => {
    const secondPage: JournalPage = { ...firstPage, id: 'page-2', title: '第 2 页', page_no: 2 }
    vi.mocked(reorderJournalPages).mockResolvedValue([
      { ...secondPage, page_no: 1 },
      { ...firstPage, page_no: 2 },
    ])

    const store = useJournalStore()
    store.activeBookId = 'book-1'
    store.pages = [firstPage, secondPage]

    const result = await store.reorderPages(['page-2', 'page-1'])

    expect(result).toBe(true)
    expect(reorderJournalPages).toHaveBeenCalledWith('book-1', ['page-2', 'page-1'])
    expect(store.pages.map(page => `${page.id}:${page.page_no}`)).toEqual(['page-2:1', 'page-1:2'])
  })
})
