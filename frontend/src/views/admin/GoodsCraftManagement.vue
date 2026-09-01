<template>
  <div class="admin-page">
    <AdminPageHeader title="谷子工艺" subtitle="整理前台备注可以快速填入的工艺选项~">
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        <span>新增工艺</span>
      </el-button>
    </AdminPageHeader>

    <el-card class="admin-search-card" shadow="never">
      <div class="admin-search-flex">
        <el-input
          v-model="searchText"
          placeholder="搜索工艺名称..."
          clearable
          class="custom-search"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="fetchCrafts">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </el-card>

    <div v-loading="loading" class="content-body">
      <el-empty v-if="!loading && crafts.length === 0" description="暂无谷子工艺" />
      <template v-else>
        <div class="admin-table-wrapper">
          <el-table :data="crafts" style="width: 100%">
            <el-table-column prop="name" label="名称" min-width="180" />
            <el-table-column prop="order" label="排序" width="100" align="center" />
            <el-table-column prop="is_active" label="状态" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'" effect="plain" size="small">
                  {{ row.is_active ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="190" align="right" fixed="right">
              <template #default="{ row }">
                <div class="admin-action-inline">
                  <el-button link type="primary" title="编辑" @click="handleEdit(row)">
                    <el-icon :size="16"><Edit /></el-icon>
                  </el-button>
                  <el-button
                    link
                    :type="row.is_active ? 'warning' : 'success'"
                    :title="row.is_active ? '停用' : '启用'"
                    @click="handleToggleActive(row)"
                  >
                    <el-icon :size="16">
                      <CircleClose v-if="row.is_active" />
                      <CircleCheck v-else />
                    </el-icon>
                  </el-button>
                  <el-button link type="danger" title="删除" @click="handleDelete(row)">
                    <el-icon :size="16"><Delete /></el-icon>
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="total > 0" class="admin-pagination">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </template>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="420px" align-center>
      <el-form ref="formRef" :model="formData" :rules="formRules" label-position="top">
        <el-form-item label="工艺名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入工艺名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="排序" prop="order">
          <el-input-number v-model="formData.order" :min="0" :step="10" style="width: 100%" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="formData.is_active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存更改' : '创建工艺' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CircleCheck, CircleClose, Delete, Edit, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  createAdminGoodsCraft,
  deleteAdminGoodsCraft,
  getAdminGoodsCrafts,
  updateAdminGoodsCraft,
  type GoodsCraft,
} from '@/api/admin'
import AdminPageHeader from './components/AdminPageHeader.vue'
import { formatDateTime } from '@/utils/datetime'

const loading = ref(false)
const submitting = ref(false)
const searchText = ref('')
const crafts = ref<GoodsCraft[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const formData = ref({
  name: '',
  order: 0,
  is_active: true,
})

const dialogTitle = computed(() => (isEdit.value ? '编辑工艺' : '新增工艺'))

const validateCraftName = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value?.trim()) {
    callback(new Error('请输入工艺名称'))
    return
  }
  callback()
}

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入工艺名称', trigger: 'blur' },
    { validator: validateCraftName, trigger: 'blur' },
    { min: 1, max: 100, message: '工艺名称长度为 1-100 个字符', trigger: 'blur' },
  ],
}

const fetchCrafts = async () => {
  loading.value = true
  try {
    const response = await getAdminGoodsCrafts({
      page: currentPage.value,
      page_size: pageSize.value,
      search: searchText.value || undefined,
    })
    crafts.value = response.results
    total.value = response.count
  } catch (err: any) {
    ElMessage.error(err.message || '获取谷子工艺失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  void fetchCrafts()
}

const handleSizeChange = () => {
  currentPage.value = 1
  void fetchCrafts()
}

const handlePageChange = () => {
  void fetchCrafts()
}

const handleAdd = () => {
  isEdit.value = false
  editingId.value = null
  formData.value = {
    name: '',
    order: 0,
    is_active: true,
  }
  dialogVisible.value = true
}

const handleEdit = (row: GoodsCraft) => {
  isEdit.value = true
  editingId.value = row.id
  formData.value = {
    name: row.name,
    order: row.order,
    is_active: row.is_active,
  }
  dialogVisible.value = true
}

const handleToggleActive = async (row: GoodsCraft) => {
  const action = row.is_active ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}工艺“${row.name}”吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await updateAdminGoodsCraft(row.id, { is_active: !row.is_active })
    ElMessage.success(`已${action}`)
    await fetchCrafts()
  } catch {}
}

const handleDelete = async (row: GoodsCraft) => {
  try {
    await ElMessageBox.confirm(`确定要删除工艺“${row.name}”吗？`, '删除工艺', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteAdminGoodsCraft(row.id)
    ElMessage.success('工艺已删除')
    await fetchCrafts()
  } catch {}
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = {
      name: formData.value.name.trim(),
      order: formData.value.order,
      is_active: formData.value.is_active,
    }
    if (isEdit.value && editingId.value) {
      await updateAdminGoodsCraft(editingId.value, payload)
      ElMessage.success('工艺已更新')
    } else {
      await createAdminGoodsCraft(payload)
      ElMessage.success('工艺已创建')
    }
    dialogVisible.value = false
    await fetchCrafts()
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void fetchCrafts()
})
</script>

<style scoped>
.content-body {
  min-height: 200px;
}

.custom-search {
  flex: 1;
  max-width: 300px;
}

@media (max-width: 768px) {
  .custom-search {
    max-width: none;
  }
}
</style>
