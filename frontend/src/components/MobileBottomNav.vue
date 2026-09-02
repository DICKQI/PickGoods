<template>
  <nav class="mobile-bottom-nav">
    <div 
      v-for="item in navItems" 
      :key="item.path"
      class="nav-item"
      role="link"
      tabindex="0"
      :class="{ active: isActive(item.path) }"
      @click="handleNavClick(item.path)"
      @keydown.enter="handleNavClick(item.path)"
      @keydown.space.prevent="handleNavClick(item.path)"
    >
      <el-icon class="nav-icon">
        <component :is="item.icon" />
      </el-icon>
      <span class="nav-label">{{ item.label }}</span>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { CLUB_NAV_ITEMS, useMobileNavStore } from '@/stores/mobileNav'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const mobileNavStore = useMobileNavStore()

const navItems = computed(() => authStore.isClub ? CLUB_NAV_ITEMS : mobileNavStore.selectedItems)

const isCharacterStatsFromShowcase = computed(() => {
  const returnTo = route.query.returnTo
  return typeof returnTo === 'string' && returnTo.startsWith('/showcase')
})

const isActive = (path: string): boolean => {
  const currentPath = route.path
  if (path === '/showcase') {
    return currentPath.startsWith('/showcase') || (currentPath.startsWith('/characters/') && isCharacterStatsFromShowcase.value)
  }
  if (path === '/location') {
    return currentPath.startsWith('/location')
  }
  if (path === '/ipcharacter') {
    return currentPath.startsWith('/ipcharacter') || currentPath.startsWith('/ip') || (currentPath.startsWith('/character') && !isCharacterStatsFromShowcase.value)
  }
  if (path === '/category') {
    return currentPath.startsWith('/category')
  }
  if (path === '/theme') {
    return currentPath.startsWith('/theme')
  }
  if (path === '/club/goods') return currentPath.startsWith('/club/goods')
  if (path === '/club/popularity') return currentPath.startsWith('/club/popularity')
  if (path === '/club/profile') return currentPath.startsWith('/club/profile')
  if (path === '/clubs') return currentPath.startsWith('/clubs')
  return false
}

const handleNavClick = (path: string) => {
  router.push(path)
}
</script>

<style scoped>
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 100vw;
  box-sizing: border-box;
  background-color: #FFFFFF;
  border-top: 1px solid #F5F5F7;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.04);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
  z-index: 1000;
  height: calc(64px + env(safe-area-inset-bottom));
  overflow-x: hidden;
}

/* 兼容不支持 safe-area-inset-bottom 的环境 */
@supports not (padding-bottom: env(safe-area-inset-bottom)) {
  .mobile-bottom-nav {
    padding-bottom: 8px;
    height: 64px;
  }
}

.nav-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

.nav-item:active,
.nav-item:focus {
  transform: scale(0.95);
  opacity: 0.8;
  outline: none;
}

.nav-icon {
  font-size: 22px;
  transition: color 0.2s ease;
  color: #9ca3af;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  transition: color 0.2s ease;
  color: #9ca3af;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
}

.nav-item.active .nav-icon {
  color: #D4AF37;
}

.nav-item.active .nav-label {
  color: #D4AF37;
}

/* 选中状态的轻微动画效果 */
.nav-item.active {
  position: relative;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  background-color: #D4AF37;
  border-radius: 2px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) scaleX(0);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) scaleX(1);
  }
}
</style>
