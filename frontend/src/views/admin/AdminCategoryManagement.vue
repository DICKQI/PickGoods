<template>
  <div class="admin-page">
    <AdminPageHeader title="品类管理" subtitle="按层级维护品类、配色、形状和排序。">
      <el-button :loading="exporting" @click="handleExport">
        <el-icon><Download /></el-icon>
        导出
      </el-button>
      <el-button type="primary" @click="openDialog(null, null)">
        <el-icon><Plus /></el-icon>
        新增根品类
      </el-button>
    </AdminPageHeader>

    <div class="category-workspace">
      <el-card shadow="never" class="category-tree-panel">
        <template #header>
          <div class="panel-heading">
            <strong>品类层级</strong>
            <el-button text :icon="Refresh" :loading="treeLoading" @click="reloadTree">刷新</el-button>
          </div>
        </template>
        <el-input
          v-model="searchText"
          clearable
          placeholder="搜索名称或完整路径"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>

        <el-table
          v-if="searchText.trim()"
          v-loading="searchLoading"
          :data="searchResults"
          class="category-search-table"
          @row-click="selectCategory"
        >
          <el-table-column prop="path_name" label="匹配品类" min-width="220" />
          <el-table-column prop="goods_count" label="谷子件数" width="100" align="right" />
        </el-table>

        <el-tree
          v-else
          ref="treeRef"
          v-loading="treeLoading"
          :data="treeData"
          node-key="id"
          lazy
          draggable
          default-expand-all
          :expand-on-click-node="false"
          :props="{ label: 'name', children: 'children', isLeaf: 'isLeaf' }"
          :load="loadNode"
          @node-click="selectCategory"
          @node-drop="handleNodeDrop"
        >
          <template #default="{ data }">
            <div class="tree-node">
              <span class="tree-node__color" :style="{ background: data.color_tag || '#d4af37' }" />
              <span class="tree-node__name">{{ data.name }}</span>
              <span class="tree-node__count">{{ data.goods_count || 0 }}</span>
            </div>
          </template>
        </el-tree>
      </el-card>

      <el-card shadow="never" class="category-detail-panel">
        <template #header>
          <div class="panel-heading">
            <strong>{{ selectedCategory ? '品类详情' : '选择一个品类' }}</strong>
            <div v-if="selectedCategory" class="panel-heading__actions">
              <el-button link type="primary" @click="openDialog(selectedCategory, null)">编辑</el-button>
              <el-button link type="primary" @click="openDialog(null, selectedCategory)">新增子级</el-button>
              <el-button link type="danger" @click="removeCategory(selectedCategory)">删除</el-button>
            </div>
          </div>
        </template>

        <el-empty v-if="!selectedCategory" description="从左侧选择品类查看详情" />
        <template v-else>
          <div class="category-title">
            <span :style="{ background: selectedCategory.color_tag || '#d4af37' }" />
            <div>
              <h3>{{ selectedCategory.name }}</h3>
              <p>{{ selectedCategory.path_name }}</p>
            </div>
          </div>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="父级">
              {{ selectedCategory.parent ? parentName(selectedCategory.parent) : '根品类' }}
            </el-descriptions-item>
            <el-descriptions-item label="形状">{{ shapeLabel(selectedCategory.shape_type) }}</el-descriptions-item>
            <el-descriptions-item label="颜色">{{ selectedCategory.color_tag || '—' }}</el-descriptions-item>
            <el-descriptions-item label="排序值">{{ selectedCategory.order }}</el-descriptions-item>
            <el-descriptions-item label="谷子件数">{{ selectedCategory.goods_count || 0 }}</el-descriptions-item>
          </el-descriptions>
        </template>
      </el-card>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑品类' : '新增品类'"
      width="min(92vw, 520px)"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="品类名称" prop="name">
          <el-input v-model="form.name" maxlength="50" />
        </el-form-item>
        <el-form-item label="父级品类">
          <el-tree-select
            v-model="form.parent"
            :data="treeData"
            node-key="id"
            check-strictly
            clearable
            lazy
            :load="loadNode"
            :props="{ label: 'name', children: 'children', isLeaf: 'isLeaf' }"
            placeholder="留空表示根品类"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="形状">
          <el-select v-model="form.shape_type" clearable style="width: 100%">
            <el-option label="圆形" value="round" />
            <el-option label="正方形" value="square" />
            <el-option label="长方形" value="rectangle" />
          </el-select>
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="form.color_tag" show-alpha />
        </el-form-item>
        <el-form-item label="排序值">
          <el-input-number v-model="form.order" :step="10" controls-position="right" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveCategory">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type Node from 'element-plus/es/components/tree/src/model/node'
import { Download, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { exportAdminResource, getAdminCategories } from '@/api/admin'
import {
  batchUpdateCategoryOrder,
  createCategory,
  deleteCategory,
  updateCategory,
} from '@/api/metadata'
import type { Category } from '@/api/types'
import { downloadBlob } from '@/utils/download'
import AdminPageHeader from './components/AdminPageHeader.vue'

const treeRef = ref()
const treeData = ref<Category[]>([])
const searchText = ref('')
const searchResults = ref<Category[]>([])
const selectedCategory = ref<Category | null>(null)
const treeLoading = ref(false)
const searchLoading = ref(false)
const exporting = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<{
  id?: number
  name: string
  parent: number | null
  color_tag: string | null
  shape_type: 'round' | 'square' | 'rectangle' | null
  order: number
}>({
  name: '',
  parent: null,
  color_tag: null,
  shape_type: null,
  order: 0,
})
const rules: FormRules = {
  name: [{ required: true, message: '请输入品类名称', trigger: 'blur' }],
}

async function loadNode(node: Node, resolve: (data: Category[]) => void) {
  try {
    const parentId = node.level === 0 ? undefined : Number(node.data.id)
    const response = await getAdminCategories(
      parentId === undefined
        ? { parent__isnull: true, ordering: 'order,id' }
        : { parent: parentId, ordering: 'order,id' },
    )
    resolve(response.map((item) => ({ ...item, children: undefined, isLeaf: false })))
  } catch {
    resolve([])
  }
}

async function reloadTree() {
  treeLoading.value = true
  selectedCategory.value = null
  try {
    treeData.value = await getAdminCategories({
      parent__isnull: true,
      ordering: 'order,id',
    })
    await nextTick()
    treeRef.value?.store?.setData(treeData.value)
  } finally {
    treeLoading.value = false
  }
}

async function handleSearch() {
  if (!searchText.value.trim()) {
    searchResults.value = []
    return
  }
  searchLoading.value = true
  try {
    searchResults.value = await getAdminCategories({
      search: searchText.value.trim(),
      ordering: 'order,id',
    })
  } finally {
    searchLoading.value = false
  }
}

function selectCategory(category: Category) {
  selectedCategory.value = category
}

function parentName(parentId: number) {
  const find = (nodes: Category[]): Category | undefined => {
    for (const node of nodes) {
      if (node.id === parentId) return node
      const found = node.children?.length ? find(node.children) : undefined
      if (found) return found
    }
    return undefined
  }
  return find(treeData.value)?.name || `#${parentId}`
}

function openDialog(row: Category | null, parent: Category | null) {
  Object.assign(form, row
    ? {
        id: row.id,
        name: row.name,
        parent: row.parent,
        color_tag: row.color_tag || null,
        shape_type: row.shape_type || null,
        order: row.order,
      }
    : {
        id: undefined,
        name: '',
        parent: parent?.id || null,
        color_tag: null,
        shape_type: null,
        order: 0,
      })
  dialogVisible.value = true
}

async function saveCategory() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload = {
      name: form.name.trim(),
      parent: form.parent,
      color_tag: form.color_tag,
      shape_type: form.shape_type,
      order: form.order,
    }
    if (form.id) await updateCategory(form.id, payload)
    else await createCategory(payload)
    dialogVisible.value = false
    ElMessage.success('品类已保存')
    await reloadTree()
  } finally {
    submitting.value = false
  }
}

async function removeCategory(category: Category) {
  await ElMessageBox.confirm(
    `删除“${category.path_name}”会级联删除其子品类；关联谷子将受后端保护。确认继续？`,
    '删除品类',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
  )
  await deleteCategory(category.id)
  ElMessage.success('品类已删除')
  selectedCategory.value = null
  await reloadTree()
}

async function handleNodeDrop(draggingNode: Node, dropNode: Node, dropType: string) {
  const parent = dropType === 'inner' ? dropNode.data : dropNode.parent?.data || null
  const siblings: Category[] = parent?.children || treeData.value
  try {
    await updateCategory(draggingNode.data.id, {
      name: draggingNode.data.name,
      parent: parent?.id || null,
      color_tag: draggingNode.data.color_tag,
      shape_type: draggingNode.data.shape_type,
      order: draggingNode.data.order,
    })
    await batchUpdateCategoryOrder(
      siblings.map((item, index) => ({ id: item.id, order: index * 10 })),
    )
    ElMessage.success('品类顺序已更新')
    await reloadTree()
  } catch {
    await reloadTree()
  }
}

async function handleExport() {
  exporting.value = true
  try {
    const blob = await exportAdminResource('categories', {
      search: searchText.value.trim() || undefined,
    })
    downloadBlob(blob, `admin-categories-${Date.now()}.csv`)
    ElMessage.success('导出已开始')
  } finally {
    exporting.value = false
  }
}

function shapeLabel(value?: string | null) {
  return { round: '圆形', square: '正方形', rectangle: '长方形' }[value || ''] || '未设置'
}

onMounted(reloadTree)
</script>

<style scoped>
.category-workspace {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(360px, 1.1fr);
  gap: 14px;
}

.category-tree-panel,
.category-detail-panel {
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
  box-shadow: none;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-heading__actions {
  display: flex;
  gap: 6px;
}

.category-tree-panel :deep(.el-card__body) {
  padding-top: 12px;
}

.category-tree-panel :deep(.el-tree) {
  margin-top: 12px;
  background: transparent;
}

.category-search-table {
  margin-top: 12px;
  cursor: pointer;
}

.tree-node {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
  padding-right: 8px;
}

.tree-node__color,
.category-title > span {
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 50%;
}

.tree-node__name {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-node__count {
  color: #9099a6;
  font-size: 11px;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.category-title > span {
  width: 18px;
  height: 18px;
}

.category-title h3 {
  margin: 0;
  font-size: 18px;
}

.category-title p {
  margin: 4px 0 0;
  color: #9099a6;
  font-size: 12px;
}

@media (max-width: 900px) {
  .category-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
