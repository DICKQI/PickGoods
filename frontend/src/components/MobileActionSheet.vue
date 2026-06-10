<template>
  <Teleport to="body">
    <Transition name="mobile-action-sheet-fade">
      <div
        v-if="modelValue"
        class="mobile-action-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <button class="mobile-action-sheet__backdrop" type="button" aria-label="关闭操作面板" @click="close" />
        <Transition name="mobile-action-sheet-panel" appear>
          <section class="mobile-action-sheet__panel">
            <div class="mobile-action-sheet__handle" aria-hidden="true"></div>
            <header class="mobile-action-sheet__header">
              <span class="mobile-action-sheet__title">{{ title }}</span>
            </header>

            <div class="mobile-action-sheet__menu">
              <button
                v-for="action in actions"
                :key="action.key"
                type="button"
                class="mobile-action-sheet__item"
                :class="`mobile-action-sheet__item--${action.tone || 'default'}`"
                :disabled="action.disabled"
                @click="selectAction(action.key)"
              >
                <span class="mobile-action-sheet__icon">
                  <el-icon><component :is="resolveIcon(action.icon)" /></el-icon>
                </span>
                <span class="mobile-action-sheet__label">{{ action.label }}</span>
              </button>
            </div>

            <button type="button" class="mobile-action-sheet__cancel" @click="close">取消</button>
          </section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { toRaw, type Component } from 'vue'

interface MobileAction {
  key: string
  label: string
  icon: Component
  tone?: 'default' | 'primary' | 'danger'
  disabled?: boolean
}

defineProps<{
  modelValue: boolean
  title: string
  actions: MobileAction[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [key: string]
}>()

const close = () => {
  emit('update:modelValue', false)
}

const selectAction = (key: string) => {
  emit('select', key)
  close()
}

const resolveIcon = (icon: Component) => toRaw(icon)
</script>

<style scoped>
.mobile-action-sheet {
  position: fixed;
  inset: 0;
  z-index: 2400;
}

.mobile-action-sheet__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.mobile-action-sheet__panel {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 0;
  padding: 8px 10px calc(12px + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(212, 175, 55, 0.18);
  box-shadow:
    0 -18px 42px rgba(15, 23, 42, 0.16),
    0 -2px 12px rgba(212, 175, 55, 0.08);
}

.mobile-action-sheet__handle {
  width: 38px;
  height: 4px;
  margin: 2px auto 10px;
  border-radius: 999px;
  background: rgba(51, 51, 51, 0.14);
}

.mobile-action-sheet__header {
  padding: 0 8px 10px;
  text-align: center;
}

.mobile-action-sheet__title {
  display: block;
  color: var(--text-light);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-action-sheet__menu {
  display: grid;
  gap: 8px;
}

.mobile-action-sheet__item,
.mobile-action-sheet__cancel {
  width: 100%;
  min-height: 50px;
  border-radius: 12px;
  border: 1px solid rgba(229, 229, 231, 0.92);
  background: #ffffff;
  color: var(--text-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 800;
  transition: transform var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.mobile-action-sheet__item:active,
.mobile-action-sheet__cancel:active {
  transform: scale(0.98);
}

.mobile-action-sheet__item:disabled {
  color: var(--text-lighter);
  background: var(--secondary-gray);
}

.mobile-action-sheet__item--primary {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent-purple), var(--accent-purple-dark));
  box-shadow: var(--shadow-purple);
}

.mobile-action-sheet__item--danger {
  color: #e5484d;
  border-color: rgba(245, 108, 108, 0.18);
  background: linear-gradient(135deg, #fff, #fff7f7);
}

.mobile-action-sheet__icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(212, 175, 55, 0.12);
  color: var(--primary-gold-dark);
  font-size: 16px;
}

.mobile-action-sheet__item--primary .mobile-action-sheet__icon {
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
}

.mobile-action-sheet__item--danger .mobile-action-sheet__icon {
  color: #e5484d;
  background: rgba(245, 108, 108, 0.1);
}

.mobile-action-sheet__label {
  min-width: 0;
}

.mobile-action-sheet__cancel {
  margin-top: 8px;
  color: var(--text-light);
  background: var(--secondary-gray);
}

.mobile-action-sheet-fade-enter-active,
.mobile-action-sheet-fade-leave-active {
  transition: opacity 0.18s ease;
}

.mobile-action-sheet-fade-enter-from,
.mobile-action-sheet-fade-leave-to {
  opacity: 0;
}

.mobile-action-sheet-panel-enter-active,
.mobile-action-sheet-panel-leave-active {
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s ease;
}

.mobile-action-sheet-panel-enter-from,
.mobile-action-sheet-panel-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

@media (prefers-reduced-motion: reduce) {
  .mobile-action-sheet-fade-enter-active,
  .mobile-action-sheet-fade-leave-active,
  .mobile-action-sheet-panel-enter-active,
  .mobile-action-sheet-panel-leave-active,
  .mobile-action-sheet__item,
  .mobile-action-sheet__cancel {
    transition: none;
  }
}
</style>
