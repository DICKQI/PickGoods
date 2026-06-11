import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { AUTH_TOKEN_KEY } from '@/utils/request'

// Mock API modules
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
}))

import * as authApi from '@/api/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('初始状态', () => {
    const store = useAuthStore()
    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.isAdmin).toBe(false)
    expect(store.loading).toBe(false)
    expect(store.initialized).toBe(false)
  })

  it('setToken 设置 token 并存入 localStorage', () => {
    const store = useAuthStore()
    store.setToken('abc123')
    expect(store.token).toBe('abc123')
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('abc123')
  })

  it('setToken(null) 清除 token 和 localStorage', () => {
    const store = useAuthStore()
    store.setToken('abc123')
    store.setToken(null)
    expect(store.token).toBeNull()
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('isAuthenticated 响应式变化', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
    store.setToken('tok')
    expect(store.isAuthenticated).toBe(true)
    store.setToken(null)
    expect(store.isAuthenticated).toBe(false)
  })

  it('isAdmin 对 admin 角色返回 true', () => {
    const store = useAuthStore()
    store.user = { id: 1, username: 'admin', role: 'Admin' } as any
    expect(store.isAdmin).toBe(true)
  })

  it('isAdmin 对普通用户返回 false', () => {
    const store = useAuthStore()
    store.user = { id: 1, username: 'user', role: 'User' } as any
    expect(store.isAdmin).toBe(false)
  })

  it('isAdmin 大小写不敏感', () => {
    const store = useAuthStore()
    store.user = { id: 1, username: 'a', role: 'ADMIN' } as any
    expect(store.isAdmin).toBe(true)
  })

  it('login 成功设置 token 和 user', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ access_token: 'tok123', token_type: 'Bearer', expires_in: 3600 })
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: 1, username: 'test', role: 'User' } as any)

    const store = useAuthStore()
    await store.login('test', 'pass')

    expect(store.token).toBe('tok123')
    expect(store.user?.username).toBe('test')
    expect(store.loading).toBe(false)
  })

  it('registerAndLogin 成功设置 token 和 user', async () => {
    vi.mocked(authApi.register).mockResolvedValue({ access_token: 'reg_tok', token_type: 'Bearer', expires_in: 3600 })
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: 2, username: 'new', role: 'User' } as any)

    const store = useAuthStore()
    await store.registerAndLogin('new', 'pass')

    expect(store.token).toBe('reg_tok')
    expect(store.user?.username).toBe('new')
  })

  it('initFromStorage 从 localStorage 恢复', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'saved_tok')
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: 3, username: 'saved', role: 'User' } as any)

    const store = useAuthStore()
    await store.initFromStorage()

    expect(store.token).toBe('saved_tok')
    expect(store.user?.username).toBe('saved')
    expect(store.initialized).toBe(true)
  })

  it('initFromStorage API 失败时清除状态', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'bad_tok')
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('401'))

    const store = useAuthStore()
    await store.initFromStorage()

    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('initFromStorage 无 token 时不调用 API', async () => {
    const store = useAuthStore()
    await store.initFromStorage()
    expect(authApi.getCurrentUser).not.toHaveBeenCalled()
  })
})
