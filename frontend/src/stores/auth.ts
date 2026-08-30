import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth'
import type { AuthTokenResponse, RegistrationPending, UserInfo } from '@/api/types'
import { AUTH_TOKEN_KEY } from '@/utils/request'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<UserInfo | null>(null)
  const loading = ref(false)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role?.trim().toLowerCase() === 'admin')
  const isClub = computed(() => !isAdmin.value && user.value?.account_type === 'club')
  const isCollector = computed(() => isAdmin.value || user.value?.account_type === 'collector')

  function setToken(value: string | null) {
    token.value = value
    if (typeof window !== 'undefined') {
      if (value) {
        localStorage.setItem(AUTH_TOKEN_KEY, value)
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY)
      }
    }
  }

  async function initFromStorage() {
    if (initialized.value) return
    initialized.value = true
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!saved) return
    token.value = saved
    try {
      const data = await authApi.getCurrentUser()
      user.value = data
    } catch {
      token.value = null
      user.value = null
      localStorage.removeItem(AUTH_TOKEN_KEY)
    }
  }

  async function login(username: string, password: string) {
    loading.value = true
    try {
      const data = await authApi.login({ username, password })
      setToken(data.access_token)
      const me = await authApi.getCurrentUser()
      user.value = me
    } finally {
      loading.value = false
    }
  }

  async function registerAndLogin(username: string, password: string) {
    loading.value = true
    try {
      const data = await authApi.register({ username, password, account_type: 'collector' }) as AuthTokenResponse
      setToken(data.access_token)
      const me = await authApi.getCurrentUser()
      user.value = me
    } finally {
      loading.value = false
    }
  }

  async function registerAccount(data: {
    username: string
    password: string
    account_type: 'collector' | 'club'
    application_reason?: string
    club_profile?: Record<string, unknown>
  }): Promise<RegistrationPending | null> {
    loading.value = true
    try {
      const result = await authApi.register(data)
      if (typeof (result as unknown as { access_token?: unknown }).access_token === 'string') {
        setToken((result as { access_token: string }).access_token)
        user.value = await authApi.getCurrentUser()
        return null
      }
      return result as RegistrationPending
    } finally {
      loading.value = false
    }
  }

  /** 清空会话内存态并删除本地 token（401 清理与登出共用的唯一入口） */
  function clearSession() {
    token.value = null
    user.value = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY)
    }
  }

  /** 刷新用户信息；成功返回 true，失败（网络错误等）返回 false 并保留原 user。
   *  token 真失效时请求会 401，由请求拦截器统一处理会话清理与跳转。 */
  async function fetchCurrentUser(): Promise<boolean> {
    if (!token.value) return false
    try {
      const data = await authApi.getCurrentUser()
      user.value = data
      return true
    } catch {
      // 保留原 user：网络/瞬时错误不降级角色
      return false
    }
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // 忽略登出接口失败（如网络错误），仍清除本地状态
    } finally {
      clearSession()
      if (typeof window !== 'undefined') {
        const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || ''
        const loginPath = base ? `${base}/login` : '/login'
        window.location.href = loginPath.startsWith('http') ? loginPath : `${window.location.origin}${loginPath}`
      }
    }
  }

  return {
    token,
    user,
    loading,
    initialized,
    isAuthenticated,
    isAdmin,
    isClub,
    isCollector,
    initFromStorage,
    login,
    registerAndLogin,
    registerAccount,
    fetchCurrentUser,
    logout,
    setToken,
    clearSession,
  }
})
