<template>
  <div class="admin-page">
    <AdminPageHeader title="主题管理" subtitle="按用户管理主题、默认模板和素材规模。">
      <el-button :loading="exporting" @click="handleExport">
        <el-icon><Download /></el-icon>
        导出
      </el-button>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增主题
      </el-button>
    </AdminPageHeader>

    <el-card class="admin-search-card" shadow="never">
      <div class="admin-search-flex">
        <el-input
          v-model="filters.search"
          class="search-input"
          clearable
          placeholder="搜索主题、描述或归属用户"
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

    <div v-loading="loading" class="content-body">
      <el-empty v-if="!loading && themes.length === 0" description="暂无匹配主题" />
      <template v-else>
        <div class="admin-table-wrapper">
          <el-table :data="themes" row-key="id" @sort-change="handleSortChange">
            <el-table-column prop="name" label="主题" min-width="200" sortable="custom">
              <template #default="{ row }">
                <div class="theme-cell">
                  <span class="theme-cell__icon"><el-icon><Brush /></el-icon></span>
                  <div>
                    <strong>{{ row.name }}</strong>
                    <small>{{ row.description || '暂无描述' }}</small>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="归属用户" width="140">
              <template #default="{ row }">{{ row.user?.username || '—' }}</template>
            </el-table-column>
            <el-table-column prop="goods_count" label="谷子数" width="100" align="center" sortable="custom" />
            <el-table-column prop="image_count" label="图片数" width="100" align="center" sortable="custom" />
            <el-table-column label="默认模板" width="110">
              <template #default="{ row }">
                <el-tag :type="row.has_template ? 'success' : 'info'" effect="plain" size="small">
                  {{ row.has_template ? '已配置' : '无' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180" sortable="custom">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right" align="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDetail(row)">详情</el-button>
                <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="removeTheme(row)">删除</el-button>
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
            @current-change="loadThemes"
          />
        </div>
      </template>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑主题' : '新增主题'"
      width="min(92vw, 560px)"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="主题名称" prop="name">
          <el-input v-model="form.name" maxlength="100" />
        </el-form-item>
        <el-form-item label="归属用户" prop="user_id">
          <el-select
            v-model="form.user_id"
            filterable
            remote
            :disabled="Boolean(form.id)"
            :remote-method="searchUsers"
            :placeholder="form.id ? '创建后不可修改归属' : '搜索并选择用户'"
            style="width: 100%"
          >
            <el-option
              v-for="user in userOptions"
              :key="user.id"
              :label="user.username"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="6" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveTheme">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailVisible"
      class="admin-detail-drawer"
      title="主题详情"
      size="min(92vw, 600px)"
      destroy-on-close
    >
      <div v-if="selectedTheme" class="theme-detail">
        <h3>{{ selectedTheme.name }}</h3>
        <p class="theme-detail__description">{{ selectedTheme.description || '暂无描述' }}</p>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="归属用户">{{ selectedTheme.user?.username || '—' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDateTime(selectedTheme.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="默认模板">
            {{ selectedTheme.template?.name || '未配置' }}
          </el-descriptions-item>
          <el-descriptions-item label="图片数量">{{ selectedTheme.images?.length || 0 }}</el-descriptions-item>
        </el-descriptions>
        <section v-if="selectedTheme.images?.length" class="theme-detail__images">
          <h4>主题素材</h4>
          <div class="theme-image-grid">
            <img
              v-for="image in selectedTheme.images"
              :key="image.id"
              :src="image.image"
              :alt="image.label || selectedTheme.name"
            />
          </div>
        </section>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { Brush, Download, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  exportAdminResource,
  getAdminThemes,
  getAdminUsers,
  type AdminThemeListParams,
} from '@/api/admin'
import {
  createTheme,
  deleteTheme,
  getThemeDetail,
  updateTheme,
} from '@/api/metadata'
import type { AdminThemeListItem, AdminUser } from '@/api/types'
import { downloadBlob } from '@/utils/download'
import { formatDateTime } from '@/utils/datetime'
import { createLatestRequestGuard } from '@/composables/useLatestRequest'
import AdminPageHeader from './components/AdminPageHeader.vue'

const loading = ref(false)
const exporting = ref(false)
const submitting = ref(false)
const themes = ref<AdminThemeListItem[]>([])
const userOptions = ref<AdminUser[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const ordering = ref<string>()
const dateRange = ref<[string, string] | null>(null)
const dialogVisible = ref(false)
const detailVisible = ref(false)
const selectedTheme = ref<AdminThemeListItem | null>(null)
const themeListRequests = createLatestRequestGuard()
const formRef = ref<FormInstance>()
const filters = reactive<AdminThemeListParams>({
  search: '',
  user: undefined,
})
const form = reactive<{
  id?: number
  name: string
  user_id: number | null
  description: string
}>({
  name: '',
  user_id: null,
  description: '',
})
const rules: FormRules = {
  name: [{ required: true, message: '请输入主题名称', trigger: 'blur' }],
  user_id: [{ required: true, message: '请选择归属用户', trigger: 'change' }],
}

async function loadThemes() {
  const requestSequence = themeListRequests.next()
  loading.value = true
  try {
    const response = await getAdminThemes({
      ...filters,
      page: page.value,
      page_size: pageSize.value,
      ordering: ordering.value,
      search: filters.search || undefined,
      created_at__gte: dateRange.value?.[0] ? `${dateRange.value[0]}T00:00:00+08:00` : undefined,
      created_at__lte: dateRange.value?.[1] ? `${dateRange.value[1]}T23:59:59+08:00` : undefined,
    })
    if (!themeListRequests.isLatest(requestSequence)) return
    themes.value = response.results
    total.value = response.count
  } finally {
    if (themeListRequests.isLatest(requestSequence)) loading.value = false
  }
}

async function searchUsers(query: string) {
  userOptions.value = (
    await getAdminUsers({ search: query || undefined, page_size: 50 })
  ).results
}

function handleSearch() {
  page.value = 1
  void loadThemes()
}

function handleSizeChange() {
  page.value = 1
  void loadThemes()
}

function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  ordering.value = order ? `${order === 'ascending' ? '' : '-'}${prop}` : undefined
  handleSearch()
}

function resetFilters() {
  filters.search = ''
  filters.user = undefined
  dateRange.value = null
  ordering.value = undefined
  handleSearch()
}

function openDialog(row?: AdminThemeListItem) {
  Object.assign(form, row
    ? {
        id: row.id,
        name: row.name,
        user_id: row.user?.id || null,
        description: row.description || '',
      }
    : {
        id: undefined,
        name: '',
        user_id: null,
        description: '',
      })
  dialogVisible.value = true
}

async function saveTheme() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !form.user_id) return
  submitting.value = true
  try {
    const payload: {
      name: string
      description: string
      user_id?: number
    } = {
      name: form.name.trim(),
      description: form.description,
    }
    if (!form.id) payload.user_id = form.user_id
    if (form.id) await updateTheme(form.id, payload)
    else await createTheme(payload)
    dialogVisible.value = false
    ElMessage.success('主题已保存')
    await loadThemes()
  } finally {
    submitting.value = false
  }
}

async function openDetail(row: AdminThemeListItem) {
  const detail = await getThemeDetail(row.id)
  selectedTheme.value = {
    ...row,
    ...detail,
    user: row.user,
    goods_count: row.goods_count,
    image_count: row.image_count,
    has_template: row.has_template,
  }
  detailVisible.value = true
}

async function removeTheme(row: AdminThemeListItem) {
  await ElMessageBox.confirm(
    `删除主题“${row.name}”后关联谷子将解除主题关系，确认继续？`,
    '删除主题',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
  )
  await deleteTheme(row.id)
  ElMessage.success('主题已删除')
  await loadThemes()
}

async function handleExport() {
  exporting.value = true
  try {
    const blob = await exportAdminResource('themes', {
      ...filters,
      search: filters.search || undefined,
      created_at__gte: dateRange.value?.[0]
        ? `${dateRange.value[0]}T00:00:00+08:00`
        : undefined,
      created_at__lte: dateRange.value?.[1]
        ? `${dateRange.value[1]}T23:59:59+08:00`
        : undefined,
      ordering: ordering.value,
    })
    downloadBlob(blob, `admin-themes-${Date.now()}.csv`)
    ElMessage.success('导出已开始')
  } finally {
    exporting.value = false
  }
}

watch(dateRange, handleSearch)
onMounted(() => {
  void Promise.all([loadThemes(), searchUsers('')])
})
</script>

<style scoped>
.search-input {
  width: min(300px, 100%);
}

.admin-search-flex :deep(.el-select) {
  width: 160px;
}

.content-body {
  min-height: 320px;
}

.theme-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theme-cell__icon {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 8px;
  background: rgba(212, 175, 55, 0.12);
  color: #9d7d13;
}

.theme-cell > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.theme-cell small {
  overflow: hidden;
  color: #9099a6;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-detail {
  padding: 20px;
}

.theme-detail h3 {
  margin: 0 0 8px;
  font-size: 20px;
}

.theme-detail__description {
  margin: 0 0 18px;
  color: #606a78;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.theme-detail__images {
  margin-top: 20px;
}

.theme-detail__images h4 {
  margin: 0 0 10px;
  font-size: 14px;
}

.theme-image-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.theme-image-grid img {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  background: #f5f6f8;
  object-fit: cover;
}

@media (max-width: 768px) {
  .admin-search-flex :deep(.el-select),
  .admin-search-flex :deep(.el-date-editor),
  .search-input {
    width: 100%;
  }
}
</style>
