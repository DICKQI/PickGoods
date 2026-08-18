<template>
  <span
    ref="hostRef"
    class="overflow-marquee"
    :class="{ 'is-scrollable': isScrollable }"
    :style="{ '--overflow-marquee-duration': scrollDuration }"
    :title="text"
  >
    <span class="overflow-marquee__clip">
      <span ref="textRef" class="overflow-marquee__text">{{ text }}</span>
      <span class="overflow-marquee__track" aria-hidden="true">
        <span class="overflow-marquee__scroll-text">{{ text }}</span>
        <span class="overflow-marquee__scroll-text">{{ text }}</span>
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getReadableMarqueeDuration } from '@/utils/readableMarquee'

const props = defineProps<{
  text: string
}>()

const MARQUEE_GAP_PX = 18
const hostRef = ref<HTMLElement | null>(null)
const textRef = ref<HTMLElement | null>(null)
const isScrollable = ref(false)
const scrollDuration = ref('8s')
let resizeObserver: ResizeObserver | null = null

const syncOverflowState = async () => {
  await nextTick()
  const textEl = textRef.value
  const overflowing = !!textEl && textEl.scrollWidth > textEl.clientWidth + 1

  isScrollable.value = overflowing
  scrollDuration.value = overflowing && textEl
    ? getReadableMarqueeDuration(textEl.scrollWidth + MARQUEE_GAP_PX)
    : '8s'
}

onMounted(() => {
  void syncOverflowState()

  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    void syncOverflowState()
  })

  if (hostRef.value) resizeObserver.observe(hostRef.value)
  if (textRef.value) resizeObserver.observe(textRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(() => props.text, () => {
  isScrollable.value = false
  void syncOverflowState()
})
</script>

<style scoped>
.overflow-marquee {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
}

.overflow-marquee__clip {
  position: relative;
  display: block;
  max-width: 100%;
  overflow: hidden;
}

.overflow-marquee__text {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overflow-marquee__track {
  position: absolute;
  top: 0;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 18px;
  max-width: none;
  opacity: 0;
  white-space: nowrap;
  pointer-events: none;
}

.overflow-marquee__scroll-text {
  flex: 0 0 auto;
}

.overflow-marquee.is-scrollable .overflow-marquee__text {
  animation: overflowMarqueeEllipsis var(--overflow-marquee-duration, 8s) ease-in-out infinite;
}

.overflow-marquee.is-scrollable .overflow-marquee__track {
  animation: overflowMarqueeScroll var(--overflow-marquee-duration, 8s) ease-in-out infinite;
  will-change: transform, opacity;
}

@keyframes overflowMarqueeEllipsis {
  0%,
  18%,
  94%,
  100% {
    opacity: 1;
  }

  24%,
  88% {
    opacity: 0;
  }
}

@keyframes overflowMarqueeScroll {
  0%,
  18% {
    opacity: 0;
    transform: translateX(0);
  }

  24% {
    opacity: 1;
    transform: translateX(0);
  }

  88% {
    opacity: 1;
    transform: translateX(calc(-50% - 9px));
  }

  94%,
  100% {
    opacity: 0;
    transform: translateX(calc(-50% - 9px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .overflow-marquee.is-scrollable .overflow-marquee__text,
  .overflow-marquee.is-scrollable .overflow-marquee__track {
    animation: none;
  }
}
</style>
