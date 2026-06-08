<template>
  <div v-if="text" class="raw-viewer">
    <h4 class="raw-toggle" @click="collapsed = !collapsed">
      原始识别文本
      <span class="toggle-arrow" :class="{ 'is-expanded': !collapsed }">▸</span>
    </h4>

    <template v-if="!collapsed">
      <div class="raw-search-bar">
        <el-input
          v-model="searchQuery"
          placeholder="在原文中搜索..."
          size="small"
          clearable
          style="width: 220px"
          @clear="onClear"
          @input="onSearchInput"
        />
        <span v-if="searchQuery && matchCount > 0" class="search-stats">
          {{ currentIdx + 1 }} / {{ matchCount }}
        </span>
        <span v-if="searchQuery && matchCount === 0" class="search-stats search-none">
          无匹配
        </span>
        <el-button-group v-if="searchQuery && matchCount > 1">
          <el-button size="small" @click="goPrev">↑</el-button>
          <el-button size="small" @click="goNext">↓</el-button>
        </el-button-group>
      </div>

      <div ref="container" class="raw-text-body" v-html="rendered" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps<{ text: string }>()

const collapsed = ref(true)
const searchQuery = ref('')
const currentIdx = ref(0)
const container = ref<HTMLElement | null>(null)

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
}

const matchCount = computed(() => {
  if (!searchQuery.value || !props.text) return 0
  try {
    const re = new RegExp(escapeRegExp(searchQuery.value), 'gi')
    const m = props.text.match(re)
    return m ? m.length : 0
  } catch {
    return 0
  }
})

const rendered = computed(() => {
  const safe = escapeHtml(props.text).replace(/\n/g, '<br>')
  if (!searchQuery.value) return safe
  try {
    const re = new RegExp(`(${escapeRegExp(searchQuery.value)})`, 'gi')
    return safe.replace(re, '<mark class="hl">$1</mark>')
  } catch {
    return safe
  }
})

function scrollToMatch() {
  nextTick(() => {
    if (!container.value) return
    const marks = container.value.querySelectorAll<HTMLElement>('mark.hl')
    marks.forEach((m) => m.classList.remove('hl-active'))
    const target = marks[currentIdx.value]
    if (target) {
      target.classList.add('hl-active')
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  })
}

function goPrev() {
  if (matchCount.value <= 1) return
  currentIdx.value = currentIdx.value > 0 ? currentIdx.value - 1 : matchCount.value - 1
  scrollToMatch()
}

function goNext() {
  if (matchCount.value <= 1) return
  currentIdx.value = currentIdx.value < matchCount.value - 1 ? currentIdx.value + 1 : 0
  scrollToMatch()
}

function onSearchInput() {
  currentIdx.value = 0
  if (searchQuery.value) {
    scrollToMatch()
  }
}

function onClear() {
  searchQuery.value = ''
  currentIdx.value = 0
}

watch(() => props.text, () => {
  searchQuery.value = ''
  currentIdx.value = 0
  collapsed.value = true
})
</script>

<style scoped>
.raw-viewer { margin-top: 8px; }
.raw-toggle {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
}
.raw-toggle:hover { color: var(--primary-gold, #D4AF37); }
.toggle-arrow { display: inline-block; font-size: 12px; transition: transform 0.2s; }
.toggle-arrow.is-expanded { transform: rotate(90deg); }

.raw-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.search-stats { font-size: 12px; color: #67c23a; white-space: nowrap; min-width: 50px; }
.search-stats.search-none { color: #f56c6c; }

.raw-text-body {
  max-height: 260px;
  overflow: auto;
  padding: 10px 14px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fafbfc;
  font-size: 13px;
  line-height: 1.7;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-all;
}
:deep(mark.hl) {
  background: #fff3b0;
  color: #1a1a1a;
  border-radius: 2px;
  padding: 0 2px;
}
:deep(mark.hl-active) {
  background: #f5a623;
  color: #fff;
}
</style>
