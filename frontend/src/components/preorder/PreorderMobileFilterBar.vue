<template>
  <section class="preorder-mobile-filterbar" aria-label="预购筛选">
    <div class="preorder-mobile-filterbar__row">
      <div ref="chipsRef" class="preorder-mobile-filterbar__chips">
        <button
          v-for="option in statusOptions"
          :key="option.value"
          type="button"
          class="preorder-mobile-filterbar__chip"
          :class="{ 'is-selected': statusFilter === option.value }"
          @click="selectStatus(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <button
        type="button"
        class="preorder-mobile-filterbar__search-toggle"
        :class="{ 'is-active': searchExpanded }"
        aria-label="搜索预购"
        @click="toggleSearch"
      >
        <el-icon><Search /></el-icon>
      </button>
    </div>

    <Transition name="preorder-mobile-filterbar-search">
      <div v-if="searchExpanded" class="preorder-mobile-filterbar__search">
        <el-icon class="preorder-mobile-filterbar__search-icon"><Search /></el-icon>
        <input
          ref="searchInputRef"
          v-model="keyword"
          class="preorder-mobile-filterbar__input"
          type="search"
          placeholder="搜索手办名称"
          enterkeyhint="search"
          @input="handleInput"
        />
        <button
          v-if="searchKeyword"
          type="button"
          class="preorder-mobile-filterbar__clear"
          aria-label="清空搜索"
          @click="clearSearch"
        >
          <el-icon><Close /></el-icon>
        </button>
        <button type="button" class="preorder-mobile-filterbar__collapse" @click="collapseSearch">收起</button>
      </div>
    </Transition>

    <div class="preorder-mobile-filterbar__summary">
      共 {{ total }} 条 · 按补款时间从近到远
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Close, Search } from '@element-plus/icons-vue'
import type { PreorderStatus } from '@/api/types'
import { PREORDER_STATUS_OPTIONS } from '@/utils/preorder'

const props = defineProps<{
  statusFilter: PreorderStatus | ''
  searchKeyword: string
  total: number
}>()

const emit = defineEmits<{
  'update:statusFilter': [value: PreorderStatus | '']
  'update:searchKeyword': [value: string]
  search: []
  clear: []
  statusChange: [value: PreorderStatus | '']
}>()

const statusOptions = PREORDER_STATUS_OPTIONS
const chipsRef = ref<HTMLDivElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchExpanded = ref(false)
const keyword = ref(props.searchKeyword)

// 父组件可能程序化清空/重置搜索（如通知高亮定位时清空筛选），输入框必须跟随外部状态
watch(
  () => props.searchKeyword,
  (value) => {
    keyword.value = value
  }
)

const selectStatus = (value: PreorderStatus | '') => {
  emit('update:statusFilter', value)
  emit('statusChange', value)
}

const toggleSearch = () => {
  searchExpanded.value = !searchExpanded.value
  if (searchExpanded.value) {
    nextTick(() => searchInputRef.value?.focus())
  }
}

const collapseSearch = () => {
  searchExpanded.value = false
}

const handleInput = () => {
  emit('update:searchKeyword', keyword.value)
  emit('search')
}

const clearSearch = () => {
  keyword.value = ''
  emit('update:searchKeyword', '')
  emit('clear')
}

defineExpose({ collapseSearch })
</script>

<style scoped>
.preorder-mobile-filterbar {
  position: sticky;
  top: var(--app-navbar-height, 64px);
  z-index: 900;
  margin: 10px -12px 0;
  padding: 8px 12px 6px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1px solid rgba(212, 175, 55, 0.12);
  border-bottom: 1px solid rgba(212, 175, 55, 0.14);
  box-shadow: 0 8px 18px -18px rgba(17, 24, 39, 0.4);
}

.preorder-mobile-filterbar__row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.preorder-mobile-filterbar__chips {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 4px;
  overflow: visible;
}

.preorder-mobile-filterbar__chip {
  flex: 1 1 0;
  min-width: 0;
  height: 44px;
  padding: 0 4px;
  border-radius: 999px;
  border: 1px solid rgba(212, 175, 55, 0.2);
  background: rgba(248, 246, 252, 0.92);
  color: #5f5874;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-filterbar__chip.is-selected {
  background: linear-gradient(135deg, #fdf4da 0%, #f4da94 100%);
  border-color: rgba(212, 175, 55, 0.5);
  color: #7a5b08;
  font-weight: 800;
  box-shadow: 0 3px 10px rgba(212, 175, 55, 0.3);
}

.preorder-mobile-filterbar__search-toggle {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(212, 175, 55, 0.2);
  background: #fff;
  color: #8a650b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-filterbar__search-toggle.is-active {
  background: rgba(212, 175, 55, 0.14);
}

.preorder-mobile-filterbar__search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 0 4px 0 12px;
  min-height: 44px;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 12px;
  background: #fff;
}

.preorder-mobile-filterbar__search-icon {
  flex-shrink: 0;
  color: #b8b4c4;
  font-size: 16px;
}

.preorder-mobile-filterbar__input {
  flex: 1;
  min-width: 0;
  height: 42px;
  border: none;
  background: transparent;
  color: #2f2a20;
  font-size: 14px;
  outline: none;
}

.preorder-mobile-filterbar__clear {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #9ca3af;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-filterbar__collapse {
  flex-shrink: 0;
  height: 44px;
  padding: 0 14px;
  border: none;
  border-radius: 10px;
  background: rgba(212, 175, 55, 0.1);
  color: #8a650b;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-filterbar__summary {
  padding: 6px 4px 0;
  font-size: 12px;
  color: #9ca3af;
}

.preorder-mobile-filterbar-search-enter-active,
.preorder-mobile-filterbar-search-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.preorder-mobile-filterbar-search-enter-from,
.preorder-mobile-filterbar-search-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
