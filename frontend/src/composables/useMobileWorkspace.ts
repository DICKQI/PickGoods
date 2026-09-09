import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMobileWorkspaceStore } from '@/stores/mobileWorkspace'
import { mobileHeaderMode, mobileModule } from '@/navigation/mobile'

/** Keep scroll restoration separate from page state retained by the bounded cache. */
export function useMobileWorkspace(isMobile: Ref<boolean>) {
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const workspace = useMobileWorkspaceStore()
  let observer: ResizeObserver | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let frame = 0
  let generation = 0
  let contentAnimation: Animation | undefined
  let hasVisited = false
  function stopRestoring() {
    observer?.disconnect()
    observer = undefined
    clearTimeout(timer)
    cancelAnimationFrame(frame)
  }
  const removeGuard = router.beforeEach((_to, from) => {
    if (isMobile.value) workspace.saveScroll(from.fullPath, window.scrollY)
  })
  watch(() => `${auth.user?.id ?? 'anonymous'}:${auth.isAuthenticated}:${auth.isClub}`, () => {
    generation++
    stopRestoring()
    workspace.reset()
  }, { flush: 'sync' })
  watch(() => route.fullPath, async destination => {
    const revision = ++generation
    stopRestoring()
    if (!isMobile.value || mobileHeaderMode(route.path) === 'standalone') return
    if (mobileHeaderMode(route.path) === 'tabs') workspace.remember(mobileModule(route), destination)
    const target = workspace.scrollPositions[destination] ?? 0
    await nextTick()
    if (revision !== generation) return
    const restore = () => {
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      window.scrollTo({ top: Math.min(target, max), behavior: 'instant' })
    }
    frame = requestAnimationFrame(() => {
      if (revision !== generation) return
      restore()
      contentAnimation?.cancel()
      const content = document.querySelector<HTMLElement>('.mobile-shell > .main-content')
      if (hasVisited && content?.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        contentAnimation = content.animate([{ opacity: .25 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' })
      }
      hasVisited = true
      // Cached lists paint immediately; asynchronously loaded destinations may grow.
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(restore)
        observer.observe(document.body)
      }
      timer = setTimeout(stopRestoring, 1200)
    })
  }, { immediate: true, flush: 'post' })
  window.addEventListener('pointerdown', stopRestoring, { passive: true })
  window.addEventListener('wheel', stopRestoring, { passive: true })
  window.addEventListener('touchstart', stopRestoring, { passive: true })
  onBeforeUnmount(() => {
    generation++
    removeGuard()
    contentAnimation?.cancel()
    stopRestoring()
    window.removeEventListener('pointerdown', stopRestoring)
    window.removeEventListener('wheel', stopRestoring)
    window.removeEventListener('touchstart', stopRestoring)
  })
  return workspace
}
