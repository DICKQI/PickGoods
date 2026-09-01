<template>
  <main class="club-page">
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
          <span>搜索</span>
        </el-button>
      </form>
    </header>

    <section v-loading="loading" class="club-list" aria-live="polite">
      <article v-for="club in clubs" :key="club.id" class="club-shop">
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
          </div>
        </header>

        <div v-if="club.preview_goods?.length" class="preview-grid" :aria-label="`${club.name}最新谷子`">
          <button
            v-for="item in club.preview_goods"
            :key="item.id"
            type="button"
            class="preview-item"
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
      @current-change="load"
    />
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Link, Picture, Search, Shop } from '@element-plus/icons-vue'
import { getClubs } from '@/api/clubs'
import type { Club } from '@/api/types'

type PlatformKey = 'taobao_url' | 'xiaohongshu_url' | 'weidian_url'

const platforms: Array<{ key: PlatformKey; label: string; logo: string }> = [
  { key: 'taobao_url', label: '淘宝', logo: '/brand/taobao.png' },
  { key: 'xiaohongshu_url', label: '小红书', logo: '/brand/xiaohongshu.png' },
  { key: 'weidian_url', label: '微店', logo: '/brand/weidian.png' },
]

const router = useRouter()
const clubs = ref<Club[]>([])
const search = ref('')
const loading = ref(false)
const page = ref(1)
const pageSize = 10
const total = ref(0)

function platformLinks(club: Club) {
  return platforms.filter(platform => Boolean(club[platform.key])).map(platform => ({
    ...platform,
    url: club[platform.key] as string,
  }))
}

function formatPrice(price: string | null) {
  return price ? `￥${price}` : '价格待定'
}

async function load() {
  loading.value = true
  try {
    const result = await getClubs({ page: page.value, page_size: pageSize, search: search.value || undefined })
    clubs.value = result.results
    total.value = result.count
  } finally {
    loading.value = false
  }
}

function openClub(id: number) {
  void router.push({ name: 'ClubDetail', params: { id } })
}

function handleSearch() {
  page.value = 1
  void load()
}

function handleClearSearch() {
  page.value = 1
  void load()
}

onMounted(load)
</script>

<style scoped>
.club-page {
  width: min(1260px, 100%);
  margin: 0 auto;
  padding: 32px 28px 64px;
  color: var(--text-dark);
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
    padding: 22px 16px calc(42px + env(safe-area-inset-bottom));
  }

  .directory-header {
    display: block;
    margin-bottom: 4px;
    padding-bottom: 18px;
  }

  .directory-search {
    width: 100%;
    margin-top: 17px;
  }

  .club-shop {
    padding: 19px 0 22px;
  }

  .club-shop:first-child {
    padding-top: 18px;
  }

  .club-shop__header {
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 13px;
  }

  .club-identity {
    gap: 10px;
  }

  .club-identity__avatar {
    width: 54px;
    height: 54px;
    border-radius: 13px;
    font-size: 21px;
  }

  .club-identity__description {
    max-width: 47vw;
  }

  .club-shop__actions {
    width: 100%;
    justify-content: space-between;
    gap: 0;
  }

  .preview-grid {
    gap: 10px;
  }

  .preview-item__body {
    display: block;
    min-height: 57px;
    padding: 8px 9px 9px;
  }

  .preview-item__name,
  .preview-item__price {
    display: block;
  }

  .preview-item__price {
    margin-top: 4px;
  }
}

@media (max-width: 480px) {
  .directory-heading h1 {
    font-size: 27px;
  }

  .club-identity__title h2 {
    font-size: var(--font-body);
  }

  .club-identity__description {
    max-width: 42vw;
  }

  .club-identity__meta {
    gap: 5px;
  }

  .preview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
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
