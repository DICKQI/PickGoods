import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  COLLECTOR_DEFAULT_NAV_KEYS,
  MOBILE_NAV_STORAGE_KEY,
  useMobileNavStore,
} from '@/stores/mobileNav'

describe('mobile navigation preferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const createStore = () => {
    setActivePinia(createPinia())
    return useMobileNavStore()
  }

  it('defaults to the requested five entries while keeping category available', () => {
    const store = createStore()

    expect(store.selectedKeys).toEqual(COLLECTOR_DEFAULT_NAV_KEYS)
    expect(store.selectedItems.map(item => item.label)).toEqual([
      '社团',
      '云展柜',
      '位置',
      'IP与角色',
      '主题',
    ])
    expect(store.selectedKeys).not.toContain('category')
  })

  it('persists selections in the fixed product order', () => {
    const store = createStore()

    store.setSelectedKeys(['theme', 'clubs'])

    expect(store.selectedKeys).toEqual(['clubs', 'theme'])
    expect(localStorage.getItem(MOBILE_NAV_STORAGE_KEY)).toBe('["clubs","theme"]')
  })

  it('filters unknown and duplicate stored keys', () => {
    localStorage.setItem(MOBILE_NAV_STORAGE_KEY, JSON.stringify([
      'theme',
      'unknown',
      'clubs',
      'theme',
    ]))

    const store = createStore()

    expect(store.selectedKeys).toEqual(['clubs', 'theme'])
  })

  it('allows category to be enabled as the sixth candidate', () => {
    const store = createStore()

    store.setSelectedKeys([...COLLECTOR_DEFAULT_NAV_KEYS, 'category'])

    expect(store.selectedKeys).toEqual([
      'clubs',
      'showcase',
      'location',
      'ipcharacter',
      'category',
      'theme',
    ])
  })

  it.each([
    ['an empty list', '[]'],
    ['invalid JSON', '{invalid'],
  ])('falls back to defaults for %s', (_label, storedValue) => {
    localStorage.setItem(MOBILE_NAV_STORAGE_KEY, storedValue)

    const store = createStore()

    expect(store.selectedKeys).toEqual(COLLECTOR_DEFAULT_NAV_KEYS)
  })
})
