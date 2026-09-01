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
          <p class="workspace-caption">公开目录、社团资料，还有大家的反馈，都在这里一起打理喵~</p>
        </div>
      </div>
      <el-button text class="public-link" @click="router.push(publicHomePath)">
        <el-icon><View /></el-icon>
        查看公开主页
      </el-button>
    </header>
    <nav v-if="!isGoodsEditor" class="workspace-tabs" aria-label="社团工作区">
      <span class="workspace-tab-slider" :style="tabSliderStyle" aria-hidden="true"></span>
      <router-link
        v-for="(tab, index) in workspaceTabs"
        :key="tab.name"
        class="workspace-tab"
        :class="{ 'is-active': activeTabIndex === index }"
        :to="tab.to"
        :aria-current="activeTabIndex === index ? 'page' : undefined"
      >
        <span>{{ tab.label }}</span><small>{{ tab.caption }}</small>
      </router-link>
    </nav>
    <router-view v-slot="{ Component }">
      <Transition name="workspace-content" mode="out-in">
        <component :is="Component" :key="route.name" />
      </Transition>
    </router-view>
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
const workspaceTabs = [
  { name: 'ClubGoods', to: '/club/goods', label: '社团谷子', caption: '目录运营' },
  { name: 'ClubPopularity', to: '/club/popularity', label: '人气统计', caption: '需求反馈' },
  { name: 'ClubProfile', to: '/club/profile', label: '社团资料', caption: '品牌信息' },
] as const
const activeTabIndex = computed(() => {
  const index = workspaceTabs.findIndex(tab => tab.name === route.name)
  return index >= 0 ? index : 0
})
const tabSliderStyle = computed(() => ({ transform: `translateX(${activeTabIndex.value * 100}%)` }))
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
.workspace-tabs { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0 0 20px; padding: 4px; border: 1px solid var(--secondary-gray-dark); border-radius: 12px; background: rgba(255,255,255,.74); isolation: isolate; }
.workspace-tab-slider { position: absolute; z-index: 0; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 3); border: 1px solid rgba(163,150,255,.2); border-radius: 8px; background: var(--accent-purple-soft); box-shadow: 0 4px 12px rgba(124,105,220,.08); pointer-events: none; will-change: transform; transition: transform 240ms cubic-bezier(.22, 1, .36, 1); }
.workspace-tab { position: relative; z-index: 1; display: grid; gap: 2px; min-width: 0; padding: 11px 16px; border-radius: 8px; color: var(--text-regular); text-decoration: none; transition: color var(--transition-fast); }
.workspace-tab span { overflow: hidden; font-size: var(--font-body); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.workspace-tab small { overflow: hidden; color: var(--text-light); font-size: var(--font-small); text-overflow: ellipsis; white-space: nowrap; }
.workspace-tab.is-active { color: var(--accent-purple-dark); }
.workspace-tab.is-active small { color: var(--primary-gold-dark); }
.workspace-content-enter-active,
.workspace-content-leave-active { transition: opacity 160ms ease; }
.workspace-content-enter-from,
.workspace-content-leave-to { opacity: 0; }
@media (max-width: 768px) {
  .club-workspace { padding: 18px 16px calc(84px + env(safe-area-inset-bottom)); }.club-workspace--editor { padding-bottom: 18px; }
  .workspace-header { align-items: flex-start; margin-bottom: 18px; }
  .workspace-avatar { width: 44px; height: 44px; }
  .workspace-header h1 { font-size: 22px; }
  .workspace-caption { display: none; }
  .public-link { padding: 6px 0; font-size: var(--font-caption); }
  .workspace-tabs { overflow-x: auto; grid-template-columns: repeat(3, minmax(112px, 1fr)); }
  .workspace-tab { padding: 9px 10px; text-align: center; }
  .workspace-tab small { display: none; }
}
</style>
