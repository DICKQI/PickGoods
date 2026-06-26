import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getIPList, getIPCharacters, getCategoryList, getThemeList } from '@/api/metadata'
import { AUTH_TOKEN_KEY } from '@/utils/request'
import type { IP, Character, Category, Theme } from '@/api/types'

const CACHE_KEYS = {
  IPS: 'metadata_ips',
  CHARACTERS_BY_IP: 'metadata_characters_by_ip',
  CATEGORIES: 'metadata_categories',
  CATEGORIES_BY_SCOPE: 'metadata_categories_by_scope',
  THEMES: 'metadata_themes',
  OWNER: 'metadata_cache_owner',
  TIMESTAMPS: 'metadata_cache_timestamps',
}

const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

type CategoryListParams = Parameters<typeof getCategoryList>[0]

export const useMetadataStore = defineStore('metadata', () => {
  const ips = ref<IP[]>([])
  const charactersByIP = ref<Record<number, Character[]>>({}) // 使用 Map 结构存储
  const categories = ref<Category[]>([])
  const categoriesByScope = ref<Record<string, Category[]>>({})
  const themes = ref<Theme[]>([])
  const lastFetched = ref<Record<string, number>>({})
  const loading = ref(false)

  const getCacheOwner = () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    return token ? `${token.length}:${token.slice(-16)}` : 'anonymous'
  }

  const hasCachedMetadata = () => Boolean(
    localStorage.getItem(CACHE_KEYS.IPS) ||
    localStorage.getItem(CACHE_KEYS.CHARACTERS_BY_IP) ||
    localStorage.getItem(CACHE_KEYS.CATEGORIES) ||
    localStorage.getItem(CACHE_KEYS.THEMES)
  )

  const clearMemory = () => {
    ips.value = []
    charactersByIP.value = {}
    categories.value = []
    themes.value = []
    lastFetched.value = {}
  }

  const removeCachedMetadata = () => {
    localStorage.removeItem(CACHE_KEYS.IPS)
    localStorage.removeItem(CACHE_KEYS.CHARACTERS_BY_IP)
    localStorage.removeItem(CACHE_KEYS.CATEGORIES)
    localStorage.removeItem(CACHE_KEYS.CATEGORIES_BY_SCOPE)
    localStorage.removeItem(CACHE_KEYS.THEMES)
    localStorage.removeItem(CACHE_KEYS.TIMESTAMPS)
  }

  const categoryScopeKey = (params?: CategoryListParams) => (
    params?.goods_count_scope === 'all' ? 'all' : 'default'
  )

  const ensureCacheOwner = () => {
    const owner = getCacheOwner()
    const cachedOwner = localStorage.getItem(CACHE_KEYS.OWNER)
    if (cachedOwner !== owner && (cachedOwner !== null || hasCachedMetadata())) {
      clearMemory()
      removeCachedMetadata()
    }
    if (cachedOwner !== owner) {
      localStorage.setItem(CACHE_KEYS.OWNER, owner)
    }
  }

  const isCacheFresh = (key: string): boolean => {
    const ts = lastFetched.value[key]
    if (!ts) return false
    return Date.now() - ts < CACHE_TTL
  }

  const markFetched = (key: string) => {
    lastFetched.value = { ...lastFetched.value, [key]: Date.now() }
    try {
      localStorage.setItem(CACHE_KEYS.TIMESTAMPS, JSON.stringify(lastFetched.value))
    } catch { /* ignore */ }
  }

  // 初始化时从本地缓存加载
  const loadFromCache = () => {
    try {
      ensureCacheOwner()

      const cachedTimestamps = localStorage.getItem(CACHE_KEYS.TIMESTAMPS)
      if (cachedTimestamps) lastFetched.value = JSON.parse(cachedTimestamps)

      const cachedIps = localStorage.getItem(CACHE_KEYS.IPS)
      if (cachedIps) ips.value = JSON.parse(cachedIps)

      const cachedCharacters = localStorage.getItem(CACHE_KEYS.CHARACTERS_BY_IP)
      if (cachedCharacters) charactersByIP.value = JSON.parse(cachedCharacters)

      const cachedCategories = localStorage.getItem(CACHE_KEYS.CATEGORIES)
      const cachedCategoriesByScope = localStorage.getItem(CACHE_KEYS.CATEGORIES_BY_SCOPE)
      if (cachedCategoriesByScope) {
        categoriesByScope.value = JSON.parse(cachedCategoriesByScope)
        categories.value = categoriesByScope.value.default || []
      } else if (cachedCategories) {
        const parsedCategories = JSON.parse(cachedCategories)
        categories.value = parsedCategories
        categoriesByScope.value = { default: parsedCategories }
      }

      const cachedThemes = localStorage.getItem(CACHE_KEYS.THEMES)
      if (cachedThemes) themes.value = JSON.parse(cachedThemes)

      // 为旧缓存（无时间戳）补上当前时间作为起始点，避免旧数据永不过期
      const now = Date.now()
      let timestampsUpdated = false
      const ensureTs = (key: string) => {
        if (!lastFetched.value[key]) {
          lastFetched.value = { ...lastFetched.value, [key]: now }
          timestampsUpdated = true
        }
      }
      if (ips.value.length > 0) ensureTs('ips')
      if (themes.value.length > 0) ensureTs('themes')
      if (categories.value.length > 0) ensureTs('categories:default')
      for (const ipId of Object.keys(charactersByIP.value)) {
        ensureTs(`characters:${ipId}`)
      }
      if (timestampsUpdated) {
        localStorage.setItem(CACHE_KEYS.TIMESTAMPS, JSON.stringify(lastFetched.value))
      }
    } catch (e) {
      console.error('Failed to load metadata from cache', e)
    }
  }

  // 保存到本地缓存
  const saveToCache = (key: string, data: any) => {
    try {
      ensureCacheOwner()
      localStorage.setItem(key, JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save metadata to cache', e)
    }
  }

  const fetchIPs = async (force = false) => {
    ensureCacheOwner()
    if (!force && ips.value.length > 0 && isCacheFresh('ips')) return ips.value
    try {
      const data = await getIPList()
      ips.value = data
      markFetched('ips')
      saveToCache(CACHE_KEYS.IPS, data)
      return data
    } catch (error) {
      console.error('Failed to fetch IPs', error)
      throw error
    }
  }

  // 按需获取指定 IP 的角色
  const fetchIPCharacters = async (ipId: number, force = false) => {
    ensureCacheOwner()
    const cacheKey = `characters:${ipId}`
    if (!force && charactersByIP.value[ipId] && isCacheFresh(cacheKey)) return charactersByIP.value[ipId]
    
    try {
      const data = await getIPCharacters(ipId)
      
      charactersByIP.value = {
        ...charactersByIP.value,
        [ipId]: data
      }
      
      markFetched(cacheKey)
      saveToCache(CACHE_KEYS.CHARACTERS_BY_IP, charactersByIP.value)
      return data
    } catch (error) {
      console.error(`Failed to fetch Characters for IP ${ipId}`, error)
      throw error
    }
  }

  const fetchCategories = async (force = false, params?: CategoryListParams) => {
    ensureCacheOwner()
    const scopeKey = categoryScopeKey(params)
    const cacheKey = `categories:${scopeKey}`
    const cachedCategories = categoriesByScope.value[scopeKey]
    if (!force && cachedCategories && cachedCategories.length > 0 && isCacheFresh(cacheKey)) {
      categories.value = cachedCategories
      return categories.value
    }
    try {
      const data = await getCategoryList(params)
      categoriesByScope.value = {
        ...categoriesByScope.value,
        [scopeKey]: data,
      }
      categories.value = data
      markFetched(cacheKey)
      saveToCache(CACHE_KEYS.CATEGORIES_BY_SCOPE, categoriesByScope.value)
      if (scopeKey === 'default') {
        saveToCache(CACHE_KEYS.CATEGORIES, data)
      }
      return data
    } catch (error) {
      console.error('Failed to fetch Categories', error)
      throw error
    }
  }

  const fetchThemes = async (force = false) => {
    ensureCacheOwner()
    if (!force && themes.value.length > 0 && isCacheFresh('themes')) return themes.value
    try {
      const data = await getThemeList()
      themes.value = data
      markFetched('themes')
      saveToCache(CACHE_KEYS.THEMES, data)
      return data
    } catch (error) {
      console.error('Failed to fetch Themes', error)
      throw error
    }
  }

  const fetchAll = async (force = false) => {
    loading.value = true
    try {
      await Promise.all([
        fetchIPs(force),
        // fetchCharacters(force), // 不再预加载所有角色
        fetchCategories(force),
        fetchThemes(force)
      ])
    } finally {
      loading.value = false
    }
  }

  const clearCache = () => {
    clearMemory()
    removeCachedMetadata()
    localStorage.removeItem(CACHE_KEYS.OWNER)
  }

  // 自动加载缓存
  loadFromCache()

  return {
    ips,
    charactersByIP,
    categories,
    categoriesByScope,
    themes,
    loading,
    fetchIPs,
    fetchIPCharacters,
    fetchCategories,
    fetchThemes,
    fetchAll,
    clearCache
  }
})
