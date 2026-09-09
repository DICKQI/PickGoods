import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MobileModule } from '@/navigation/mobile'

export const useMobileWorkspaceStore = defineStore('mobileWorkspace', () => {
  const epoch = ref(0)
  const destinations = ref<Partial<Record<MobileModule, string>>>({})
  const scrollPositions = ref<Record<string, number>>({})
  const goodsChanged = ref(false)
  const clubGoodsChanged = ref(false)
  function remember(module: MobileModule, destination: string) { destinations.value[module] = destination }
  function saveScroll(key: string, top: number) { scrollPositions.value[key] = Math.max(0, top) }
  function reset() {
    destinations.value = {}
    scrollPositions.value = {}
    goodsChanged.value = false
    clubGoodsChanged.value = false
    epoch.value++
  }
  return { epoch, destinations, scrollPositions, goodsChanged, clubGoodsChanged, remember, saveScroll, reset }
})
