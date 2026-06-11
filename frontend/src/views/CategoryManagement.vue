<template>
  <div class="category-management-container">
    <!-- ================= 顶部区域 ================= -->
    <div class="header-section">
      <div class="title-wrapper">
        <h2 class="page-title">品类管理</h2>
        <span class="sub-title">配置谷子的种类（如：立牌、马口铁徽章等）</span>
      </div>
      <div class="header-actions">
        <el-button class="add-btn" type="primary" @click="handleAdd" v-if="authStore.isAdmin" title="新增顶级品类">
          <el-icon><Plus /></el-icon>
        </el-button>
      </div>
    </div>

    <el-card class="search-card" shadow="never">
      <div class="search-flex">
        <el-input
          v-model="searchText"
          placeholder="搜索品类..."
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
          class="custom-search"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button class="search-btn" type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          <span>搜索</span>
        </el-button>
        <div class="hidden-xs-only">
          <el-button plain @click="expandAll">全部展开</el-button>
        </div>
        <div class="hidden-xs-only">
          <el-button plain @click="collapseAll">全部收起</el-button>
        </div>
      </div>
    </el-card>
    <!-- ================= 顶部区域结束 ================= -->

    <div v-loading="loading" class="content-body">
      <!-- 下拉刷新容器 -->
      <div
        class="category-list-wrapper pull-refresh-wrapper"
        ref="scrollContainerRef"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <!-- 下拉加载提示区 -->
        <div class="pull-indicator" :style="{ height: `${pullDistance}px`, opacity: pullDistance > 0 ? 1 : 0 }">
          <div class="indicator-content">
            <el-icon v-if="isRefreshing" class="is-loading"><Loading /></el-icon>
            <el-icon v-else :style="{ transform: `rotate(${pullDistance > 50 ? 180 : 0}deg)` }"><Top /></el-icon>
            <span class="indicator-text">
              {{ isRefreshing ? '正在刷新...' : (pullDistance > 50 ? '释放刷新' : '下拉刷新') }}
            </span>
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="category-list-inner" :style="{ transform: `translateY(${pullDistance}px)` }">

          <!-- 【PC端视图】 -->
          <div class="hidden-xs-only">
            <el-table
              ref="tableRef"
              :key="componentKey"
              :data="displayedTree"
              style="width: 100%"
              class="pc-table"
              row-key="id"
              :default-expand-all="false"
              :tree-props="{ children: 'children' }"
              :indent="0"
              :row-class-name="rowClassName"
              @expand-change="handleExpandChange"
            >
              <el-table-column v-if="authStore.isAdmin" label="排序" width="80" align="center">
                <template #default>
                  <div class="drag-handle">
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="name" label="品类">
                <template #default="{ row }">
                  <div
                    class="category-item-name"
                    :class="{ 'is-child': (row.depth || 1) > 1 }"
                    :style="{
                      '--pad-left': `${Math.max((row.depth || 1) - 1, 0) * 18 + 8}px`,
                      paddingLeft: `${Math.max((row.depth || 1) - 1, 0) * 18 + 8}px`,
                    }"
                  >
                    <div
                      class="depth-bar"
                      :style="{ backgroundColor: depthColor(row.depth) }"
                    ></div>
                    <el-icon class="folder-icon"><CollectionTag /></el-icon>
                    <span>{{ row.name }}</span>
                    <span
                      v-if="row.color_tag"
                      class="color-dot"
                      :style="{ backgroundColor: row.color_tag || '#a3a3a3' }"
                    />
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="完整名称" min-width="200">
                <template #default="{ row }">
                  <el-tag type="info" effect="plain" class="path-tag">
                    {{ row.path_name || '—' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200" align="right">
                <template #default="{ row }">
                  <div class="action-inline">
                    <div class="expand-btn-placeholder">
                      <el-button
                        v-if="row.children && row.children.length"
                        link
                        type="primary"
                        @click="toggleRowExpand(row)"
                        :title="isExpanded(row) ? '收起' : '展开'"
                      >
                        <el-icon :size="16"><component :is="isExpanded(row) ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
                      </el-button>
                    </div>
                    <el-button
                      v-if="authStore.isAdmin"
                      link
                      type="primary"
                      @click="handleAddSub(row)"
                      title="新增子类"
                    >
                      <el-icon :size="16"><Plus /></el-icon>
                    </el-button>
                    <el-button
                      v-if="authStore.isAdmin"
                      link
                      type="primary"
                      @click="handleEdit(row)"
                      title="编辑"
                    >
                      <el-icon :size="16"><Edit /></el-icon>
                    </el-button>
                    <el-button
                      v-if="authStore.isAdmin"
                      link
                      type="danger"
                      @click="handleDelete(row)"
                      title="删除"
                    >
                      <el-icon :size="16"><Delete /></el-icon>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 【移动端视图】 -->
          <div class="visible-xs-only mobile-list-container" :key="componentKey">
            <div class="mobile-sortable-group mobile-root-group" data-parent-id="root">
              <CategoryMobileNode
                v-for="item in displayedTree"
                :key="item.id"
                :node="item"
                :auth-is-admin="authStore.isAdmin"
                :expanded-ids="effectiveExpandedMobileIds"
                :depth-color="depthColor"
                @toggle="toggleMobileExpand"
                @add-sub="handleAddSub"
                @edit="openMobileActions"
                @delete="handleDelete"
              />
            </div>
          </div>

          <el-empty v-if="!loading && displayedTree.length === 0" description="暂无品类数据" />
        </div>
      </div>
    </div>

    <!-- 刷新按钮 - 右下角悬浮（仅PC端） -->
    <div class="refresh-fab hidden-xs-only" @click="handleRefresh" :class="{ loading: loading }">
      <el-icon v-if="!loading"><Refresh /></el-icon>
      <el-icon v-else class="is-loading"><Loading /></el-icon>
    </div>

    <!-- 弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="400px" class="custom-dialog" align-center>
      <el-form :model="formData" :rules="formRules" ref="formRef" label-position="top">
        <el-form-item label="品类名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入品类名称，如：马口铁徽章" maxlength="50" show-word-limit />
        </el-form-item>

        <el-form-item label="父级品类" prop="parent">
          <el-tree-select
            v-model="formData.parent"
            :data="parentTreeOptions"
            :props="{ label: 'name', value: 'id', children: 'children', disabled: 'disabled' }"
            placeholder="可选择任意层级作为父节点，不选则为顶级"
            check-strictly
            clearable
            filterable
            :disabled="isParentLocked"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="颜色标签" prop="color_tag">
          <div class="color-picker-row">
            <el-color-picker v-model="formData.color_tag" show-alpha />
            <el-input v-model="formData.color_tag" placeholder="#AABBCC，可不填" clearable />
            <div
              class="color-preview"
              :style="{ backgroundColor: formData.color_tag || '#f5f7fa' }"
            ></div>
          </div>
          <div class="color-presets">
            <span class="preset-label">常用：</span>
            <el-tag
              v-for="preset in colorPresets"
              :key="preset"
              :style="{ backgroundColor: preset, color: '#fff', cursor: 'pointer' }"
              effect="dark"
              @click="formData.color_tag = preset"
            >
              {{ preset }}
            </el-tag>
          </div>
        </el-form-item>

        <el-form-item label="排序（同级越小越靠前）" prop="order">
          <el-input-number v-model="formData.order" :min="0" :max="9999" :step="1" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" class="submit-btn" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <MobileActionSheet
      v-model="mobileDrawerVisible"
      :title="categoryActionSheetTitle"
      :actions="categoryMobileActions"
      @select="handleCategoryMobileAction"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Plus, Search, CollectionTag, Refresh, Loading, Top, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useMetadataStore } from '@/stores/metadata'
import MobileActionSheet from '@/components/MobileActionSheet.vue'
import { useMobilePullRefresh } from '@/composables/useMobilePullRefresh'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import {  createCategory, updateCategory, deleteCategory, batchUpdateCategoryOrder } from '@/api/metadata'
import type { Category } from '@/api/types'
import Sortable from 'sortablejs'
import CategoryMobileNode from '@/components/CategoryMobileNode.vue'

type CategoryNode = Category & { children?: CategoryNode[]; depth?: number }

const loading = ref(false)
const submitting = ref(false)
const searchText = ref('')
const allCategories = ref<Category[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const isParentLocked = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const colorPresets = ['#8e7dff', '#FF5733', '#33C3F0', '#FFC300', '#67C23A', '#E6A23C']
const tableRef = ref()
const expandedIds = ref<Set<number>>(new Set())
const expandedMobileIds = ref<Set<number>>(new Set())
let sortableInstance: any | null = null
let mobileSortableInstances: any[] = []
const isSorting = ref(false)
const componentKey = ref(0)

// 窗口宽度响应式
const { isMobile } = useResponsiveDevice()

// 移动端操作相关
const mobileDrawerVisible = ref(false)
const currentActionRow = ref<Category | null>(null)

const authStore = useAuthStore()
const metadataStore = useMetadataStore()

const scrollContainerRef = ref<HTMLElement | null>(null)

const {
  pullDistance,
  isRefreshing,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = useMobilePullRefresh({
  enabled: isMobile,
  blocked: isSorting,
  onRefresh: async () => {
    try {
      await fetchCategoryList(true)
      ElMessage.success('刷新成功')
    } catch {
      ElMessage.error('刷新失败')
    }
  },
})

const formData = ref({
  name: '',
  parent: null as number | null,
  color_tag: '',
  order: 0,
})
const formRules: FormRules = {
  name: [{ required: true, message: '名称不能为空', trigger: 'blur' }],
  order: [{ type: 'number', message: '排序需为数字', trigger: 'change' }],
}

const dialogTitle = computed(() => isEdit.value ? '🏷️ 修改品类' : '✨ 新增品类')

const buildCategoryTree = (list: Category[]): CategoryNode[] => {
  const map = new Map<number, CategoryNode>()
  // 1. 初始化节点映射，暂不计算深度
  list.forEach((item) => {
    map.set(item.id, { ...item, children: [] })
  })

  const roots: CategoryNode[] = []

  // 2. 构建树形结构
  map.forEach((node) => {
    if (node.parent !== null && map.has(node.parent)) {
      const parent = map.get(node.parent)!
      parent.children!.push(node)
    } else {
      roots.push(node)
    }
  })

  // 3. 递归计算深度并排序
  const processNode = (nodes: CategoryNode[], depth: number) => {
    // 排序：优先按 order 升序，其次按 name 排序
    nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))

    nodes.forEach((node) => {
      node.depth = depth
      if (node.children && node.children.length > 0) {
        processNode(node.children, depth + 1)
      }
    })
  }

  processNode(roots, 1)
  return roots
}

const filterTreeByKeyword = (nodes: CategoryNode[], keyword: string) => {
  if (!keyword) return nodes
  const result: CategoryNode[] = []
  nodes.forEach((node) => {
    const matched = node.name.includes(keyword) || (node.path_name || '').includes(keyword)
    const filteredChildren = node.children ? filterTreeByKeyword(node.children, keyword) : []
    if (matched || filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren })
    }
  })
  return result
}

const flattenTree = (nodes: CategoryNode[]) => {
  const arr: CategoryNode[] = []
  const walk = (list: CategoryNode[]) => {
    list.forEach((item) => {
      arr.push(item)
      if ((item as any).children && (item as any).children.length) {
        walk((item as any).children)
      }
    })
  }
  walk(nodes)
  return arr
}

const destroySortables = () => {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
  mobileSortableInstances.forEach((instance) => instance.destroy())
  mobileSortableInstances = []
}

const findNodeById = (nodes: CategoryNode[], id: number): CategoryNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findNodeById(node.children, id)
      if (found) return found
    }
  }
  return null
}

const getMobileSiblingSource = (parentId: string | undefined) => {
  if (!parentId || parentId === 'root') return displayedTree.value
  const parent = findNodeById(displayedTree.value, Number(parentId))
  return parent?.children || []
}

// 将拖拽初始化逻辑提取为独立函数
const initDragSort = () => {
  // 先销毁旧实例
  destroySortables()

  // 仅在浏览器环境下初始化，且仅管理员可排序
  if (typeof window === 'undefined' || !authStore.isAdmin) return

  if (!isMobile.value) {
    // PC 端：对表格行启用拖拽
    const tableEl = tableRef.value?.$el as HTMLElement | undefined
    const tbody = tableEl?.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
    if (tbody) {
      sortableInstance = Sortable.create(tbody, {
        handle: '.drag-handle',
        animation: 150,
        onStart: () => {
          isSorting.value = true
        },
        onEnd: (evt: any) => {
          isSorting.value = false
          handleRowReorder(flattenTree(displayedTree.value), evt.oldIndex ?? 0, evt.newIndex ?? 0)
        },
      })
    }
  } else {
    // 移动端：每个同父级列表单独排序，避免跨层级拖拽
    const groups = document.querySelectorAll<HTMLElement>('.mobile-sortable-group')
    mobileSortableInstances = Array.from(groups).map((group) => Sortable.create(group, {
      handle: '.mobile-drag-handle',
      draggable: '.mobile-category-node',
      animation: 150,
      onStart: () => {
        isSorting.value = true
      },
      onEnd: (evt: any) => {
        isSorting.value = false
        const source = getMobileSiblingSource((evt.from as HTMLElement).dataset.parentId)
        handleRowReorder(source, evt.oldIndex ?? 0, evt.newIndex ?? 0)
      },
    }))
  }
}

const handleRowReorder = async (source: CategoryNode[], oldIndex: number, newIndex: number) => {
  if (oldIndex === newIndex) return
  const moved = source[oldIndex]
  const target = source[newIndex]
  if (!moved || !target) return

  // 仅允许同一父级内部排序
  if (moved.parent !== target.parent) {
    ElMessage.warning('当前仅支持同一父级内部拖拽排序')
    await fetchCategoryList()
    return
  }

  const parentId = moved.parent
  const siblings = allCategories.value
    .filter((c) => c.parent === parentId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))

  const from = siblings.findIndex((s) => s.id === moved.id)
  const to = siblings.findIndex((s) => s.id === target.id)
  if (from === -1 || to === -1) return

  const [removed] = siblings.splice(from, 1)
  if (!removed) return
  siblings.splice(to, 0, removed)

  // 重新生成顺序值，使用步长10，避免未来插入冲突
  const items = siblings.map((c, index) => ({
    id: c.id,
    order: index * 10,
  }))

  // 本地同步更新 allCategories 的 order
  items.forEach((item) => {
    const cat = allCategories.value.find((c) => c.id === item.id)
    if (cat) {
      cat.order = item.order
    }
  })

  // ========== 关键修复代码开始 ==========
  // 1. 强制刷新 Key，触发 Vue 销毁并重建 Table 组件
  // 这样所有的子节点会依据新的数据结构重新渲染到正确的位置
  componentKey.value++

  // 2. 等待 DOM 重建完毕
  await nextTick()

  // 3. DOM 变了，必须重新绑定 Sortable
  initDragSort()
  // ========== 关键修复代码结束 ==========

  try {
    // 异步发送请求，不阻塞界面更新
    await batchUpdateCategoryOrder(items)
    ElMessage.success('排序已更新')
  } catch {
    ElMessage.error('排序更新失败，请重试')
    await fetchCategoryList() // 失败时回滚
  }
}

const displayedTree = computed<CategoryNode[]>(() => {
  const tree = buildCategoryTree(allCategories.value)
  return filterTreeByKeyword(tree, searchText.value.trim())
})

const autoExpandedMobileIds = computed(() => {
  const ids = new Set<number>()
  if (!searchText.value.trim()) return ids
  const walk = (list: CategoryNode[]) => {
    list.forEach((item) => {
      if (item.children?.length) {
        ids.add(item.id)
        walk(item.children)
      }
    })
  }
  walk(displayedTree.value)
  return ids
})

const effectiveExpandedMobileIds = computed(() => {
  const ids = new Set(expandedMobileIds.value)
  autoExpandedMobileIds.value.forEach((id) => ids.add(id))
  return ids
})

const depthColor = (depth?: number) => {
  if (!depth || depth <= 1) return '#dcdfe6'
  const palette = ['#8e7dff', '#33C3F0', '#FFC300', '#67C23A', '#E6A23C', '#F56C6C']
  return palette[(depth - 2) % palette.length] ?? '#8e7dff'
}

const rowClassName = ({ row }: { row: CategoryNode }) => {
  if (!row) return ''
  const classes: string[] = []
  if ((row as any).depth) classes.push(`row-depth-${(row as any).depth}`)
  return classes.join(' ')
}

const parentTreeOptions = computed(() => {
  const tree = buildCategoryTree(allCategories.value)
  if (isEdit.value && editingId.value !== null) {
    const disableSelfAndDesc = (nodes: CategoryNode[]) => {
      nodes.forEach((node) => {
        if (node.id === editingId.value) {
          ;(node as any).disabled = true
        }
        if (node.children && node.children.length) {
          if ((node as any).disabled) {
            node.children.forEach((child) => ((child as any).disabled = true))
          } else {
            disableSelfAndDesc(node.children)
          }
        }
      })
    }
    disableSelfAndDesc(tree)
  }
  return [
    { id: null, name: '设为顶级', children: tree } as unknown as Category,
  ]
})

const isExpanded = (row: Category) => expandedIds.value.has(row.id)

const handleExpandChange = (row: CategoryNode, expanded: boolean) => {
  if (expanded) {
    expandedIds.value.add(row.id)
  } else {
    expandedIds.value.delete(row.id)
  }
}

const toggleRowExpand = (row: CategoryNode) => {
  const next = !isExpanded(row)
  expandedIds.value[next ? 'add' : 'delete'](row.id)
  if (tableRef.value?.toggleRowExpansion) {
    tableRef.value.toggleRowExpansion(row, next)
  } else if (tableRef.value?.store?.toggleRowExpansion) {
    tableRef.value.store.toggleRowExpansion(row, next)
  }
}

const setRowExpansion = (row: CategoryNode, expanded: boolean) => {
  if (tableRef.value?.toggleRowExpansion) {
    tableRef.value.toggleRowExpansion(row, expanded)
  } else if (tableRef.value?.store?.toggleRowExpansion) {
    tableRef.value.store.toggleRowExpansion(row, expanded)
  }
}

const walkTree = (nodes: CategoryNode[], visitor: (node: CategoryNode) => void) => {
  nodes.forEach((node) => {
    visitor(node)
    if (node.children && node.children.length > 0) walkTree(node.children, visitor)
  })
}

const expandAll = async () => {
  await nextTick()
  walkTree(displayedTree.value, (node) => {
    if (node.children && node.children.length > 0) {
      expandedIds.value.add(node.id)
      setRowExpansion(node, true)
    }
  })
}

const collapseAll = async () => {
  await nextTick()
  walkTree(displayedTree.value, (node) => {
    if (node.children && node.children.length > 0) {
      setRowExpansion(node, false)
    }
  })
  expandedIds.value.clear()
}

const fetchCategoryList = async (force = false) => {
  loading.value = true
  try {
    const data = await metadataStore.fetchCategories(force)
    allCategories.value = data

    // 数据更新后，初始化/更新拖拽
    await nextTick()
    initDragSort() // 使用封装的函数
  } finally {
    loading.value = false
  }
}

const handleSearch = () => fetchCategoryList()
const handleRefresh = () => fetchCategoryList(true)
const handleAdd = () => {
  isEdit.value = false
  isParentLocked.value = false
  editingId.value = null
  formData.value = { name: '', parent: null, color_tag: '', order: 0 }
  dialogVisible.value = true
}

const handleAddSub = (row: Category) => {
  isEdit.value = false
  isParentLocked.value = true
  editingId.value = null
  formData.value = { name: '', parent: row.id, color_tag: '', order: 0 }
  dialogVisible.value = true
}

const handleEdit = (row: Category) => {
  isEdit.value = true
  isParentLocked.value = false
  editingId.value = row.id
  formData.value = {
    name: row.name,
    parent: row.parent,
    color_tag: row.color_tag || '',
    order: row.order ?? 0
  }
  dialogVisible.value = true
}

const handleDelete = async (row: Category) => {
  try {
    await ElMessageBox.confirm(`确定删除品类《${row.name}》吗？`, '提示')
    await deleteCategory(row.id)
    ElMessage.success('已删除')
    fetchCategoryList(true)
  } catch {}
}

const openMobileActions = (row: Category) => {
  currentActionRow.value = row
  mobileDrawerVisible.value = true
}

const categoryActionSheetTitle = computed(() => (
  currentActionRow.value ? `对「${currentActionRow.value.name}」进行操作` : '品类操作'
))

const categoryMobileActions = computed(() => [
  { key: 'add-sub', label: '新增子类', icon: Plus, tone: 'primary' as const },
  { key: 'edit', label: '编辑品类', icon: Edit },
  { key: 'delete', label: '删除品类', icon: Delete, tone: 'danger' as const },
])

const handleCategoryMobileAction = (key: string) => {
  if (key === 'add-sub') handleMobileAddSub()
  if (key === 'edit') handleMobileEdit()
  if (key === 'delete') handleMobileDelete()
}

const toggleMobileExpand = (row: CategoryNode) => {
  if (!row.children || row.children.length === 0) return
  const next = !expandedMobileIds.value.has(row.id)
  expandedMobileIds.value[next ? 'add' : 'delete'](row.id)
  nextTick(() => {
    initDragSort()
  })
}

const handleMobileAddSub = () => {
  if (currentActionRow.value) {
    handleAddSub(currentActionRow.value)
    mobileDrawerVisible.value = false
  }
}

const handleMobileEdit = () => {
  if (currentActionRow.value) {
    handleEdit(currentActionRow.value)
    mobileDrawerVisible.value = false
  }
}

const handleMobileDelete = () => {
  if (currentActionRow.value) {
    mobileDrawerVisible.value = false
    handleDelete(currentActionRow.value)
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      const payload = {
        name: formData.value.name.trim(),
        parent: formData.value.parent ?? null,
        color_tag: formData.value.color_tag?.trim() || null,
        order: formData.value.order ?? 0,
      }
      if (isEdit.value && editingId.value) {
        await updateCategory(editingId.value, payload)
      } else {
        await createCategory(payload)
      }
      dialogVisible.value = false
      fetchCategoryList(true)
    } finally {
      submitting.value = false
    }
  })
}

watch(displayedTree, async () => {
  await nextTick()
  initDragSort()
})

onMounted(() => {
  fetchCategoryList()
})

onUnmounted(() => {
  destroySortables()
})
</script>

<style scoped>
/* =========== PC/通用基础样式 =========== */
.category-management-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
}
.header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 600; color: #303133; margin: 0; }
.sub-title { font-size: 13px; color: #909399; margin-top: 4px; display: block; }

.search-card {
  border-radius: 16px;
  border: 1px solid rgba(212, 175, 55, 0.08);
  margin-bottom: 18px;
  box-shadow: 0 8px 22px -18px rgba(17, 24, 39, 0.28);
}
.search-card :deep(.el-card__body) { padding: 20px; }
.search-flex { display: flex; gap: 8px; }
.custom-search { flex: 1; }

.add-btn, .search-btn, .submit-btn {
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
  border: none; border-radius: 8px;
}

.search-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 86px;
}

.header-actions { display: flex; align-items: center; gap: 8px; }

/* PC端列表外壳 */
.category-list-wrapper {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  position: relative;
  min-height: 200px;
}

.category-list-inner {
  transition: transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28);
  will-change: transform;
}

/* 下拉刷新样式 */
.pull-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}

.indicator-content {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: #909399;
  padding-bottom: 10px;
}

.indicator-content .el-icon {
  font-size: 18px;
  transition: transform 0.3s;
}

/* PC 表格样式 */
.category-item-name { display: flex; align-items: center; gap: 10px; font-weight: 500; color: #444; position: relative; }
.category-item-name.is-child::before {
  content: '';
  position: absolute;
  left: calc(var(--pad-left, 8px) - 10px);
  top: -8px;
  bottom: -8px;
  border-left: 1px dashed #d0d3d9;
  opacity: 0.9;
  pointer-events: none;
}
.category-item-name.is-child::after {
  content: '';
  position: absolute;
  left: calc(var(--pad-left, 8px) - 10px);
  top: 50%;
  width: 10px;
  border-top: 1px dashed #d0d3d9;
  transform: translateY(-50%);
  opacity: 0.9;
  pointer-events: none;
}
.folder-icon { color: #8e7dff; font-size: 18px; }
.depth-bar { width: 4px; height: 20px; border-radius: 2px; background: #dcdfe6; }
.level-tag { margin-left: 6px; }
.color-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 6px; box-shadow: 0 0 0 1px #ececec; }
.path-tag { border-radius: 8px; }
.order-text { color: #606266; font-variant-numeric: tabular-nums; }
.drag-handle {
  cursor: grab;
  color: #c0c4cc;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  transition: color 0.2s;
}
.drag-handle:hover {
  color: #8e7dff;
}
.drag-handle svg {
  display: block;
}
.action-inline {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  white-space: nowrap;
}
.expand-btn-placeholder {
  width: 32px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}
.action-inline .el-button {
  padding: 4px;
  margin: 0;
  height: auto;
  flex-shrink: 0;
}
.action-inline .el-icon {
  font-size: 16px;
  display: block;
}
.pc-table :deep(.el-table__expand-icon),
.pc-table :deep(.el-table__placeholder) {
  display: none;
}

/* 顶级父级锚点（有子类） */
.action-inline :deep(.el-button.is-link:focus-visible),
.action-inline :deep(.el-button.is-link:focus),
.action-inline :deep(.el-button.is-link:active) {
  box-shadow: none !important;
  outline: none !important;
  background-color: transparent !important;
}

/* PC 刷新按钮 */
.refresh-fab {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 30px;
  box-shadow: 0 4px 16px rgba(163, 150, 255, 0.4);
  cursor: pointer;
  transition: all 0.3s;
  z-index: 999;
}
.refresh-fab:hover { transform: scale(1.1) rotate(180deg); }
.refresh-fab .is-loading { animation: rotate 1s linear infinite; }

/* =========== 移动端适配样式 =========== */

.mobile-list-container {
  padding: 0;
  background-color: transparent;
  border-radius: 0;
  padding-bottom: calc(18px + env(safe-area-inset-bottom));
}

.mobile-sortable-group {
  min-width: 0;
}

.mobile-root-group {
  display: block;
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker-row .el-input {
  flex: 1;
}

.color-preview {
  width: 36px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #ebeef5;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
}

.color-presets {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.preset-label {
  font-size: 12px;
  color: #909399;
}

/* 响应式断点控制 */
@media (max-width: 768px) {
  .category-management-container { padding: 16px; }
  .add-btn span { display: none; }
  .add-btn { width: 40px; height: 40px; border-radius: 50%; padding: 0; justify-content: center; }

  .sub-title {
    font-size: 12px;
    display: block;
    margin-top: 4px;
    line-height: 1.4;
    color: #909399;
    max-width: 260px;
  }

  .hidden-xs-only { display: none !important; }

  .category-list-wrapper {
    box-shadow: none !important;
    background: transparent !important;
    padding: 0;
    min-height: auto;
  }
}

@media (min-width: 769px) {
  .visible-xs-only { display: none !important; }
}

@media (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .category-management-container {
    padding: 16px;
  }

  .add-btn span {
    display: none;
  }

  .add-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    padding: 0;
    justify-content: center;
  }

  .sub-title {
    font-size: 12px;
    display: block;
    margin-top: 4px;
    line-height: 1.4;
    color: #909399;
    max-width: 260px;
  }

  .hidden-xs-only {
    display: none !important;
  }

  .visible-xs-only {
    display: block !important;
  }

  .category-list-wrapper {
    box-shadow: none !important;
    background: transparent !important;
    padding: 0;
    min-height: auto;
  }

  .mobile-list-container .mobile-card {
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .mobile-list-container .mobile-card.sortable-chosen {
    transform: scale(0.98);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }

  .mobile-list-container .mobile-card.sortable-ghost {
    opacity: 0.6;
  }
}
</style>
