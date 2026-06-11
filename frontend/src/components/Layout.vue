<template>
  <div class="layout">
    <!-- 顶部导航栏 -->
    <nav v-if="!route.meta.hideTopNav" ref="navbarRef" class="navbar" :class="{ 'navbar-native': isNativePlatform }">
      <div class="navbar-content">
        <div class="brand" @click="goHome">
          <span class="brand-text">✦ 拾谷 PickGoods</span>
        </div>
        <!-- 普通宽度下：直接展示完整菜单 -->
        <div class="nav-menu" v-if="!isMobile">
          <el-menu
            :default-active="activeMenu"
            mode="horizontal"
            @select="handleMenuSelect"
            class="nav-menu-el"
          >
            <el-menu-item index="/showcase">
              <el-icon><Grid /></el-icon>
              <span>云展柜</span>
            </el-menu-item>
            <el-menu-item index="/location">
              <el-icon><FolderOpened /></el-icon>
              <span>位置管理</span>
            </el-menu-item>
            <el-menu-item index="/ipcharacter">
              <el-icon><Collection /></el-icon>
              <span>IP作品与角色</span>
            </el-menu-item>
            <el-menu-item index="/category">
              <el-icon><Box /></el-icon>
              <span>品类管理</span>
            </el-menu-item>
            <el-menu-item index="/theme">
              <el-icon><Star /></el-icon>
              <span>主题管理</span>
            </el-menu-item>
          </el-menu>
        </div>
        <!-- 登录/用户与设置 -->
        <div class="nav-actions">
          <template v-if="!authStore.isAuthenticated">
            <el-button text class="login-btn" @click="goToLogin">
              <span>登录</span>
            </el-button>
          </template>
          <el-button
            text
            class="github-btn"
            title="GitHub"
            @click="goToGitHub"
          >
            <svg class="github-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"/>
            </svg>
          </el-button>
          <el-button
            text
            :class="{ 'settings-active': route.path === '/settings' }"
            @click="goToSettings"
            class="settings-btn"
          >
            <el-icon><Setting /></el-icon>
          </el-button>
        </div>
      </div>
    </nav>

    <!-- 主要内容区 -->
    <main class="main-content" :class="{
      'has-bottom-nav': isMobile && !route.meta.hideBottomNav,
      'no-top-nav': route.meta.hideTopNav
    }">
      <router-view v-slot="{ Component, route }">
        <Transition :name="pageTransitionName" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </Transition>
      </router-view>
    </main>

    <!-- 移动端底部导航栏 -->
    <MobileBottomNav v-if="isMobile && !route.meta.hideBottomNav" />

    <!-- 悬浮按钮组（仅云展柜页面展示；统计看板隐藏刷新按钮） -->
    <TransitionGroup
      v-if="showFab && !isMobile"
      name="fab-list"
      tag="div"
      class="fab-group"
      :class="{ 'fab-mobile': isMobile }"
    >
      <div
        v-if="showRefreshFab"
        key="refresh"
        class="fab-btn refresh-fab"
        @click="handleRefresh"
        :class="{ loading: refreshLoading }"
      >
        <Transition name="fab-icon" mode="out-in">
          <el-icon v-if="!refreshLoading" key="refresh">
            <Refresh />
          </el-icon>
          <el-icon v-else key="loading" class="is-loading">
            <Loading />
          </el-icon>
        </Transition>
      </div>
      <div v-if="showAddFab" key="add" class="fab-btn" @click="goToAdd">
        <el-icon><Plus /></el-icon>
      </div>
      <div
        v-if="showMultiSelectFab"
        key="multi-select"
        class="fab-btn selection-fab"
        title="多选展示"
        @click="enterSelectionMode"
      >
        <el-icon><Grid /></el-icon>
      </div>
      <div
        v-if="showSelectionConfirmFab"
        key="selection-confirm"
        class="fab-btn selection-confirm-fab"
        title="确认展示"
        @click="confirmSelection"
      >
        <el-icon><Check /></el-icon>
        <span v-if="guziStore.selectedGoodsCount > 0" class="fab-count">
          {{ guziStore.selectedGoodsCount }}
        </span>
      </div>
      <div
        v-if="showSelectionExitFab"
        key="selection-exit"
        class="fab-btn selection-exit-fab"
        title="退出多选"
        @click="exitSelectionMode"
      >
        <el-icon><Close /></el-icon>
      </div>
    </TransitionGroup>

    <div v-if="showFab && isMobile" class="mobile-action-layer">
      <Transition name="mobile-action-backdrop">
        <div
          v-if="mobileActionOpen && showMobileActionFab"
          class="mobile-action-backdrop"
          @click="closeMobileActions"
        ></div>
      </Transition>

      <Transition name="mobile-action-sheet">
        <div
          v-if="mobileActionOpen && showMobileActionFab"
          id="mobile-action-sheet"
          class="mobile-action-sheet"
          role="menu"
          aria-label="首页快捷操作"
        >
          <button
            v-if="showRefreshFab"
            type="button"
            class="mobile-action-item"
            :class="{ loading: refreshLoading }"
            role="menuitem"
            aria-label="刷新当前列表"
            @click="handleMobileRefresh"
          >
            <span class="mobile-action-icon">
              <el-icon v-if="!refreshLoading"><Refresh /></el-icon>
              <el-icon v-else class="is-loading"><Loading /></el-icon>
            </span>
            <span class="mobile-action-label">刷新</span>
          </button>
          <button
            v-if="showAddFab"
            type="button"
            class="mobile-action-item primary"
            role="menuitem"
            aria-label="新增谷子"
            @click="handleMobileAdd"
          >
            <span class="mobile-action-icon"><el-icon><Plus /></el-icon></span>
            <span class="mobile-action-label">新增</span>
          </button>
          <button
            v-if="showMultiSelectFab"
            type="button"
            class="mobile-action-item"
            role="menuitem"
            aria-label="进入批量展示"
            @click="handleMobileSelectionEnter"
          >
            <span class="mobile-action-icon"><el-icon><Grid /></el-icon></span>
            <span class="mobile-action-label">批量展示</span>
          </button>
        </div>
      </Transition>

      <Transition name="mobile-selection-dock">
        <div v-if="showMobileSelectionDock" class="mobile-selection-dock">
          <button type="button" class="mobile-selection-exit" @click="exitSelectionMode">
            <el-icon><Close /></el-icon>
          </button>
          <div class="mobile-selection-summary">
            <span>已选</span>
            <strong>{{ guziStore.selectedGoodsCount }}</strong>
          </div>
          <button type="button" class="mobile-selection-confirm" @click="confirmSelection">
            <el-icon><Check /></el-icon>
            <span>展示</span>
          </button>
        </div>
      </Transition>

      <button
        v-if="showMobileActionFab"
        type="button"
        class="mobile-action-fab"
        :class="{ 'is-open': mobileActionOpen }"
        @click="toggleMobileActions"
        aria-haspopup="menu"
        :aria-expanded="mobileActionOpen ? 'true' : 'false'"
        aria-controls="mobile-action-sheet"
        :aria-label="mobileActionOpen ? '关闭快捷操作' : '打开快捷操作'"
      >
        <el-icon v-if="mobileActionOpen"><Close /></el-icon>
        <el-icon v-else><MoreFilled /></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Grid, FolderOpened, Plus, Collection, Box, Refresh, Loading, Setting, Star, Check, Close, MoreFilled } from '@element-plus/icons-vue'
import { useGuziStore } from '@/stores/guzi'
import { useAuthStore } from '@/stores/auth'
import { Capacitor } from '@capacitor/core'
import MobileBottomNav from './MobileBottomNav.vue'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'

const router = useRouter()
const route = useRoute()
const guziStore = useGuziStore()
const authStore = useAuthStore()
const { isMobile } = useResponsiveDevice()

const refreshLoading = ref(false)
const mobileActionOpen = ref(false)
const isNativePlatform = ref(Capacitor.isNativePlatform())
const statusBarHeight = ref(0)
const navbarRef = ref<HTMLElement | null>(null)
const showcaseActiveTab = ref<'showcase' | 'barn' | 'stats' | null>(route.path.startsWith('/showcase') ? 'barn' : null)

const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/showcase')) return '/showcase'
  if (path.startsWith('/location')) return '/location'
  if (path.startsWith('/ipcharacter') || path.startsWith('/ip') || path.startsWith('/character')) return '/ipcharacter'
  if (path.startsWith('/category')) return '/category'
  if (path.startsWith('/theme')) return '/theme'
  return '/showcase'
})

const handleMenuSelect = (index: string) => {
  router.push(index)
}

const goHome = () => {
  router.push('/showcase')
}

const goToSettings = () => {
  router.push('/settings')
}

const goToLogin = () => {
  router.push('/login')
}

const goToGitHub = () => {
  window.open('https://github.com/DICKQI/PickGoods', '_blank')
}

// 仅在云展柜页面显示悬浮按钮
const showFab = computed(() => route.path.startsWith('/showcase'))
const showSelectionControls = computed(() => showFab.value && showcaseActiveTab.value === 'barn' && guziStore.selectionMode)
// 统计看板 Tab 下隐藏刷新按钮
const showRefreshFab = computed(() => showFab.value && showcaseActiveTab.value !== 'stats' && !showSelectionControls.value)
// 仅在“谷仓” Tab 下显示“新增谷子”按钮
const showAddFab = computed(() => showFab.value && showcaseActiveTab.value === 'barn' && !showSelectionControls.value)
const showMultiSelectFab = computed(() => showFab.value && showcaseActiveTab.value === 'barn' && !showSelectionControls.value)
const showSelectionConfirmFab = computed(() => showSelectionControls.value)
const showSelectionExitFab = computed(() => showSelectionControls.value)
const showMobileActionFab = computed(() => !showSelectionControls.value && (
  showRefreshFab.value || showAddFab.value || showMultiSelectFab.value
))
const showMobileSelectionDock = computed(() => showSelectionControls.value)

const goToAdd = () => {
  router.push('/goods/new')
}

const closeMobileActions = () => {
  mobileActionOpen.value = false
}

const toggleMobileActions = () => {
  mobileActionOpen.value = !mobileActionOpen.value
}

const handleMobileAdd = () => {
  closeMobileActions()
  goToAdd()
}

const handleMobileSelectionEnter = () => {
  closeMobileActions()
  enterSelectionMode()
}

const enterSelectionMode = () => {
  window.dispatchEvent(new CustomEvent('cloud-showcase:selection-enter'))
}

const confirmSelection = () => {
  window.dispatchEvent(new CustomEvent('cloud-showcase:selection-confirm'))
}

const exitSelectionMode = () => {
  window.dispatchEvent(new CustomEvent('cloud-showcase:selection-exit'))
}

// 移动端为页面切换添加向上滑入动画，PC 端使用轻量淡入
// 管理后台页面不应用过渡动画（由 AdminDashboard 内部处理）
const pageTransitionName = computed(() => {
  if (route.path.startsWith('/admin')) return 'no-transition'
  return isMobile.value ? 'page-slide-up' : 'page-fade'
})

const handleRefresh = async () => {
  if (refreshLoading.value) return
  refreshLoading.value = true
  try {
    // 交由云展柜页面内部按当前 Tab 处理
    if (route.path.startsWith('/showcase')) {
      window.dispatchEvent(new CustomEvent('cloud-showcase:refresh'))
      // 监听刷新完成事件
      const handleRefreshComplete = () => {
        refreshLoading.value = false
        window.removeEventListener('cloud-showcase:refresh-complete', handleRefreshComplete)
      }
      window.addEventListener('cloud-showcase:refresh-complete', handleRefreshComplete)
      return
    }
    // 兜底：其它页面仍刷新谷仓列表（历史行为）
    await guziStore.searchGuziImmediate()
  } finally {
    if (!route.path.startsWith('/showcase')) {
      refreshLoading.value = false
    }
  }
}

const handleMobileRefresh = async () => {
  closeMobileActions()
  await handleRefresh()
}

const handleShowcaseTabChanged = (e: Event) => {
  const ce = e as CustomEvent<{ tab?: 'showcase' | 'barn' | 'stats' }>
  showcaseActiveTab.value = ce.detail?.tab ?? null
  closeMobileActions()
}

onMounted(() => {
  window.addEventListener('cloud-showcase:tab-changed', handleShowcaseTabChanged as EventListener)

  // 在原生平台上，尝试获取状态栏高度并设置 padding（作为 CSS env() 的后备方案）
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    // 延迟检查，确保 Capacitor 和状态栏已完全初始化
    setTimeout(() => {
      // 检查 safe-area-inset-top 是否可用且有效
      const safeAreaTop = getComputedStyle(document.documentElement)
        .getPropertyValue('env(safe-area-inset-top)')

      // 如果 safe-area-inset-top 不可用或为 0，使用 JavaScript 设置默认值
      // 这主要作为后备方案，因为 Capacitor 通常会自动设置 safe-area-inset-top
      if (!safeAreaTop || safeAreaTop === '0px' || safeAreaTop.trim() === '') {
        // Android 状态栏的标准高度通常是 24dp
        // 根据设备像素比调整（高DPI设备可能需要更大的值）
        const defaultStatusBarHeight = window.devicePixelRatio >= 3 ? 28 :
                                      window.devicePixelRatio >= 2 ? 26 : 24
        statusBarHeight.value = defaultStatusBarHeight

        // 直接设置 padding-top 作为后备方案
        if (navbarRef.value) {
          navbarRef.value.style.paddingTop = `${defaultStatusBarHeight}px`
        }
      }
    }, 100) // 延迟 100ms 确保初始化完成
  }
})

onUnmounted(() => {
  window.removeEventListener('cloud-showcase:tab-changed', handleShowcaseTabChanged as EventListener)
})

watch(isMobile, (mobile) => {
  if (!mobile) {
    closeMobileActions()
  }
})
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  /* 防止轻微阴影或误差造成横向滚动条 */
  overflow-x: hidden;
}

.navbar {
  background-color: var(--bg-white);
  border-bottom: 2px solid transparent;
  border-image: linear-gradient(to right, transparent, var(--primary-gold), transparent) 1;
  box-shadow: var(--shadow-sm);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 1000;
}

/* 在 Capacitor 原生环境中，为导航栏添加状态栏高度的 padding-top */
.navbar-native {
  padding-top: env(safe-area-inset-top);
}

/* 如果浏览器不支持 safe-area-inset-top，则不应用 padding */
@supports not (padding-top: env(safe-area-inset-top)) {
  .navbar-native {
    padding-top: 0;
  }
}

.navbar-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 64px;
}

.brand {
  cursor: pointer;
  user-select: none;
  justify-self: start;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.brand:focus,
.brand:active {
  outline: none;
}

.brand-text {
  font-size: 24px;
  font-weight: bold;
  background: linear-gradient(45deg, var(--primary-gold), var(--primary-gold-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav-menu {
  display: flex;
  justify-content: center;
  grid-column: 2;
}

.nav-menu-el {
  border-bottom: none;
  background: transparent;
}

:deep(.el-menu-item) {
  color: var(--text-dark);
  border-bottom: 2px solid transparent;
}

:deep(.el-menu-item:hover) {
  color: var(--primary-gold);
  background-color: transparent;
}

:deep(.el-menu-item.is-active) {
  color: var(--primary-gold);
  border-bottom-color: var(--primary-gold);
  background-color: transparent;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
  height: 100%;
  min-height: 40px;
}

.settings-btn {
  font-size: 20px;
  color: var(--text-dark);
  padding: 6px;
  transition: color 0.2s ease;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.settings-btn:hover {
  color: var(--primary-gold);
}

.settings-btn:focus,
.settings-btn:active {
  outline: none;
}

.settings-btn.settings-active {
  color: var(--primary-gold);
}

.github-btn {
  color: var(--text-dark);
  padding: 6px;
  transition: color 0.2s ease;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.github-btn:hover {
  color: var(--primary-gold);
}

.github-btn:focus,
.github-btn:active {
  outline: none;
}

.github-icon {
  display: block;
}

.nav-item-hint {
  font-size: 12px;
  color: var(--text-muted, #909399);
  margin-left: 4px;
}

.login-btn {
  color: var(--text-dark);
  font-size: 14px;
}

.login-btn:hover {
  color: var(--primary-gold);
}

.nav-username {
  font-size: 14px;
  line-height: 1;
  color: var(--text-dark);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
}

:deep(.settings-btn:focus),
:deep(.settings-btn:active),
:deep(.settings-btn:focus-visible) {
  outline: none;
  border: none;
}

.main-content {
  flex: 1;
  min-height: 100vh;
  padding-top: 64px;
}

.main-content.has-bottom-nav {
  padding-bottom: calc(64px + env(safe-area-inset-bottom));
}

.main-content.no-top-nav {
  padding-top: 0;
}

/* 兼容不支持 safe-area-inset-bottom 的环境 */
@supports not (padding-bottom: env(safe-area-inset-bottom)) {
  .main-content.has-bottom-nav {
    padding-bottom: 64px;
  }
}

/* 页面过渡动画 */
.no-transition-enter-active,
.no-transition-leave-active {
  transition: none;
}

.no-transition-enter-from,
.no-transition-leave-to {
  opacity: 1;
  transform: none;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.page-slide-up-enter-active,
.page-slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.page-slide-up-enter-from,
.page-slide-up-leave-to {
  transform: translateY(24px);
  opacity: 0;
}

.fab-group {
  position: fixed;
  bottom: 30px;
  right: 30px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 999;
}

.fab-btn {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--primary-gold), var(--primary-gold-light));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 30px;
  box-shadow: var(--shadow-purple);
  cursor: pointer;
  transition: all var(--transition-normal);
  outline: none;
  -webkit-tap-highlight-color: transparent;
  border: none;
}

.fab-list-move,
.fab-list-enter-active,
.fab-list-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 0.22s ease;
}

.fab-list-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.72);
  filter: blur(3px);
}

.fab-list-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.72);
  filter: blur(3px);
}

.fab-list-leave-active {
  position: absolute;
  right: 0;
}

.fab-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(212, 175, 55, 0.6);
}

.fab-btn:active {
  transform: scale(0.95);
}

.fab-btn:focus,
.fab-btn:active {
  outline: none;
}

.refresh-fab {
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
}

.refresh-fab:hover {
  background: linear-gradient(135deg, #8e7dff 0%, #7a6aff 100%);
}

.refresh-fab:focus,
.refresh-fab:active {
  outline: none;
}

.refresh-fab.loading {
  cursor: not-allowed;
  opacity: 0.8;
}

.selection-fab {
  background: #ffffff;
  color: var(--primary-gold);
  border: 1px solid rgba(212, 175, 55, 0.48);
}

.selection-fab:hover {
  background: linear-gradient(135deg, var(--primary-gold), var(--primary-gold-light));
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 6px 20px rgba(212, 175, 55, 0.46);
}

.selection-confirm-fab {
  position: relative;
  background: linear-gradient(
    135deg,
    var(--primary-gold-dark) 0%,
    var(--primary-gold) 52%,
    var(--primary-gold-light) 100%
  );
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.86);
  box-shadow:
    0 8px 22px rgba(212, 175, 55, 0.36),
    0 3px 12px rgba(162, 155, 254, 0.2);
}

.selection-confirm-fab:hover {
  background: linear-gradient(
    135deg,
    var(--primary-gold) 0%,
    var(--primary-gold-light) 72%,
    #fff4cf 100%
  );
  box-shadow:
    0 10px 26px rgba(212, 175, 55, 0.48),
    0 4px 14px rgba(162, 155, 254, 0.24);
}

.selection-exit-fab {
  background: linear-gradient(135deg, #ffffff 0%, #f8f7fb 58%, #f1edf8 100%);
  color: #56515f;
  border: 1px solid rgba(212, 175, 55, 0.38);
  box-shadow:
    0 8px 20px rgba(51, 51, 51, 0.12),
    0 3px 12px rgba(212, 175, 55, 0.14);
}

.selection-exit-fab:hover {
  background: linear-gradient(135deg, #ffffff 0%, #faf6e7 100%);
  color: var(--primary-gold-dark);
  border-color: rgba(212, 175, 55, 0.62);
  box-shadow:
    0 10px 24px rgba(51, 51, 51, 0.14),
    0 4px 14px rgba(212, 175, 55, 0.22);
}

.fab-count {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent-purple), var(--primary-gold));
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  border: 2px solid #ffffff;
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.16),
    0 2px 8px rgba(212, 175, 55, 0.22);
}

.mobile-action-layer {
  display: none;
}

.refresh-fab .is-loading {
  animation: rotate 1s linear infinite;
}

.refresh-fab:hover .el-icon:not(.is-loading) {
  transform: rotate(180deg);
  transition: transform 0.35s ease;
}

.fab-icon-enter-active,
.fab-icon-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fab-icon-enter-from,
.fab-icon-leave-to {
  opacity: 0;
  transform: scale(0.7);
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .navbar-content {
    padding: 0 12px;
    grid-template-columns: 1fr auto;
  }

  .brand-text {
    font-size: 20px;
  }

  .nav-actions {
    justify-self: end;
  }

  .settings-btn {
    font-size: 22px;
    padding: 6px;
  }

  .fab-group {
    bottom: 20px;
    right: 20px;
  }

  .fab-group.fab-mobile {
    bottom: calc(84px + env(safe-area-inset-bottom));
  }

  /* 兼容不支持 safe-area-inset-bottom 的环境 */
  @supports not (bottom: env(safe-area-inset-bottom)) {
    .fab-group.fab-mobile {
      bottom: 84px;
    }
  }

  .fab-btn {
    width: 50px;
    height: 50px;
    font-size: 24px;
  }

  .mobile-action-layer {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 1002;
    pointer-events: none;
  }

  .mobile-action-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
    pointer-events: auto;
  }

  .mobile-action-fab {
    position: fixed;
    right: 18px;
    bottom: calc(86px + env(safe-area-inset-bottom));
    width: 54px;
    height: 54px;
    border: 1px solid rgba(255, 255, 255, 0.68);
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary-gold), #e5c348);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow:
      0 16px 30px rgba(96, 78, 18, 0.24),
      0 5px 14px rgba(212, 175, 55, 0.32);
    pointer-events: auto;
    transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-action-fab.is-open {
    transform: scale(0.96);
    background: #364152;
    color: #fff;
    box-shadow:
      0 14px 26px rgba(15, 23, 42, 0.22),
      0 4px 12px rgba(15, 23, 42, 0.14);
  }

  .mobile-action-sheet {
    position: fixed;
    right: 16px;
    bottom: calc(150px + env(safe-area-inset-bottom));
    width: min(248px, calc(100vw - 88px));
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(226, 232, 240, 0.92);
    box-shadow:
      0 18px 42px rgba(15, 23, 42, 0.16),
      0 2px 10px rgba(212, 175, 55, 0.08);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    pointer-events: auto;
  }

  .mobile-action-item {
    min-height: 48px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-radius: 10px;
    background: rgba(248, 250, 252, 0.94);
    color: #334155;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    padding: 0 12px;
    font-size: 14px;
    font-weight: 800;
    text-align: left;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.72) inset;
    transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-action-item:active {
    transform: scale(0.98);
  }

  .mobile-action-item.primary {
    background: linear-gradient(135deg, var(--primary-gold), #e6c75b);
    border-color: rgba(212, 175, 55, 0.68);
    color: #ffffff;
    box-shadow:
      0 10px 20px rgba(212, 175, 55, 0.22),
      0 1px 0 rgba(255, 255, 255, 0.32) inset;
  }

  .mobile-action-item.loading {
    opacity: 0.72;
  }

  .mobile-action-icon {
    width: 32px;
    height: 32px;
    flex: 0 0 32px;
    border-radius: 50%;
    background: #ffffff;
    color: var(--primary-gold);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
  }

  .mobile-action-item.primary .mobile-action-icon {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.2);
    box-shadow: none;
  }

  .mobile-action-label {
    min-width: 0;
    line-height: 1.2;
    white-space: nowrap;
  }

  .mobile-selection-dock {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(76px + env(safe-area-inset-bottom));
    min-height: 58px;
    padding: 8px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(212, 175, 55, 0.22);
    box-shadow: 0 16px 38px rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    display: grid;
    grid-template-columns: 44px 1fr minmax(92px, auto);
    align-items: center;
    gap: 8px;
    pointer-events: auto;
  }

  .mobile-selection-exit,
  .mobile-selection-confirm {
    height: 42px;
    border: 0;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 800;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-selection-exit {
    background: #f1f5f9;
    color: #64748b;
  }

  .mobile-selection-confirm {
    padding: 0 14px;
    background: linear-gradient(135deg, var(--primary-gold), var(--primary-gold-light));
    color: #ffffff;
  }

  .mobile-selection-summary {
    min-width: 0;
    display: inline-flex;
    align-items: baseline;
    justify-content: center;
    gap: 5px;
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
  }

  .mobile-selection-summary strong {
    color: var(--primary-gold-dark);
    font-size: 20px;
  }

  .mobile-action-backdrop-enter-active,
  .mobile-action-backdrop-leave-active,
  .mobile-action-sheet-enter-active,
  .mobile-action-sheet-leave-active,
  .mobile-selection-dock-enter-active,
  .mobile-selection-dock-leave-active {
    transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .mobile-action-backdrop-enter-from,
  .mobile-action-backdrop-leave-to {
    opacity: 0;
  }

  .mobile-action-sheet-enter-from,
  .mobile-action-sheet-leave-to,
  .mobile-selection-dock-enter-from,
  .mobile-selection-dock-leave-to {
    opacity: 0;
    transform: translateY(14px) scale(0.98);
  }

  @supports not (bottom: env(safe-area-inset-bottom)) {
    .mobile-action-fab {
      bottom: 86px;
    }

    .mobile-action-sheet {
      bottom: 150px;
    }

    .mobile-selection-dock {
      bottom: 76px;
    }
  }

  /* 为主内容区域在移动端预留顶部导航高度，避免内容被遮挡 */
  .main-content {
    min-height: 100vh;
    padding-top: calc(64px + env(safe-area-inset-top));
  }

  @supports not (padding-top: env(safe-area-inset-top)) {
    .main-content {
      padding-top: 64px;
    }
  }
}

@media (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .navbar-content {
    padding: 0 12px;
    grid-template-columns: 1fr auto;
  }

  .brand-text {
    font-size: 20px;
  }

  .nav-actions {
    justify-self: end;
  }

  .settings-btn {
    font-size: 22px;
    padding: 6px;
  }

  .fab-group {
    bottom: 20px;
    right: 20px;
  }

  .fab-group.fab-mobile {
    bottom: calc(84px + env(safe-area-inset-bottom));
  }

  .fab-btn {
    width: 50px;
    height: 50px;
    font-size: 24px;
  }

  .mobile-action-layer {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 1002;
    pointer-events: none;
  }

  .mobile-action-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
    pointer-events: auto;
  }

  .mobile-action-fab {
    position: fixed;
    right: 18px;
    bottom: calc(86px + env(safe-area-inset-bottom));
    width: 54px;
    height: 54px;
    border: 1px solid rgba(255, 255, 255, 0.68);
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary-gold), #e5c348);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow:
      0 16px 30px rgba(96, 78, 18, 0.24),
      0 5px 14px rgba(212, 175, 55, 0.32);
    pointer-events: auto;
    transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-action-fab.is-open {
    transform: scale(0.96);
    background: #364152;
    color: #fff;
    box-shadow:
      0 14px 26px rgba(15, 23, 42, 0.22),
      0 4px 12px rgba(15, 23, 42, 0.14);
  }

  .mobile-action-sheet {
    position: fixed;
    right: 16px;
    bottom: calc(150px + env(safe-area-inset-bottom));
    width: min(248px, calc(100vw - 88px));
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(226, 232, 240, 0.92);
    box-shadow:
      0 18px 42px rgba(15, 23, 42, 0.16),
      0 2px 10px rgba(212, 175, 55, 0.08);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    pointer-events: auto;
  }

  .mobile-action-item {
    min-height: 48px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-radius: 10px;
    background: rgba(248, 250, 252, 0.94);
    color: #334155;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    padding: 0 12px;
    font-size: 14px;
    font-weight: 800;
    text-align: left;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.72) inset;
    transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-action-item.primary {
    background: linear-gradient(135deg, var(--primary-gold), #e6c75b);
    border-color: rgba(212, 175, 55, 0.68);
    color: #ffffff;
    box-shadow:
      0 10px 20px rgba(212, 175, 55, 0.22),
      0 1px 0 rgba(255, 255, 255, 0.32) inset;
  }

  .mobile-action-icon {
    width: 32px;
    height: 32px;
    flex: 0 0 32px;
    border-radius: 50%;
    background: #ffffff;
    color: var(--primary-gold);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
  }

  .mobile-action-item.primary .mobile-action-icon {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.2);
    box-shadow: none;
  }

  .mobile-action-label {
    min-width: 0;
    line-height: 1.2;
    white-space: nowrap;
  }

  .mobile-selection-dock {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(76px + env(safe-area-inset-bottom));
    min-height: 58px;
    padding: 8px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(212, 175, 55, 0.22);
    box-shadow: 0 16px 38px rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    display: grid;
    grid-template-columns: 44px 1fr minmax(92px, auto);
    align-items: center;
    gap: 8px;
    pointer-events: auto;
  }

  .main-content {
    min-height: 100dvh;
    padding-top: calc(64px + env(safe-area-inset-top));
  }
}

@media (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  @supports not (bottom: env(safe-area-inset-bottom)) {
    .fab-group.fab-mobile {
      bottom: 84px;
    }

    .mobile-action-fab {
      bottom: 86px;
    }

    .mobile-action-sheet {
      bottom: 150px;
    }

    .mobile-selection-dock {
      bottom: 76px;
    }
  }

  @supports not (padding-top: env(safe-area-inset-top)) {
    .main-content {
      padding-top: 64px;
    }
  }
}
</style>
