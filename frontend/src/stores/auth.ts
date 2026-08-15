import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth'
import type { UserInfo } from '@/api/types'
import { AUTH_TOKEN_KEY } from '@/utils/request'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<UserInfo | null>(null)
  const loading = ref(false)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role?.trim().toLowerCase() === 'admin')

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
      const data = await authApi.register({ username, password })
      setToken(data.access_token)
      const me = await authApi.getCurrentUser()
      user.value = me
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

  async function fetchCurrentUser() {
    if (!token.value) return
    try {
      const data = await authApi.getCurrentUser()
      user.value = data
    } catch {
      // 保留原 user：网络/瞬时错误不降级角色；token 真失效由 401 拦截器统一处理
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
    initFromStorage,
    login,
    registerAndLogin,
    fetchCurrentUser,
    logout,
    setToken,
    clearSession,
  }
})
