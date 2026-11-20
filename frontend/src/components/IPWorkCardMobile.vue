<template>
  <article class="ip-mobile-card" :data-ip-id="ip.id">
    <button
      type="button"
      class="ip-mobile-cover"
      :aria-label="`查看 ${ip.name} 的角色（${characterCount} 个）`"
      @click="emitOpen"
    >
      <img
        v-if="showCover"
        ref="coverImgRef"
        class="ip-mobile-cover-img"
        :class="{ 'is-loaded': coverLoaded }"
        :src="ip.cover_image as string"
        :alt="`${ip.name} 封面`"
        loading="lazy"
        decoding="async"
        @load="coverLoaded = true"
        @error="handleCoverError"
      />
      <span v-else class="ip-mobile-cover-fallback" aria-hidden="true">
        <span class="ip-mobile-cover-initial">{{ coverInitial }}</span>
      </span>

      <span v-if="typeLabel" class="ip-mobile-type" :class="typeClass">{{ typeLabel }}</span>
    </button>

    <div class="ip-mobile-body" @click="emitOpen">
      <div class="ip-mobile-title-row">
        <h3 class="ip-mobile-name" :title="ipTitle">{{ ip.name }}</h3>
        <span v-if="ip.user_id" class="ip-mobile-personal" title="用户自建的个人作品，仅归属者本人可见">个人</span>
        <el-icon v-if="ip.bgm_subject_id" class="ip-mobile-bgm" :size="12"><Link /></el-icon>
      </div>

      <div class="ip-mobile-tags">
        <span
          v-for="keyword in visibleKeywords"
          :key="keyword.id ?? keyword.value"
          class="ip-mobile-tag"
          :title="keyword.value"
        >
          {{ keyword.value }}
        </span>
        <span v-if="extraKeywordCount > 0" class="ip-mobile-tag is-more" :title="allKeywordText">
          +{{ extraKeywordCount }}
        </span>
        <span v-if="!keywords.length" class="ip-mobile-no-keyword">暂无关键词</span>
      </div>

      <div class="ip-mobile-footer">
        <span class="ip-mobile-count" :aria-label="`角色数量：${characterCount}`">
          <span class="ip-mobile-count-value">{{ characterCount }}</span>
          <span class="ip-mobile-count-label">角色</span>
        </span>

        <div class="ip-mobile-actions">
          <button
            v-if="showDragHandle"
            type="button"
            class="mobile-drag-handle"
            title="拖拽调整顺序"
            aria-label="拖拽调整顺序"
            @click.stop
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>

          <button
            v-if="canEdit || canSync"
            type="button"
            class="ip-mobile-menu"
            title="更多操作"
            aria-label="更多操作"
            @click.stop="emit('menu', ip)"
          >
            <el-icon :size="16"><MoreFilled /></el-icon>
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Link, MoreFilled } from '@element-plus/icons-vue'
import type { IP, IPKeyword } from '@/api/types'
import { ipLabel } from '@/utils/ip'

const props = withDefaults(
  defineProps<{
    ip: IP
    isAdmin?: boolean
    /**
     * 是否允许拖拽排序：页面在非「默认」排序下传 false，
     * 此时卡片上的拖拽把手直接不渲染。
     */
    reorderable?: boolean
    /** 是否可以编辑 / 删除这个作品 */
    canEdit?: boolean
    /** 是否显示「从 Bangumi 更新」 */
    canSync?: boolean
  }>(),
  { isAdmin: false, reorderable: true, canEdit: false, canSync: false },
)

const emit = defineEmits<{
  (e: 'open', ip: IP): void
  /** 让页面打开底部「更多」面板：编辑 / 删除 / BGM 更新都走面板，卡片本身不直接触发 */
  (e: 'menu', ip: IP): void
}>()

// 两列瀑布流里每张卡片只有半屏宽：关键词只留 2 个，多的折成 +N
const MAX_VISIBLE_KEYWORDS = 2

const coverImgRef = ref<HTMLImageElement | null>(null)
const coverFailed = ref(false)
const coverLoaded = ref(false)

// 命中浏览器缓存的图片可能不再触发 load 事件：挂载后补一次判定，避免封面一直透明
onMounted(() => {
  if (coverImgRef.value?.complete && coverImgRef.value.naturalWidth > 0) {
    coverLoaded.value = true
  }
})

const showCover = computed(() => Boolean(props.ip.cover_image) && !coverFailed.value)

const coverInitial = computed(() => (props.ip.name || '?').trim().charAt(0) || '?')

const ipTitle = computed(() => ipLabel(props.ip))

const characterCount = computed(() => {
  const count = props.ip.character_count
  return typeof count === 'number' ? count : 0
})

const keywords = computed<IPKeyword[]>(() => props.ip.keywords ?? [])

const visibleKeywords = computed(() => keywords.value.slice(0, MAX_VISIBLE_KEYWORDS))

const extraKeywordCount = computed(() => Math.max(0, keywords.value.length - MAX_VISIBLE_KEYWORDS))

const allKeywordText = computed(() => keywords.value.map((item) => item.value).join('、'))

/** 个人作品不参与官方目录的拖拽排序（与 PC 端 IPWorkCard 一致） */
const showDragHandle = computed(() => props.isAdmin && props.reorderable && !props.ip.user_id)

const TYPE_LABELS: Record<number, string> = {
  1: '书籍',
  2: '动画',
  3: '音乐',
  4: '游戏',
  6: '三次元/特摄',
}

const TYPE_CLASSES: Record<number, string> = {
  1: 'is-book',
  2: 'is-anime',
  3: 'is-music',
  4: 'is-game',
  6: 'is-real',
}

const typeLabel = computed(() => TYPE_LABELS[props.ip.subject_type ?? 0] ?? '')

const typeClass = computed(() => TYPE_CLASSES[props.ip.subject_type ?? 0] ?? 'is-plain')

const handleCoverError = () => {
  coverFailed.value = true
  coverLoaded.value = false
}

const emitOpen = () => emit('open', props.ip)

// 列表重排后同一个实例可能被复用给别的作品，封面状态要跟着重置
watch(
  () => props.ip.cover_image,
  () => {
    coverFailed.value = false
    coverLoaded.value = false
  },
)
</script>

<style scoped>
.ip-mobile-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border: 1px solid rgba(212, 175, 55, 0.14);
  border-radius: 14px;
  overflow: hidden;
  box-shadow:
    0 10px 24px -20px rgba(17, 24, 39, 0.34),
    0 3px 10px -9px rgba(212, 175, 55, 0.22);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

/* 拖拽中的占位卡（SortableJS 在拖动时加的类） */
.ip-mobile-card.sortable-ghost {
  opacity: 0.45;
}

.ip-mobile-card:active {
  transform: scale(0.985);
  box-shadow:
    0 6px 16px -16px rgba(17, 24, 39, 0.3),
    0 2px 8px -8px rgba(212, 175, 55, 0.2);
}

/* 封面：宽度占满整列，高度跟随图片原始比例（游戏方图 / 动画竖图各自自适应） */
.ip-mobile-cover {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: linear-gradient(150deg, #f7f5ff 0%, #eef0ff 55%, #f9f4ff 100%);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

.ip-mobile-cover:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(142, 125, 255, 0.55);
}

.ip-mobile-cover-img {
  display: block;
  width: 100%;
  height: auto;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.ip-mobile-cover-img.is-loaded {
  opacity: 1;
}

.ip-mobile-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  /* 没有封面时用 4:3 的浅色块占位，比 1:1 更不抢版面 */
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, #efe9ff 0%, #e2ecff 100%);
}

.ip-mobile-cover-initial {
  font-size: 34px;
  font-weight: 700;
  color: rgba(90, 75, 255, 0.42);
  letter-spacing: 2px;
}

.ip-mobile-type {
  position: absolute;
  top: 7px;
  left: 7px;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  color: #6b6f76;
}

.ip-mobile-type.is-book {
  color: #9a6a1f;
  background: #fdf4e3;
  border-color: #f0e0bf;
}

.ip-mobile-type.is-anime {
  color: #2f7a60;
  background: #edf6f2;
  border-color: #bfe3d3;
}

.ip-mobile-type.is-music {
  color: #3a6ea8;
  background: #eef4fc;
  border-color: #c8ddf3;
}

.ip-mobile-type.is-game {
  color: #9a3f4b;
  background: #f7eeee;
  border-color: #e5c2c6;
}

.ip-mobile-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 8px 9px 9px;
  cursor: pointer;
}

.ip-mobile-title-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.ip-mobile-name {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.32;
  color: var(--text-dark, #1f2937);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.ip-mobile-personal {
  flex: none;
  padding: 0 5px;
  border-radius: 7px;
  background: rgba(212, 175, 55, 0.16);
  border: 1px solid rgba(212, 175, 55, 0.5);
  color: var(--primary-gold-dark, #b7912a);
  font-size: 10px;
  line-height: 15px;
  white-space: nowrap;
}

.ip-mobile-bgm {
  flex: none;
  color: #8d86b8;
}

.ip-mobile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.ip-mobile-tag {
  max-width: 100%;
  padding: 1px 6px;
  border-radius: 7px;
  background: rgba(162, 155, 254, 0.12);
  color: var(--accent-purple-dark, #6b5ce7);
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ip-mobile-tag.is-more {
  background: rgba(212, 175, 55, 0.14);
  color: var(--primary-gold-dark, #b7912a);
}

.ip-mobile-no-keyword {
  font-size: 10px;
  line-height: 16px;
  color: #b6b3c9;
}

.ip-mobile-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}

.ip-mobile-count {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(162, 155, 254, 0.12);
  color: var(--accent-purple-dark, #6b5ce7);
}

.ip-mobile-count-value {
  font-size: 12px;
  font-weight: 800;
  line-height: 16px;
}

.ip-mobile-count-label {
  font-size: 10px;
  line-height: 16px;
  opacity: 0.8;
}

.ip-mobile-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.mobile-drag-handle,
.ip-mobile-menu {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid rgba(162, 155, 254, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: #8d86b8;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.mobile-drag-handle {
  cursor: grab;
  touch-action: none;
}

.mobile-drag-handle:active,
.ip-mobile-menu:active {
  background: rgba(162, 155, 254, 0.14);
  border-color: rgba(162, 155, 254, 0.36);
  color: var(--accent-purple-dark, #6b5ce7);
}

@media (prefers-reduced-motion: reduce) {
  .ip-mobile-card,
  .ip-mobile-cover-img,
  .mobile-drag-handle,
  .ip-mobile-menu {
    transition: none;
  }

  .ip-mobile-card:active {
    transform: none;
  }
}
</style>
