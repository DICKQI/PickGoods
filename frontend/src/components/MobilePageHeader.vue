<template>
  <header v-if="visible" class="mobile-page-header" :class="{ 'is-compact': mode !== 'tabs' }">
    <template v-if="mode === 'tabs'">
      <nav ref="rail" class="note-rail" aria-label="页面导航">
        <span v-if="tabs.length === 1" class="note-slot"><span class="note-paper is-selected">{{ tabs[0]?.label }}</span></span>
        <template v-else>
          <RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to" custom v-slot="{ href, navigate }">
            <a :href="href" class="note-slot" :aria-current="selected === tab.key ? 'page' : undefined"
              @click="navigate" @pointerdown="press($event)" @pointerup="release($event)" @pointercancel="release($event)" @pointerleave="release($event)">
              <span :ref="el => setPaper(tab.key, el)" class="note-paper" :class="{ 'is-selected': selected === tab.key }">{{ tab.label }}</span>
            </a>
          </RouterLink>
        </template>
      </nav>
      <div v-if="module === 'showcase' && auth.isAuthenticated && auth.isCollector" class="note-actions"><NotificationCenter /></div>
    </template>
    <template v-else>
      <button class="back-action" type="button" aria-label="返回" @click="goBack"><el-icon><ArrowLeft /></el-icon></button>
      <h1>{{ route.meta.title }}</h1>
      <RouterLink v-if="route.path === '/goods/drafts'" class="header-action" to="/goods/new">新增</RouterLink>
      <span v-else class="header-spacer" />
    </template>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import NotificationCenter from './NotificationCenter.vue'
import { useAuthStore } from '@/stores/auth'
import { activeMobileTab, mobileHeaderMode, mobileModule, mobileReturnTarget, mobileTabs } from '@/navigation/mobile'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const module = computed(() => mobileModule(route))
const mode = computed(() => mobileHeaderMode(route.path))
const tabs = computed(() => mobileTabs(module.value, auth))
const selected = computed(() => activeMobileTab(route))
// 只有单一工作区的模块没有切换价值，不占用顶部标签栏（社团目录）。
const visible = computed(() => mode.value !== 'tabs' || tabs.value.length > 1)
const rail = ref<HTMLElement>()
const papers = new Map<string, HTMLElement>()
const animations = new Map<HTMLElement, Animation>()
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function setPaper(key: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) papers.set(key, element)
  else papers.delete(key)
}
function animate(element: HTMLElement, active: boolean) {
  const start = getComputedStyle(element).transform
  animations.get(element)?.cancel()
  if (reduced() || !element.animate) return
  const end = active ? 'translateY(0) scale(1)' : 'translateY(0) scale(.9)'
  const frames = active ? [
    { transform: start, offset: 0 },
    { transform: 'translateY(-2px) scale(1.04)', offset: .52 },
    { transform: 'translateY(1px) scale(.985)', offset: .8 },
    { transform: end, offset: 1 },
  ] : [{ transform: start }, { transform: end }]
  animations.set(element, element.animate(frames, { duration: active ? 360 : 220, easing: 'ease-out' }))
}
function press(event: PointerEvent) {
  const paper = (event.currentTarget as HTMLElement).firstElementChild as HTMLElement
  if (!paper || reduced() || !paper.animate) return
  const start = getComputedStyle(paper).transform
  animations.get(paper)?.cancel()
  animations.set(paper, paper.animate([{ transform: start }, { transform: `${start === 'none' ? '' : start} scale(.96)` }], { duration: 80, fill: 'forwards' }))
}
function release(event: PointerEvent) {
  const paper = (event.currentTarget as HTMLElement).firstElementChild as HTMLElement
  if (paper) animate(paper, paper.classList.contains('is-selected'))
}
function revealSelected() {
  const paper = papers.get(selected.value)
  const container = rail.value
  if (!paper || !container) return
  const slot = paper.parentElement!
  const left = slot.offsetLeft - container.offsetLeft
  const right = left + slot.offsetWidth
  if (left < container.scrollLeft) container.scrollTo({ left: Math.max(0, left - 8), behavior: reduced() ? 'instant' : 'smooth' })
  else if (right > container.scrollLeft + container.clientWidth) container.scrollTo({ left: right - container.clientWidth + 8, behavior: reduced() ? 'instant' : 'smooth' })
}
watch(selected, async (current, previous) => {
  const old = papers.get(previous)
  const next = papers.get(current)
  if (old) animate(old, false)
  if (next) animate(next, true)
  await nextTick()
  revealSelected()
}, { flush: 'pre' })
watch(module, async () => { await nextTick(); revealSelected() })
nextTick(revealSelected)
function goBack() {
  if (window.history.state?.back) router.back()
  else void router.push(mobileReturnTarget(route))
}
onBeforeUnmount(() => animations.forEach(animation => animation.cancel()))
</script>

<style scoped>
.mobile-page-header { position: sticky; top: 0; z-index: 1001; display: flex; align-items: flex-end; min-width: 0; box-sizing: border-box; height: calc(44px + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); background: linear-gradient(135deg, #fbf3df, #f6f2ed 65%, #f1edf6); box-shadow: 0 1px 0 #b3954226; }
.note-rail { position: relative; display: flex; flex: 1; min-width: 0; align-items: flex-end; gap: 0; height: 44px; overflow-x: auto; scrollbar-width: none; padding: 0 8px; box-sizing: border-box; overscroll-behavior-x: contain; }
.note-rail::-webkit-scrollbar { display: none; }
.note-slot { display: flex; align-items: flex-end; justify-content: center; flex: 0 0 auto; min-width: 54px; height: 44px; color: inherit; text-decoration: none; border-radius: 15px 15px 0 0; -webkit-tap-highlight-color: transparent; }
.note-paper { display: flex; align-items: center; justify-content: center; white-space: nowrap; height: 36px; padding: 0 11px; border-radius: 15px 15px 4px 4px; box-sizing: border-box; transform-origin: center bottom; transform: scale(.9); font-size: 16px; font-weight: 600; color: #716959; transition: color 100ms, background-color 100ms, box-shadow 100ms; }
.note-paper.is-selected { color: #927015; background: #fffdf4; box-shadow: 0 -2px 9px #7f622915; height: 40px; border-radius: 13px 13px 0 0; transform: translateY(0) scale(1); }
.note-slot:focus-visible { outline: 2px solid #a3801a; outline-offset: -3px; }
.note-actions { flex: 0 0 44px; display: flex; align-items: center; justify-content: center; height: 44px; }
.is-compact { align-items: center; height: calc(56px + env(safe-area-inset-top)); gap: 8px; padding-inline: 8px; }
.is-compact h1 { flex: 1; min-width: 0; margin: 0; font-size: 17px; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
.back-action, .header-action { display: grid; place-items: center; min-width: 44px; min-height: 44px; border: 0; border-radius: 12px; background: transparent; color: #927015; text-decoration: none; font-size: 16px; cursor: pointer; }
.header-spacer { width: 44px; }
.back-action:focus-visible, .header-action:focus-visible { outline: 2px solid #927015; }
@media (prefers-reduced-motion: reduce) { .note-paper { transition: color 80ms; } }
</style>
