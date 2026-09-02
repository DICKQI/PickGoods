import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Component } from 'vue'
import { Box, Collection, FolderOpened, Grid, Shop, Star, User } from '@element-plus/icons-vue'

export const MOBILE_NAV_STORAGE_KEY = 'pickgoods:mobile-bottom-nav'

export const COLLECTOR_NAV_KEYS = [
  'clubs',
  'showcase',
  'location',
  'ipcharacter',
  'category',
  'theme',
] as const

export type CollectorNavKey = typeof COLLECTOR_NAV_KEYS[number]

export interface CollectorNavItem {
  key: CollectorNavKey
  path: string
  label: string
  icon: Component
}

export interface ClubNavItem {
  path: string
  label: string
  icon: Component
}

export const COLLECTOR_DEFAULT_NAV_KEYS: CollectorNavKey[] = [
  'clubs',
  'showcase',
  'location',
  'ipcharacter',
  'theme',
]

export const COLLECTOR_NAV_ITEMS: readonly CollectorNavItem[] = [
  { key: 'clubs', path: '/clubs', label: '社团', icon: Shop },
  { key: 'showcase', path: '/showcase', label: '云展柜', icon: Grid },
  { key: 'location', path: '/location', label: '位置', icon: FolderOpened },
  { key: 'ipcharacter', path: '/ipcharacter', label: 'IP与角色', icon: Collection },
  { key: 'category', path: '/category', label: '品类', icon: Box },
  { key: 'theme', path: '/theme', label: '主题', icon: Star },
]

export const CLUB_NAV_ITEMS: readonly ClubNavItem[] = [
  { path: '/club/goods', label: '社团谷子', icon: Shop },
  { path: '/club/popularity', label: '人气', icon: Grid },
  { path: '/club/profile', label: '资料', icon: User },
  { path: '/clubs', label: '社团', icon: Shop },
]

const normalizeKeys = (value: unknown): CollectorNavKey[] => {
  if (!Array.isArray(value)) return [...COLLECTOR_DEFAULT_NAV_KEYS]

  const validKeys = new Set<CollectorNavKey>(COLLECTOR_NAV_KEYS)
  const selected = value.filter((key): key is CollectorNavKey => (
    typeof key === 'string' && validKeys.has(key as CollectorNavKey)
  ))
  const unique = COLLECTOR_NAV_KEYS.filter(key => selected.includes(key))

  return unique.length > 0 ? unique : [...COLLECTOR_DEFAULT_NAV_KEYS]
}

const readStoredKeys = (): CollectorNavKey[] => {
  if (typeof window === 'undefined') return [...COLLECTOR_DEFAULT_NAV_KEYS]

  try {
    const raw = window.localStorage.getItem(MOBILE_NAV_STORAGE_KEY)
    return raw ? normalizeKeys(JSON.parse(raw)) : [...COLLECTOR_DEFAULT_NAV_KEYS]
  } catch {
    return [...COLLECTOR_DEFAULT_NAV_KEYS]
  }
}

export const useMobileNavStore = defineStore('mobileNav', () => {
  const selectedKeys = ref<CollectorNavKey[]>(readStoredKeys())

  const selectedItems = computed(() => COLLECTOR_NAV_ITEMS.filter(item => selectedKeys.value.includes(item.key)))

  const persist = () => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(MOBILE_NAV_STORAGE_KEY, JSON.stringify(selectedKeys.value))
    } catch {
      // The in-memory preference remains usable when browser storage is unavailable.
    }
  }

  const setSelectedKeys = (keys: readonly CollectorNavKey[]) => {
    selectedKeys.value = normalizeKeys(keys)
    persist()
  }

  const resetToDefault = () => {
    setSelectedKeys(COLLECTOR_DEFAULT_NAV_KEYS)
  }

  const isSelected = (key: CollectorNavKey) => selectedKeys.value.includes(key)

  const isOnlySelected = (key: CollectorNavKey) => (
    selectedKeys.value.length === 1 && selectedKeys.value[0] === key
  )

  return {
    selectedKeys,
    selectedItems,
    setSelectedKeys,
    resetToDefault,
    isSelected,
    isOnlySelected,
  }
})
