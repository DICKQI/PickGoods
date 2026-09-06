<template>
  <section class="goods-page" :class="{ 'has-mobile-bulk': isMobile && bulkAction }">
    <header class="section-title">
      <div>
        <p class="section-eyebrow">CATALOG OPERATIONS</p>
        <h2>社团谷子</h2>
        <p>公开目录、发布状态和人气反馈，都在这里集中打理。</p>
      </div>
      <el-button type="primary" class="primary-action" @click="router.push('/club/goods/new')">
        <el-icon><Plus /></el-icon><span>新增谷子</span>
      </el-button>
    </header>

    <div v-if="!isMobile" class="catalog-summary" aria-label="目录摘要" role="tablist">
      <button
        v-for="item in summaryCards"
        :key="item.key"
        type="button"
        role="tab"
        :aria-selected="statusFilter === item.key"
        :class="['summary-card', { active: statusFilter === item.key }]"
        @click="setStatus(item.key)"
      >
        <span>{{ item.label }}</span><strong>{{ item.value }}</strong>
      </button>
    </div>

    <div class="toolbar">
      <div class="toolbar-search">
        <el-input
          v-model="search"
          clearable
          class="search-input"
          aria-label="搜索社团谷子"
          placeholder="搜索谷子、IP 或品类"
          @input="scheduleSearch"
          @keyup.enter="handleSearchImmediately"
          @clear="handleSearchImmediately"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <template v-if="!isMobile">
        <label class="filter-control">
          <span>状态</span>
          <el-select v-model="statusFilter" class="toolbar-select" popper-class="catalog-filter-popper" aria-label="发布状态筛选" @change="handleSearch">
            <el-option label="全部" value="" />
            <el-option label="已上架" value="listed" />
            <el-option label="草稿" value="draft" />
            <el-option label="已下架" value="unlisted" />
          </el-select>
        </label>
        <label class="filter-control">
          <span>主题</span>
          <el-select v-model="themeFilter" class="toolbar-select toolbar-select--theme" popper-class="catalog-filter-popper" aria-label="主题筛选" clearable filterable placeholder="全部主题" @change="handleSearch">
            <el-option v-for="theme in metadata.themes" :key="theme.id" :label="theme.name" :value="theme.id" />
          </el-select>
        </label>
        <label class="filter-control">
          <span>排序</span>
          <el-select v-model="sort" class="toolbar-select toolbar-select--sort" popper-class="catalog-filter-popper" aria-label="目录排序" @change="handleSearch">
            <el-option label="公开顺序" value="order" />
            <el-option label="名称" value="name" />
            <el-option label="最近更新" value="created" />
          </el-select>
        </label>
        <div v-if="!bulkAction" class="bulk-actions desktop-bulk-actions">
          <el-button class="bulk-action-button bulk-action-button--delete" plain data-test="start-batch-delete" aria-label="批量删除社团谷子" @click="startBulkAction('delete')"><el-icon><Delete /></el-icon>批量删除</el-button>
          <el-button class="bulk-action-button bulk-action-button--unlist" plain data-test="start-batch-unlist" aria-label="批量下架社团谷子" @click="startBulkAction('unlist')"><el-icon><Download /></el-icon>批量下架</el-button>
        </div>
      </template>

      <div v-else class="mobile-toolbar-actions">
        <button type="button" class="mobile-toolbar-button" :class="{ 'is-active': activeDetailedFilterCount > 0 }" data-test="mobile-filter-trigger" @click="openMobileFilter">
          <el-icon><Filter /></el-icon><span>筛选</span><strong v-if="activeDetailedFilterCount">{{ activeDetailedFilterCount }}</strong>
        </button>
        <button v-if="!bulkAction" type="button" class="mobile-toolbar-button" data-test="mobile-bulk-trigger" @click="mobileBulkMenuVisible = true">
          <el-icon><List /></el-icon><span>批量操作</span>
        </button>
      </div>

      <div v-if="bulkAction" class="bulk-actions bulk-actions--selection">
        <span class="bulk-summary">批量{{ bulkActionLabel }} · 已选 {{ selectedGoodsIds.length }} 条</span>
        <el-checkbox
          class="loaded-select-checkbox"
          data-test="select-loaded"
          :model-value="isLoadedFullySelected"
          :indeterminate="isLoadedIndeterminate"
          :disabled="!loadedEligibleIds.length || bulkLoading"
          aria-label="选择已加载可操作谷子"
          @change="toggleLoadedSelection"
        >选择已加载</el-checkbox>
        <el-button text :disabled="bulkLoading" data-test="cancel-bulk-action" @click="cancelBulkAction">取消</el-button>
        <el-button :type="bulkAction === 'delete' ? 'danger' : 'warning'" :loading="bulkLoading" :disabled="!selectedGoodsIds.length" data-test="confirm-bulk-action" @click="executeBulkAction">
          <el-icon><Check /></el-icon>{{ bulkActionLabel }}
        </el-button>
      </div>
    </div>

    <div v-if="activeFilterChips.length" class="active-filter-row" aria-label="当前筛选条件">
      <el-tag v-for="chip in activeFilterChips" :key="chip.key" closable effect="plain" @close="removeFilter(chip.key)">{{ chip.label }}</el-tag>
      <el-button text type="primary" class="clear-filter-link" @click="clearFilters">清除全部</el-button>
    </div>
    <p v-if="reorderHint" class="sort-hint">{{ reorderHint }}</p>

    <div v-if="loadError && !loading" class="state-panel state-panel--error" role="alert">
      <el-icon><WarningFilled /></el-icon><span>{{ loadError }}</span><el-button text type="primary" @click="loadInitial">重试</el-button>
    </div>

    <div v-if="loading" class="loading-state" aria-label="正在加载社团谷子">
      <div v-for="index in (isMobile ? 4 : 5)" :key="index" class="loading-skeleton">
        <span></span><div><i></i><i></i></div>
      </div>
    </div>

    <div v-else-if="!loadError && goods.length" class="goods-list">
      <template v-if="!isMobile">
        <div :class="['goods-list-header', { 'has-selection': bulkAction }]" aria-hidden="true" data-test="catalog-column-header">
          <span v-if="bulkAction"></span><span></span><span>谷子</span><span>价格与状态</span><span>人气</span><span class="goods-list-header__actions">操作</span>
        </div>
        <article
          v-for="item in goods"
          :key="item.id"
          :class="['goods-row', { 'has-selection': bulkAction, 'is-selectable': bulkAction && isSelectable(item) && !bulkLoading, 'is-selected': bulkAction && isSelected(item.id), 'is-selection-disabled': bulkAction && (!isSelectable(item) || bulkLoading) }]"
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
          <el-image v-if="item.main_photo && !erroredImages.has(item.id)" :src="item.main_photo" :alt="`${item.name}图片`" fit="cover" lazy class="thumb" @error="markImageError(item.id)" />
          <div v-else class="thumb placeholder" aria-label="暂无图片"><el-icon><Picture /></el-icon></div>
          <div class="goods-row__identity"><h3 :title="item.name">{{ item.name }}</h3><p>{{ item.ip?.name || '未标注 IP' }} · {{ item.category?.name || '未分类' }}</p></div>
          <div class="goods-row__publication">
            <span :class="['price', { 'price--empty': !item.public_price }]">{{ item.public_price ? `¥${item.public_price}` : '未设置价格' }}</span>
            <div class="status-line"><el-tag size="small" :type="statusType(item.publication_status)">{{ statusLabel(item.publication_status) }}</el-tag><span v-if="item.publish_at" class="schedule-note">计划 {{ formatDate(item.publish_at) }}</span><span v-if="item.publish_error" class="failure-note" :title="item.publish_error">上次上架失败</span></div>
          </div>
          <div class="popularity-meta" aria-label="谷子人气统计"><el-tag class="popularity-badge popularity-badge--intended" size="small" effect="plain" type="warning">意向入手 {{ popularityByGoodsId[item.id]?.intended_user_count ?? 0 }} 人</el-tag><el-tag class="popularity-badge popularity-badge--acquired" size="small" effect="plain" type="success">已入手 {{ popularityByGoodsId[item.id]?.acquired_user_count ?? 0 }} 人</el-tag></div>
          <div class="row-actions"><el-button link class="row-edit-button" :disabled="bulkLoading" @click="router.push(`/club/goods/${item.id}/edit`)"><el-icon><Edit /></el-icon>编辑</el-button><el-button v-if="item.publish_at" link type="warning" :disabled="bulkLoading" @click="cancelSchedule(item)">取消计划</el-button><el-button v-if="item.publication_status !== 'draft'" link :disabled="bulkLoading" :type="item.publication_status === 'listed' ? 'warning' : 'success'" @click="togglePublished(item)">{{ item.publication_status === 'listed' ? '下架' : '上架' }}</el-button></div>
        </article>
      </template>

      <template v-else>
        <ClubGoodsMobileCard
          v-for="(item, index) in goods"
          :key="item.id"
          :item="item"
          :popularity="popularityByGoodsId[item.id]"
          :selection-mode="Boolean(bulkAction)"
          :selected="isSelected(item.id)"
          :selection-disabled="bulkAction ? (!isSelectable(item) || bulkLoading) : false"
          :can-move-up="canReorder && index > 0"
          :can-move-down="canReorder && index < goods.length - 1"
          @toggle="toggleSelection(item, $event)"
          @menu="openMobileItemMenu(item)"
          @move="moveMobileItem(item, $event)"
        />
      </template>
    </div>

    <el-empty v-if="!loading && !loadError && !goods.length" :description="hasFilters ? '没有找到匹配的谷子' : '还没有社团谷子'">
      <el-button v-if="hasFilters" text type="primary" @click="clearFilters">清除筛选</el-button>
      <el-button v-else type="primary" @click="router.push('/club/goods/new')"><el-icon><Plus /></el-icon>新增谷子</el-button>
    </el-empty>

    <div v-if="goods.length && hasNext" ref="sentinelRef" class="scroll-sentinel" aria-hidden="true"></div>
    <div v-if="loadingMore" class="loading-more" aria-live="polite"><span class="loading-more__spinner"></span><span>正在加载更多谷子…</span></div>
    <button v-else-if="loadMoreError" type="button" class="load-more-fallback" @click="loadMore">加载失败，点击重试</button>
    <button v-else-if="goods.length && hasNext && !observerSupported" type="button" class="load-more-fallback" @click="loadMore">加载更多</button>
    <p v-else-if="goods.length && !hasNext" class="no-more">已加载全部 {{ total }} 条</p>

    <BaseBottomSheet v-model="mobileFilterVisible" title="筛选社团谷子" subtitle="组合条件后再应用，列表会从头加载">
      <div class="mobile-filter-form">
        <label><span>发布状态</span><el-select v-model="mobileDraft.status" popper-class="catalog-filter-popper catalog-filter-popper--sheet" aria-label="移动端发布状态"><el-option label="全部" value="" /><el-option label="已上架" value="listed" /><el-option label="草稿" value="draft" /><el-option label="已下架" value="unlisted" /></el-select></label>
        <label><span>主题</span><el-select v-model="mobileDraft.theme" clearable filterable popper-class="catalog-filter-popper catalog-filter-popper--sheet" aria-label="移动端主题筛选" placeholder="全部主题"><el-option v-for="theme in metadata.themes" :key="theme.id" :label="theme.name" :value="theme.id" /></el-select></label>
        <label><span>排序</span><el-select v-model="mobileDraft.sort" popper-class="catalog-filter-popper catalog-filter-popper--sheet" aria-label="移动端目录排序"><el-option label="公开顺序" value="order" /><el-option label="名称" value="name" /><el-option label="最近更新" value="created" /></el-select></label>
      </div>
      <template #footer><el-button class="sheet-button" @click="resetMobileDraft">重置</el-button><el-button type="primary" class="sheet-button" @click="applyMobileFilters">应用筛选</el-button></template>
    </BaseBottomSheet>

    <MobileActionSheet v-model="mobileBulkMenuVisible" title="批量操作" :actions="mobileBulkActions" @select="handleMobileBulkSelect" />
    <MobileActionSheet v-model="mobileItemMenuVisible" :title="mobileActionItem?.name || '谷子操作'" :actions="mobileItemActions" @select="handleMobileItemAction" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, ArrowUp, Calendar, Check, Delete, Download, Edit, Filter, List, Picture, Plus, Search, WarningFilled } from '@element-plus/icons-vue'
import { batchDeleteClubGoods, batchUnlistClubGoods, getMyClubGoods, getMyClubPopularity, reorderClubGoods, updateClubGoods } from '@/api/clubs'
import type { ClubCatalogItem, ClubCatalogSummary, ClubPopularityItem, ClubPublicationStatus } from '@/api/types'
import { useMetadataStore } from '@/stores/metadata'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import BaseBottomSheet from '@/components/ui/BaseBottomSheet.vue'
import MobileActionSheet from '@/components/MobileActionSheet.vue'
import ClubGoodsMobileCard from '@/components/club/ClubGoodsMobileCard.vue'

type BulkAction = 'delete' | 'unlist'
type FilterKey = 'search' | 'status' | 'theme' | 'sort'

const router = useRouter()
const metadata = useMetadataStore()
const { isMobile } = useResponsiveDevice()
const goods = ref<ClubCatalogItem[]>([])
const popularityByGoodsId = ref<Record<string, ClubPopularityItem>>({})
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const loadMoreError = ref('')
const search = ref('')
const statusFilter = ref('')
const themeFilter = ref<number | undefined>()
const sort = ref('order')
const nextPage = ref<number | null>(null)
const pageSize = 50
const total = ref(0)
const summary = ref<ClubCatalogSummary>({ total: 0, listed: 0, draft: 0, unlisted: 0 })
const bulkAction = ref<BulkAction | null>(null)
const selectedGoodsIds = ref<string[]>([])
const bulkLoading = ref(false)
const draggedId = ref<string | null>(null)
const erroredImages = ref(new Set<string>())
const sentinelRef = ref<HTMLElement | null>(null)
const observerSupported = ref(typeof IntersectionObserver !== 'undefined')
const mobileFilterVisible = ref(false)
const mobileBulkMenuVisible = ref(false)
const mobileItemMenuVisible = ref(false)
const mobileActionItem = ref<ClubCatalogItem | null>(null)
const mobileDraft = reactive<{ status: string; theme?: number; sort: string }>({ status: '', theme: undefined, sort: 'order' })
let sentinelObserver: IntersectionObserver | null = null
let searchTimer: number | null = null
let loadRequestId = 0

const statusLabels: Record<ClubPublicationStatus, string> = { draft: '草稿', listed: '已上架', unlisted: '已下架' }
const statusLabel = (status: ClubPublicationStatus) => statusLabels[status]
const statusType = (status: ClubPublicationStatus) => ({ draft: 'info', listed: 'success', unlisted: 'warning' }[status] as 'info' | 'success' | 'warning')
const bulkActionLabel = computed(() => bulkAction.value === 'delete' ? '删除' : '下架')
const loadedEligibleIds = computed(() => goods.value.filter(item => isSelectable(item)).map(item => item.id))
const isLoadedFullySelected = computed(() => loadedEligibleIds.value.length > 0 && loadedEligibleIds.value.every(id => selectedGoodsIds.value.includes(id)))
const isLoadedIndeterminate = computed(() => { const count = loadedEligibleIds.value.filter(id => selectedGoodsIds.value.includes(id)).length; return count > 0 && count < loadedEligibleIds.value.length })
const hasNext = computed(() => nextPage.value !== null)
const hasFilters = computed(() => Boolean(search.value.trim() || statusFilter.value || themeFilter.value || sort.value !== 'order'))
const activeDetailedFilterCount = computed(() => [statusFilter.value, themeFilter.value, sort.value !== 'order' ? sort.value : ''].filter(Boolean).length)
const canReorder = computed(() => !hasFilters.value && !hasNext.value && !bulkAction.value && !loadingMore.value && goods.value.length > 1)
const reorderHint = computed(() => {
  if (bulkAction.value || !goods.value.length || canReorder.value) return ''
  if (hasFilters.value) return '筛选结果不支持调整公开顺序；清除筛选后再排序。'
  if (hasNext.value) return '滚动加载完全部条目后，可拖动或使用上下移动调整公开顺序。'
  return ''
})
const summaryCards = computed(() => [
  { key: '', label: '全部', value: summary.value.total },
  { key: 'listed', label: '已上架', value: summary.value.listed },
  { key: 'draft', label: '草稿', value: summary.value.draft },
  { key: 'unlisted', label: '已下架', value: summary.value.unlisted },
])
const activeFilterChips = computed(() => {
  const chips: Array<{ key: FilterKey; label: string }> = []
  if (search.value.trim()) chips.push({ key: 'search', label: `搜索：${search.value.trim()}` })
  if (statusFilter.value) chips.push({ key: 'status', label: `状态：${statusLabel(statusFilter.value as ClubPublicationStatus)}` })
  if (themeFilter.value) chips.push({ key: 'theme', label: `主题：${metadata.themes.find(item => item.id === themeFilter.value)?.name || '已选主题'}` })
  if (sort.value !== 'order') chips.push({ key: 'sort', label: `排序：${sort.value === 'name' ? '名称' : '最近更新'}` })
  return chips
})
const mobileBulkActions = computed(() => [
  { key: 'delete', label: '批量删除草稿或下架谷子', icon: Delete, tone: 'danger' as const },
  { key: 'unlist', label: '批量下架已上架谷子', icon: Download },
])
const mobileItemActions = computed(() => {
  const item = mobileActionItem.value
  if (!item) return []
  const actions: Array<{ key: string; label: string; icon: typeof Edit; tone?: 'default' | 'primary' | 'danger' }> = [
    { key: 'edit', label: '编辑谷子', icon: Edit, tone: 'primary' },
  ]
  if (item.publish_at) actions.push({ key: 'cancel-schedule', label: '取消定时上架', icon: Calendar })
  if (item.publication_status !== 'draft') actions.push({ key: item.publication_status === 'listed' ? 'unlist' : 'list', label: item.publication_status === 'listed' ? '下架谷子' : '重新上架', icon: item.publication_status === 'listed' ? Download : Check })
  if (canReorder.value) {
    const index = goods.value.findIndex(row => row.id === item.id)
    if (index > 0) actions.push({ key: 'move-up', label: '上移公开顺序', icon: ArrowUp })
    if (index >= 0 && index < goods.value.length - 1) actions.push({ key: 'move-down', label: '下移公开顺序', icon: ArrowDown })
  }
  return actions
})

function isSelectable(item: ClubCatalogItem, action = bulkAction.value) {
  if (action === 'delete') return item.publication_status === 'draft' || item.publication_status === 'unlisted'
  if (action === 'unlist') return item.publication_status === 'listed'
  return false
}
function selectionHint(item: ClubCatalogItem) { return isSelectable(item) ? '' : (bulkAction.value === 'delete' ? '已上架谷子请先下架' : '批量下架仅支持已上架谷子') }
function isSelected(id: string) { return selectedGoodsIds.value.includes(id) }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function markImageError(id: string) { erroredImages.value = new Set(erroredImages.value).add(id) }
function fallbackSummary(items: ClubCatalogItem[], count: number): ClubCatalogSummary { return { total: count, listed: items.filter(item => item.publication_status === 'listed').length, draft: items.filter(item => item.publication_status === 'draft').length, unlisted: items.filter(item => item.publication_status === 'unlisted').length } }

async function load(options: { append?: boolean; preserveSelection?: boolean } = {}) {
  const append = Boolean(options.append)
  if (append && (loading.value || loadingMore.value || nextPage.value === null)) return
  const requestId = ++loadRequestId
  const requestedPage = append ? nextPage.value! : 1
  if (append) {
    loadingMore.value = true
    loadMoreError.value = ''
  } else {
    loading.value = true
    loadError.value = ''
    loadMoreError.value = ''
    nextPage.value = null
    goods.value = []
    if (!options.preserveSelection) selectedGoodsIds.value = []
  }
  try {
    const [result, popularityResult] = await Promise.all([
      getMyClubGoods({ page: requestedPage, page_size: pageSize, search: search.value.trim() || undefined, status: statusFilter.value || undefined, theme: themeFilter.value, sort: sort.value }),
      append ? Promise.resolve(null) : getMyClubPopularity(),
    ])
    if (requestId !== loadRequestId) return
    const existing = append ? goods.value : []
    const knownIds = new Set(existing.map(item => item.id))
    goods.value = [...existing, ...result.results.filter(item => !knownIds.has(item.id))]
    nextPage.value = result.next
    total.value = result.count
    summary.value = result.summary || fallbackSummary(goods.value, result.count)
    if (popularityResult) {
      const popularity = Array.isArray(popularityResult) ? popularityResult : popularityResult.items
      popularityByGoodsId.value = Object.fromEntries(popularity.map(item => [item.goods_id, item]))
    }
  } catch (error: any) {
    if (requestId !== loadRequestId) return
    if (append) {
      loadMoreError.value = error?.message || '加载更多失败'
      sentinelObserver?.disconnect()
    }
    else loadError.value = error?.message || '加载社团谷子失败'
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

const loadInitial = () => load()
async function loadMore() {
  await load({ append: true, preserveSelection: true })
  if (!loadMoreError.value) await nextTick(setupSentinelObserver)
}
function clearSearchTimer() { if (searchTimer !== null) { window.clearTimeout(searchTimer); searchTimer = null } }
function handleSearch() { clearSearchTimer(); void loadInitial() }
function scheduleSearch() { clearSearchTimer(); searchTimer = window.setTimeout(() => { searchTimer = null; handleSearch() }, 350) }
function handleSearchImmediately() { clearSearchTimer(); handleSearch() }
function setStatus(value: string) { statusFilter.value = value; handleSearch() }
function removeFilter(key: FilterKey) { if (key === 'search') search.value = ''; if (key === 'status') statusFilter.value = ''; if (key === 'theme') themeFilter.value = undefined; if (key === 'sort') sort.value = 'order'; handleSearch() }
function clearFilters() { search.value = ''; statusFilter.value = ''; themeFilter.value = undefined; sort.value = 'order'; resetMobileDraft(); handleSearchImmediately() }

function openMobileFilter() { mobileDraft.status = statusFilter.value; mobileDraft.theme = themeFilter.value; mobileDraft.sort = sort.value; mobileFilterVisible.value = true }
function resetMobileDraft() { mobileDraft.status = ''; mobileDraft.theme = undefined; mobileDraft.sort = 'order' }
function applyMobileFilters() { statusFilter.value = mobileDraft.status; themeFilter.value = mobileDraft.theme; sort.value = mobileDraft.sort; mobileFilterVisible.value = false; handleSearch() }

function startBulkAction(action: BulkAction) { bulkAction.value = action; selectedGoodsIds.value = [] }
function handleMobileBulkSelect(action: string) { if (action === 'delete' || action === 'unlist') startBulkAction(action) }
function cancelBulkAction() { bulkAction.value = null; selectedGoodsIds.value = [] }
function toggleSelection(item: ClubCatalogItem, selected: boolean) { if (!isSelectable(item)) return; const ids = new Set(selectedGoodsIds.value); if (selected) ids.add(item.id); else ids.delete(item.id); selectedGoodsIds.value = [...ids] }
function toggleItemSelection(item: ClubCatalogItem, value: unknown) { toggleSelection(item, Boolean(value)) }
function toggleLoadedSelection(value: unknown) { const ids = new Set(selectedGoodsIds.value); if (Boolean(value)) loadedEligibleIds.value.forEach(id => ids.add(id)); else loadedEligibleIds.value.forEach(id => ids.delete(id)); selectedGoodsIds.value = [...ids] }
function handleRowSelectionClick(item: ClubCatalogItem, event: MouseEvent) { if (!bulkAction.value) return; const target = event.target as HTMLElement | null; if (target?.closest('button, a, input, label, select, textarea')) return; toggleSelection(item, !isSelected(item.id)) }
function handleRowSelectionKey(item: ClubCatalogItem, event: KeyboardEvent) { if (event.target !== event.currentTarget) return; toggleSelection(item, !isSelected(item.id)) }
function getBulkErrorMessage(error: unknown) { const data = (error as { response?: { data?: { detail?: unknown } } })?.response?.data; if (typeof data?.detail === 'string' && data.detail) return data.detail; return error instanceof Error && error.message ? error.message : '批量操作失败，请刷新后重试' }

async function executeBulkAction() {
  const action = bulkAction.value
  const ids = [...selectedGoodsIds.value]
  if (!action || !ids.length || bulkLoading.value) return
  try {
    await ElMessageBox.confirm(`确定${action === 'delete' ? '删除' : '下架'}选中的 ${ids.length} 条社团谷子吗？`, action === 'delete' ? '批量删除' : '批量下架', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(getBulkErrorMessage(error))
    return
  }
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
    await load({ preserveSelection: true })
  } catch (error) {
    ElMessage.error(getBulkErrorMessage(error))
  } finally {
    bulkLoading.value = false
  }
}

async function togglePublished(item: ClubCatalogItem) { try { const publication_status = item.publication_status === 'listed' ? 'unlisted' : 'listed'; await updateClubGoods(item.id, { publication_status, publish_at: null }); ElMessage.success(publication_status === 'listed' ? '已上架' : '已下架'); await loadInitial() } catch { /* 请求层统一提示 */ } }
async function cancelSchedule(item: ClubCatalogItem) { try { Object.assign(item, await updateClubGoods(item.id, { publish_at: null })); ElMessage.success('已取消定时上架') } catch { /* 请求层统一提示 */ } }
function openMobileItemMenu(item: ClubCatalogItem) { mobileActionItem.value = item; mobileItemMenuVisible.value = true }
function handleMobileItemAction(action: string) { const item = mobileActionItem.value; if (!item) return; if (action === 'edit') void router.push(`/club/goods/${item.id}/edit`); if (action === 'cancel-schedule') void cancelSchedule(item); if (action === 'list' || action === 'unlist') void togglePublished(item); if (action === 'move-up' || action === 'move-down') void moveMobileItem(item, action === 'move-up' ? 'up' : 'down'); mobileActionItem.value = null }

async function persistOrder(next: ClubCatalogItem[], previous: ClubCatalogItem[]) {
  goods.value = next
  try { await reorderClubGoods(next.map(item => item.id)); ElMessage.success('公开顺序已更新') }
  catch { goods.value = previous; ElMessage.error('排序保存失败，正在恢复原顺序') }
}
async function moveMobileItem(item: ClubCatalogItem, direction: 'up' | 'down') { if (!canReorder.value) return; const from = goods.value.findIndex(row => row.id === item.id); const to = direction === 'up' ? from - 1 : from + 1; if (from < 0 || to < 0 || to >= goods.value.length) return; const previous = [...goods.value]; const next = [...goods.value]; const [moved] = next.splice(from, 1); if (!moved) return; next.splice(to, 0, moved); await persistOrder(next, previous) }
function startDrag(id: string, event: DragEvent) { if (!canReorder.value) return; draggedId.value = id; event.dataTransfer?.setData('text/plain', id) }
async function dropDrag(targetId: string) { const sourceId = draggedId.value; draggedId.value = null; if (!sourceId || sourceId === targetId || !canReorder.value) return; const from = goods.value.findIndex(item => item.id === sourceId); const to = goods.value.findIndex(item => item.id === targetId); if (from < 0 || to < 0) return; const previous = [...goods.value]; const next = [...goods.value]; const [moved] = next.splice(from, 1); if (!moved) return; next.splice(to, 0, moved); await persistOrder(next, previous) }

function setupSentinelObserver() {
  sentinelObserver?.disconnect()
  if (!sentinelRef.value || !observerSupported.value) return
  sentinelObserver = new IntersectionObserver(entries => { if (!loadMoreError.value && entries.some(entry => entry.isIntersecting)) void loadMore() }, { rootMargin: '200px 0px' })
  sentinelObserver.observe(sentinelRef.value)
}

watch(sentinelRef, () => { void nextTick(setupSentinelObserver) })
watch(hasNext, () => { void nextTick(setupSentinelObserver) })
onMounted(() => { void metadata.fetchThemes(); void loadInitial() })
onUnmounted(() => { clearSearchTimer(); sentinelObserver?.disconnect() })
</script>

<style scoped>
.goods-page { padding: 24px; border: 1px solid var(--border-color); border-radius: 16px; background: rgba(255,255,255,.96); box-shadow: 0 14px 36px rgba(40,33,20,.05); }
.section-title { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
.section-eyebrow { margin: 0 0 5px; color: var(--primary-gold-dark); font-size: var(--font-small); font-weight: 800; letter-spacing: .1em; }
.section-title h2 { margin: 0; color: var(--text-dark); font-size: var(--font-title-lg); }
.section-title p:last-child { margin: 6px 0 0; color: var(--text-light); font-size: var(--font-caption); }
.primary-action { min-height: 40px; flex: none; border-radius: 10px; box-shadow: var(--shadow-purple-soft); }
.catalog-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 18px; }
.summary-card { display: flex; align-items: center; justify-content: space-between; min-width: 0; padding: 12px 14px; border: 1px solid var(--secondary-gray-dark); border-radius: 11px; color: var(--text-regular); background: #fff; cursor: pointer; text-align: left; transition: border-color var(--transition-fast), background-color var(--transition-fast), transform var(--transition-fast); }
.summary-card:hover { border-color: rgba(212,175,55,.55); transform: translateY(-1px); }
.summary-card span { font-size: var(--font-caption); }.summary-card strong { color: var(--text-dark); font-size: 19px; }
.summary-card.active { border-color: var(--primary-gold); background: rgba(255,250,232,.78); box-shadow: inset 0 0 0 1px rgba(212,175,55,.08); }
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.toolbar-search { display: flex; flex: 1 1 280px; min-width: 230px; max-width: 460px; }.search-input { width: 100%; }
.toolbar-search :deep(.el-input__wrapper) { min-height: 40px; border: 1px solid var(--border-color); border-radius: 10px; background: #fff; box-shadow: none; }
.toolbar-search :deep(.el-input__wrapper.is-focus) { border-color: var(--primary-gold); box-shadow: 0 0 0 3px rgba(212,175,55,.12); }
.filter-control { display: inline-flex; align-items: center; gap: 7px; color: var(--text-light); font-size: var(--font-caption); white-space: nowrap; }
.toolbar-select { width: 132px; }.toolbar-select--theme { width: 142px; }.toolbar-select--sort { width: 150px; }
.toolbar-select :deep(.el-select__wrapper) { min-height: 34px; border-radius: 9px; box-shadow: 0 0 0 1px var(--secondary-gray-dark) inset; }
.bulk-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }.desktop-bulk-actions { margin-left: auto; }
.bulk-action-button { margin: 0 !important; }.bulk-action-button--delete { color: var(--el-color-danger); border-color: rgba(245,108,108,.45); }.bulk-action-button--unlist { color: var(--el-color-warning); border-color: rgba(230,162,60,.45); }
.bulk-actions--selection { width: 100%; padding: 9px 11px; border: 1px solid rgba(212,175,55,.2); border-radius: 10px; background: rgba(255,250,232,.55); }.bulk-summary { color: var(--text-regular); font-size: var(--font-caption); white-space: nowrap; }.loaded-select-checkbox { margin-left: auto; }
.active-filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin: 2px 0 12px; }.active-filter-row :deep(.el-tag) { border-color: rgba(162,155,254,.3); color: var(--accent-purple-dark); background: var(--accent-purple-soft); }.clear-filter-link { margin-left: 2px; }
.sort-hint { margin: 0 0 10px; color: var(--text-light); font-size: var(--font-small); line-height: 1.5; }
.state-panel { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 100px; border: 1px solid var(--secondary-gray-dark); border-radius: 12px; color: var(--text-regular); background: var(--secondary-gray); }.state-panel--error > .el-icon { color: var(--el-color-danger); }
.goods-list { display: grid; gap: 7px; min-height: 100px; }
.goods-list-header, .goods-row { --catalog-columns: 68px minmax(240px, 1fr) minmax(155px, .5fr) minmax(180px, .6fr) 128px; display: grid; grid-template-columns: var(--catalog-columns); align-items: center; column-gap: 15px; min-width: 0; }
.goods-list-header.has-selection, .goods-row.has-selection { --catalog-columns: 28px 68px minmax(240px, 1fr) minmax(155px, .5fr) minmax(180px, .6fr) 128px; }
.goods-list-header { min-height: 26px; padding: 0 12px; color: var(--text-light); font-size: var(--font-small); font-weight: 700; }.goods-list-header__actions { text-align: right; }
.goods-row { min-height: 84px; padding: 9px 12px; border: 1px solid var(--secondary-gray-dark); border-radius: 12px; background: #fff; transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
.goods-row[draggable=true] { cursor: grab; }.goods-row[draggable=true]:active { cursor: grabbing; }.goods-row:hover { border-color: rgba(212,175,55,.5); box-shadow: 0 5px 16px rgba(50,40,20,.06); }.goods-row.is-selectable { cursor: pointer; }.goods-row.is-selectable:focus-visible { outline: 2px solid rgba(212,175,55,.5); outline-offset: 2px; }.goods-row.is-selected { border-color: var(--primary-gold); background: rgba(255,250,232,.7); }.goods-row.is-selection-disabled { cursor: default; opacity: .68; }
.selection-cell { display: grid; place-items: center; }.thumb { width: 68px; height: 68px; border-radius: 9px; background: var(--secondary-gray); }.thumb.placeholder { display: grid; place-items: center; color: var(--text-light); }
.goods-row__identity, .goods-row__publication { min-width: 0; }.goods-row h3 { margin: 0 0 5px; overflow: hidden; color: var(--text-dark); font-size: var(--font-body); text-overflow: ellipsis; white-space: nowrap; }.goods-row p { margin: 0; overflow: hidden; color: var(--text-light); font-size: var(--font-small); text-overflow: ellipsis; white-space: nowrap; }
.goods-row__publication { display: grid; gap: 6px; }.price { color: var(--primary-gold-dark); font-size: var(--font-caption); font-weight: 800; }.price--empty { color: var(--text-light); font-weight: 500; }.status-line { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 7px; min-width: 0; }.schedule-note, .failure-note { overflow: hidden; color: var(--text-light); font-size: var(--font-small); text-overflow: ellipsis; white-space: nowrap; }.failure-note { color: var(--el-color-danger); }
.popularity-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; min-width: 0; }.popularity-badge { margin: 0; font-weight: 500; }.row-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 2px; min-width: 0; }.row-actions .el-button { margin: 0; white-space: nowrap; }.row-actions .row-edit-button { color: var(--primary-gold-dark); }
.loading-state { display: grid; gap: 7px; }.loading-skeleton { display: flex; align-items: center; gap: 14px; min-height: 84px; padding: 9px 12px; border: 1px solid rgba(229,229,231,.8); border-radius: 12px; background: linear-gradient(90deg,#fafafa 25%,#f3f1f7 37%,#fafafa 63%); background-size: 400% 100%; animation: catalog-shimmer 1.35s ease infinite; }.loading-skeleton > span { width: 68px; height: 68px; border-radius: 9px; background: rgba(229,229,231,.8); }.loading-skeleton > div { display: grid; gap: 9px; flex: 1; }.loading-skeleton i { display: block; width: min(52%,260px); height: 11px; border-radius: 99px; background: rgba(229,229,231,.85); }.loading-skeleton i:last-child { width: min(34%,180px); }
.scroll-sentinel { height: 2px; margin: 4px 0; }.loading-more, .no-more { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; color: var(--text-light); font-size: var(--font-small); }.loading-more__spinner { width: 14px; height: 14px; border: 2px solid rgba(162,155,254,.25); border-top-color: var(--accent-purple); border-radius: 50%; animation: catalog-spin .8s linear infinite; }.load-more-fallback { display: block; min-width: 160px; margin: 10px auto; padding: 9px 16px; border: 1px solid rgba(162,155,254,.35); border-radius: 999px; color: var(--accent-purple-dark); background: var(--accent-purple-soft); cursor: pointer; }
.mobile-toolbar-actions { display: flex; gap: 7px; }.mobile-toolbar-button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 38px; padding: 0 11px; border: 1px solid var(--secondary-gray-dark); border-radius: 10px; color: var(--text-regular); background: #fff; font-size: var(--font-caption); cursor: pointer; }.mobile-toolbar-button.is-active { border-color: rgba(162,155,254,.6); color: var(--accent-purple-dark); background: var(--accent-purple-soft); }.mobile-toolbar-button strong { display: inline-grid; place-items: center; min-width: 18px; height: 18px; border-radius: 99px; color: #fff; background: var(--accent-purple); font-size: 11px; }
.mobile-filter-form { display: grid; gap: 18px; }.mobile-filter-form label { display: grid; gap: 7px; color: var(--text-regular); font-size: var(--font-caption); font-weight: 700; }.mobile-filter-form :deep(.el-select) { width: 100%; }.mobile-filter-form :deep(.el-select__wrapper) { min-height: 42px; border-radius: 10px; }.sheet-button { flex: 1; min-height: 42px; border-radius: 10px; }
:global(.catalog-filter-popper.el-popper) { overflow: hidden; border: 1px solid rgba(17,24,39,.08) !important; border-radius: 10px !important; box-shadow: 0 12px 30px rgba(15,23,42,.12) !important; }
:global(.catalog-filter-popper--sheet.el-popper) { z-index: 2500 !important; }
@keyframes catalog-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } } @keyframes catalog-spin { to { transform: rotate(360deg); } }
@media (max-width: 1050px) { .goods-page { padding: 20px; }.goods-list-header, .goods-row { --catalog-columns: 60px minmax(180px,1fr) minmax(135px,.5fr) minmax(150px,.55fr) 104px; column-gap: 10px; }.goods-list-header.has-selection, .goods-row.has-selection { --catalog-columns: 26px 60px minmax(180px,1fr) minmax(135px,.5fr) minmax(150px,.55fr) 104px; }.thumb { width: 60px; height: 60px; }.toolbar-search { max-width: none; flex-basis: 100%; }.desktop-bulk-actions { margin-left: 0; } }
@media (max-width: 768px) { .goods-page { padding: 17px 0 calc(30px + env(safe-area-inset-bottom)); border: 0; border-radius: 0; background: transparent; box-shadow: none; }.goods-page.has-mobile-bulk { padding-bottom: calc(150px + env(safe-area-inset-bottom)); }.section-title { align-items: flex-start; margin-bottom: 15px; }.section-title h2 { font-size: 21px; }.section-title p:last-child { max-width: 245px; line-height: 1.45; }.primary-action { min-height: 38px; padding: 0 12px; }.catalog-summary { gap: 6px; margin-bottom: 12px; }.summary-card { padding: 9px 10px; border-radius: 10px; }.summary-card span { font-size: 12px; }.summary-card strong { font-size: 17px; }.toolbar { align-items: stretch; gap: 8px; }.toolbar-search { flex-basis: 100%; }.mobile-toolbar-actions { width: 100%; }.mobile-toolbar-button { flex: 1; }.bulk-actions--selection { position: fixed; z-index: 45; left: 12px; right: 12px; bottom: calc(66px + env(safe-area-inset-bottom)); display: grid; grid-template-columns: 1fr auto auto; gap: 6px; width: auto; padding: 11px 12px; border-color: rgba(212,175,55,.32); background: rgba(255,255,255,.97); box-shadow: 0 12px 34px rgba(15,23,42,.2); backdrop-filter: blur(14px); }.bulk-summary { grid-column: 1 / -1; }.loaded-select-checkbox { margin-left: 0; }.goods-list { gap: 8px; }.loading-skeleton { min-height: 86px; padding: 10px; }.loading-skeleton > span { width: 64px; height: 64px; }.no-more { min-height: 36px; } }
@media (prefers-reduced-motion: reduce) { .summary-card, .goods-row, .loading-skeleton, .loading-more__spinner { transition: none; animation: none; } }
</style>
