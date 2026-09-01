import { createRouter, createWebHistory } from 'vue-router'
import type { NavigationGuardNext, RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/showcase',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: '登录',
      public: true,
      hideTopNav: true,
      hideBottomNav: true,
    },
  },
  {
    path: '/showcase',
    name: 'CloudShowcase',
    component: () => import('@/views/CloudShowcase.vue'),
    meta: {
      title: '云展柜',
      requiresAuth: true,
      requiresCollector: true,
    },
  },
  {
    path: '/clubs',
    name: 'ClubDirectory',
    component: () => import('@/views/ClubDirectory.vue'),
    meta: { title: '社团' },
  },
  {
    path: '/clubs/:id',
    name: 'ClubDetail',
    component: () => import('@/views/ClubDetail.vue'),
    meta: { title: '社团详情', preserveOnQueryChange: true },
  },
  {
    path: '/club',
    name: 'ClubWorkspace',
    component: () => import('@/views/club/ClubWorkspace.vue'),
    meta: { title: '社团工作台', requiresAuth: true, requiresClub: true },
    redirect: '/club/goods',
    children: [
      { path: 'profile', name: 'ClubProfile', component: () => import('@/views/club/ClubProfile.vue'), meta: { title: '社团资料', requiresAuth: true, requiresClub: true } },
      { path: 'goods', name: 'ClubGoods', component: () => import('@/views/club/ClubGoods.vue'), meta: { title: '社团谷子', requiresAuth: true, requiresClub: true } },
      { path: 'goods/new', name: 'ClubGoodsNew', component: () => import('@/views/club/ClubGoodsEditor.vue'), meta: { title: '新增社团谷子', requiresAuth: true, requiresClub: true, hideBottomNav: true } },
      { path: 'goods/:id/edit', name: 'ClubGoodsEdit', component: () => import('@/views/club/ClubGoodsEditor.vue'), meta: { title: '编辑社团谷子', requiresAuth: true, requiresClub: true, hideBottomNav: true } },
      { path: 'popularity', name: 'ClubPopularity', component: () => import('@/views/club/ClubPopularity.vue'), meta: { title: '人气统计', requiresAuth: true, requiresClub: true } },
    ],
  },
  {
    path: '/location',
    name: 'Location',
    component: () => import('@/views/LocationManagement.vue'),
    meta: {
      title: '位置',
      requiresAuth: true,
      requiresCollector: true,
    },
  },
  {
    path: '/ipcharacter',
    name: 'IPCharacterManagement',
    component: () => import('@/views/IPCharacterManagement.vue'),
    meta: {
      title: 'IP与角色',
      requiresAuth: true,
      requiresCollector: true,
    },
  },
  {
    path: '/characters/:id/stats',
    name: 'CharacterStats',
    component: () => import('@/views/CharacterStats.vue'),
    meta: {
      title: '角色厨力统计',
      requiresAuth: true,
      requiresCollector: true,
    },
  },
  // 兼容旧路径，重定向到新路径
  {
    path: '/ip',
    redirect: '/ipcharacter',
  },
  {
    path: '/character',
    redirect: '/ipcharacter',
  },
  {
    path: '/category',
    name: 'CategoryManagement',
    component: () => import('@/views/CategoryManagement.vue'),
    meta: {
      title: '品类',
      requiresAuth: true,
      requiresCollector: true,
    },
  },
  {
    path: '/theme',
    name: 'ThemeManagement',
    component: () => import('@/views/ThemeManagement.vue'),
    meta: {
      title: '主题',
      requiresAuth: true,
      requiresCollector: true,
    },
  },
  {
    path: '/goods/new',
    name: 'GoodsNew',
    component: () => import('@/views/GoodsForm.vue'),
    meta: {
      title: '新增谷子',
      requiresAuth: true,
      requiresCollector: true,
    },
  },
  {
    path: '/goods/drafts',
    name: 'GoodsDrafts',
    component: () => import('@/views/GoodsDrafts.vue'),
    meta: {
      title: '草稿箱',
      requiresAuth: true,
      requiresCollector: true,
    },
  },
  {
    path: '/goods/:id/edit',
    name: 'GoodsEdit',
    component: () => import('@/views/GoodsForm.vue'),
    meta: {
      title: '编辑谷子',
      requiresAuth: true,
      requiresCollector: true,
    },
  },
  {
    path: '/preorders',
    name: 'PreorderManagement',
    component: () => import('@/views/PreorderManagement.vue'),
    meta: {
      title: '预购',
      requiresAuth: true,
      requiresCollector: true,
    },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: {
      title: '设置',
    },
  },
  {
    path: '/profile',
    name: 'ProfileWorkspace',
    component: () => import('@/views/ProfileWorkspace.vue'),
    meta: { title: '个人中心', requiresAuth: true },
    redirect: '/profile/account',
    children: [
      {
        path: 'account',
        name: 'ProfileAccount',
        component: () => import('@/views/profile/ProfileAccount.vue'),
        meta: { title: '账号信息', requiresAuth: true },
      },
      {
        path: 'clubs',
        name: 'ProfileClubs',
        component: () => import('@/views/profile/ProfileClubs.vue'),
        meta: { title: '我的社团', requiresAuth: true, requiresCollector: true },
      },
    ],
  },
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: () => import('@/views/admin/AdminDashboard.vue'),
    meta: {
      title: '管理后台',
      requiresAuth: true,
      requiresAdmin: true,
      hideTopNav: true,
      hideBottomNav: true,
    },
    redirect: '/admin/users',
    children: [
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/views/admin/UserManagement.vue'),
        meta: {
          title: '用户管理',
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'goods',
        name: 'AdminGoods',
        component: () => import('@/views/admin/GoodsManagement.vue'),
        meta: {
          title: '谷子管理',
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'ip',
        name: 'AdminIP',
        component: () => import('@/views/IPCharacterManagement.vue'),
        meta: {
          title: 'IP与角色管理',
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'categories',
        name: 'AdminCategories',
        component: () => import('@/views/CategoryManagement.vue'),
        meta: {
          title: '品类',
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'themes',
        name: 'AdminThemes',
        component: () => import('@/views/ThemeManagement.vue'),
        meta: {
          title: '主题',
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'goods-crafts',
        name: 'AdminGoodsCrafts',
        component: () => import('@/views/admin/GoodsCraftManagement.vue'),
        meta: {
          title: '谷子工艺',
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'bgm-sync',
        name: 'AdminBGMSync',
        component: () => import('@/views/admin/BGMSyncManagement.vue'),
        meta: {
          title: 'BGM自动同步',
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
    ],
  },
]

export async function authGuard(to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) {
  document.title = to.meta.title ? `${to.meta.title} - 拾谷 PickGoods` : '拾谷 PickGoods'

  const authStore = useAuthStore()
  await authStore.initFromStorage()

  const requiresAuth = to.meta.requiresAuth === true
  const requiresAdmin = to.meta.requiresAdmin === true
  const requiresClub = to.meta.requiresClub === true
  const requiresCollector = to.meta.requiresCollector === true
  const isPublic = to.meta.public === true

  if (requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }
  if (requiresClub && !authStore.isClub) {
    next(authStore.isAuthenticated ? '/showcase' : { name: 'Login', query: { redirect: to.fullPath } })
    return
  }
  if (requiresCollector && !authStore.isCollector) {
    next(authStore.isAuthenticated ? '/club/goods' : { name: 'Login', query: { redirect: to.fullPath } })
    return
  }
  if (isPublic && authStore.isAuthenticated && to.name === 'Login') {
    const redirect = (to.query.redirect as string) || '/showcase'
    next(typeof redirect === 'string' ? redirect : '/showcase')
    return
  }
  if (requiresAdmin) {
    // 实时复核角色：管理员被降权后旧会话立即失效（后端 IsAdmin 仍兜底）。
    // 注意：若 token 已过期，fetchCurrentUser 的请求会 401，拦截器会清会话并整页跳转登录页，
    // 此时 isAuthenticated 已变 false——下面的 next() 会被页面卸载打断，属预期行为。
    await authStore.fetchCurrentUser()
    if (!authStore.isAuthenticated) {
      next() // 401 拦截器已接管跳转；放行当前导航避免守卫挂起
      return
    }
    if (!authStore.isAdmin) {
      next({ name: 'Settings' })
      return
    }
  }
  next()
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(authGuard)

export default router
