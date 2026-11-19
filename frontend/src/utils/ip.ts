import type { IP } from '@/api/types'

/**
 * IP 在下拉框 / 筛选器里的显示名。
 *
 * 用户自建的个人 IP 追加「（个人）」后缀：官方域与个人域允许同名（个人 IP 不得
 * 占用官方名称，但多个用户之间可以同名），选择器里需要能区分。
 */
export function ipLabel(ip: Pick<IP, 'name'> & { user_id?: number | null }): string {
  return ip.user_id ? `${ip.name}（个人）` : ip.name
}

/**
 * 当前用户能否维护该作品（及其角色）。
 *
 * - 官方作品（`user_id` 为空）：只有管理员能维护；
 * - 个人作品（`user_id` 非空）：只有归属者本人能维护，管理员按普通用户处理。
 *
 * 与后端 `apps.goods.scoping.can_manage_ip` 一一对应：管理员在前台没有
 * 「他人个人 IP」的特权，运营查看/处置走管理后台。
 */
export function canManageIp(
  ip: Pick<IP, 'user_id'>,
  options: { isAdmin: boolean; userId?: number | null },
): boolean {
  if (ip.user_id) return ip.user_id === options.userId
  return options.isAdmin
}
