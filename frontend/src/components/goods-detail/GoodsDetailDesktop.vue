<template>
  <section class="desktop-detail-panel">
    <header class="desktop-detail-header">
      <div>
        <!-- <p class="desktop-detail-kicker">收藏档案</p> -->
        <h2 class="desktop-detail-title" :title="detail.name">{{ detail.name }}</h2>
      </div>
      <el-tag :type="statusTagType" effect="dark" class="desktop-status-badge">
        {{ statusText }}
      </el-tag>
    </header>

    <section class="desktop-hero-card">
      <div class="desktop-media-area">
        <div class="desktop-main-image-wrap">
          <SquarePaddedImage
            v-if="detail.main_photo"
            :src="detail.main_photo"
            :alt="detail.name"
            :preview-src-list="allImages"
            class="desktop-main-image"
          />
          <div v-else class="desktop-image-placeholder">
            <el-icon><Picture /></el-icon>
            <span>暂无主图</span>
          </div>
        </div>
      </div>

      <aside class="desktop-profile-area">
        <div class="desktop-chip-row">
          <span class="desktop-chip" :class="detail.is_official ? 'is-official' : 'is-fanmade'">
            {{ detail.is_official ? '官谷' : '同人' }}
          </span>
          <span class="desktop-chip" :title="detail.category.path_name || detail.category.name">
            {{ detail.category.name }}
          </span>
        </div>

        <dl class="desktop-summary-list">
          <div class="desktop-summary-row">
            <dt>IP作品</dt>
            <dd :title="detail.ip.name">{{ detail.ip.name }}</dd>
          </div>
          <div class="desktop-summary-row">
            <dt>角色</dt>
            <dd class="desktop-character-list">
              <span
                v-for="char in detail.characters"
                :key="char.id"
                class="desktop-character-chip"
                :title="char.name"
              >
                {{ char.name }}
              </span>
            </dd>
          </div>
          <div v-if="detail.user?.username" class="desktop-summary-row">
            <dt>谷主</dt>
            <dd :title="detail.user.username">{{ detail.user.username }}</dd>
          </div>
          <div v-if="detail.theme" class="desktop-summary-row is-theme-row">
            <dt>主题</dt>
            <dd>
              <span class="desktop-theme-chip" :title="detail.theme.name">{{ detail.theme.name }}</span>
            </dd>
          </div>
        </dl>

        <div class="desktop-stat-grid">
          <article class="desktop-stat-card">
            <span class="desktop-stat-label">购入价格</span>
            <strong class="desktop-stat-value is-price">{{ priceText }}</strong>
          </article>
          <article class="desktop-stat-card">
            <span class="desktop-stat-label">入手日期</span>
            <strong class="desktop-stat-value">{{ detail.purchase_date || '未记录' }}</strong>
          </article>
          <article class="desktop-stat-card">
            <span class="desktop-stat-label">数量</span>
            <strong class="desktop-stat-value">x{{ detail.quantity }}</strong>
          </article>
          <article class="desktop-stat-card">
            <span class="desktop-stat-label">收纳位置</span>
            <strong class="desktop-stat-value" :title="locationText">{{ locationText }}</strong>
          </article>
        </div>

        <section v-if="detail.additional_photos.length > 0" class="desktop-thumbnail-panel">
          <div class="desktop-thumbnail-header">
            <div>
              <!-- <h3>附加图片</h3> -->
              <span>{{ detail.additional_photos.length }} 张附加图片</span>
            </div>
            <div v-if="totalThumbnailPages > 1" class="desktop-thumbnail-controls">
              <button
                class="desktop-thumbnail-nav desktop-thumbnail-prev"
                type="button"
                :disabled="thumbnailPage === 0"
                aria-label="上一组附加图片"
                @click="showPreviousThumbnails"
              >
                <el-icon><ArrowLeft /></el-icon>
              </button>
              <button
                class="desktop-thumbnail-nav desktop-thumbnail-next"
                type="button"
                :disabled="thumbnailPage >= totalThumbnailPages - 1"
                aria-label="下一组附加图片"
                @click="showNextThumbnails"
              >
                <el-icon><ArrowRight /></el-icon>
              </button>
            </div>
          </div>

          <div class="desktop-thumbnail-rail">
            <button
              v-for="{ photo, originalIndex } in visibleAdditionalPhotos"
              :key="photo.id"
              class="desktop-thumbnail"
              type="button"
              :title="photo.label || `补充图片 ${originalIndex + 1}`"
            >
              <el-image
                :src="photo.image"
                fit="cover"
                :preview-src-list="allImages"
                :initial-index="originalIndex + 1"
                class="desktop-thumbnail-image"
              >
                <template #error>
                  <div class="desktop-thumbnail-error">
                    <el-icon><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
              <span
                class="desktop-thumbnail-label"
                :class="{ 'is-placeholder': !photo.label }"
                :aria-hidden="!photo.label ? 'true' : undefined"
              >
                {{ photo.label || '\u00a0' }}
              </span>
            </button>
          </div>
        </section>
      </aside>
    </section>

    <section v-if="detail.notes" class="desktop-notes-section">
      <h3>备注</h3>
      <p>{{ detail.notes }}</p>
    </section>

    <section v-if="detail.theme" class="desktop-same-theme-section">
      <div class="desktop-section-title-row">
        <h3>同主题收藏</h3>
        <span class="same-theme-count">{{ sameThemeGoods.length }}</span>
      </div>

      <div v-if="sameThemeLoading" class="desktop-same-theme-loading">
        <el-skeleton :rows="3" animated />
      </div>
      <div v-else-if="sameThemeGoods.length === 0" class="desktop-same-theme-empty">
        <el-empty description="暂无同主题收藏" :image-size="80" />
      </div>
      <div v-else class="desktop-same-theme-grid">
        <button
          v-for="goods in sameThemeGoods"
          :key="goods.id"
          class="desktop-same-theme-card"
          type="button"
          @click="$emit('sameThemeClick', goods.id)"
        >
          <SquarePaddedImage
            v-if="goods.main_photo"
            :src="goods.main_photo"
            :alt="goods.name"
            class="desktop-same-theme-image"
          />
          <div v-else class="desktop-same-theme-placeholder">
            <el-icon><Picture /></el-icon>
          </div>
          <span class="desktop-same-theme-name" :title="goods.name">
            <span class="desktop-same-theme-name-text">{{ goods.name }}</span>
          </span>
        </button>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Picture } from '@element-plus/icons-vue'
import SquarePaddedImage from '@/components/SquarePaddedImage.vue'
import type { GoodsDetail, GoodsListItem } from '@/api/types'

const props = defineProps<{
  detail: GoodsDetail
  allImages: string[]
  statusText: string
  statusTagType: string
  sameThemeGoods: GoodsListItem[]
  sameThemeLoading: boolean
}>()

defineEmits<{
  sameThemeClick: [goodsId: string]
}>()

const thumbnailPageSize = 4
const thumbnailPage = ref(0)

const locationText = computed(() => props.detail.location_path || '未收纳')
const priceText = computed(() => (props.detail.price ? `¥ ${props.detail.price}` : '未记录'))
const totalThumbnailPages = computed(() =>
  Math.max(1, Math.ceil(props.detail.additional_photos.length / thumbnailPageSize)),
)
const visibleAdditionalPhotos = computed(() => {
  const start = thumbnailPage.value * thumbnailPageSize

  return props.detail.additional_photos.slice(start, start + thumbnailPageSize).map((photo, index) => ({
    photo,
    originalIndex: start + index,
  }))
})

const showPreviousThumbnails = () => {
  thumbnailPage.value = Math.max(0, thumbnailPage.value - 1)
}

const showNextThumbnails = () => {
  thumbnailPage.value = Math.min(totalThumbnailPages.value - 1, thumbnailPage.value + 1)
}

watch(
  () => props.detail.id,
  () => {
    thumbnailPage.value = 0
  },
)
</script>

<style scoped>
.desktop-detail-panel {
  --detail-panel-border: rgba(212, 175, 55, 0.24);
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100%;
  padding: 0 2px 28px;
  color: var(--text-dark, #333);
}

.desktop-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.desktop-detail-kicker {
  margin: 0 0 6px;
  color: var(--primary-gold-dark, #b8941f);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.desktop-detail-title {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: #2f2a20;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.desktop-status-badge {
  flex: 0 0 auto;
  margin-top: 2px;
}

.desktop-hero-card,
.desktop-stat-card,
.desktop-info-section,
.desktop-notes-section,
.desktop-same-theme-section {
  border: 1px solid var(--detail-panel-border);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.88)),
    var(--secondary-gray, #f5f5f7);
  box-shadow: 0 10px 28px rgba(82, 63, 16, 0.08);
}

.desktop-hero-card {
  display: grid;
  grid-template-columns: minmax(380px, 1.32fr) minmax(260px, 0.88fr);
  gap: 20px;
  align-items: start;
  padding: 14px;
}

.desktop-media-area {
  min-width: 0;
}

.desktop-profile-area {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px 4px 0;
}

.desktop-main-image-wrap {
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.34);
  border-radius: 16px;
  background: linear-gradient(135deg, #fafafa, var(--secondary-gray, #f5f5f7));
}

.desktop-main-image {
  width: 100%;
  height: 100%;
}

.desktop-image-placeholder {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: var(--text-light, #888);
  font-size: 13px;
}

.desktop-image-placeholder .el-icon {
  color: var(--primary-gold, #d4af37);
  font-size: 42px;
  opacity: 0.72;
}

.desktop-thumbnail-panel {
  min-width: 0;
  margin-top: 2px;
  padding-top: 12px;
  border-top: 1px dashed rgba(212, 175, 55, 0.22);
}

.desktop-thumbnail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.desktop-thumbnail-header h3 {
  margin: 0 0 3px;
  color: #2f2a20;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
}

.desktop-thumbnail-header span {
  color: var(--text-light, #888);
  font-size: 12px;
  line-height: 1.25;
}

.desktop-thumbnail-controls {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.desktop-thumbnail-nav {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid rgba(212, 175, 55, 0.24);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.82);
  color: #8a6510;
  cursor: pointer;
  transition: border-color var(--transition-fast, 0.2s ease), color var(--transition-fast, 0.2s ease), transform var(--transition-fast, 0.2s ease);
}

.desktop-thumbnail-nav:not(:disabled):hover {
  border-color: var(--primary-gold, #d4af37);
  color: var(--primary-gold-dark, #b8941f);
  transform: translateY(-1px);
}

.desktop-thumbnail-nav:disabled {
  color: var(--text-placeholder, #c0c4cc);
  cursor: not-allowed;
  opacity: 0.58;
}

.desktop-thumbnail-rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.desktop-thumbnail {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.desktop-thumbnail-image,
.desktop-thumbnail-error {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 12px;
  background: var(--secondary-gray, #f5f5f7);
}

.desktop-thumbnail-error {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light, #888);
}

.desktop-thumbnail-label {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--text-regular, #606266);
  font-size: 12px;
  line-height: 1.3;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop-thumbnail-label.is-placeholder {
  visibility: hidden;
}

.desktop-chip-row,
.desktop-character-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.desktop-chip,
.desktop-character-chip {
  max-width: 100%;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.1);
  color: #7c5f16;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding: 7px 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop-chip.is-fanmade {
  border-color: rgba(162, 155, 254, 0.34);
  background: var(--accent-purple-soft, #f6f4ff);
  color: #6358bd;
}

.desktop-chip.is-official {
  border-color: rgba(103, 194, 58, 0.32);
  background: rgba(103, 194, 58, 0.1);
  color: #3f8f2f;
}

.desktop-summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}

.desktop-summary-row {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.desktop-summary-row.is-theme-row {
  align-items: center;
}

.desktop-summary-row dt {
  color: var(--text-light, #888);
  font-size: 13px;
  line-height: 1.5;
}

.desktop-summary-row dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #333;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
}

.desktop-summary-row dd:not(.desktop-character-list) {
  white-space: nowrap;
}

.desktop-summary-row .is-location {
  color: var(--primary-gold-dark, #b8941f);
}

.desktop-theme-chip {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(162, 155, 254, 0.12));
  color: #7c5f16;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding: 7px 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.desktop-stat-card {
  min-width: 0;
  padding: 11px;
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.72)),
    rgba(245, 245, 247, 0.88);
  box-shadow: none;
}

.desktop-stat-label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-light, #888);
  font-size: 12px;
}

.desktop-stat-value {
  display: block;
  overflow: hidden;
  color: #2f2a20;
  font-size: 15px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop-stat-value.is-price {
  color: #f56c6c;
}

.desktop-notes-section,
.desktop-same-theme-section {
  padding: 18px;
}

.desktop-notes-section h3,
.desktop-same-theme-section h3 {
  margin: 0 0 14px;
  color: #2f2a20;
  font-size: 15px;
  font-weight: 800;
}

.desktop-notes-section p {
  margin: 0;
  border-radius: 12px;
  background: rgba(245, 245, 247, 0.9);
  color: var(--text-regular, #606266);
  font-size: 13px;
  line-height: 1.7;
  padding: 12px;
  white-space: pre-wrap;
}

.desktop-section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.same-theme-count {
  min-width: 24px;
  height: 22px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.14);
  color: #8a6510;
  font-size: 12px;
  font-weight: 800;
  line-height: 22px;
  text-align: center;
}

.desktop-same-theme-loading,
.desktop-same-theme-empty {
  padding-top: 4px;
}

.desktop-same-theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 12px;
}

.desktop-same-theme-card {
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  color: inherit;
  cursor: pointer;
  transition: transform var(--transition-fast, 0.2s ease), border-color var(--transition-fast, 0.2s ease), box-shadow var(--transition-fast, 0.2s ease);
}

.desktop-same-theme-card:hover {
  border-color: var(--primary-gold, #d4af37);
  box-shadow: 0 8px 18px rgba(82, 63, 16, 0.1);
  transform: translateY(-2px);
}

.desktop-same-theme-image,
.desktop-same-theme-placeholder {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 10px;
  background: var(--secondary-gray, #f5f5f7);
}

.desktop-same-theme-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light, #888);
  font-size: 22px;
}

.desktop-same-theme-name {
  display: block;
  margin-top: 7px;
  overflow: hidden;
  color: var(--text-regular, #606266);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop-same-theme-name-text {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  will-change: transform;
}

.desktop-same-theme-card:hover .desktop-same-theme-name-text {
  display: inline-block;
  max-width: none;
  min-width: max-content;
  overflow: visible;
  text-overflow: clip;
  animation: desktop-same-theme-name-marquee 5s linear infinite;
}

@keyframes desktop-same-theme-name-marquee {
  0%,
  14% {
    transform: translateX(0);
  }

  86%,
  100% {
    transform: translateX(calc(-100% + 92px));
  }
}

@media (max-width: 1320px) {
  .desktop-hero-card {
    grid-template-columns: 1fr;
  }

  .desktop-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
