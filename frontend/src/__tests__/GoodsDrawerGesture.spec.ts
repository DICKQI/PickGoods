import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import GoodsDrawer from '@/components/GoodsDrawer.vue'
import { getGoodsList } from '@/api/goods'

// --------------- Mocks ---------------

const { mockDetail } = vi.hoisted(() => ({
  mockDetail: {
    id: 'test-id',
    name: '测试谷子',
    status: 'in_cabinet',
    main_photo: null,
    additional_photos: [],
    quantity: 1,
    is_official: true,
    price: '99.00',
    purchase_date: '2024-01-01',
    notes: '',
    location_path: '',
    ip: { id: 1, name: '测试IP' },
    characters: [{ id: 1, name: '测试角色', gender: 'female' }],
    category: { id: 1, name: '徽章' },
    theme: null as null | { id: number, name: string },
    user: { id: 1, username: 'testuser' },
  },
}))

vi.mock('@/api/goods', () => ({
  getGoodsDetail: vi.fn().mockResolvedValue(null),
  getGoodsList: vi.fn().mockResolvedValue({ results: [] }),
}))

vi.mock('@/stores/guzi', () => ({
  useGuziStore: () => ({
    fetchGoodsDetail: vi.fn().mockResolvedValue(mockDetail),
  }),
}))

// --------------- Helpers ---------------

const setMobileViewport = (width = 390, height = 844) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 })
}

const createTouchEvent = (
  type: 'touchstart' | 'touchmove' | 'touchend',
  clientY: number,
  target: EventTarget | null = null,
) => {
  const touch = { clientY, clientX: 195, identifier: 0 } as Touch
  const event = new Event(type, { bubbles: true, cancelable: true }) as any
  if (type === 'touchend') {
    event.changedTouches = [touch]
    event.touches = []
  } else {
    event.touches = [touch]
    event.changedTouches = []
  }
  Object.defineProperty(event, 'target', { value: target, writable: false })
  Object.defineProperty(event, 'currentTarget', { value: target, writable: false })
  event.preventDefault = vi.fn()
  return event
}

const dispatchTouch = (el: Element, type: 'touchstart' | 'touchmove' | 'touchend', clientY: number) => {
  el.dispatchEvent(createTouchEvent(type, clientY, el))
}

const flushDetailLoad = async () => {
  await Promise.resolve()
  await new Promise(resolve => window.setTimeout(resolve, 0))
}

const cssRuleBlock = (source: string, selector: string) => {
  const start = source.indexOf(`${selector} {`)
  if (start === -1) return ''
  const end = source.indexOf('\n}', start)
  return end === -1 ? source.slice(start) : source.slice(start, end + 2)
}

const mountDrawer = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  router.push('/')
  await router.isReady()

  setActivePinia(createPinia())

  const wrapper = mount(GoodsDrawer, {
    attachTo: document.body,
    props: {
      modelValue: true,
      goodsId: 'test-id',
    },
    global: {
      plugins: [router],
      stubs: {
        'el-drawer': {
          props: ['modelValue', 'size'],
          template: `
            <div v-if="modelValue" class="stub-drawer" :data-size="size">
              <slot />
            </div>
          `,
        },
        'el-skeleton': { template: '<div />' },
        'el-empty': { template: '<div />' },
        'el-image': { template: '<div />' },
        'el-icon': { template: '<i><slot /></i>' },
        'el-tag': { template: '<span><slot /></span>' },
        'el-collapse': { template: '<div><slot /></div>' },
        'el-collapse-item': { template: '<div><slot name="title" /><slot /></div>' },
        Close: { template: '<span />' },
        Picture: { template: '<span />' },
        Collection: { template: '<span />' },
      },
    },
  })

  await flushDetailLoad()
  await wrapper.vm.$nextTick()

  return wrapper
}

// --------------- Tests ---------------

describe('GoodsDrawer mobile gesture', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    setMobileViewport()
    wrapper = await mountDrawer()
    await wrapper.vm.$nextTick()
  })

  const getHandle = () => wrapper.get('.mobile-header-area').element
  const getContent = () => wrapper.get('.scrollable-content').element

  // ---------- Header drag gestures ----------

  describe('header drag', () => {
    it('snaps to full when dragging up past 80%', async () => {
      const handle = getHandle()
      // 65% of 844 = 548.6; need >80% → height > 675.2 → deltaY > 126.6
      // drag 600→460: deltaY = 140 → height = 688.6 → 81.6%
      dispatchTouch(handle, 'touchstart', 600)
      dispatchTouch(handle, 'touchmove', 460)
      dispatchTouch(handle, 'touchend', 460)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.get('.stub-drawer').attributes('data-size')).toBe('100%')
    })

    it('stays at half when dragging up but below 80%', async () => {
      const handle = getHandle()
      // deltaY = 70 → height = 618.6 → 73.3%
      dispatchTouch(handle, 'touchstart', 600)
      dispatchTouch(handle, 'touchmove', 530)
      dispatchTouch(handle, 'touchend', 530)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.get('.stub-drawer').attributes('data-size')).toBe('65%')
    })

    it('closes when dragging down past 40%', async () => {
      const handle = getHandle()
      // deltaY = -300 → height = 248.6 → 29.4%
      dispatchTouch(handle, 'touchstart', 400)
      dispatchTouch(handle, 'touchmove', 700)
      dispatchTouch(handle, 'touchend', 700)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    it('stays at half when dragging down but above 40%', async () => {
      const handle = getHandle()
      // deltaY = -100 → height = 448.6 → 53.1%
      dispatchTouch(handle, 'touchstart', 300)
      dispatchTouch(handle, 'touchmove', 400)
      dispatchTouch(handle, 'touchend', 400)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.get('.stub-drawer').attributes('data-size')).toBe('65%')
    })
  })

  // ---------- Content swipe — half → full ----------

  describe('content swipe (half → full)', () => {
    it('expands to full when swiping up > 50px', async () => {
      const content = getContent()
      dispatchTouch(content, 'touchstart', 500)
      dispatchTouch(content, 'touchend', 400) // deltaY = 100
      await wrapper.vm.$nextTick()

      expect(wrapper.get('.stub-drawer').attributes('data-size')).toBe('100%')
    })

    it('does not trigger when swiping up ≤ 50px', async () => {
      const content = getContent()
      dispatchTouch(content, 'touchstart', 500)
      dispatchTouch(content, 'touchend', 460) // deltaY = 40
      await wrapper.vm.$nextTick()

      expect(wrapper.get('.stub-drawer').attributes('data-size')).toBe('65%')
    })

    it('does not trigger on downward swipe', async () => {
      const content = getContent()
      dispatchTouch(content, 'touchstart', 400)
      dispatchTouch(content, 'touchend', 500) // deltaY = -100
      await wrapper.vm.$nextTick()

      expect(wrapper.get('.stub-drawer').attributes('data-size')).toBe('65%')
    })

    it('always expands regardless of scroll position', async () => {
      const content = getContent()
      dispatchTouch(content, 'touchstart', 500)
      // Fire scroll event to simulate content scrolling
      content.dispatchEvent(new Event('scroll', { bubbles: true }))
      dispatchTouch(content, 'touchend', 380) // deltaY = 120
      await wrapper.vm.$nextTick()

      // Half-screen always expands, even if scroll happened
      expect(wrapper.get('.stub-drawer').attributes('data-size')).toBe('100%')
    })
  })

  // ---------- Content swipe — full → close ----------

  describe('content swipe (full → close)', () => {
    const goToFull = async () => {
      const handle = getHandle()
      dispatchTouch(handle, 'touchstart', 600)
      dispatchTouch(handle, 'touchmove', 460)
      dispatchTouch(handle, 'touchend', 460)
      await wrapper.vm.$nextTick()
    }

    it('closes when swiping down > 80px without scrolling', async () => {
      await goToFull()

      const content = getContent()
      dispatchTouch(content, 'touchstart', 300)
      dispatchTouch(content, 'touchend', 420) // deltaY = -120, no scroll
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    it('does not close when swiping down ≤ 80px', async () => {
      await goToFull()

      const content = getContent()
      dispatchTouch(content, 'touchstart', 300)
      dispatchTouch(content, 'touchend', 360) // deltaY = -60
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    it('does not close when content has been scrolled', async () => {
      await goToFull()

      const content = getContent()
      dispatchTouch(content, 'touchstart', 300)
      // Simulate scrolling: set scrollTop > 2 then fire scroll event
      Object.defineProperty(content, 'scrollTop', { value: 50, configurable: true })
      content.dispatchEvent(new Event('scroll', { bubbles: true }))
      dispatchTouch(content, 'touchend', 450) // deltaY = -150, but scrolled
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    it('does not trigger on upward swipe', async () => {
      await goToFull()

      const content = getContent()
      dispatchTouch(content, 'touchstart', 500)
      dispatchTouch(content, 'touchend', 350) // deltaY = 150
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })
  })

  // ---------- Full → header drag → half ----------

  describe('header drag from full state', () => {
    const goToFull = async () => {
      const handle = getHandle()
      dispatchTouch(handle, 'touchstart', 600)
      dispatchTouch(handle, 'touchmove', 460)
      dispatchTouch(handle, 'touchend', 460)
      await wrapper.vm.$nextTick()
    }

    it('returns to half when dragging down from full to below 80%', async () => {
      await goToFull()

      const handle = getHandle()
      // full state: startHeight = 844, deltaY = -200 → height = 644 → 76.3%
      dispatchTouch(handle, 'touchstart', 300)
      dispatchTouch(handle, 'touchmove', 500)
      dispatchTouch(handle, 'touchend', 500)
      await wrapper.vm.$nextTick()

      expect(wrapper.get('.stub-drawer').attributes('data-size')).toBe('65%')
    })
  })

  // ---------- Close button ----------

  describe('close button', () => {
    it('closes the drawer when clicked', async () => {
      await wrapper.get('.mobile-close-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    it('disables Element Plus body scroll locking on mobile to avoid background resize jitter', () => {
      const source = readFileSync(join(process.cwd(), 'src/components/GoodsDrawer.vue'), 'utf-8')

      expect(source).toContain(':lock-scroll="!isMobile"')
    })

    it('locks the background page scroll with a custom mobile body lock while open', async () => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
      wrapper.unmount()
      document.body.removeAttribute('style')
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 180 })

      const localWrapper = await mountDrawer()

      expect(document.body.style.position).toBe('fixed')
      expect(document.body.style.top).toBe('0px')
      expect(document.body.style.left).toBe('0px')
      expect(document.body.style.right).toBe('0px')
      expect(document.body.style.width).toBe('100%')
      expect(document.body.style.overflow).toBe('hidden')
      expect(document.body.style.transform).toBe('translateY(-180px)')

      await localWrapper.setProps({ modelValue: false })
      await localWrapper.vm.$nextTick()

      expect(document.body.style.position).toBe('')
      expect(document.body.style.top).toBe('')
      expect(document.body.style.overflow).toBe('')
      expect(document.body.style.transform).toBe('')
      expect(scrollToSpy).toHaveBeenCalledWith(0, 180)

      scrollToSpy.mockRestore()
    })
  })
})

describe('GoodsDrawer mobile redesigned detail panel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    setMobileViewport()
    Object.assign(mockDetail, {
      name: '鬼切《绀宇切芒》满赠吧唧',
      status: 'in_cabinet',
      main_photo: '/media/mobile-main.png',
      additional_photos: [
        { id: 1, image: '/media/mobile-without-label.png', label: '' },
        { id: 2, image: '/media/mobile-with-label.png', label: '包装' },
      ],
      quantity: 2,
      is_official: false,
      price: '68.00',
      purchase_date: '2026-05-31',
      notes: '店铺：December十二月 TB店',
      location_path: '卧室/A1柜/第三层',
      ip: { id: 1, name: '阴阳师' },
      characters: [{ id: 1, name: '鬼切', gender: 'male' }],
      category: { id: 1, name: '58mm吧唧' },
      theme: { id: 7, name: '绀宇切芒' },
      user: { id: 1, username: 'admin' },
    })
    vi.mocked(getGoodsList).mockResolvedValue({ results: [] } as any)
  })

  it('uses the desktop-inspired mobile panel with compact touch sections', async () => {
    const wrapper = await mountDrawer()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.mobile-detail-panel').exists()).toBe(true)
    expect(wrapper.find('.mobile-hero-card').exists()).toBe(true)
    expect(wrapper.find('.mobile-profile-card').exists()).toBe(true)
    expect(wrapper.find('.mobile-stat-grid').exists()).toBe(true)
    expect(wrapper.find('.mobile-gallery-rail').exists()).toBe(true)
    expect(wrapper.find('.mobile-same-theme-section').exists()).toBe(true)
    expect(wrapper.find('.detail-info').exists()).toBe(false)
    expect(wrapper.find('.info-list').exists()).toBe(false)
  })

  it('prioritizes title, chips, stats, gallery, and notes for mobile scanning', async () => {
    const wrapper = await mountDrawer()
    await wrapper.vm.$nextTick()
    const text = wrapper.text()

    expect(text).toContain('鬼切《绀宇切芒》满赠吧唧')
    expect(text).toContain('在馆')
    expect(text).toContain('同人')
    expect(text).toContain('58mm吧唧')
    expect(text).toContain('阴阳师')
    expect(text).toContain('鬼切')
    expect(text).toContain('绀宇切芒')
    expect(text).toContain('¥ 68.00')
    expect(text).toContain('2026-05-31')
    expect(text).toContain('x2')
    expect(text).toContain('卧室/A1柜/第三层')
    expect(text).toContain('店铺：December十二月 TB店')
  })

  it('removes the gold frame from the mobile main image itself', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/GoodsDrawer.vue'), 'utf-8')
    const imageRule = cssRuleBlock(source, '.mobile-main-image-wrapper')

    expect(imageRule).toContain('border-radius: 16px;')
    expect(imageRule).not.toContain('border:')
  })

  it('keeps official and category chips complete while only overflowing theme names scroll', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/GoodsDrawer.vue'), 'utf-8')
    const chipRowRule = cssRuleBlock(source, '.mobile-chip-row')
    const fixedChipRule = cssRuleBlock(source, '.mobile-chip:not(.is-theme)')
    const themeChipRule = cssRuleBlock(source, '.mobile-theme-chip')

    expect(source).toContain('class="mobile-chip is-theme mobile-theme-chip"')
    expect(source).toContain(':class="{ \'is-scrollable\': isMobileThemeNameScrollable }"')
    expect(source).toContain('mobileThemeNameTextRef')
    expect(source).toContain('mobile-theme-chip-track')
    expect(source).toContain('mobile-theme-chip-scroll-text')
    expect(source).toContain('@keyframes mobileThemeChipScroll')
    expect(source).toContain('animation: mobileThemeChipScroll 5.4s ease-in-out infinite;')
    expect(chipRowRule).toContain('flex-wrap: nowrap;')
    expect(fixedChipRule).toContain('flex: 0 0 auto;')
    expect(fixedChipRule).toContain('max-width: none;')
    expect(themeChipRule).toContain('flex: 0 1 auto;')
    expect(themeChipRule).toContain('min-width: 0;')
  })

  it('vertically centers the character label with character chips', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/GoodsDrawer.vue'), 'utf-8')
    const characterRowRule = cssRuleBlock(source, '.mobile-summary-row.is-characters')
    const characterListRule = cssRuleBlock(source, '.mobile-character-list')

    expect(source).toContain('class="mobile-summary-row is-characters"')
    expect(characterRowRule).toContain('align-items: center;')
    expect(characterListRule).toContain('align-items: center;')
  })
})

describe('GoodsDrawer mobile additional photos', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    setMobileViewport()
    Object.assign(mockDetail, {
      additional_photos: [
        { id: 1, image: '/media/mobile-without-label.png', label: '' },
        { id: 2, image: '/media/mobile-with-label.png', label: 'With label' },
      ],
    })
  })

  it('reserves the photo label row for untitled additional photos', async () => {
    const wrapper = await mountDrawer()
    await wrapper.vm.$nextTick()

    const photoItems = wrapper.findAll('.additional-image-item')
    const untitledPhotoItem = wrapper.get('.additional-image-item:nth-child(1)')
    const titledPhotoItem = wrapper.get('.additional-image-item:nth-child(2)')

    expect(photoItems).toHaveLength(2)
    expect(untitledPhotoItem.find('.photo-label').exists()).toBe(true)
    expect(untitledPhotoItem.find('.photo-label').classes()).toContain('is-placeholder')
    expect(titledPhotoItem.find('.photo-label').classes()).not.toContain('is-placeholder')
  })
})

describe('GoodsDrawer same theme section', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    Object.assign(mockDetail, {
      additional_photos: [],
      theme: { id: 1, name: '测试主题' },
    })
    vi.mocked(getGoodsList).mockResolvedValue({
      results: [
        {
          id: 'test-id',
          name: '当前谷子',
          status: 'in_cabinet',
          main_photo: null,
          quantity: 1,
          is_official: true,
        },
        {
          id: 'same-theme-id',
          name: '超长超长超长超长超长超长超长超长超长谷子名称',
          status: 'in_cabinet',
          main_photo: null,
          quantity: 1,
          is_official: true,
        },
      ],
    } as any)
  })

  it('renders the same-theme count as a separate pill and exposes full item names', async () => {
    const wrapper = await mountDrawer()
    await wrapper.vm.$nextTick()
    await new Promise(resolve => window.setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.same-theme-title-text').text()).toBe('同主题收藏')
    expect(wrapper.get('.same-theme-count').text()).toBe('1')
    expect(wrapper.get('.same-theme-item-name').attributes('title')).toBe('超长超长超长超长超长超长超长超长超长谷子名称')
    expect(wrapper.get('.same-theme-item-name-text').text()).toBe('超长超长超长超长超长超长超长超长超长谷子名称')
  })

  it('adds automatic marquee for overflowing mobile same-theme titles', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/GoodsDrawer.vue'), 'utf-8')

    expect(source).toContain('mobileSameThemeNameRefs')
    expect(source).toContain('ResizeObserver')
    expect(source).toContain('mobile-same-theme-name-track')
    expect(source).toContain('mobile-same-theme-name-scroll-text')
    expect(source).toContain('@keyframes mobileSameThemeNameScroll')
    expect(source).toContain('animation: mobileSameThemeNameScroll 5.4s ease-in-out infinite;')
    expect(source).not.toContain('same-theme-item:hover .same-theme-item-name-text')
  })
})
