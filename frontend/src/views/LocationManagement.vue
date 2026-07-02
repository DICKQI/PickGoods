<template>
  <div class="location-management location-workbench">
    <section class="location-shell">
      <aside class="location-sidebar">
        <div class="sidebar-header">
          <div>
            <p class="eyebrow">收纳地图</p>
            <h1>位置作业台</h1>
          </div>
          <el-button
            data-test="location-create-button"
            type="primary"
            class="brand-add-btn brand-add-btn--compact location-create-btn"
            @click="handleAddNode"
          >
            <span class="brand-add-btn__content location-create-btn__content">
              <el-icon class="location-create-btn__icon"><Plus /></el-icon>
              <span class="location-create-btn__label">新增位置</span>
            </span>
          </el-button>
        </div>

        <el-input
          v-model="treeKeyword"
          class="tree-search"
          placeholder="搜索位置、路径或编号"
          clearable
          :prefix-icon="Search"
        />

        <section
          v-if="locationStore.favoriteShortcutNodes.length || locationStore.recentShortcutNodes.length"
          class="quick-access-card"
          aria-label="快捷访问位置"
        >
          <div class="quick-access-head">
            <div>
              <span class="quick-access-kicker">快捷访问</span>
            </div>
          </div>

          <div v-if="locationStore.favoriteShortcutNodes.length" class="quick-access-section quick-access-section--favorite">
            <span class="quick-access-section-title">常用</span>
            <button
              v-for="node in locationStore.favoriteShortcutNodes"
              :key="`favorite-${node.id}`"
              class="quick-location-card"
              type="button"
              @click="selectNodeById(node.id)"
            >
              <span class="quick-location-main">{{ node.name }}</span>
              <span class="quick-location-meta">{{ node.code || node.path_name }}</span>
            </button>
          </div>

          <div v-if="locationStore.recentShortcutNodes.length" class="quick-access-section quick-access-section--recent">
            <span class="quick-access-section-title">最近</span>
            <button
              v-for="node in locationStore.recentShortcutNodes"
              :key="`recent-${node.id}`"
              class="quick-location-chip"
              type="button"
              @click="selectNodeById(node.id)"
            >
              <span>{{ node.name }}</span>
              <small v-if="node.code">{{ node.code }}</small>
            </button>
          </div>
        </section>

        <div class="tree-panel">
          <el-skeleton v-if="locationStore.loading" :rows="6" animated />
          <el-tree
            v-else
            ref="treeRef"
            :data="locationStore.treeData"
            :props="{ label: 'label', children: 'children' }"
            :filter-node-method="filterTreeNode"
            :expand-on-click-node="false"
            node-key="id"
            highlight-current
            class="custom-tree"
            @node-click="handleNodeClick"
          >
            <template #default="{ node, data }">
              <div class="tree-node" :class="{ 'is-empty': (data.count || 0) === 0 }">
                <div class="tree-node-main">
                  <span class="node-label">{{ node.label }}</span>
                  <span v-if="data.data?.path_name" class="node-path">{{ data.data.path_name }}</span>
                </div>
                <span class="node-count" :class="{ empty: (data.count || 0) === 0 }">{{ data.count || 0 }}</span>
              </div>
            </template>
          </el-tree>
        </div>
      </aside>

      <main class="location-detail">
        <template v-if="selectedNode">
          <section class="location-compact-header">
            <div class="compact-main">
              <div class="plate-copy">
                <div class="breadcrumb-line">{{ selectedNode.path_name }}</div>
                <div class="plate-title-row">
                  <h2>{{ selectedNode.name }}</h2>
                  <el-tag v-if="selectedNode.code" effect="plain">{{ selectedNode.code }}</el-tag>
                  <el-tag v-if="selectedNode.is_favorite" type="warning" effect="plain">常用</el-tag>
                </div>
                <p v-if="selectedNode.description" class="plate-description">{{ selectedNode.description }}</p>
                <p v-else class="plate-description muted">还没有备注，可以记录这个位置放什么、怎么找。</p>
              </div>

              <div class="compact-metrics" aria-label="位置统计">
                <div
                  v-for="metric in summaryMetrics"
                  :key="metric.label"
                  class="compact-metric"
                  :class="metric.tone ? `compact-metric--${metric.tone}` : undefined"
                >
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                </div>
              </div>
            </div>

            <div class="plate-actions">
              <el-button :icon="Edit" @click="handleEditNode(selectedNode)">编辑</el-button>
              <el-button :icon="Sort" @click="handleMoveNode(selectedNode)">移动</el-button>
              <el-button :icon="Delete" type="danger" plain @click="handleDeleteNode(selectedNode)">删除</el-button>
            </div>
          </section>

          <section class="workbench-toolbar">
            <div class="toolbar-left">
              <el-segmented v-model="goodsScope" :options="scopeOptions" @change="handleScopeChange" />
              <el-input
                v-model="goodsKeyword"
                class="goods-search"
                placeholder="在当前位置结果中筛选"
                clearable
                :prefix-icon="Search"
              />
            </div>
            <div class="toolbar-right">
              <el-button
                type="primary"
                class="add-goods-entry"
                :icon="Box"
                @click="openUnassignedGoodsDialog"
              >
                添加谷子
                <span class="add-goods-count">待整理 {{ unassignedPagination.count }}</span>
              </el-button>
              <el-button :icon="Refresh" @click="refreshSelectedNode">刷新</el-button>
            </div>
          </section>

          <section class="goods-filter-row" aria-label="谷子筛选">
            <el-select v-model="goodsStatusFilter" placeholder="状态" clearable class="mini-filter">
              <el-option
                v-for="option in goodsStatusOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-select v-model="goodsIpFilter" placeholder="IP" clearable filterable class="mini-filter">
              <el-option
                v-for="option in goodsIpOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-select v-model="goodsCategoryFilter" placeholder="品类" clearable filterable class="mini-filter">
              <el-option
                v-for="option in goodsCategoryOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </section>

          <section v-if="selectedGoodsIds.length" class="batch-bar">
            <span>已选择 {{ selectedGoodsIds.length }} 件</span>
            <el-tree-select
              v-model="batchTargetLocation"
              :data="locationStore.treeData"
              :props="{ label: 'label', value: 'id', children: 'children' }"
              placeholder="移动到..."
              clearable
              filterable
              check-strictly
              class="batch-target"
            />
            <el-button type="primary" :disabled="batchTargetLocation === undefined" @click="handleBatchMove">
              移动
            </el-button>
            <el-button @click="handleBatchMoveToUnassigned">移到待整理</el-button>
            <el-button text @click="clearSelection">取消选择</el-button>
          </section>

          <section class="goods-section">
            <div v-if="summary?.recent_goods?.length" class="recent-strip">
              <span class="strip-title">最近入库</span>
              <button
                v-for="goods in summary.recent_goods.slice(0, 4)"
                :key="goods.id"
                class="recent-goods"
                type="button"
                @click="openGoodsDetail(goods)"
              >
                {{ goods.name }}
              </button>
            </div>

            <el-skeleton v-if="goodsLoading" :rows="6" animated />
            <el-empty v-else-if="filteredGoodsList.length === 0" description="这里暂时没有符合条件的谷子" />
            <div v-else class="guzi-grid">
              <div v-for="goods in filteredGoodsList" :key="goods.id" class="goods-card-shell">
                <label class="select-mark">
                  <input
                    type="checkbox"
                    :checked="selectedGoodsIds.includes(goods.id)"
                    @change="toggleGoodsSelection(goods.id)"
                  />
                  <span></span>
                </label>
                <GoodsCard :goods="goods" :show-menu="false" @click="openGoodsDetail(goods)" />
              </div>
            </div>

            <div v-if="locationPagination.count > locationPagination.page_size" class="pagination-row">
              <el-pagination
                layout="prev, pager, next"
                :page-size="locationPagination.page_size"
                :total="locationPagination.count"
                :current-page="locationPagination.page"
                @current-change="handlePageChange"
              />
            </div>
          </section>
        </template>

        <section v-else class="empty-workbench">
          <el-empty description="选择一个位置开始整理" />
        </section>
      </main>
    </section>

    <el-dialog
      v-model="unassignedVisible"
      title="待整理谷子"
      width="min(1080px, calc(100vw - 32px))"
      class="unassigned-goods-dialog"
      data-test="unassigned-goods-dialog"
      align-center
      append-to-body
    >
      <div class="unassigned-shell">
        <div class="unassigned-toolbar">
          <el-input
            v-model="unassignedFilters.search"
            class="unassigned-search"
            data-test="unassigned-search-input"
            placeholder="搜索名称 / IP / 角色..."
            clearable
            :prefix-icon="Search"
            @keyup.enter="fetchUnassignedGoods(1)"
          >
            <template #append>
              <el-button :loading="unassignedLoading" @click="fetchUnassignedGoods(1)">搜索</el-button>
            </template>
          </el-input>
          <el-button class="reset-button" :icon="RefreshLeft" @click="resetUnassignedFilters">重置</el-button>
        </div>

        <el-form class="unassigned-filters" label-position="top" @submit.prevent>
          <div class="unassigned-filter-grid">
            <el-form-item label="IP">
              <el-select
                v-model="unassignedFilters.ip"
                data-test="unassigned-ip-filter"
                placeholder="全部 IP"
                clearable
                filterable
                @change="handleUnassignedIPChange"
              >
                <el-option v-for="ip in metadataStore.ips" :key="ip.id" :label="ip.name" :value="ip.id" />
              </el-select>
            </el-form-item>

            <el-form-item label="角色">
              <el-select
                v-model="unassignedFilters.character"
                data-test="unassigned-character-filter"
                placeholder="先选择 IP"
                clearable
                filterable
                :disabled="!unassignedFilters.ip"
                @change="fetchUnassignedGoods(1)"
              >
                <el-option
                  v-for="character in unassignedCharacterOptions"
                  :key="character.id"
                  :label="character.name"
                  :value="character.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="品类">
              <el-tree-select
                v-model="unassignedFilters.category"
                data-test="unassigned-category-filter"
                :data="unassignedCategoryTreeData"
                placeholder="全部品类"
                clearable
                check-strictly
                :props="{ label: 'label', value: 'id', children: 'children' }"
                @change="fetchUnassignedGoods(1)"
              />
            </el-form-item>

            <el-form-item label="官谷 / 同人">
              <el-select
                v-model="unassignedFilters.is_official"
                data-test="unassigned-official-filter"
                placeholder="全部"
                clearable
                @change="fetchUnassignedGoods(1)"
              >
                <el-option label="官谷" :value="true" />
                <el-option label="同人" :value="false" />
              </el-select>
            </el-form-item>
          </div>

          <div class="unassigned-status-strip">
            <span class="unassigned-status-title">状态</span>
            <el-checkbox-group
              v-model="selectedUnassignedStatuses"
              class="unassigned-status-group"
              @change="() => fetchUnassignedGoods(1)"
            >
              <el-checkbox-button data-test="unassigned-status-draft" label="draft">草稿</el-checkbox-button>
              <el-checkbox-button data-test="unassigned-status-in-cabinet" label="in_cabinet">在柜</el-checkbox-button>
              <el-checkbox-button data-test="unassigned-status-outdoor" label="outdoor">外带</el-checkbox-button>
              <el-checkbox-button data-test="unassigned-status-sold" label="sold">已出</el-checkbox-button>
            </el-checkbox-group>
          </div>
        </el-form>

        <el-alert
          v-if="!selectedNode"
          title="先选择左侧位置后可放入"
          type="warning"
          :closable="false"
          show-icon
        />

        <div class="unassigned-result-area">
          <div v-if="unassignedError" class="unassigned-state-box">
            <el-alert :title="unassignedError" type="error" :closable="false" />
          </div>

          <div v-else-if="unassignedLoading && unassignedGoods.length === 0" class="unassigned-state-box">
            <el-skeleton :rows="6" animated />
          </div>

          <div v-else-if="unassignedGoods.length === 0" class="unassigned-state-box">
            <el-empty description="没有待整理谷子" image-size="90" />
          </div>

          <div v-else class="unassigned-result-grid">
            <article
              v-for="goods in unassignedGoods"
              :key="goods.id"
              class="unassigned-result-card"
              :data-test="`unassigned-card-${goods.id}`"
            >
              <button class="unassigned-preview" type="button" @click="openGoodsDetail(goods)">
                <el-image :src="goods.main_photo || ''" fit="cover" class="unassigned-thumb">
                  <template #error>
                    <div class="unassigned-thumb-placeholder">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                </el-image>
                <div class="unassigned-info">
                  <div class="unassigned-name" :title="goods.name">{{ goods.name }}</div>
                  <div class="unassigned-meta">
                    <span>{{ goods.ip.name }}</span>
                    <span v-if="goods.category?.name">{{ goods.category.name }}</span>
                    <span v-if="formatGoodsCharacters(goods)">{{ formatGoodsCharacters(goods) }}</span>
                  </div>
                </div>
              </button>

              <div class="unassigned-card-footer">
                <div class="unassigned-tags">
                  <el-tag size="small" effect="plain">{{ statusLabelMap[goods.status] }}</el-tag>
                  <el-tag size="small" effect="plain" :type="goods.is_official ? 'success' : 'info'">
                    {{ goods.is_official ? '官谷' : '同人' }}
                  </el-tag>
                </div>

                <el-button
                  :data-test="`unassigned-move-${goods.id}`"
                  type="primary"
                  size="small"
                  :disabled="!selectedNode"
                  :loading="movingUnassignedGoodsId === goods.id"
                  @click="moveUnassignedGoodsToCurrent(goods.id)"
                >
                  放入当前位置
                </el-button>
              </div>
            </article>
          </div>
        </div>

        <div class="unassigned-pager-row">
          <el-pagination
            v-if="unassignedPagination.count > 0"
            v-model:current-page="unassignedPagination.page"
            :page-size="unassignedPagination.page_size"
            :total="unassignedPagination.count"
            layout="total, prev, pager, next"
            small
            @current-change="fetchUnassignedGoods"
          />
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="dialogVisible"
      :width="isMobile ? '100%' : 'min(94vw, 760px)'"
      :fullscreen="isMobile"
      class="location-node-dialog"
      data-test="location-node-dialog"
      align-center
      @close="handleDialogClose"
      append-to-body
    >
      <template #header>
        <div class="location-dialog-header">
          <span class="location-dialog-kicker">{{ isEdit ? 'Refine location' : 'Create location' }}</span>
          <h3 class="location-dialog-title">{{ dialogTitle }}</h3>
          <p class="location-dialog-subtitle">
            {{ isEdit ? '调整位置标签、层级和容量，让收纳路径保持清晰。' : '先给这个收纳点贴上好找的标签，之后可以继续整理谷子。' }}
          </p>
        </div>
      </template>

      <el-form :model="formData" label-position="top" class="location-dialog-form">
        <section class="location-form-section location-form-section--identity">
          <div class="location-section-title">基础信息</div>
          <div class="location-dialog-form-grid">
            <el-form-item label="位置名称" required class="location-field location-field--wide">
              <el-input v-model="formData.name" placeholder="例如 书房展示柜" maxlength="50" show-word-limit />
            </el-form-item>
            <el-form-item label="位置编号" class="location-field">
              <el-input v-model="formData.code" placeholder="例如 A-03-02" maxlength="50" clearable />
            </el-form-item>
          </div>
        </section>

        <section class="location-form-section location-form-section--structure">
          <div class="location-section-title">结构设置</div>
          <div class="location-dialog-form-grid">
            <el-form-item label="父节点位置" class="location-field location-field--wide">
              <el-tree-select
                v-model="formData.parent"
                :data="parentNodeOptions"
                placeholder="选择父节点"
                clearable
                :props="{ label: 'label', value: 'id', children: 'children' }"
                check-strictly
                filterable
                :filter-node-method="filterParentNode"
              />
            </el-form-item>
            <el-form-item label="显示顺序" class="location-field">
              <el-input-number
                v-model="formData.order"
                class="location-number-input"
                :min="0"
                :max="9999"
                :controls="false"
              />
            </el-form-item>
            <el-form-item label="容量" class="location-field">
              <el-input-number
                v-model="formData.capacity"
                class="location-number-input"
                :min="0"
                :max="9999"
                :controls="false"
              />
            </el-form-item>
            <el-form-item label="位置类型" class="location-field">
              <el-select v-model="formData.node_type">
                <el-option label="房间" value="room" />
                <el-option label="柜子" value="cabinet" />
                <el-option label="层板" value="shelf" />
                <el-option label="抽屉" value="drawer" />
                <el-option label="收纳盒" value="box" />
                <el-option label="自定义" value="custom" />
              </el-select>
            </el-form-item>
            <el-form-item label="常用位置" class="location-field favorite-location-field">
              <div class="favorite-switch-control">
                <el-switch
                  v-model="formData.is_favorite"
                  class="favorite-location-switch"
                  inline-prompt
                  active-text="开"
                  inactive-text="关"
                />
              </div>
            </el-form-item>
          </div>
        </section>

        <section class="location-form-section location-form-section--notes">
          <el-form-item label="备注说明" class="location-field location-field--wide">
            <el-input
              v-model="formData.description"
              type="textarea"
              :rows="3"
              placeholder="例如：最上层放徽章，底层放纸片和吧唧。"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </section>
      </el-form>
      <template #footer>
        <div class="location-dialog-footer">
          <el-button class="location-dialog-cancel" @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" class="location-dialog-submit" @click="handleSubmit">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <GoodsDrawer v-model="detailDrawerVisible" :goods-id="selectedGoodsId" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Box, Delete, Edit, Picture, Plus, Refresh, RefreshLeft, Search, Sort } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useLocationStore } from '@/stores/location'
import { useMetadataStore } from '@/stores/metadata'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { getGoodsList } from '@/api/goods'
import {
  createLocationNode,
  deleteLocationNode,
  getLocationNodeDetail,
  getLocationNodeGoods,
  getLocationNodeSummary,
  moveLocationGoods,
  moveLocationNode,
  patchLocationNode,
} from '@/api/location'
import GoodsCard from '@/components/GoodsCard.vue'
import GoodsDrawer from '@/components/GoodsDrawer.vue'
import type { Category, GoodsListItem, GoodsSearchParams, GoodsStatus, LocationNodeSummary, PaginatedResponse, StorageNode } from '@/api/types'
import type { TreeNode } from '@/utils/tree'

type NodeType = NonNullable<StorageNode['node_type']>

interface CategoryTreeNode {
  id: number
  label: string
  children?: CategoryTreeNode[]
}

interface LocationFormData {
  name: string
  code: string
  parent: number | null
  order: number
  description: string
  capacity: number | null
  node_type: NodeType
  is_favorite: boolean
}

interface SummaryMetric {
  label: string
  value: string | number
  tone?: 'primary' | 'capacity' | 'muted'
}

const route = useRoute()
const locationStore = useLocationStore()
const metadataStore = useMetadataStore()
const { isMobile } = useResponsiveDevice()

const treeRef = ref()
const selectedNode = ref<StorageNode | null>(null)
const summary = ref<LocationNodeSummary | null>(null)
const treeKeyword = ref('')
const goodsKeyword = ref('')
const goodsStatusFilter = ref<GoodsStatus | ''>('')
const goodsIpFilter = ref<number | ''>('')
const goodsCategoryFilter = ref<number | ''>('')
const goodsScope = ref<'current' | 'children'>('children')
const locationGuziList = ref<GoodsListItem[]>([])
const goodsLoading = ref(false)
const summaryLoading = ref(false)
const selectedGoodsIds = ref<string[]>([])
const batchTargetLocation = ref<number | null | undefined>(undefined)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingNodeId = ref<number | null>(null)
const detailDrawerVisible = ref(false)
const selectedGoodsId = ref<string>()
const unassignedVisible = ref(false)
const unassignedLoading = ref(false)
const unassignedError = ref<string | null>(null)
const unassignedGoods = ref<GoodsListItem[]>([])
const movingUnassignedGoodsId = ref<string | null>(null)
const unassignedFilters = reactive<{
  search: string
  ip?: number
  character?: number
  category?: number
  is_official?: boolean
}>({
  search: '',
  ip: undefined,
  character: undefined,
  category: undefined,
  is_official: undefined,
})
const selectedUnassignedStatuses = ref<GoodsStatus[]>([])
const unassignedPagination = ref<PaginatedResponse<GoodsListItem>>({
  count: 0,
  page: 1,
  page_size: 18,
  next: null,
  previous: null,
  results: [],
})
const locationPagination = ref({ count: 0, page: 1, page_size: 18, next: null as number | null, previous: null as number | null })

const formData = ref<LocationFormData>({
  name: '',
  code: '',
  parent: null,
  order: 0,
  description: '',
  capacity: null,
  node_type: 'custom',
  is_favorite: false,
})

const scopeOptions = [
  { label: '含子位置', value: 'children' },
  { label: '仅当前', value: 'current' },
]

const goodsStatusOptions: Array<{ label: string; value: GoodsStatus }> = [
  { label: '草稿', value: 'draft' },
  { label: '在柜', value: 'in_cabinet' },
  { label: '外带', value: 'outdoor' },
  { label: '已出', value: 'sold' },
]

const statusLabelMap: Record<GoodsStatus, string> = {
  draft: '草稿',
  in_cabinet: '在柜',
  outdoor: '外带',
  sold: '已出',
}

const dialogTitle = computed(() => (isEdit.value ? '编辑位置' : '新增位置'))
const childCount = computed(() => selectedNode.value ? locationStore.nodes.filter((node) => node.parent === selectedNode.value!.id).length : 0)
const capacityText = computed(() => {
  if (!summary.value?.capacity) return '未设置'
  return `${summary.value.descendant_goods_count}/${summary.value.capacity}`
})
const summaryMetrics = computed<SummaryMetric[]>(() => [
  {
    label: '当前位置',
    value: summary.value?.direct_goods_count ?? selectedNode.value?.goods_count ?? 0,
  },
  {
    label: '含子位置',
    value: summary.value?.descendant_goods_count ?? selectedNode.value?.descendant_goods_count ?? 0,
    tone: 'primary',
  },
  {
    label: '子位置',
    value: summary.value?.child_node_count ?? childCount.value,
  },
  {
    label: '容量',
    value: capacityText.value,
    tone: summary.value?.capacity ? 'capacity' : 'muted',
  },
])

const parentNodeOptions = computed(() => {
  const treeData = locationStore.treeData
  if (!isEdit.value || !editingNodeId.value) return treeData
  const excludeIds = locationStore.getChildrenIds(editingNodeId.value)
  const filterTree = (nodes: TreeNode[]): TreeNode[] => nodes
    .filter((node) => !excludeIds.includes(node.id))
    .map((node) => ({
      ...node,
      children: node.children && node.children.length > 0 ? filterTree(node.children) : undefined,
    }))
  return filterTree(treeData)
})

const filteredGoodsList = computed(() => {
  const keyword = goodsKeyword.value.trim().toLowerCase()
  return locationGuziList.value.filter((goods) => {
    if (goodsStatusFilter.value && goods.status !== goodsStatusFilter.value) return false
    if (goodsIpFilter.value && goods.ip?.id !== goodsIpFilter.value) return false
    if (goodsCategoryFilter.value && goods.category?.id !== goodsCategoryFilter.value) return false
    if (!keyword) return true
    const haystack = [
      goods.name,
      goods.ip?.name,
      goods.category?.name,
      goods.location_path,
      ...(goods.characters?.map((character) => character.name) ?? []),
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

const goodsIpOptions = computed(() => {
  const options = new Map<number, string>()
  locationGuziList.value.forEach((goods) => {
    if (goods.ip?.id) options.set(goods.ip.id, goods.ip.name)
  })
  return Array.from(options, ([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'))
})

const goodsCategoryOptions = computed(() => {
  const options = new Map<number, string>()
  locationGuziList.value.forEach((goods) => {
    if (goods.category?.id) options.set(goods.category.id, goods.category.name)
  })
  return Array.from(options, ([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'))
})

const unassignedCharacterOptions = computed(() => {
  if (!unassignedFilters.ip) return []
  return metadataStore.charactersByIP[unassignedFilters.ip] || []
})

const unassignedCategoryTreeData = computed<CategoryTreeNode[]>(() => buildCategoryTree(metadataStore.categories))

const filterTreeNode = (keyword: string, data: TreeNode) => filterNodeByKeyword(keyword, data)
const filterParentNode = (keyword: string, data: TreeNode) => filterNodeByKeyword(keyword, data)

function filterNodeByKeyword(keyword: string, data: TreeNode) {
  const query = keyword.trim().toLowerCase()
  if (!query) return true
  const node = data.data
  return [data.label, node?.name, node?.path_name, node?.code]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query))
}

function resetGoodsFilters() {
  goodsKeyword.value = ''
  goodsStatusFilter.value = ''
  goodsIpFilter.value = ''
  goodsCategoryFilter.value = ''
}

function normalizeForm(node?: StorageNode | null): LocationFormData {
  return {
    name: node?.name ?? '',
    code: node?.code ?? '',
    parent: node?.parent ?? null,
    order: node?.order ?? 0,
    description: node?.description ?? '',
    capacity: node?.capacity ?? null,
    node_type: node?.node_type ?? 'custom',
    is_favorite: Boolean(node?.is_favorite),
  }
}

async function selectNodeById(id: number) {
  const treeNode = locationStore.treeData.flatMap(flattenTree).find((node) => node.id === id)
  if (treeNode) {
    await handleNodeClick(treeNode)
    await nextTick()
    treeRef.value?.setCurrentKey(id)
    await scrollCurrentTreeNodeIntoView()
  }
}

function flattenTree(node: TreeNode): TreeNode[] {
  return [node, ...(node.children ?? []).flatMap(flattenTree)]
}

async function scrollCurrentTreeNodeIntoView() {
  await nextTick()
  const currentNode = treeRef.value?.$el?.querySelector?.('.el-tree-node.is-current')
  currentNode?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
}

async function applyHighlightFromRoute() {
  const highlight = route.query.highlight
  if (typeof highlight !== 'string' || !highlight.trim()) return
  await locationStore.fetchNodes()
  const node = locationStore.getNodeByPathName(highlight)
  if (!node) return
  await selectNodeById(node.id)
  const keys = getExpandedKeys(node)
  await nextTick()
  keys.forEach((key) => {
    const treeNode = treeRef.value?.getNode?.(key)
    if (treeNode) treeNode.expanded = true
  })
  await scrollCurrentTreeNodeIntoView()
}

function getExpandedKeys(node: StorageNode) {
  const keys: number[] = []
  let parentId = node.parent
  while (parentId) {
    keys.unshift(parentId)
    parentId = locationStore.getNodeById(parentId)?.parent ?? null
  }
  return keys
}

async function handleNodeClick(data: TreeNode) {
  if (!data.data) return
  try {
    const nodeDetail = await getLocationNodeDetail(data.id)
    selectedNode.value = nodeDetail
    locationStore.markRecentLocation(nodeDetail.id)
    selectedGoodsIds.value = []
    batchTargetLocation.value = undefined
    resetGoodsFilters()
    locationPagination.value.page = 1
    await Promise.all([loadNodeSummary(nodeDetail.id), loadNodeGoods(nodeDetail.id)])
  } catch (err: any) {
    ElMessage.error(err.message || '获取节点详情失败')
  }
}

async function loadNodeSummary(nodeId: number) {
  summaryLoading.value = true
  try {
    summary.value = await getLocationNodeSummary(nodeId)
  } catch {
    summary.value = null
  } finally {
    summaryLoading.value = false
  }
}

async function loadNodeGoods(nodeId: number, page = locationPagination.value.page) {
  goodsLoading.value = true
  try {
    const response = await getLocationNodeGoods(nodeId, goodsScope.value === 'children', page, locationPagination.value.page_size)
    locationGuziList.value = response.results || []
    locationPagination.value = {
      count: response.count ?? locationGuziList.value.length,
      page: response.page ?? page,
      page_size: response.page_size ?? locationPagination.value.page_size,
      next: response.next ?? null,
      previous: response.previous ?? null,
    }
  } catch {
    locationGuziList.value = []
  } finally {
    goodsLoading.value = false
  }
}

function handleScopeChange() {
  if (!selectedNode.value) return
  locationPagination.value.page = 1
  selectedGoodsIds.value = []
  resetGoodsFilters()
  loadNodeGoods(selectedNode.value.id, 1)
}

function handlePageChange(page: number) {
  if (!selectedNode.value) return
  locationPagination.value.page = page
  loadNodeGoods(selectedNode.value.id, page)
}

async function refreshSelectedNode() {
  await locationStore.fetchNodes(true)
  if (selectedNode.value) {
    const id = selectedNode.value.id
    selectedNode.value = await getLocationNodeDetail(id)
    await Promise.all([loadNodeSummary(id), loadNodeGoods(id)])
  }
}

function handleAddNode() {
  isEdit.value = false
  editingNodeId.value = null
  formData.value = normalizeForm(null)
  if (selectedNode.value) formData.value.parent = selectedNode.value.id
  dialogVisible.value = true
}

function handleEditNode(node: StorageNode) {
  isEdit.value = true
  editingNodeId.value = node.id
  formData.value = normalizeForm(node)
  dialogVisible.value = true
}

function handleMoveNode(node: StorageNode) {
  handleEditNode(node)
}

async function handleDeleteNode(node: StorageNode) {
  const childrenIds = locationStore.getChildrenIds(node.id)
  const hasChildren = childrenIds.length > 1
  const impactCount = summary.value?.descendant_goods_count ?? node.descendant_goods_count ?? 0
  try {
    await ElMessageBox.confirm(
      hasChildren
        ? `将删除 ${childrenIds.length} 个位置，并将 ${impactCount} 件谷子设为未定位。确认删除？`
        : `将把 ${impactCount} 件谷子设为未定位。确认删除？`,
      '删除位置',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    await deleteLocationNode(node.id)
    ElMessage.success('删除成功')
    selectedNode.value = null
    summary.value = null
    locationGuziList.value = []
    await locationStore.fetchNodes(true)
  } catch {
    // 用户取消
  }
}

async function handleSubmit() {
  const payload: Partial<StorageNode> = {
    name: formData.value.name.trim(),
    code: formData.value.code.trim() || null,
    parent: formData.value.parent,
    order: formData.value.order,
    description: formData.value.description,
    capacity: formData.value.capacity || null,
    node_type: formData.value.node_type,
    is_favorite: formData.value.is_favorite,
  }
  if (!payload.name) {
    ElMessage.warning('请输入位置名称')
    return
  }
  try {
    if (isEdit.value && editingNodeId.value) {
      await patchLocationNode(editingNodeId.value, payload)
      await moveLocationNode(editingNodeId.value, { parent: payload.parent ?? null, order: payload.order })
      ElMessage.success('位置已更新')
    } else {
      await createLocationNode(payload)
      ElMessage.success('位置已创建')
    }
    dialogVisible.value = false
    await refreshSelectedNode()
  } catch (err: any) {
    ElMessage.error(err.message || '保存失败')
  }
}

function handleDialogClose() {
  formData.value = normalizeForm(null)
}

function openGoodsDetail(goods: GoodsListItem) {
  selectedGoodsId.value = goods.id
  detailDrawerVisible.value = true
}

function toggleGoodsSelection(id: string) {
  selectedGoodsIds.value = selectedGoodsIds.value.includes(id)
    ? selectedGoodsIds.value.filter((item) => item !== id)
    : [...selectedGoodsIds.value, id]
}

function clearSelection() {
  selectedGoodsIds.value = []
  batchTargetLocation.value = undefined
}

async function handleBatchMove() {
  if (batchTargetLocation.value === undefined) return
  await moveSelectedGoods(batchTargetLocation.value)
}

async function handleBatchMoveToUnassigned() {
  await moveSelectedGoods(null)
}

async function moveSelectedGoods(targetLocation: number | null) {
  try {
    await moveLocationGoods({
      goods_ids: selectedGoodsIds.value,
      target_location: targetLocation,
    })
    ElMessage.success('移动成功')
    clearSelection()
    await refreshSelectedNode()
    if (unassignedVisible.value) await fetchUnassignedGoods(unassignedPagination.value.page)
  } catch (err: any) {
    ElMessage.error(err.message || '移动失败')
  }
}

function buildUnassignedSearchParams(page: number): GoodsSearchParams {
  const params: GoodsSearchParams = {
    page,
    page_size: unassignedPagination.value.page_size,
    location__isnull: true,
  }
  const search = unassignedFilters.search.trim()
  if (search) params.search = search
  if (unassignedFilters.ip) params.ip = unassignedFilters.ip
  if (unassignedFilters.character) params.character = unassignedFilters.character
  if (unassignedFilters.category) params.category = unassignedFilters.category
  if (unassignedFilters.is_official !== undefined) params.is_official = unassignedFilters.is_official
  if (selectedUnassignedStatuses.value.length === 1) {
    params.status = selectedUnassignedStatuses.value[0]
  } else if (selectedUnassignedStatuses.value.length > 1) {
    params.status__in = selectedUnassignedStatuses.value.join(',')
  }
  return params
}

function resetUnassignedFilterState() {
  unassignedFilters.search = ''
  unassignedFilters.ip = undefined
  unassignedFilters.character = undefined
  unassignedFilters.category = undefined
  unassignedFilters.is_official = undefined
  selectedUnassignedStatuses.value = []
}

async function preloadUnassignedGoodsCount() {
  try {
    const response = await getGoodsList({
      page: 1,
      page_size: 1,
      location__isnull: true,
    })
    unassignedPagination.value.count = response.count ?? unassignedGoods.value.length
  } catch {
    unassignedPagination.value.count = 0
  }
}

async function fetchUnassignedMetadata() {
  await Promise.all([
    metadataStore.fetchIPs(),
    metadataStore.fetchCategories(),
  ])
}

async function openUnassignedGoodsDialog() {
  unassignedVisible.value = true
  resetUnassignedFilterState()
  await Promise.all([
    fetchUnassignedMetadata(),
    fetchUnassignedGoods(1),
  ])
}

async function fetchUnassignedGoods(page: number | Event = 1) {
  const nextPage = typeof page === 'number' ? page : 1
  unassignedLoading.value = true
  unassignedError.value = null
  try {
    const response = await getGoodsList(buildUnassignedSearchParams(nextPage))
    unassignedGoods.value = response.results || []
    unassignedPagination.value = {
      count: response.count ?? unassignedGoods.value.length,
      page: response.page ?? nextPage,
      page_size: response.page_size ?? unassignedPagination.value.page_size,
      next: response.next ?? null,
      previous: response.previous ?? null,
      results: response.results || [],
    }
  } catch (err: any) {
    unassignedGoods.value = []
    unassignedError.value = err.message || '加载待整理谷子失败'
  } finally {
    unassignedLoading.value = false
  }
}

async function handleUnassignedIPChange() {
  unassignedFilters.character = undefined
  if (unassignedFilters.ip) {
    await metadataStore.fetchIPCharacters(unassignedFilters.ip)
  }
  await fetchUnassignedGoods(1)
}

async function resetUnassignedFilters() {
  resetUnassignedFilterState()
  await fetchUnassignedGoods(1)
}

async function moveUnassignedGoodsToCurrent(goodsId: string) {
  if (!selectedNode.value) {
    ElMessage.warning('先选择左侧位置后可放入')
    return
  }
  movingUnassignedGoodsId.value = goodsId
  try {
    await moveLocationGoods({
      goods_ids: [goodsId],
      target_location: selectedNode.value.id,
    })
    ElMessage.success('已放入当前位置')
    await refreshSelectedNode()
    await fetchUnassignedGoods(unassignedPagination.value.page)
    if (unassignedGoods.value.length === 0 && unassignedPagination.value.page > 1) {
      await fetchUnassignedGoods(unassignedPagination.value.page - 1)
    }
  } catch (err: any) {
    ElMessage.error(err.message || '放入当前位置失败')
  } finally {
    movingUnassignedGoodsId.value = null
  }
}

function formatGoodsCharacters(goods: GoodsListItem) {
  const names = goods.characters?.map((character) => character.name).filter(Boolean) ?? []
  if (names.length === 0) return ''
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 人`
}

function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  if (!categories.length) return []

  const nodeMap = new Map<number, CategoryTreeNode>()
  const rootNodes: CategoryTreeNode[] = []

  categories.forEach((category) => {
    nodeMap.set(category.id, {
      id: category.id,
      label: category.name,
      children: [],
    })
  })

  categories.forEach((category) => {
    const node = nodeMap.get(category.id)
    if (!node) return

    if (category.parent === null) {
      rootNodes.push(node)
      return
    }

    const parent = nodeMap.get(category.parent)
    if (parent) {
      parent.children = parent.children || []
      parent.children.push(node)
    }
  })

  const sortNodes = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => {
      const categoryA = categories.find((category) => category.id === a.id)
      const categoryB = categories.find((category) => category.id === b.id)
      return (categoryA?.order ?? 0) - (categoryB?.order ?? 0) || a.label.localeCompare(b.label, 'zh-Hans-CN')
    })
    nodes.forEach((node) => {
      if (node.children?.length) sortNodes(node.children)
      if (node.children?.length === 0) delete node.children
    })
  }

  sortNodes(rootNodes)
  return rootNodes
}

watch(treeKeyword, (keyword) => {
  treeRef.value?.filter(keyword)
})

watch(
  () => route.query.highlight,
  () => {
    applyHighlightFromRoute()
  },
)

onMounted(async () => {
  await locationStore.fetchNodes()
  await preloadUnassignedGoodsCount()
  await applyHighlightFromRoute()
})
</script>

<style scoped>
.location-workbench {
  --loc-gold: #d4af37;
  --loc-ink: #243042;
  --loc-muted: #6b7280;
  --loc-line: #e5e7eb;
  --loc-panel: #ffffff;
  --loc-soft: #f6f7f9;
  min-height: calc(100vh - 60px);
  padding: 18px;
  color: var(--loc-ink);
}

.location-shell {
  display: grid;
  grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
  gap: 18px;
  max-width: 1480px;
  margin: 0 auto;
  min-height: calc(100vh - 96px);
}

.location-sidebar,
.location-detail {
  background: var(--loc-panel);
  border: 1px solid var(--loc-line);
  border-radius: 8px;
  min-width: 0;
}

.location-sidebar {
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 14px;
}

.sidebar-header,
.plate-title-row,
.plate-actions,
.workbench-toolbar,
.toolbar-left,
.toolbar-right,
.batch-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sidebar-header,
.workbench-toolbar {
  justify-content: space-between;
}

.eyebrow {
  margin: 0 0 2px;
  font-size: 12px;
  color: var(--loc-gold);
  font-weight: 700;
}

h1,
h2 {
  margin: 0;
  letter-spacing: 0;
}

h1 {
  font-size: 22px;
}

h2 {
  font-size: 26px;
}

.location-create-btn {
  --brand-add-padding-y: 7px;
  --brand-add-padding-x: 12px;
  --brand-add-gap: 0;
  --brand-add-min-height: 32px;
  --brand-add-font-size: 13px;
  --brand-add-bg:
    linear-gradient(135deg, rgba(255, 248, 230, 0.98) 0%, rgba(255, 255, 255, 0.94) 100%),
    #fff8e6;
  --brand-add-shadow: 0 8px 18px rgba(212, 175, 55, 0.12);
  --brand-add-shadow-hover: 0 10px 22px rgba(212, 175, 55, 0.18);
  --brand-add-focus-ring: 0 0 0 3px rgba(212, 175, 55, 0.16);
  border: 1px solid rgba(212, 175, 55, 0.46) !important;
  color: #7a5b08 !important;
  flex-shrink: 0;
}

.location-create-btn:hover,
.location-create-btn:focus-visible {
  --brand-add-bg:
    linear-gradient(135deg, rgba(255, 244, 211, 1) 0%, rgba(255, 250, 238, 1) 100%),
    #fff4d3;
  border-color: rgba(212, 175, 55, 0.72) !important;
  color: #6b4a05 !important;
}

.location-create-btn__content {
  gap: 0;
}

.location-create-btn__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  margin-right: 7px;
  transform: translateY(-0.5px);
}

.location-create-btn__label {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  white-space: nowrap;
}

.tree-search,
.goods-search {
  width: 100%;
}

.goods-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 0;
}

.mini-filter {
  width: 148px;
}

.quick-access-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 11px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(255, 248, 230, 0.72), rgba(255, 255, 255, 0.92) 44%),
    #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.quick-access-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.quick-access-kicker {
  display: block;
  color: #7a5b08;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
}

.quick-access-head p {
  margin: 3px 0 0;
  color: var(--loc-muted);
  font-size: 11px;
  line-height: 1.35;
}

.quick-access-section {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
}

.quick-access-section--favorite {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.quick-access-section--recent {
  flex-wrap: nowrap;
  overflow: hidden;
}

.quick-access-section--recent .quick-access-section-title {
  flex: 0 0 auto;
}

.quick-access-section-title {
  flex: 0 0 100%;
  grid-column: 1 / -1;
  color: var(--loc-muted);
  font-size: 11px;
  font-weight: 800;
}

.quick-location-card,
.quick-location-chip {
  min-width: 0;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: rgba(255, 255, 255, 0.9);
  color: #334155;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.quick-location-card:hover,
.quick-location-card:focus-visible,
.quick-location-chip:hover,
.quick-location-chip:focus-visible {
  border-color: rgba(212, 175, 55, 0.58);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.07);
  transform: translateY(-1px);
  outline: none;
}

.quick-location-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 7px;
  border-color: rgba(212, 175, 55, 0.34);
  border-radius: 11px;
  background:
    linear-gradient(135deg, rgba(255, 248, 230, 0.94), rgba(255, 255, 255, 0.9)),
    #fff8e6;
}

.quick-location-main,
.quick-location-meta,
.quick-location-chip span,
.quick-location-chip small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-location-main {
  color: #243042;
  font-size: 11px;
  font-weight: 800;
}

.quick-location-meta {
  color: #8a650b;
  font-size: 10px;
  line-height: 1.25;
}

.quick-location-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 1 auto;
  max-width: 118px;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 12px;
}

.quick-location-chip small {
  color: #94a3b8;
  font-size: 10px;
}

.tree-panel {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding-right: 2px;
}

.custom-tree {
  --el-tree-node-hover-bg-color: #f7f3e8;
}

:deep(.el-tree-node__content) {
  min-height: 48px;
  height: auto;
  border-radius: 7px;
  margin: 2px 0;
}

.tree-node {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px 5px 0;
}

.tree-node-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.node-label,
.node-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-label {
  font-size: 14px;
  font-weight: 700;
}

.node-path {
  font-size: 11px;
  color: var(--loc-muted);
}

.node-count {
  min-width: 26px;
  height: 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(212, 175, 55, 0.13);
  color: #8a650b;
  font-size: 12px;
  font-weight: 700;
}

.node-count.empty {
  background: #f1f5f9;
  color: #94a3b8;
}

.location-detail {
  padding: 18px;
  overflow: auto;
}

.location-compact-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid rgba(212, 175, 55, 0.35);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(212, 175, 55, 0.1), rgba(255, 255, 255, 0) 34%),
    #fff;
}

.compact-main {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(360px, 0.95fr);
  gap: 14px;
  align-items: center;
}

.plate-copy {
  min-width: 0;
}

.breadcrumb-line {
  margin-bottom: 4px;
  color: var(--loc-muted);
  font-size: 12px;
}

.plate-description {
  margin: 5px 0 0;
  color: #475569;
  line-height: 1.4;
  font-size: 13px;
}

.muted {
  color: #94a3b8;
}

.compact-metrics {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(76px, 1fr));
  gap: 0;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.72);
  overflow: hidden;
}

.compact-metric {
  min-width: 0;
  padding: 9px 12px;
  border-left: 1px solid #edf2f7;
}

.compact-metric:first-child {
  border-left: 0;
}

.compact-metric span {
  display: block;
  color: var(--loc-muted);
  font-size: 11px;
  line-height: 1.2;
  margin-bottom: 3px;
  white-space: nowrap;
}

.compact-metric strong {
  display: block;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-metric--primary strong,
.compact-metric--capacity strong {
  color: #7a5b08;
}

.compact-metric--muted strong {
  color: #64748b;
  font-size: 17px;
}

.plate-actions {
  align-self: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
  padding: 4px;
  border: 0;
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.64);
  box-shadow: none;
}

.plate-actions :deep(.el-button) {
  min-height: 34px;
  margin-left: 0;
  padding: 7px 10px;
  border-radius: 999px;
  border-color: transparent;
  background: transparent;
  color: #475569;
  font-weight: 700;
  box-shadow: none;
}

.plate-actions :deep(.el-button:hover),
.plate-actions :deep(.el-button:focus) {
  border-color: rgba(212, 175, 55, 0.26);
  background: rgba(255, 250, 240, 0.88);
  color: #7a5b08;
}

.plate-actions :deep(.el-button--danger) {
  border-color: transparent;
  background: transparent;
  color: #dc2626;
}

.plate-actions :deep(.el-button--danger:hover),
.plate-actions :deep(.el-button--danger:focus) {
  border-color: rgba(239, 68, 68, 0.22);
  background: rgba(255, 241, 242, 0.82);
  color: #b91c1c;
}

.workbench-toolbar {
  margin: 10px 0 8px;
  flex-wrap: wrap;
}

.workbench-toolbar :deep(.el-segmented) {
  padding: 3px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  box-shadow:
    inset 0 0 0 1px rgba(226, 232, 240, 0.82),
    0 10px 26px rgba(15, 23, 42, 0.05);
}

.workbench-toolbar :deep(.el-segmented__item) {
  border-radius: 11px;
}

.workbench-toolbar :deep(.el-segmented__item-selected) {
  border-radius: 11px;
  border: 1px solid rgba(255, 255, 255, 0.58);
  background:
    linear-gradient(135deg, rgba(255, 245, 207, 0.92) 0%, rgba(212, 175, 55, 0.7) 100%),
    rgba(234, 211, 154, 0.72);
  backdrop-filter: blur(10px) saturate(140%);
  box-shadow:
    0 8px 18px rgba(212, 175, 55, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.74),
    inset 0 -1px 0 rgba(122, 91, 8, 0.12);
}

.workbench-toolbar :deep(.el-segmented__item-selected .el-segmented__item-label) {
  color: #7a5b08;
  font-weight: 800;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.48);
}

.toolbar-left {
  flex: 1;
  min-width: 280px;
}

.goods-search {
  max-width: 320px;
}

.goods-search :deep(.el-input__wrapper),
.mini-filter :deep(.el-select__wrapper) {
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow:
    0 7px 18px rgba(15, 23, 42, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.94);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.goods-search :deep(.el-input__wrapper:hover),
.mini-filter :deep(.el-select__wrapper:hover) {
  border-color: rgba(212, 175, 55, 0.4);
  box-shadow:
    0 9px 20px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);
}

.goods-search :deep(.el-input__wrapper.is-focus),
.mini-filter :deep(.el-select__wrapper.is-focused) {
  border-color: rgba(212, 175, 55, 0.62);
  box-shadow:
    0 0 0 3px rgba(212, 175, 55, 0.12),
    0 9px 20px rgba(15, 23, 42, 0.06);
}

.add-goods-entry {
  min-width: 132px;
  border: 1px solid rgba(212, 175, 55, 0.46);
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(255, 248, 230, 0.98) 0%, rgba(255, 255, 255, 0.94) 100%),
    #fff8e6;
  color: #7a5b08;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(212, 175, 55, 0.12);
}

.add-goods-entry:hover,
.add-goods-entry:focus {
  border-color: rgba(212, 175, 55, 0.72);
  background:
    linear-gradient(135deg, rgba(255, 244, 211, 1) 0%, rgba(255, 250, 238, 1) 100%),
    #fff4d3;
  color: #6b4a05;
  transform: translateY(-1px);
}

.add-goods-count {
  margin-left: 6px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.16);
  color: #8a650b;
  font-size: 11px;
  font-weight: 800;
}

.batch-bar {
  margin: 12px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff8e6;
  border: 1px solid rgba(212, 175, 55, 0.35);
  flex-wrap: wrap;
}

.batch-target {
  width: 260px;
}

.goods-section {
  margin-top: 12px;
}

.recent-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 10px;
}

.strip-title {
  flex: 0 0 auto;
  color: var(--loc-muted);
  font-size: 12px;
  font-weight: 700;
}

.recent-goods {
  flex: 0 0 auto;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 12px;
  padding: 6px 10px;
  cursor: pointer;
  color: #334155;
  box-shadow: 0 7px 18px rgba(15, 23, 42, 0.05);
}

.guzi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 14px;
}

.goods-card-shell {
  position: relative;
  min-width: 0;
}

.select-mark {
  position: absolute;
  top: 9px;
  right: 9px;
  z-index: 5;
  width: 28px;
  height: 28px;
}

.select-mark input {
  position: absolute;
  opacity: 0;
}

.select-mark span {
  display: block;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: rgba(15, 23, 42, 0.35);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
}

.select-mark input:checked + span {
  background: var(--loc-gold);
}

.pagination-row {
  display: flex;
  justify-content: center;
  margin-top: 18px;
}

.empty-workbench {
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.unassigned-goods-dialog) {
  max-height: 80vh;
}

:global(.unassigned-goods-dialog .el-dialog__body) {
  padding: 0 20px 18px;
}

.unassigned-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: calc(80vh - 96px);
  min-height: min(520px, calc(100vh - 160px));
}

.unassigned-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.unassigned-search {
  flex: 1;
  min-width: 0;
}

.unassigned-filters {
  padding: 12px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #f8fafc;
}

.unassigned-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.unassigned-filters :deep(.el-form-item) {
  margin-bottom: 0;
}

.unassigned-filters :deep(.el-form-item__label) {
  margin-bottom: 5px;
  color: var(--loc-muted);
  font-weight: 700;
  line-height: 1.2;
}

.unassigned-filters :deep(.el-select),
.unassigned-filters :deep(.el-tree-select) {
  width: 100%;
}

.unassigned-status-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  min-width: 0;
}

.unassigned-status-title {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--loc-muted);
}

.unassigned-status-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.unassigned-status-group :deep(.el-checkbox-button__inner) {
  border: 1px solid #d8dee8;
  border-radius: 999px;
  padding: 6px 11px;
  box-shadow: none;
  font-size: 12px;
}

.unassigned-status-group :deep(.el-checkbox-button:first-child .el-checkbox-button__inner),
.unassigned-status-group :deep(.el-checkbox-button:last-child .el-checkbox-button__inner) {
  border-radius: 999px;
}

.unassigned-status-group :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  border-color: rgba(212, 175, 55, 0.85);
  background: rgba(212, 175, 55, 0.13);
  color: #7a5b08;
}

.unassigned-result-area {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.unassigned-state-box {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.unassigned-state-box > * {
  width: 100%;
}

.unassigned-result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.unassigned-result-card {
  min-width: 0;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.unassigned-result-card:hover {
  border-color: rgba(212, 175, 55, 0.6);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.unassigned-preview {
  width: 100%;
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.unassigned-thumb,
.unassigned-thumb-placeholder {
  width: 70px;
  height: 70px;
  border-radius: 7px;
}

.unassigned-thumb {
  background: #f1f5f9;
  overflow: hidden;
}

.unassigned-thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  background: #f1f5f9;
}

.unassigned-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.unassigned-name {
  color: var(--loc-ink);
  font-size: 14px;
  font-weight: 800;
  line-height: 1.35;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.unassigned-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  color: var(--loc-muted);
  font-size: 12px;
  line-height: 1.4;
}

.unassigned-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  padding-left: 80px;
}

.unassigned-tags {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.unassigned-pager-row {
  display: flex;
  justify-content: center;
  padding-top: 2px;
}

:global(.location-node-dialog),
:global(.location-node-dialog .el-dialog) {
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.18);
  border-radius: 24px;
  background: #fff;
  box-shadow:
    0 28px 70px rgba(15, 23, 42, 0.18),
    0 10px 24px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

:global(.location-node-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 20px 24px 10px;
  border-bottom: 0;
  background: transparent;
}

:global(.location-node-dialog .el-dialog__headerbtn) {
  top: 20px;
  right: 20px;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  transition: background-color 0.16s ease, transform 0.16s ease;
}

:global(.location-node-dialog .el-dialog__headerbtn:hover) {
  background: rgba(212, 175, 55, 0.13);
  transform: rotate(90deg);
}

:global(.location-node-dialog .el-dialog__headerbtn .el-dialog__close) {
  color: #6b7280;
  font-size: 16px;
}

:global(.location-node-dialog .el-dialog__body) {
  max-height: none;
  overflow: visible;
  padding: 14px 24px 0;
}

:global(.location-node-dialog .el-dialog__footer) {
  padding: 10px 24px 18px;
  background: transparent;
  box-shadow: none;
}

.location-dialog-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 540px;
}

.location-dialog-kicker {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.13);
  color: #8a650b;
  font-size: 11px;
  font-weight: 800;
}

.location-dialog-title {
  margin: 0;
  color: var(--loc-ink);
  font-size: 25px;
  font-weight: 800;
  line-height: 1.16;
}

.location-dialog-subtitle {
  margin: 0;
  color: var(--loc-muted);
  font-size: 13px;
  line-height: 1.55;
}

.location-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.location-form-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #eef2f7;
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.86)),
    radial-gradient(circle at top right, rgba(212, 175, 55, 0.08), transparent 32%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.location-form-section--identity {
  border-color: rgba(212, 175, 55, 0.18);
  background:
    linear-gradient(90deg, rgba(212, 175, 55, 0.08), rgba(255, 255, 255, 0) 38%),
    rgba(255, 255, 255, 0.9);
}

.location-form-section--structure {
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(255, 255, 255, 0.9)),
    radial-gradient(circle at top right, rgba(36, 48, 66, 0.04), transparent 30%);
}

.location-form-section--notes {
  background: rgba(255, 255, 255, 0.9);
}

.location-section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #475569;
  font-size: 12px;
  font-weight: 800;
}

.location-section-title::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--loc-gold);
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.12);
}

.location-dialog-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.location-field--wide {
  grid-column: 1 / -1;
}

.location-dialog-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.location-dialog-form :deep(.el-form-item__label) {
  margin-bottom: 5px;
  color: #566174;
  font-weight: 800;
  line-height: 1.2;
}

.location-dialog-form :deep(.el-input),
.location-dialog-form :deep(.el-select),
.location-dialog-form :deep(.el-tree-select),
.location-dialog-form :deep(.el-input-number) {
  width: 100%;
}

.location-number-input {
  width: 100%;
  display: block;
}

.location-dialog-form :deep(.el-input__wrapper),
.location-dialog-form :deep(.el-textarea__inner),
.location-dialog-form :deep(.el-select__wrapper),
.location-dialog-form :deep(.el-tree-select .el-input__wrapper),
.location-dialog-form :deep(.el-input-number .el-input__wrapper) {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 5px 16px rgba(15, 23, 42, 0.035);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.location-dialog-form :deep(.el-input__wrapper),
.location-dialog-form :deep(.el-select__wrapper) {
  padding: 3px 12px;
}

.location-dialog-form :deep(.el-input__wrapper:hover),
.location-dialog-form :deep(.el-textarea__inner:hover),
.location-dialog-form :deep(.el-select__wrapper:hover) {
  border-color: rgba(212, 175, 55, 0.36);
}

.location-dialog-form :deep(.el-input__wrapper.is-focus),
.location-dialog-form :deep(.el-textarea__inner:focus),
.location-dialog-form :deep(.el-select__wrapper.is-focused) {
  border-color: rgba(212, 175, 55, 0.68);
  background: #fff;
  box-shadow:
    0 0 0 3px rgba(212, 175, 55, 0.14),
    0 8px 20px rgba(15, 23, 42, 0.06);
}

.location-dialog-form :deep(.el-textarea__inner) {
  min-height: 84px !important;
  padding: 10px 12px;
}

.location-dialog-form :deep(.el-input__count),
.location-dialog-form :deep(.el-input__count-inner),
.location-dialog-form :deep(.el-textarea__count) {
  color: #94a3b8;
  background: transparent;
}

.location-dialog-form :deep(.el-input__inner::placeholder),
.location-dialog-form :deep(.el-textarea__inner::placeholder) {
  color: #aeb7c5;
}

.location-number-input :deep(.el-input__wrapper) {
  width: 100%;
  padding-right: 12px;
}

.location-number-input :deep(.el-input__inner) {
  text-align: left;
}

.favorite-location-field :deep(.el-form-item__content) {
  display: flex;
  align-items: center;
  min-height: 34px;
}

.favorite-switch-control {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.favorite-location-switch {
  --el-switch-on-color: #ead39a;
  --el-switch-off-color: #dbe4ef;
  flex-shrink: 0;
}

.favorite-location-switch :deep(.el-switch__core) {
  min-width: 46px;
  height: 26px;
  border-color: rgba(148, 163, 184, 0.58);
  background-color: #dbe4ef;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
}

.favorite-location-switch :deep(.el-switch__action) {
  width: 20px;
  height: 20px;
  left: 3px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
}

.favorite-location-switch.is-checked :deep(.el-switch__core) {
  border-color: #d8b873;
  background:
    linear-gradient(135deg, #f7eac3 0%, #ead39a 100%),
    #ead39a;
}

.favorite-location-switch.is-checked :deep(.el-switch__core .el-switch__action) {
  left: calc(100% - 23px);
}

.favorite-location-switch :deep(.el-switch__inner),
.favorite-location-switch :deep(.el-switch__inner-wrapper),
.favorite-location-switch :deep(.el-switch__inner-wrapper span) {
  color: #334155;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.favorite-location-switch.is-checked :deep(.el-switch__inner),
.favorite-location-switch.is-checked :deep(.el-switch__inner-wrapper),
.favorite-location-switch.is-checked :deep(.el-switch__inner-wrapper span) {
  color: #4a3410;
}

.location-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.location-dialog-cancel {
  border-radius: 999px;
  border-color: rgba(148, 163, 184, 0.28);
  color: #475569;
  background: transparent;
}

.location-dialog-submit {
  min-width: 108px;
  border-color: #caa12e;
  border-radius: 999px;
  background: transparent;
  color: #1f2937;
  font-weight: 800;
  box-shadow: none;
}

.location-dialog-submit:hover,
.location-dialog-submit:focus {
  border-color: #bd9223;
  background: rgba(212, 175, 55, 0.08);
  color: #111827;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 960px) {
  .location-workbench {
    padding: 10px;
  }

  .location-shell {
    grid-template-columns: 1fr;
  }

  .location-sidebar {
    max-height: 44vh;
  }

  .location-create-btn {
    --brand-add-padding-y: 6px;
    --brand-add-padding-x: 11px;
    --brand-add-font-size: 12px;
    --brand-add-min-height: 30px;
  }

  .location-create-btn__icon {
    width: 14px;
    height: 14px;
    margin-right: 6px;
  }

  .location-compact-header {
    grid-template-columns: 1fr;
  }

  .compact-main {
    grid-template-columns: 1fr;
  }

  .plate-actions {
    justify-content: flex-start;
  }

  .compact-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar-left,
  .toolbar-right {
    width: 100%;
  }

  .goods-search,
  .batch-target {
    max-width: none;
    width: 100%;
  }

  .unassigned-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .location-compact-header {
    padding: 12px;
  }

  .compact-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .compact-metric:nth-child(odd) {
    border-left: 0;
  }

  .compact-metric:nth-child(n + 3) {
    border-top: 1px solid #edf2f7;
  }

  .guzi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  :global(.unassigned-goods-dialog) {
    width: calc(100vw - 20px) !important;
  }

  :global(.unassigned-goods-dialog .el-dialog__body) {
    padding: 0 14px 14px;
  }

  :global(.location-node-dialog .el-dialog) {
    border-radius: 0;
  }

  :global(.location-node-dialog .el-dialog__header) {
    padding: 20px 18px 16px;
  }

  :global(.location-node-dialog .el-dialog__body) {
    max-height: none;
    padding: 16px 14px 0;
  }

  :global(.location-node-dialog .el-dialog__footer) {
    padding: 16px 14px 18px;
  }

  .location-dialog-title {
    font-size: 23px;
  }

  .location-dialog-form-grid {
    grid-template-columns: 1fr;
  }

  .location-form-section {
    padding: 13px;
  }

  .location-dialog-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .favorite-location-field :deep(.el-switch) {
    align-self: flex-start;
  }

  .location-dialog-footer .el-button {
    width: 100%;
    margin-left: 0;
  }

  .unassigned-shell {
    min-height: calc(100vh - 180px);
  }

  .unassigned-toolbar,
  .unassigned-status-strip,
  .unassigned-card-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .unassigned-filter-grid,
  .unassigned-result-grid {
    grid-template-columns: 1fr;
  }

  .unassigned-card-footer {
    padding-left: 0;
  }

  .unassigned-card-footer .el-button {
    width: 100%;
  }
}
</style>
