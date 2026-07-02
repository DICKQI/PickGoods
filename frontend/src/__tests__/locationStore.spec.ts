import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLocationStore } from '@/stores/location'
import type { StorageNode } from '@/api/types'

vi.mock('@/api/location', () => ({
  getLocationTree: vi.fn(),
  getLocationNodeSummary: vi.fn(),
  getLocationUnassignedGoods: vi.fn(),
  moveLocationGoods: vi.fn(),
}))

import { getLocationTree } from '@/api/location'

const makeNodes = (): StorageNode[] => [
  { id: 1, name: '房间', parent: null, path_name: '房间', order: 0, image: null, description: null, goods_count: 0, descendant_goods_count: 2 } as StorageNode,
  { id: 2, name: '柜子', parent: 1, path_name: '房间/柜子', order: 0, image: null, description: null, goods_count: 0, descendant_goods_count: 2 } as StorageNode,
  { id: 3, name: '层1', parent: 2, path_name: '房间/柜子/层1', order: 0, image: null, description: null, goods_count: 1, descendant_goods_count: 1 } as StorageNode,
  { id: 4, name: '层2', parent: 2, path_name: '房间/柜子/层2', order: 1, image: null, description: null, goods_count: 1, descendant_goods_count: 1 } as StorageNode,
]

describe('useLocationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('初始状态', () => {
    const store = useLocationStore()
    expect(store.nodes).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.treeData).toEqual([])
  })

  it('fetchNodes 获取并设置节点', async () => {
    const nodes = makeNodes()
    vi.mocked(getLocationTree).mockResolvedValue(nodes)

    const store = useLocationStore()
    await store.fetchNodes()

    expect(store.nodes).toEqual(nodes)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchNodes 失败时设置 error', async () => {
    vi.mocked(getLocationTree).mockRejectedValue(new Error('网络错误'))

    const store = useLocationStore()
    await store.fetchNodes()

    expect(store.error).toBe('网络错误')
    expect(store.loading).toBe(false)
  })

  it('treeData 自动构建树', async () => {
    vi.mocked(getLocationTree).mockResolvedValue(makeNodes())

    const store = useLocationStore()
    await store.fetchNodes()

    expect(store.treeData).toHaveLength(1) // 1 个根节点
    expect(store.treeData[0]!.label).toBe('房间')
    expect(store.treeData[0]!.children).toHaveLength(1)
  })

  it('getPathById 返回正确路径', async () => {
    vi.mocked(getLocationTree).mockResolvedValue(makeNodes())

    const store = useLocationStore()
    await store.fetchNodes()

    expect(store.getPathById(1)).toBe('房间')
    expect(store.getPathById(3)).toBe('房间 > 柜子 > 层1')
  })

  it('getPathById 空数据返回空字符串', () => {
    const store = useLocationStore()
    expect(store.getPathById(1)).toBe('')
  })

  it('getNodeById 返回节点', async () => {
    vi.mocked(getLocationTree).mockResolvedValue(makeNodes())

    const store = useLocationStore()
    await store.fetchNodes()

    const node = store.getNodeById(2)
    expect(node?.name).toBe('柜子')
  })

  it('getNodeById 不存在返回 undefined', async () => {
    vi.mocked(getLocationTree).mockResolvedValue(makeNodes())

    const store = useLocationStore()
    await store.fetchNodes()

    expect(store.getNodeById(999)).toBeUndefined()
  })

  it('getChildrenIds 递归收集所有后代', async () => {
    vi.mocked(getLocationTree).mockResolvedValue(makeNodes())

    const store = useLocationStore()
    await store.fetchNodes()

    const ids = store.getChildrenIds(2) // 柜子
    expect(ids).toContain(2) // 自身
    expect(ids).toContain(3) // 层1
    expect(ids).toContain(4) // 层2
  })

  it('getChildrenIds 叶子节点只返回自身', async () => {
    vi.mocked(getLocationTree).mockResolvedValue(makeNodes())

    const store = useLocationStore()
    await store.fetchNodes()

    const ids = store.getChildrenIds(3)
    expect(ids).toEqual([3])
  })

  it('getNodeByPathName 可按斜杠路径定位节点', async () => {
    vi.mocked(getLocationTree).mockResolvedValue(makeNodes())

    const store = useLocationStore()
    await store.fetchNodes()

    expect(store.getNodeByPathName('房间/柜子/层1')?.id).toBe(3)
  })

  it('markRecentLocation 将最近位置排在前面并限制数量', async () => {
    vi.mocked(getLocationTree).mockResolvedValue(makeNodes())

    const store = useLocationStore()
    await store.fetchNodes()
    store.markRecentLocation(3)
    store.markRecentLocation(4)
    store.markRecentLocation(3)

    expect(store.recentNodes.map((node) => node.id)).toEqual([3, 4])
  })

  it('favoriteShortcutNodes 只展示前 8 个常用位置', async () => {
    const nodes = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      name: `常用 ${index + 1}`,
      parent: null,
      path_name: `常用 ${index + 1}`,
      order: index,
      image: null,
      description: null,
      goods_count: 0,
      descendant_goods_count: 0,
      is_favorite: true,
    })) as StorageNode[]
    vi.mocked(getLocationTree).mockResolvedValue(nodes)

    const store = useLocationStore()
    await store.fetchNodes()

    expect(store.favoriteShortcutNodes.map((node) => node.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('recentShortcutNodes 排除常用位置并只展示前 5 个', async () => {
    const nodes = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      name: `位置 ${index + 1}`,
      parent: null,
      path_name: `位置 ${index + 1}`,
      order: index,
      image: null,
      description: null,
      goods_count: 0,
      descendant_goods_count: 0,
      is_favorite: [2, 4].includes(index + 1),
    })) as StorageNode[]
    vi.mocked(getLocationTree).mockResolvedValue(nodes)

    const store = useLocationStore()
    await store.fetchNodes()
    ;[1, 2, 3, 4, 5, 6, 7].forEach((id) => store.markRecentLocation(id))

    expect(store.recentShortcutNodes.map((node) => node.id)).toEqual([7, 6, 5, 3, 1])
  })

  it('treeData 保留计数字段用于树节点徽标', async () => {
    vi.mocked(getLocationTree).mockResolvedValue(makeNodes())

    const store = useLocationStore()
    await store.fetchNodes()

    expect(store.treeData[0]!.data?.descendant_goods_count).toBe(2)
    expect(store.treeData[0]!.children![0]!.children![0]!.data?.goods_count).toBe(1)
  })
})
