<template>
  <article class="ip-card" :class="{ 'is-admin': isAdmin }" @click="handleCardClick">
    <div class="ip-card-cover">
      <button
        type="button"
        class="ip-card-cover-hit"
        :aria-label="`查看 ${ip.name} 的角色（${characterCount} 个）`"
        @click.stop="emitOpen"
      >
        <img
          v-if="showCover"
          :src="ip.cover_image as string"
          :alt="`${ip.name} 封面`"
          class="ip-card-cover-image"
          loading="lazy"
          decoding="async"
          @error="coverFailed = true"
        />
        <span v-else class="ip-card-cover-placeholder" aria-hidden="true">
          <span class="ip-card-cover-initial">{{ coverInitial }}</span>
        </span>
      </button>

      <span v-if="typeLabel" class="ip-card-type" :class="typeClass">{{ typeLabel }}</span>

      <span v-if="isAdmin && !showCover" class="ip-card-cover-hint">暂无封面</span>

      <!-- 拖拽排序只对官方目录有意义：个人作品的顺序跟随归属者自己的列表 -->
      <button
        v-if="isAdmin && reorderable && !ip.user_id"
        type="button"
        class="ip-card-drag"
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
    </div>

    <div class="ip-card-body">
      <div class="ip-card-title-row">
        <button type="button" class="ip-card-name" :title="ipTitle" @click.stop="emitOpen">
          {{ ip.name }}
        </button>
        <span v-if="ip.user_id" class="ip-card-personal-badge" :title="personalBadgeHint">个人</span>
        <el-tooltip
          v-if="ip.bgm_subject_id"
          placement="top"
          :content="`已绑定 Bangumi (ID: ${ip.bgm_subject_id})`"
        >
          <el-icon class="ip-card-bgm-badge" :size="14"><Link /></el-icon>
        </el-tooltip>
      </div>

      <div class="ip-card-tags">
        <span
          v-for="keyword in visibleKeywords"
          :key="keyword.id ?? keyword.value"
          class="ip-card-keyword"
          :title="keyword.value"
        >
          {{ keyword.value }}
        </span>
        <span v-if="extraKeywordCount > 0" class="ip-card-keyword is-more" :title="allKeywordText">
          +{{ extraKeywordCount }}
        </span>
        <span v-if="!visibleKeywords.length" class="ip-card-no-keyword">暂无关键词</span>
      </div>

      <div class="ip-card-footer">
        <button type="button" class="ip-card-count" :aria-label="`角色数量：${characterCount}`" @click.stop="emitOpen">
          <span class="ip-card-count-value">{{ characterCount }}</span>
          <span class="ip-card-count-label">角色</span>
        </button>

        <div v-if="canEdit || canSync" class="ip-card-actions">
          <el-tooltip
            v-if="canSync"
            content="从 Bangumi 更新角色（增量同步）"
            placement="top"
            :show-after="400"
          >
            <button
              type="button"
              class="ip-card-action"
              title="从 BGM 更新"
              aria-label="从 Bangumi 更新角色"
              @click.stop="emit('bgm-sync', ip)"
            >
              <el-icon :size="15"><Refresh /></el-icon>
            </button>
          </el-tooltip>
          <button
            v-if="canEdit"
            type="button"
            class="ip-card-action"
            title="编辑"
            aria-label="编辑作品"
            @click.stop="emit('edit', ip)"
          >
            <el-icon :size="15"><Edit /></el-icon>
          </button>
          <button
            v-if="canEdit"
            type="button"
            class="ip-card-action is-danger"
            title="删除"
            aria-label="删除作品"
            @click.stop="emit('remove', ip)"
          >
            <el-icon :size="15"><Delete /></el-icon>
          </button>
        </div>
        <button v-else type="button" class="ip-card-open-hint" @click.stop="emitOpen">查看角色 ›</button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Delete, Edit, Link, Refresh } from '@element-plus/icons-vue'
import type { IP, IPKeyword } from '@/api/types'
import { ipLabel } from '@/utils/ip'

const props = withDefaults(
  defineProps<{
    ip: IP
    isAdmin?: boolean
    /**
     * 是否允许拖拽排序：页面在非「默认」排序下传 false，
     * 卡片右上角的拖拽把手直接不渲染（此时拖拽本来就是暂停的）。
     */
    reorderable?: boolean
    /**
     * 是否可以编辑 / 删除这个作品：管理员为 true；普通账号只有自己的个人 IP 为 true。
     * 官方 IP 对普通账号只读。
     */
    canEdit?: boolean
    /** 是否显示「从 Bangumi 更新」：需要管理员，或本人的个人 IP 且已配置个人 token */
    canSync?: boolean
  }>(),
  { isAdmin: false, reorderable: true, canEdit: false, canSync: false },
)

const emit = defineEmits<{
  (e: 'open', ip: IP): void
  (e: 'edit', ip: IP): void
  (e: 'remove', ip: IP): void
  (e: 'bgm-sync', ip: IP): void
}>()

const MAX_VISIBLE_KEYWORDS = 3

const coverFailed = ref(false)

const showCover = computed(() => Boolean(props.ip.cover_image) && !coverFailed.value)

const coverInitial = computed(() => (props.ip.name || '?').trim().charAt(0) || '?')

const ipTitle = computed(() => ipLabel(props.ip))

const personalBadgeHint = computed(() => '用户自建的个人作品，仅归属者本人可见')

const characterCount = computed(() => {
  const count = props.ip.character_count
  return typeof count === 'number' ? count : 0
})

const keywords = computed<IPKeyword[]>(() => props.ip.keywords ?? [])

const visibleKeywords = computed(() => keywords.value.slice(0, MAX_VISIBLE_KEYWORDS))

const extraKeywordCount = computed(() => Math.max(0, keywords.value.length - MAX_VISIBLE_KEYWORDS))

const allKeywordText = computed(() => keywords.value.map((item) => item.value).join('、'))

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

const emitOpen = () => emit('open', props.ip)

const handleCardClick = () => emitOpen()
</script>

<style scoped>
.ip-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #f0eefb;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  cursor: pointer;
}

.ip-card:hover {
  transform: translateY(-2px);
  border-color: #e2dcff;
  box-shadow: 0 10px 26px rgba(142, 125, 255, 0.16);
}

.ip-card:focus-within {
  border-color: #cfc6ff;
}

.ip-card-cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: linear-gradient(150deg, #f7f5ff 0%, #eef0ff 55%, #f9f4ff 100%);
  overflow: hidden;
}

.ip-card-cover-hit {
  display: block;
  width: 100%;
  height: 100%;
  padding: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  outline: none;
}

.ip-card-cover-hit:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(142, 125, 255, 0.55);
  border-radius: 14px;
}

.ip-card-cover-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 10px;
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ip-card:hover .ip-card-cover-image {
  transform: scale(1.03);
}

.ip-card-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  background: linear-gradient(135deg, #efe9ff 0%, #e2ecff 100%);
}

.ip-card-cover-initial {
  font-size: 42px;
  font-weight: 700;
  color: rgba(90, 75, 255, 0.42);
  letter-spacing: 2px;
}

.ip-card-personal-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(212, 175, 55, 0.16);
  border: 1px solid rgba(212, 175, 55, 0.5);
  color: var(--primary-gold-dark, #b7912a);
  font-size: 11px;
  line-height: 1.5;
  white-space: nowrap;
  flex: none;
}

.ip-card-type {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  color: #6b6f76;
}

.ip-card-type.is-book {
  color: #9a6a1f;
  background: #fdf4e3;
  border-color: #f0e0bf;
}

.ip-card-type.is-anime {
  color: #2f7a60;
  background: #edf6f2;
  border-color: #bfe3d3;
}

.ip-card-type.is-music {
  color: #3a6ea8;
  background: #eef4fc;
  border-color: #c8ddf3;
}

.ip-card-type.is-game {
  color: #9a3f4b;
  background: #f7eeee;
  border-color: #e5c2c6;
}

.ip-card-cover-hint {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #8d86b8;
  background: rgba(255, 255, 255, 0.86);
}

.ip-card-drag {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.92);
  color: #8f8aa8;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.16s ease, color 0.16s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.ip-card:hover .ip-card-drag,
.ip-card:focus-within .ip-card-drag,
.ip-card-drag:focus-visible {
  opacity: 1;
}

.ip-card-drag:hover {
  color: #5a4bff;
}

.ip-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px 14px;
}

.ip-card-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ip-card-name {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 600;
  color: #33353a;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ip-card-name:hover {
  color: #5a4bff;
}

.ip-card-bgm-badge {
  flex-shrink: 0;
  color: #67c23a;
}

.ip-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 22px;
}

.ip-card-keyword {
  max-width: 100%;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid #e6e1ff;
  background: linear-gradient(135deg, #f7f5ff 0%, #eeeaff 100%);
  color: #5a4bff;
  font-size: 11px;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ip-card-keyword.is-more {
  color: #7c7699;
  border-color: #ece9f6;
  background: #f6f5fb;
}

.ip-card-no-keyword {
  font-size: 11px;
  color: #b7b4c6;
  line-height: 18px;
}

.ip-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
}

.ip-card-count {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 2px 9px;
  border: 1px solid #f0eefb;
  border-radius: 999px;
  background: #faf9ff;
  cursor: pointer;
}

.ip-card-count-value {
  font-size: 14px;
  font-weight: 700;
  color: #4b4f57;
}

.ip-card-count-label {
  font-size: 11px;
  color: #8b90a0;
}

.ip-card-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.ip-card:hover .ip-card-actions,
.ip-card:focus-within .ip-card-actions {
  opacity: 1;
  transform: none;
}

.ip-card-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid #eef0f5;
  border-radius: 8px;
  background: #fff;
  color: #7b8090;
  cursor: pointer;
  transition: color 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.ip-card-action:hover {
  color: #5a4bff;
  border-color: #dfd8ff;
  background: #f8f6ff;
}

.ip-card-action.is-danger:hover {
  color: #e05260;
  border-color: #f2d2d6;
  background: #fdf5f6;
}

.ip-card-open-hint {
  padding: 0;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #8e7dff;
  cursor: pointer;
}

.ip-card-open-hint:hover {
  color: #5a4bff;
}

@media (prefers-reduced-motion: reduce) {
  .ip-card,
  .ip-card-cover-image,
  .ip-card-actions,
  .ip-card-drag {
    transition: none;
  }

  .ip-card:hover {
    transform: none;
  }

  .ip-card:hover .ip-card-cover-image {
    transform: none;
  }
}
</style>
