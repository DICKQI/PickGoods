import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
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
  fetchBooks: vi.fn(),
  createBook: vi.fn(),
  setActiveBook: vi.fn(),
  createPage: vi.fn(),
  setActivePage: vi.fn(),
  saveActivePage: vi.fn(),
  uploadPreview: vi.fn(),
  uploadBookCover: vi.fn(),
  createPublicShare: vi.fn(),
  updateActivePageSettings: vi.fn(),
  updateActivePageBackground: vi.fn(),
  revisionConflict: null as any,
  clearRevisionConflict: vi.fn(),
  fetchPageDetail: vi.fn(),
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
    props: ['modelValue', 'width', 'height', 'background', 'backgroundStyle'],
    emits: ['update:modelValue'],
    setup(_props: unknown, { expose }: any) {
      expose(canvasState)
      return {}
    },
    template: '<div class="canvas-stub" />',
  },
}))

const mountWorkspace = () => mount(JournalWorkspace, {
  global: {
    stubs: {
      JournalGoodsPicker: true,
      'el-alert': true,
      'el-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
      'el-drawer': { template: '<section class="drawer-stub"><slot /></section>' },
      'el-empty': { template: '<div><slot /></div>' },
      'el-icon': { template: '<i><slot /></i>' },
      'el-input': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div class="input-stub" />' },
      'el-input-number': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div class="input-number-stub" />' },
      'el-option': { template: '<option><slot /></option>' },
      'el-select': { props: ['modelValue'], emits: ['update:modelValue'], template: '<select><slot /></select>' },
      'el-slider': { props: ['modelValue'], emits: ['update:modelValue'], template: '<div />' },
      'el-skeleton': true,
      'el-tab-pane': { template: '<section><slot /></section>' },
      'el-tabs': { template: '<div><slot /></div>' },
    },
  },
})

describe('JournalWorkspace', () => {
  beforeEach(() => {
    journalStore.saving = false
    journalStore.dirty = false
    journalStore.activePage = null
    journalStore.activeBook = null
    journalStore.books = []
    journalStore.pages = []
    canvasState.layers = []
    canvasState.selectedLayer = null
    canvasState.selectedItem = null
    canvasState.selectedLayerIds = []
    journalStore.fetchBooks.mockClear()
    journalStore.updateActivePageBackground.mockClear()
    canvasState.alignSelectedLayers.mockClear()
    canvasState.distributeSelectedLayers.mockClear()
    canvasState.toggleLayerLock.mockClear()
    canvasState.toggleLayerVisibility.mockClear()
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
})
