<template>
  <div class="admin-page">
    <AdminPageHeader title="谷子管理" subtitle="跨用户检索、整理并批量维护全站谷子。">
      <el-button :loading="exporting" @click="handleExport">
        <el-icon><Download /></el-icon>
        导出
      </el-button>
      <el-button type="primary" @click="router.push('/admin/goods/new')">
        <el-icon><Plus /></el-icon>
        新增谷子
      </el-button>
    </AdminPageHeader>

    <el-card class="admin-search-card" shadow="never">
      <div class="admin-search-flex">
        <el-input
          v-model="filters.search"
          class="search-input"
          clearable
          placeholder="搜索名称、用户、IP 或角色"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select
          v-model="filters.user"
          clearable
          filterable
          remote
          :remote-method="searchUsers"
          placeholder="归属用户"
          @change="handleSearch"
        >
          <el-option
            v-for="user in userOptions"
            :key="user.id"
            :label="user.username"
            :value="user.id"
          />
        </el-select>
        <el-select
          v-model="filters.ip"
          clearable
          filterable
          remote
          :remote-method="searchIPs"
          placeholder="IP 作品"
          @change="handleSearch"
        >
          <el-option
            v-for="ip in ipOptions"
            :key="ip.id"
            :label="ip.name"
            :value="ip.id"
          />
        </el-select>
        <el-select v-model="filters.category" clearable filterable placeholder="品类" @change="handleSearch">
          <el-option
            v-for="category in flatCategories"
            :key="category.id"
            :label="category.path_name || category.name"
            :value="category.id"
          />
        </el-select>
        <el-select
          v-model="filters.theme"
          clearable
          filterable
          remote
          :remote-method="searchThemes"
          placeholder="主题"
          @change="handleSearch"
        >
          <el-option
            v-for="theme in themeOptions"
            :key="theme.id"
            :label="theme.name"
            :value="theme.id"
          />
        </el-select>
        <el-select v-model="filters.status" clearable placeholder="状态" @change="handleSearch">
          <el-option label="草稿" value="draft" />
          <el-option label="意向入手" value="intended" />
          <el-option label="在馆" value="in_cabinet" />
          <el-option label="出街中" value="outdoor" />
          <el-option label="已售出" value="sold" />
        </el-select>
        <el-select v-model="filters.is_official" clearable placeholder="官谷属性" @change="handleSearch">
          <el-option label="官谷" :value="true" />
          <el-option label="非官谷" :value="false" />
        </el-select>
        <el-select v-model="filters.has_main_photo" clearable placeholder="主图" @change="handleSearch">
          <el-option label="有主图" :value="true" />
          <el-option label="缺主图" :value="false" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="创建开始"
          end-placeholder="创建结束"
          clearable
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <div v-if="selectedRows.length && !isMobile" class="admin-selection-bar">
      <span class="admin-selection-bar__count">已选择 {{ selectedRows.length }} 条谷子</span>
      <el-button size="small" @click="openBulk('status')">批量改状态</el-button>
      <el-button size="small" @click="openBulk('category')">批量改品类</el-button>
      <el-button size="small" @click="openBulk('theme')">批量改主题</el-button>
      <span class="admin-selection-bar__spacer" />
      <el-button size="small" text @click="tableRef?.clearSelection()">取消选择</el-button>
    </div>

    <div v-loading="loading" class="content-body">
      <el-empty v-if="!loading && goodsList.length === 0" description="暂无匹配谷子" />
      <template v-else>
        <div class="admin-table-wrapper">
          <el-table
            ref="tableRef"
            :data="goodsList"
            row-key="id"
            @selection-change="selectedRows = $event"
            @sort-change="handleSortChange"
          >
            <el-table-column v-if="!isMobile" type="selection" width="46" />
            <el-table-column label="谷子" min-width="260">
              <template #default="{ row }">
                <div class="goods-cell">
                  <SquarePaddedImage
                    v-if="row.main_photo"
                    :src="row.main_photo"
                    :alt="row.name"
                    class="goods-cell__image"
                  />
                  <div v-else class="goods-cell__image is-placeholder">
                    <el-icon><Picture /></el-icon>
                  </div>
                  <div class="goods-cell__copy">
                    <strong>{{ row.name }}</strong>
                    <span>{{ row.ip?.name || '未关联 IP' }} · {{ characterNames(row) }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="归属用户" width="140">
              <template #default="{ row }">{{ row.user?.username || '—' }}</template>
            </el-table-column>
            <el-table-column label="品类 / 主题" min-width="170">
              <template #default="{ row }">
                <div class="stacked-cell">
                  <span>{{ row.category?.name || '—' }}</span>
                  <small>{{ row.theme?.name || '无主题' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" effect="plain" size="small">
                  {{ statusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="80" align="center" sortable="custom" />
            <el-table-column prop="price" label="单价" width="100" align="right" sortable="custom">
              <template #default="{ row }">{{ row.price ? `¥${row.price}` : '—' }}</template>
            </el-table-column>
            <el-table-column prop="updated_at" label="更新时间" width="180" sortable="custom">
              <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right" align="right">
              <template #default="{ row }">
                <div class="admin-action-inline">
                  <el-button link type="primary" @click="openDetail(row)">详情</el-button>
                  <el-button link type="primary" @click="router.push(`/admin/goods/${row.id}/edit`)">编辑</el-button>
                  <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="admin-pagination">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :page-sizes="[20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </template>
    </div>

    <el-drawer
      v-model="detailVisible"
      class="admin-detail-drawer"
      title="谷子详情"
      size="min(92vw, 600px)"
      destroy-on-close
    >
      <div v-if="selectedGoods" class="goods-detail">
        <SquarePaddedImage
          v-if="selectedGoods.main_photo"
          :src="selectedGoods.main_photo"
          :alt="selectedGoods.name"
          class="goods-detail__image"
        />
        <div v-else class="goods-detail__image is-placeholder">
          <el-icon><Picture /></el-icon>
        </div>
        <h3>{{ selectedGoods.name }}</h3>
        <dl>
          <div><dt>归属用户</dt><dd>{{ selectedGoods.user?.username || '—' }}</dd></div>
          <div><dt>IP</dt><dd>{{ selectedGoods.ip?.name || '—' }}</dd></div>
          <div><dt>角色</dt><dd>{{ characterNames(selectedGoods) }}</dd></div>
          <div><dt>品类</dt><dd>{{ selectedGoods.category?.name || '—' }}</dd></div>
          <div><dt>主题</dt><dd>{{ selectedGoods.theme?.name || '—' }}</dd></div>
          <div><dt>状态</dt><dd>{{ statusLabel(selectedGoods.status) }}</dd></div>
          <div><dt>数量</dt><dd>{{ selectedGoods.quantity }}</dd></div>
          <div><dt>单价</dt><dd>{{ selectedGoods.price ? `¥${selectedGoods.price}` : '—' }}</dd></div>
          <div><dt>入手日期</dt><dd>{{ selectedGoods.purchase_date || '—' }}</dd></div>
          <div><dt>位置</dt><dd>{{ selectedGoods.location_path || '未设置' }}</dd></div>
          <div><dt>创建时间</dt><dd>{{ formatDateTime(selectedGoods.created_at) }}</dd></div>
          <div><dt>更新时间</dt><dd>{{ formatDateTime(selectedGoods.updated_at) }}</dd></div>
        </dl>
      </div>
    </el-drawer>

    <el-dialog
      v-model="bulkVisible"
      :title="bulkTitle"
      width="min(92vw, 440px)"
      align-center
    >
      <el-select v-model="bulkValue" :placeholder="bulkPlaceholder" style="width: 100%">
        <template v-if="bulkAction === 'status'">
          <el-option label="草稿" value="draft" />
          <el-option label="意向入手" value="intended" />
          <el-option label="在馆" value="in_cabinet" />
          <el-option label="出街中" value="outdoor" />
          <el-option label="已售出" value="sold" />
        </template>
        <template v-else-if="bulkAction === 'category'">
          <el-option
            v-for="category in flatCategories"
            :key="category.id"
            :label="category.path_name || category.name"
            :value="category.id"
          />
        </template>
        <template v-else>
          <el-option label="清除主题" :value="null" />
          <el-option
            v-for="theme in themeOptions"
            :key="theme.id"
            :label="theme.name"
            :value="theme.id"
          />
        </template>
      </el-select>
      <template #footer>
        <el-button @click="bulkVisible = false">取消</el-button>
        <el-button type="primary" :loading="bulkSubmitting" @click="submitBulk">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { TableInstance } from 'element-plus'
import { Download, Picture, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  bulkAdminGoods,
  exportAdminResource,
  getAdminGoods,
  getAdminIPs,
  getAdminThemes,
  getAdminUsers,
  type AdminGoodsListParams,
  type AdminIPListParams,
  type AdminThemeListParams,
} from '@/api/admin'
import { deleteGoods, getGoodsDetail } from '@/api/goods'
import { getCategoryTree } from '@/api/metadata'
import type {
  AdminGoodsListItem,
  AdminIPListItem,
  AdminThemeListItem,
  AdminUser,
  Category,
  GoodsDetail,
  GoodsStatus,
} from '@/api/types'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { createLatestRequestGuard } from '@/composables/useLatestRequest'
import { downloadBlob } from '@/utils/download'
import { formatDateTime } from '@/utils/datetime'
import AdminPageHeader from './components/AdminPageHeader.vue'
import SquarePaddedImage from '@/components/SquarePaddedImage.vue'

const router = useRouter()
const route = useRoute()
const { isMobile } = useResponsiveDevice()
const loading = ref(false)
const exporting = ref(false)
const goodsList = ref<AdminGoodsListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const ordering = ref<string>()
const dateRange = ref<[string, string] | null>(null)
const selectedRows = ref<AdminGoodsListItem[]>([])
const tableRef = ref<TableInstance>()
const detailVisible = ref(false)
const selectedGoods = ref<GoodsDetail | null>(null)
const goodsListRequests = createLatestRequestGuard()
const userOptions = ref<AdminUser[]>([])
const ipOptions = ref<AdminIPListItem[]>([])
const themeOptions = ref<AdminThemeListItem[]>([])
const categories = ref<Category[]>([])
const bulkVisible = ref(false)
const bulkSubmitting = ref(false)
const bulkAction = ref<'status' | 'category' | 'theme'>('status')
const bulkValue = ref<string | number | null | undefined>(null)

const filters = reactive<AdminGoodsListParams>({
  search: '',
  user: undefined,
  ip: undefined,
  category: undefined,
  theme: undefined,
  status: undefined,
  is_official: undefined,
  has_main_photo: undefined,
})

const requestParams = computed<AdminGoodsListParams>(() => ({
  ...filters,
  page: page.value,
  page_size: pageSize.value,
  ordering: ordering.value,
  search: filters.search || undefined,
  created_at__gte: dateRange.value?.[0] ? `${dateRange.value[0]}T00:00:00+08:00` : undefined,
  created_at__lte: dateRange.value?.[1] ? `${dateRange.value[1]}T23:59:59+08:00` : undefined,
}))

const flatCategories = computed(() => {
  const result: Category[] = []
  const walk = (nodes: Category[]) => {
    for (const node of nodes) {
      result.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(categories.value)
  return result
})

const bulkTitle = computed(() => ({
  status: '批量修改状态',
  category: '批量修改品类',
  theme: '批量修改主题',
}[bulkAction.value]))
const bulkPlaceholder = computed(() => ({
  status: '选择新状态',
  category: '选择新品类',
  theme: '选择主题或清除',
}[bulkAction.value]))

async function loadGoods() {
  const requestSequence = goodsListRequests.next()
  loading.value = true
  try {
    const response = await getAdminGoods(requestParams.value)
    if (!goodsListRequests.isLatest(requestSequence)) return
    goodsList.value = response.results
    total.value = response.count
  } finally {
    if (goodsListRequests.isLatest(requestSequence)) loading.value = false
  }
}

async function loadCategories() {
  categories.value = await getCategoryTree()
}

async function searchUsers(query: string) {
  userOptions.value = (await getAdminUsers({ search: query || undefined, page_size: 50 })).results
}

async function searchIPs(query: string) {
  const params: AdminIPListParams = { search: query || undefined, page_size: 50 }
  ipOptions.value = (await getAdminIPs(params)).results
}

async function searchThemes(query: string) {
  const params: AdminThemeListParams = { search: query || undefined, page_size: 50 }
  themeOptions.value = (await getAdminThemes(params)).results
}

function handleSearch() {
  page.value = 1
  syncQuery()
  void loadGoods()
}

function handleSizeChange() {
  page.value = 1
  syncQuery()
  void loadGoods()
}

function handlePageChange() {
  syncQuery()
  void loadGoods()
}

function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  ordering.value = order ? `${order === 'ascending' ? '' : '-'}${prop}` : undefined
  handleSearch()
}

function resetFilters() {
  Object.assign(filters, {
    search: '',
    user: undefined,
    ip: undefined,
    category: undefined,
    theme: undefined,
    status: undefined,
    is_official: undefined,
    has_main_photo: undefined,
  })
  dateRange.value = null
  ordering.value = undefined
  handleSearch()
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (filters.search) query.search = filters.search
  if (filters.user) query.user = String(filters.user)
  if (filters.ip) query.ip = String(filters.ip)
  if (filters.category) query.category = String(filters.category)
  if (filters.theme) query.theme = String(filters.theme)
  if (filters.status) query.status = filters.status
  if (filters.is_official !== undefined) query.is_official = String(filters.is_official)
  if (filters.has_main_photo !== undefined) {
    query.has_main_photo = String(filters.has_main_photo)
  }
  if (dateRange.value?.[0]) query.created_at__gte = dateRange.value[0]
  if (dateRange.value?.[1]) query.created_at__lte = dateRange.value[1]
  if (page.value > 1) query.page = String(page.value)
  if (ordering.value) query.ordering = ordering.value
  void router.replace({
    query,
  })
}

function hydrateFromQuery() {
  const query = route.query
  filters.search = typeof query.search === 'string' ? query.search : ''
  filters.user = query.user ? Number(query.user) : undefined
  filters.ip = query.ip ? Number(query.ip) : undefined
  filters.category = query.category ? Number(query.category) : undefined
  filters.theme = query.theme ? Number(query.theme) : undefined
  filters.status = typeof query.status === 'string' ? query.status : undefined
  filters.is_official =
    query.is_official === 'true' ? true : query.is_official === 'false' ? false : undefined
  filters.has_main_photo =
    query.has_main_photo === 'true' ? true : query.has_main_photo === 'false' ? false : undefined
  if (typeof query.created_at__gte === 'string' && typeof query.created_at__lte === 'string') {
    dateRange.value = [query.created_at__gte, query.created_at__lte]
  }
  page.value = Number(query.page) > 1 ? Number(query.page) : 1
  ordering.value = typeof query.ordering === 'string' ? query.ordering : undefined
}

async function openDetail(row: AdminGoodsListItem) {
  selectedGoods.value = await getGoodsDetail(row.id)
  detailVisible.value = true
}

async function handleDelete(row: AdminGoodsListItem) {
  await ElMessageBox.confirm(
    `确定删除谷子“${row.name}”吗？此操作不可恢复。`,
    '删除谷子',
    { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' },
  )
  await deleteGoods(row.id)
  ElMessage.success('谷子已删除')
  await loadGoods()
}

function openBulk(action: 'status' | 'category' | 'theme') {
  bulkAction.value = action
  bulkValue.value = action === 'theme' ? null : undefined
  bulkVisible.value = true
}

async function submitBulk() {
  if (bulkValue.value === undefined) {
    ElMessage.warning('请选择要应用的值')
    return
  }
  bulkSubmitting.value = true
  try {
    await bulkAdminGoods(
      selectedRows.value.map((row) => row.id),
      bulkAction.value,
      bulkValue.value,
    )
    ElMessage.success(`已更新 ${selectedRows.value.length} 条谷子`)
    bulkVisible.value = false
    tableRef.value?.clearSelection()
    await loadGoods()
  } finally {
    bulkSubmitting.value = false
  }
}

async function handleExport() {
  exporting.value = true
  try {
    const blob = await exportAdminResource('goods', requestParams.value)
    downloadBlob(blob, `admin-goods-${Date.now()}.csv`)
    ElMessage.success('导出已开始')
  } finally {
    exporting.value = false
  }
}

function characterNames(row: AdminGoodsListItem | GoodsDetail) {
  return row.characters?.length ? row.characters.map((item) => item.name).join('、') : '无角色'
}

function statusLabel(status: GoodsStatus) {
  return {
    draft: '草稿',
    intended: '意向入手',
    in_cabinet: '在馆',
    outdoor: '出街中',
    sold: '已售出',
  }[status] || status
}

function statusType(status: GoodsStatus): 'success' | 'warning' | 'info' {
  if (status === 'in_cabinet') return 'success'
  if (status === 'intended' || status === 'outdoor') return 'warning'
  return 'info'
}

watch(dateRange, handleSearch)
onMounted(() => {
  hydrateFromQuery()
  void Promise.all([
    loadGoods(),
    loadCategories(),
    searchUsers(''),
    searchIPs(''),
    searchThemes(''),
  ])
})
</script>

<style scoped>
.search-input {
  width: min(290px, 100%);
}

.admin-search-flex :deep(.el-select) {
  width: 138px;
}

.admin-search-flex :deep(.el-date-editor) {
  width: 240px;
}

.content-body {
  min-height: 320px;
}

.goods-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.goods-cell__image {
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 7px;
}

.goods-cell__image.is-placeholder,
.goods-detail__image.is-placeholder {
  display: grid;
  place-items: center;
  background: #f2f3f5;
  color: #a8afba;
}

.goods-cell__copy,
.stacked-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.goods-cell__copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-cell__copy span,
.stacked-cell small {
  overflow: hidden;
  color: #9099a6;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-detail {
  padding: 20px;
}

.goods-detail__image {
  width: 100%;
  height: 260px;
  border-radius: 10px;
  object-fit: contain;
  background: #f7f8fa;
}

.goods-detail h3 {
  margin: 16px 0;
  font-size: 20px;
}

.goods-detail dl {
  display: flex;
  margin: 0;
  flex-direction: column;
}

.goods-detail dl > div {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 12px;
  border-bottom: 1px solid #eef0f3;
  padding: 11px 0;
}

.goods-detail dt {
  color: #9099a6;
  font-size: 12px;
}

.goods-detail dd {
  min-width: 0;
  margin: 0;
  color: #303846;
  font-size: 13px;
  word-break: break-word;
}

@media (max-width: 768px) {
  .admin-search-flex :deep(.el-select),
  .admin-search-flex :deep(.el-date-editor),
  .search-input {
    width: 100%;
  }
}
</style>
