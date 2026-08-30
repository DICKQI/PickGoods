<template>
  <div class="club-workspace">
    <header class="workspace-header"><div><p class="eyebrow">CLUB WORKSPACE</p><h1>{{ authStore.user?.club?.name || '社团工作台' }}</h1></div><el-button text @click="router.push('/clubs')"><el-icon><View /></el-icon>查看公开主页</el-button></header>
    <nav class="workspace-tabs" aria-label="社团工作区"><router-link to="/club/goods">社团谷子</router-link><router-link to="/club/popularity">人气统计</router-link><router-link to="/club/profile">社团资料</router-link></nav>
    <router-view />
  </div>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { View } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
const router = useRouter(); const authStore = useAuthStore()
</script>
<style scoped>
.club-workspace { max-width: 1240px; margin: 0 auto; padding: 28px 24px 64px; }.workspace-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }.eyebrow { margin: 0 0 6px; color: var(--primary-gold-dark); font-size: var(--font-small); letter-spacing: .08em; }.workspace-header h1 { margin: 0; font-size: 28px; }.workspace-tabs { display: flex; gap: 6px; margin: 24px 0; border-bottom: 1px solid var(--secondary-gray-dark); }.workspace-tabs a { padding: 10px 16px; color: var(--text-regular); text-decoration: none; border-bottom: 2px solid transparent; }.workspace-tabs a.router-link-active { color: var(--accent-purple-dark); border-bottom-color: var(--primary-gold); font-weight: 600; }
@media (max-width: 768px) { .club-workspace { padding: 20px 16px calc(36px + env(safe-area-inset-bottom)); }.workspace-header h1 { font-size: 22px; }.workspace-tabs { overflow-x: auto; touch-action: pan-x; white-space: nowrap; } }
</style>
