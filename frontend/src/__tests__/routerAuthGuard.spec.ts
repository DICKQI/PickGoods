import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { authGuard } from '@/router'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
}))

import * as authApi from '@/api/auth'

const routerSource = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')
const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8')

describe('auth guard and wiring', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('requiresAdmin 判定前先实时复核角色（源码级）', () => {
    const adminBlock = routerSource.slice(routerSource.indexOf('if (requiresAdmin'))
    expect(adminBlock).toContain('await authStore.fetchCurrentUser()')
    expect(adminBlock.indexOf('await authStore.fetchCurrentUser()')).toBeLessThan(
      adminBlock.indexOf('authStore.isAdmin')
    )
  })

  it('main.ts 注册 401 会话清理接线', () => {
    expect(mainSource).toContain('setUnauthorizedCleanup')
    expect(mainSource).toContain('useAuthStore().clearSession()')
  })

  it('行为：非管理员访问 requiresAdmin 路由被导向 Settings', async () => {
    const store = useAuthStore()
    await store.initFromStorage() // 置 initialized（无 token 不发请求）
    store.setToken('tok')
    store.user = { id: 1, username: 'u', role: 'User' } as any
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: 1, username: 'u', role: 'User' } as any)

    const next = vi.fn()
    await authGuard(
      { meta: { requiresAuth: true, requiresAdmin: true }, fullPath: '/admin', name: 'AdminDashboard' } as any,
      {} as any,
      next as any
    )
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith({ name: 'Settings' })
  })

  it('行为：管理员经实时复核后放行', async () => {
    const store = useAuthStore()
    await store.initFromStorage()
    store.setToken('tok')
    store.user = { id: 1, username: 'admin', role: 'Admin' } as any
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ id: 1, username: 'admin', role: 'Admin' } as any)

    const next = vi.fn()
    await authGuard(
      { meta: { requiresAuth: true, requiresAdmin: true }, fullPath: '/admin', name: 'AdminDashboard' } as any,
      {} as any,
      next as any
    )
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
  })

  it('行为：未登录访问 requiresAuth 路由被导向 Login 并携带 redirect', async () => {
    const store = useAuthStore()
    await store.initFromStorage()
    const next = vi.fn()
    await authGuard(
      { meta: { requiresAuth: true }, fullPath: '/showcase', name: 'CloudShowcase' } as any,
      {} as any,
      next as any
    )
    expect(next).toHaveBeenCalledWith({ name: 'Login', query: { redirect: '/showcase' } })
  })
})
