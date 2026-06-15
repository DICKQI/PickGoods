<template>
  <main class="character-stats-page" v-loading="loading">
    <section v-if="errorMessage" class="state-panel">
      <el-empty description="角色厨力统计加载失败" />
      <p class="state-detail">{{ errorMessage }}</p>
      <el-button type="primary" @click="loadStats">重试</el-button>
    </section>

    <template v-else-if="stats">
      <section class="hero-panel">
        <button class="back-button" type="button" @click="goBack" aria-label="返回角色管理">
          <el-icon><ArrowLeft /></el-icon>
        </button>

        <div class="hero-identity">
          <el-avatar :size="96" :src="stats.character.avatar || undefined" shape="square" class="hero-avatar">
            <el-icon><UserFilled /></el-icon>
          </el-avatar>
          <div class="hero-copy">
            <span class="hero-kicker">角色厨力档案</span>
            <h1>{{ stats.character.name }}</h1>
            <p>{{ stats.character.ip.name }}</p>
          </div>
        </div>

        <div class="oshi-score-block">
          <div class="score-ring" :style="scoreRingStyle">
            <strong>{{ stats.oshi_power.score }}</strong>
            <span>{{ stats.oshi_power.level }}</span>
          </div>
          <div class="oshi-meter">
            <div class="meter-header">
              <span>厨力氪条</span>
              <strong>{{ oshiPercent }}%</strong>
            </div>
            <div class="meter-track">
              <div class="meter-fill" :style="{ width: `${oshiPercent}%` }" />
            </div>
            <p>
              全站角色排名
              <b v-if="stats.oshi_power.rank">#{{ stats.oshi_power.rank }}</b>
              <span v-else>暂无排名</span>
              / {{ stats.oshi_power.total_characters || 0 }}
            </p>
          </div>
        </div>
      </section>

      <section class="metrics-grid" aria-label="角色收藏概览">
        <article class="metric-card">
          <span>估算投入</span>
          <strong>¥{{ stats.overview.value_sum }}</strong>
          <small>price × quantity</small>
        </article>
        <article class="metric-card">
          <span>谷子件数</span>
          <strong>{{ stats.overview.goods_count }}</strong>
          <small>不同 Asset 记录</small>
        </article>
        <article class="metric-card">
          <span>总数量</span>
          <strong>{{ stats.overview.quantity_sum }}</strong>
          <small>合计 quantity</small>
        </article>
        <article class="metric-card">
          <span>品类广度</span>
          <strong>{{ stats.overview.category_count }}</strong>
          <small>覆盖品类</small>
        </article>
      </section>

      <section class="heat-grid" aria-label="IP热度">
        <article class="heat-panel heat-panel--platform">
          <div>
            <span class="panel-kicker">平台热度</span>
            <h2>{{ stats.ip_heat.platform_heat.score }}</h2>
            <p>{{ stats.ip_heat.platform_heat.level }} · 排名 #{{ stats.ip_heat.platform_heat.rank || '-' }}</p>
          </div>
          <dl>
            <div>
              <dt>收藏用户</dt>
              <dd>{{ stats.ip_heat.platform_heat.raw_metrics.collectors_count || 0 }}</dd>
            </div>
            <div>
              <dt>近30天新增</dt>
              <dd>{{ stats.ip_heat.platform_heat.raw_metrics.recent_goods_count }}</dd>
            </div>
          </dl>
        </article>

        <article class="heat-panel heat-panel--mine">
          <div>
            <span class="panel-kicker">我的热度</span>
            <h2>{{ stats.ip_heat.my_heat.score }}</h2>
            <p>{{ stats.ip_heat.my_heat.level }} · 我的 IP 投入</p>
          </div>
          <dl>
            <div>
              <dt>我的数量</dt>
              <dd>{{ stats.ip_heat.my_heat.raw_metrics.quantity_sum }}</dd>
            </div>
            <div>
              <dt>角色覆盖</dt>
              <dd>{{ stats.ip_heat.my_heat.raw_metrics.character_count || 0 }}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section v-if="stats.overview.goods_count === 0" class="state-panel state-panel--inline">
        <el-empty description="暂无该角色的收藏数据" />
      </section>

      <section class="dashboard-grid" aria-label="角色统计图表">
        <article class="chart-panel">
          <header>
            <el-icon><Collection /></el-icon>
            <span>状态分布</span>
          </header>
          <div ref="statusChartRef" class="chart-box" />
        </article>

        <article class="chart-panel">
          <header>
            <el-icon><Star /></el-icon>
            <span>官谷 / 同人</span>
          </header>
          <div ref="officialChartRef" class="chart-box" />
        </article>

        <article class="chart-panel chart-panel--wide">
          <header>
            <el-icon><Top /></el-icon>
            <span>消费趋势</span>
          </header>
          <div ref="trendChartRef" class="chart-box chart-box--wide" />
        </article>
      </section>

      <section class="lower-grid">
        <article class="ranking-panel">
          <header>品类 Top</header>
          <div v-if="stats.distributions.category_top.length" class="category-list">
            <div
              v-for="item in stats.distributions.category_top"
              :key="item.category_id"
              class="category-row"
            >
              <span>{{ item.category__path_name || item.category__name }}</span>
              <strong>{{ item.goods_count }}</strong>
            </div>
          </div>
          <el-empty v-else description="暂无品类数据" />
        </article>

        <article class="ranking-panel">
          <header>全站厨力 Top</header>
          <div v-if="stats.rankings.global_top.length" class="ranking-list">
            <div
              v-for="(item, index) in stats.rankings.global_top"
              :key="item.id"
              class="ranking-row"
              :class="{ current: item.id === stats.character.id }"
            >
              <span class="rank-index">#{{ index + 1 }}</span>
              <span class="rank-name">{{ item.name }}</span>
              <strong>{{ item.score }}</strong>
            </div>
          </div>
          <el-empty v-else description="暂无排行数据" />
        </article>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { ArrowLeft, Collection, Star, Top, UserFilled } from '@element-plus/icons-vue'
import { getCharacterStats } from '@/api/goods'
import type { CharacterStatsResponse } from '@/api/types'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const stats = ref<CharacterStatsResponse | null>(null)

const statusChartRef = ref<HTMLDivElement | null>(null)
const officialChartRef = ref<HTMLDivElement | null>(null)
const trendChartRef = ref<HTMLDivElement | null>(null)
const chartInstances: echarts.ECharts[] = []

const oshiPercent = computed(() => {
  const score = stats.value?.oshi_power.score ?? 0
  return Math.max(0, Math.min(100, score))
})

const scoreRingStyle = computed<Record<string, string>>(() => ({
  '--score': String(oshiPercent.value),
}))

const getSafeReturnTo = () => {
  const returnTo = route.query.returnTo
  if (typeof returnTo !== 'string') return ''
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return ''
  return returnTo
}

const goBack = () => {
  const safeReturnTo = getSafeReturnTo()
  if (safeReturnTo) {
    router.replace(safeReturnTo)
    return
  }
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/ipcharacter')
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

const renderCharts = () => {
  if (!stats.value) return
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-dark').trim() || '#333'
  const subColor = getComputedStyle(document.documentElement).getPropertyValue('--text-light').trim() || '#888'
  const colors = ['#F6D365', '#A29BFE', '#FF9A9E', '#84FAB0', '#D4AF37']
  const tooltip = {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
    textStyle: { color: textColor },
    appendToBody: true,
  }

  const statusChart = initChart(statusChartRef.value)
  statusChart?.setOption({
    color: colors,
    tooltip: { ...tooltip, trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: subColor } },
    series: [{
      type: 'pie',
      radius: ['42%', '70%'],
      data: stats.value.distributions.status.map((item) => ({
        name: item.label,
        value: item.goods_count,
      })),
    }],
  })

  const officialChart = initChart(officialChartRef.value)
  officialChart?.setOption({
    color: colors,
    tooltip: { ...tooltip, trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: subColor } },
    series: [{
      type: 'pie',
      radius: ['42%', '70%'],
      data: stats.value.distributions.is_official.map((item) => ({
        name: item.label,
        value: item.goods_count,
      })),
    }],
  })

  const trendChart = initChart(trendChartRef.value)
  trendChart?.setOption({
    color: colors,
    tooltip: { ...tooltip, trigger: 'axis' },
    grid: { left: 42, right: 20, top: 28, bottom: 34, containLabel: true },
    xAxis: {
      type: 'category',
      data: stats.value.trends.purchase_date.map((item) => item.bucket),
      axisLabel: { color: subColor },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: subColor },
      splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
    },
    series: [{
      type: 'line',
      smooth: true,
      areaStyle: { opacity: 0.15 },
      data: stats.value.trends.purchase_date.map((item) => Number(item.value_sum || item.quantity_sum || 0)),
    }],
  })

  chartInstances.forEach((chart) => chart.resize())
}

const loadStats = async () => {
  const id = Number(route.params.id)
  if (!Number.isFinite(id) || id <= 0) {
    errorMessage.value = '角色 ID 无效'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    stats.value = await getCharacterStats(id)
    await nextTick()
    renderCharts()
  } catch (err: any) {
    stats.value = null
    errorMessage.value = err?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const handleResize = () => {
  chartInstances.forEach((chart) => chart.resize())
}

onMounted(() => {
  loadStats()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstances.splice(0).forEach((chart) => chart.dispose())
})
</script>

<style scoped>
.character-stats-page {
  width: min(1120px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 28px 0 40px;
  color: var(--text-dark);
}

.hero-panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  gap: 24px;
  align-items: center;
  min-height: 260px;
  padding: 28px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--card-radius);
  background:
    linear-gradient(135deg, rgba(255,255,255,0.96), rgba(245,245,247,0.86)),
    linear-gradient(120deg, rgba(212,175,55,0.14), rgba(162,155,254,0.12)),
    var(--bg-white);
  box-shadow: var(--shadow-md);
}

.back-button {
  position: absolute;
  top: 18px;
  left: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 999px;
  background: rgba(255,255,255,0.86);
  color: var(--primary-gold-dark);
  cursor: pointer;
}

.hero-identity {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-left: 34px;
}

.hero-avatar {
  border: 2px solid rgba(212, 175, 55, 0.38);
  box-shadow: var(--shadow-lg);
  background: #fff;
  flex-shrink: 0;
}

.hero-copy {
  min-width: 0;
}

.hero-kicker,
.panel-kicker {
  display: inline-block;
  margin-bottom: 8px;
  color: var(--primary-gold-dark);
  font-size: 12px;
  font-weight: 700;
}

.hero-copy h1 {
  margin: 0;
  font-size: 36px;
  line-height: 1.1;
  letter-spacing: 0;
}

.hero-copy p {
  margin: 10px 0 0;
  color: var(--text-light);
  font-size: 15px;
}

.oshi-score-block {
  display: grid;
  grid-template-columns: 116px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  padding: 18px;
  border: 1px solid rgba(162, 155, 254, 0.28);
  border-radius: 18px;
  background: rgba(255,255,255,0.76);
}

.score-ring {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 116px;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #fff 58%, transparent 59%),
    conic-gradient(var(--accent-purple) calc(var(--score, 88) * 1%), rgba(212,175,55,0.18) 0);
  box-shadow: var(--shadow-purple);
}

.score-ring strong {
  font-size: 32px;
  line-height: 1;
}

.score-ring span {
  margin-top: 6px;
  color: var(--accent-purple-dark);
  font-size: 13px;
  font-weight: 700;
}

.meter-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-light);
}

.meter-track {
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(229, 229, 231, 0.9);
}

.meter-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--primary-gold), var(--accent-purple));
}

.oshi-meter p {
  margin: 10px 0 0;
  color: var(--text-light);
  font-size: 13px;
}

.metrics-grid,
.heat-grid,
.dashboard-grid,
.lower-grid {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.metrics-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.metric-card,
.heat-panel,
.chart-panel,
.ranking-panel,
.state-panel {
  border: 1px solid var(--border-color);
  border-radius: var(--card-radius);
  background: var(--bg-white);
  box-shadow: var(--shadow-sm);
}

.metric-card {
  padding: 18px;
}

.metric-card span {
  color: var(--text-light);
  font-size: 13px;
}

.metric-card strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
}

.metric-card small {
  display: block;
  margin-top: 6px;
  color: var(--text-lighter);
}

.heat-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.heat-panel {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 22px;
}

.heat-panel h2 {
  margin: 0;
  font-size: 40px;
}

.heat-panel p {
  margin: 6px 0 0;
  color: var(--text-light);
}

.heat-panel dl {
  display: grid;
  gap: 10px;
  min-width: 130px;
  margin: 0;
}

.heat-panel dt {
  color: var(--text-light);
  font-size: 12px;
}

.heat-panel dd {
  margin: 2px 0 0;
  font-weight: 700;
}

.heat-panel--platform {
  background: linear-gradient(135deg, #fff, rgba(212,175,55,0.12));
}

.heat-panel--mine {
  background: linear-gradient(135deg, #fff, rgba(162,155,254,0.14));
}

.dashboard-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.chart-panel,
.ranking-panel {
  padding: 18px;
}

.chart-panel--wide {
  grid-column: 1 / -1;
}

.chart-panel header,
.ranking-panel header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--primary-gold-dark);
  font-weight: 700;
}

.chart-box {
  height: 260px;
}

.chart-box--wide {
  height: 300px;
}

.lower-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.category-list,
.ranking-list {
  display: grid;
  gap: 10px;
}

.category-row,
.ranking-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--secondary-gray);
}

.category-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.category-row span,
.rank-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-index {
  color: var(--primary-gold-dark);
  font-weight: 700;
}

.ranking-row.current {
  background: rgba(162, 155, 254, 0.16);
}

.state-panel {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 48px 20px;
}

.state-panel--inline {
  padding: 20px;
}

.state-detail {
  color: var(--text-light);
}

@media (max-width: 768px) {
  .character-stats-page {
    width: min(100vw, 100%);
    padding: 12px 12px calc(88px + env(safe-area-inset-bottom));
  }

  .hero-panel {
    grid-template-columns: 1fr;
    gap: 18px;
    min-height: 0;
    padding: 54px 18px 18px;
    border-radius: 18px;
  }

  .hero-identity {
    padding-left: 0;
    align-items: flex-start;
  }

  .hero-avatar {
    width: 72px !important;
    height: 72px !important;
  }

  .hero-copy h1 {
    font-size: 26px;
  }

  .oshi-score-block {
    grid-template-columns: 88px minmax(0, 1fr);
    padding: 14px;
  }

  .score-ring {
    width: 88px;
  }

  .score-ring strong {
    font-size: 26px;
  }

  .metrics-grid,
  .heat-grid,
  .dashboard-grid,
  .lower-grid {
    grid-template-columns: 1fr;
  }

  .metric-card strong {
    font-size: 24px;
  }

  .heat-panel {
    flex-direction: column;
  }

  .chart-panel--wide {
    grid-column: auto;
  }
}
</style>
