/**
 * 「整理」模块的分栏契约。
 *
 * IP与角色 / 品类 / 主题 三个资料库合并成同一个页面（/organize），分栏状态由
 * `?tab=ip|category|theme` 驱动：桌面顶部分栏与移动端便签标签栏共用这份定义，
 * 旧路径 /ipcharacter、/category、/theme 也会 redirect 到对应分栏。
 */
export const ORGANIZE_TABS = [
  { key: 'ip', label: 'IP与角色', to: '/organize?tab=ip' },
  { key: 'category', label: '品类', to: '/organize?tab=category' },
  { key: 'theme', label: '主题', to: '/organize?tab=theme' },
] as const

export type OrganizeTab = typeof ORGANIZE_TABS[number]['key']

export const DEFAULT_ORGANIZE_TAB: OrganizeTab = 'ip'

const ORGANIZE_TAB_KEYS: readonly string[] = ORGANIZE_TABS.map(tab => tab.key)

/** 非法或缺失的分栏参数统一归一为默认分栏，调用方不需要再判断数组/空值。 */
export function normalizeOrganizeTab(value: unknown): OrganizeTab {
  return typeof value === 'string' && ORGANIZE_TAB_KEYS.includes(value)
    ? value as OrganizeTab
    : DEFAULT_ORGANIZE_TAB
}
