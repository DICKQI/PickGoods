<template>
  <section class="popularity-page"><div class="section-title"><div><h2>人气统计</h2><p>按去重用户统计意向入手和曾经入手人数。</p></div><el-button text @click="load"><el-icon><Refresh /></el-icon>刷新</el-button></div><div v-loading="loading" class="popularity-table"><el-table :data="items" stripe><el-table-column prop="goods_name" label="谷子" min-width="220" /><el-table-column prop="intended_user_count" label="意向入手" width="130" align="center"><template #default="{ row }"><strong class="intended">{{ row.intended_user_count }}</strong> 人</template></el-table-column><el-table-column prop="acquired_user_count" label="曾经入手" width="130" align="center"><template #default="{ row }"><strong class="acquired">{{ row.acquired_user_count }}</strong> 人</template></el-table-column></el-table></div><div class="popularity-cards"><article v-for="item in items" :key="item.goods_id"><h3>{{ item.goods_name }}</h3><div><span>意向入手 <strong class="intended">{{ item.intended_user_count }}</strong></span><span>曾经入手 <strong class="acquired">{{ item.acquired_user_count }}</strong></span></div></article></div><el-empty v-if="!loading && !items.length" description="暂无人气数据" /></section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getMyClubPopularity } from '@/api/clubs'
import type { ClubPopularityItem } from '@/api/types'
const items = ref<ClubPopularityItem[]>([]); const loading = ref(false)
async function load() { loading.value = true; try { items.value = await getMyClubPopularity() } catch (error: any) { ElMessage.error(error?.message || '加载统计失败') } finally { loading.value = false } }
onMounted(load)
</script>
<style scoped>
.popularity-page { padding: 20px; border: 1px solid var(--border-color); border-radius: var(--card-radius); background: var(--bg-white); }.section-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }.section-title h2 { margin: 0; font-size: var(--font-section); }.section-title p { margin: 6px 0 0; color: var(--text-light); font-size: var(--font-caption); }.intended { color: var(--primary-gold-dark); }.acquired { color: var(--accent-purple-dark); }.popularity-cards { display: none; }
@media (max-width: 768px) { .popularity-page { padding: 16px; }.popularity-table { display: none; }.popularity-cards { display: grid; gap: 10px; }.popularity-cards article { padding: 14px; border: 1px solid var(--secondary-gray-dark); border-radius: var(--card-radius-sm); }.popularity-cards h3 { margin: 0 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-body); }.popularity-cards article div { display: flex; justify-content: space-between; color: var(--text-light); font-size: var(--font-caption); } }
</style>
