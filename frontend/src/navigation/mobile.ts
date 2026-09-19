import type { RouteLocationNormalizedLoaded } from 'vue-router'

export type MobileModule = 'clubs' | 'showcase' | 'organize' | 'workbench' | 'profile'
export type MobileHeaderMode = 'tabs' | 'detail' | 'editor' | 'standalone'
export interface MobileIdentity { isClub: boolean; isAuthenticated: boolean }
export interface MobileTab { key: string; label: string; to: string }
export interface MobileModuleItem { key: MobileModule; label: string; to: string }
/** 手势切页序列中的一项：所属大区 + 该大区的标签。 */
export interface MobileSwipeStep { module: MobileModule; key: string; label: string; to: string }
type RouteInput = Pick<RouteLocationNormalizedLoaded, 'path' | 'query'>

/** 移动端左右滑动手势切页总开关：置 false 时完全不响应手势。 */
export const MOBILE_SWIPE_ENABLED = true

export const showcaseTabs: MobileTab[] = [
  { key: 'showcase', label: '展柜', to: '/showcase?tab=showcase' },
  { key: 'barn', label: '谷仓', to: '/showcase?tab=barn' },
  { key: 'preorders', label: '预购', to: '/preorders' },
  { key: 'journal', label: '手帐', to: '/showcase?tab=journal' },
  { key: 'stats', label: '统计', to: '/showcase?tab=stats' },
]
export const normalizeShowcaseTab = (value: unknown) =>
  typeof value === 'string' && ['showcase', 'barn', 'journal', 'stats'].includes(value) ? value : 'barn'

/** 只有明确打开某本手帐时才进入沉浸式编辑器，手帐标签本身展示列表。 */
export const isMobileJournalEditor = (route: RouteInput) =>
  route.path === '/showcase'
  && normalizeShowcaseTab(route.query.tab) === 'journal'
  && typeof route.query.book === 'string'
  && route.query.book.length > 0

export function mobileModule(route: RouteInput): MobileModule {
  const path = route.path
  if (path === '/clubs' || path.startsWith('/clubs/')) return 'clubs'
  if (path === '/club' || path.startsWith('/club/')) return 'workbench'
  if (path.startsWith('/profile') || path === '/settings') return 'profile'
  if (path.startsWith('/characters/')) {
    return typeof route.query.returnTo === 'string' && /^\/showcase(?:\?|$)/.test(route.query.returnTo) ? 'showcase' : 'organize'
  }
  if (['/location', '/ipcharacter', '/ip', '/character', '/category', '/theme'].includes(path)) return 'organize'
  return 'showcase'
}

export function mobileHeaderMode(path: string): MobileHeaderMode {
  if (path === '/login' || path === '/admin' || path.startsWith('/admin/')) return 'standalone'
  if (/^\/(?:club\/)?goods\/(?:new|[^/]+\/edit)$/.test(path)) return 'editor'
  if (/^\/clubs\/[^/]+$/.test(path) || path.startsWith('/characters/') || path === '/goods/drafts') return 'detail'
  return 'tabs'
}

export function mobileModules(identity: MobileIdentity): MobileModuleItem[] {
  return [
    { key: 'clubs', label: '社团', to: '/clubs' },
    ...(identity.isClub
      ? [{ key: 'workbench' as const, label: '工作台', to: '/club/goods' }]
      : [{ key: 'showcase' as const, label: '云展柜', to: '/showcase?tab=barn' }, { key: 'organize' as const, label: '整理', to: '/location' }]),
    { key: 'profile', label: '我的', to: identity.isAuthenticated ? '/profile/account' : '/settings' },
  ]
}

export function mobileTabs(module: MobileModule, identity: MobileIdentity): MobileTab[] {
  switch (module) {
    case 'clubs': return [{ key: 'clubs', label: '社团目录', to: '/clubs' }]
    case 'showcase': return showcaseTabs
    case 'organize': return [
      { key: 'location', label: '位置', to: '/location' },
      { key: 'ipcharacter', label: 'IP与角色', to: '/ipcharacter' },
      { key: 'category', label: '品类', to: '/category' },
      { key: 'theme', label: '主题', to: '/theme' },
    ]
    case 'workbench': return [
      { key: 'goods', label: '谷子', to: '/club/goods' },
      { key: 'gamification', label: '成就', to: '/club/gamification' },
      { key: 'themes', label: '主题', to: '/club/themes' },
      { key: 'popularity', label: '人气', to: '/club/popularity' },
      { key: 'profile', label: '资料', to: '/club/profile' },
    ]
    case 'profile': return [
      { key: 'account', label: '账号', to: '/profile/account' },
      ...(!identity.isClub && identity.isAuthenticated ? [{ key: 'clubs', label: '我的社团', to: '/profile/clubs' }] : []),
      ...(!identity.isClub && identity.isAuthenticated ? [{ key: 'achievements', label: '成就', to: '/profile/achievements' }, { key: 'rewards', label: '装扮', to: '/profile/rewards' }] : []),
      { key: 'settings', label: '设置', to: '/settings' },
    ]
  }
}

export function activeMobileTab(route: RouteInput): string {
  if (route.path === '/showcase') return normalizeShowcaseTab(route.query.tab)
  const segments = route.path.split('/').filter(Boolean)
  return segments[segments.length - 1] || ''
}

/**
 * 移动端手势切页的扁平序列：按底部大区顺序展开各分区的标签，
 * 相邻大区在序列里也相邻（例如云展柜首个标签右滑即进入社团目录）。
 */
export function mobileSwipeSequence(identity: MobileIdentity): MobileSwipeStep[] {
  return mobileModules(identity).flatMap(item =>
    mobileTabs(item.key, identity).map(tab => ({
      module: item.key,
      key: tab.key,
      label: tab.label,
      to: tab.to,
    })))
}

/** 当前路由在序列中的下标；-1 表示该路由不参与手势切页。 */
export function mobileSwipeStepIndex(steps: MobileSwipeStep[], route: RouteInput): number {
  const module = mobileModule(route)
  const key = activeMobileTab(route)
  return steps.findIndex(step => step.module === module && step.key === key)
}

export function mobileReturnTarget(route: RouteInput): string {
  if (route.path.startsWith('/characters/')) {
    const returnTo = route.query.returnTo
    if (typeof returnTo === 'string' && /^\/(?:showcase|ipcharacter)(?:\?|$)/.test(returnTo)) return returnTo
    return '/ipcharacter'
  }
  if (route.path.startsWith('/clubs/')) return '/clubs'
  if (route.path.startsWith('/club/')) return '/club/goods'
  return '/showcase?tab=barn'
}

/** 谷仓滚动时底部导航收起，其它页面保持常驻。 */
export function mobileNavAutoHides(route: RouteInput): boolean {
  return route.path === '/showcase' && normalizeShowcaseTab(route.query.tab) === 'barn'
}

// Bounded list/workspace cache: credentials, details and editors never enter it.
export const MOBILE_CACHE_COMPONENTS = [
  'CloudShowcase', 'ClubDirectory', 'LocationManagement', 'IPCharacterManagement',
  'CategoryManagement', 'ThemeManagement', 'PreorderManagement', 'ClubWorkspace',
]
