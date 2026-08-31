<template>
  <section class="goods-page">
    <header class="section-title">
      <div>
        <p class="section-eyebrow">CATALOG OPERATIONS</p>
        <h2>社团谷子</h2>
        <p>管理公开目录，草稿和下架条目不会出现在公开主页。</p>
      </div>
      <el-button type="primary" class="primary-action" @click="router.push('/club/goods/new')">
        <el-icon><Plus /></el-icon>新增谷子
      </el-button>
    </header>

    <div class="catalog-summary" aria-label="目录摘要">
      <button v-for="item in summaryCards" :key="item.key" type="button" :class="['summary-card', { active: statusFilter === item.key }]" @click="setStatus(item.key)">
        <span>{{ item.label }}</span><strong>{{ item.value }}</strong>
      </button>
    </div>

    <div class="toolbar">
      <div class="toolbar-search">
        <el-input
          v-model="search"
          clearable
          class="search-input"
          placeholder="搜索谷子、IP 或品类"
          @input="scheduleSearch"
          @keyup.enter="handleSearchImmediately"
          @clear="handleSearchImmediately"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>
      <label class="filter-control"><span>状态</span>
        <el-select v-model="statusFilter" class="toolbar-select toolbar-select--status" popper-class="catalog-filter-popper" aria-label="发布状态筛选" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="已上架" value="listed" />
          <el-option label="草稿" value="draft" />
          <el-option label="已下架" value="unlisted" />
        </el-select>
      </label>
      <label class="filter-control"><span>排序</span>
        <el-select v-model="sort" class="toolbar-select toolbar-select--sort" popper-class="catalog-filter-popper" aria-label="目录排序" @change="handleSearch">
          <el-option label="公开顺序" value="order" />
          <el-option label="名称" value="name" />
          <el-option label="最近更新" value="created" />
        </el-select>
      </label>
      <div v-if="!bulkAction" class="bulk-actions">
        <el-button class="bulk-action-button bulk-action-button--delete" plain data-test="start-batch-delete" aria-label="批量删除社团谷子" @click="startBulkAction('delete')"><el-icon><Delete /></el-icon>批量删除</el-button>
        <el-button class="bulk-action-button bulk-action-button--unlist" plain data-test="start-batch-unlist" aria-label="批量下架社团谷子" @click="startBulkAction('unlist')"><el-icon><Download /></el-icon>批量下架</el-button>
      </div>
      <div v-else class="bulk-actions bulk-actions--selection">
        <span class="bulk-summary">批量{{ bulkActionLabel }} · 已选 {{ selectedGoodsIds.length }} 条</span>
        <el-checkbox class="page-select-checkbox" data-test="select-current-page" :model-value="isPageFullySelected" :indeterminate="isPageIndeterminate" :disabled="!currentPageEligibleIds.length || bulkLoading" aria-label="选择本页可操作谷子" @change="togglePageSelection">选择本页</el-checkbox>
        <el-button text :disabled="bulkLoading" data-test="cancel-bulk-action" @click="cancelBulkAction">取消</el-button>
        <el-button :type="bulkAction === 'delete' ? 'danger' : 'warning'" :loading="bulkLoading" :disabled="!selectedGoodsIds.length" data-test="confirm-bulk-action" :aria-label="`确认批量${bulkActionLabel}`" @click="executeBulkAction"><el-icon><Check /></el-icon>{{ bulkActionLabel }}</el-button>
      </div>
    </div>
    <p v-if="!canReorder && !bulkAction" class="sort-hint">筛选或搜索状态下暂不支持拖拽排序，请切回“全部 / 公开顺序”。</p>

    <div v-loading="loading" class="goods-list">
      <div v-if="goods.length" :class="['goods-list-header', { 'has-selection': bulkAction }]" aria-hidden="true" data-test="catalog-column-header">
        <span v-if="bulkAction" class="goods-list-header__selection"></span>
        <span class="goods-list-header__thumbnail"></span>
        <span>谷子</span>
        <span>价格与状态</span>
        <span>人气</span>
        <span class="goods-list-header__actions">操作</span>
      </div>
      <article
        v-for="item in goods"
        :key="item.id"
        :class="['goods-row', {
          'has-selection': bulkAction,
          'is-selectable': bulkAction && isSelectable(item) && !bulkLoading,
          'is-selected': bulkAction && isSelected(item.id),
          'is-selection-disabled': bulkAction && (!isSelectable(item) || bulkLoading),
        }]"
        :draggable="canReorder"
        :tabindex="bulkAction && isSelectable(item) && !bulkLoading ? 0 : undefined"
        :aria-label="bulkAction ? `${isSelected(item.id) ? '取消选择' : '选择'}${item.name}` : undefined"
        @click="handleRowSelectionClick(item, $event)"
        @keydown.enter.prevent="handleRowSelectionKey(item, $event)"
        @keydown.space.prevent="handleRowSelectionKey(item, $event)"
        @dragstart="startDrag(item.id, $event)"
        @dragover.prevent
        @drop="dropDrag(item.id)"
      >
        <div v-if="bulkAction" class="selection-cell"><el-checkbox :model-value="isSelected(item.id)" :disabled="!isSelectable(item) || bulkLoading" :aria-label="`选择${item.name}`" :title="selectionHint(item)" @change="toggleItemSelection(item, $event)" /></div>
        <el-image v-if="item.main_photo && !erroredImages.has(item.id)" :src="item.main_photo" fit="cover" class="thumb" @error="markImageError(item.id)" />
        <div v-else class="thumb placeholder"><el-icon><Picture /></el-icon></div>
        <div class="goods-row__content">
          <div class="goods-row__identity">
            <div class="goods-heading"><h3 :title="item.name">{{ item.name }}</h3></div>
            <p>{{ item.ip?.name }} · {{ item.category?.name }}</p>
          </div>
          <div class="goods-row__publication">
            <span :class="['price', { 'price--empty': !item.public_price }]">{{ item.public_price ? `¥${item.public_price}` : '未设置价格' }}</span>
            <div class="status-line"><el-tag size="small" :type="statusType(item.publication_status)">{{ statusLabel(item.publication_status) }}</el-tag><span v-if="item.publish_at" class="schedule-note">计划 {{ formatDate(item.publish_at) }}</span><span v-if="item.publish_error" class="failure-note" :title="item.publish_error">上次上架失败</span></div>
          </div>
          <div class="popularity-meta" aria-label="谷子人气统计"><el-tag class="popularity-badge popularity-badge--intended" size="small" effect="plain" type="warning">意向入手 {{ popularityByGoodsId[item.id]?.intended_user_count ?? 0 }} 人</el-tag><el-tag class="popularity-badge popularity-badge--acquired" size="small" effect="plain" type="success">已入手 {{ popularityByGoodsId[item.id]?.acquired_user_count ?? 0 }} 人</el-tag></div>
        </div>
        <div class="row-actions">
          <el-button link type="primary" :disabled="bulkLoading" @click="router.push(`/club/goods/${item.id}/edit`)"><el-icon><Edit /></el-icon>编辑</el-button>
          <el-button v-if="item.publish_at" link type="warning" :disabled="bulkLoading" @click="cancelSchedule(item)">取消计划</el-button>
          <el-button v-if="item.publication_status !== 'draft'" link :disabled="bulkLoading" :type="item.publication_status === 'listed' ? 'warning' : 'success'" @click="togglePublished(item)">{{ item.publication_status === 'listed' ? '下架' : '上架' }}</el-button>
        </div>
      </article>
    </div>
    <el-empty v-if="!loading && !goods.length" description="还没有匹配的谷子" />
    <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="load" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Delete, Download, Edit, Picture, Plus, Search } from '@element-plus/icons-vue'
import { batchDeleteClubGoods, batchUnlistClubGoods, getMyClubGoods, getMyClubPopularity, reorderClubGoods, updateClubGoods } from '@/api/clubs'
import type { ClubCatalogItem, ClubCatalogSummary, ClubPopularityItem, ClubPublicationStatus } from '@/api/types'

type BulkAction = 'delete' | 'unlist'
const router = useRouter()
const goods = ref<ClubCatalogItem[]>([])
const popularityByGoodsId = ref<Record<string, ClubPopularityItem>>({})
const loading = ref(false)
const search = ref('')
const statusFilter = ref('')
const sort = ref('order')
const page = ref(1)
const pageSize = 50
const total = ref(0)
const summary = ref<ClubCatalogSummary>({ total: 0, listed: 0, draft: 0, unlisted: 0 })
const bulkAction = ref<BulkAction | null>(null)
const selectedGoodsIds = ref<string[]>([])
const bulkLoading = ref(false)
const draggedId = ref<string | null>(null)
const erroredImages = ref(new Set<string>())
let searchTimer: number | null = null
let loadRequestId = 0
const labels: Record<ClubPublicationStatus, string> = { draft: '草稿', listed: '已上架', unlisted: '已下架' }
const statusLabel = (status: ClubPublicationStatus) => labels[status]
const statusType = (status: ClubPublicationStatus) => ({ draft: 'info', listed: 'success', unlisted: 'warning' }[status] as 'info' | 'success' | 'warning')
const bulkActionLabel = computed(() => bulkAction.value === 'delete' ? '删除' : '下架')
const currentPageEligibleIds = computed(() => goods.value.filter(item => isSelectable(item)).map(item => item.id))
const isPageFullySelected = computed(() => currentPageEligibleIds.value.length > 0 && currentPageEligibleIds.value.every(id => selectedGoodsIds.value.includes(id)))
const isPageIndeterminate = computed(() => { const n = currentPageEligibleIds.value.filter(id => selectedGoodsIds.value.includes(id)).length; return n > 0 && n < currentPageEligibleIds.value.length })
const canReorder = computed(() => !search.value.trim() && !statusFilter.value && sort.value === 'order' && total.value <= pageSize && !bulkAction.value)
const summaryCards = computed(() => [{ key: '', label: '全部', value: summary.value.total }, { key: 'listed', label: '已上架', value: summary.value.listed }, { key: 'draft', label: '草稿', value: summary.value.draft }, { key: 'unlisted', label: '已下架', value: summary.value.unlisted }])

function isSelectable(item: ClubCatalogItem, action = bulkAction.value): boolean { if (action === 'delete') return item.publication_status === 'draft' || item.publication_status === 'unlisted'; if (action === 'unlist') return item.publication_status === 'listed'; return false }
function selectionHint(item: ClubCatalogItem): string { return isSelectable(item) ? '' : (bulkAction.value === 'delete' ? '已上架谷子请先下架' : '批量下架仅支持已上架谷子') }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function markImageError(id: string) { erroredImages.value = new Set(erroredImages.value).add(id) }
function reconcileSelection(items: ClubCatalogItem[]) { if (!bulkAction.value) return; const current = new Map(items.map(item => [item.id, item])); selectedGoodsIds.value = selectedGoodsIds.value.filter(id => !current.has(id) || isSelectable(current.get(id)!)) }
async function load(options: { preserveSelection?: boolean } = {}) {
  const requestId = ++loadRequestId
  loading.value = true
  try {
    const [result, popularityResult] = await Promise.all([getMyClubGoods({ page: page.value, page_size: pageSize, search: search.value || undefined, status: statusFilter.value || undefined, sort: sort.value }), getMyClubPopularity()])
    if (requestId !== loadRequestId) return
    goods.value = result.results
    total.value = result.count
    summary.value = result.summary || { total: result.count, listed: result.results.filter(item => item.publication_status === 'listed').length, draft: result.results.filter(item => item.publication_status === 'draft').length, unlisted: result.results.filter(item => item.publication_status === 'unlisted').length }
    const popularity = Array.isArray(popularityResult) ? popularityResult : popularityResult.items
    popularityByGoodsId.value = Object.fromEntries(popularity.map(item => [item.goods_id, item]))
    if (!options.preserveSelection) reconcileSelection(result.results)
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}
function clearSearchTimer() {
  if (searchTimer !== null) {
    window.clearTimeout(searchTimer)
    searchTimer = null
  }
}
function handleSearch() { clearSearchTimer(); page.value = 1; void load() }
function scheduleSearch() {
  clearSearchTimer()
  searchTimer = window.setTimeout(() => {
    searchTimer = null
    handleSearch()
  }, 350)
}
function handleSearchImmediately() {
  clearSearchTimer()
  handleSearch()
}
function setStatus(value: string) { statusFilter.value = value; handleSearch() }
function startBulkAction(action: BulkAction) { bulkAction.value = action; selectedGoodsIds.value = [] }
function cancelBulkAction() { bulkAction.value = null; selectedGoodsIds.value = [] }
function isSelected(id: string) { return selectedGoodsIds.value.includes(id) }
function toggleSelection(item: ClubCatalogItem, selected: boolean) { if (!isSelectable(item)) return; const ids = new Set(selectedGoodsIds.value); selected ? ids.add(item.id) : ids.delete(item.id); selectedGoodsIds.value = [...ids] }
function toggleItemSelection(item: ClubCatalogItem, value: unknown) { toggleSelection(item, Boolean(value)) }
function toggleRowSelection(item: ClubCatalogItem) { if (!bulkAction.value || bulkLoading.value || !isSelectable(item)) return; toggleSelection(item, !isSelected(item.id)) }
function handleRowSelectionClick(item: ClubCatalogItem, event: MouseEvent) {
  if (!bulkAction.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, label, select, textarea, [contenteditable="true"]')) return
  toggleRowSelection(item)
}
function handleRowSelectionKey(item: ClubCatalogItem, event: KeyboardEvent) {
  if (event.target !== event.currentTarget) return
  toggleRowSelection(item)
}
function togglePageSelection(value: unknown) { const ids = new Set(selectedGoodsIds.value); if (Boolean(value)) currentPageEligibleIds.value.forEach(id => ids.add(id)); else currentPageEligibleIds.value.forEach(id => ids.delete(id)); selectedGoodsIds.value = [...ids] }
function getBulkErrorMessage(error: unknown): string { const data = (error as { response?: { data?: { detail?: unknown } } })?.response?.data; if (typeof data?.detail === 'string' && data.detail) return data.detail; return error instanceof Error && error.message ? error.message : '批量操作失败，请刷新后重试' }
async function reloadAfterBulk() { await load(); const maxPage = Math.max(1, Math.ceil(total.value / pageSize)); if (page.value > maxPage) { page.value = maxPage; await load() } }
async function executeBulkAction() { const action = bulkAction.value; const ids = [...selectedGoodsIds.value]; if (!action || !ids.length || bulkLoading.value) return; try { await ElMessageBox.confirm(`确定${action === 'delete' ? '删除' : '下架'}选中的 ${ids.length} 条社团谷子吗？`, action === 'delete' ? '批量删除' : '批量下架', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }) } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(getBulkErrorMessage(error)); return }
  bulkLoading.value = true
  try {
    if (action === 'delete') {
      const result = await batchDeleteClubGoods(ids)
      selectedGoodsIds.value = selectedGoodsIds.value.filter(id => !result.deleted_ids.includes(id))
      ElMessage.success(`已删除 ${result.deleted_count} 条谷子`)
    } else {
      const result = await batchUnlistClubGoods(ids)
      selectedGoodsIds.value = selectedGoodsIds.value.filter(id => !result.updated_ids.includes(id))
      ElMessage.success(`已下架 ${result.updated_count} 条谷子`)
    }
    await reloadAfterBulk()
  } catch (error) { ElMessage.error(getBulkErrorMessage(error)); try { await load({ preserveSelection: true }) } catch { /* 保留选择 */ } } finally { bulkLoading.value = false }
}
async function togglePublished(item: ClubCatalogItem) { try { const publication_status = item.publication_status === 'listed' ? 'unlisted' : 'listed'; const updated = await updateClubGoods(item.id, { publication_status, publish_at: null }); Object.assign(item, updated); ElMessage.success(publication_status === 'listed' ? '已上架' : '已下架') } catch { /* 全局请求层提示错误 */ } }
async function cancelSchedule(item: ClubCatalogItem) { try { const updated = await updateClubGoods(item.id, { publish_at: null }); Object.assign(item, updated); ElMessage.success('已取消定时上架') } catch { /* 全局请求层提示错误 */ } }
function startDrag(id: string, event: DragEvent) { if (!canReorder.value) return; draggedId.value = id; event.dataTransfer?.setData('text/plain', id) }
async function dropDrag(targetId: string) { const sourceId = draggedId.value; draggedId.value = null; if (!sourceId || sourceId === targetId || !canReorder.value) return; const from = goods.value.findIndex(item => item.id === sourceId); const to = goods.value.findIndex(item => item.id === targetId); if (from < 0 || to < 0) return; const next = [...goods.value]; const moved = next.splice(from, 1)[0]; if (!moved) return; next.splice(to, 0, moved); goods.value = next; try { await reorderClubGoods(next.map(item => item.id)); ElMessage.success('公开顺序已更新') } catch { ElMessage.error('排序保存失败，正在恢复原顺序'); await load() } }
onMounted(load)
onUnmounted(() => {
  if (searchTimer !== null) window.clearTimeout(searchTimer)
})
</script>

<style scoped>
.goods-page { padding: 22px; border: 1px solid var(--border-color); border-radius: 14px; background: var(--bg-white); box-shadow: var(--shadow-sm); }
.section-title { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.section-eyebrow { margin: 0 0 4px; color: var(--primary-gold-dark); font-size: var(--font-small); font-weight: 700; letter-spacing: .08em; }
.section-title h2 { margin: 0; font-size: var(--font-title-lg); }.section-title p:last-child { margin: 6px 0 0; color: var(--text-light); font-size: var(--font-caption); }
.primary-action { flex: none; }.catalog-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 18px; }
.summary-card { display: flex; align-items: center; justify-content: space-between; min-width: 0; padding: 11px 13px; border: 1px solid var(--secondary-gray-dark); border-radius: 10px; color: var(--text-regular); background: #fff; cursor: pointer; text-align: left; }.summary-card span { font-size: var(--font-caption); }.summary-card strong { color: var(--text-dark); font-size: 18px; }.summary-card.active { border-color: var(--primary-gold); background: rgba(255, 250, 232, .7); }
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }.toolbar-search { display: flex; flex: 1 1 300px; min-width: 240px; max-width: 500px; }.toolbar-search .search-input { width: 100%; min-width: 0; }
.toolbar-search :deep(.el-input__wrapper) { min-height: 40px; border: 1px solid var(--border-color); border-radius: var(--button-radius); background: var(--bg-white); box-shadow: var(--shadow-sm); transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
.toolbar-search :deep(.el-input__wrapper:hover) { border-color: var(--primary-gold); }
.toolbar-search :deep(.el-input__wrapper.is-focus) { border-color: var(--primary-gold); box-shadow: 0 0 0 2px rgba(212,175,55,.1); }
.toolbar-search :deep(.el-input__prefix-inner),
.toolbar-search :deep(.el-input__suffix-inner) { color: var(--text-light); }
.filter-control { display: inline-flex; align-items: center; gap: 7px; color: var(--text-light); font-size: var(--font-caption); white-space: nowrap; }.toolbar-select { width: 132px; }.toolbar-select--sort { width: 158px; }.toolbar-select :deep(.el-select__wrapper) { min-height: 34px; padding: 0 11px; border-radius: 9px; color: var(--text-regular); background: #fff; box-shadow: 0 0 0 1px var(--secondary-gray-dark) inset; transition: box-shadow var(--transition-fast), background-color var(--transition-fast); }.toolbar-select :deep(.el-select__wrapper:hover) { box-shadow: 0 0 0 1px rgba(212,175,55,.46) inset; }.toolbar-select :deep(.el-select__wrapper.is-focused) { box-shadow: 0 0 0 1px var(--primary-gold) inset !important; }.toolbar-select :deep(.el-select__selected-item) { color: var(--text-regular); font-size: var(--font-caption); }.bulk-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto; }.bulk-action-button { margin-left: 0 !important; }.bulk-action-button--delete { color: var(--el-color-danger); border-color: rgba(245,108,108,.45); }.bulk-action-button--unlist { color: var(--el-color-warning); border-color: rgba(230,162,60,.45); }.bulk-summary { color: var(--text-regular); font-size: var(--font-caption); white-space: nowrap; }.sort-hint { margin: 0 0 10px; color: var(--text-light); font-size: var(--font-small); }
:global(.catalog-filter-popper.el-popper) { overflow: hidden; border: 1px solid rgba(17,24,39,.08) !important; border-radius: 10px !important; background: #fff !important; box-shadow: 0 12px 30px rgba(15,23,42,.12), 0 2px 8px rgba(15,23,42,.06) !important; }
:global(.catalog-filter-popper .el-select-dropdown__list) { padding: 6px; }
:global(.catalog-filter-popper .el-select-dropdown__item) { height: 36px; padding: 0 12px; border-radius: 7px; color: var(--text-regular); font-size: var(--font-caption); line-height: 36px; transition: color var(--transition-fast), background-color var(--transition-fast); }
:global(.catalog-filter-popper .el-select-dropdown__item.is-hovering),
:global(.catalog-filter-popper .el-select-dropdown__item:hover) { color: var(--primary-gold-dark); background: rgba(212,175,55,.08); }
:global(.catalog-filter-popper .el-select-dropdown__item.is-selected) { color: var(--primary-gold-dark); background: rgba(212,175,55,.13); font-weight: 650; }
:global(.catalog-filter-popper .el-popper__arrow::before) { border-color: rgba(17,24,39,.08) !important; background: #fff !important; }
.goods-list { display: grid; gap: 6px; min-height: 100px; }
.goods-list-header,
.goods-row { --catalog-columns: 68px minmax(260px, 1fr) minmax(150px, .48fr) minmax(180px, .55fr) 112px; display: grid; grid-template-columns: var(--catalog-columns); align-items: center; column-gap: 16px; min-width: 0; }
.goods-list-header.has-selection,
.goods-row.has-selection { --catalog-columns: 28px 68px minmax(260px, 1fr) minmax(150px, .48fr) minmax(180px, .55fr) 112px; }
.goods-list-header { min-height: 26px; padding: 0 11px; color: var(--text-light); font-size: var(--font-small); font-weight: 600; }
.goods-list-header__actions { text-align: right; }
.goods-row { min-height: 88px; padding: 9px 11px; border: 1px solid var(--secondary-gray-dark); border-radius: 10px; background: #fff; transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
.goods-row[draggable="true"] { cursor: grab; }
.goods-row[draggable="true"]:active { cursor: grabbing; }
.goods-row:hover { border-color: rgba(212,175,55,.5); box-shadow: 0 4px 14px rgba(50,40,20,.06); }
.goods-row.is-selectable { cursor: pointer; }
.goods-row.is-selectable:focus-visible { outline: 2px solid rgba(212,175,55,.48); outline-offset: 2px; }
.goods-row.is-selected { border-color: var(--primary-gold); background: rgba(255,250,232,.72); box-shadow: 0 4px 14px rgba(128,99,20,.08); }
.goods-row.is-selection-disabled { cursor: default; }
.selection-cell { display: grid; place-items: center; }
.thumb { width: 68px; height: 68px; border-radius: 8px; background: var(--secondary-gray); }
.thumb.placeholder { display: grid; place-items: center; color: var(--text-light); }
.goods-row__content { display: contents; }
.goods-row__identity,
.goods-row__publication { min-width: 0; }
.goods-heading { min-width: 0; }
.goods-row h3 { min-width: 0; margin: 0 0 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-body); }
.goods-row p { margin: 0; overflow: hidden; color: var(--text-light); font-size: var(--font-small); text-overflow: ellipsis; white-space: nowrap; }
.goods-row__publication { display: grid; align-content: center; gap: 7px; }
.price { color: var(--primary-gold-dark); font-size: var(--font-caption); font-weight: 700; }
.price--empty { color: var(--text-light); font-weight: 500; }
.status-line { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 7px; min-width: 0; }
.schedule-note,
.failure-note { overflow: hidden; color: var(--text-light); font-size: var(--font-small); text-overflow: ellipsis; white-space: nowrap; }
.failure-note { color: var(--el-color-danger); }
.popularity-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
.popularity-badge { margin: 0; font-weight: 500; }
.row-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 2px; min-width: 0; }
.row-actions .el-button { margin: 0; white-space: nowrap; }
.goods-page :deep(.el-pagination) { justify-content: center; margin-top: 20px; }
@media (max-width: 1050px) {
  .goods-list-header,
  .goods-row { --catalog-columns: 60px minmax(190px, 1fr) minmax(128px, .45fr) minmax(150px, .5fr) 92px; column-gap: 10px; }
  .goods-list-header.has-selection,
  .goods-row.has-selection { --catalog-columns: 26px 60px minmax(190px, 1fr) minmax(128px, .45fr) minmax(150px, .5fr) 92px; }
  .thumb { width: 60px; height: 60px; }
  .toolbar-search { max-width: none; flex-basis: 100%; }
  .bulk-actions { margin-left: 0; }
}
@media (max-width: 768px) {
  .goods-page { padding: 16px; border-radius: 12px; }
  .section-title { align-items: stretch; flex-direction: column; }
  .primary-action { align-self: flex-start; }
  .catalog-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .toolbar { align-items: stretch; }
  .filter-control { flex: 1; justify-content: space-between; }
  .toolbar-select { width: auto; min-width: 0; flex: 1; }
  .bulk-actions { width: 100%; }
  .bulk-actions > * { flex: 1; }
  .bulk-actions--selection { display: grid; grid-template-columns: 1fr auto auto; }
  .bulk-summary { grid-column: 1 / -1; }
  .goods-list-header { display: none; }
  .goods-row,
  .goods-row.has-selection { display: flex; align-items: flex-start; gap: 10px; min-height: 0; padding: 10px; }
  .selection-cell { flex: 0 0 22px; padding-top: 5px; }
  .thumb { flex: 0 0 58px; width: 58px; height: 58px; }
  .goods-row__content { display: block; min-width: 0; flex: 1; }
  .goods-row h3 { margin-bottom: 3px; white-space: normal; line-height: 1.35; }
  .goods-row__publication { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 8px; margin-top: 5px; }
  .price { display: block; }
  .popularity-meta { margin-top: 7px; }
  .row-actions { flex: none; flex-direction: column; align-items: flex-end; gap: 2px; }
  .row-actions .el-button { padding: 4px 0; }
  .schedule-note { max-width: 100%; }
}
</style>
