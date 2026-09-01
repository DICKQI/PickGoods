<template>
  <section class="clubs-page" aria-labelledby="favorite-clubs-title">
    <header class="clubs-heading">
      <div>
        <p class="section-eyebrow">BOOKMARKS</p>
        <h2 id="favorite-clubs-title">我的社团</h2>
        <p>收藏过的社团会按最近收藏时间排好队哦~</p>
      </div>
      <el-button text class="directory-link" @click="goDirectory">
        <el-icon><Shop /></el-icon><span>浏览社团</span>
      </el-button>
    </header>

    <div v-loading="loading" class="favorite-list" aria-live="polite">
      <article v-for="item in items" :key="item.club.id" class="favorite-item">
        <button type="button" class="favorite-identity" :aria-label="`查看${item.club.name}`" @click="openClub(item.club.id)">
          <span class="favorite-avatar">
            <el-image v-if="item.club.avatar" :src="item.club.avatar" :alt="`${item.club.name}头像`" fit="cover" lazy />
            <el-icon v-else aria-hidden="true"><Shop /></el-icon>
          </span>
          <span class="favorite-copy">
            <strong>{{ item.club.name }}</strong>
            <span>{{ item.club.description || '这个社团还没有填写简介。' }}</span>
          </span>
        </button>
        <div class="favorite-meta">
          <span><el-icon><User /></el-icon>{{ item.favorite_count }} 人收藏</span>
          <time :datetime="item.favorited_at">收藏于 {{ formatDate(item.favorited_at) }}</time>
        </div>
        <el-button text type="danger" class="remove-button" :loading="removingId === item.club.id" @click="removeFavorite(item.club.id)">
          <el-icon><StarFilled /></el-icon><span>取消收藏</span>
        </el-button>
      </article>
    </div>

    <el-empty v-if="!loading && items.length === 0" description="还没有收藏社团">
      <el-button type="primary" @click="goDirectory"><el-icon><Shop /></el-icon>去浏览社团</el-button>
    </el-empty>
    <el-pagination
      v-if="total > pageSize"
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="prev, pager, next"
      @current-change="load"
    />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Shop, StarFilled, User } from '@element-plus/icons-vue'
import { getMyFavoriteClubs, unfavoriteClub } from '@/api/clubs'
import type { ClubFavoriteItem } from '@/api/types'

const router = useRouter()
const items = ref<ClubFavoriteItem[]>([])
const loading = ref(false)
const removingId = ref<number | null>(null)
const page = ref(1)
const pageSize = 10
const total = ref(0)

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN')
}

async function load() {
  loading.value = true
  try {
    const result = await getMyFavoriteClubs({ page: page.value, page_size: pageSize })
    items.value = result.results
    total.value = result.count
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || error?.message || '收藏社团加载失败')
  } finally {
    loading.value = false
  }
}

async function removeFavorite(id: number) {
  removingId.value = id
  try {
    await unfavoriteClub(id)
    const shouldLoadPreviousPage = items.value.length === 1 && page.value > 1
    items.value = items.value.filter(item => item.club.id !== id)
    total.value = Math.max(0, total.value - 1)
    if (shouldLoadPreviousPage) {
      page.value -= 1
      await load()
    }
    ElMessage.success('已取消收藏')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || error?.message || '取消收藏失败')
  } finally {
    removingId.value = null
  }
}

function openClub(id: number) { void router.push({ name: 'ClubDetail', params: { id } }) }
function goDirectory() { void router.push({ name: 'ClubDirectory' }) }

onMounted(load)
</script>

<style scoped>
.clubs-page { padding: 24px; border: 1px solid var(--border-color); border-radius: var(--card-radius); background: var(--bg-white); box-shadow: var(--shadow-sm); }
.clubs-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-md); padding-bottom: 18px; border-bottom: 1px solid var(--secondary-gray-dark); }
.section-eyebrow { margin: 0 0 5px; color: var(--primary-gold-dark); font-size: var(--font-small); font-weight: 700; letter-spacing: 0.08em; }
.clubs-heading h2 { margin: 0; font-size: var(--font-title-lg); }
.clubs-heading p:last-child { margin: 7px 0 0; color: var(--text-light); font-size: var(--font-caption); }
.directory-link { flex: none; color: var(--accent-purple-dark); }
.favorite-list { display: grid; gap: 10px; margin-top: 18px; }
.favorite-item { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 18px; padding: 14px; border: 1px solid var(--secondary-gray-dark); border-radius: var(--card-radius-sm); background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(245,245,247,.78)); transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast); }
.favorite-item:hover { border-color: rgba(212, 175, 55, .55); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
.favorite-identity { display: flex; min-width: 0; align-items: center; gap: 12px; padding: 0; color: inherit; text-align: left; background: transparent; border: 0; cursor: pointer; }
.favorite-avatar { display: grid; flex: none; width: 52px; height: 52px; place-items: center; overflow: hidden; border: 1px solid rgba(212,175,55,.26); border-radius: 14px; background: var(--secondary-gray); color: var(--accent-purple-dark); }
.favorite-avatar .el-image, .favorite-avatar :deep(.el-image__inner) { width: 100%; height: 100%; }
.favorite-copy { display: grid; min-width: 0; gap: 5px; }
.favorite-copy strong { overflow: hidden; color: var(--text-dark); text-overflow: ellipsis; white-space: nowrap; }
.favorite-copy span { overflow: hidden; color: var(--text-light); font-size: var(--font-caption); text-overflow: ellipsis; white-space: nowrap; }
.favorite-meta { display: grid; min-width: 132px; gap: 4px; color: var(--text-light); font-size: var(--font-small); text-align: right; }
.favorite-meta span { display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px; color: var(--primary-gold-dark); }
.remove-button { flex: none; margin: 0; }
.clubs-page :deep(.el-pagination) { justify-content: center; margin-top: 20px; }

@media (max-width: 768px) {
  .clubs-page { padding: 18px 16px; }
  .favorite-item { grid-template-columns: minmax(0, 1fr) auto; gap: 12px; }
  .favorite-meta { grid-column: 1; min-width: 0; text-align: left; }
  .favorite-meta span { justify-content: flex-start; }
  .remove-button { grid-column: 2; grid-row: 1 / span 2; }
}

@media (max-width: 480px) {
  .clubs-heading { display: grid; }
  .directory-link { justify-self: start; }
  .favorite-item { align-items: start; }
  .favorite-avatar { width: 46px; height: 46px; }
  .favorite-copy span { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .remove-button span { display: none; }
}
</style>
