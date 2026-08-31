<template>
  <section class="goods-page">
    <div class="section-title">
      <div>
        <h2>社团谷子</h2>
        <p>管理公开目录，草稿和下架条目不会出现在公开主页。</p>
      </div>
      <el-button type="primary" @click="router.push('/club/goods/new')">
        <el-icon><Plus /></el-icon>
        新增谷子
      </el-button>
    </div>

    <div class="toolbar">
      <div class="toolbar-search">
        <el-input v-model="search" clearable placeholder="搜索谷子" @keyup.enter="handleSearch" />
        <el-button aria-label="搜索社团谷子" @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
      </div>
      <div v-if="!bulkAction" class="bulk-actions">
        <el-button
          class="bulk-action-button bulk-action-button--delete"
          plain
          data-test="start-batch-delete"
          aria-label="批量删除社团谷子"
          @click="startBulkAction('delete')"
        >
          <el-icon><Delete /></el-icon>
          批量删除
        </el-button>
        <el-button
          class="bulk-action-button bulk-action-button--unlist"
          plain
          data-test="start-batch-unlist"
          aria-label="批量下架社团谷子"
          @click="startBulkAction('unlist')"
        >
          <el-icon><Download /></el-icon>
          批量下架
        </el-button>
      </div>
      <div v-else class="bulk-actions bulk-actions--selection">
        <span class="bulk-summary">批量{{ bulkActionLabel }} · 已选 {{ selectedGoodsIds.length }} 条</span>
        <el-checkbox
          class="page-select-checkbox"
          data-test="select-current-page"
          :model-value="isPageFullySelected"
          :indeterminate="isPageIndeterminate"
          :disabled="!currentPageEligibleIds.length || bulkLoading"
          aria-label="选择本页可操作谷子"
          @change="togglePageSelection"
        >
          选择本页
        </el-checkbox>
        <el-button text :disabled="bulkLoading" data-test="cancel-bulk-action" @click="cancelBulkAction">取消</el-button>
        <el-button
          :type="bulkAction === 'delete' ? 'danger' : 'warning'"
          :loading="bulkLoading"
          :disabled="!selectedGoodsIds.length"
          data-test="confirm-bulk-action"
          :aria-label="`确认批量${bulkActionLabel}`"
          @click="executeBulkAction"
        >
          <el-icon><Check /></el-icon>
          {{ bulkActionLabel }}
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="goods-list">
      <article v-for="item in goods" :key="item.id" class="goods-row">
        <div v-if="bulkAction" class="selection-cell">
          <el-checkbox
            :model-value="isSelected(item.id)"
            :disabled="!isSelectable(item) || bulkLoading"
            :aria-label="`选择${item.name}`"
            :title="selectionHint(item)"
            @change="toggleItemSelection(item, $event)"
          />
        </div>
        <el-image v-if="item.main_photo" :src="item.main_photo" fit="cover" class="thumb" />
        <div v-else class="thumb placeholder"><el-icon><Picture /></el-icon></div>
        <div class="goods-row__body">
          <h3>{{ item.name }}</h3>
          <p>{{ item.ip?.name }} · {{ item.category?.name }}</p>
          <div><el-tag size="small" :type="statusType(item.publication_status)">{{ statusLabel(item.publication_status) }}</el-tag></div>
          <div class="popularity-meta" aria-label="谷子人气统计">
            <el-tag class="popularity-badge popularity-badge--intended" size="small" effect="plain" type="warning">
              意向入手 {{ popularityByGoodsId[item.id]?.intended_user_count ?? 0 }} 人
            </el-tag>
            <el-tag class="popularity-badge popularity-badge--acquired" size="small" effect="plain" type="success">
              已入手 {{ popularityByGoodsId[item.id]?.acquired_user_count ?? 0 }} 人
            </el-tag>
          </div>
        </div>
        <div class="row-actions">
          <el-button link type="primary" :disabled="bulkLoading" @click="router.push(`/club/goods/${item.id}/edit`)">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-button
            v-if="item.publication_status !== 'draft'"
            link
            :disabled="bulkLoading"
            :type="item.publication_status === 'listed' ? 'warning' : 'success'"
            @click="togglePublished(item)"
          >
            {{ item.publication_status === 'listed' ? '下架' : '上架' }}
          </el-button>
        </div>
      </article>
    </div>
    <el-empty v-if="!loading && !goods.length" description="还没有谷子" />
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Delete, Download, Edit, Picture, Plus, Search } from '@element-plus/icons-vue'
import {
  batchDeleteClubGoods,
  batchUnlistClubGoods,
  getMyClubGoods,
  getMyClubPopularity,
  updateClubGoods,
} from '@/api/clubs'
import type { ClubCatalogItem, ClubPopularityItem, ClubPublicationStatus } from '@/api/types'

type BulkAction = 'delete' | 'unlist'

const router = useRouter()
const goods = ref<ClubCatalogItem[]>([])
const popularityByGoodsId = ref<Record<string, ClubPopularityItem>>({})
const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const bulkAction = ref<BulkAction | null>(null)
const selectedGoodsIds = ref<string[]>([])
const bulkLoading = ref(false)
const labels: Record<ClubPublicationStatus, string> = { draft: '草稿', listed: '已上架', unlisted: '已下架' }
const statusLabel = (status: ClubPublicationStatus) => labels[status]
const statusType = (status: ClubPublicationStatus) => ({ draft: 'info', listed: 'success', unlisted: 'warning' }[status] as 'info' | 'success' | 'warning')
const bulkActionLabel = computed(() => bulkAction.value === 'delete' ? '删除' : '下架')
const currentPageEligibleIds = computed(() => goods.value.filter(item => isSelectable(item)).map(item => item.id))
const isPageFullySelected = computed(() => currentPageEligibleIds.value.length > 0 && currentPageEligibleIds.value.every(id => selectedGoodsIds.value.includes(id)))
const isPageIndeterminate = computed(() => {
  const selectedOnPage = currentPageEligibleIds.value.filter(id => selectedGoodsIds.value.includes(id)).length
  return selectedOnPage > 0 && selectedOnPage < currentPageEligibleIds.value.length
})

function isSelectable(item: ClubCatalogItem, action = bulkAction.value): boolean {
  if (action === 'delete') return item.publication_status === 'draft' || item.publication_status === 'unlisted'
  if (action === 'unlist') return item.publication_status === 'listed'
  return false
}

function selectionHint(item: ClubCatalogItem): string {
  if (isSelectable(item)) return ''
  return bulkAction.value === 'delete' ? '已上架谷子请先下架' : '批量下架仅支持已上架谷子'
}

function reconcileSelection(items: ClubCatalogItem[]) {
  if (!bulkAction.value) return
  const currentItems = new Map(items.map(item => [item.id, item]))
  selectedGoodsIds.value = selectedGoodsIds.value.filter(id => {
    const item = currentItems.get(id)
    return !item || isSelectable(item)
  })
}

async function load(options: { preserveSelection?: boolean } = {}) {
  loading.value = true
  try {
    const [result, popularity] = await Promise.all([
      getMyClubGoods({ page: page.value, page_size: pageSize, search: search.value || undefined }),
      getMyClubPopularity(),
    ])
    goods.value = result.results
    total.value = result.count
    popularityByGoodsId.value = Object.fromEntries(popularity.map(item => [item.goods_id, item]))
    if (!options.preserveSelection) reconcileSelection(result.results)
  } finally { loading.value = false }
}

function handleSearch() { page.value = 1; void load() }
function startBulkAction(action: BulkAction) {
  bulkAction.value = action
  selectedGoodsIds.value = []
}
function cancelBulkAction() {
  bulkAction.value = null
  selectedGoodsIds.value = []
}
function isSelected(id: string) { return selectedGoodsIds.value.includes(id) }
function toggleSelection(item: ClubCatalogItem, selected: boolean) {
  if (!isSelectable(item)) return
  const ids = new Set(selectedGoodsIds.value)
  if (selected) ids.add(item.id)
  else ids.delete(item.id)
  selectedGoodsIds.value = [...ids]
}
function toggleItemSelection(item: ClubCatalogItem, value: unknown) {
  toggleSelection(item, Boolean(value))
}
function togglePageSelection(value: unknown) {
  const ids = new Set(selectedGoodsIds.value)
  if (Boolean(value)) currentPageEligibleIds.value.forEach(id => ids.add(id))
  else currentPageEligibleIds.value.forEach(id => ids.delete(id))
  selectedGoodsIds.value = [...ids]
}

function getBulkErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { detail?: unknown; goods_ids?: unknown } } })?.response?.data
  if (typeof data?.detail === 'string' && data.detail) return data.detail
  if (Array.isArray(data?.goods_ids)) {
    const message = data.goods_ids.filter((item): item is string => typeof item === 'string').join('、')
    if (message) return message
  }
  if (error instanceof Error && error.message) return error.message
  return '批量操作失败，请刷新后重试'
}

async function reloadAfterBulk() {
  await load()
  const maxPage = Math.max(1, Math.ceil(total.value / pageSize))
  if (page.value > maxPage) {
    page.value = maxPage
    await load()
  }
}

async function executeBulkAction() {
  const action = bulkAction.value
  const ids = [...selectedGoodsIds.value]
  if (!action || !ids.length || bulkLoading.value) return

  try {
    const message = action === 'delete'
      ? `确定删除选中的 ${ids.length} 条社团谷子吗？仅草稿和已下架条目可删除，已导入个人谷仓的快照不会被删除。`
      : `确定下架选中的 ${ids.length} 条社团谷子吗？下架后将从公开目录隐藏，谷子资料和个人谷仓快照不会被删除。`
    await ElMessageBox.confirm(message, action === 'delete' ? '批量删除' : '批量下架', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: action === 'delete' ? 'warning' : 'info',
    })
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(getBulkErrorMessage(error))
    return
  }

  bulkLoading.value = true
  try {
    let processedIds: string[]
    let successMessage: string
    if (action === 'delete') {
      const result = await batchDeleteClubGoods(ids)
      processedIds = result.deleted_ids
      successMessage = `已删除 ${result.deleted_count} 条谷子`
    } else {
      const result = await batchUnlistClubGoods(ids)
      processedIds = result.updated_ids
      successMessage = `已下架 ${result.updated_count} 条谷子`
    }
    selectedGoodsIds.value = selectedGoodsIds.value.filter(id => !processedIds.includes(id))
    ElMessage.success(successMessage)
    try {
      await reloadAfterBulk()
    } catch {
      ElMessage.warning('操作已完成，但列表刷新失败，请手动刷新页面')
    }
  } catch (error: unknown) {
    ElMessage.error(getBulkErrorMessage(error))
    try { await load({ preserveSelection: true }) } catch { /* 保留原错误提示和选择 */ }
  } finally {
    bulkLoading.value = false
  }
}

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
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.toolbar-search { display: flex; gap: 8px; flex: 1 1 320px; min-width: 280px; max-width: 520px; }
.toolbar-search .el-input { min-width: 0; flex: 1; }
.bulk-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bulk-actions--selection { margin-left: auto; }
.bulk-action-button { margin-left: 0 !important; }
.bulk-action-button--delete { color: var(--el-color-danger); border-color: rgba(245, 108, 108, 0.45); }
.bulk-action-button--unlist { color: var(--el-color-warning); border-color: rgba(230, 162, 60, 0.45); }
.bulk-summary { color: var(--text-regular); font-size: var(--font-caption); white-space: nowrap; }
.page-select-checkbox { margin-right: 4px; }
.goods-list { display: grid; gap: 8px; min-height: 100px; }
.goods-row { display: flex; align-items: center; gap: 14px; padding: 10px; border: 1px solid var(--secondary-gray-dark); border-radius: var(--card-radius-sm); }
.selection-cell { flex: 0 0 28px; display: grid; place-items: center; }
.thumb { flex: 0 0 68px; width: 68px; height: 68px; border-radius: 8px; background: var(--secondary-gray); }
.thumb.placeholder { display: grid; place-items: center; color: var(--text-light); }
.goods-row__body { min-width: 0; flex: 1; }
.goods-row h3 { margin: 0 0 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-body); }
.goods-row p { margin: 0 0 7px; color: var(--text-light); font-size: var(--font-small); }
.goods-row .popularity-meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 0; }
.popularity-badge { margin: 0; font-weight: 500; }
.popularity-badge--intended { color: var(--el-color-warning-dark-2); }
.popularity-badge--acquired { color: var(--el-color-success-dark-2); }
.row-actions { display: flex; align-items: center; gap: 4px; }
.goods-page :deep(.el-pagination) { justify-content: center; margin-top: 20px; }
@media (max-width: 768px) {
  .goods-page { padding: 16px; }
  .section-title { align-items: stretch; flex-direction: column; }
  .section-title .el-button { align-self: flex-start; }
  .toolbar-search { flex-basis: 100%; max-width: none; }
  .bulk-actions--selection { margin-left: 0; width: 100%; }
  .bulk-summary { flex: 1 1 100%; }
  .goods-row { align-items: flex-start; }
  .selection-cell { padding-top: 5px; }
  .row-actions { flex-direction: column; align-items: flex-end; }
}
</style>
