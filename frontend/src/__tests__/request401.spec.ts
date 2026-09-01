import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ElMessage } from 'element-plus'
import {
  AUTH_TOKEN_KEY,
  handleResponseError,
  resetUnauthorizedRedirectFlag,
  setUnauthorizedCleanup,
} from '@/utils/request'

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}))

describe('handleResponseError 401 处理', () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    resetUnauthorizedRedirectFlag()
    // 替换为普通对象，避免 jsdom 对 location.href 赋值的导航报错
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'http://localhost:5173/showcase',
        pathname: '/showcase',
        search: '',
        origin: 'http://localhost:5173',
        protocol: 'http:',
        hostname: 'localhost',
      },
    })
    localStorage.clear()
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('非认证端点 401：清理存储、调用 cleanup、提示过期并跳转登录页', async () => {
    const cleanup = vi.fn()
    setUnauthorizedCleanup(cleanup)
    localStorage.setItem(AUTH_TOKEN_KEY, 'tok')
    const err = {
      response: { status: 401, data: { detail: 'Invalid token.' } },
      config: { url: '/api/goods/', headers: {} },
    }
    await expect(handleResponseError(err)).rejects.toBe(err)
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    expect(ElMessage.warning).toHaveBeenCalledWith(expect.stringContaining('登录已过期'))
    expect(window.location.href).toContain('/login?redirect=%2Fshowcase')
  })

  it('并发 401 只跳转一次（去重）', async () => {
    const cleanup = vi.fn()
    setUnauthorizedCleanup(cleanup)
    const err = { response: { status: 401 }, config: { url: '/api/goods/', headers: {} } }
    await expect(handleResponseError(err)).rejects.toBe(err)
    await expect(handleResponseError(err)).rejects.toBe(err)
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(ElMessage.warning).toHaveBeenCalledTimes(1)
  })

  it('登录/注册端点 401 不跳转、不清理、不提示（防御性豁免）', async () => {
    const cleanup = vi.fn()
    setUnauthorizedCleanup(cleanup)
    for (const url of ['/api/auth/login/', '/api/auth/register/']) {
      const err = { response: { status: 401 }, config: { url, headers: {} } }
      await expect(handleResponseError(err)).rejects.toBe(err)
    }
    expect(cleanup).not.toHaveBeenCalled()
    expect(ElMessage.warning).not.toHaveBeenCalled()
    expect(window.location.href).toBe('http://localhost:5173/showcase')
  })

  it('403 保持原有全局提示分支', async () => {
    const err = { response: { status: 403, data: {} }, config: { url: '/api/admin/users/', headers: {} } }
    await expect(handleResponseError(err)).rejects.toBe(err)
    expect(ElMessage.error).toHaveBeenCalledWith('无权限访问')
  })
})

describe('handleResponseError 429 处理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('优先透传后端 detail 并保留原始错误', async () => {
    const err = {
      response: {
        status: 429,
        data: { detail: '请求被限流，请在 42 秒后重试' },
        headers: { 'retry-after': '42' },
      },
      config: { url: '/api/auth/register/' },
    }
    await expect(handleResponseError(err)).rejects.toBe(err)
    expect(ElMessage.warning).toHaveBeenCalledWith('请求被限流，请在 42 秒后重试')
  })

  it('无 detail 时使用 Retry-After 生成提示', async () => {
    const err = {
      response: { status: 429, data: {}, headers: { 'retry-after': '8.2' } },
      config: { url: '/api/clubs/' },
    }
    await expect(handleResponseError(err)).rejects.toBe(err)
    expect(ElMessage.warning).toHaveBeenCalledWith('请求过于频繁，请在 9 秒后重试')
  })
})
