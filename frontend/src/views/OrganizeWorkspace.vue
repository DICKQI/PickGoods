<template>
  <div class="organize-workspace">
    <!-- 桌面端分栏：与云展柜同款的 el-tabs（金色激活 + 下划条） -->
    <el-tabs v-if="!isMobile" v-model="activeTab" class="organize-tabs" @tab-change="handleTabChange">
      <el-tab-pane
        v-for="tab in ORGANIZE_TABS"
        :key="tab.key"
        :label="tab.label"
        :name="tab.key"
      />
    </el-tabs>

    <div class="workspace-panels">
      <Transition name="organize-tab-fade">
        <div v-if="visitedTabs.has('ip')" v-show="activeTab === 'ip'" key="ip" class="organize-section">
          <IPCharacterManagement />
        </div>
      </Transition>

      <Transition name="organize-tab-fade">
        <div v-if="visitedTabs.has('category')" v-show="activeTab === 'category'" key="category" class="organize-section">
          <CategoryManagement />
        </div>
      </Transition>

      <Transition name="organize-tab-fade">
        <div v-if="visitedTabs.has('theme')" v-show="activeTab === 'theme'" key="theme" class="organize-section">
          <ThemeManagement />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue'
import type { TabPaneName } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import {
  DEFAULT_ORGANIZE_TAB,
  ORGANIZE_TABS,
  normalizeOrganizeTab,
  type OrganizeTab,
} from '@/navigation/organize'

// 三个资料库体积都不小，按分栏首次访问时再加载，保持原有代码分割粒度。
const IPCharacterManagement = defineAsyncComponent(() => import('@/views/IPCharacterManagement.vue'))
const CategoryManagement = defineAsyncComponent(() => import('@/views/CategoryManagement.vue'))
const ThemeManagement = defineAsyncComponent(() => import('@/views/ThemeManagement.vue'))

const route = useRoute()
const router = useRouter()
const { isMobile } = useResponsiveDevice()

const activeTab = ref<OrganizeTab>(normalizeOrganizeTab(route.query.tab))
// 未访问过的分栏完全不挂载：首次进入只请求当前分栏的数据。
const visitedTabs = ref(new Set<OrganizeTab>([activeTab.value]))

/** 桌面点选分栏：把选择写回 URL 便于刷新与分享；移动端由顶部便签链接驱动。 */
const handleTabChange = (name: TabPaneName) => {
  const nextTab = normalizeOrganizeTab(name)
  if (route.path !== '/organize' || normalizeOrganizeTab(route.query.tab) === nextTab) return
  void router.replace({ path: '/organize', query: { ...route.query, tab: nextTab } })
}

watch(
  () => route.query.tab,
  (tab) => {
    if (route.path !== '/organize') return
    const nextTab = normalizeOrganizeTab(tab)
    if (activeTab.value === nextTab) return
    activeTab.value = nextTab
  },
)

watch(
  () => activeTab.value,
  (tab) => {
    visitedTabs.value.add(tab)
  },
)

// 直接打开 /organize（不带 tab）时补上默认分栏，便于复制链接。
watch(
  () => route.fullPath,
  () => {
    if (route.path !== '/organize' || typeof route.query.tab === 'string') return
    void router.replace({ path: '/organize', query: { ...route.query, tab: DEFAULT_ORGANIZE_TAB } })
  },
  { immediate: true },
)
</script>

<style scoped>
.organize-workspace {
  /* 三个内页各自带 20px 水平内边距，容器不再重复留白 */
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
  padding-bottom: 100px;
}

.organize-tabs {
  margin-top: 4px;
  padding: 0 20px;
}

.workspace-panels {
  position: relative;
  display: flow-root;
}

.organize-section {
  min-height: 400px;
}

/* 离场面板始终脱离文档流：两个面板不会上下叠高把页面撑跳。 */
.organize-tab-fade-leave-active {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;
}

/* 桌面精细指针：旧页快速淡出，新页延迟 70ms 再淡入，与云展柜页签同规格。 */
@media (hover: hover) and (pointer: fine) and (min-width: 769px) {
  .organize-tab-fade-enter-active {
    position: relative;
    z-index: 1;
    transition:
      opacity 0.18s ease 0.07s,
      transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1) 0.07s;
  }

  .organize-tab-fade-leave-active {
    transition:
      opacity 0.09s ease,
      transform 0.09s ease;
  }

  .organize-tab-fade-enter-from {
    opacity: 0;
    transform: translateY(8px);
  }

  .organize-tab-fade-leave-to {
    opacity: 0;
    transform: translateY(-8px);
  }
}

/* 触屏/窄屏：只做轻淡入淡出，避免便签跳转时出现位移抖动。 */
@media (hover: none), (max-width: 768px) {
  .organize-tab-fade-enter-active {
    position: relative;
    z-index: 1;
    transition: opacity 0.14s ease 0.04s;
  }

  .organize-tab-fade-leave-active {
    transition: opacity 0.08s ease;
  }

  .organize-tab-fade-enter-from,
  .organize-tab-fade-leave-to {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .organize-tab-fade-enter-active,
  .organize-tab-fade-leave-active {
    transition: none;
  }
}
</style>
