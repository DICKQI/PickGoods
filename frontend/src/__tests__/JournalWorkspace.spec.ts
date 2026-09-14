import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { ElMessageBox } from 'element-plus'
import { createMemoryHistory, createRouter } from 'vue-router'
import JournalWorkspace from '@/components/journal/JournalWorkspace.vue'
import type { JournalBook, JournalLayer, JournalPage } from '@/api/types'

vi.mock('@/stores/journal', () => ({
  useJournalStore: () => journalStore,
}))

const journalStore = reactive({
  saving: false,
  dirty: false,
  loading: false,
  pageLoading: false,
  error: '',
  books: [] as JournalBook[],
  pages: [] as JournalPage[],
  versions: [],
  versionLoading: false,
  activeBookId: '',
  activePageId: '',
  activeBook: null as any,
  activePage: null as JournalPage | null,
  fetchBookSummaries: vi.fn(async () => true),
  refreshBookSummaries: vi.fn(async () => true),
  fetchBooks: vi.fn(),
  createBook: vi.fn(),
  setActiveBook: vi.fn(),
  createPage: vi.fn(),
  setActivePage: vi.fn(),
  saveActivePage: vi.fn(),
  discardActivePageChanges: vi.fn(async () => true),
  uploadPreview: vi.fn(),
  uploadBookCover: vi.fn(),
  createPublicShare: vi.fn(),
  updateActivePageSettings: vi.fn(),
  updateActivePageBackground: vi.fn(),
  revisionConflict: null as any,
  clearRevisionConflict: vi.fn(),
  fetchPageDetail: vi.fn(),
  fetchVersions: vi.fn(),
  renameBook: vi.fn(),
})

const canvasState = reactive({
  layers: [] as JournalLayer[],
  selectedLayer: null as JournalLayer | null,
  selectedItem: null as any,
  selectedLayerIds: [] as string[],
  addBrushLayer: vi.fn(),
  addShapeLayer: vi.fn(),
  setTool: vi.fn(),
  selectLayer: vi.fn((id: string) => {
    canvasState.selectedLayer = canvasState.layers.find(layer => layer.id === id) || null
    canvasState.selectedItem = canvasState.selectedLayer?.items[0] || null
    canvasState.selectedLayerIds = [id]
  }),
  toggleLayerLock: vi.fn((id: string) => {
    const layer = canvasState.layers.find(item => item.id === id)
    if (layer) layer.locked = !layer.locked
  }),
  toggleLayerVisibility: vi.fn((id: string) => {
    const layer = canvasState.layers.find(item => item.id === id)
    if (layer) layer.visible = layer.visible === false
  }),
  alignSelectedLayers: vi.fn(),
  distributeSelectedLayers: vi.fn(),
  updateSelectedLayer: vi.fn(),
  deleteSelectedLayer: vi.fn(),
  moveSelectedLayer: vi.fn(),
  toggleSelectedLayerLock: vi.fn(),
  toggleSelectedLayerVisibility: vi.fn(),
  duplicateSelectedLayer: vi.fn(),
  addGoodsSticker: vi.fn(),
  addLocalSticker: vi.fn(),
  exportPngBlob: vi.fn(async () => new Blob(['fake'], { type: 'image/png' })),
  exportPngDataUrl: vi.fn(async () => 'data:image/png;base64,ZmFrZQ=='),
})

vi.mock('@/components/journal/JournalCanvas.vue', () => ({
  default: {
    name: 'JournalCanvas',
    props: ['modelValue', 'width', 'height', 'background', 'backgroundStyle', 'mobile'],
    emits: ['update:modelValue'],
    setup(_props: unknown, { expose }: any) {
      expose(canvasState)
      return {}
    },
    template: '<div class="canvas-stub" />',
  },
}))

const mountWorkspace = ({
  mobile = false,
  bookId = '',
  width,
}: {
  mobile?: boolean
  bookId?: string
  width?: number
} = {}) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width ?? (mobile ? 390 : 1197),
  })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: mobile ? 5 : 0,
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  return mount(JournalWorkspace, {
    props: { bookId },
    global: {
      plugins: [router],
      stubs: {
      JournalGoodsPicker: true,
      BaseBottomSheet: {
        props: ['modelValue', 'title', 'subtitle', 'size'],
        template: '<section v-if="modelValue" class="bottom-sheet-stub" :data-title="title"><slot /></section>',
      },
      'el-alert': true,
      'el-button': {
        emits: ['click'],
        template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
      },
      'el-drawer': { template: '<section class="drawer-stub"><slot /></section>' },
      'el-empty': { template: '<div><slot /></div>' },
      'el-icon': { template: '<i><slot /></i>' },
      'el-input': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div class="input-stub" />' },
      'el-input-number': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div class="input-number-stub" />' },
      'el-option': { template: '<option><slot /></option>' },
      'el-popover': {
        props: ['modelValue'],
        emits: ['update:visible'],
        template: '<div class="popover-stub"><slot name="reference" /><slot /></div>',
      },
      'el-select': { props: ['modelValue'], emits: ['update:modelValue'], template: '<select><slot /></select>' },
      'el-slider': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div />' },
      'el-skeleton': true,
      'el-tab-pane': { template: '<section><slot /></section>' },
      'el-tabs': { template: '<div><slot /></div>' },
      },
    },
  })
}

const setActivePageFixture = () => {
  journalStore.books = [{
    id: 'book-1',
    title: '旅行手帐',
    cover_image: null,
    page_count: 1,
  }]
  journalStore.activeBookId = 'book-1'
  journalStore.activeBook = journalStore.books[0]
  journalStore.activePageId = 'page-1'
  journalStore.pages = [{
    id: 'page-1',
    book: 'book-1',
    title: '第 1 页',
    page_no: 1,
    width: 1080,
    height: 1440,
    background: '#fffaf0',
    background_style: 'plain',
    content: { version: 2, layers: [] },
    revision: 1,
    preview_image: null,
    created_at: '2026-06-26T00:00:00Z',
    updated_at: '2026-06-26T00:00:00Z',
  }]
  journalStore.activePage = journalStore.pages[0]!
}

describe('JournalWorkspace', () => {
  beforeEach(() => {
    journalStore.saving = false
    journalStore.dirty = false
    journalStore.activePage = null
    journalStore.activeBook = null
    journalStore.activeBookId = ''
    journalStore.activePageId = ''
    journalStore.books = []
    journalStore.pages = []
    canvasState.layers = []
    canvasState.selectedLayer = null
    canvasState.selectedItem = null
    canvasState.selectedLayerIds = []
    journalStore.fetchBooks.mockClear()
    journalStore.fetchBookSummaries.mockClear()
    journalStore.refreshBookSummaries.mockClear()
    journalStore.setActiveBook.mockClear()
    journalStore.setActivePage.mockClear()
    journalStore.createBook.mockClear()
    journalStore.updateActivePageBackground.mockClear()
    journalStore.fetchPageDetail.mockClear()
    journalStore.fetchVersions.mockClear()
    journalStore.saveActivePage.mockClear()
    journalStore.discardActivePageChanges.mockClear()
    canvasState.setTool.mockClear()
    canvasState.alignSelectedLayers.mockClear()
    canvasState.distributeSelectedLayers.mockClear()
    canvasState.toggleLayerLock.mockClear()
    canvasState.toggleLayerVisibility.mockClear()
    vi.spyOn(ElMessageBox, 'prompt').mockResolvedValue({ value: '我的手帐' } as never)
  })

  it('shows a visual save status indicator for saved, dirty, and saving states', async () => {
    const wrapper = mountWorkspace()

    journalStore.activePage = {
      id: 'page-1',
      book: 'book-1',
      title: '第 1 页',
      page_no: 1,
      width: 1080,
      height: 1440,
      background: '#fffaf0',
      background_style: 'plain',
      content: { version: 2, layers: [] },
      revision: 1,
      preview_image: null,
      created_at: '2026-06-26T00:00:00Z',
      updated_at: '2026-06-26T00:00:00Z',
    }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.journal-status.is-saved').text()).toContain('已保存')

    journalStore.dirty = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.journal-status.is-dirty').text()).toContain('有未保存修改')

    journalStore.saving = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.journal-status.is-saving').text()).toContain('保存中')
  })

  it('shows book cover thumbnails, background controls, layer previews, and alignment actions', async () => {
    journalStore.books = [{
      id: 'book-1',
      title: '旅行手帐',
      cover_image: '/media/journals/covers/a.png',
      page_count: 1,
    }]
    journalStore.activeBookId = 'book-1'
    journalStore.activeBook = journalStore.books[0]
    journalStore.activePageId = 'page-1'
    journalStore.activePage = {
      id: 'page-1',
      book: 'book-1',
      title: '第 1 页',
      page_no: 1,
      width: 1080,
      height: 1440,
      background: '#fffaf0',
      background_style: 'grid',
      content: { version: 2, layers: [] },
      revision: 1,
      preview_image: null,
      created_at: '2026-06-26T00:00:00Z',
      updated_at: '2026-06-26T00:00:00Z',
    }
    canvasState.layers = [
      {
        id: 'sticker-1',
        type: 'sticker',
        name: '徽章',
        opacity: 1,
        z_index: 1,
        items: [{ id: 'sticker-item', type: 'sticker', goods_id: 'goods-1', src: '/media/goods/main/a.png', x: 1, y: 2, width: 30, height: 40, rotation: 0 }],
      },
      {
        id: 'text-1',
        type: 'text',
        name: '文字',
        opacity: 1,
        z_index: 2,
        items: [{ id: 'text-item', type: 'text', text: '今天也很喜欢', x: 1, y: 2, font_size: 24, fill: '#111111', rotation: 0 }],
      },
    ] as JournalLayer[]
    canvasState.selectedLayer = canvasState.layers[1]!
    canvasState.selectedItem = canvasState.layers[1]!.items[0]
    canvasState.selectedLayerIds = ['sticker-1', 'text-1']

    const wrapper = mountWorkspace()
    await nextTick()

    expect(wrapper.find('.book-cover-thumb').attributes('src')).toBe('/media/journals/covers/a.png')
    expect(wrapper.find('.background-settings').exists()).toBe(true)
    expect(wrapper.findAll('.layer-thumb')).toHaveLength(2)
    expect(wrapper.find('.multi-align-actions').exists()).toBe(true)

    await wrapper.find('[data-test="align-left"]').trigger('click')
    await wrapper.find('[data-test="distribute-horizontal"]').trigger('click')
    await wrapper.find('[data-test="layer-lock-sticker-1"]').trigger('click')

    expect(canvasState.alignSelectedLayers).toHaveBeenCalledWith('left')
    expect(canvasState.distributeSelectedLayers).toHaveBeenCalledWith('horizontal')
    expect(canvasState.toggleLayerLock).toHaveBeenCalledWith('sticker-1')
  })

  it('shows the empty-state create entry when there is no active page', async () => {
    const wrapper = mountWorkspace()
    await nextTick()

    const emptyCreateButton = wrapper.get('[data-test="journal-create-book-empty"]')

    expect(emptyCreateButton.classes()).toContain('brand-add-btn')
    expect(emptyCreateButton.classes()).toContain('brand-add-btn--hero')
    expect(wrapper.find('.journal-desktop-sidebar-heading').exists()).toBe(true)
    expect(wrapper.find('.journal-desktop-inspector-heading').exists()).toBe(true)
  })

  it('renders the desktop workbench around an active book page', async () => {
    journalStore.books = [{
      id: 'book-1',
      title: '旅行手帐',
      cover_image: '/media/journals/covers/a.png',
      page_count: 1,
    }]
    journalStore.activeBookId = 'book-1'
    journalStore.activeBook = journalStore.books[0]
    journalStore.activePageId = 'page-1'
    journalStore.activePage = {
      id: 'page-1',
      book: 'book-1',
      title: '第 1 页',
      page_no: 1,
      width: 1080,
      height: 1440,
      background: '#fffaf0',
      background_style: 'plain',
      content: { version: 2, layers: [] },
      revision: 1,
      preview_image: null,
      created_at: '2026-06-26T00:00:00Z',
      updated_at: '2026-06-26T00:00:00Z',
    }
    journalStore.pages = [journalStore.activePage]

    const wrapper = mountWorkspace()
    await nextTick()

    expect(wrapper.get('.journal-desktop-topbar').text()).toContain('旅行手帐')
    expect(wrapper.get('.journal-desktop-topbar').text()).toContain('第 1 / 1 页')
    expect(wrapper.find('.journal-sidebar').exists()).toBe(true)
    expect(wrapper.find('.journal-editor').exists()).toBe(true)
    expect(wrapper.find('.journal-side-panel').exists()).toBe(true)
    expect(wrapper.find('[data-test="journal-create-book-empty"]').exists()).toBe(false)
  })

  it('keeps the currently visible create-book entry wired to createBook', async () => {
    const wrapper = mountWorkspace()
    await nextTick()

    await wrapper.get('[data-test="journal-create-book-empty"]').trigger('click')

    expect(journalStore.createBook).toHaveBeenCalledTimes(1)
  })

  it('opens the desktop more panel and its reader action', async () => {
    setActivePageFixture()
    const wrapper = mountWorkspace()
    await nextTick()

    expect(wrapper.get('.journal-desktop-more').text()).toContain('导出图片')
    expect(wrapper.get('.journal-desktop-more').text()).toContain('设置封面')

    const readerButton = wrapper.findAll('.journal-desktop-more__list button')
      .find(button => button.text().includes('读者模式'))
    expect(readerButton).toBeTruthy()
    await readerButton!.trigger('click')

    expect(wrapper.find('.reader-overlay').exists()).toBe(true)
  })

  it('turns the compact desktop inspector into a dismissible drawer', async () => {
    setActivePageFixture()
    const wrapper = mountWorkspace({ width: 1024 })
    await nextTick()

    expect(wrapper.get('.journal-workspace').classes()).toContain('is-compact-desktop')
    await wrapper.get('.journal-desktop-panel-toggle').trigger('click')

    expect(wrapper.get('.journal-side-panel').classes()).toContain('is-desktop-open')
    expect(wrapper.find('.journal-desktop-panel-backdrop').exists()).toBe(true)

    await wrapper.get('.journal-desktop-panel-backdrop').trigger('click')
    expect(wrapper.get('.journal-side-panel').classes()).not.toContain('is-desktop-open')
  })

  it('responds to the journal refresh event by reloading the current page', async () => {
    journalStore.activePageId = 'page-1'
    journalStore.dirty = false
    const wrapper = mountWorkspace()

    window.dispatchEvent(new CustomEvent('cloud-showcase:journal-refresh'))
    await flushPromises()

    expect(journalStore.fetchPageDetail).toHaveBeenCalledWith('page-1')
    expect(journalStore.fetchVersions).toHaveBeenCalledWith('page-1')
    wrapper.unmount()
  })

  it('saves dirty content before refreshing on the journal refresh event', async () => {
    journalStore.activePageId = 'page-1'
    journalStore.dirty = true
    journalStore.saveActivePage.mockResolvedValueOnce({ id: 'page-1' } as never)
    const wrapper = mountWorkspace()

    window.dispatchEvent(new CustomEvent('cloud-showcase:journal-refresh'))
    await flushPromises()

    expect(journalStore.saveActivePage).toHaveBeenCalledWith({ createVersion: false })
    // 保存成功后继续重载当前页
    expect(journalStore.fetchPageDetail).toHaveBeenCalledWith('page-1')
    wrapper.unmount()
  })

  it('aborts the refresh without reloading when saving dirty content fails', async () => {
    journalStore.activePageId = 'page-1'
    journalStore.dirty = true
    journalStore.saveActivePage.mockResolvedValueOnce(null)
    const wrapper = mountWorkspace()

    const completed: string[] = []
    const listener = (e: Event) => { completed.push(e.type) }
    window.addEventListener('cloud-showcase:journal-refresh-complete', listener)

    window.dispatchEvent(new CustomEvent('cloud-showcase:journal-refresh'))
    await flushPromises()

    // 保存失败（返回 null）时不得用服务端版本覆盖本地未保存内容
    expect(journalStore.fetchPageDetail).not.toHaveBeenCalled()
    expect(journalStore.fetchVersions).not.toHaveBeenCalled()
    // 但仍需通知刷新完成，避免刷新态卡死
    expect(completed).toContain('cloud-showcase:journal-refresh-complete')

    window.removeEventListener('cloud-showcase:journal-refresh-complete', listener)
    wrapper.unmount()
  })

  it('renders the immersive mobile editor with high-frequency tools', async () => {
    setActivePageFixture()
    const wrapper = mountWorkspace({ mobile: true })
    await nextTick()

    expect(wrapper.find('.journal-mobile-header').exists()).toBe(true)
    expect(wrapper.find('.journal-mobile-toolbar').exists()).toBe(true)
    expect(wrapper.findAll('.journal-mobile-toolbar button')).toHaveLength(6)
    expect(wrapper.find('.journal-topbar').exists()).toBe(false)

    await wrapper.findAll('.journal-mobile-toolbar button')[1]!.trigger('click')
    expect(canvasState.setTool).toHaveBeenCalledWith('draw')
    expect(wrapper.find('.journal-mobile-brush-context').exists()).toBe(true)
    wrapper.unmount()
  })

  it('loads the requested book when opened from the journal library', async () => {
    journalStore.books = [{
      id: 'book-1',
      title: '旅行手帐',
      cover_image: null,
      page_count: 1,
    }]
    const wrapper = mountWorkspace({ mobile: true, bookId: 'book-1' })
    await flushPromises()

    expect(journalStore.fetchBookSummaries).not.toHaveBeenCalled()
    expect(journalStore.setActiveBook).toHaveBeenCalledWith('book-1')
    wrapper.unmount()
  })

  it('loads a requested book in the desktop workbench from summaries', async () => {
    journalStore.books = [{
      id: 'book-1',
      title: '旅行手帐',
      cover_image: null,
      page_count: 1,
    }]
    const wrapper = mountWorkspace({ bookId: 'book-1' })
    await flushPromises()

    expect(journalStore.fetchBookSummaries).not.toHaveBeenCalled()
    expect(journalStore.setActiveBook).toHaveBeenCalledWith('book-1')
    expect(wrapper.get('.journal-workspace').classes()).toContain('journal-workspace--desktop')
    wrapper.unmount()
  })

  it('opens the mobile page and inspector panels without mounting desktop columns', async () => {
    setActivePageFixture()
    const wrapper = mountWorkspace({ mobile: true })
    await nextTick()

    await wrapper.get('.journal-mobile-page-switch').trigger('click')
    expect(wrapper.get('.journal-sidebar').classes()).toContain('is-mobile-open')

    await wrapper.get('.journal-mobile-sheet-backdrop').trigger('click')
    const materialButton = wrapper.findAll('.journal-mobile-toolbar button')[4]!
    await materialButton.trigger('click')
    expect(wrapper.get('.journal-side-panel').classes()).toContain('is-mobile-open')
    wrapper.unmount()
  })

  it('keeps the mobile editor open when an exit save fails', async () => {
    setActivePageFixture()
    journalStore.dirty = true
    journalStore.saveActivePage.mockResolvedValueOnce(null)
    const wrapper = mountWorkspace({ mobile: true })
    await nextTick()

    await wrapper.get('button[aria-label="返回"]').trigger('click')
    await flushPromises()

    expect(journalStore.saveActivePage).toHaveBeenCalledWith({ createVersion: false })
    expect(wrapper.get('.bottom-sheet-stub').attributes('data-title')).toBe('保存失败')
    wrapper.unmount()
  })

  it('opens the mobile exit recovery sheet when the route guard blocks leaving', async () => {
    setActivePageFixture()
    const wrapper = mountWorkspace({ mobile: true })
    await nextTick()

    window.dispatchEvent(new CustomEvent('cloud-showcase:journal-exit-blocked'))
    await nextTick()

    expect(wrapper.get('.bottom-sheet-stub').attributes('data-title')).toBe('保存失败')
    wrapper.unmount()
  })
})
