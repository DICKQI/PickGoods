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
