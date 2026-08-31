<template>
  <div class="club-workspace" :class="{ 'club-workspace--editor': isGoodsEditor }">
    <header class="workspace-header">
      <div class="workspace-identity">
        <el-avatar class="workspace-avatar" :src="authStore.user?.club?.avatar || undefined" :size="52">
          {{ (authStore.user?.club?.name || '社').slice(0, 1) }}
        </el-avatar>
        <div>
          <p class="eyebrow">CLUB WORKSPACE</p>
          <h1>{{ authStore.user?.club?.name || '社团工作台' }}</h1>
          <p class="workspace-caption">把公开目录、社团资料和用户反馈放在一个清晰的工作区里。</p>
        </div>
      </div>
      <el-button text class="public-link" @click="router.push(publicHomePath)">
        <el-icon><View /></el-icon>
        查看公开主页
      </el-button>
    </header>
    <nav v-if="!isGoodsEditor" class="workspace-tabs" aria-label="社团工作区">
      <router-link to="/club/goods"><span>社团谷子</span><small>目录运营</small></router-link>
      <router-link to="/club/popularity"><span>人气统计</span><small>需求反馈</small></router-link>
      <router-link to="/club/profile"><span>社团资料</span><small>品牌信息</small></router-link>
    </nav>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { View } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isGoodsEditor = computed(() => route.name === 'ClubGoodsNew' || route.name === 'ClubGoodsEdit')
const publicHomePath = computed(() => {
  const clubId = authStore.user?.club?.id
  return clubId ? `/clubs/${clubId}` : '/clubs'
})
</script>

<style scoped>
.club-workspace { max-width: 1240px; margin: 0 auto; padding: 28px 24px 72px; }.club-workspace--editor { padding-bottom: 28px; }
.workspace-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.workspace-identity { display: flex; align-items: center; gap: 14px; min-width: 0; }
.workspace-avatar { flex: none; border: 2px solid var(--primary-gold-light); background: var(--accent-purple-soft); color: var(--accent-purple-dark); }
.eyebrow { margin: 0 0 4px; color: var(--primary-gold-dark); font-size: var(--font-small); font-weight: 700; letter-spacing: .08em; }
.workspace-header h1 { margin: 0; color: var(--text-dark); font-size: 28px; line-height: 1.2; }
.workspace-caption { margin: 5px 0 0; color: var(--text-light); font-size: var(--font-caption); }
.public-link { flex: none; color: var(--text-regular); }
.public-link:hover { color: var(--primary-gold-dark); }
.workspace-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0 0 20px; padding: 4px; border: 1px solid var(--secondary-gray-dark); border-radius: 12px; background: rgba(255,255,255,.74); }
.workspace-tabs a { display: grid; gap: 2px; padding: 11px 16px; border-radius: 8px; color: var(--text-regular); text-decoration: none; transition: background-color var(--transition-fast), color var(--transition-fast); }
.workspace-tabs a span { font-size: var(--font-body); font-weight: 600; }
.workspace-tabs a small { color: var(--text-light); font-size: var(--font-small); }
.workspace-tabs a.router-link-active { color: var(--accent-purple-dark); background: var(--accent-purple-soft); }
.workspace-tabs a.router-link-active small { color: var(--primary-gold-dark); }
@media (max-width: 768px) {
  .club-workspace { padding: 18px 16px calc(84px + env(safe-area-inset-bottom)); }.club-workspace--editor { padding-bottom: 18px; }
  .workspace-header { align-items: flex-start; margin-bottom: 18px; }
  .workspace-avatar { width: 44px; height: 44px; }
  .workspace-header h1 { font-size: 22px; }
  .workspace-caption { display: none; }
  .public-link { padding: 6px 0; font-size: var(--font-caption); }
  .workspace-tabs { gap: 2px; overflow-x: auto; grid-template-columns: repeat(3, minmax(112px, 1fr)); }
  .workspace-tabs a { padding: 9px 10px; text-align: center; }
  .workspace-tabs a small { display: none; }
}
</style>
