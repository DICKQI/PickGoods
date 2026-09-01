import { defineComponent, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ClubGoodsDetailDrawer from '@/components/club/ClubGoodsDetailDrawer.vue'
import type { ClubGoodsDetail } from '@/api/types'

const detail: ClubGoodsDetail = {
  id: 'club-goods-1',
  name: '月光亚克力立牌',
  description: '透明亚克力立牌，附带底座。',
  ip: { id: 1, name: '崩坏：星穹铁道' },
  characters: [{ id: 2, name: '流萤', ip: { id: 1, name: '崩坏：星穹铁道' }, gender: 'female' }],
  category: {
    id: 3,
    name: '镭射票',
    parent: null,
    path_name: '纸制品/镭射票',
    shape_type: 'rectangle',
    color_tag: '#D4AF37',
    order: 1,
  },
  theme: { id: 4, name: '月光主题', description: '', created_at: '2026-09-01T00:00:00Z' },
  main_photo: 'https://cdn.example.com/main.jpg',
  additional_photos: [
    { id: 10, image: 'https://cdn.example.com/detail-1.jpg', label: '正面细节' },
    { id: 11, image: 'https://cdn.example.com/detail-2.jpg', label: null },
  ],
  public_price: '66.00',
  is_imported: false,
  imported_quantity: null,
  imported_goods_id: null,
}

const ElDrawerStub = defineComponent({
  name: 'ElDrawer',
  inheritAttrs: false,
  props: {
    modelValue: { type: Boolean, default: false },
    direction: { type: String, default: '' },
    size: { type: [String, Number], default: '' },
  },
  emits: ['update:modelValue', 'open', 'close'],
  template: `
    <section
      v-if="modelValue"
      v-bind="$attrs"
      :direction="direction"
      :size="size"
      role="dialog"
    >
      <slot />
    </section>
  `,
})

const passthroughStub = (name: string, tag = 'div') => defineComponent({
  name,
  inheritAttrs: false,
  emits: ['click'],
  template: `<${tag} v-bind="$attrs" @click="$emit('click', $event)"><slot /></${tag}>`,
})

const ElImageStub = defineComponent({
  name: 'ElImage',
  props: {
    src: { type: String, default: '' },
    alt: { type: String, default: '' },
    previewSrcList: { type: Array, default: undefined },
    initialIndex: { type: Number, default: undefined },
  },
  template: `
    <img
      :src="src"
      :alt="alt"
      :data-preview-src-list="previewSrcList?.join('|')"
      :data-initial-index="initialIndex"
    />
  `,
})

const SquarePaddedImageStub = defineComponent({
  name: 'SquarePaddedImage',
  props: {
    src: { type: String, default: '' },
    alt: { type: String, default: '' },
    previewSrcList: { type: Array, default: undefined },
    initialIndex: { type: Number, default: undefined },
  },
  template: `
    <img
      class="square-padded-image-stub"
      :src="src"
      :alt="alt"
      :data-preview-src-list="previewSrcList?.join('|')"
      :data-initial-index="initialIndex"
    />
  `,
})

const mountedWrappers: VueWrapper[] = []

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

async function mountDrawer(overrides: Partial<{
  modelValue: boolean
  loading: boolean
  detail: ClubGoodsDetail | null
  clubName: string
  canImport: boolean
}> = {}) {
  const wrapper = mount(ClubGoodsDetailDrawer, {
    props: {
      modelValue: true,
      loading: false,
      detail,
      clubName: '月光手作社',
      canImport: true,
      ...overrides,
    },
    global: {
      stubs: {
        ElButton: passthroughStub('ElButton', 'button'),
        ElDrawer: ElDrawerStub,
        ElEmpty: passthroughStub('ElEmpty'),
        ElIcon: passthroughStub('ElIcon', 'span'),
        ElImage: ElImageStub,
        ElSkeleton: passthroughStub('ElSkeleton'),
        ElTag: passthroughStub('ElTag', 'span'),
        SquarePaddedImage: SquarePaddedImageStub,
      },
    },
  })
  mountedWrappers.push(wrapper)
  await nextTick()
  return wrapper
}

describe('ClubGoodsDetailDrawer', () => {
  beforeEach(() => {
    setViewport(1440, 900)
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() })
    document.body.removeAttribute('style')
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
    document.body.removeAttribute('style')
  })

  it('桌面端使用右侧抽屉并按公开目录语义展示核心信息', async () => {
    const wrapper = await mountDrawer()
    const drawer = wrapper.get('.club-goods-detail-drawer')

    expect(drawer.attributes('direction')).toBe('rtl')
    expect(drawer.attributes('size')).toBe('clamp(720px, 48vw, 880px)')
    expect(wrapper.find('.desktop-detail-panel').exists()).toBe(true)
    expect(wrapper.find('.mobile-detail-panel').exists()).toBe(false)
    expect(wrapper.get('.desktop-detail-header').text()).toContain('月光亚克力立牌')
    expect(wrapper.get('.detail-chip-row').text()).toContain('社团公开')
    expect(wrapper.get('.detail-chip-row').text()).toContain('镭射票')
    expect(wrapper.get('.detail-chip-row').text()).toContain('月光主题')
    expect(wrapper.get('.detail-summary-list').text()).toContain('崩坏：星穹铁道')
    expect(wrapper.get('.detail-summary-list').text()).toContain('流萤')
    expect(wrapper.get('.detail-summary-list').text()).toContain('月光手作社')
    expect(wrapper.get('.detail-price-card strong').text()).toBe('¥66.00')
    expect(wrapper.get('.detail-price-card strong').classes()).toContain('is-price')
    expect(wrapper.get('.detail-notes-card').text()).toContain('透明亚克力立牌')
    expect(wrapper.get('.desktop-inline-action .detail-action__import').text()).toContain('加入谷仓')
    expect(wrapper.find('.detail-action-bar').exists()).toBe(false)
  })

  it('主图与附加图片共享完整预览列表并保持正确索引', async () => {
    const wrapper = await mountDrawer()
    const mainImage = wrapper.get('.square-padded-image-stub')
    const thumbnails = wrapper.findAll('.detail-thumbnail__image')

    expect(mainImage.attributes('data-preview-src-list')).toBe([
      detail.main_photo,
      ...detail.additional_photos.map(photo => photo.image),
    ].join('|'))
    expect(mainImage.attributes('data-initial-index')).toBe('0')
    expect(thumbnails).toHaveLength(2)
    expect(thumbnails[0]!.attributes('data-initial-index')).toBe('1')
    expect(thumbnails[1]!.attributes('data-initial-index')).toBe('2')
    expect(wrapper.findAll('.detail-thumbnail__label')[1]!.classes()).toContain('is-placeholder')
  })

  it('缺少主图和公开价格时显示稳定占位且不使用金色金额类', async () => {
    const wrapper = await mountDrawer({
      detail: {
        ...detail,
        main_photo: null,
        additional_photos: [],
        public_price: null,
        description: '',
      },
    })

    expect(wrapper.get('.image-placeholder-label').text()).toBe('暂无主图')
    expect(wrapper.get('.detail-price-card strong').text()).toBe('暂未公开')
    expect(wrapper.get('.detail-price-card strong').classes()).not.toContain('is-price')
    expect(wrapper.find('.desktop-thumbnail-panel').exists()).toBe(false)
    expect(wrapper.find('.detail-notes-card').exists()).toBe(false)
  })

  it('关闭与加入谷仓通过组件事件交给公开页处理', async () => {
    const wrapper = await mountDrawer()

    await wrapper.get('.detail-action__import').trigger('click')
    expect(wrapper.emitted('import')).toEqual([[detail]])

    await wrapper.get('.desktop-close-button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('移动端使用 65% 底部面板并在关闭后恢复背景滚动样式', async () => {
    setViewport(390, 844)
    document.body.style.overflow = 'auto'
    const wrapper = await mountDrawer()
    const drawer = wrapper.get('.club-goods-detail-drawer')

    expect(drawer.attributes('direction')).toBe('btt')
    expect(drawer.attributes('size')).toBe('65%')
    expect(wrapper.find('.mobile-detail-panel').exists()).toBe(true)
    expect(wrapper.find('.desktop-detail-panel').exists()).toBe(false)
    expect(wrapper.get('.mobile-detail-panel').element.firstElementChild?.classList).toContain('mobile-hero-card')
    expect(wrapper.get('.mobile-inline-action .detail-action__import').text()).toContain('加入谷仓')
    expect(wrapper.find('.detail-action-bar').exists()).toBe(false)
    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.setProps({ modelValue: false })
    await nextTick()
    expect(document.body.style.position).toBe('')
    expect(document.body.style.overflow).toBe('auto')
  })

  it('移动端头部拖拽遵循全屏吸附与下拉关闭阈值', async () => {
    setViewport(390, 800)
    const expandWrapper = await mountDrawer()
    const expandHeader = expandWrapper.get('.mobile-drawer-header')

    await expandHeader.trigger('touchstart', { touches: [{ clientY: 600 }] })
    await expandHeader.trigger('touchmove', { touches: [{ clientY: 180 }] })
    await expandHeader.trigger('touchend', { changedTouches: [{ clientY: 180 }] })
    expect((expandWrapper.vm as unknown as { sheetState: string }).sheetState).toBe('full')
    expect((expandWrapper.vm as unknown as { currentDrawerHeight: string }).currentDrawerHeight).toBe('100%')

    const closeWrapper = await mountDrawer()
    const closeHeader = closeWrapper.get('.mobile-drawer-header')
    await closeHeader.trigger('touchstart', { touches: [{ clientY: 400 }] })
    await closeHeader.trigger('touchmove', { touches: [{ clientY: 760 }] })
    await closeHeader.trigger('touchend', { changedTouches: [{ clientY: 760 }] })
    expect(closeWrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('内容上滑展开全屏，已滚动内容下滑不会误关闭', async () => {
    setViewport(390, 800)
    const wrapper = await mountDrawer()
    const content = wrapper.get('.detail-scroll-content')

    await content.trigger('touchstart', { touches: [{ clientY: 500 }] })
    await content.trigger('touchend', { changedTouches: [{ clientY: 420 }] })
    expect((wrapper.vm as unknown as { sheetState: string }).sheetState).toBe('full')

    Object.defineProperty(content.element, 'scrollTop', { configurable: true, writable: true, value: 120 })
    await content.trigger('touchstart', { touches: [{ clientY: 300 }] })
    await content.trigger('touchend', { changedTouches: [{ clientY: 410 }] })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    content.element.scrollTop = 0
    await content.trigger('touchstart', { touches: [{ clientY: 300 }] })
    await content.trigger('touchend', { changedTouches: [{ clientY: 410 }] })
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
