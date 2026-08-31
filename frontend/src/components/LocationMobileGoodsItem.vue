<template>
  <article
    class="location-mobile-goods-item"
    :class="{ 'is-selected': selected }"
    data-test="location-mobile-goods-item"
    role="button"
    tabindex="0"
    @click="emit('click', goods)"
    @keydown.enter.prevent="emit('click', goods)"
    @keydown.space.prevent="emit('click', goods)"
  >
    <button
      class="item-select"
      :class="{ 'is-selected': selected }"
      data-test="location-mobile-goods-select"
      type="button"
      :aria-pressed="selected"
      :aria-label="selected ? '取消选择谷子' : '选择谷子'"
      @click.stop="emit('select', goods)"
    >
      <span v-if="selected">✓</span>
    </button>

    <div class="item-thumb-wrap">
      <img
        v-if="goods.main_photo"
        class="item-thumb"
        :src="goods.main_photo"
        :alt="goods.name"
        loading="lazy"
      />
      <div v-else class="item-thumb-placeholder" aria-hidden="true">
        {{ placeholderText }}
      </div>
      <span v-if="goods.quantity > 1" class="item-quantity">x{{ goods.quantity }}</span>
    </div>

    <div class="item-body">
      <h3 :title="goods.name">{{ goods.name }}</h3>
      <div class="item-meta">
        <span class="item-status">{{ statusLabel }}</span>
        <span class="item-ip">{{ goods.ip.name }}</span>
      </div>
      <div class="item-category">
        <span class="category-dot" :style="{ backgroundColor: categoryColor }"></span>
        <span>{{ goods.category.name }}</span>
        <span class="item-source">{{ goods.is_official ? '官谷' : '同人' }}</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GoodsListItem, GoodsStatus } from '@/api/types'

const props = defineProps<{
  goods: GoodsListItem
  selected?: boolean
}>()

const emit = defineEmits<{
  click: [goods: GoodsListItem]
  select: [goods: GoodsListItem]
}>()

const statusLabelMap: Record<GoodsStatus, string> = {
  draft: '草稿',
  intended: '意向',
  in_cabinet: '在柜',
  outdoor: '外带',
  sold: '已出',
}

const statusLabel = computed(() => statusLabelMap[props.goods.status])
const categoryColor = computed(() => props.goods.category.color_tag || '#D4AF37')
const placeholderText = computed(() => props.goods.name.trim().slice(0, 1) || '谷')
</script>

<style scoped>
.location-mobile-goods-item {
  position: relative;
  min-width: 0;
  min-height: 92px;
  padding: 8px 8px 8px 62px;
  display: flex;
  align-items: stretch;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 15px;
  background:
    linear-gradient(145deg, rgba(255, 252, 244, 0.96), rgba(255, 255, 255, 0.98)),
    #fff;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.045);
  cursor: pointer;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.location-mobile-goods-item:active {
  transform: scale(0.985);
}

.location-mobile-goods-item:focus-visible {
  border-color: rgba(212, 175, 55, 0.62);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.16);
}

.location-mobile-goods-item.is-selected {
  border-color: rgba(212, 175, 55, 0.72);
  box-shadow:
    0 0 0 1px rgba(212, 175, 55, 0.24),
    0 8px 18px rgba(178, 132, 20, 0.1);
}

.item-select {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(148, 163, 184, 0.52);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #6b4a05;
  font-size: 14px;
  font-weight: 900;
  line-height: 1;
}

.item-select.is-selected {
  border-color: rgba(212, 175, 55, 0.82);
  background: linear-gradient(135deg, #fff4cc, #e6c05c);
}

.item-thumb-wrap {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border-radius: 12px;
  background: #f8fafc;
}

.item-thumb,
.item-thumb-placeholder {
  width: 100%;
  height: 100%;
}

.item-thumb {
  display: block;
  object-fit: cover;
}

.item-thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 248, 230, 0.98), transparent 55%),
    #f1f5f9;
  color: #9a6f09;
  font-size: 18px;
  font-weight: 900;
}

.item-quantity {
  position: absolute;
  right: 3px;
  bottom: 3px;
  min-width: 20px;
  height: 17px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.76);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
}

.item-body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-body h3 {
  min-height: 34px;
  margin: 0;
  padding-right: 24px;
  color: #172033;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.28;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-meta,
.item-category {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.2;
}

.item-status {
  flex: 0 0 auto;
  padding: 2px 5px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.12);
  color: #7a5b08;
  font-weight: 800;
}

.item-ip,
.item-category span:not(.category-dot) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-ip {
  flex: 1;
}

.category-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.item-source {
  flex: 0 0 auto;
  margin-left: auto;
  color: #94a3b8;
}
</style>
