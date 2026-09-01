import request from '@/utils/request'
import type { AuthTokenResponse, CaptchaChallenge, RegisterPayload, RegistrationPending, UserInfo } from './types'

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

/** 登出（需携带 Token，成功后前端清除本地 Token） */
export function logout() {
  return request.delete('/api/auth/logout/')
}
