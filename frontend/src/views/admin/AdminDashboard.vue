<template>
  <div
    class="admin-shell"
    :class="{ 'is-collapsed': isSidebarCollapsed, 'is-mobile': isMobile }"
  >
    <aside class="admin-sidebar" :class="{ collapsed: isSidebarCollapsed }">
      <button class="admin-brand" type="button" @click="router.push('/showcase')">
        <span class="admin-brand__mark">拾</span>
        <span v-show="!isSidebarCollapsed" class="admin-brand__copy">
          <strong>拾谷管理台</strong>
          <small>PickGoods Console</small>
        </span>
      </button>

      <el-scrollbar class="admin-nav-scroll">
        <nav class="admin-nav" aria-label="管理后台导航">
          <section v-for="group in adminMenu" :key="group.title" class="admin-nav__group">
            <p v-show="!isSidebarCollapsed" class="admin-nav__group-title">
              {{ group.title }}
            </p>
            <el-menu
              :default-active="activePath"
              :collapse="isSidebarCollapsed"
              :collapse-transition="false"
              class="admin-menu"
              @select="handleMenuSelect"
            >
              <el-menu-item
                v-for="item in group.items"
                :key="item.path"
                :index="item.path"
              >
                <el-icon><component :is="item.icon" /></el-icon>
                <template #title>{{ item.title }}</template>
              </el-menu-item>
            </el-menu>
          </section>
        </nav>
      </el-scrollbar>

      <div class="admin-sidebar__footer">
        <el-button text class="admin-sidebar__back" @click="router.push('/showcase')">
          <el-icon><Back /></el-icon>
          <span v-show="!isSidebarCollapsed">返回主站</span>
        </el-button>
      </div>
    </aside>

    <div
      v-if="isMobile && !isSidebarCollapsed"
      class="admin-sidebar-mask"
      aria-hidden="true"
      @click="isSidebarCollapsed = true"
    />

    <section class="admin-workspace">
      <header class="admin-topbar">
        <div class="admin-topbar__left">
          <el-button
            class="admin-topbar__menu"
            text
            :icon="isSidebarCollapsed ? Expand : Fold"
            aria-label="切换侧栏"
            @click="toggleSidebar"
          />
          <div class="admin-breadcrumb">
            <span>管理后台</span>
            <el-icon><ArrowRight /></el-icon>
            <strong>{{ pageTitle }}</strong>
          </div>
        </div>

        <div class="admin-topbar__right">
          <span class="admin-account">
            <span class="admin-account__avatar">{{ accountInitial }}</span>
            <span class="admin-account__name">{{ authStore.user?.username }}</span>
          </span>
          <el-tooltip content="账号设置" placement="bottom">
            <el-button
              circle
              text
              :icon="Setting"
              aria-label="账号设置"
              @click="router.push('/settings')"
            />
          </el-tooltip>
        </div>
      </header>

      <main class="admin-content">
        <router-view v-slot="{ Component, route: currentRoute }">
          <Transition name="admin-page-fade" mode="out-in">
            <component :is="Component" :key="String(currentRoute.name || currentRoute.path)" />
          </Transition>
        </router-view>
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  Back,
  Brush,
  Collection,
  DataAnalysis,
  Expand,
  Fold,
  Goods,
  Grid,
  List,
  Refresh,
  Setting,
  Star,
  User,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'

interface AdminMenuItem {
  path: string
  title: string
  icon: Component
}

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isMobile } = useResponsiveDevice()
const isSidebarCollapsed = ref(isMobile.value)

const adminMenu: Array<{ title: string; items: AdminMenuItem[] }> = [
  {
    title: '工作台',
    items: [
      { path: '/admin/overview', title: '运营总览', icon: DataAnalysis },
    ],
  },
  {
    title: '用户与内容',
    items: [
      { path: '/admin/users', title: '用户管理', icon: User },
      { path: '/admin/goods', title: '谷子管理', icon: Goods },
    ],
  },
  {
    title: '元数据',
    items: [
      { path: '/admin/ip', title: 'IP 与角色', icon: Collection },
      { path: '/admin/categories', title: '品类管理', icon: Grid },
      { path: '/admin/themes', title: '主题管理', icon: Brush },
      { path: '/admin/goods-crafts', title: '谷子工艺', icon: List },
    ],
  },
  {
    title: '运维与激励',
    items: [
      { path: '/admin/bgm-sync', title: 'BGM 自动同步', icon: Refresh },
      { path: '/admin/gamification', title: '成就与奖励', icon: Star },
      { path: '/admin/audit-logs', title: '操作日志', icon: List },
    ],
  },
]

const pageTitle = computed(() => (route.meta.title as string) || '运营总览')
const activePath = computed(() => {
  if (route.path.startsWith('/admin/goods/')) return '/admin/goods'
  return route.path
})
const accountInitial = computed(
  () => authStore.user?.username?.trim().slice(0, 1).toUpperCase() || 'A',
)

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const handleMenuSelect = (path: string) => {
  void router.push(path)
  if (isMobile.value) isSidebarCollapsed.value = true
}

watch(
  isMobile,
  (mobile) => {
    isSidebarCollapsed.value = mobile
  },
  { immediate: true },
)
</script>

<style scoped>
.admin-shell {
  --admin-sidebar-width: 224px;
  --admin-sidebar-collapsed-width: 64px;
  min-height: 100vh;
  background: var(--admin-bg, #f4f5f7);
  color: var(--admin-text, #1f2937);
}

.admin-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: var(--z-admin-sidebar);
  display: flex;
  width: var(--admin-sidebar-width);
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: var(--admin-sidebar, #1f232b);
  color: #e5e7eb;
  transition: width var(--transition-normal);
}

.admin-sidebar.collapsed {
  width: var(--admin-sidebar-collapsed-width);
}

.admin-brand {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 10px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0 14px;
  text-align: left;
}

.admin-brand__mark {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: linear-gradient(135deg, #d4af37, #b8941f);
  color: #1f232b;
  font-size: 18px;
  font-weight: 800;
}

.admin-brand__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 1.2;
}

.admin-brand__copy strong {
  color: #fff;
  font-size: 14px;
}

.admin-brand__copy small {
  margin-top: 3px;
  color: #9ca3af;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-nav-scroll {
  flex: 1;
}

.admin-nav {
  padding: 12px 10px;
}

.admin-nav__group + .admin-nav__group {
  margin-top: 14px;
}

.admin-nav__group-title {
  margin: 0 8px 6px;
  color: #7f8794;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.admin-menu {
  border-right: 0;
  background: transparent;
}

.admin-menu :deep(.el-menu-item) {
  height: 42px;
  margin: 2px 0;
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 13px;
}

.admin-menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.admin-menu :deep(.el-menu-item.is-active) {
  background: rgba(212, 175, 55, 0.14);
  color: #f0d9a4;
  box-shadow: inset 3px 0 #d4af37;
}

.admin-sidebar__footer {
  padding: 12px 10px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-sidebar__back {
  width: 100%;
  justify-content: flex-start;
  color: #cbd5e1;
}

.admin-sidebar__back:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.admin-workspace {
  display: flex;
  min-width: 0;
  min-height: 100vh;
  flex-direction: column;
  margin-left: var(--admin-sidebar-width);
  transition: margin-left var(--transition-normal);
}

.admin-shell.is-collapsed .admin-workspace {
  margin-left: var(--admin-sidebar-collapsed-width);
}

.admin-topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-admin-header);
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--admin-border, #e5e7eb);
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(14px);
  padding: 0 20px;
}

.admin-topbar__left,
.admin-topbar__right,
.admin-breadcrumb,
.admin-account {
  display: flex;
  align-items: center;
}

.admin-topbar__left {
  min-width: 0;
  gap: 10px;
}

.admin-topbar__menu {
  flex: none;
}

.admin-breadcrumb {
  min-width: 0;
  gap: 7px;
  color: #909399;
  font-size: 13px;
}

.admin-breadcrumb strong {
  overflow: hidden;
  color: #303133;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-topbar__right {
  gap: 12px;
}

.admin-account {
  gap: 8px;
  color: #4b5563;
  font-size: 13px;
}

.admin-account__avatar {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: #f1e6bd;
  color: #7a5f0d;
  font-weight: 700;
}

.admin-content {
  min-width: 0;
  flex: 1;
  padding: 20px;
}

.admin-page-fade-enter-active,
.admin-page-fade-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.admin-page-fade-enter-from,
.admin-page-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.admin-sidebar-mask {
  display: none;
}

@media (max-width: 900px) {
  .admin-sidebar {
    width: var(--admin-sidebar-width);
    transform: translateX(0);
    transition: transform var(--transition-normal);
  }

  .admin-sidebar.collapsed {
    width: var(--admin-sidebar-width);
    transform: translateX(-100%);
  }

  .admin-workspace,
  .admin-shell.is-collapsed .admin-workspace {
    margin-left: 0;
  }

  .admin-sidebar-mask {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-admin-sidebar) - 1);
    display: block;
    background: rgba(15, 23, 42, 0.42);
  }

  .admin-content {
    padding: 14px;
  }

  .admin-topbar {
    padding: 0 14px;
  }

  .admin-account__name {
    display: none;
  }

  .admin-breadcrumb > span,
  .admin-breadcrumb > .el-icon {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-sidebar,
  .admin-workspace,
  .admin-page-fade-enter-active,
  .admin-page-fade-leave-active {
    transition: none;
  }
}
</style>
