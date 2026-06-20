import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMetadataStore } from '@/stores/metadata'
import { AUTH_TOKEN_KEY } from '@/utils/request'
import { getThemeList } from '@/api/metadata'

vi.mock('@/api/metadata', () => ({
  getIPList: vi.fn(),
  getIPCharacters: vi.fn(),
  getCategoryList: vi.fn(),
  getThemeList: vi.fn(),
}))

describe('useMetadataStore cache ownership', () => {
  const cacheOwnerFor = (token: string) => `${token.length}:${token.slice(-16)}`

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('does not reuse cached themes from a different auth token', async () => {
    localStorage.setItem('metadata_themes', JSON.stringify([{ id: 1, name: '旧用户主题' }]))
    localStorage.setItem(AUTH_TOKEN_KEY, 'new-user-token')
    vi.mocked(getThemeList).mockResolvedValue([{ id: 2, name: '当前用户主题' } as any])

    const store = useMetadataStore()
    const themes = await store.fetchThemes()

    expect(themes).toEqual([{ id: 2, name: '当前用户主题' }])
    expect(getThemeList).toHaveBeenCalledTimes(1)
    expect(store.themes).toEqual([{ id: 2, name: '当前用户主题' }])
  })

  it('reuses cached themes for the same auth token', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'same-user-token')
    localStorage.setItem('metadata_cache_owner', cacheOwnerFor('same-user-token'))
    localStorage.setItem('metadata_themes', JSON.stringify([{ id: 3, name: '当前用户缓存' }]))

    const store = useMetadataStore()
    const themes = await store.fetchThemes()

    expect(themes).toEqual([{ id: 3, name: '当前用户缓存' }])
    expect(getThemeList).not.toHaveBeenCalled()
  })
})
