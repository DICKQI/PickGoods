import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLocationTree } from '@/api/location'
import { AUTH_TOKEN_KEY } from '@/utils/request'
import type { StorageNode } from '@/api/types'
import { buildTree, getPathById as getPathByIdUtil, type TreeNode } from '@/utils/tree'

const CACHE_KEY = 'location_tree'
const CACHE_OWNER_KEY = 'location_tree_owner'
const CACHE_TIMESTAMP_KEY = 'location_tree_ts'
const RECENT_LOCATION_KEY = 'location_recent_nodes'
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes
const RECENT_LIMIT = 8
const FAVORITE_SHORTCUT_LIMIT = 8
const RECENT_SHORTCUT_LIMIT = 5

const getCacheOwner = () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  return token ? `${token.length}:${token.slice(-16)}` : 'anonymous'
}

const ensureCacheOwner = () => {
  const owner = getCacheOwner()
  const cachedOwner = localStorage.getItem(CACHE_OWNER_KEY)
  if (cachedOwner !== owner && cachedOwner !== null) {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_TIMESTAMP_KEY)
  }
  if (cachedOwner !== owner) {
    localStorage.setItem(CACHE_OWNER_KEY, owner)
  }
}

export const useLocationStore = defineStore('location', () => {
  // 状态
  const nodes = ref<StorageNode[]>([])
  const recentNodeIds = ref<number[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性：树结构
  const treeData = computed<TreeNode[]>(() => {
    if (nodes.value.length === 0) return []
    return buildTree(nodes.value)
  })

  const favoriteNodes = computed(() => nodes.value.filter((node) => node.is_favorite))
  const recentNodes = computed(() =>
    recentNodeIds.value
      .map((id) => nodes.value.find((node) => node.id === id))
      .filter((node): node is StorageNode => Boolean(node)),
  )
  const favoriteShortcutNodes = computed(() => favoriteNodes.value.slice(0, FAVORITE_SHORTCUT_LIMIT))
  const recentShortcutNodes = computed(() => {
    const favoriteIds = new Set(favoriteNodes.value.map((node) => node.id))
    return recentNodes.value
      .filter((node) => !favoriteIds.has(node.id))
      .slice(0, RECENT_SHORTCUT_LIMIT)
  })

  function loadRecentLocations() {
    try {
      const value = localStorage.getItem(RECENT_LOCATION_KEY)
      const parsed = value ? JSON.parse(value) : []
      recentNodeIds.value = Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === 'number').slice(0, RECENT_LIMIT)
        : []
    } catch {
      recentNodeIds.value = []
    }
  }

  function persistRecentLocations() {
    localStorage.setItem(RECENT_LOCATION_KEY, JSON.stringify(recentNodeIds.value.slice(0, RECENT_LIMIT)))
  }

  // 获取位置树数据
  async function fetchNodes(force = false) {
    if (loading.value) return

    // 内存中已有数据且未过期则跳过（强制刷新时忽略缓存）
    if (!force && nodes.value.length > 0) {
      const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY)
      if (ts) {
        const elapsed = Date.now() - Number(ts)
        if (elapsed < CACHE_TTL) return
      }
    }

    // 尝试从 localStorage 恢复
    ensureCacheOwner()
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        nodes.value = JSON.parse(cached)
      } catch { /* ignore corrupt cache */ }
    }

    loading.value = true
    error.value = null

    try {
      const data = await getLocationTree()
      nodes.value = data
      loadRecentLocations()
      ensureCacheOwner()
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()))
    } catch (err: any) {
      error.value = err.message || '获取位置树失败'
      console.error('获取位置树失败:', err)
    } finally {
      loading.value = false
    }
  }

  // 根据ID获取完整路径
  function getPathById(id: number): string {
    if (nodes.value.length === 0) return ''
    return getPathByIdUtil(nodes.value, id)
  }

  // 根据ID获取节点
  function getNodeById(id: number): StorageNode | undefined {
    return nodes.value.find((node) => node.id === id)
  }

  function getNodeByPathName(pathName: string): StorageNode | undefined {
    const normalized = pathName.trim()
    if (!normalized) return undefined
    return nodes.value.find((node) => node.path_name === normalized)
  }

  function markRecentLocation(id: number | null | undefined) {
    if (!id) return
    recentNodeIds.value = [id, ...recentNodeIds.value.filter((item) => item !== id)].slice(0, RECENT_LIMIT)
    persistRecentLocations()
  }

  // 获取某个节点的所有子节点ID
  function getChildrenIds(parentId: number): number[] {
    const ids: number[] = [parentId]
    const findChildren = (id: number) => {
      nodes.value.forEach((node) => {
        if (node.parent === id) {
          ids.push(node.id)
          findChildren(node.id)
        }
      })
    }
    findChildren(parentId)
    return ids
  }

  return {
    nodes,
    recentNodeIds,
    loading,
    error,
    treeData,
    favoriteNodes,
    recentNodes,
    favoriteShortcutNodes,
    recentShortcutNodes,
    fetchNodes,
    getPathById,
    getNodeById,
    getNodeByPathName,
    markRecentLocation,
    getChildrenIds,
  }
})
