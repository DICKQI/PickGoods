<template>
  <div class="admin-page">
    <AdminPageHeader title="用户管理" subtitle="管理系统用户账号与角色">
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        <span>新增用户</span>
      </el-button>
    </AdminPageHeader>

    <el-card class="admin-search-card" shadow="never">
      <div class="admin-search-flex">
        <el-input
          v-model="searchText"
          placeholder="搜索用户名..."
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
          class="custom-search"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
      </div>
    </el-card>

    <div v-loading="loading" class="content-body">
      <el-empty v-if="!loading && users.length === 0" description="暂无用户数据" />
      <template v-else>
        <div class="admin-table-wrapper">
          <el-table :data="users" style="width: 100%">
            <el-table-column prop="id" label="ID" width="80" align="center" />
            <el-table-column prop="username" label="用户名" min-width="150">
              <template #default="{ row }">
                <div class="username-cell">
                  <el-icon class="user-icon"><User /></el-icon>
                  <span>{{ row.username }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="role" label="角色" width="120" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="row.role?.name === 'Admin' ? 'danger' : 'info'"
                  effect="plain"
                  size="small"
                >
                  {{ row.role?.name === 'Admin' ? '管理员' : '普通用户' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="is_active" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="row.is_active ? 'success' : 'info'"
                  effect="plain"
                  size="small"
                >
                  {{ row.is_active ? '正常' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="right" fixed="right">
              <template #default="{ row }">
                <div class="admin-action-inline">
                  <el-button link type="primary" @click="handleEdit(row)" title="编辑">
                    <el-icon :size="16"><Edit /></el-icon>
                  </el-button>
                  <el-button
                    link
                    :type="row.is_active ? 'warning' : 'success'"
                    @click="handleToggleActive(row)"
                    :title="row.is_active ? '停用' : '启用'"
                  >
                    <el-icon :size="16">
                      <CircleClose v-if="row.is_active" />
                      <CircleCheck v-else />
                    </el-icon>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="450px" align-center>
      <el-form :model="formData" :rules="formRules" ref="formRef" label-position="top">
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="formData.username"
            placeholder="请输入用户名"
            :disabled="isEdit"
            maxlength="150"
          />
        </el-form-item>

        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input
            v-model="formData.password"
            type="password"
            placeholder="请输入密码（至少6位）"
            show-password
            maxlength="128"
          />
        </el-form-item>

        <el-form-item v-if="isEdit" label="新密码（留空则不修改）" prop="password">
          <el-input
            v-model="formData.password"
            type="password"
            placeholder="留空则不修改密码"
            show-password
            maxlength="128"
          />
        </el-form-item>

        <el-form-item label="角色" prop="role_id">
          <el-select v-model="formData.role_id" placeholder="请选择角色" style="width: 100%">
            <el-option
              v-for="role in roles"
              :key="role.id"
              :label="role.name === 'Admin' ? '管理员' : '普通用户'"
              :value="role.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-if="isEdit" label="账号状态">
          <el-switch
            v-model="formData.is_active"
            active-text="正常"
            inactive-text="停用"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ isEdit ? '保存更改' : '创建用户' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Search, User, Edit, CircleClose, CircleCheck } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  getAdminRoles,
  type AdminUser,
  type AdminRole,
} from '@/api/admin'
import AdminPageHeader from './components/AdminPageHeader.vue'
import { formatDateTime } from '@/utils/datetime'

const loading = ref(false)
const submitting = ref(false)
const searchText = ref('')
const users = ref<AdminUser[]>([])
const roles = ref<AdminRole[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const formData = ref({
  username: '',
  password: '',
  role_id: null as number | null,
  is_active: true,
})

const dialogTitle = computed(() => (isEdit.value ? '编辑用户' : '新增用户'))

const formRules = computed<FormRules>(() => ({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 1, max: 150, message: '用户名长度为1-150个字符', trigger: 'blur' },
  ],
  password: [
    { required: !isEdit.value, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 128, message: '密码长度为6-128个字符', trigger: 'blur' },
  ],
  role_id: [{ required: true, message: '请选择角色', trigger: 'change' }],
}))

const fetchUsers = async () => {
  loading.value = true
  try {
    const response = await getAdminUsers({
      page: currentPage.value,
      page_size: pageSize.value,
      search: searchText.value || undefined,
    })
    users.value = response.results
    total.value = response.count
  } catch (err: any) {
    ElMessage.error(err.message || '获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const fetchRoles = async () => {
  try {
    roles.value = await getAdminRoles()
  } catch (err: any) {
    ElMessage.error(err.message || '获取角色列表失败')
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchUsers()
}

const handleSizeChange = () => {
  currentPage.value = 1
  fetchUsers()
}

const handlePageChange = () => {
  fetchUsers()
}

const handleAdd = () => {
  isEdit.value = false
  editingId.value = null
  formData.value = {
    username: '',
    password: '',
    role_id: roles.value.find((r) => r.name === 'User')?.id || null,
    is_active: true,
  }
  dialogVisible.value = true
}

const handleEdit = (row: AdminUser) => {
  isEdit.value = true
  editingId.value = row.id
  formData.value = {
    username: row.username,
    password: '',
    role_id: row.role?.id || null,
    is_active: row.is_active,
  }
  dialogVisible.value = true
}

const handleToggleActive = async (row: AdminUser) => {
  const action = row.is_active ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}用户「${row.username}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await updateAdminUser(row.id, { is_active: !row.is_active })
    ElMessage.success(`已${action}`)
    fetchUsers()
  } catch {}
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      if (isEdit.value && editingId.value) {
        const updateData: Record<string, any> = {
          role_id: formData.value.role_id,
          is_active: formData.value.is_active,
        }
        if (formData.value.password) {
          updateData.password = formData.value.password
        }
        await updateAdminUser(editingId.value, updateData)
        ElMessage.success('用户已更新')
      } else {
        await createAdminUser({
          username: formData.value.username,
          password: formData.value.password,
          role_id: formData.value.role_id!,
        })
        ElMessage.success('用户已创建')
      }
      dialogVisible.value = false
      fetchUsers()
    } catch (err: any) {
      ElMessage.error(err.message || '操作失败')
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  fetchRoles()
  fetchUsers()
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

.username-cell {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.user-icon {
  color: var(--accent-purple);
}

@media (max-width: 768px) {
  .custom-search {
    max-width: none;
  }
}
</style>
