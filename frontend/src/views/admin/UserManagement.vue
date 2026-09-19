<template>
  <div class="admin-page">
    <AdminPageHeader title="用户管理" subtitle="管理账号状态、角色与社团审批。">
      <el-button :loading="exporting" @click="handleExport">
        <el-icon><Download /></el-icon>
        导出
      </el-button>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        新增用户
      </el-button>
    </AdminPageHeader>

    <el-card class="admin-search-card" shadow="never">
      <div class="admin-search-flex">
        <el-input
          v-model="filters.search"
          class="search-input"
          clearable
          placeholder="搜索用户名"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filters.role" clearable placeholder="账号角色" @change="handleSearch">
          <el-option
            v-for="role in roles"
            :key="role.id"
            :label="role.name"
            :value="role.id"
          />
        </el-select>
        <el-select v-model="filters.account_type" clearable placeholder="账号类型" @change="handleSearch">
          <el-option label="吃谷人" value="collector" />
          <el-option label="社团" value="club" />
        </el-select>
        <el-select v-model="filters.approval_status" clearable placeholder="审批状态" @change="handleSearch">
          <el-option label="待审批" value="pending" />
          <el-option label="已审批" value="approved" />
        </el-select>
        <el-select v-model="filters.is_active" clearable placeholder="账号状态" @change="handleSearch">
          <el-option label="正常" :value="true" />
          <el-option label="停用" :value="false" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="注册开始"
          end-placeholder="注册结束"
          clearable
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <div v-if="selectedRows.length && !isMobile" class="admin-selection-bar">
      <span class="admin-selection-bar__count">已选择 {{ selectedRows.length }} 个用户</span>
      <el-button size="small" @click="handleBulk('enable')">批量启用</el-button>
      <el-button size="small" type="warning" plain @click="handleBulk('disable')">批量停用</el-button>
      <el-button size="small" type="success" plain @click="handleBulk('approve')">批量批准社团</el-button>
      <span class="admin-selection-bar__spacer" />
      <el-button size="small" text @click="tableRef?.clearSelection()">取消选择</el-button>
    </div>

    <div v-loading="loading" class="content-body">
      <el-empty v-if="!loading && users.length === 0" description="暂无匹配用户" />
      <template v-else>
        <div class="admin-table-wrapper">
          <el-table
            ref="tableRef"
            :data="users"
            row-key="id"
            @selection-change="selectedRows = $event"
            @sort-change="handleSortChange"
          >
            <el-table-column v-if="!isMobile" type="selection" width="46" />
            <el-table-column label="用户" min-width="190">
              <template #default="{ row }">
                <div class="user-cell">
                  <span class="user-cell__avatar">{{ row.username.slice(0, 1).toUpperCase() }}</span>
                  <div>
                    <strong>{{ row.username }}</strong>
                    <small>ID {{ row.id }}</small>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="role.name" label="角色" width="100" sortable="custom">
              <template #default="{ row }">
                <el-tag :type="row.role?.name === 'Admin' ? 'danger' : 'info'" effect="plain" size="small">
                  {{ row.role?.name === 'Admin' ? '管理员' : row.role?.name }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="row.account_type === 'club' ? 'warning' : 'info'" effect="plain" size="small">
                  {{ row.account_type === 'club' ? '社团' : '吃谷人' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="审批" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.approval_status === 'pending'" type="warning" size="small">待审批</el-tag>
                <el-tag v-else type="success" effect="plain" size="small">已审批</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'" effect="plain" size="small">
                  {{ row.is_active ? '正常' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="club_name" label="社团名称" min-width="160">
              <template #default="{ row }">{{ row.club_name || '—' }}</template>
            </el-table-column>
            <el-table-column prop="created_at" label="注册时间" width="180" sortable="custom">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="190" fixed="right" align="right">
              <template #default="{ row }">
                <div class="admin-action-inline">
                  <el-button
                    v-if="row.approval_status === 'pending'"
                    link
                    type="success"
                    @click="handleApprove(row)"
                  >
                    批准
                  </el-button>
                  <el-button link type="primary" @click="openDetail(row)">详情</el-button>
                  <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
                  <el-dropdown trigger="click" @command="(command: string) => handleRowCommand(command, row)">
                    <el-button link>更多</el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="toggle">
                          {{ row.is_active ? '停用账号' : '启用账号' }}
                        </el-dropdown-item>
                        <el-dropdown-item
                          v-if="row.approval_status === 'pending'"
                          command="reject"
                          divided
                        >
                          拒绝并删除
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
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
      title="用户详情"
      size="min(92vw, 560px)"
      destroy-on-close
    >
      <div v-if="selectedUser" class="user-detail">
        <div class="user-detail__hero">
          <span>{{ selectedUser.username.slice(0, 1).toUpperCase() }}</span>
          <div>
            <h3>{{ selectedUser.username }}</h3>
            <p>账号 ID {{ selectedUser.id }}</p>
          </div>
        </div>
        <dl>
          <div><dt>角色</dt><dd>{{ selectedUser.role?.name }}</dd></div>
          <div><dt>账号类型</dt><dd>{{ selectedUser.account_type === 'club' ? '社团' : '吃谷人' }}</dd></div>
          <div><dt>审批状态</dt><dd>{{ selectedUser.approval_status === 'pending' ? '待审批' : '已审批' }}</dd></div>
          <div><dt>账号状态</dt><dd>{{ selectedUser.is_active ? '正常' : '停用' }}</dd></div>
          <div><dt>谷子数量</dt><dd>{{ selectedUser.goods_count || 0 }}</dd></div>
          <div><dt>主题数量</dt><dd>{{ selectedUser.theme_count || 0 }}</dd></div>
          <div><dt>注册时间</dt><dd>{{ formatDateTime(selectedUser.created_at) }}</dd></div>
          <div><dt>更新时间</dt><dd>{{ formatDateTime(selectedUser.updated_at) }}</dd></div>
        </dl>
        <section v-if="selectedUser.account_type === 'club'" class="club-detail">
          <h3>社团资料</h3>
          <p><strong>{{ selectedUser.club_name || '未设置名称' }}</strong></p>
          <p>{{ selectedUser.club_description || '暂无简介' }}</p>
          <dl>
            <div><dt>联系人</dt><dd>{{ selectedUser.club_contact_name || '—' }}</dd></div>
            <div><dt>电话</dt><dd>{{ selectedUser.club_contact_phone || '—' }}</dd></div>
            <div><dt>邮箱</dt><dd>{{ selectedUser.club_contact_email || '—' }}</dd></div>
            <div><dt>地址</dt><dd>{{ selectedUser.club_address || '—' }}</dd></div>
            <div><dt>申请理由</dt><dd>{{ selectedUser.application_reason || '—' }}</dd></div>
          </dl>
        </section>
      </div>
    </el-drawer>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="min(92vw, 480px)" align-center>
      <el-form ref="formRef" :model="formData" :rules="formRules" label-position="top">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="formData.username" :disabled="isEdit" maxlength="150" />
        </el-form-item>
        <el-form-item :label="isEdit ? '重置密码（留空不修改）' : '密码'" prop="password">
          <el-input v-model="formData.password" type="password" show-password maxlength="128" />
        </el-form-item>
        <el-form-item label="账号角色" prop="role_id">
          <el-select v-model="formData.role_id" style="width: 100%">
            <el-option
              v-for="role in roles"
              :key="role.id"
              :label="role.name"
              :value="role.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isEdit" label="账号状态">
          <el-switch v-model="formData.is_active" active-text="正常" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存更改' : '创建用户' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { TableInstance } from 'element-plus'
import { Download, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  approveAdminUser,
  bulkAdminUsers,
  createAdminUser,
  exportAdminResource,
  getAdminRoles,
  getAdminUserDetail,
  getAdminUsers,
  rejectAdminUser,
  updateAdminUser,
  type AdminRole,
  type AdminUser,
  type AdminUserListParams,
} from '@/api/admin'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { createLatestRequestGuard } from '@/composables/useLatestRequest'
import { downloadBlob } from '@/utils/download'
import { formatDateTime } from '@/utils/datetime'
import AdminPageHeader from './components/AdminPageHeader.vue'

const { isMobile } = useResponsiveDevice()
const route = useRoute()
const router = useRouter()
const loading = ref(false)
const exporting = ref(false)
const submitting = ref(false)
const users = ref<AdminUser[]>([])
const roles = ref<AdminRole[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const ordering = ref<string>()
const dateRange = ref<[string, string] | null>(null)
const selectedRows = ref<AdminUser[]>([])
const tableRef = ref<TableInstance>()
const detailVisible = ref(false)
const selectedUser = ref<AdminUser | null>(null)
const userListRequests = createLatestRequestGuard()
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const filters = reactive<AdminUserListParams>({
  search: '',
  role: undefined,
  account_type: undefined,
  approval_status: undefined,
  is_active: undefined,
})
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
    { max: 150, message: '用户名最长 150 个字符', trigger: 'blur' },
  ],
  password: [
    { required: !isEdit.value, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 128, message: '密码长度为 6-128 个字符', trigger: 'blur' },
  ],
  role_id: [{ required: true, message: '请选择账号角色', trigger: 'change' }],
}))

const requestParams = computed<AdminUserListParams>(() => ({
  ...filters,
  page: page.value,
  page_size: pageSize.value,
  ordering: ordering.value,
  search: filters.search || undefined,
  created_at__gte: dateRange.value?.[0] ? `${dateRange.value[0]}T00:00:00+08:00` : undefined,
  created_at__lte: dateRange.value?.[1] ? `${dateRange.value[1]}T23:59:59+08:00` : undefined,
}))

async function loadUsers() {
  const requestSequence = userListRequests.next()
  loading.value = true
  try {
    const response = await getAdminUsers(requestParams.value)
    if (!userListRequests.isLatest(requestSequence)) return
    users.value = response.results
    total.value = response.count
  } finally {
    if (userListRequests.isLatest(requestSequence)) loading.value = false
  }
}

async function loadRoles() {
  roles.value = await getAdminRoles()
}

function handleSearch() {
  page.value = 1
  syncQuery()
  void loadUsers()
}

function handleSizeChange() {
  page.value = 1
  syncQuery()
  void loadUsers()
}

function handlePageChange() {
  syncQuery()
  void loadUsers()
}

function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  const mapping: Record<string, string> = {
    'role.name': 'role__name',
    created_at: 'created_at',
  }
  ordering.value = order ? `${order === 'ascending' ? '' : '-'}${mapping[prop] || prop}` : undefined
  handleSearch()
}

function resetFilters() {
  Object.assign(filters, {
    search: '',
    role: undefined,
    account_type: undefined,
    approval_status: undefined,
    is_active: undefined,
  })
  dateRange.value = null
  ordering.value = undefined
  handleSearch()
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (filters.search) query.search = filters.search
  if (filters.role) query.role = String(filters.role)
  if (filters.account_type) query.account_type = filters.account_type
  if (filters.approval_status) query.approval_status = filters.approval_status
  if (filters.is_active !== undefined) query.is_active = String(filters.is_active)
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
  filters.role = query.role ? Number(query.role) : undefined
  filters.account_type =
    query.account_type === 'club' || query.account_type === 'collector'
      ? query.account_type
      : undefined
  filters.approval_status =
    query.approval_status === 'pending' || query.approval_status === 'approved'
      ? query.approval_status
      : undefined
  filters.is_active =
    query.is_active === 'true' ? true : query.is_active === 'false' ? false : undefined
  if (typeof query.created_at__gte === 'string' && typeof query.created_at__lte === 'string') {
    dateRange.value = [query.created_at__gte, query.created_at__lte]
  }
  page.value = Number(query.page) > 1 ? Number(query.page) : 1
  ordering.value = typeof query.ordering === 'string' ? query.ordering : undefined
}

function handleAdd() {
  isEdit.value = false
  editingId.value = null
  formData.value = {
    username: '',
    password: '',
    role_id: roles.value.find((role) => role.name === 'User')?.id || roles.value[0]?.id || null,
    is_active: true,
  }
  dialogVisible.value = true
}

function handleEdit(row: AdminUser) {
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

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !formData.value.role_id) return
  submitting.value = true
  try {
    if (isEdit.value && editingId.value) {
      const payload: Record<string, unknown> = {
        role_id: formData.value.role_id,
        is_active: formData.value.is_active,
      }
      if (formData.value.password) payload.password = formData.value.password
      await updateAdminUser(editingId.value, payload)
      ElMessage.success('用户已更新')
    } else {
      await createAdminUser({
        username: formData.value.username.trim(),
        password: formData.value.password,
        role_id: formData.value.role_id,
      })
      ElMessage.success('用户已创建')
    }
    dialogVisible.value = false
    await loadUsers()
  } finally {
    submitting.value = false
  }
}

async function openDetail(row: AdminUser) {
  selectedUser.value = await getAdminUserDetail(row.id)
  detailVisible.value = true
}

async function handleApprove(row: AdminUser) {
  await ElMessageBox.confirm(
    `批准社团“${row.club_name || row.username}”吗？`,
    '审批申请',
    { confirmButtonText: '批准', cancelButtonText: '取消', type: 'info' },
  )
  await approveAdminUser(row.id)
  ElMessage.success('社团账号已批准')
  await loadUsers()
}

async function handleToggleActive(row: AdminUser) {
  const action = row.is_active ? '停用' : '启用'
  await ElMessageBox.confirm(`确定要${action}用户“${row.username}”吗？`, '确认操作', {
    confirmButtonText: action,
    cancelButtonText: '取消',
    type: 'warning',
  })
  await updateAdminUser(row.id, { is_active: !row.is_active })
  ElMessage.success(`已${action}`)
  await loadUsers()
}

async function handleReject(row: AdminUser) {
  await ElMessageBox.confirm(
    '拒绝后会直接删除账号及社团资料，无法恢复。确认继续？',
    '拒绝申请',
    { confirmButtonText: '拒绝并删除', cancelButtonText: '取消', type: 'warning' },
  )
  await rejectAdminUser(row.id)
  ElMessage.success('申请已拒绝并删除')
  await loadUsers()
}

function handleRowCommand(command: string, row: AdminUser) {
  if (command === 'toggle') void handleToggleActive(row)
  if (command === 'reject') void handleReject(row)
}

async function handleBulk(action: 'enable' | 'disable' | 'approve') {
  const labels = { enable: '启用', disable: '停用', approve: '批准' }
  await ElMessageBox.confirm(
    `确认批量${labels[action]} ${selectedRows.value.length} 个用户吗？`,
    '批量操作',
    { confirmButtonText: labels[action], cancelButtonText: '取消', type: 'warning' },
  )
  const response = await bulkAdminUsers(selectedRows.value.map((row) => row.id), action)
  ElMessage.success(`已处理 ${response.updated} 个用户`)
  tableRef.value?.clearSelection()
  await loadUsers()
}

async function handleExport() {
  exporting.value = true
  try {
    const blob = await exportAdminResource('users', requestParams.value)
    downloadBlob(blob, `admin-users-${Date.now()}.csv`)
    ElMessage.success('导出已开始')
  } finally {
    exporting.value = false
  }
}

watch(dateRange, handleSearch)
onMounted(() => {
  hydrateFromQuery()
  void Promise.all([loadRoles(), loadUsers()])
})
</script>

<style scoped>
.search-input {
  width: min(260px, 100%);
}

.admin-search-flex :deep(.el-select) {
  width: 138px;
}

.content-body {
  min-height: 320px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-cell__avatar {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: #f3f0ff;
  color: #6b5fe8;
  font-weight: 700;
}

.user-cell > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.user-cell strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-cell small {
  color: #9099a6;
  font-size: 11px;
}

.user-detail {
  padding: 20px;
}

.user-detail__hero {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.user-detail__hero > span {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 12px;
  background: #f3f0ff;
  color: #6b5fe8;
  font-size: 20px;
  font-weight: 800;
}

.user-detail__hero h3 {
  margin: 0;
  font-size: 18px;
}

.user-detail__hero p {
  margin: 4px 0 0;
  color: #9099a6;
  font-size: 12px;
}

.user-detail dl,
.club-detail dl {
  display: flex;
  margin: 0;
  flex-direction: column;
}

.user-detail dl > div,
.club-detail dl > div {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 12px;
  border-bottom: 1px solid #eef0f3;
  padding: 11px 0;
}

.user-detail dt,
.club-detail dt {
  color: #9099a6;
  font-size: 12px;
}

.user-detail dd,
.club-detail dd {
  min-width: 0;
  margin: 0;
  color: #303846;
  font-size: 13px;
  word-break: break-word;
}

.club-detail {
  margin-top: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
}

.club-detail h3 {
  margin: 0 0 10px;
  font-size: 14px;
}

.club-detail > p {
  margin: 6px 0;
  color: #606a78;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .admin-search-flex :deep(.el-select),
  .admin-search-flex :deep(.el-date-editor),
  .search-input {
    width: 100%;
  }
}
</style>
