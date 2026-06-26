<template>
  <div class="admin-layout" :class="{ 'is-collapsed': isSidebarCollapsed }">
    <aside class="admin-sidebar" :class="{ collapsed: isSidebarCollapsed }">
      <div class="sidebar-header">
        <div class="brand" @click="goToShowcase">
          <span class="brand-icon">✦</span>
          <span v-show="!isSidebarCollapsed" class="brand-text">管理后台</span>
        </div>
        <el-button
          v-show="!isSidebarCollapsed"
          class="collapse-btn"
          text
          @click="toggleSidebar"
          :icon="Fold"
        />
        <el-button
          v-show="isSidebarCollapsed"
          class="collapse-btn collapsed-toggle"
          text
          @click="toggleSidebar"
          :icon="Expand"
        />
      </div>

      <el-menu
        :default-active="route.path"
        class="sidebar-menu"
        :collapse="isSidebarCollapsed"
        @select="handleMenuSelect"
      >
        <el-menu-item v-for="item in adminMenu" :key="item.index" :index="item.index">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <el-button text class="back-btn" @click="goToShowcase">
          <el-icon><Back /></el-icon>
          <span v-show="!isSidebarCollapsed">返回主站</span>
        </el-button>
      </div>
    </aside>

    <main class="admin-main">
      <header class="admin-header">
        <div class="header-left">
          <h1 class="page-title">{{ pageTitle }}</h1>
        </div>
        <div class="header-right">
          <span class="user-info">
            <el-icon><User /></el-icon>
            <span>{{ authStore.user?.username }}</span>
          </span>
          <el-button text @click="goToSettings">
            <el-icon><Setting /></el-icon>
          </el-button>
        </div>
      </header>

      <div class="admin-content">
        <router-view v-slot="{ Component, route }">
          <Transition name="admin-page-fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </Transition>
        </router-view>
      </div>
    </main>

    <div v-if="isMobile && !isSidebarCollapsed" class="sidebar-overlay" @click="isSidebarCollapsed = true"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  User,
  Goods,
  Collection,
  Box,
  Star,
  Back,
  Setting,
  Fold,
  Expand,
  Refresh,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isSidebarCollapsed = ref(false)
const { isMobile } = useResponsiveDevice()

// 菜单单一数据源：index=路由路径，title=展示名，icon=Element 图标组件。
// 新增菜单项只需在此追加一行，无需同步修改路由表/高亮/标题等多处。
const adminMenu: { index: string; title: string; icon: Component }[] = [
  { index: '/admin/users', title: '用户管理', icon: User },
  { index: '/admin/goods', title: '谷子管理', icon: Goods },
  { index: '/admin/ip', title: 'IP与角色', icon: Collection },
  { index: '/admin/categories', title: '品类管理', icon: Box },
  { index: '/admin/themes', title: '主题', icon: Star },
  { index: '/admin/bgm-sync', title: 'BGM 自动同步', icon: Refresh },
]

// 顶栏标题直接取子路由 meta.title，避免与菜单/路由重复维护标题表。
const pageTitle = computed(() => (route.meta.title as string) || '管理后台')

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const handleMenuSelect = (index: string) => {
  router.push(index)
  if (isMobile.value) {
    isSidebarCollapsed.value = true
  }
}

const goToShowcase = () => {
  router.push('/showcase')
}

const goToSettings = () => {
  router.push('/settings')
}

watch(
  isMobile,
  (mobile) => {
    if (mobile) {
      isSidebarCollapsed.value = true
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background-color: var(--bg-gray);
}

.admin-sidebar {
  width: 220px;
  background: var(--bg-white);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-normal);
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: var(--z-admin-sidebar);
}

.admin-sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  border-bottom: 1px solid var(--border-color);
}

.admin-sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.admin-sidebar.collapsed .brand {
  display: none;
}

.brand-icon {
  font-size: 24px;
  background: linear-gradient(45deg, var(--primary-gold), var(--primary-gold-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-text {
  font-size: var(--font-body);
  font-weight: 600;
  color: var(--text-dark);
}

.collapse-btn {
  font-size: var(--font-section);
  color: var(--text-regular);
}

.admin-sidebar.collapsed .collapse-btn {
  margin: 0 auto;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  background: transparent;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 220px;
}

.sidebar-menu.el-menu--collapse {
  width: 64px;
}

.sidebar-menu :deep(.el-menu-item) {
  height: 50px;
  line-height: 50px;
  margin: var(--space-xs) var(--space-sm);
  border-radius: var(--button-radius);
}

.sidebar-menu.el-menu--collapse :deep(.el-menu-item) {
  margin: var(--space-xs) 0;
  padding: 0 !important;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-menu.el-menu--collapse :deep(.el-menu-item .el-icon) {
  margin-right: 0 !important;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background-color: var(--bg-gray);
}

/* 菜单激活态：遵循 STYLING.md，使用香槟金（与全局 el-menu 激活一致），
   不再用紫色作为后台识别色。 */
.sidebar-menu :deep(.el-menu-item.is-active) {
  background: rgba(212, 175, 55, 0.1);
  color: var(--primary-gold-dark);
}

.sidebar-footer {
  padding: var(--space-md);
  border-top: 1px solid var(--border-color);
}

.back-btn {
  width: 100%;
  justify-content: flex-start;
  color: var(--text-regular);
}

.back-btn:hover {
  color: var(--primary-gold);
}

.admin-main {
  flex: 1;
  margin-left: 220px;
  transition: margin-left var(--transition-normal);
  display: flex;
  flex-direction: column;
}

/* 用父级 class 控制折叠态，替代脆弱的 .admin-sidebar.collapsed + .admin-main 相邻兄弟选择器。 */
.admin-layout.is-collapsed .admin-main {
  margin-left: 64px;
}

.admin-header {
  height: 64px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-lg);
  position: sticky;
  top: 0;
  z-index: var(--z-admin-header);
}

.header-left {
  display: flex;
  align-items: center;
}

.page-title {
  font-size: var(--font-title);
  font-weight: 600;
  color: var(--text-dark);
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-body);
  color: var(--text-regular);
}

.admin-content {
  flex: 1;
  padding: var(--space-lg);
  overflow-y: auto;
}

.admin-page-fade-enter-active,
.admin-page-fade-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.admin-page-fade-enter-from,
.admin-page-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.sidebar-overlay {
  display: none;
}

@media (max-width: 768px) {
  .admin-sidebar {
    width: 220px;
  }

  .admin-sidebar.collapsed {
    width: 0;
    overflow: hidden;
  }

  .admin-main,
  .admin-layout.is-collapsed .admin-main {
    margin-left: 0;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 220px;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: var(--z-admin-overlay);
  }

  .admin-content {
    padding: var(--space-md);
  }

  .admin-header {
    padding: 0 var(--space-md);
  }
}

@media (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .admin-sidebar {
    width: 220px;
  }

  .admin-sidebar.collapsed {
    width: 0;
    overflow: hidden;
  }

  .admin-main,
  .admin-layout.is-collapsed .admin-main {
    margin-left: 0;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 220px;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: var(--z-admin-overlay);
  }

  .admin-content {
    padding: var(--space-md);
  }

  .admin-header {
    padding: 0 var(--space-md);
  }
}
</style>
