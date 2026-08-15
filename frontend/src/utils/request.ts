import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

interface RequestConfig extends AxiosRequestConfig {
  suppressGlobalError?: boolean
}

// API基础URL存储键名
const API_BASE_URL_KEY = 'pickgoods_api_base_url'
const LEGACY_API_BASE_URL_KEY = 'shigu_api_base_url'

// 认证 Token 存储键名（与 auth store 共用）
export const AUTH_TOKEN_KEY = 'pickgoods_access_token'

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

const migrateLegacyBaseURLIfNeeded = (): void => {
  if (typeof window === 'undefined') return
  try {
    const current = localStorage.getItem(API_BASE_URL_KEY)
    if (current) return
    const legacy = localStorage.getItem(LEGACY_API_BASE_URL_KEY)
    if (!legacy) return
    localStorage.setItem(API_BASE_URL_KEY, legacy)
  } catch {
    // ignore storage errors (e.g. privacy mode)
  }
}

// 获取默认的API基础URL
const getDefaultBaseURL = (): string => {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000`
  }
  return 'http://127.0.0.1:8000'
}

// 获取API基础URL（优先从localStorage读取，其次从环境变量，最后使用默认值）
const getBaseURL = (): string => {
  if (typeof window !== 'undefined') {
    migrateLegacyBaseURLIfNeeded()
    const savedURL = localStorage.getItem(API_BASE_URL_KEY) || localStorage.getItem(LEGACY_API_BASE_URL_KEY)
    if (savedURL) {
      return savedURL
    }
  }
  return import.meta.env.VITE_API_BASE_URL || getDefaultBaseURL()
}

// 创建axios实例
const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 每次请求时动态获取baseURL（支持运行时修改）
    if (typeof window !== 'undefined') {
      migrateLegacyBaseURLIfNeeded()
      const savedURL = localStorage.getItem(API_BASE_URL_KEY) || localStorage.getItem(LEGACY_API_BASE_URL_KEY)
      if (savedURL) {
        config.baseURL = savedURL
      } else {
        config.baseURL = import.meta.env.VITE_API_BASE_URL || getDefaultBaseURL()
      }
    }
    
    // 如果是FormData，让浏览器自动设置Content-Type（包含boundary）
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    
    const token = getAuthToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: any) => {
    return Promise.reject(error)
  }
)

// ==================== 401 统一处理（可测试）====================

type UnauthorizedCleanup = () => void

let unauthorizedCleanup: UnauthorizedCleanup | null = null
// 注意：该标志依赖「整页跳转卸载页面」来重置模块状态；若未来改为 SPA 内导航，需在登录成功后复位
let redirectingToLogin = false

/** 注册 401 时的会话清理回调（main.ts 中注册为 authStore.clearSession） */
export function setUnauthorizedCleanup(fn: UnauthorizedCleanup | null) {
  unauthorizedCleanup = fn
}

/** 仅供测试：重置 401 去重标志 */
export function resetUnauthorizedRedirectFlag() {
  redirectingToLogin = false
}

/** 认证接口自身返回 401 表示凭据错误，不触发会话过期跳转（防御后端回归）。
 *  按精确路径匹配（去 query、去尾斜杠），避免子串误伤未来新增端点。 */
const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register']
function isAuthRequest(config: any): boolean {
  const url = (String(config?.url || '').split('?')[0] ?? '').replace(/\/+$/, '')
  return AUTH_ENDPOINTS.includes(url)
}

function redirectToLogin() {
  if (typeof window === 'undefined') return
  const redirect = encodeURIComponent(window.location.pathname + window.location.search)
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || ''
  const loginPath = base ? `${base}/login` : '/login'
  window.location.href = `${window.location.origin}${loginPath}?redirect=${redirect}`
}

export function handleResponseError(error: any): Promise<any> {
  const status = error.response?.status
  const suppressGlobalError = Boolean(error.config?.suppressGlobalError)

  // 401 始终全局处理（token 失效优先级最高），不受 suppressGlobalError 影响
  if (status === 401 && !isAuthRequest(error.config)) {
    if (typeof window !== 'undefined' && !redirectingToLogin) {
      redirectingToLogin = true
      unauthorizedCleanup?.()
      localStorage.removeItem(AUTH_TOKEN_KEY)
      ElMessage.warning('登录已过期，请重新登录')
      redirectToLogin()
    }
    return Promise.reject(error)
  }
  if (suppressGlobalError) {
    return Promise.reject(error)
  }
  // 处理 403：无权限
  if (status === 403) {
    ElMessage.error('无权限访问')
    return Promise.reject(error)
  }
  // 处理限流错误
  if (status === 429) {
    ElMessage.warning('搜索太快了，请稍后再试')
    return Promise.reject(error)
  }
  // 409 由业务层（如谷子新建去重弹窗）单独处理，不弹全局错误
  if (status === 409) {
    return Promise.reject(error)
  }
  // 处理其他错误
  const message = error.response?.data?.detail || error.message || '请求失败'
  ElMessage.error(message)
  return Promise.reject(error)
}

// 响应拦截器
axiosInstance.interceptors.response.use(
  <T = any>(response: AxiosResponse<T>) => {
    return response.data
  },
  (error: any) => {
    return handleResponseError(error)
  }
)

// 创建自定义请求接口，返回类型为 T 而不是 AxiosResponse<T>
interface CustomAxiosInstance {
  get<T = any>(url: string, config?: RequestConfig): Promise<T>
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>
  delete<T = any>(url: string, config?: RequestConfig): Promise<T>
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>
}

const request = axiosInstance as unknown as CustomAxiosInstance

// 更新API基础URL的函数
export const updateBaseURL = (url: string): void => {
  if (typeof window !== 'undefined') {
    // 验证URL格式
    try {
      new URL(url)
      localStorage.setItem(API_BASE_URL_KEY, url)
      // 更新axios实例的baseURL
      axiosInstance.defaults.baseURL = url
    } catch (error) {
      throw new Error('无效的URL格式')
    }
  }
}

// 获取当前API基础URL的函数
export const getCurrentBaseURL = (): string => {
  return getBaseURL()
}

// 重置API基础URL为默认值的函数
export const resetBaseURL = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(API_BASE_URL_KEY)
    localStorage.removeItem(LEGACY_API_BASE_URL_KEY)
    const defaultURL = import.meta.env.VITE_API_BASE_URL || getDefaultBaseURL()
    axiosInstance.defaults.baseURL = defaultURL
  }
}

export default request
