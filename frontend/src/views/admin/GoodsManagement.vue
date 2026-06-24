<template>
  <div class="admin-page">
    <AdminPageHeader title="谷子管理" subtitle="管理全站谷子数据，可按用户筛选">
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        <span>新增谷子</span>
      </el-button>
    </AdminPageHeader>

    <el-card class="admin-search-card" shadow="never">
      <div class="admin-search-flex">
        <el-input
          v-model="searchText"
          placeholder="搜索谷子名称..."
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
          class="custom-search"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select
          v-model="selectedUserId"
          placeholder="筛选用户"
          clearable
          filterable
          remote
          :remote-method="handleUserSearch"
          :loading="userLoading"
          class="user-filter"
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
          v-model="selectedStatus"
          placeholder="筛选状态"
          clearable
          class="status-filter"
          @change="handleSearch"
        >
          <el-option label="在馆" value="in_cabinet" />
          <el-option label="出街中" value="outdoor" />
          <el-option label="已售出" value="sold" />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
      </div>
    </el-card>

    <div v-loading="loading" class="content-body">
      <el-empty v-if="!loading && goodsList.length === 0" description="暂无谷子数据" />
      <template v-else>
        <div class="admin-table-wrapper">
          <el-table :data="goodsList" style="width: 100%">
            <el-table-column label="主图" width="80" align="center">
              <template #default="{ row }">
                <el-image
                  v-if="row.main_photo"
                  :src="row.main_photo"
                  fit="cover"
                  class="goods-image"
                >
                  <template #error>
                    <div class="image-placeholder">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                </el-image>
                <div v-else class="image-placeholder">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="谷子名称" min-width="200">
              <template #default="{ row }">
                <div class="goods-name">{{ row.name }}</div>
                <div class="goods-meta">
                  <el-tag size="small" type="info">{{ row.ip?.name || '未关联' }}</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="category" label="品类" width="120">
              <template #default="{ row }">
                {{ row.category?.name || '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="getStatusType(row.status)"
                  effect="plain"
                  size="small"
                >
                  {{ getStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="80" align="center">
              <template #default="{ row }">
                {{ row.quantity }}
              </template>
            </el-table-column>
            <el-table-column prop="user_id" label="归属用户" width="150">
              <template #default="{ row }">
                <span class="user-badge">
                  {{ row.user?.username ?? row.user_id ?? '—' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" align="right" fixed="right">
              <template #default="{ row }">
                <div class="admin-action-inline">
                  <el-button link type="primary" @click="handleEdit(row)" title="编辑">
                    <el-icon :size="16"><Edit /></el-icon>
                  </el-button>
                  <el-button link type="danger" @click="handleDelete(row)" title="删除">
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search, Picture, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getGoodsList, deleteGoods } from '@/api/goods'
import { getAdminUsers } from '@/api/admin'
import type { GoodsListItem } from '@/api/types'
import type { AdminUser } from '@/api/admin'
import AdminPageHeader from './components/AdminPageHeader.vue'

const router = useRouter()

const loading = ref(false)
const goodsList = ref<GoodsListItem[]>([])
const userOptions = ref<AdminUser[]>([])
const userLoading = ref(false)
const searchText = ref('')
const selectedUserId = ref<number | null>(null)
const selectedStatus = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const getStatusType = (status: string) => {
  const map: Record<string, any> = {
    in_cabinet: 'success',
    outdoor: 'warning',
    sold: 'info',
  }
  return map[status] || 'info'
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    in_cabinet: '在馆',
    outdoor: '出街中',
    sold: '已售出',
  }
  return map[status] || status
}

const fetchGoods = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      page_size: pageSize.value,
    }
    if (searchText.value) {
      params.search = searchText.value
    }
    if (selectedUserId.value) {
      params.user = selectedUserId.value
    }
    if (selectedStatus.value) {
      params.status = selectedStatus.value
    }
    const response = await getGoodsList(params)
    goodsList.value = response.results
    total.value = response.count
  } catch (err: any) {
    ElMessage.error(err.message || '获取谷子列表失败')
  } finally {
    loading.value = false
  }
}

// 用户下拉改为远程搜索：按输入调用 admin users 接口（已支持 search），
// 避免原来写死 page_size=100 导致超过 100 的用户在筛选下拉中丢失。
const fetchUserOptions = async (query: string) => {
  userLoading.value = true
  try {
    const response = await getAdminUsers({ search: query || undefined, page_size: 50 })
    userOptions.value = response.results
  } catch (err: any) {
    console.error('获取用户列表失败', err)
  } finally {
    userLoading.value = false
  }
}

const handleUserSearch = (query: string) => {
  fetchUserOptions(query)
}

const handleSearch = () => {
  currentPage.value = 1
  fetchGoods()
}

const handleSizeChange = () => {
  currentPage.value = 1
  fetchGoods()
}

const handlePageChange = () => {
  fetchGoods()
}

const handleAdd = () => {
  router.push('/goods/new')
}

const handleEdit = (row: GoodsListItem) => {
  router.push(`/goods/${row.id}/edit`)
}

const handleDelete = async (row: GoodsListItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除谷子「${row.name}」吗？此操作不可恢复。`,
      '警告',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await deleteGoods(row.id)
    ElMessage.success('谷子已删除')
    fetchGoods()
  } catch {}
}

onMounted(() => {
  fetchUserOptions('')
  fetchGoods()
})
</script>

<style scoped>
.content-body {
  min-height: 200px;
}

.custom-search {
  flex: 1;
  min-width: 200px;
}

.user-filter {
  width: 150px;
}

.status-filter {
  width: 120px;
}

.goods-image {
  width: 50px;
  height: 50px;
  border-radius: var(--button-radius);
  object-fit: cover;
}

.image-placeholder {
  width: 50px;
  height: 50px;
  border-radius: var(--button-radius);
  background: var(--bg-gray);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light);
}

.goods-name {
  font-weight: 500;
  color: var(--text-dark);
  margin-bottom: var(--space-xs);
}

.goods-meta {
  display: flex;
  gap: var(--space-xs);
}

.user-badge {
  font-size: var(--font-small);
  color: var(--text-regular);
  background: var(--bg-gray);
  padding: 2px var(--space-sm);
  border-radius: var(--button-radius);
}

@media (max-width: 768px) {
  .custom-search,
  .user-filter,
  .status-filter {
    width: 100%;
  }
}
</style>
