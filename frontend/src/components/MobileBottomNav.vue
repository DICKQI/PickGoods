<template>
  <nav class="mobile-bottom-nav" :class="{ 'is-scroll-hidden': isScrollHidden }" aria-label="主导航" :style="{ '--module-count': items.length, '--active-index': activeIndex }">
    <span class="nav-selection-track" aria-hidden="true"><span class="nav-selection-pill" /></span>
    <RouterLink v-for="item in items" :key="item.key" :to="workspace.destinations[item.key] || item.to"
      class="nav-item" :class="{ active: currentModule === item.key }"
      :aria-current="currentModule === item.key ? 'page' : undefined">
      <span class="nav-icon-wrap">
        <el-icon class="nav-icon"><component :is="icons[item.key]" /></el-icon>
        <span
          v-if="item.key === 'profile' && (gamificationStore?.summary.unseen_count || 0) > 0"
          class="nav-unseen-dot"
          aria-label="有未读成就"
        />
      </span>
      <span class="nav-label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Shop, Grid, FolderOpened, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useMobileWorkspaceStore } from '@/stores/mobileWorkspace'
import { useGamificationStore } from '@/stores/gamification'
import { mobileModule, mobileModules } from '@/navigation/mobile'
const props = withDefaults(defineProps<{
  autoHideOnScroll?: boolean
}>(), {
  autoHideOnScroll: false,
})
const auth = useAuthStore()
const route = useRoute()
const workspace = useMobileWorkspaceStore()
const activePinia = getCurrentInstance()?.appContext.config.globalProperties.$pinia
const gamificationStore = activePinia ? useGamificationStore(activePinia) : null
if (auth.isAuthenticated && auth.isCollector) void gamificationStore?.loadSummary()
const items = computed(() => mobileModules(auth))
const currentModule = computed(() => mobileModule(route))
const activeIndex = computed(() => Math.max(0, items.value.findIndex(item => item.key === currentModule.value)))
const icons = { clubs: Shop, showcase: Grid, organize: FolderOpened, workbench: Grid, profile: User }

const SCROLL_STOP_DELAY = 500
// 连续向下滚动累计满该时长才收起，避免轻滑一下就把导航藏起来。
const SCROLL_HIDE_DELAY = 300
// 相邻两次向下滚动间隔超过该值视为中断，重新开始计时。
const SCROLL_CONTINUITY_GAP = 120
const isScrollHidden = ref(false)
let scrollStopTimer: number | null = null
// 只有用户自己滑动才收起；路由切换后的滚动位置恢复不能触发。
let userScrolling = false
// 方向基准：挂载与路由切换时同步为当前滚动位置，避免恢复滚动被当成下滑。
let lastScrollTop = window.scrollY
let downStreakStart: number | null = null
let lastDownAt = 0
const USER_SCROLL_EVENTS = ['touchstart', 'wheel', 'keydown'] as const
const markUserScrolling = () => { userScrolling = true }

function clearDownStreak() {
  downStreakStart = null
  lastDownAt = 0
}

function revealNav() {
  if (scrollStopTimer !== null) {
    window.clearTimeout(scrollStopTimer)
    scrollStopTimer = null
  }
  clearDownStreak()
  isScrollHidden.value = false
}

function handleScroll() {
  const scrollTop = window.scrollY
  const delta = scrollTop - lastScrollTop
  lastScrollTop = scrollTop

  if (!props.autoHideOnScroll || !userScrolling) return

  // 向上回看：立刻恢复，方便随时切 Tab。
  if (delta < 0) {
    revealNav()
    return
  }

  if (delta > 0) {
    const now = Date.now()
    if (downStreakStart === null || now - lastDownAt > SCROLL_CONTINUITY_GAP) downStreakStart = now
    lastDownAt = now
    if (now - downStreakStart >= SCROLL_HIDE_DELAY) isScrollHidden.value = true
  }

  if (scrollStopTimer !== null) window.clearTimeout(scrollStopTimer)
  scrollStopTimer = window.setTimeout(revealNav, SCROLL_STOP_DELAY)
}

watch(() => props.autoHideOnScroll, enabled => {
  if (!enabled) revealNav()
})
watch(() => route.fullPath, () => {
  userScrolling = false
  clearDownStreak()
  lastScrollTop = window.scrollY
  revealNav()
})

window.addEventListener('scroll', handleScroll, { passive: true })
// 捕获阶段：谷子卡片等子元素会在 touchstart 上 stopPropagation，
// 冒泡到 window 的监听就收不到「用户在滑动」的信号，滚动收起会整个失效。
USER_SCROLL_EVENTS.forEach(type => window.addEventListener(type, markUserScrolling, { passive: true, capture: true }))

onUnmounted(() => {
  revealNav()
  window.removeEventListener('scroll', handleScroll)
  USER_SCROLL_EVENTS.forEach(type => window.removeEventListener(type, markUserScrolling, { capture: true }))
})
</script>
<style scoped>
.mobile-bottom-nav { position: fixed; inset: auto 0 0; z-index: 1000; display: flex; align-items: center; box-sizing: border-box; height: calc(64px + env(safe-area-inset-bottom)); padding: 6px 8px calc(6px + env(safe-area-inset-bottom)); background: var(--bg-white, #fff); border-top: 1px solid var(--secondary-gray-dark, #eee); box-shadow: 0 -3px 18px #543c0710; transition: transform 180ms cubic-bezier(.4, 0, 1, 1), opacity 140ms ease-in; }
.mobile-bottom-nav.is-scroll-hidden { transform: translate3d(0, calc(100% + 2px), 0) scale(.94); opacity: 0; pointer-events: none; }
.nav-item { position: relative; z-index: 1; transition: color 180ms ease; flex: 1; min-width: 0; min-height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--text-light, #777); text-decoration: none; border-radius: 14px; -webkit-tap-highlight-color: transparent; }
.nav-icon { font-size: 23px; }
.nav-icon-wrap { position: relative; display: inline-flex; }
.nav-unseen-dot {
  position: absolute;
  top: -1px;
  right: -5px;
  width: 8px;
  height: 8px;
  border: 2px solid var(--bg-white, #fff);
  border-radius: 50%;
  background: #f56c6c;
}
.nav-label { font-size: 12px; line-height: 1.3; }
.nav-item.active { color: var(--primary-gold-dark, #997719); font-weight: 600; }
.nav-item:focus-visible { outline: 2px solid var(--primary-gold); outline-offset: -2px; }
.nav-selection-track { position: absolute; inset: 6px 8px calc(6px + env(safe-area-inset-bottom)); pointer-events: none; }
.nav-selection-pill { display: block; height: 100%; width: calc(100% / var(--module-count)); border-radius: 14px; background: linear-gradient(180deg, #d4af3724, #d4af3705); transform: translateX(calc(var(--active-index) * 100%)); transition: transform 280ms cubic-bezier(.22, 1, .36, 1); }
@media (prefers-reduced-motion: reduce) { .nav-selection-pill, .nav-item, .mobile-bottom-nav { transition: none; } }
</style>
