<template>
  <div class="admin-page">
    <AdminPageHeader title="谷子工艺" subtitle="维护谷子表单备注中的快捷工艺选项。">
      <el-button :loading="exporting" @click="handleExport">
        <el-icon><Download /></el-icon>
        导出
      </el-button>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增工艺
      </el-button>
    </AdminPageHeader>

    <el-card class="admin-search-card" shadow="never">
      <div class="admin-search-flex">
        <el-input
          v-model="filters.search"
          class="search-input"
          clearable
          placeholder="搜索工艺名称"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filters.is_active" clearable placeholder="状态" @change="handleSearch">
          <el-option label="启用" :value="true" />
          <el-option label="停用" :value="false" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <div v-if="selectedRows.length && !isMobile" class="admin-selection-bar">
      <span class="admin-selection-bar__count">已选择 {{ selectedRows.length }} 个工艺</span>
      <el-button size="small" @click="handleBulk('enable')">批量启用</el-button>
      <el-button size="small" type="warning" plain @click="handleBulk('disable')">批量停用</el-button>
      <span class="admin-selection-bar__spacer" />
      <el-button size="small" text @click="tableRef?.clearSelection()">取消选择</el-button>
    </div>

    <div v-loading="loading" class="content-body">
      <el-empty v-if="!loading && crafts.length === 0" description="暂无匹配工艺" />
      <template v-else>
        <div class="admin-table-wrapper">
          <el-table
            ref="tableRef"
            :data="crafts"
            row-key="id"
            @selection-change="selectedRows = $event"
            @sort-change="handleSortChange"
          >
            <el-table-column v-if="!isMobile" type="selection" width="46" />
            <el-table-column prop="name" label="工艺名称" min-width="220" sortable="custom" />
            <el-table-column prop="order" label="排序" width="100" sortable="custom" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'" effect="plain" size="small">
                  {{ row.is_active ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="updated_at" label="更新时间" width="180" sortable="custom">
              <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right" align="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
                <el-button link :type="row.is_active ? 'warning' : 'success'" @click="toggleActive(row)">
                  {{ row.is_active ? '停用' : '启用' }}
                </el-button>
                <el-button link type="danger" @click="removeCraft(row)">删除</el-button>
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
            @current-change="loadCrafts"
          />
        </div>
      </template>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑工艺' : '新增工艺'"
      width="min(92vw, 460px)"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-position="top">
        <el-form-item label="工艺名称" prop="name">
          <el-input v-model="form.name" maxlength="100" />
        </el-form-item>
        <el-form-item label="排序值">
          <el-input-number v-model="form.order" :step="10" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.is_active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveCraft">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules, TableInstance } from 'element-plus'
import { Download, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  bulkAdminGoodsCrafts,
  createAdminGoodsCraft,
  deleteAdminGoodsCraft,
  exportAdminResource,
  getAdminGoodsCrafts,
  updateAdminGoodsCraft,
  type AdminGoodsCraftListParams,
  type GoodsCraft,
} from '@/api/admin'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { downloadBlob } from '@/utils/download'
import { formatDateTime } from '@/utils/datetime'
import { createLatestRequestGuard } from '@/composables/useLatestRequest'
import AdminPageHeader from './components/AdminPageHeader.vue'

const { isMobile } = useResponsiveDevice()
const loading = ref(false)
const exporting = ref(false)
const submitting = ref(false)
const crafts = ref<GoodsCraft[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const ordering = ref<string>()
const selectedRows = ref<GoodsCraft[]>([])
const craftListRequests = createLatestRequestGuard()
const tableRef = ref<TableInstance>()
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const filters = reactive<AdminGoodsCraftListParams>({
  search: '',
  is_active: undefined,
})
const form = reactive<{
  id?: number
  name: string
  order: number
  is_active: boolean
}>({
  name: '',
  order: 0,
  is_active: true,
})
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入工艺名称', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        callback(value?.trim() ? undefined : new Error('请输入工艺名称'))
      },
      trigger: 'blur',
    },
  ],
}

async function loadCrafts() {
  const requestSequence = craftListRequests.next()
  loading.value = true
  try {
    const params: AdminGoodsCraftListParams = {
      page: page.value,
      page_size: pageSize.value,
      search: filters.search || undefined,
    }
    if (filters.is_active !== undefined) params.is_active = filters.is_active
    if (ordering.value) params.ordering = ordering.value
    const response = await getAdminGoodsCrafts(params)
    if (!craftListRequests.isLatest(requestSequence)) return
    crafts.value = response.results
    total.value = response.count
  } finally {
    if (craftListRequests.isLatest(requestSequence)) loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  void loadCrafts()
}

function handleSizeChange() {
  page.value = 1
  void loadCrafts()
}

function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  ordering.value = order ? `${order === 'ascending' ? '' : '-'}${prop}` : undefined
  handleSearch()
}

function resetFilters() {
  filters.search = ''
  filters.is_active = undefined
  ordering.value = undefined
  handleSearch()
}

function openDialog(row?: GoodsCraft) {
  Object.assign(form, row
    ? { id: row.id, name: row.name, order: row.order, is_active: row.is_active }
    : { id: undefined, name: '', order: 0, is_active: true })
  dialogVisible.value = true
}

async function saveCraft() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload = {
      name: form.name.trim(),
      order: form.order,
      is_active: form.is_active,
    }
    if (form.id) await updateAdminGoodsCraft(form.id, payload)
    else await createAdminGoodsCraft(payload)
    dialogVisible.value = false
    ElMessage.success('工艺已保存')
    await loadCrafts()
  } finally {
    submitting.value = false
  }
}

async function toggleActive(row: GoodsCraft) {
  await updateAdminGoodsCraft(row.id, { is_active: !row.is_active })
  ElMessage.success(row.is_active ? '工艺已停用' : '工艺已启用')
  await loadCrafts()
}

async function removeCraft(row: GoodsCraft) {
  await ElMessageBox.confirm(`确认删除工艺“${row.name}”吗？`, '删除工艺', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
  await deleteAdminGoodsCraft(row.id)
  ElMessage.success('工艺已删除')
  await loadCrafts()
}

async function handleBulk(action: 'enable' | 'disable') {
  const label = action === 'enable' ? '启用' : '停用'
  await ElMessageBox.confirm(
    `确认批量${label} ${selectedRows.value.length} 个工艺吗？`,
    '批量操作',
    { confirmButtonText: label, cancelButtonText: '取消', type: 'warning' },
  )
  await bulkAdminGoodsCrafts(selectedRows.value.map((row) => row.id), action)
  tableRef.value?.clearSelection()
  await loadCrafts()
}

async function handleExport() {
  exporting.value = true
  try {
    const blob = await exportAdminResource('goods-crafts', {
      search: filters.search || undefined,
      is_active: filters.is_active,
      ordering: ordering.value,
    })
    downloadBlob(blob, `admin-goods-crafts-${Date.now()}.csv`)
    ElMessage.success('导出已开始')
  } finally {
    exporting.value = false
  }
}

onMounted(loadCrafts)
</script>

<style scoped>
.search-input {
  width: min(280px, 100%);
}

.admin-search-flex :deep(.el-select) {
  width: 140px;
}

.content-body {
  min-height: 320px;
}

@media (max-width: 768px) {
  .search-input,
  .admin-search-flex :deep(.el-select) {
    width: 100%;
  }
}
</style>
