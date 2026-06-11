import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLocationStore } from '@/stores/location'
import type { StorageNode } from '@/api/types'

vi.mock('@/api/location', () => ({
  getLocationTree: vi.fn(),
}))

import { getLocationTree } from '@/api/location'

const makeNodes = (): StorageNode[] => [
  { id: 1, name: '房间', parent: null, path_name: '房间', order: 0, image: null, description: null } as StorageNode,
  { id: 2, name: '柜子', parent: 1, path_name: '房间/柜子', order: 0, image: null, description: null } as StorageNode,
  { id: 3, name: '层1', parent: 2, path_name: '房间/柜子/层1', order: 0, image: null, description: null } as StorageNode,
  { id: 4, name: '层2', parent: 2, path_name: '房间/柜子/层2', order: 1, image: null, description: null } as StorageNode,
]

describe('useLocationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
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
    expect(store.treeData[0].label).toBe('房间')
    expect(store.treeData[0].children).toHaveLength(1)
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
})
