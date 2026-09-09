<template>
  <nav class="mobile-bottom-nav" aria-label="主导航" :style="{ '--module-count': items.length, '--active-index': activeIndex }">
    <span class="nav-selection-track" aria-hidden="true"><span class="nav-selection-pill" /></span>
    <RouterLink v-for="item in items" :key="item.key" :to="workspace.destinations[item.key] || item.to"
      class="nav-item" :class="{ active: currentModule === item.key }"
      :aria-current="currentModule === item.key ? 'page' : undefined">
      <el-icon class="nav-icon"><component :is="icons[item.key]" /></el-icon>
      <span class="nav-label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Shop, Grid, FolderOpened, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useMobileWorkspaceStore } from '@/stores/mobileWorkspace'
import { mobileModule, mobileModules } from '@/navigation/mobile'
const auth = useAuthStore()
const route = useRoute()
const workspace = useMobileWorkspaceStore()
const items = computed(() => mobileModules(auth))
const currentModule = computed(() => mobileModule(route))
const activeIndex = computed(() => Math.max(0, items.value.findIndex(item => item.key === currentModule.value)))
const icons = { clubs: Shop, showcase: Grid, organize: FolderOpened, workbench: Grid, profile: User }
</script>
<style scoped>
.mobile-bottom-nav { position: fixed; inset: auto 0 0; z-index: 1000; display: flex; align-items: center; box-sizing: border-box; height: calc(64px + env(safe-area-inset-bottom)); padding: 6px 8px calc(6px + env(safe-area-inset-bottom)); background: var(--bg-white, #fff); border-top: 1px solid var(--secondary-gray-dark, #eee); box-shadow: 0 -3px 18px #543c0710; }
.nav-item { position: relative; z-index: 1; transition: color 180ms ease; flex: 1; min-width: 0; min-height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--text-light, #777); text-decoration: none; border-radius: 14px; -webkit-tap-highlight-color: transparent; }
.nav-icon { font-size: 23px; }
.nav-label { font-size: 12px; line-height: 1.3; }
.nav-item.active { color: var(--primary-gold-dark, #997719); font-weight: 600; }
.nav-item:focus-visible { outline: 2px solid var(--primary-gold); outline-offset: -2px; }
.nav-selection-track { position: absolute; inset: 6px 8px calc(6px + env(safe-area-inset-bottom)); pointer-events: none; }
.nav-selection-pill { display: block; height: 100%; width: calc(100% / var(--module-count)); border-radius: 14px; background: linear-gradient(180deg, #d4af3724, #d4af3705); transform: translateX(calc(var(--active-index) * 100%)); transition: transform 280ms cubic-bezier(.22, 1, .36, 1); }
@media (prefers-reduced-motion: reduce) { .nav-selection-pill, .nav-item { transition: none; } }
</style>
