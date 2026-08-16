<template>
  <Teleport to="body">
    <Transition name="base-bottom-sheet-fade">
      <div
        v-if="modelValue"
        class="base-bottom-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <button
          class="base-bottom-sheet__backdrop"
          type="button"
          aria-label="关闭面板"
          @click="close"
        />
        <Transition name="base-bottom-sheet-panel" appear>
          <section class="base-bottom-sheet__panel">
            <div class="base-bottom-sheet__handle" aria-hidden="true"></div>
            <header class="base-bottom-sheet__header">
              <div class="base-bottom-sheet__heading">
                <h3 class="base-bottom-sheet__title">{{ title }}</h3>
                <p v-if="subtitle" class="base-bottom-sheet__subtitle">{{ subtitle }}</p>
              </div>
              <slot name="header-extra" />
              <button
                ref="closeButtonRef"
                type="button"
                class="base-bottom-sheet__close"
                aria-label="关闭"
                @click="close"
              >
                <el-icon><Close /></el-icon>
              </button>
            </header>
            <div class="base-bottom-sheet__body">
              <slot />
            </div>
            <div v-if="$slots.footer" class="base-bottom-sheet__footer">
              <slot name="footer" />
            </div>
          </section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: boolean
  title: string
  subtitle?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const closeButtonRef = ref<HTMLButtonElement | null>(null)
let previousOverflow = ''
let previouslyFocused: HTMLElement | null = null

const close = () => {
  emit('update:modelValue', false)
}

const focusClose = () => {
  nextTick(() => closeButtonRef.value?.focus())
}

defineExpose({ close, focusClose })

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.modelValue) {
    close()
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      previouslyFocused = document.activeElement as HTMLElement | null
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleKeydown)
      focusClose()
    } else {
      document.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (props.modelValue) {
    document.body.style.overflow = previousOverflow
  }
})
</script>

<style scoped>
.base-bottom-sheet {
  position: fixed;
  inset: 0;
  z-index: 2400;
}

.base-bottom-sheet__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.24);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.base-bottom-sheet__panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  max-height: min(92dvh, 760px);
  height: min(92dvh, 760px);
  padding: 8px 0 0;
  border-radius: 20px 20px 0 0;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(212, 175, 55, 0.18);
  box-shadow:
    0 -18px 42px rgba(15, 23, 42, 0.18),
    0 -2px 12px rgba(212, 175, 55, 0.08);
}

.base-bottom-sheet__handle {
  flex-shrink: 0;
  width: 38px;
  height: 4px;
  margin: 2px auto 10px;
  border-radius: 999px;
  background: rgba(51, 51, 51, 0.14);
}

.base-bottom-sheet__header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 0 16px 12px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.12);
}

.base-bottom-sheet__heading {
  flex: 1;
  min-width: 0;
}

.base-bottom-sheet__title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #2f2a20;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-bottom-sheet__subtitle {
  margin: 3px 0 0;
  font-size: 12px;
  color: #6f6a7f;
  line-height: 1.5;
}

.base-bottom-sheet__close {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  margin: -6px -8px 0 0;
  border-radius: 50%;
  border: 1px solid #e5e7eb;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.base-bottom-sheet__close:active {
  transform: scale(0.94);
  color: #9a740b;
  border-color: rgba(212, 175, 55, 0.4);
}

.base-bottom-sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.base-bottom-sheet__footer {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid rgba(212, 175, 55, 0.12);
}

.base-bottom-sheet-fade-enter-active,
.base-bottom-sheet-fade-leave-active {
  transition: opacity 0.18s ease;
}

.base-bottom-sheet-fade-enter-from,
.base-bottom-sheet-fade-leave-to {
  opacity: 0;
}

.base-bottom-sheet-panel-enter-active,
.base-bottom-sheet-panel-leave-active {
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s ease;
}

.base-bottom-sheet-panel-enter-from,
.base-bottom-sheet-panel-leave-to {
  opacity: 0;
  transform: translateY(24px);
}

@media (prefers-reduced-motion: reduce) {
  .base-bottom-sheet-fade-enter-active,
  .base-bottom-sheet-fade-leave-active,
  .base-bottom-sheet-panel-enter-active,
  .base-bottom-sheet-panel-leave-active {
    transition: none;
  }
}
</style>
