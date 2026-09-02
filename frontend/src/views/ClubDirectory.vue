<template>
  <main
    class="club-page"
    @touchstart.capture.passive="handlePullStart"
    @touchmove="handlePullMove"
    @touchend="handlePullEnd"
    @touchcancel="resetPullRefresh"
  >
    <header class="directory-header">
      <div class="directory-heading">
        <p class="directory-kicker"><span class="directory-kicker__mark" aria-hidden="true"></span> PICKGOODS COMMUNITY</p>
        <h1>社团目录</h1>
      </div>

      <form class="directory-search" role="search" aria-label="搜索社团" @submit.prevent="handleSearch">
        <el-input
          v-model="search"
          clearable
          placeholder="搜索社团名称或简介"
          aria-label="搜索社团名称或简介"
          @clear="handleClearSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" native-type="submit" aria-label="搜索社团">
          <el-icon><Search /></el-icon>
          <span class="search-button__label">搜索</span>
        </el-button>
      </form>
    </header>

    <div class="club-page__content">
      <div
        v-if="isMobile"
        class="club-pull-indicator"
        :class="{ 'is-animating': pullIsAnimating }"
        :style="{ height: `${pullDistance}px`, opacity: pullDistance > 0 ? 1 : 0 }"
        aria-live="polite"
        @transitionend="clearPullRefreshAnimation"
      >
        <div class="club-pull-indicator__content">
          <el-icon v-if="isPullRefreshing" class="is-loading"><Loading /></el-icon>
          <el-icon v-else :style="{ transform: `rotate(${pullDistance > 50 ? 180 : 0}deg)` }"><Top /></el-icon>
          <span>{{ isPullRefreshing ? '正在刷新...' : (pullDistance > 50 ? '释放刷新' : '下拉刷新') }}</span>
        </div>
      </div>

      <section v-loading="loading" class="club-list" aria-live="polite">
      <article
        v-for="(club, index) in clubs"
        :key="club.id"
        class="club-shop"
        :class="{ 'club-shop--featured': isFeaturedClub(index) }"
      >
        <header class="club-shop__header">
          <button type="button" class="club-identity" @click="openClub(club.id)">
            <span class="club-identity__avatar">
              <el-image v-if="club.avatar" :src="club.avatar" :alt="`${club.name}头像`" fit="cover" lazy />
              <el-icon v-else aria-hidden="true"><Shop /></el-icon>
            </span>
            <span class="club-identity__copy">
              <span class="club-identity__title">
                <h2>{{ club.name }}</h2>
                <el-icon aria-hidden="true"><ArrowRight /></el-icon>
              </span>
              <span class="club-identity__description">{{ club.description || '这个社团还没有填写简介。' }}</span>
              <span class="club-identity__meta">
                <span>{{ club.goods_count }} 件上架谷子</span>
              </span>
            </span>
          </button>

          <div class="club-shop__actions">
            <div v-if="platformLinks(club).length || club.store_links?.length" class="club-shop__links" aria-label="社团店铺入口">
              <a
                v-for="platform in platformLinks(club)"
                :key="platform.key"
                class="platform-link"
                :href="platform.url"
                target="_blank"
                rel="noreferrer"
                :aria-label="`${platform.label}（在新窗口打开）`"
                :title="`${platform.label}（在新窗口打开）`"
                @click.stop
              >
                <img :src="platform.logo" :alt="`${platform.label} logo`" />
              </a>
              <a
                v-for="link in club.store_links"
                :key="link.url"
                class="custom-link"
                :href="link.url"
                target="_blank"
                rel="noreferrer"
                :aria-label="`${link.label}（在新窗口打开）`"
                :title="`${link.label}（在新窗口打开）`"
                @click.stop
              >
                <el-icon aria-hidden="true"><Link /></el-icon>
                <span>{{ link.label }}</span>
              </a>
            </div>
            <el-button class="enter-club-button" :aria-label="`进入${club.name}`" @click="openClub(club.id)">
              <span>进入</span>
              <el-icon aria-hidden="true"><ArrowRight /></el-icon>
            </el-button>
          </div>
        </header>

        <div v-if="club.preview_goods?.length" class="preview-grid" :aria-label="`${club.name}最新谷子`">
          <button
            v-for="item in club.preview_goods"
            :key="item.id"
            type="button"
            class="preview-item"
            :aria-label="`${item.name}，${formatPrice(item.public_price)}`"
            @click="openClub(club.id)"
          >
            <span class="preview-item__media">
              <el-image
                v-if="item.preview_photo"
                :src="item.preview_photo"
                :alt="`${item.name}图片`"
                fit="cover"
                lazy
              />
              <span v-else class="preview-item__placeholder" aria-label="暂无图片">
                <el-icon><Picture /></el-icon>
              </span>
            </span>
            <span class="preview-item__body">
              <span class="preview-item__name" :title="item.name">{{ item.name }}</span>
              <span class="preview-item__price">{{ formatPrice(item.public_price) }}</span>
            </span>
          </button>
        </div>
        <p v-else class="club-shop__empty"><el-icon><Picture /></el-icon>暂未公开谷子</p>
      </article>
    </section>

      <el-empty v-if="!loading && clubs.length === 0" description="暂无匹配的社团" />
      <el-pagination
        v-if="total > pageSize"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, Link, Loading, Picture, Search, Shop, Top } from '@element-plus/icons-vue'
import { getClubs } from '@/api/clubs'
import { useMobilePullRefresh } from '@/composables/useMobilePullRefresh'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import type { Club } from '@/api/types'

type PlatformKey = 'taobao_url' | 'xiaohongshu_url' | 'weidian_url'

const platforms: Array<{ key: PlatformKey; label: string; logo: string }> = [
  { key: 'taobao_url', label: '淘宝', logo: '/brand/taobao.png' },
  { key: 'xiaohongshu_url', label: '小红书', logo: '/brand/xiaohongshu.png' },
  { key: 'weidian_url', label: '微店', logo: '/brand/weidian.png' },
]

const router = useRouter()
const { isMobile } = useResponsiveDevice()
const clubs = ref<Club[]>([])
const search = ref('')
const loading = ref(false)
const page = ref(1)
const pageSize = 10
const total = ref(0)
const appliedSearch = ref('')
const loadedPage = ref(1)
const recommendationSeed = ref(createRecommendationSeed())

function createRecommendationSeed() {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`.slice(0, 64)
}

function platformLinks(club: Club) {
  return platforms.filter(platform => Boolean(club[platform.key])).map(platform => ({
    ...platform,
    url: club[platform.key] as string,
  }))
}

function formatPrice(price: string | null) {
  return price ? `￥${price}` : '价格待定'
}

function isFeaturedClub(index: number) {
  return loadedPage.value === 1 && appliedSearch.value === '' && index < 2
}

async function load(keyword: string, requestedPage = page.value) {
  loading.value = true
  try {
    const result = await getClubs(keyword
      ? { page: requestedPage, page_size: pageSize, search: keyword, ordering: 'name' }
      : {
          page: requestedPage,
          page_size: pageSize,
          search: undefined,
          ordering: 'recommended',
          recommendation_seed: recommendationSeed.value,
        })
    clubs.value = result.results
    total.value = result.count
    appliedSearch.value = keyword
    loadedPage.value = requestedPage
    return true
  } catch {
    // The global request layer reports the error; keep the currently rendered result and mode.
    page.value = loadedPage.value
    return false
  } finally {
    loading.value = false
  }
}

async function refreshDirectory() {
  const keyword = appliedSearch.value
  const previousSeed = recommendationSeed.value
  page.value = 1
  if (!keyword) recommendationSeed.value = createRecommendationSeed()

  const refreshed = await load(keyword, 1)
  if (!refreshed) {
    recommendationSeed.value = previousSeed
    return
  }
  ElMessage.success('刷新成功')
}

const {
  pullDistance,
  isRefreshing: isPullRefreshing,
  isAnimating: pullIsAnimating,
  clearAnimating: clearPullRefreshAnimation,
  handleTouchStart: handlePullStart,
  handleTouchMove: handlePullMove,
  handleTouchEnd: handlePullEnd,
  reset: resetPullRefresh,
} = useMobilePullRefresh({
  enabled: isMobile,
  blocked: loading,
  onRefresh: refreshDirectory,
})

function openClub(id: number) {
  void router.push({ name: 'ClubDetail', params: { id } })
}

function handleSearch() {
  page.value = 1
  void load(search.value.trim(), 1)
}

function handleClearSearch() {
  page.value = 1
  void load('', 1)
}

function handlePageChange(nextPage: number) {
  page.value = nextPage
  void load(appliedSearch.value, nextPage)
}

onMounted(() => {
  void load('', 1)
})
</script>

<style scoped>
.club-page {
  position: relative;
  width: min(1260px, 100%);
  margin: 0 auto;
  padding: 32px 28px 64px;
  color: var(--text-dark);
}

.club-pull-indicator {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
  color: var(--text-light);
  pointer-events: none;
}

.club-pull-indicator.is-animating {
  transition: height 0.28s ease, opacity 0.2s ease;
}

.club-pull-indicator__content {
  display: flex;
  height: 50px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding-bottom: 8px;
  font-size: 13px;
}

.club-pull-indicator__content .el-icon {
  color: var(--primary-gold-dark);
  font-size: 17px;
  transition: transform 0.22s ease;
}

.directory-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.32);
}

.directory-heading {
  min-width: 0;
}

.directory-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 9px;
  color: var(--primary-gold-dark);
  font-size: var(--font-small);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.directory-kicker__mark {
  width: 22px;
  height: 3px;
  border-radius: 2px;
  background: var(--primary-gold);
}

.directory-heading h1 {
  margin: 0;
  color: var(--text-dark);
  font-size: 34px;
  line-height: 1.2;
}

.directory-search {
  display: flex;
  width: min(390px, 100%);
  flex: none;
  gap: 8px;
}

.directory-search .el-input {
  min-width: 0;
  flex: 1;
}

.directory-search :deep(.el-input__wrapper) {
  min-height: 40px;
  border-radius: var(--button-radius);
  box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.24) inset, var(--shadow-sm);
}

.directory-search .el-button {
  min-height: 40px;
  border-radius: var(--button-radius);
}

.club-list {
  min-height: 180px;
}

.club-shop {
  padding: 23px 0 27px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.22);
}

.club-shop:first-child {
  padding-top: 4px;
}

.club-shop__header {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 17px;
}

.club-identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.club-identity:focus-visible,
.preview-item:focus-visible,
.platform-link:focus-visible,
.custom-link:focus-visible {
  outline: 2px solid var(--accent-purple);
  outline-offset: 3px;
}

.club-identity__avatar {
  display: grid;
  width: 66px;
  height: 66px;
  flex: none;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.42);
  border-radius: 16px;
  background: var(--bg-white);
  color: var(--accent-purple-dark);
  box-shadow: var(--shadow-sm);
  font-size: 25px;
}

.club-identity__avatar .el-image {
  width: 100%;
  height: 100%;
}

.club-identity__copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.club-identity__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.club-identity__title h2 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--text-dark);
  font-size: var(--font-title);
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-identity__title .el-icon {
  flex: none;
  color: var(--primary-gold-dark);
  transition: transform var(--transition-fast);
}

.club-identity:hover .club-identity__title .el-icon {
  transform: translateX(2px);
}

.club-identity__description {
  display: block;
  max-width: 620px;
  overflow: hidden;
  color: var(--text-regular);
  font-size: var(--font-caption);
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-identity__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  color: var(--text-light);
  font-size: var(--font-small);
}

.club-shop__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 14px;
}

.enter-club-button {
  display: none;
}

.club-shop__links {
  display: flex;
  align-items: center;
  gap: 6px;
}

.platform-link,
.custom-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  color: var(--accent-purple-dark);
  transition: transform var(--transition-fast), color var(--transition-fast), background-color var(--transition-fast);
}

.platform-link {
  width: 30px;
  border-radius: 7px;
}

.platform-link img {
  width: 24px;
  height: 24px;
  object-fit: cover;
}

.custom-link {
  gap: 4px;
  max-width: 120px;
  padding: 0 5px;
  overflow: hidden;
  border-radius: 5px;
  font-size: var(--font-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-link span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.platform-link:hover,
.custom-link:hover {
  color: var(--primary-gold-dark);
  transform: translateY(-1px);
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.preview-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: var(--card-radius-sm);
  outline: none;
  background: var(--bg-white);
  color: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-normal), border-color var(--transition-normal), box-shadow var(--transition-normal);
}

.preview-item:hover {
  border-color: rgba(212, 175, 55, 0.62);
  box-shadow: var(--shadow-md);
  transform: translateY(-3px);
}

.preview-item__media {
  position: relative;
  display: block;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--secondary-gray);
}

.preview-item__media .el-image,
.preview-item__media :deep(.el-image__inner) {
  display: block;
  width: 100%;
  height: 100%;
  transition: transform var(--transition-normal);
}

.preview-item:hover .preview-item__media .el-image {
  transform: scale(1.035);
}

.preview-item__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: var(--text-lighter);
  font-size: 28px;
}

.preview-item__body {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 47px;
  padding: 9px 10px 10px;
}

.preview-item__name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-dark);
  font-size: var(--font-caption);
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-item__price {
  flex: none;
  color: var(--primary-gold-dark);
  font-size: var(--font-caption);
  font-weight: 700;
  white-space: nowrap;
}

.club-shop__empty {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 72px;
  margin: 0;
  padding: 0 14px;
  border: 1px dashed rgba(212, 175, 55, 0.32);
  border-radius: var(--card-radius-sm);
  color: var(--text-light);
  font-size: var(--font-caption);
}

:deep(.el-empty) {
  padding: 48px 0;
}

:deep(.el-pagination) {
  justify-content: center;
  margin-top: 27px;
}

@media (max-width: 1024px) {
  .club-page {
    padding-right: 22px;
    padding-left: 22px;
  }

  .preview-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .club-shop__links {
    flex-wrap: wrap;
    gap: 4px;
  }

  .custom-link {
    max-width: 92px;
  }
}

@media (max-width: 768px) {
  .club-page {
    padding: 12px 12px calc(42px + env(safe-area-inset-bottom));
    overscroll-behavior-y: contain;
  }

  .directory-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    margin-bottom: 0;
    padding-bottom: 12px;
  }

  .directory-kicker {
    display: none;
  }

  .directory-heading h1 {
    font-size: 24px;
    white-space: nowrap;
  }

  .directory-search {
    width: 100%;
    min-width: 0;
    gap: 6px;
    margin-top: 0;
  }

  .directory-search :deep(.el-input__wrapper),
  .directory-search .el-button {
    min-height: 38px;
  }

  .directory-search .el-button {
    width: 38px;
    flex: 0 0 38px;
    padding: 0;
  }

  .search-button__label {
    display: none;
  }

  .club-shop {
    padding: 10px 0;
  }

  .club-shop:first-child {
    padding-top: 10px;
  }

  .club-shop--featured {
    padding-top: 12px;
    padding-bottom: 11px;
  }

  .club-shop__header {
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 0;
  }

  .club-shop--featured .club-shop__header {
    margin-bottom: 8px;
  }

  .club-identity {
    flex: 1;
    overflow: hidden;
    gap: 10px;
  }

  .club-identity__avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    font-size: 18px;
    box-shadow: none;
  }

  .club-identity__copy {
    gap: 1px;
  }

  .club-identity__title h2 {
    font-size: 15px;
    line-height: 1.3;
  }

  .club-identity__title .el-icon {
    display: none;
  }

  .club-identity__description {
    max-width: none;
    font-size: 12px;
    line-height: 1.35;
  }

  .club-identity__meta {
    gap: 4px;
    font-size: 11px;
    line-height: 1.35;
  }

  .club-shop__actions {
    width: auto;
    gap: 6px;
  }

  .club-shop__links {
    display: none;
  }

  .enter-club-button {
    display: inline-flex;
    min-width: 50px;
    height: 28px;
    min-height: 28px;
    padding: 0 7px;
    border-color: rgba(212, 175, 55, 0.38);
    border-radius: 6px;
    background: rgba(212, 175, 55, 0.14);
    color: var(--primary-gold-dark);
    font-size: 12px;
    box-shadow: none;
  }

  .enter-club-button:hover,
  .enter-club-button:focus,
  .enter-club-button:active {
    border-color: rgba(212, 175, 55, 0.58);
    background: rgba(212, 175, 55, 0.22);
    color: var(--primary-gold-dark);
  }

  .enter-club-button .el-icon {
    margin-left: 2px;
  }

  .preview-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  }

  .club-shop:not(.club-shop--featured) .preview-grid,
  .club-shop:not(.club-shop--featured) .club-shop__empty {
    display: none;
  }

  .preview-item {
    border: 0;
    border-radius: 6px;
    box-shadow: none;
  }

  .preview-item:hover,
  .preview-item:active {
    border-color: transparent;
    box-shadow: none;
    transform: none;
  }

  .preview-item__media {
    border-radius: 6px;
  }

  .preview-item__placeholder {
    font-size: 18px;
  }

  .preview-item__body {
    display: block;
    min-height: 18px;
    padding: 3px 1px 0;
    text-align: center;
  }

  .preview-item__name {
    display: none;
  }

  .preview-item__price {
    display: block;
    width: 100%;
    margin-top: 0;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.35;
    text-align: center;
    text-overflow: ellipsis;
  }

  .club-shop__empty {
    min-height: 38px;
    padding: 0 10px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .directory-header {
    gap: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .club-pull-indicator,
  .club-pull-indicator__content .el-icon,
  .club-identity__title .el-icon,
  .platform-link,
  .custom-link,
  .preview-item,
  .preview-item__media .el-image {
    transition: none;
  }

  .club-identity:hover .club-identity__title .el-icon,
  .platform-link:hover,
  .custom-link:hover,
  .preview-item:hover,
  .preview-item:hover .preview-item__media .el-image {
    transform: none;
  }
}
</style>
