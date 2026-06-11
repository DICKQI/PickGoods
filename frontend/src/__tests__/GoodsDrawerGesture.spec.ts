import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import GoodsDrawer from '@/components/GoodsDrawer.vue'

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
    theme: null,
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

const mountDrawer = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  router.push('/')
  await router.isReady()

  setActivePinia(createPinia())

  return mount(GoodsDrawer, {
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
        'el-collapse-item': { template: '<div><slot /></div>' },
        Close: { template: '<span />' },
        Picture: { template: '<span />' },
        Collection: { template: '<span />' },
      },
    },
  })
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
  })
})
