<template>
  <section class="goods-page">
    <div class="section-title">
      <div><h2>社团谷子</h2><p>管理公开目录，草稿和下架条目不会出现在公开主页。</p></div>
      <el-button type="primary" @click="router.push('/club/goods/new')"><el-icon><Plus /></el-icon>新增谷子</el-button>
    </div>
    <div class="toolbar"><el-input v-model="search" clearable placeholder="搜索谷子" @keyup.enter="handleSearch" /><el-button @click="handleSearch"><el-icon><Search /></el-icon>搜索</el-button></div>
    <div v-loading="loading" class="goods-list">
      <article v-for="item in goods" :key="item.id" class="goods-row">
        <el-image v-if="item.main_photo" :src="item.main_photo" fit="cover" class="thumb" /><div v-else class="thumb placeholder"><el-icon><Picture /></el-icon></div>
        <div class="goods-row__body"><h3>{{ item.name }}</h3><p>{{ item.ip?.name }} · {{ item.category?.name }}</p><div><el-tag size="small" :type="statusType(item.publication_status)">{{ statusLabel(item.publication_status) }}</el-tag></div><p class="popularity-meta"><span>意向入手 {{ popularityByGoodsId[item.id]?.intended_user_count ?? 0 }} 人</span><span>曾经入手 {{ popularityByGoodsId[item.id]?.acquired_user_count ?? 0 }} 人</span></p></div>
        <div class="row-actions"><el-button link type="primary" @click="router.push(`/club/goods/${item.id}/edit`)"><el-icon><Edit /></el-icon>编辑</el-button><el-button v-if="item.publication_status !== 'draft'" link :type="item.publication_status === 'listed' ? 'warning' : 'success'" @click="togglePublished(item)">{{ item.publication_status === 'listed' ? '下架' : '上架' }}</el-button></div>
      </article>
    </div>
    <el-empty v-if="!loading && !goods.length" description="还没有谷子" />
    <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="load" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Edit, Picture, Plus, Search } from '@element-plus/icons-vue'
import { getMyClubGoods, getMyClubPopularity, updateClubGoods } from '@/api/clubs'
import type { ClubCatalogItem, ClubPopularityItem, ClubPublicationStatus } from '@/api/types'

const router = useRouter()
const goods = ref<ClubCatalogItem[]>([])
const popularityByGoodsId = ref<Record<string, ClubPopularityItem>>({})
const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const labels: Record<ClubPublicationStatus, string> = { draft: '草稿', listed: '已上架', unlisted: '已下架' }
const statusLabel = (status: ClubPublicationStatus) => labels[status]
const statusType = (status: ClubPublicationStatus) => ({ draft: 'info', listed: 'success', unlisted: 'warning' }[status] as 'info' | 'success' | 'warning')

async function load() {
  loading.value = true
  try {
    const [result, popularity] = await Promise.all([
      getMyClubGoods({ page: page.value, page_size: pageSize, search: search.value || undefined }),
      getMyClubPopularity(),
    ])
    goods.value = result.results
    total.value = result.count
    popularityByGoodsId.value = Object.fromEntries(popularity.map(item => [item.goods_id, item]))
  } finally { loading.value = false }
}

function handleSearch() { page.value = 1; void load() }
async function togglePublished(item: ClubCatalogItem) {
  try {
    const publication_status = item.publication_status === 'listed' ? 'unlisted' : 'listed'
    const updated = await updateClubGoods(item.id, { publication_status })
    Object.assign(item, updated)
    ElMessage.success(publication_status === 'listed' ? '已上架' : '已下架')
  } catch {}
}

onMounted(load)
</script>

<style scoped>
.goods-page { padding: 20px; border: 1px solid var(--border-color); border-radius: var(--card-radius); background: var(--bg-white); }
.section-title { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; }
.section-title h2 { margin: 0; font-size: var(--font-section); }
.section-title p { margin: 6px 0 0; color: var(--text-light); font-size: var(--font-caption); }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.toolbar .el-input { max-width: 320px; }
.goods-list { display: grid; gap: 8px; min-height: 100px; }
.goods-row { display: flex; align-items: center; gap: 14px; padding: 10px; border: 1px solid var(--secondary-gray-dark); border-radius: var(--card-radius-sm); }
.thumb { flex: 0 0 68px; width: 68px; height: 68px; border-radius: 8px; background: var(--secondary-gray); }
.thumb.placeholder { display: grid; place-items: center; color: var(--text-light); }
.goods-row__body { min-width: 0; flex: 1; }
.goods-row h3 { margin: 0 0 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-body); }
.goods-row p { margin: 0 0 7px; color: var(--text-light); font-size: var(--font-small); }
.goods-row .popularity-meta { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0 0; color: var(--accent-purple-dark); }
.row-actions { display: flex; align-items: center; gap: 4px; }
.goods-page :deep(.el-pagination) { justify-content: center; margin-top: 20px; }
@media (max-width: 768px) { .goods-page { padding: 16px; } .section-title { align-items: stretch; flex-direction: column; } .section-title .el-button { align-self: flex-start; } .toolbar .el-input { max-width: none; flex: 1; } .goods-row { align-items: flex-start; } .row-actions { flex-direction: column; align-items: flex-end; } }
</style>
