import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourcePath = resolve(process.cwd(), 'src/components/StatsDashboard.vue')
const source = readFileSync(sourcePath, 'utf8')

describe('StatsDashboard mobile dense layout', () => {
  it('renders all overview metrics together in a mobile KPI grid', () => {
    expect(source).toContain('class="overview-kpi-grid"')
    expect(source).toContain('class="overview-kpi-card overview-kpi-card--goods"')
    expect(source).toContain('class="overview-kpi-card overview-kpi-card--quantity"')
    expect(source).toContain('class="overview-kpi-card overview-kpi-card--value"')
    expect(source).toContain('overview-kpi-label')
    expect(source).toContain('overview-kpi-value')
    expect(source).toContain('overview-kpi-sub')
    expect(source).not.toContain('overview-carousel-dots')
    expect(source).not.toContain('scrollOverviewTo')
  })

  it('keeps all charts and uses denser mobile chart columns', () => {
    expect(source).toContain('ref="statusChartRef"')
    expect(source).toContain('ref="officialChartRef"')
    expect(source).toContain('ref="subjectChartRef"')
    expect(source).toContain('ref="ipTopChartRef"')
    expect(source).toContain('ref="categoryTopChartRef"')
    expect(source).toContain('class="chart-col chart-col--half-mobile"')
    expect(source).toContain('class="chart-col chart-col--full-mobile"')
    expect(source).toContain('.chart-col--half-mobile')
    expect(source).toContain('.chart-container--compact-pie')
    expect(source).toContain('const compactPieLabel')
    expect(source).toContain('const compactPieLegend')
  })
})
