<template>
  <article
    class="club-goods-mobile-card"
    :class="{
      'is-selected': selected,
      'is-selectable': selectionMode && !selectionDisabled,
      'is-disabled': selectionMode && selectionDisabled,
    }"
    :tabindex="selectionMode && !selectionDisabled ? 0 : undefined"
    :aria-label="selectionMode ? `${selected ? '取消选择' : '选择'}${item.name}` : undefined"
    @click="handleCardClick"
    @keydown.enter.prevent="handleCardKeydown"
    @keydown.space.prevent="handleCardKeydown"
  >
    <div v-if="selectionMode" class="club-goods-mobile-card__selection">
      <el-checkbox
        :model-value="selected"
        :disabled="selectionDisabled"
        :aria-label="`选择${item.name}`"
        @change="emit('toggle', Boolean($event))"
      />
    </div>

    <el-image
      v-if="item.main_photo && !imageError"
      :src="item.main_photo"
      :alt="`${item.name}图片`"
      fit="cover"
      lazy
      class="club-goods-mobile-card__thumb"
      @error="imageError = true"
    />
    <div v-else class="club-goods-mobile-card__thumb club-goods-mobile-card__thumb--placeholder" aria-label="暂无图片">
      <el-icon><Picture /></el-icon>
    </div>

    <div class="club-goods-mobile-card__body">
      <div class="club-goods-mobile-card__heading">
        <div class="club-goods-mobile-card__identity">
          <h3 :title="item.name">{{ item.name }}</h3>
          <p>{{ item.ip?.name || '未标注 IP' }} · {{ item.category?.name || '未分类' }}</p>
        </div>
        <button
          type="button"
          class="club-goods-mobile-card__more"
          :disabled="selectionMode"
          :aria-label="`打开${item.name}操作菜单`"
          @click.stop="emit('menu')"
        >
          <el-icon><MoreFilled /></el-icon>
        </button>
      </div>

      <div class="club-goods-mobile-card__facts">
        <strong :class="{ 'is-empty': !item.public_price }">{{ item.public_price ? `¥${item.public_price}` : '未设置价格' }}</strong>
        <el-tag size="small" :type="statusType(item.publication_status)">{{ statusLabel(item.publication_status) }}</el-tag>
        <span v-if="item.publish_at" class="club-goods-mobile-card__schedule">计划 {{ formatDate(item.publish_at) }}</span>
        <span v-if="item.publish_error" class="club-goods-mobile-card__error" :title="item.publish_error">上次上架失败</span>
      </div>

      <div class="club-goods-mobile-card__meta" aria-label="谷子人气统计">
        <span class="is-intended">意向 {{ popularity?.intended_user_count ?? 0 }}</span>
        <span class="is-acquired">已入手 {{ popularity?.acquired_user_count ?? 0 }}</span>
      </div>

      <div v-if="canMoveUp || canMoveDown" class="club-goods-mobile-card__reorder" aria-label="调整公开顺序">
        <button type="button" :disabled="!canMoveUp" aria-label="上移" @click.stop="emit('move', 'up')">
          <el-icon><ArrowUp /></el-icon>
        </button>
        <button type="button" :disabled="!canMoveDown" aria-label="下移" @click.stop="emit('move', 'down')">
          <el-icon><ArrowDown /></el-icon>
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowUp, MoreFilled, Picture } from '@element-plus/icons-vue'
import type { ClubCatalogItem, ClubPopularityItem, ClubPublicationStatus } from '@/api/types'

const props = defineProps<{
  item: ClubCatalogItem
  popularity?: ClubPopularityItem
  selectionMode: boolean
  selected: boolean
  selectionDisabled: boolean
  canMoveUp: boolean
  canMoveDown: boolean
}>()

const emit = defineEmits<{
  toggle: [selected: boolean]
  menu: []
  move: [direction: 'up' | 'down']
}>()

const imageError = ref(false)
const labels: Record<ClubPublicationStatus, string> = { draft: '草稿', listed: '已上架', unlisted: '已下架' }
const statusLabel = (status: ClubPublicationStatus) => labels[status]
const statusType = (status: ClubPublicationStatus) => ({ draft: 'info', listed: 'success', unlisted: 'warning' }[status] as 'info' | 'success' | 'warning')
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

function handleCardClick(event: MouseEvent) {
  if (!props.selectionMode || props.selectionDisabled) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, label, select, textarea')) return
  emit('toggle', !props.selected)
}

function handleCardKeydown(event: KeyboardEvent) {
  if (event.target !== event.currentTarget || !props.selectionMode || props.selectionDisabled) return
  emit('toggle', !props.selected)
}
</script>

<style scoped>
.club-goods-mobile-card { position: relative; display: flex; align-items: flex-start; gap: 11px; min-width: 0; padding: 11px; border: 1px solid var(--secondary-gray-dark); border-radius: 14px; background: var(--bg-white); transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background-color var(--transition-fast); }
.club-goods-mobile-card.is-selectable { cursor: pointer; }
.club-goods-mobile-card.is-selectable:focus-visible { outline: 2px solid rgba(212,175,55,.55); outline-offset: 2px; }
.club-goods-mobile-card.is-selected { border-color: var(--primary-gold); background: rgba(255,250,232,.72); box-shadow: 0 5px 16px rgba(128,99,20,.1); }
.club-goods-mobile-card.is-disabled { opacity: .65; }
.club-goods-mobile-card__selection { flex: 0 0 22px; padding-top: 4px; }
.club-goods-mobile-card__thumb { flex: 0 0 64px; width: 64px; height: 64px; border-radius: 10px; background: var(--secondary-gray); }
.club-goods-mobile-card__thumb--placeholder { display: grid; place-items: center; color: var(--text-light); }
.club-goods-mobile-card__body { position: relative; min-width: 0; flex: 1; }
.club-goods-mobile-card__heading { display: flex; align-items: flex-start; gap: 8px; }
.club-goods-mobile-card__identity { min-width: 0; flex: 1; }
.club-goods-mobile-card h3 { margin: 0 0 3px; overflow: hidden; color: var(--text-dark); font-size: var(--font-body); line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.club-goods-mobile-card p { margin: 0; overflow: hidden; color: var(--text-light); font-size: var(--font-small); line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.club-goods-mobile-card__more { flex: none; width: 30px; height: 30px; margin: -4px -4px 0 0; border: 0; border-radius: 50%; color: var(--text-light); background: transparent; cursor: pointer; }
.club-goods-mobile-card__more:active { color: var(--primary-gold-dark); background: rgba(212,175,55,.1); }
.club-goods-mobile-card__more:disabled { opacity: .35; cursor: default; }
.club-goods-mobile-card__facts { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 7px; margin-top: 7px; }
.club-goods-mobile-card__facts strong { color: var(--primary-gold-dark); font-size: var(--font-caption); }
.club-goods-mobile-card__facts strong.is-empty { color: var(--text-light); font-weight: 500; }
.club-goods-mobile-card__schedule, .club-goods-mobile-card__error { max-width: 100%; overflow: hidden; color: var(--text-light); font-size: var(--font-small); text-overflow: ellipsis; white-space: nowrap; }
.club-goods-mobile-card__error { color: var(--el-color-danger); }
.club-goods-mobile-card__meta { display: flex; flex-wrap: wrap; gap: 5px 10px; margin-top: 7px; font-size: var(--font-small); }
.club-goods-mobile-card__meta span { white-space: nowrap; }
.club-goods-mobile-card__meta .is-intended { color: var(--el-color-warning-dark-2); }
.club-goods-mobile-card__meta .is-acquired { color: var(--el-color-success-dark-2); }
.club-goods-mobile-card__reorder { position: absolute; right: 0; bottom: -2px; display: flex; gap: 3px; }
.club-goods-mobile-card__reorder button { display: inline-grid; place-items: center; width: 26px; height: 26px; border: 1px solid var(--secondary-gray-dark); border-radius: 7px; color: var(--text-light); background: #fff; cursor: pointer; }
.club-goods-mobile-card__reorder button:disabled { opacity: .35; cursor: default; }
.club-goods-mobile-card__reorder button:not(:disabled):active { color: var(--primary-gold-dark); border-color: var(--primary-gold-light); background: rgba(255,250,232,.8); }
</style>
