<template>
  <el-drawer
    v-model="visible"
    :class="['ip-characters-drawer', { 'is-mobile': isMobile }]"
    :direction="isMobile ? 'btt' : 'rtl'"
    :size="isMobile ? '86vh' : 'clamp(520px, 44vw, 760px)'"
    :with-header="false"
    :lock-scroll="!isMobile"
  >
    <div class="ip-drawer-shell">
      <header class="ip-drawer-header">
        <div class="ip-drawer-cover" aria-hidden="true">
          <img v-if="showCover" :src="ip?.cover_image as string" alt="" @error="coverFailed = true" />
          <span v-else class="ip-drawer-cover-initial">{{ coverInitial }}</span>
        </div>

        <div class="ip-drawer-heading">
          <span class="ip-drawer-kicker">IP Archive</span>
          <h2 class="ip-drawer-title">{{ ip?.name || '作品角色' }}</h2>
          <div class="ip-drawer-meta">
            <span v-if="typeLabel" class="ip-drawer-type">{{ typeLabel }}</span>
            <span class="ip-drawer-count">{{ characters.length }} 个角色</span>
            <span v-if="ip?.bgm_subject_id" class="ip-drawer-bgm">
              <el-icon :size="13"><Link /></el-icon>
              Bangumi
            </span>
          </div>
          <div v-if="keywords.length" class="ip-drawer-keywords">
            <span v-for="keyword in keywords" :key="keyword.id" class="ip-drawer-keyword">{{ keyword.value }}</span>
          </div>
        </div>

        <button type="button" class="ip-drawer-close" aria-label="关闭角色面板" @click="visible = false">×</button>
      </header>

      <div class="ip-drawer-toolbar">
        <el-input
          v-model="keywordFilter"
          class="ip-drawer-filter"
          placeholder="按角色名筛选"
          size="small"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button
          v-if="canManageCharacters"
          type="primary"
          size="small"
          class="ip-drawer-add"
          @click="ip && emit('add-character', ip)"
        >
          <el-icon><Plus /></el-icon>
          添加角色
        </el-button>
      </div>

      <div v-loading="loading" class="ip-drawer-body">
        <div v-if="filteredCharacters.length" class="ip-drawer-grid">
          <div
            v-for="char in filteredCharacters"
            :key="char.id"
            class="ip-drawer-tile"
            :class="{ clickable: canManageCharacters }"
            :title="canManageCharacters ? `编辑 ${char.name}` : char.name"
            @click="handleTileClick(char)"
          >
            <el-avatar :size="44" :src="char.avatar || undefined" shape="square" class="ip-drawer-avatar">
              <el-icon><UserFilled /></el-icon>
            </el-avatar>
            <span class="ip-drawer-tile-name">{{ char.name }}</span>
            <button
              v-if="canManageCharacters"
              type="button"
              class="ip-drawer-tile-delete"
              title="删除角色"
              aria-label="删除角色"
              @click.stop="emit('delete-character', char)"
            >
              <el-icon :size="13"><Delete /></el-icon>
            </button>
          </div>
        </div>
        <el-empty
          v-else-if="!loading"
          :description="keywordFilter.trim() ? '没有匹配的角色' : '该作品下暂无角色'"
          :image-size="96"
        />
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Delete, Link, Plus, Search, UserFilled } from '@element-plus/icons-vue'
import type { Character, IP, IPKeyword } from '@/api/types'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    ip: IP | null
    characters: Character[]
    loading?: boolean
    isAdmin?: boolean
    isMobile?: boolean
    /**
     * 是否可以维护该作品下的角色：管理员为 true，普通账号仅在打开的是
     * 自己的个人 IP 时为 true。未传时回落到 isAdmin（保持既有调用方行为）。
     */
    canManage?: boolean
  }>(),
  { loading: false, isAdmin: false, isMobile: false },
)

/** 角色维护权限：canManage 为页面按 IP 归属算出的结果；isAdmin 作为兼容兜底
 *  （Vue 会把缺省的 boolean prop 转成 false，所以这里用逻辑或而不是空值合并） */
const canManageCharacters = computed(() => props.canManage || props.isAdmin)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'add-character', ip: IP): void
  (e: 'edit-character', character: Character): void
  (e: 'delete-character', character: Character): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const keywordFilter = ref('')
const coverFailed = ref(false)

// 切换作品时重置筛选与封面兜底状态
watch(
  () => props.ip?.id,
  () => {
    keywordFilter.value = ''
    coverFailed.value = false
  },
)

const showCover = computed(() => Boolean(props.ip?.cover_image) && !coverFailed.value)

const coverInitial = computed(() => (props.ip?.name || '?').trim().charAt(0) || '?')

const keywords = computed<IPKeyword[]>(() => props.ip?.keywords ?? [])

const TYPE_LABELS: Record<number, string> = {
  1: '书籍',
  2: '动画',
  3: '音乐',
  4: '游戏',
  6: '三次元/特摄',
}

const typeLabel = computed(() => TYPE_LABELS[props.ip?.subject_type ?? 0] ?? '')

const filteredCharacters = computed(() => {
  const needle = keywordFilter.value.trim().toLowerCase()
  if (!needle) return props.characters
  return props.characters.filter((char) => char.name.toLowerCase().includes(needle))
})

const handleTileClick = (character: Character) => {
  if (!canManageCharacters.value) return
  emit('edit-character', character)
}
</script>

<style scoped>
:global(.el-drawer.ip-characters-drawer) {
  border-radius: 18px 0 0 18px;
  overflow: hidden;
}

:global(.el-drawer.ip-characters-drawer.is-mobile) {
  border-radius: 22px 22px 0 0;
}

:global(.el-drawer.ip-characters-drawer .el-drawer__body) {
  padding: 0;
  overflow: hidden;
}

.ip-drawer-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fbfaff;
}

.ip-drawer-header {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px 20px 16px;
  background: linear-gradient(150deg, #f6f3ff 0%, #eef1ff 60%, #f8f4ff 100%);
  border-bottom: 1px solid #eeeaf9;
}

.ip-drawer-cover {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  padding: 6px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(142, 125, 255, 0.16);
  overflow: hidden;
}

.ip-drawer-cover img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 10px;
}

.ip-drawer-cover-initial {
  font-size: 30px;
  font-weight: 700;
  color: rgba(90, 75, 255, 0.45);
}

.ip-drawer-heading {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ip-drawer-kicker {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: #a09ac4;
}

.ip-drawer-title {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  color: #2f3137;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ip-drawer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #7b8090;
}

.ip-drawer-type {
  padding: 1px 8px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid #e8e4f7;
  color: #6c658f;
  font-weight: 600;
}

.ip-drawer-bgm {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #4f9c62;
}

.ip-drawer-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ip-drawer-keyword {
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid #e6e1ff;
  background: #fff;
  color: #5a4bff;
  font-size: 11px;
  line-height: 18px;
}

.ip-drawer-close {
  position: absolute;
  top: 12px;
  right: 14px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  color: #8d88a8;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.16s ease, background 0.16s ease;
}

.ip-drawer-close:hover {
  color: #5a4bff;
  background: #fff;
}

.ip-drawer-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-bottom: 1px solid #efecfa;
  background: #fff;
}

.ip-drawer-filter {
  flex: 1;
  min-width: 0;
}

.ip-drawer-add {
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
}

.ip-drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 24px;
}

.ip-drawer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.ip-drawer-tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  background: #fff;
  border: 1px solid #f1f3f9;
  border-radius: 12px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.ip-drawer-tile.clickable {
  cursor: pointer;
}

.ip-drawer-tile.clickable:hover {
  transform: translateY(-1px);
  border-color: #e6e2ff;
  box-shadow: 0 6px 16px rgba(142, 125, 255, 0.12);
}

.ip-drawer-avatar {
  flex-shrink: 0;
  border-radius: 10px;
}

.ip-drawer-tile-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: #3f4249;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ip-drawer-tile-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 7px;
  background: #fdf5f6;
  color: #d9737f;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ip-drawer-tile:hover .ip-drawer-tile-delete,
.ip-drawer-tile-delete:focus-visible {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .ip-drawer-tile,
  .ip-drawer-close,
  .ip-drawer-tile-delete {
    transition: none;
  }

  .ip-drawer-tile.clickable:hover {
    transform: none;
  }
}
</style>
