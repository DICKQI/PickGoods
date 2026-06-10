<template>
  <div class="stats-dashboard">
    <!-- 移动端筛选胶囊条 -->
    <div v-if="isMobile" class="mobile-stats-filter-strip">
      <button class="mobile-stats-filter-trigger" type="button" @click="openMobileStatsFilter">
        <el-icon><List /></el-icon>
        <span>统计筛选</span>
        <strong v-if="activeStatsFilterCount > 0">{{ activeStatsFilterCount }}</strong>
      </button>
      <div class="mobile-stats-filter-chips" aria-label="当前筛选">
        <span
          v-for="chip in activeStatsFilterChips"
          :key="chip"
          class="mobile-stats-filter-chip"
        >{{ chip }}</span>
      </div>
    </div>

    <!-- 桌面端筛选卡片 -->
    <el-card
      v-if="!isMobile"
      class="stats-filter-card"
      :class="{ 'stats-filter-card--collapsed': collapsed }"
      shadow="never"
      :body-style="statsFilterCardBodyStyle"
    >
      <template #header>
        <div class="stats-filter-header">
          <span>统计筛选</span>
          <div class="stats-filter-actions">
            <el-tooltip content="重置筛选" placement="top">
              <el-button
                text
                circle
                size="small"
                @click="handleResetFilters"
              >
                <el-icon>
                  <RefreshLeft />
                </el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip :content="collapsed ? '展开筛选' : '收起筛选'" placement="top">
              <el-button
                text
                circle
                size="small"
                class="stats-filter-toggle-btn"
                @click="toggleStatsFilterCollapsed"
              >
                <el-icon :class="['stats-filter-toggle-icon', { expanded: !collapsed }]">
                  <ArrowDown />
                </el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </template>

      <transition name="stats-filter-collapse">
        <div v-show="!collapsed" class="stats-filter-collapse-wrapper">
          <div class="stats-filter-grid">
            <stats-filter-controls
              :top="filters.top"
              :is-official="filters.is_official"
              :selected-statuses="selectedStatuses"
              :ip="filters.ip"
              :category="filters.category"
              :purchase-date-range="purchaseDateRange"
              :created-date-range="createdDateRange"
              :ip-options="ipOptions"
              :category-tree-data="categoryTreeData"
              @update:top="filters.top = $event"
              @update:is-official="filters.is_official = $event"
              @update:selected-statuses="selectedStatuses = $event"
              @update:ip="filters.ip = $event"
              @update:category="filters.category = $event"
              @update:purchase-date-range="purchaseDateRange = $event"
              @update:created-date-range="createdDateRange = $event"
            />
          </div>
        </div>
      </transition>
    </el-card>

    <!-- 移动端筛选底部面板 -->
    <div v-if="isMobile" class="mobile-stats-filter-host">
      <div
        v-show="mobileFilterVisible"
        class="mobile-stats-filter-backdrop"
        @click="closeMobileStatsFilter"
      />
      <section
        class="mobile-stats-filter-sheet"
        :class="{ 'is-open': mobileFilterVisible }"
        :aria-hidden="!mobileFilterVisible"
      >
        <div class="mobile-stats-filter-sheet-header">
          <span>统计筛选</span>
          <button class="mobile-stats-filter-close" type="button" @click="closeMobileStatsFilter" aria-label="关闭筛选">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="mobile-stats-filter-sheet-body">
          <div class="mobile-stats-filter-grid">
            <stats-filter-controls
              :top="mobileDraftFilters.top"
              :is-official="mobileDraftFilters.is_official"
              :selected-statuses="mobileDraftSelectedStatuses"
              :ip="mobileDraftFilters.ip"
              :category="mobileDraftFilters.category"
              :purchase-date-range="mobileDraftPurchaseDateRange"
              :created-date-range="mobileDraftCreatedDateRange"
              :ip-options="ipOptions"
              :category-tree-data="categoryTreeData"
              @update:top="mobileDraftFilters.top = $event"
              @update:is-official="mobileDraftFilters.is_official = $event"
              @update:selected-statuses="mobileDraftSelectedStatuses = $event"
              @update:ip="mobileDraftFilters.ip = $event"
              @update:category="mobileDraftFilters.category = $event"
              @update:purchase-date-range="mobileDraftPurchaseDateRange = $event"
              @update:created-date-range="mobileDraftCreatedDateRange = $event"
            />
          </div>
        </div>
        <div class="mobile-stats-filter-sheet-footer">
          <el-button class="mobile-stats-filter-reset" @click="resetMobileStatsFilterDraft">
            重置
          </el-button>
          <el-button type="primary" class="mobile-stats-filter-apply" @click="applyMobileStatsFilter">
            应用筛选
          </el-button>
        </div>
      </section>
    </div>

    <div class="stats-content" v-loading="loading">
      <div class="overview-carousel" :class="{ 'is-mobile': isMobile }">
        <div class="overview-carousel-track" ref="overviewCarouselRef">
          <el-row :gutter="16" class="overview-row">
            <el-col :xs="24" :sm="12" :md="8" class="overview-col" @click="scrollOverviewTo(0)">
              <el-card class="overview-card overview-card--goods" shadow="hover">
                <div class="overview-label">谷子件数</div>
                <div class="overview-value">{{ overview?.goods_count ?? 0 }}</div>
                <div class="overview-sub">不同 Asset 记录数</div>
              </el-card>
            </el-col>
            <el-col :xs="24" :sm="12" :md="8" class="overview-col" @click="scrollOverviewTo(1)">
              <el-card class="overview-card overview-card--quantity" shadow="hover">
                <div class="overview-label">总数量</div>
                <div class="overview-value">{{ overview?.quantity_sum ?? 0 }}</div>
                <div class="overview-sub">合计 quantity</div>
              </el-card>
            </el-col>
            <el-col :xs="24" :sm="12" :md="8" class="overview-col" @click="scrollOverviewTo(2)">
              <el-card class="overview-card overview-card--value" shadow="hover">
                <div class="overview-label">估算总金额</div>
                <div class="overview-value overview-value--money">
                  <span class="overview-currency">¥</span>
                  <span class="overview-amount">{{ formattedValueSum }}</span>
                </div>
                <div class="overview-sub">price×quantity 汇总</div>
              </el-card>
            </el-col>
          </el-row>
        </div>
        <div v-if="isMobile" class="overview-carousel-dots">
          <span
            v-for="i in 3"
            :key="i"
            class="overview-carousel-dot"
            :class="{ 'is-active': overviewActiveIndex === i - 1 }"
          />
        </div>
      </div>

      <!-- 移动端图表 Tab 切换 -->
      <div v-if="isMobile" class="chart-tabs">
        <button
          class="chart-tab"
          :class="{ 'is-active': chartTab === 'distribution' }"
          @click="chartTab = 'distribution'"
        >
          分布图
        </button>
        <button
          class="chart-tab"
          :class="{ 'is-active': chartTab === 'ranking' }"
          @click="chartTab = 'ranking'"
        >
          排行榜
        </button>
      </div>

      <!-- 分布图组：桌面端始终可见，移动端按 tab 切换 -->
      <div v-show="!isMobile || chartTab === 'distribution'" class="chart-group">
        <el-row :gutter="16" class="charts-row">
          <el-col :xs="24" :sm="12" :md="8">
            <el-card shadow="hover" class="chart-card">
              <div v-if="loading && !statsData" class="chart-skeleton" />
              <template v-else>
                <div class="chart-title">状态分布</div>
                <div ref="statusChartRef" class="chart-container" />
              </template>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :md="8">
            <el-card shadow="hover" class="chart-card">
              <div v-if="loading && !statsData" class="chart-skeleton" />
              <template v-else>
                <div class="chart-title">官谷 / 同人</div>
                <div ref="officialChartRef" class="chart-container" />
              </template>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-card shadow="hover" class="chart-card">
              <div v-if="loading && !statsData" class="chart-skeleton" />
              <template v-else>
                <div class="chart-title">作品类型结构</div>
                <div ref="subjectChartRef" class="chart-container" />
              </template>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 排行榜组：桌面端始终可见，移动端按 tab 切换 -->
      <div v-show="!isMobile || chartTab === 'ranking'" class="chart-group">
        <el-row :gutter="16" class="charts-row">
          <el-col :xs="24" :md="12">
            <el-card shadow="hover" class="chart-card">
              <div v-if="loading && !statsData" class="chart-skeleton chart-skeleton--wide" />
              <template v-else>
                <div class="chart-title">IP Top {{ filters.top }}</div>
                <div ref="ipTopChartRef" class="chart-container chart-container--wide" />
              </template>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-card shadow="hover" class="chart-card">
              <div v-if="loading && !statsData" class="chart-skeleton chart-skeleton--wide" />
              <template v-else>
                <div class="chart-title">品类 Top {{ filters.top }}</div>
                <div ref="categoryTopChartRef" class="chart-container chart-container--wide" />
              </template>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <div v-if="!loading && !overview" class="empty-tip">
        <el-empty description="暂无统计数据，请调整筛选条件后重试" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { RefreshLeft, ArrowDown, List, Close } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { getGoodsStats } from '@/api/goods'
import { getIPList, getCategoryTree } from '@/api/metadata'
import { useLocationStore } from '@/stores/location'
import StatsFilterControls from '@/components/StatsFilterControls.vue'
import type {
  GoodsStatsOverview,
  GoodsStatsParams,
  GoodsStatsResponse,
  GoodsStatus,
  IP,
  Category,
} from '@/api/types'

const loading = ref(false)
const statsData = ref<GoodsStatsResponse | null>(null)
const DEFAULT_STATS_TOP = 10

// 筛选面板折叠状态（PC 默认展开，移动端默认收起，与谷仓页一致）
const isMobile = ref(false)
const isStatsFilterMobile = ref(false)
const collapsed = ref(false)
const statsFilterCardBodyStyle = computed(() => ({}))
const toggleStatsFilterCollapsed = () => {
  collapsed.value = !collapsed.value
}

// 移动端筛选底部面板
const mobileFilterVisible = ref(false)
let bodyOverflowBeforeStatsFilter = ''
let bodyOverflowLockedByStatsFilter = false

const mobileDraftFilters = reactive<GoodsStatsParams>({
  top: DEFAULT_STATS_TOP,
})
const mobileDraftSelectedStatuses = ref<GoodsStatus[]>([])
const mobileDraftPurchaseDateRange = ref<[string, string] | null>(null)
const mobileDraftCreatedDateRange = ref<[string, string] | null>(null)

const setStatsFilterDefaults = (target: GoodsStatsParams) => {
  target.top = DEFAULT_STATS_TOP
  target.ip = undefined
  target.category = undefined
  target.is_official = undefined
}

const copyStatsFilters = (source: GoodsStatsParams, target: GoodsStatsParams) => {
  target.top = source.top ?? DEFAULT_STATS_TOP
  target.ip = source.ip
  target.category = source.category
  target.is_official = source.is_official
}

const copyDateRange = (range: [string, string] | null): [string, string] | null =>
  range ? [range[0], range[1]] : null

const syncMobileDraftFromAppliedFilters = () => {
  copyStatsFilters(filters, mobileDraftFilters)
  mobileDraftSelectedStatuses.value = [...selectedStatuses.value]
  mobileDraftPurchaseDateRange.value = copyDateRange(purchaseDateRange.value)
  mobileDraftCreatedDateRange.value = copyDateRange(createdDateRange.value)
}

const applyMobileDraftToFilters = () => {
  copyStatsFilters(mobileDraftFilters, filters)
  selectedStatuses.value = [...mobileDraftSelectedStatuses.value]
  purchaseDateRange.value = copyDateRange(mobileDraftPurchaseDateRange.value)
  createdDateRange.value = copyDateRange(mobileDraftCreatedDateRange.value)
}

const resetMobileStatsFilterDraft = () => {
  setStatsFilterDefaults(mobileDraftFilters)
  mobileDraftSelectedStatuses.value = []
  mobileDraftPurchaseDateRange.value = null
  mobileDraftCreatedDateRange.value = null
}

const restoreBodyOverflowForStatsFilter = () => {
  if (!bodyOverflowLockedByStatsFilter) return
  document.body.style.overflow = bodyOverflowBeforeStatsFilter
  bodyOverflowBeforeStatsFilter = ''
  bodyOverflowLockedByStatsFilter = false
}

const openMobileStatsFilter = () => {
  syncMobileDraftFromAppliedFilters()
  mobileFilterVisible.value = true
}

const closeMobileStatsFilter = () => {
  mobileFilterVisible.value = false
  syncMobileDraftFromAppliedFilters()
}

const applyMobileStatsFilter = () => {
  applyMobileDraftToFilters()
  mobileFilterVisible.value = false
  syncMobileDraftFromAppliedFilters()
  fetchStats()
}

const statusLabelMap: Record<string, string> = {
  in_cabinet: '在馆',
  outdoor: '出街中',
  sold: '已售出',
}

const activeStatsFilterChips = computed(() => {
  const chips: string[] = []

  if (filters.top !== DEFAULT_STATS_TOP) {
    chips.push(`Top ${filters.top}`)
  }

  if (filters.is_official === true) {
    chips.push('官谷')
  } else if (filters.is_official === false) {
    chips.push('同人')
  }

  if (selectedStatuses.value.length > 0) {
    chips.push(
      selectedStatuses.value.map((s) => statusLabelMap[s] ?? s).join('/'),
    )
  }

  if (filters.ip) chips.push('IP')
  if (filters.category) chips.push('品类')
  if (purchaseDateRange.value) chips.push('入手日期')
  if (createdDateRange.value) chips.push('录入日期')

  return chips.length > 0 ? chips : ['全部']
})

const activeStatsFilterCount = computed(() => {
  const chips = activeStatsFilterChips.value
  if (chips.length === 1 && chips[0] === '全部') return 0
  return chips.length
})

// 概览卡片轮播
const overviewActiveIndex = ref(0)
const overviewCarouselRef = ref<HTMLDivElement | null>(null)

// 图表 Tab 切换（仅移动端）
const chartTab = ref<'distribution' | 'ranking'>('distribution')

const scrollOverviewTo = (index: number) => {
  if (!isMobile.value) return
  const el = overviewCarouselRef.value
  if (!el) return
  const target = el.querySelectorAll<HTMLElement>('.overview-col')[index]
  if (!target) return
  const trackPadding = parseFloat(getComputedStyle(el).paddingLeft) || 0
  const left = target.offsetLeft - trackPadding
  overviewActiveIndex.value = index
  el.scrollTo({ left, behavior: 'smooth' })
}

const handleOverviewScroll = () => {
  const el = overviewCarouselRef.value
  if (!el) return
  const cols = el.querySelectorAll('.overview-col')
  if (!cols.length) return
  const trackCenter = el.getBoundingClientRect().left + el.clientWidth / 2
  let closest = 0
  let minDist = Infinity
  cols.forEach((col, i) => {
    const rect = col.getBoundingClientRect()
    const dist = Math.abs(rect.left + rect.width / 2 - trackCenter)
    if (dist < minDist) {
      minDist = dist
      closest = i
    }
  })
  overviewActiveIndex.value = closest
}

const filters = reactive<GoodsStatsParams>({
  top: DEFAULT_STATS_TOP,
})

const selectedStatuses = ref<GoodsStatus[]>([])

const purchaseDateRange = ref<[string, string] | null>(null)
const createdDateRange = ref<[string, string] | null>(null)

const overview = computed<GoodsStatsOverview | null>(() =>
  statsData.value ? statsData.value.overview : null,
)

const formattedValueSum = computed(() => {
  if (!overview.value) return '0.00'
  const num = Number(overview.value.value_sum || 0)
  if (Number.isNaN(num)) return overview.value.value_sum
  return num.toFixed(2)
})

// 基础数据（IP / 品类树 / 位置树）
const ipOptions = ref<IP[]>([])
const categoryList = ref<Category[]>([])
const locationStore = useLocationStore()

interface CategoryTreeNode {
  id: number
  label: string
  children?: CategoryTreeNode[]
}

const categoryTreeData = computed<CategoryTreeNode[]>(() => {
  const list = categoryList.value
  if (!list.length) return []

  const nodeMap = new Map<number, CategoryTreeNode>()
  const roots: CategoryTreeNode[] = []

  list.forEach((c) => {
    nodeMap.set(c.id, {
      id: c.id,
      label: c.name,
      children: [],
    })
  })

  list.forEach((c) => {
    const node = nodeMap.get(c.id)!
    if (c.parent === null) {
      roots.push(node)
    } else {
      const parent = nodeMap.get(c.parent)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      }
    }
  })

  const sortTree = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.label.localeCompare(b.label))
    nodes.forEach((n) => n.children && sortTree(n.children))
  }
  sortTree(roots)
  return roots
})

// ECharts 图表实例
const statusChartRef = ref<HTMLDivElement | null>(null)
const officialChartRef = ref<HTMLDivElement | null>(null)
const subjectChartRef = ref<HTMLDivElement | null>(null)
const ipTopChartRef = ref<HTMLDivElement | null>(null)
const categoryTopChartRef = ref<HTMLDivElement | null>(null)

const chartInstances: echarts.ECharts[] = []

const getCssVar = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

const initChart = (el: HTMLDivElement | null): echarts.ECharts | null => {
  if (!el) return null
  let chart = echarts.getInstanceByDom(el)
  if (!chart) {
    chart = echarts.init(el)
    chartInstances.push(chart)
  }
  return chart
}

const disposeCharts = () => {
  chartInstances.splice(0).forEach((instance) => {
    instance.dispose()
  })
}

const updateCharts = () => {
  if (!statsData.value) return

  const { distributions } = statsData.value
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  const theme = {
    text: getCssVar('--text-dark', '#303133'),
    textSub: getCssVar('--text-light', '#909399'),
    border: getCssVar('--border-color', 'rgba(212, 175, 55, 0.3)'),
    gold: getCssVar('--primary-gold', '#D4AF37'),
    goldLight: getCssVar('--primary-gold-light', '#EACDA3'),
    purple: getCssVar('--accent-purple', '#A29BFE'),
    purpleLight: getCssVar('--accent-purple-light', '#C4B5FD'),
    grid: getCssVar('--secondary-gray-dark', '#E5E5E7'),
  }

  const palette = [
    '#F6D365', // Bright Sunshine Gold
    '#A29BFE', // Lavender
    '#FF9A9E', // Sakura Pink
    '#84FAB0', // Soft Cyan
    '#FDA085', // Peach
    '#D4AF37', // Classic Gold
    '#C4B5FD', // Light Purple
    '#FFD1FF', // Soft Pink
  ]

  const baseTextStyle = { color: theme.text }
  const baseLegend = {
    bottom: 0,
    textStyle: { color: theme.textSub },
    itemWidth: 10,
    itemHeight: 10,
  }
  const baseTooltip = {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: theme.border,
    borderWidth: 1,
    textStyle: { color: theme.text },
    extraCssText:
      'backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-radius: 10px; z-index: 3000;',
    // 避免 tooltip 被卡片/容器的 overflow 裁剪
    appendToBody: true,
    confine: false,
    renderMode: 'html',
  }

  // 状态分布饼图
  const statusChart = initChart(statusChartRef.value)
  if (statusChart) {
    const data = (distributions.status || []).map((item) => ({
      name: item.label,
      value: item.goods_count,
    }))
    statusChart.setOption({
      color: palette,
      textStyle: baseTextStyle,
      tooltip: { ...baseTooltip, trigger: 'item' },
      legend: baseLegend,
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          data,
          label: { color: theme.textSub },
          itemStyle: { borderColor: 'rgba(255,255,255,0.7)', borderWidth: 1 },
        },
      ],
    })
  }

  // 官谷 / 同人饼图
  const officialChart = initChart(officialChartRef.value)
  if (officialChart) {
    const data = (distributions.is_official || []).map((item) => ({
      name: item.label,
      value: item.goods_count,
    }))
    officialChart.setOption({
      color: palette,
      textStyle: baseTextStyle,
      tooltip: { ...baseTooltip, trigger: 'item' },
      legend: baseLegend,
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data,
          label: { color: theme.textSub },
          itemStyle: { borderColor: 'rgba(255,255,255,0.7)', borderWidth: 1 },
        },
      ],
    })
  }

  // 作品类型柱状图
  const subjectChart = initChart(subjectChartRef.value)
  if (subjectChart) {
    const items = distributions.ip_subject_type || []
    const rawCounts = items.map((i) => Number(i.goods_count || 0))
    const logCounts = rawCounts.map((v) => (Number.isFinite(v) && v > 0 ? v : 1))
    subjectChart.setOption({
      color: palette,
      textStyle: baseTextStyle,
      tooltip: {
        ...baseTooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params
          const idx = typeof p?.dataIndex === 'number' ? p.dataIndex : 0
          const label = items[idx]?.label ?? p?.axisValue ?? ''
          const raw = rawCounts[idx] ?? 0
          return [
            `<div style="font-weight:600;margin-bottom:6px;">${label}</div>`,
            `<div>数量：<b>${raw}</b></div>`,
          ].join('')
        },
      },
      grid: { left: 36, right: 18, top: 24, bottom: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: items.map((i) => i.label),
        axisLine: { lineStyle: { color: theme.grid } },
        axisTick: { alignWithLabel: true },
        axisLabel: { interval: 0, color: theme.textSub },
      },
      yAxis: {
        type: 'log',
        min: 1,
        logBase: 10,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.05)' } },
        axisLabel: {
          color: theme.textSub,
          formatter: (val: number) => {
            const v = Number(val)
            if (!Number.isFinite(v) || v <= 0) return ''
            // 仅展示 1/10/100/1000...，减少对数轴杂讯
            const p = Math.round(Math.log10(v))
            const pow = Math.pow(10, p)
            return Math.abs(v - pow) < 1e-6 ? String(v) : ''
          },
        },
      },
      series: [
        {
          type: 'bar',
          data: logCounts,
          barMaxWidth: 28,
          itemStyle: { borderRadius: [8, 8, 0, 0] },
        },
      ],
    })
  }

  // IP TopN 横向条形（移动端：预留 Y 轴标签空间并截断长文本）
  const ipTopChart = initChart(ipTopChartRef.value)
  if (ipTopChart) {
    const items = (distributions.ip_top || []).slice().reverse()
    const yAxisLabelMaxLen = isMobile ? 6 : undefined
    ipTopChart.setOption({
      color: palette,
      textStyle: baseTextStyle,
      tooltip: { ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: isMobile
        ? { left: '38%', right: '10%', top: 16, bottom: 16, containLabel: false }
        : { left: 110, right: 18, top: 24, bottom: 24, containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.05)' } },
        axisLabel: {
          color: theme.textSub,
          fontSize: isMobile ? 10 : undefined,
        },
      },
      yAxis: {
        type: 'category',
        data: items.map((i) => i.ip__name),
        axisLine: { lineStyle: { color: theme.grid } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.textSub,
          fontSize: isMobile ? 10 : undefined,
          formatter: yAxisLabelMaxLen
            ? (value: string) =>
                value.length > yAxisLabelMaxLen ? value.slice(0, yAxisLabelMaxLen) + '…' : value
            : undefined,
        },
      },
      series: [
        {
          type: 'bar',
          data: items.map((i) => i.goods_count),
          barMaxWidth: isMobile ? 16 : 18,
          itemStyle: { borderRadius: [0, 10, 10, 0] },
        },
      ],
    })
  }

  // 品类 TopN 横向条形（移动端：预留 Y 轴标签空间并截断长文本）
  const categoryTopChart = initChart(categoryTopChartRef.value)
  if (categoryTopChart) {
    const items = (distributions.category_top || []).slice().reverse()
    const yAxisLabelMaxLen = isMobile ? 8 : undefined
    categoryTopChart.setOption({
      color: palette,
      textStyle: baseTextStyle,
      tooltip: { ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: isMobile
        ? { left: '42%', right: '10%', top: 16, bottom: 16, containLabel: false }
        : { left: 130, right: 18, top: 24, bottom: 24, containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.05)' } },
        axisLabel: {
          color: theme.textSub,
          fontSize: isMobile ? 10 : undefined,
        },
      },
      yAxis: {
        type: 'category',
        data: items.map((i) => i.category__path_name || i.category__name),
        axisLine: { lineStyle: { color: theme.grid } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.textSub,
          fontSize: isMobile ? 10 : undefined,
          formatter: yAxisLabelMaxLen
            ? (value: string) =>
                value.length > yAxisLabelMaxLen ? value.slice(0, yAxisLabelMaxLen) + '…' : value
            : undefined,
        },
      },
      series: [
        {
          type: 'bar',
          data: items.map((i) => i.goods_count),
          barMaxWidth: isMobile ? 16 : 18,
          itemStyle: { borderRadius: [0, 10, 10, 0] },
        },
      ],
    })
  }

  chartInstances.forEach((c) => c.resize())
}

const buildRequestParams = (): GoodsStatsParams => {
  const params: GoodsStatsParams = {
    top: filters.top,
    ip: filters.ip,
    category: filters.category,
    is_official: filters.is_official,
  }

  if (selectedStatuses.value.length === 1) {
    params.status = selectedStatuses.value[0]
    params.status__in = undefined
  } else if (selectedStatuses.value.length > 1) {
    params.status = undefined
    params.status__in = selectedStatuses.value.join(',')
  }

  if (purchaseDateRange.value) {
    params.purchase_start = purchaseDateRange.value[0]
    params.purchase_end = purchaseDateRange.value[1]
  } else {
    params.purchase_start = undefined
    params.purchase_end = undefined
  }

  if (createdDateRange.value) {
    params.created_start = createdDateRange.value[0]
    params.created_end = createdDateRange.value[1]
  } else {
    params.created_start = undefined
    params.created_end = undefined
  }

  return params
}

const fetchStats = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const params = buildRequestParams()
    const data = await getGoodsStats(params)
    statsData.value = data
    if (!data || !data.overview) {
      ElMessage.info('当前筛选条件下暂无统计数据')
    }
    // 下一帧更新图表，确保 DOM 已渲染
    requestAnimationFrame(() => {
      updateCharts()
    })
  } catch (err: any) {
    console.error('加载统计数据失败', err)
    ElMessage.error(err?.message || '加载统计数据失败')
    statsData.value = null
  } finally {
    loading.value = false
  }
}

const handleResetFilters = () => {
  setStatsFilterDefaults(filters)
  selectedStatuses.value = []
  purchaseDateRange.value = null
  createdDateRange.value = null
  syncMobileDraftFromAppliedFilters()
  fetchStats()
}

const initMetadata = async () => {
  try {
    const [ips, categories] = await Promise.all([getIPList(), getCategoryTree()])
    ipOptions.value = ips
    categoryList.value = categories
  } catch {
    ElMessage.error('加载基础筛选数据失败')
  }
  // 确保位置树也加载好，便于后续扩展位置相关图表
  locationStore.fetchNodes()
}

let resizeTimer: number | null = null
const handleResize = () => {
  if (resizeTimer !== null) window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    resizeTimer = null
    isMobile.value = window.innerWidth < 768
    if (!isMobile.value) {
      closeMobileStatsFilter()
    }
    updateCharts()
  }, 150)
}

const handleStatsRefresh = async () => {
  await fetchStats()
  // 通知父组件刷新完成
  window.dispatchEvent(new CustomEvent('cloud-showcase:stats-refresh-complete'))
}

onMounted(async () => {
  isMobile.value = window.innerWidth < 768
  isStatsFilterMobile.value = isMobile.value
  collapsed.value = isMobile.value
  syncMobileDraftFromAppliedFilters()
  await initMetadata()
  await fetchStats()
  window.addEventListener('resize', handleResize)
  window.addEventListener('cloud-showcase:stats-refresh', handleStatsRefresh as EventListener)

  const carousel = overviewCarouselRef.value
  if (carousel) {
    carousel.addEventListener('scroll', handleOverviewScroll, { passive: true })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('cloud-showcase:stats-refresh', handleStatsRefresh as EventListener)
  disposeCharts()
  restoreBodyOverflowForStatsFilter()
  if (resizeTimer !== null) {
    window.clearTimeout(resizeTimer)
    resizeTimer = null
  }
  if (autoFetchTimer !== null) {
    window.clearTimeout(autoFetchTimer)
    autoFetchTimer = null
  }

  const carousel = overviewCarouselRef.value
  if (carousel) {
    carousel.removeEventListener('scroll', handleOverviewScroll)
  }
})

watch(
  () => statsData.value,
  () => {
    requestAnimationFrame(() => {
      updateCharts()
    })
  },
)

// 筛选条件变更时自动刷新数据（带简单防抖）
let autoFetchTimer: number | null = null
const triggerAutoFetch = () => {
  if (loading.value) return
  if (isMobile.value) return
  if (autoFetchTimer !== null) {
    window.clearTimeout(autoFetchTimer)
  }
  autoFetchTimer = window.setTimeout(() => {
    autoFetchTimer = null
    fetchStats()
  }, 300)
}

watch(
  () => [
    filters.top,
    filters.ip,
    filters.category,
    filters.is_official,
  ],
  () => {
    triggerAutoFetch()
  },
)

watch(
  selectedStatuses,
  () => {
    triggerAutoFetch()
  },
  { deep: true },
)

watch(purchaseDateRange, () => triggerAutoFetch())
watch(createdDateRange, () => triggerAutoFetch())

watch(mobileFilterVisible, (visible) => {
  if (visible) {
    if (bodyOverflowLockedByStatsFilter) return
    bodyOverflowBeforeStatsFilter = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    bodyOverflowLockedByStatsFilter = true
  } else {
    restoreBodyOverflowForStatsFilter()
  }
})

// 移动端图表 Tab 切换后，v-show 会导致图表容器尺寸变化，需要 resize
watch(chartTab, () => {
  if (!isMobile.value) return
  requestAnimationFrame(() => {
    chartInstances.forEach((c) => c.resize())
  })
})
</script>

<style scoped>
.stats-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-filter-card {
  border-radius: var(--card-radius);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
}

.stats-filter-card--collapsed :deep(.el-card__header) {
  border-bottom: none;
}

.stats-filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--primary-gold);
}

.stats-filter-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stats-filter-toggle-btn {
  padding: 4px;
  min-height: auto;
}

.stats-filter-toggle-icon {
  transition: transform var(--transition-fast, 0.2s ease);
}

.stats-filter-toggle-icon.expanded {
  transform: rotate(180deg);
}

/* 展开/收起外层：使用 grid-template-rows 实现高性能动画（与谷仓页一致） */
.stats-filter-collapse-wrapper {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.3s ease, opacity 0.2s ease;
  overflow: hidden;
}

.stats-filter-collapse-wrapper > :deep(.stats-filter-grid) {
  min-height: 0;
  overflow: hidden;
}

/* 展开/收起动画 */
.stats-filter-collapse-enter-active,
.stats-filter-collapse-leave-active {
  transition: grid-template-rows 0.3s ease, opacity 0.2s ease;
}

.stats-filter-collapse-enter-from,
.stats-filter-collapse-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.stats-filter-collapse-enter-to,
.stats-filter-collapse-leave-from {
  grid-template-rows: 1fr;
  opacity: 1;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.overview-row {
  margin-bottom: 8px;
}

.overview-card {
  border-radius: var(--card-radius);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.overview-card::before {
  content: '';
  position: absolute;
  right: -18px;
  bottom: -22px;
  width: 132px;
  height: 132px;
  transform: rotate(-14deg);
  opacity: 0.085;
  pointer-events: none;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  filter: saturate(1.05);
}

.overview-card--goods::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23D4AF37' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 38h84v56H18z'/%3E%3Cpath d='M28 38V26h64v12'/%3E%3Cpath d='M44 60h32'/%3E%3Cpath d='M44 72h32'/%3E%3C/g%3E%3C/svg%3E");
}

.overview-card--quantity::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23A29BFE' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M28 30h64v64H28z'/%3E%3Cpath d='M38 44h44'/%3E%3Cpath d='M38 60h30'/%3E%3Cpath d='M38 76h36'/%3E%3Ccircle cx='84' cy='60' r='6'/%3E%3C/g%3E%3C/svg%3E");
}

.overview-card--value::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23F6D365' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='60' cy='60' r='36'/%3E%3Ccircle cx='60' cy='60' r='26'/%3E%3Cpath d='M52 46h18'/%3E%3Cpath d='M52 74h18'/%3E%3Cpath d='M60 44v32'/%3E%3Cpath d='M54 54c2-3 10-3 12 0s-2 6-6 6-8 3-6 6 10 3 12 0'/%3E%3C/g%3E%3C/svg%3E");
}

.overview-label {
  font-size: 13px;
  color: var(--text-light);
  margin-bottom: 6px;
}

.overview-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-dark);
  margin-bottom: 4px;
}

.overview-value--money {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.overview-currency {
  font-size: 0.65em;
  font-weight: 600;
  color: var(--text-light);
  letter-spacing: 0.02em;
}

.overview-amount {
  font-variant-numeric: tabular-nums;
}

.overview-sub {
  font-size: 12px;
  color: var(--text-light);
}

/* 概览卡片轮播 */
.overview-carousel.is-mobile .overview-carousel-track {
  --overview-card-width: calc(80vw - 40px);
  --overview-track-padding: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: var(--overview-track-padding);
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding: 0 var(--overview-track-padding);
  margin: 0;
}

.overview-carousel.is-mobile .overview-carousel-track::-webkit-scrollbar {
  display: none;
}

.overview-carousel.is-mobile .overview-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.overview-carousel.is-mobile :deep(.overview-col) {
  flex: 0 0 var(--overview-card-width);
  max-width: var(--overview-card-width);
  width: var(--overview-card-width);
  scroll-snap-align: center;
  padding: 0 !important;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.overview-carousel-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
}

.overview-carousel-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-lighter);
  transition: background var(--transition-fast), transform var(--transition-fast);
}

.overview-carousel-dot.is-active {
  background: var(--primary-gold);
  transform: scale(1.5);
}

/* 移动端：概览卡片紧凑样式 */
@media (max-width: 768px) {
  .overview-row {
    margin-bottom: 4px;
  }

  .overview-card :deep(.el-card__body) {
    padding: 16px 14px;
  }

  .overview-label {
    font-size: 12px;
    margin-bottom: 4px;
  }

  .overview-value {
    font-size: 22px;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .overview-card::before {
    width: 96px;
    height: 96px;
    right: -16px;
    bottom: -18px;
    opacity: 0.06;
  }

  .overview-sub {
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.overview-progress-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-dark);
}

.progress-item span {
  width: 60px;
}

.charts-row {
  margin-bottom: 4px;
}

.chart-card {
  border-radius: var(--card-radius);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #F6D365 0%, #FF9A9E 50%, #A29BFE 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.chart-container {
  width: 100%;
  height: 260px;
}

.chart-container--wide {
  height: 320px;
}

/* 图表 Tab 切换（移动端） */
.chart-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.chart-tab {
  flex: 1;
  height: 36px;
  border: 1px solid rgba(212, 175, 55, 0.25);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-light);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.chart-tab.is-active {
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.16), rgba(234, 205, 163, 0.24));
  border-color: rgba(212, 175, 55, 0.5);
  color: var(--primary-gold-dark);
  box-shadow: 0 2px 8px rgba(212, 175, 55, 0.15);
}

/* 图表骨架屏 */
.chart-skeleton {
  width: 100%;
  height: 220px;
  border-radius: 14px;
  background: linear-gradient(90deg, #f1f5f9 0%, #ffffff 50%, #f1f5f9 100%);
  background-size: 220% 100%;
  animation: chartSkeleton 1.2s ease-in-out infinite;
}

.chart-skeleton--wide {
  height: 260px;
}

@keyframes chartSkeleton {
  0% {
    background-position: 120% 0;
  }
  100% {
    background-position: -120% 0;
  }
}

/* 图表组切换过渡 */
.chart-group {
  transition: opacity var(--transition-fast);
}

.empty-tip {
  margin-top: 24px;
}

:deep(.el-card__header) {
  border-bottom: 1px solid var(--border-color);
}

:deep(.el-card__body) {
  padding: 20px;
  transition: padding 0.3s;
}

.stats-filter-card--collapsed :deep(.el-card__body) {
  padding-top: 0;
  padding-bottom: 0;
}

:deep(.el-card) {
  border-color: var(--border-color);
}

@media (max-width: 768px) {
  .charts-row {
    row-gap: 12px;
  }

  .chart-container {
    height: 280px;
  }

  .chart-container--wide {
    height: 420px;
  }

  .chart-skeleton {
    height: 240px;
  }

  .chart-skeleton--wide {
    height: 380px;
  }
}

/* 移动端筛选胶囊条 */
.mobile-stats-filter-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.mobile-stats-filter-trigger {
  flex: 0 0 auto;
  min-width: 86px;
  height: 36px;
  border: 1px solid rgba(212, 175, 55, 0.42);
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.16), rgba(234, 205, 163, 0.24));
  color: var(--primary-gold-dark);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}

.mobile-stats-filter-trigger .el-icon {
  font-size: 16px;
}

.mobile-stats-filter-trigger strong {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--primary-gold);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
}

.mobile-stats-filter-chips {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.mobile-stats-filter-chips::-webkit-scrollbar {
  display: none;
}

.mobile-stats-filter-chip {
  flex: 0 0 auto;
  max-width: 96px;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  line-height: 28px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 移动端筛选底部面板 */
.mobile-stats-filter-host {
  display: block;
}

.mobile-stats-filter-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1300;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.mobile-stats-filter-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1301;
  max-height: min(82dvh, 720px);
  padding: 12px 12px calc(16px + env(safe-area-inset-bottom));
  border-radius: 24px 24px 0 0;
  background: #ffffff;
  box-shadow: 0 -18px 48px rgba(15, 23, 42, 0.22);
  transform: translateY(104%);
  visibility: hidden;
  pointer-events: none;
  transition:
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    visibility 0.28s;
}

.mobile-stats-filter-sheet.is-open {
  transform: translateY(0);
  visibility: visible;
  pointer-events: auto;
}

.mobile-stats-filter-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 2px 12px;
  color: var(--text-dark);
  font-size: 16px;
  font-weight: 800;
}

.mobile-stats-filter-close {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: #f3f4f6;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}

.mobile-stats-filter-sheet-body {
  max-height: calc(min(82dvh, 720px) - 130px);
  overflow-y: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}

.mobile-stats-filter-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mobile-stats-filter-sheet-footer {
  display: flex;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(212, 175, 55, 0.18);
}

.mobile-stats-filter-sheet-footer .el-button {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
}

.mobile-stats-filter-reset {
  border-color: rgba(212, 175, 55, 0.35);
  color: var(--primary-gold-dark);
  background: rgba(212, 175, 55, 0.08);
}

.mobile-stats-filter-apply {
  background: var(--accent-purple) !important;
  border-color: var(--accent-purple) !important;
}
</style>
