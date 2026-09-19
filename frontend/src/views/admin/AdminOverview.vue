<template>
  <div class="admin-page admin-overview">
    <AdminPageHeader title="运营总览" subtitle="先处理待办，再观察数据变化。">
      <el-radio-group v-model="range" size="small" @change="loadOverview">
        <el-radio-button value="7d">近 7 天</el-radio-button>
        <el-radio-button value="30d">近 30 天</el-radio-button>
      </el-radio-group>
      <el-button :loading="loading" @click="loadOverview">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </AdminPageHeader>

    <div v-if="errorMessage" class="admin-page-error">
      <el-result icon="error" title="总览加载失败" :sub-title="errorMessage">
        <template #extra>
          <el-button type="primary" @click="loadOverview">重新加载</el-button>
        </template>
      </el-result>
    </div>

    <template v-else>
      <section v-loading="loading" class="overview-alerts" aria-label="待办事项">
        <template v-if="overview?.alerts.length">
          <button
            v-for="alert in overview.alerts"
            :key="alert.code"
            type="button"
            class="overview-alert"
            :class="`is-${alert.severity}`"
            @click="router.push(alert.href)"
          >
            <span class="overview-alert__dot" />
            <span class="overview-alert__copy">
              <strong>{{ alert.title }}</strong>
              <small>{{ alert.count }} 项待处理</small>
            </span>
            <el-icon><ArrowRight /></el-icon>
          </button>
        </template>
        <div v-else-if="overview" class="overview-clear">
          <el-icon><CircleCheck /></el-icon>
          当前没有需要立即处理的运维事项
        </div>
      </section>

      <section v-loading="loading" class="overview-metrics" aria-label="核心指标">
        <article v-for="metric in metrics" :key="metric.label" class="overview-metric">
          <div class="overview-metric__label">
            <span>{{ metric.label }}</span>
            <el-icon><component :is="metric.icon" /></el-icon>
          </div>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.hint }}</small>
        </article>
      </section>

      <section class="overview-main-grid">
        <el-card shadow="never" class="overview-panel overview-trend-panel">
          <template #header>
            <div class="overview-panel__header">
              <div>
                <strong>增长趋势</strong>
                <span>新增用户与谷子记录</span>
              </div>
              <el-tag effect="plain" type="info">{{ rangeLabel }}</el-tag>
            </div>
          </template>
          <div ref="trendChartRef" class="overview-chart" aria-label="增长趋势图" />
        </el-card>

        <el-card shadow="never" class="overview-panel overview-catalog-panel">
          <template #header>
            <div class="overview-panel__header">
              <div>
                <strong>内容资产</strong>
                <span>目录与激励配置规模</span>
              </div>
            </div>
          </template>
          <div class="catalog-list">
            <button
              v-for="item in catalogItems"
              :key="item.label"
              type="button"
              @click="router.push(item.href)"
            >
              <span><el-icon><component :is="item.icon" /></el-icon>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </button>
          </div>
        </el-card>
      </section>

      <section class="overview-detail-grid">
        <el-card shadow="never" class="overview-panel">
          <template #header>
            <div class="overview-panel__header">
              <div>
                <strong>最近同步任务</strong>
                <span>BGM 角色增量同步运行状态</span>
              </div>
              <el-button link type="primary" @click="router.push('/admin/bgm-sync')">
                查看全部
              </el-button>
            </div>
          </template>
          <el-table :data="overview?.recent_jobs || []" size="small">
            <el-table-column prop="id" label="任务" width="72">
              <template #default="{ row }">#{{ row.id }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="jobStatusType(row.status)" size="small" effect="plain">
                  {{ jobStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="进展" min-width="150">
              <template #default="{ row }">
                {{ row.success_count }}/{{ row.total_ips }} 成功 · {{ row.failed_count }} 失败
              </template>
            </el-table-column>
            <el-table-column prop="started_at" label="开始时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.started_at) }}</template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="never" class="overview-panel">
          <template #header>
            <div class="overview-panel__header">
              <div>
                <strong>最近管理操作</strong>
                <span>高风险操作审计摘要</span>
              </div>
              <el-button link type="primary" @click="router.push('/admin/audit-logs')">
                查看全部
              </el-button>
            </div>
          </template>
          <div v-if="overview?.recent_audits.length" class="audit-list">
            <div v-for="item in overview.recent_audits" :key="item.id" class="audit-item">
              <span class="audit-item__dot" />
              <div>
                <strong>{{ item.summary }}</strong>
                <small>{{ item.actor_name || '系统' }} · {{ formatDateTime(item.created_at) }}</small>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无操作日志" :image-size="72" />
        </el-card>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts/core'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { LineChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECharts, EChartsOption } from 'echarts'
import {
  ArrowRight,
  Box,
  Brush,
  CircleCheck,
  Collection,
  Goods,
  Medal,
  Picture,
  Refresh,
  Star,
  User,
} from '@element-plus/icons-vue'
import { getAdminOverview } from '@/api/admin'
import type { AdminOverviewResponse } from '@/api/types'
import { formatDateTime } from '@/utils/datetime'
import { createLatestRequestGuard } from '@/composables/useLatestRequest'
import AdminPageHeader from './components/AdminPageHeader.vue'

echarts.use([GridComponent, LegendComponent, TooltipComponent, LineChart, CanvasRenderer])

const router = useRouter()
const range = ref<'7d' | '30d'>('30d')
const loading = ref(false)
const overviewRequests = createLatestRequestGuard()
const overview = ref<AdminOverviewResponse | null>(null)
const errorMessage = ref('')
const trendChartRef = ref<HTMLDivElement | null>(null)
let trendChart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const rangeLabel = computed(() => (range.value === '7d' ? '近 7 天' : '近 30 天'))
const metrics = computed(() => {
  const stats = overview.value?.stats
  return [
    {
      label: '用户总数',
      value: formatNumber(stats?.users.total),
      hint: `${formatNumber(stats?.users.new_in_range)} 个${rangeLabel.value}新增`,
      icon: User,
    },
    {
      label: '待审批社团',
      value: formatNumber(stats?.users.pending_clubs),
      hint: `${formatNumber(stats?.users.active)} 个启用账号`,
      icon: CircleCheck,
    },
    {
      label: '谷子记录',
      value: formatNumber(stats?.goods.total),
      hint: `${formatNumber(stats?.goods.new_in_range)} 条${rangeLabel.value}新增`,
      icon: Goods,
    },
    {
      label: '持有件数',
      value: formatNumber(stats?.goods.quantity),
      hint: `估值 ¥${formatMoney(stats?.goods.value)}`,
      icon: Box,
    },
    {
      label: '缺少主图',
      value: formatNumber(stats?.goods.missing_photo),
      hint: '点击进入筛选列表',
      icon: Picture,
    },
    {
      label: 'BGM 任务',
      value: formatNumber(stats?.bgm.running),
      hint: `${formatNumber(stats?.bgm.recent_failures)} 个近期异常`,
      icon: Refresh,
    },
  ]
})

const catalogItems = computed(() => {
  const stats = overview.value?.stats
  return [
    { label: 'IP 作品', value: formatNumber(stats?.catalog.ips), icon: Collection, href: '/admin/ip' },
    { label: '角色', value: formatNumber(stats?.catalog.characters), icon: User, href: '/admin/ip?tab=characters' },
    { label: '品类', value: formatNumber(stats?.catalog.categories), icon: Box, href: '/admin/categories' },
    { label: '主题', value: formatNumber(stats?.catalog.themes), icon: Brush, href: '/admin/themes' },
    { label: '启用成就', value: formatNumber(stats?.gamification.active_achievements), icon: Medal, href: '/admin/gamification' },
    { label: '启用奖励', value: formatNumber(stats?.gamification.active_rewards), icon: Star, href: '/admin/gamification?tab=rewards' },
  ]
})

function formatNumber(value?: number) {
  return new Intl.NumberFormat('zh-CN').format(value || 0)
}

function formatMoney(value?: string) {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function jobStatusLabel(status: string) {
  return {
    running: '执行中',
    succeeded: '全部成功',
    partial: '部分成功',
    failed: '失败',
    cancelled: '已取消',
  }[status] || status
}

function jobStatusType(status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  if (status === 'succeeded') return 'success'
  if (status === 'partial' || status === 'running') return 'warning'
  if (status === 'failed') return 'danger'
  return 'info'
}

function renderChart() {
  if (!trendChartRef.value || !overview.value) return
  trendChart ||= echarts.init(trendChartRef.value)
  const dates = overview.value.trends.users.map((item) => item.date.slice(5))
  const option: EChartsOption = {
    animationDuration: 240,
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: '#606a78', fontSize: 12 },
    },
    grid: { top: 42, right: 16, bottom: 20, left: 40 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: { lineStyle: { color: '#dfe3e8' } },
      axisLabel: { color: '#8b95a3', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#eef0f3' } },
      axisLabel: { color: '#8b95a3', fontSize: 11 },
    },
    series: [
      {
        name: '新增用户',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: overview.value.trends.users.map((item) => item.value),
        lineStyle: { width: 2, color: '#8070ed' },
        areaStyle: { color: 'rgba(128, 112, 237, 0.08)' },
      },
      {
        name: '新增谷子',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: overview.value.trends.goods.map((item) => item.value),
        lineStyle: { width: 2, color: '#b8941f' },
        areaStyle: { color: 'rgba(212, 175, 55, 0.08)' },
      },
    ],
  }
  trendChart.setOption(option, true)
  trendChart.resize()
}

async function loadOverview() {
  const requestSequence = overviewRequests.next()
  loading.value = true
  errorMessage.value = ''
  try {
    const nextOverview = await getAdminOverview(range.value)
    if (!overviewRequests.isLatest(requestSequence)) return
    overview.value = nextOverview
    await nextTick()
    renderChart()
  } catch (error: any) {
    if (!overviewRequests.isLatest(requestSequence)) return
    errorMessage.value = error?.response?.data?.detail || error?.message || '请稍后重试'
  } finally {
    if (overviewRequests.isLatest(requestSequence)) loading.value = false
  }
}

watch(
  () => overview.value?.range,
  () => nextTick(renderChart),
)

onMounted(() => {
  void loadOverview()
  resizeObserver = new ResizeObserver(() => trendChart?.resize())
  if (trendChartRef.value) resizeObserver.observe(trendChartRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  trendChart?.dispose()
  trendChart = null
})
</script>

<style scoped>
.overview-alerts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  min-height: 60px;
  margin-bottom: 14px;
}

.overview-alert,
.overview-clear {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
  background: #fff;
  padding: 10px 12px;
  text-align: left;
}

.overview-alert {
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.overview-alert:hover {
  border-color: #c9c1f5;
  box-shadow: 0 6px 18px rgba(30, 41, 59, 0.06);
}

.overview-alert__dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: #8070ed;
}

.overview-alert.is-warning .overview-alert__dot {
  background: #e6a23c;
}

.overview-alert.is-danger .overview-alert__dot {
  background: #f56c6c;
}

.overview-alert__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.overview-alert__copy strong {
  color: #303846;
  font-size: 13px;
}

.overview-alert__copy small {
  color: #8b95a3;
  font-size: 11px;
}

.overview-clear {
  justify-content: center;
  color: #4f8a58;
  font-size: 13px;
}

.overview-metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.overview-metric {
  min-width: 0;
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
  background: #fff;
  padding: 14px;
}

.overview-metric__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #697386;
  font-size: 12px;
}

.overview-metric__label .el-icon {
  color: #a79be9;
}

.overview-metric strong {
  display: block;
  margin-top: 10px;
  color: #1f2937;
  font-size: 24px;
  line-height: 1;
}

.overview-metric small {
  display: block;
  margin-top: 8px;
  overflow: hidden;
  color: #9099a6;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-main-grid,
.overview-detail-grid {
  display: grid;
  gap: 14px;
  margin-bottom: 14px;
}

.overview-main-grid {
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
}

.overview-detail-grid {
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 1fr);
}

.overview-panel {
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
  box-shadow: none;
}

.overview-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.overview-panel__header > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.overview-panel__header strong {
  color: #303846;
  font-size: 14px;
}

.overview-panel__header span {
  color: #9099a6;
  font-size: 11px;
}

.overview-chart {
  width: 100%;
  height: 290px;
}

.catalog-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.catalog-list button {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid #eef0f3;
  border-radius: 7px;
  background: #fafbfc;
  color: #4b5563;
  cursor: pointer;
  padding: 10px 12px;
  text-align: left;
}

.catalog-list button:hover {
  border-color: #d8d0f6;
  background: #faf9ff;
}

.catalog-list button span {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
}

.catalog-list button strong {
  color: #303846;
  font-size: 18px;
}

.audit-list {
  display: flex;
  flex-direction: column;
}

.audit-item {
  display: flex;
  min-height: 52px;
  align-items: flex-start;
  gap: 10px;
  border-bottom: 1px solid #f0f1f3;
  padding: 9px 0;
}

.audit-item:last-child {
  border-bottom: 0;
}

.audit-item__dot {
  width: 7px;
  height: 7px;
  flex: none;
  margin-top: 6px;
  border-radius: 50%;
  background: #b8941f;
}

.audit-item > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.audit-item strong {
  overflow: hidden;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-item small {
  color: #9099a6;
  font-size: 11px;
}

@media (max-width: 1280px) {
  .overview-metrics {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
  }
}

@media (max-width: 900px) {
  .overview-main-grid,
  .overview-detail-grid {
    grid-template-columns: 1fr;
  }

  .overview-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .overview-alerts,
  .overview-metrics,
  .catalog-list {
    grid-template-columns: 1fr;
  }

  .overview-chart {
    height: 240px;
  }
}
</style>
