import { computed, onMounted, onUnmounted, readonly, ref } from 'vue'

const MOBILE_MAX_WIDTH = 768
const TALL_PHONE_MAX_WIDTH = 1200
const TALL_PHONE_MIN_RATIO = 1.8

export interface ResponsiveDeviceInput {
  width: number
  height: number
  coarsePointer: boolean
}

export interface ResponsiveDeviceState {
  viewportWidth: number
  viewportHeight: number
  isCoarsePointer: boolean
  isTallPhone: boolean
  isMobile: boolean
}

export const getResponsiveDeviceState = ({
  width,
  height,
  coarsePointer,
}: ResponsiveDeviceInput): ResponsiveDeviceState => {
  const viewportWidth = Math.max(0, Math.round(width))
  const viewportHeight = Math.max(0, Math.round(height))
  const aspectRatio = viewportWidth > 0 ? viewportHeight / viewportWidth : 0
  const isPortrait = viewportHeight >= viewportWidth
  const isTallPhone =
    coarsePointer &&
    isPortrait &&
    viewportWidth <= TALL_PHONE_MAX_WIDTH &&
    aspectRatio >= TALL_PHONE_MIN_RATIO

  return {
    viewportWidth,
    viewportHeight,
    isCoarsePointer: coarsePointer,
    isTallPhone,
    isMobile: viewportWidth < MOBILE_MAX_WIDTH || isTallPhone,
  }
}

const readCoarsePointer = () => {
  if (typeof window === 'undefined') return false
  const coarseByMedia = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const coarseByTouch = navigator.maxTouchPoints > 0
  return coarseByMedia || coarseByTouch
}

const readCurrentState = () => {
  if (typeof window === 'undefined') {
    return getResponsiveDeviceState({
      width: 1024,
      height: 768,
      coarsePointer: false,
    })
  }

  return getResponsiveDeviceState({
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer: readCoarsePointer(),
  })
}

export const useResponsiveDevice = () => {
  const state = ref<ResponsiveDeviceState>(readCurrentState())
  const viewportWidth = computed(() => state.value.viewportWidth)
  const viewportHeight = computed(() => state.value.viewportHeight)
  const isCoarsePointer = computed(() => state.value.isCoarsePointer)
  const isTallPhone = computed(() => state.value.isTallPhone)
  const isMobile = computed(() => state.value.isMobile)
  let coarsePointerMedia: MediaQueryList | null = null

  const syncState = () => {
    state.value = readCurrentState()
  }

  onMounted(() => {
    syncState()
    window.addEventListener('resize', syncState)
    window.addEventListener('orientationchange', syncState)

    coarsePointerMedia = window.matchMedia?.('(pointer: coarse)') ?? null
    coarsePointerMedia?.addEventListener?.('change', syncState)
  })

  onUnmounted(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('resize', syncState)
    window.removeEventListener('orientationchange', syncState)
    coarsePointerMedia?.removeEventListener?.('change', syncState)
  })

  return {
    state: readonly(state),
    viewportWidth,
    viewportHeight,
    isCoarsePointer,
    isTallPhone,
    isMobile,
    syncState,
  }
}
