import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useGoodsEditNavigation } from '@/composables/useGoodsEditNavigation'
import type { GoodsDetail } from '@/api/types'

const getGoodsDetailMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/goods', () => ({
  getGoodsDetail: getGoodsDetailMock,
}))

const makeDetail = (): GoodsDetail => ({
  id: 'goods-1',
  name: '谷子',
  ip: { id: 1, name: 'IP' },
  characters: [],
  category: { id: 1, name: '品类', parent: null, path_name: '品类', order: 0 },
  theme: null,
  location_path: '',
  location: null,
  main_photo: null,
  status: 'in_cabinet',
  quantity: 1,
  price: null,
  purchase_date: null,
  is_official: true,
  notes: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  additional_photos: [],
})

const createHarness = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Home', component: { template: '<div />' } },
      { path: '/goods/:id/edit', name: 'GoodsEdit', component: { template: '<div />' } },
      { path: '/admin/goods/:id/edit', name: 'AdminGoodsEdit', component: { template: '<div />' } },
    ],
  })
  router.push('/')
  await router.isReady()

  let openGoodsEdit!: ReturnType<typeof useGoodsEditNavigation>['openGoodsEdit']
  mount(defineComponent({
    setup() {
      const navigation = useGoodsEditNavigation()
      openGoodsEdit = navigation.openGoodsEdit
      return () => h('div')
    },
  }), {
    global: {
      plugins: [pinia, router],
    },
  })

  return { router, openGoodsEdit }
}

describe('useGoodsEditNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('waits for detail data before navigating to the edit route', async () => {
    let resolveDetail!: (detail: GoodsDetail) => void
    getGoodsDetailMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveDetail = resolve
    }))
    const { router, openGoodsEdit } = await createHarness()

    const navigation = openGoodsEdit('goods-1')
    expect(router.currentRoute.value.name).toBe('Home')

    resolveDetail(makeDetail())
    await expect(navigation).resolves.toBe(true)
    expect(router.currentRoute.value.name).toBe('GoodsEdit')
    expect(router.currentRoute.value.params.id).toBe('goods-1')
  })

  it('keeps the current page when detail loading fails', async () => {
    const errorSpy = vi.spyOn(ElMessage, 'error').mockImplementation(() => undefined as any)
    getGoodsDetailMock.mockRejectedValueOnce(new Error('load failed'))
    const { router, openGoodsEdit } = await createHarness()

    await expect(openGoodsEdit('goods-1')).resolves.toBe(false)
    expect(router.currentRoute.value.name).toBe('Home')
    expect(errorSpy).toHaveBeenCalledWith('load failed')
    errorSpy.mockRestore()
  })

  it('only navigates for the most recent edit request when responses arrive out of order', async () => {
    let resolveA!: (detail: GoodsDetail) => void
    let resolveB!: (detail: GoodsDetail) => void
    getGoodsDetailMock
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveA = resolve
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveB = resolve
      }))
    const { router, openGoodsEdit } = await createHarness()

    const requestA = openGoodsEdit('goods-a')
    const requestB = openGoodsEdit('goods-b')

    resolveB({ ...makeDetail(), id: 'goods-b' })
    await expect(requestB).resolves.toBe(true)
    expect(router.currentRoute.value.params.id).toBe('goods-b')

    resolveA({ ...makeDetail(), id: 'goods-a' })
    await expect(requestA).resolves.toBe(false)
    expect(router.currentRoute.value.params.id).toBe('goods-b')
  })
})
