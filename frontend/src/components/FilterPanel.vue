<template>
  <div class="filter-panel">
    <el-card
      class="filter-card app-filter-surface"
      :class="{ 'is-collapsed': collapsed }"
      :body-style="cardBodyStyle"
      shadow="never"
    >
      <template #header>
        <div class="filter-header app-filter-header">
          <span>筛选谷子</span>
          <div class="filter-actions app-filter-actions">
            <!-- 视图模式切换 - 滑块样式 -->
            <div class="view-mode-toggle">
              <div class="toggle-slider" :class="{ 'is-similar': guziStore.viewMode === 'similar' }">
                <div class="slider-bg"></div>
                <button
                  class="toggle-option"
                  :class="{ active: guziStore.viewMode === 'standard' }"
                  :disabled="!!localFilters.group_by"
                  @click="handleViewModeChange('standard')"
                >
                  <el-icon><List /></el-icon>
                  <span>标准</span>
                </button>
                <button
                  class="toggle-option"
                  :class="{ active: guziStore.viewMode === 'similar' }"
                  :disabled="!!localFilters.group_by"
                  @click="handleViewModeChange('similar')"
                >
                  <el-icon><MagicStick /></el-icon>
                  <span>相似</span>
                </button>
              </div>
            </div>
            <el-tooltip content="重置筛选" placement="top">
              <el-button
                text
                circle
                size="small"
                class="reset-btn"
                aria-label="重置筛选"
                @click="handleReset"
              >
                <el-icon>
                  <RefreshLeft />
                </el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip
              v-if="!forceExpanded"
              :content="collapsed ? '展开筛选' : '收起筛选'"
              placement="top"
            >
              <el-button
                text
                circle
                size="small"
                class="app-filter-toggle-btn"
                :aria-label="collapsed ? '展开筛选' : '收起筛选'"
                @click="toggleCollapsed"
              >
                <el-icon :class="['app-filter-toggle-icon', { expanded: !collapsed }]">
                  <ArrowDown />
                </el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </template>

      <!-- 展开/收起动画 -->
      <transition name="app-filter-collapse">
        <div
          v-show="!collapsed"
          class="app-filter-collapse-wrapper"
        >
          <div class="filter-content app-filter-fields">
            <!-- IP筛选 -->
            <div class="filter-item">
          <label>IP作品</label>
          <el-select
            v-model="localFilters.ip"
            placeholder="选择IP"
            clearable
            filterable
            :filter-method="handleIPFilter"
            @change="handleFilterChange"
            style="width: 100%"
          >
            <el-option
              v-for="ip in filteredIpOptions"
              :key="ip.id"
              :label="ip.name"
              :value="ip.id"
            />
          </el-select>
        </div>

            <!-- 角色筛选（联动，支持文字搜索） -->
            <div class="filter-item">
          <label>角色</label>
          <el-select
            v-model="localFilters.character"
            placeholder="选择角色"
            clearable
            filterable
            :filter-method="handleCharacterFilter"
            :disabled="!localFilters.ip"
            @change="handleFilterChange"
            style="width: 100%"
          >
            <el-option
              v-for="char in filteredCharacters"
              :key="char.id"
              :label="char.name"
              :value="char.id"
            />
          </el-select>
        </div>

            <!-- 品类筛选（支持多层级树形选择） -->
            <div class="filter-item">
              <label>品类</label>
              <el-tree-select
                v-model="localFilters.category"
                :data="categoryTreeData"
                placeholder="选择品类"
                clearable
                filterable
                :filter-node-method="filterCategoryNode"
                @change="handleFilterChange"
                style="width: 100%"
                :props="{ label: 'label', value: 'id' }"
                check-strictly
              />
            </div>

            <!-- 主题筛选 -->
            <div class="filter-item">
              <label>主题</label>
              <el-select
                v-model="localFilters.theme"
                placeholder="选择主题"
                clearable
                filterable
                :filter-method="handleThemeFilter"
                @change="handleFilterChange"
                style="width: 100%"
              >
                <el-option
                  v-for="theme in filteredThemeOptions"
                  :key="theme.id"
                  :label="theme.name"
                  :value="theme.id"
                />
              </el-select>
            </div>

            <!-- 状态筛选（支持多选） -->
            <div class="filter-item filter-item--status">
          <label>状态</label>
          <el-checkbox-group
            v-model="selectedStatuses"
            class="status-group app-filter-status"
            @change="handleStatusChange"
          >
            <el-checkbox-button
              class="status-chip status-chip--in-cabinet"
              value="in_cabinet"
              aria-label="在馆"
              title="在馆"
            >
              <el-icon class="status-chip__icon" aria-hidden="true"><House /></el-icon>
              <span class="status-chip__label">在馆</span>
            </el-checkbox-button>
            <el-checkbox-button
              class="status-chip status-chip--intended"
              value="intended"
              aria-label="意向"
              title="意向"
            >
              <el-icon class="status-chip__icon" aria-hidden="true"><Star /></el-icon>
              <span class="status-chip__label">意向</span>
            </el-checkbox-button>
            <el-checkbox-button
              class="status-chip status-chip--outdoor"
              value="outdoor"
              aria-label="出街"
              title="出街"
            >
              <el-icon class="status-chip__icon" aria-hidden="true"><Van /></el-icon>
              <span class="status-chip__label">出街</span>
            </el-checkbox-button>
            <el-checkbox-button
              class="status-chip status-chip--sold"
              value="sold"
              aria-label="已售出"
              title="已售出"
            >
              <el-icon class="status-chip__icon" aria-hidden="true"><SoldOut /></el-icon>
              <span class="status-chip__label">已售出</span>
            </el-checkbox-button>
          </el-checkbox-group>
        </div>

            <!-- 官谷/同人筛选（三态：全部/官谷/同人） -->
            <div class="filter-item filter-item--official">
              <label>官谷/同人</label>
              <el-select
                v-model="localFilters.is_official"
                placeholder="全部"
                clearable
                @change="handleFilterChange"
                style="width: 100%"
              >
                <el-option label="官谷" :value="true" />
                <el-option label="同人" :value="false" />
              </el-select>
            </div>

            <!-- 位置筛选 -->
            <div class="filter-item">
              <label>位置</label>
              <el-tree-select
                v-model="localFilters.location"
                :data="locationTreeData"
                placeholder="选择位置"
                clearable
                @change="handleFilterChange"
                style="width: 100%"
                :props="{ label: 'label', value: 'id', children: 'children' }"
                check-strictly
              />
            </div>

            <!-- 分组显示筛选 -->
            <div class="filter-item">
              <label>分组显示</label>
              <el-select
                v-model="localFilters.group_by"
                placeholder="不分组"
                clearable
                @change="handleFilterChange"
                style="width: 100%"
              >
                <el-option label="按IP分组" value="ip" />
                <el-option label="按角色分组" value="character" />
                <el-option label="按品类分组" value="category" />
                <el-option label="按主题分组" value="theme" />
              </el-select>
            </div>
          </div>
        </div>
      </transition>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown, House, List, MagicStick, RefreshLeft, SoldOut, Star, Van } from '@element-plus/icons-vue'
import { useGuziStore } from '@/stores/guzi'
import { useLocationStore } from '@/stores/location'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { useMetadataStore } from '@/stores/metadata'
import { matchesTextOrPinyin } from '@/utils/pinyinSearch'
import type { Category, GoodsSearchParams, GoodsStatus } from '@/api/types'

const metadataStore = useMetadataStore()

// 从 store 读取已缓存数据（store 初始化时已 loadFromCache）
const ipOptions = computed(() => metadataStore.ips)
const categoryList = computed(() => metadataStore.categories)
const themeOptions = computed(() => metadataStore.themes)

// 品类树节点类型（用于 el-tree-select）
interface CategoryTreeNode {
  id: number
  label: string
  children?: CategoryTreeNode[]
}

const guziStore = useGuziStore()
const locationStore = useLocationStore()
const { isMobile } = useResponsiveDevice()

const props = withDefaults(defineProps<{
  forceExpanded?: boolean
}>(), {
  forceExpanded: false,
})

const forceExpanded = computed(() => props.forceExpanded)

// 设备类型 & 折叠状态（PC 默认展开，移动端默认收起）
const collapsed = ref(false)
// 统一由 CSS 控制 Card 内边距，避免动画过程中布局突变
const cardBodyStyle = computed(() => ({}))

const toggleCollapsed = () => {
  if (forceExpanded.value) return
  collapsed.value = !collapsed.value
}

const localFilters = ref<GoodsSearchParams>({
  ip: undefined,
  character: undefined,
  category: undefined,
  theme: undefined,
  status: undefined,
  status__in: undefined,
  is_official: undefined,
  location: undefined,
  group_by: undefined,
})

// 本地状态多选
const DEFAULT_SELECTED_STATUSES: GoodsStatus[] = ['in_cabinet', 'intended', 'outdoor']
const selectedStatuses = ref<GoodsStatus[]>([])
const ipSearchKeyword = ref('')
const characterSearchKeyword = ref('')
const themeSearchKeyword = ref('')

const locationTreeData = computed(() => locationStore.treeData)
const categoryMap = computed(() => {
  const map = new Map<number, Category>()
  categoryList.value.forEach((category) => {
    map.set(category.id, category)
  })
  return map
})

const filteredIpOptions = computed(() => (
  ipOptions.value.filter((ip) => matchesTextOrPinyin(
    ipSearchKeyword.value,
    [ip.name, ...(ip.keywords?.map((keyword) => keyword.value) ?? [])],
  ))
))

const filteredThemeOptions = computed(() => (
  themeOptions.value.filter((theme) => matchesTextOrPinyin(themeSearchKeyword.value, theme.name))
))

// 将品类列表转换为树形结构（用于 el-tree-select）
const categoryTreeData = computed(() => {
  const list = categoryList.value
  if (!list || list.length === 0) return []

  // 创建节点映射
  const nodeMap = new Map<number, CategoryTreeNode>()
  const rootNodes: CategoryTreeNode[] = []

  // 第一遍：创建所有节点
  list.forEach((category) => {
    const treeNode: CategoryTreeNode = {
      id: category.id,
      label: category.name,
      children: [],
    }
    nodeMap.set(category.id, treeNode)
  })

  // 第二遍：建立父子关系
  list.forEach((category) => {
    const treeNode = nodeMap.get(category.id)!
    if (category.parent === null) {
      rootNodes.push(treeNode)
    } else {
      const parentNode = nodeMap.get(category.parent)
      if (parentNode) {
        if (!parentNode.children) {
          parentNode.children = []
        }
        parentNode.children.push(treeNode)
      }
    }
  })

  // 排序：按 order 字段排序，然后按名称排序
  const sortTree = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => {
      const categoryA = list.find((cat) => cat.id === a.id)
      const categoryB = list.find((cat) => cat.id === b.id)
      const orderA = categoryA?.order ?? 0
      const orderB = categoryB?.order ?? 0
      return orderA - orderB || a.label.localeCompare(b.label)
    })
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        sortTree(node.children)
      }
    })
  }

  sortTree(rootNodes)
  return rootNodes
})

const filteredCharacters = computed(() => {
  if (!localFilters.value.ip) return []
  return (metadataStore.charactersByIP[localFilters.value.ip] || [])
    .filter((character) => matchesTextOrPinyin(characterSearchKeyword.value, character.name))
})

const handleIPFilter = (keyword: string) => {
  ipSearchKeyword.value = keyword
}

const handleCharacterFilter = (keyword: string) => {
  characterSearchKeyword.value = keyword
}

const handleThemeFilter = (keyword: string) => {
  themeSearchKeyword.value = keyword
}

const filterCategoryNode = (keyword: string, data?: CategoryTreeNode) => {
  if (!data) return false
  const category = categoryMap.value.get(data.id)
  return matchesTextOrPinyin(keyword, [data.label, category?.path_name ?? ''])
}

const applyStatusToFilters = (filters: GoodsSearchParams) => {
  // 先清空状态相关字段
  filters.status = undefined
  filters.status__in = undefined

  // 根据选中的状态构造单状态或多状态参数
  if (selectedStatuses.value.length === 1) {
    filters.status = selectedStatuses.value[0]
  } else if (selectedStatuses.value.length > 1) {
    filters.status__in = selectedStatuses.value.join(',')
  }
}

const handleFilterChange = () => {
  // 如果IP改变，清空角色选择并预加载该IP的角色列表
  if (localFilters.value.ip !== guziStore.filters.ip) {
    localFilters.value.character = undefined
    characterSearchKeyword.value = ''
    if (localFilters.value.ip) {
      metadataStore.fetchIPCharacters(localFilters.value.ip)
    }
  }

  const filters: GoodsSearchParams = {
    ip: localFilters.value.ip || undefined,
    character: localFilters.value.character || undefined,
    category: localFilters.value.category || undefined,
    theme: localFilters.value.theme || undefined,
    is_official: localFilters.value.is_official,
    location: localFilters.value.location || undefined,
    group_by: localFilters.value.group_by || undefined,
  }

  applyStatusToFilters(filters)

  guziStore.searchGuzi(filters)
}

// 状态多选变更时，同步到统一的处理函数
const handleStatusChange = () => {
  handleFilterChange()
}

const handleReset = () => {
  ipSearchKeyword.value = ''
  characterSearchKeyword.value = ''
  themeSearchKeyword.value = ''
  localFilters.value = {
    ip: undefined,
    character: undefined,
    category: undefined,
    theme: undefined,
    status: undefined,
    status__in: undefined,
    is_official: undefined,
    location: undefined,
    group_by: undefined,
  }
  selectedStatuses.value = [...DEFAULT_SELECTED_STATUSES]
  handleFilterChange()
}

// 视图模式切换处理函数
const handleViewModeChange = (mode: 'standard' | 'similar') => {
  guziStore.setViewMode(mode)
}

// 同步外部筛选条件
watch(
  () => guziStore.filters,
  (newFilters) => {
    localFilters.value = {
      ip: newFilters.ip,
      character: newFilters.character,
      category: newFilters.category,
      theme: newFilters.theme,
      status: newFilters.status,
      status__in: newFilters.status__in,
      is_official: newFilters.is_official,
      location: newFilters.location,
      group_by: newFilters.group_by,
    }

    // 同步 store 中的状态到本地多选
    if (newFilters.status__in) {
      selectedStatuses.value = newFilters.status__in.split(',') as GoodsStatus[]
    } else if (newFilters.status) {
      selectedStatuses.value = [newFilters.status]
    } else {
      selectedStatuses.value = []
    }
  },
  { deep: true },
)

onMounted(async () => {
  // 根据统一设备判定决定默认展开/收起
  collapsed.value = forceExpanded.value ? false : isMobile.value

  // 从 store 同步初始筛选条件到本地状态
  localFilters.value = {
    ip: guziStore.filters.ip,
    character: guziStore.filters.character,
    category: guziStore.filters.category,
    theme: guziStore.filters.theme,
    status: guziStore.filters.status,
    status__in: guziStore.filters.status__in,
    is_official: guziStore.filters.is_official,
    location: guziStore.filters.location,
    group_by: guziStore.filters.group_by,
  }

  // 同步状态多选
  if (guziStore.filters.status__in) {
    selectedStatuses.value = guziStore.filters.status__in.split(',') as GoodsStatus[]
  } else if (guziStore.filters.status) {
    selectedStatuses.value = [guziStore.filters.status]
  } else {
    // 页面首次进入且未指定状态时，默认显示除“已售出”外的谷子
    selectedStatuses.value = [...DEFAULT_SELECTED_STATUSES]
    // 触发一次筛选，确保列表与默认状态一致
    handleFilterChange()
  }

  // 加载基础数据（store 初始化时已从 localStorage 恢复缓存，此处仅触发后台刷新）
  try {
    await metadataStore.fetchAll()
  } catch {
    ElMessage.error('加载基础数据失败')
  }

  locationStore.fetchNodes()
})
watch(forceExpanded, (value) => {
  if (value) {
    collapsed.value = false
  }
})

watch(isMobile, (mobile) => {
  if (forceExpanded.value) {
    collapsed.value = false
    return
  }
  collapsed.value = mobile
})
onUnmounted(() => {})
</script>

<style scoped>
.filter-panel {
  margin-bottom: 20px;
}

/* 卡片表面、标题、操作区与折叠动效统一由 styles/filterPanel.css 提供 */

/* 视图模式切换 - 与筛选卡片共用金色/奶油配色 */
.view-mode-toggle {
  display: flex;
  align-items: center;
}

.toggle-slider {
  position: relative;
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 999px;
  background: rgba(255, 249, 234, 0.8);
}

.slider-bg {
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(50% - 3px);
  height: calc(100% - 4px);
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(212, 175, 55, 0.16);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;
}

.toggle-slider.is-similar .slider-bg {
  transform: translateX(calc(100% + 2px));
}

.toggle-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(100, 116, 139, 0.92);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.3s;
  z-index: 1;
}

.toggle-option:hover:not(:disabled) {
  color: #606266;
}

.toggle-option.active {
  color: var(--primary-gold-dark);
  font-weight: 800;
}

.toggle-option:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.toggle-option .el-icon {
  font-size: 14px;
}

/* 筛选内容：PC 用自适应网格，移动端单列 */
.filter-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  /* 间距自适应：不同屏宽下更均衡 */
  gap: clamp(12px, 1.6vw, 20px);
  align-items: start;
  min-height: 0; /* 确保内部内容在折叠时不会溢出 */
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* PC 大屏：强制单行显示，使用更稳定的分配方式 */
@media (min-width: 1280px) {
  .filter-content {
    /* 使用更稳定的分配方式：前4个等宽，状态自适应，官谷/同人压缩，位置略宽，分组显示略宽 */
    grid-template-columns: repeat(4, 1fr) auto minmax(80px, 0.8fr) 1.1fr 1.1fr;
    gap: 12px;
    align-items: start;     /* 顶部对齐，确保所有元素垂直位置一致 */
    white-space: nowrap;    /* 防止内部元素由于挤压而换行 */
  }

  /* 针对"官谷/同人"下拉框的特定优化 */
  .filter-item--official {
    min-width: 90px;
  }
}

/* 针对 1280px 以下、769px 以上的屏幕（如 13寸笔记本） */
@media (min-width: 769px) and (max-width: 1279px) {
  .filter-content {
    /* 在这个区间，8 个筛选器自适应缩放 */
    grid-template-columns: repeat(8, minmax(80px, 1fr));
    gap: 8px;
  }
}

/* 移动端：单列排布，控件与胶囊沿用共享样式 */
@media (max-width: 768px), (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .filter-panel {
    margin-bottom: 12px;
  }

  .filter-content {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
