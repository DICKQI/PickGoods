<template>
  <section class="popularity-page">
    <header class="section-title">
      <div><p class="section-eyebrow">AUDIENCE SIGNALS</p><h2>人气统计</h2></div>
      <el-button text @click="load"><el-icon><Refresh /></el-icon>刷新</el-button>
    </header>
    <div class="kpi-grid" aria-label="人气摘要">
      <div class="kpi-card"><span>目录条目</span><strong>{{ summary.total }}</strong></div>
      <div class="kpi-card"><span>已上架</span><strong>{{ summary.listed }}</strong></div>
      <div class="kpi-card kpi-card--warm"><span>意向入手</span><strong>{{ summary.intended_user_count }}</strong></div>
      <div class="kpi-card kpi-card--green"><span>已入手</span><strong>{{ summary.acquired_user_count }}</strong></div>
    </div>
    <div class="analytics-toolbar">
      <el-input v-model="search" clearable placeholder="搜索谷子、IP 或品类" @keyup.enter="load" />
      <label>状态<select v-model="statusFilter" aria-label="统计状态筛选" @change="load"><option value="">全部</option><option value="listed">已上架</option><option value="draft">草稿</option><option value="unlisted">已下架</option></select></label>
      <label>排序<select v-model="sort" aria-label="人气排序" @change="load"><option value="order">公开顺序</option><option value="intended">意向入手</option><option value="acquired">已入手</option><option value="name">名称</option></select></label>
    </div>
    <div v-loading="loading" class="popularity-table">
      <el-table :data="items" stripe>
        <el-table-column prop="goods_name" label="谷子" min-width="220" />
        <el-table-column prop="publication_status" label="状态" width="110" align="center"><template #default="{ row }"><el-tag size="small" :type="statusType(row.publication_status)">{{ statusLabel(row.publication_status) }}</el-tag></template></el-table-column>
        <el-table-column prop="intended_user_count" label="意向入手" width="130" align="center"><template #default="{ row }"><el-tag class="stat-badge stat-badge--intended" size="small" effect="plain" type="warning">{{ row.intended_user_count }} 人</el-tag></template></el-table-column>
        <el-table-column prop="acquired_user_count" label="已入手" width="130" align="center"><template #default="{ row }"><el-tag class="stat-badge stat-badge--acquired" size="small" effect="plain" type="success">{{ row.acquired_user_count }} 人</el-tag></template></el-table-column>
      </el-table>
    </div>
    <div class="popularity-cards">
      <article v-for="item in items" :key="item.goods_id">
        <div class="card-heading"><h3 :title="item.goods_name">{{ item.goods_name }}</h3><el-tag size="small" :type="statusType(item.publication_status)">{{ statusLabel(item.publication_status) }}</el-tag></div>
        <div><el-tag class="stat-badge stat-badge--intended" size="small" effect="plain" type="warning">意向入手 {{ item.intended_user_count }} 人</el-tag><el-tag class="stat-badge stat-badge--acquired" size="small" effect="plain" type="success">已入手 {{ item.acquired_user_count }} 人</el-tag></div>
      </article>
    </div>
    <el-empty v-if="!loading && !items.length" description="暂无符合条件的人气数据" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getMyClubPopularity } from '@/api/clubs'
import type { ClubPopularityItem, ClubPopularitySummary, ClubPublicationStatus } from '@/api/types'

const items = ref<ClubPopularityItem[]>([])
const loading = ref(false)
const search = ref('')
const statusFilter = ref('')
const sort = ref('order')
const summary = reactive<ClubPopularitySummary>({ total: 0, listed: 0, draft: 0, unlisted: 0, intended_user_count: 0, acquired_user_count: 0 })
const labels: Record<ClubPublicationStatus, string> = { draft: '草稿', listed: '已上架', unlisted: '已下架' }
const statusLabel = (status?: ClubPublicationStatus) => status ? labels[status] : '未知'
const statusType = (status?: ClubPublicationStatus) => ({ draft: 'info', listed: 'success', unlisted: 'warning' }[status || 'draft'] as 'info' | 'success' | 'warning')
function fallbackSummary(rows: ClubPopularityItem[]): ClubPopularitySummary { return { total: rows.length, listed: rows.filter(item => item.publication_status === 'listed').length, draft: rows.filter(item => item.publication_status === 'draft').length, unlisted: rows.filter(item => item.publication_status === 'unlisted').length, intended_user_count: rows.reduce((total, item) => total + item.intended_user_count, 0), acquired_user_count: rows.reduce((total, item) => total + item.acquired_user_count, 0) } }
async function load() { loading.value = true; try { const response = await getMyClubPopularity({ search: search.value || undefined, status: statusFilter.value || undefined, sort: sort.value }); const payload = Array.isArray(response) ? { items: response, summary: fallbackSummary(response) } : response; items.value = payload.items; Object.assign(summary, payload.summary) } catch (error: any) { ElMessage.error(error?.message || '加载统计失败') } finally { loading.value = false } }
onMounted(load)
</script>

<style scoped>
.popularity-page { padding: 22px; border: 1px solid var(--border-color); border-radius: 14px; background: var(--bg-white); box-shadow: var(--shadow-sm); }.section-title { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }.section-eyebrow { margin: 0 0 4px; color: var(--primary-gold-dark); font-size: var(--font-small); font-weight: 700; letter-spacing: .08em; }.section-title h2 { margin: 0; font-size: var(--font-title-lg); }.section-title p:last-child { margin: 6px 0 0; color: var(--text-light); font-size: var(--font-caption); }.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 18px; }.kpi-card { display: grid; gap: 4px; padding: 12px 14px; border: 1px solid var(--secondary-gray-dark); border-radius: 10px; }.kpi-card span { color: var(--text-light); font-size: var(--font-caption); }.kpi-card strong { color: var(--text-dark); font-size: 22px; }.kpi-card--warm { border-color: rgba(230,162,60,.35); background: rgba(255,249,235,.7); }.kpi-card--green { border-color: rgba(103,194,58,.3); background: rgba(240,249,235,.7); }.analytics-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }.analytics-toolbar > .el-input { flex: 1 1 260px; max-width: 460px; }.analytics-toolbar label { display: inline-flex; align-items: center; gap: 6px; color: var(--text-light); font-size: var(--font-caption); }.analytics-toolbar select { height: 32px; padding: 0 22px 0 8px; border: 1px solid var(--secondary-gray-dark); border-radius: 8px; color: var(--text-regular); background: #fff; }.stat-badge { margin: 0; font-weight: 500; }.stat-badge--intended { color: var(--el-color-warning-dark-2); }.stat-badge--acquired { color: var(--el-color-success-dark-2); }.popularity-cards { display: none; }
@media (max-width: 768px) { .popularity-page { padding: 16px; border-radius: 12px; }.section-title { align-items: stretch; }.kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.kpi-card strong { font-size: 20px; }.analytics-toolbar { align-items: stretch; }.analytics-toolbar > .el-input { max-width: none; flex-basis: 100%; }.analytics-toolbar label { flex: 1; justify-content: space-between; }.analytics-toolbar select { flex: 1; }.popularity-table { display: none; }.popularity-cards { display: grid; gap: 8px; }.popularity-cards article { padding: 13px; border: 1px solid var(--secondary-gray-dark); border-radius: 10px; }.card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px; }.popularity-cards h3 { min-width: 0; margin: 0; overflow: hidden; color: var(--text-dark); font-size: var(--font-body); line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }.popularity-cards article > div:last-child { display: flex; flex-wrap: wrap; gap: 6px; } }
</style>
