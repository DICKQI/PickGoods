import { describe, expect, it } from 'vitest'
import { canManageIp } from '@/utils/ip'

describe('canManageIp', () => {
  it('lets only admins maintain official works', () => {
    expect(canManageIp({ user_id: null }, { isAdmin: true, userId: 1 })).toBe(true)
    expect(canManageIp({ user_id: undefined }, { isAdmin: false, userId: 2 })).toBe(false)
  })

  it('lets the owner maintain their own personal work', () => {
    expect(canManageIp({ user_id: 7 }, { isAdmin: false, userId: 7 })).toBe(true)
    expect(canManageIp({ user_id: 7 }, { isAdmin: true, userId: 7 })).toBe(true)
  })

  it('never lets anyone else touch another user personal work, admins included', () => {
    expect(canManageIp({ user_id: 7 }, { isAdmin: false, userId: 8 })).toBe(false)
    // 管理员在前台没有「他人个人 IP」的特权：运营查看走管理后台
    expect(canManageIp({ user_id: 7 }, { isAdmin: true, userId: 1 })).toBe(false)
  })

  it('treats a missing session user as unauthorized', () => {
    expect(canManageIp({ user_id: null }, { isAdmin: false, userId: undefined })).toBe(false)
    expect(canManageIp({ user_id: 7 }, { isAdmin: false, userId: undefined })).toBe(false)
  })
})
