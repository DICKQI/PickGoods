import type { RouteLocationNormalizedLoaded } from 'vue-router'

export type MobileModule = 'clubs' | 'showcase' | 'organize' | 'workbench' | 'profile'
export type MobileHeaderMode = 'tabs' | 'detail' | 'editor' | 'standalone'
export interface MobileIdentity { isClub: boolean; isAuthenticated: boolean }
export interface MobileTab { key: string; label: string; to: string }
export interface MobileModuleItem { key: MobileModule; label: string; to: string }
type RouteInput = Pick<RouteLocationNormalizedLoaded, 'path' | 'query'>

export const showcaseTabs: MobileTab[] = [
  { key: 'showcase', label: '展柜', to: '/showcase?tab=showcase' },
  { key: 'barn', label: '谷仓', to: '/showcase?tab=barn' },
  { key: 'preorders', label: '预购', to: '/preorders' },
  { key: 'journal', label: '手帐', to: '/showcase?tab=journal' },
  { key: 'stats', label: '统计', to: '/showcase?tab=stats' },
]
export const normalizeShowcaseTab = (value: unknown) =>
  typeof value === 'string' && ['showcase', 'barn', 'journal', 'stats'].includes(value) ? value : 'barn'

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
      { key: 'themes', label: '主题', to: '/club/themes' },
      { key: 'popularity', label: '人气', to: '/club/popularity' },
      { key: 'profile', label: '资料', to: '/club/profile' },
    ]
    case 'profile': return [
      { key: 'account', label: '账号', to: '/profile/account' },
      ...(!identity.isClub && identity.isAuthenticated ? [{ key: 'clubs', label: '我的社团', to: '/profile/clubs' }] : []),
      { key: 'settings', label: '设置', to: '/settings' },
    ]
  }
}

export function activeMobileTab(route: RouteInput): string {
  if (route.path === '/showcase') return normalizeShowcaseTab(route.query.tab)
  const segments = route.path.split('/').filter(Boolean)
  return segments[segments.length - 1] || ''
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

// Bounded list/workspace cache: credentials, details and editors never enter it.
export const MOBILE_CACHE_COMPONENTS = [
  'CloudShowcase', 'ClubDirectory', 'LocationManagement', 'IPCharacterManagement',
  'CategoryManagement', 'ThemeManagement', 'PreorderManagement', 'ClubWorkspace',
]
