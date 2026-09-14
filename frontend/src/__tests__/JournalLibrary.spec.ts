import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import JournalLibrary from '@/components/journal/JournalLibrary.vue'
import type { JournalBook } from '@/api/types'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn() },
}))

vi.mock('@/stores/journal', () => ({
  useJournalStore: () => journalStore,
}))

const journalStore = reactive({
  books: [] as JournalBook[],
  loading: false,
  error: null as string | null,
  fetchBookSummaries: vi.fn(async () => true),
  refreshBookSummaries: vi.fn(async () => true),
})

const books: JournalBook[] = [
  {
    id: 'book-1',
    title: '旅行手帐',
    cover_image: '/media/journal/cover-1.png',
    page_count: 3,
    updated_at: '2026-09-13T12:00:00Z',
  },
  {
    id: 'book-2',
    title: '夏日拼贴',
    cover_image: null,
    page_count: 1,
    updated_at: '2026-09-12T12:00:00Z',
  },
]

const mountLibrary = (variant: 'mobile' | 'desktop' = 'mobile') => mount(JournalLibrary, {
  props: { variant },
  global: {
    stubs: {
      MobilePullIndicator: { props: ['distance', 'refreshing'], template: '<div class="pull-indicator-stub" />' },
      'el-alert': { props: ['title'], template: '<div class="alert-stub">{{ title }}</div>' },
      'el-button': { template: '<button><slot /></button>' },
      'el-empty': { props: ['description'], template: '<div class="empty-stub">{{ description }}</div>' },
      'el-icon': { template: '<i><slot /></i>' },
      'el-image': {
        props: ['src', 'alt'],
        template: '<img class="image-stub" :src="src" :alt="alt" />',
      },
      'el-dropdown': {
        emits: ['command'],
        template: `
          <div class="dropdown-stub">
            <slot />
            <button class="dropdown-command" data-command="rename" @click="$emit('command', 'rename')">重命名</button>
            <button class="dropdown-command" data-command="cover" @click="$emit('command', 'cover')">更换封面</button>
            <button class="dropdown-command" data-command="delete" @click="$emit('command', 'delete')">删除</button>
          </div>
        `,
      },
      'el-dropdown-menu': { template: '<div><slot /></div>' },
      'el-dropdown-item': { template: '<span><slot /></span>' },
    },
  },
})

const touchEvent = (type: string, clientY: number, touches = type === 'touchend' ? [] : [{ clientY }]) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: touches })
  return event
}

const flushRaf = async () => {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  await nextTick()
}

describe('JournalLibrary', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    journalStore.books = []
    journalStore.loading = false
    journalStore.error = null
    journalStore.fetchBookSummaries.mockClear()
    journalStore.refreshBookSummaries.mockClear()
    vi.mocked(ElMessage.success).mockClear()
  })

  it('loads and renders journal books as cover cards', async () => {
    journalStore.books = books
    const wrapper = mountLibrary()
    await flushPromises()

    expect(journalStore.refreshBookSummaries).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-test="journal-library"]').exists()).toBe(true)
    expect(wrapper.findAll('.journal-book-card')).toHaveLength(2)
    expect(wrapper.text()).toContain('旅行手帐')
    expect(wrapper.text()).toContain('3 页')
    expect(wrapper.text()).toContain('夏日拼贴')

    await wrapper.get('[data-test="journal-book-book-1"]').trigger('click')
    expect(wrapper.emitted('openBook')?.[0]).toEqual(['book-1'])
    wrapper.unmount()
  })

  it('shows empty state and emits the floating create action', async () => {
    const wrapper = mountLibrary()
    await flushPromises()

    expect(wrapper.get('.empty-stub').text()).toContain('还没有手帐')
    await wrapper.get('[data-test="journal-library-create"]').trigger('click')
    expect(wrapper.emitted('createBook')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders the desktop library header and cover grid without mobile-only controls', async () => {
    journalStore.books = books
    const wrapper = mountLibrary('desktop')
    await flushPromises()

    expect(wrapper.get('.journal-library').classes()).toContain('journal-library--desktop')
    expect(wrapper.get('.journal-library__desktop-header').text()).toContain('我的手帐')
    expect(wrapper.get('[data-test="journal-library-create-desktop"]').text()).toContain('新建手帐')
    expect(wrapper.findAll('.journal-book-card')).toHaveLength(2)
    expect(wrapper.find('.journal-library__fab').exists()).toBe(false)
    expect(wrapper.find('.journal-library__header').exists()).toBe(false)
    wrapper.unmount()
  })

  it('emits desktop book management actions from the card menu', async () => {
    journalStore.books = books
    const wrapper = mountLibrary('desktop')
    await flushPromises()

    const commands = wrapper.findAll('.dropdown-command')
    await commands[0]!.trigger('click')
    await commands[1]!.trigger('click')
    await commands[2]!.trigger('click')

    expect(wrapper.emitted('renameBook')?.[0]).toEqual([books[0]])
    expect(wrapper.emitted('changeCover')?.[0]).toEqual([books[0]])
    expect(wrapper.emitted('deleteBook')?.[0]).toEqual([books[0]])
    wrapper.unmount()
  })

  it('shrinks and pins the header after scrolling down, then expands at the top', async () => {
    journalStore.books = books
    const wrapper = mountLibrary()
    await flushPromises()
    const header = wrapper.get('.journal-library__header')
    const sentinel = wrapper.get('.journal-library__scroll-sentinel').element
    const rect = (top: number) => ({
      top,
      bottom: top + 1,
      left: 0,
      right: 1,
      width: 1,
      height: 1,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect)
    const rectSpy = vi.spyOn(sentinel, 'getBoundingClientRect')

    rectSpy.mockReturnValue(rect(48))
    window.dispatchEvent(new Event('scroll'))
    await flushRaf()
    expect(header.classes()).toContain('is-compact')
    expect(header.attributes('data-compact')).toBe('true')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 24 })
    rectSpy.mockReturnValue(rect(84))
    window.dispatchEvent(new Event('scroll'))
    await flushRaf()
    expect(header.classes()).toContain('is-compact')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    window.dispatchEvent(new Event('scroll'))
    await flushRaf()
    expect(header.classes()).not.toContain('is-compact')
    rectSpy.mockRestore()
    wrapper.unmount()
  })

  it('refreshes summaries and shows the external refresh completion event', async () => {
    journalStore.books = books
    const wrapper = mountLibrary()
    await flushPromises()
    journalStore.refreshBookSummaries.mockClear()
    vi.mocked(ElMessage.success).mockClear()

    const completed = vi.fn()
    window.addEventListener('cloud-showcase:journal-refresh-complete', completed)
    window.dispatchEvent(new CustomEvent('cloud-showcase:journal-refresh'))
    await flushPromises()

    expect(journalStore.refreshBookSummaries).toHaveBeenCalledTimes(1)
    expect(ElMessage.success).toHaveBeenCalledWith('刷新成功')
    expect(completed).toHaveBeenCalledTimes(1)
    window.removeEventListener('cloud-showcase:journal-refresh-complete', completed)
    wrapper.unmount()
  })

  it('refreshes the list after a pull-down gesture', async () => {
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 0 })
    journalStore.books = books
    const wrapper = mountLibrary()
    await flushPromises()
    journalStore.refreshBookSummaries.mockClear()
    vi.mocked(ElMessage.success).mockClear()
    const element = wrapper.get('[data-test="journal-library"]').element

    element.dispatchEvent(touchEvent('touchstart', 10))
    element.dispatchEvent(touchEvent('touchmove', 160))
    await flushRaf()
    element.dispatchEvent(touchEvent('touchend', 160))
    await flushPromises()

    expect(journalStore.refreshBookSummaries).toHaveBeenCalledTimes(1)
    expect(ElMessage.success).toHaveBeenCalledWith('刷新成功')
    wrapper.unmount()
  })

  it('keeps the existing list when a refresh fails', async () => {
    journalStore.books = books
    const wrapper = mountLibrary()
    await flushPromises()
    journalStore.refreshBookSummaries.mockClear()
    journalStore.refreshBookSummaries.mockResolvedValueOnce(false)
    vi.mocked(ElMessage.success).mockClear()

    window.dispatchEvent(new CustomEvent('cloud-showcase:journal-refresh'))
    await flushPromises()

    expect(wrapper.findAll('.journal-book-card')).toHaveLength(2)
    expect(ElMessage.success).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders the API error and retry action without dropping loaded books', async () => {
    journalStore.books = books
    journalStore.error = '网络错误'
    const wrapper = mountLibrary()
    await nextTick()

    expect(wrapper.get('.alert-stub').text()).toContain('网络错误')
    expect(wrapper.findAll('.journal-book-card')).toHaveLength(2)
    wrapper.unmount()
  })
})
