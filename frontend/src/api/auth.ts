import request from '@/utils/request'
import type { AccountUpdatePayload, AuthTokenResponse, CaptchaChallenge, RegisterPayload, RegistrationPending, UserInfo } from './types'

/** 注册（创建用户并返回 Token） */
export function register(data: RegisterPayload) {
  return request.post<AuthTokenResponse | RegistrationPending>('/api/auth/register/', data)
}

/** 获取注册验证码 challenge。 */
export function getCaptcha() {
  return request.get<CaptchaChallenge>('/api/auth/captcha/')
}

/** 登录（返回 Token） */
export function login(data: { username: string; password: string }) {
  return request.post<AuthTokenResponse>('/api/auth/login/', data)
}

/** 获取当前登录用户信息（需携带 Token） */
export function getCurrentUser() {
  return request.get<UserInfo>('/api/auth/me/')
}

/** 修改当前账号的登录名或密码，需验证当前密码。 */
export function updateCurrentAccount(data: AccountUpdatePayload) {
  return request.patch<UserInfo>('/api/auth/me/', data, { suppressGlobalError: true })
}

/** 上传当前用户头像。 */
export function uploadCurrentUserAvatar(file: File) {
  const form = new FormData()
  form.append('avatar', file)
  return request.post<UserInfo>('/api/auth/me/avatar/', form, { suppressGlobalError: true })
}

/** 删除当前用户头像并恢复默认首字母头像。 */
export function removeCurrentUserAvatar() {
  return request.delete<UserInfo>('/api/auth/me/avatar/', { suppressGlobalError: true })
}

/** 登出（需携带 Token，成功后前端清除本地 Token） */
export function logout() {
  return request.delete('/api/auth/logout/')
}
