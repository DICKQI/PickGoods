<template>
  <el-dialog
    :model-value="modelValue"
    title="从谷仓选购"
    width="min(1080px, calc(100vw - 32px))"
    class="showcase-add-goods-dialog"
    data-test="showcase-add-goods-dialog"
    align-center
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="add-goods-shell">
      <div class="add-goods-toolbar">
        <el-input
          v-model="filters.search"
          class="add-goods-search"
          data-test="add-goods-search-input"
          placeholder="搜索名称 / IP / 角色..."
          clearable
          :prefix-icon="Search"
          @keyup.enter="fetchGoods(1)"
        >
          <template #append>
            <el-button :loading="loading" @click="fetchGoods(1)">搜索</el-button>
          </template>
        </el-input>
        <el-button class="reset-button" :icon="RefreshLeft" @click="resetFilters">重置</el-button>
      </div>

      <el-form class="add-goods-filters" label-position="top" @submit.prevent>
        <div class="filter-fields-grid">
          <el-form-item label="IP">
            <el-select
              v-model="filters.ip"
              data-test="add-goods-ip-filter"
              placeholder="全部 IP"
              clearable
              filterable
              @change="handleIPChange"
            >
              <el-option v-for="ip in metadataStore.ips" :key="ip.id" :label="ip.name" :value="ip.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="角色">
            <el-select
              v-model="filters.character"
              data-test="add-goods-character-filter"
              placeholder="选择角色"
              clearable
              filterable
              :disabled="!filters.ip"
              @change="fetchGoods(1)"
            >
              <el-option v-for="character in characterOptions" :key="character.id" :label="character.name" :value="character.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="品类">
            <el-tree-select
              v-model="filters.category"
              data-test="add-goods-category-filter"
              :data="categoryTreeData"
              placeholder="全部品类"
              clearable
              check-strictly
              :props="{ label: 'label', value: 'id', children: 'children' }"
              @change="fetchGoods(1)"
            />
          </el-form-item>

          <el-form-item label="官谷 / 同人">
            <el-select
              v-model="filters.is_official"
              data-test="add-goods-official-filter"
              placeholder="全部"
              clearable
              @change="fetchGoods(1)"
            >
              <el-option label="官谷" :value="true" />
              <el-option label="同人" :value="false" />
            </el-select>
          </el-form-item>
        </div>

        <div class="status-filter-strip">
          <span class="status-filter-title">状态</span>
          <el-checkbox-group v-model="selectedStatuses" class="status-filter-group" @change="fetchGoods(1)">
            <el-checkbox-button data-test="add-goods-status-in-cabinet" label="in_cabinet">在馆</el-checkbox-button>
            <el-checkbox-button data-test="add-goods-status-outdoor" label="outdoor">出街中</el-checkbox-button>
            <el-checkbox-button data-test="add-goods-status-sold" label="sold">已售出</el-checkbox-button>
          </el-checkbox-group>
        </div>
      </el-form>

      <div class="result-area">
        <div v-if="error" class="state-box">
          <el-alert :title="error" type="error" :closable="false" />
        </div>

        <div v-else-if="loading && goodsList.length === 0" class="state-box">
          <el-skeleton :rows="6" animated />
        </div>

        <div v-else-if="goodsList.length === 0" class="state-box">
          <el-empty description="没有找到相关谷子" image-size="90" />
        </div>

        <div v-else class="result-grid">
          <article
            v-for="goods in goodsList"
            :key="goods.id"
            class="result-card"
            :data-test="`add-goods-card-${goods.id}`"
          >
            <div class="result-card-main">
              <button class="result-preview" type="button" @click="emit('openDetail', goods.id)">
                <el-image :src="goods.main_photo || ''" fit="cover" class="result-thumb">
                  <template #error>
                    <div class="thumb-placeholder">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                </el-image>
                <div class="result-info">
                  <div class="result-name" :title="goods.name">{{ goods.name }}</div>
                  <div class="result-meta">
                    <span>{{ goods.ip.name }}</span>
                    <span v-if="goods.category?.name">{{ goods.category.name }}</span>
                  </div>
                </div>
              </button>
            </div>

            <div class="result-card-footer">
              <div class="result-tags">
                <el-tag size="small" effect="plain">{{ statusLabelMap[goods.status] }}</el-tag>
                <el-tag size="small" effect="plain" :type="goods.is_official ? 'success' : 'info'">
                  {{ goods.is_official ? '官谷' : '同人' }}
                </el-tag>
              </div>

              <el-button
                :data-test="`add-goods-action-${goods.id}`"
                class="add-action"
                type="primary"
                size="small"
                :disabled="isExisting(goods.id)"
                :loading="mutating && !isExisting(goods.id)"
                @click="emit('add', goods.id)"
              >
                {{ isExisting(goods.id) ? '已在展柜' : '加入' }}
              </el-button>
            </div>
          </article>
        </div>
      </div>

      <div class="pager-row">
        <el-pagination
          v-if="pagination.count > 0"
          v-model:current-page="pagination.page"
          :page-size="pagination.page_size"
          :total="pagination.count"
          layout="total, prev, pager, next"
          small
          @current-change="fetchGoods"
        />
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Picture, RefreshLeft, Search } from '@element-plus/icons-vue'
import { getGoodsList } from '@/api/goods'
import { useMetadataStore } from '@/stores/metadata'
import type { Category, GoodsListItem, GoodsSearchParams, GoodsStatus, PaginatedResponse } from '@/api/types'

interface CategoryTreeNode {
  id: number
  label: string
  children?: CategoryTreeNode[]
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  existingGoodsIds: Set<string> | string[]
  mutating?: boolean
}>(), {
  mutating: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  add: [goodsId: string]
  openDetail: [goodsId: string]
}>()

const metadataStore = useMetadataStore()

const defaultPageSize = 18
const filters = reactive<{
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
const selectedStatuses = ref<GoodsStatus[]>(['in_cabinet'])
const loading = ref(false)
const error = ref<string | null>(null)
const goodsList = ref<GoodsListItem[]>([])
const pagination = reactive<PaginatedResponse<GoodsListItem>>({
  count: 0,
  page: 1,
  page_size: defaultPageSize,
  next: null,
  previous: null,
  results: [],
})

const statusLabelMap: Record<GoodsStatus, string> = {
  draft: '草稿',
  in_cabinet: '在馆',
  outdoor: '出街中',
  sold: '已售出',
}

const existingSet = computed(() => (
  props.existingGoodsIds instanceof Set
    ? props.existingGoodsIds
    : new Set(props.existingGoodsIds)
))

const isExisting = (goodsId: string) => existingSet.value.has(goodsId)

const characterOptions = computed(() => {
  if (!filters.ip) return []
  return metadataStore.charactersByIP[filters.ip] || []
})

const categoryTreeData = computed<CategoryTreeNode[]>(() => buildCategoryTree(metadataStore.categories))

const buildSearchParams = (page: number): GoodsSearchParams => {
  const params: GoodsSearchParams = {
    page,
    page_size: pagination.page_size,
  }
  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.ip) params.ip = filters.ip
  if (filters.character) params.character = filters.character
  if (filters.category) params.category = filters.category
  if (filters.is_official !== undefined) params.is_official = filters.is_official
  if (selectedStatuses.value.length === 1) {
    params.status = selectedStatuses.value[0]
  } else if (selectedStatuses.value.length > 1) {
    params.status__in = selectedStatuses.value.join(',')
  }
  return params
}

const resetFilterState = () => {
  filters.search = ''
  filters.ip = undefined
  filters.character = undefined
  filters.category = undefined
  filters.is_official = undefined
  selectedStatuses.value = ['in_cabinet']
}

const fetchMetadata = async () => {
  await Promise.all([
    metadataStore.fetchIPs(),
    metadataStore.fetchCategories(),
  ])
}

const fetchGoods = async (page = 1) => {
  loading.value = true
  error.value = null
  try {
    const data = await getGoodsList(buildSearchParams(page))
    Object.assign(pagination, data)
    goodsList.value = data.results
  } catch (e: unknown) {
    const err = e as { message?: string }
    error.value = err?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const handleIPChange = async () => {
  filters.character = undefined
  if (filters.ip) {
    await metadataStore.fetchIPCharacters(filters.ip)
  }
  await fetchGoods(1)
}

const resetFilters = async () => {
  resetFilterState()
  await fetchGoods(1)
}

const openDialog = async () => {
  resetFilterState()
  await Promise.all([
    fetchMetadata(),
    fetchGoods(1),
  ])
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      void openDialog()
    }
  },
  { immediate: true },
)

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
      return (categoryA?.order ?? 0) - (categoryB?.order ?? 0) || a.label.localeCompare(b.label)
    })
    nodes.forEach((node) => {
      if (node.children?.length) sortNodes(node.children)
      if (node.children?.length === 0) delete node.children
    })
  }

  sortNodes(rootNodes)
  return rootNodes
}
</script>

<style scoped>
:global(.showcase-add-goods-dialog) {
  max-height: 80vh;
}

:global(.showcase-add-goods-dialog .el-dialog__body) {
  padding: 0 20px 18px;
}

.add-goods-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: calc(80vh - 96px);
  min-height: 520px;
}

.add-goods-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  padding-top: 2px;
}

.add-goods-search {
  flex: 1;
}

.reset-button {
  flex: 0 0 auto;
}

.add-goods-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(143, 128, 232, 0.18);
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 246, 255, 0.88)),
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.16), transparent 32%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.filter-fields-grid {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) minmax(150px, 1fr) minmax(220px, 1.25fr) minmax(150px, 0.9fr);
  gap: 12px;
  align-items: end;
}

.status-filter-strip {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-start;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid rgba(143, 128, 232, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.68);
}

.status-filter-title {
  flex: 0 0 auto;
  color: #5f5874;
  font-weight: 600;
  line-height: 1;
}

.add-goods-filters :deep(.el-form-item) {
  margin-bottom: 0;
}

.add-goods-filters :deep(.el-form-item__label) {
  margin-bottom: 4px;
  color: #5f5874;
  font-weight: 600;
  line-height: 1.2;
}

.add-goods-filters :deep(.el-select),
.add-goods-filters :deep(.el-tree-select) {
  width: 100%;
}

.status-filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.status-filter-group :deep(.el-checkbox-button__inner) {
  min-width: 72px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(143, 128, 232, 0.28);
  color: #625a78;
  box-shadow: none;
}

.status-filter-group :deep(.el-checkbox-button:first-child .el-checkbox-button__inner),
.status-filter-group :deep(.el-checkbox-button:last-child .el-checkbox-button__inner) {
  border-radius: 999px;
}

.status-filter-group :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
  border-color: #d7b72b;
  background: #d7b72b;
  color: #fff;
}

.result-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.state-box {
  display: grid;
  min-height: 260px;
  place-items: center;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.result-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 142px;
  padding: 12px;
  border: 1px solid rgba(91, 84, 122, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 24px rgba(44, 38, 68, 0.07);
}

.result-card-main {
  min-width: 0;
}

.result-card-footer {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  justify-content: space-between;
  min-width: 0;
  padding-left: 76px;
}

.result-preview {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.result-thumb {
  width: 70px;
  height: 70px;
  overflow: hidden;
  border-radius: 8px;
  background: #f5f2ff;
}

.thumb-placeholder {
  display: grid;
  width: 70px;
  height: 70px;
  place-items: center;
  color: #a29bfe;
  background: linear-gradient(135deg, #f4f1ff, #fff7fb);
}

.result-info {
  min-width: 0;
  padding-right: 6px;
}

.result-name {
  display: -webkit-box;
  overflow: hidden;
  color: #2f2b3d;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.result-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
  overflow: hidden;
  color: #7a728d;
  font-size: 12px;
}

.result-meta span {
  overflow: hidden;
  max-width: 50%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-meta span + span::before {
  margin-right: 6px;
  color: #cbc4da;
  content: "/";
}

.result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.add-action {
  min-width: 86px;
  flex: 0 0 auto;
}

.pager-row {
  display: flex;
  justify-content: flex-end;
  min-height: 28px;
}

@media (max-width: 900px) {
  .add-goods-shell {
    min-height: 70vh;
  }

  .add-goods-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .add-goods-filters {
    gap: 10px;
  }

  .filter-fields-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-fields-grid .el-form-item:nth-child(3) {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  :global(.showcase-add-goods-dialog) {
    width: calc(100vw - 20px) !important;
  }

  :global(.showcase-add-goods-dialog .el-dialog__body) {
    padding: 0 12px 14px;
  }

  .add-goods-shell {
    min-height: 72vh;
    max-height: calc(84vh - 86px);
  }

  .add-goods-filters {
    padding: 10px;
  }

  .filter-fields-grid {
    grid-template-columns: 1fr;
  }

  .status-filter-strip {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .result-grid {
    grid-template-columns: 1fr;
  }

  .result-card-footer {
    padding-left: 0;
  }
}
</style>
