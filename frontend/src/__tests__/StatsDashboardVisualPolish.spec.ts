import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const statsDashboardSource = readFileSync(resolve(process.cwd(), 'src/components/StatsDashboard.vue'), 'utf8')
const statsFilterControlsSource = readFileSync(resolve(process.cwd(), 'src/components/StatsFilterControls.vue'), 'utf8')
const sharedFilterStyles = readFileSync(resolve(process.cwd(), 'src/styles/filterPanel.css'), 'utf8')

describe('StatsDashboard visual polish', () => {
  it('shares the refined filter surface with the barn filter panel', () => {
    expect(sharedFilterStyles).toContain('.app-filter-surface')
    expect(sharedFilterStyles).toContain('.app-filter-surface::before')
    expect(sharedFilterStyles).toContain('transform: translateY(-2px)')
    expect(sharedFilterStyles).toContain('backdrop-filter: blur(14px)')
    expect(statsDashboardSource).toContain('app-filter-surface')
    expect(statsDashboardSource).toContain('app-filter-header')
    expect(statsDashboardSource).toContain('<transition name="app-filter-collapse">')
    expect(statsDashboardSource).not.toContain('stats-filter-card::before')
  })

  it('upgrades chart presentation without changing the existing chart set', () => {
    expect(statsDashboardSource).toContain('chart-title::before')
    expect(statsDashboardSource).toContain('type: \'linear\'')
    expect(statsDashboardSource).toContain('showBackground: true')
    expect(statsDashboardSource).toContain('backgroundStyle')
    expect(statsDashboardSource).toContain('shadowBlur: 10')
    expect(statsDashboardSource).toContain('borderRadius: [0, 999, 999, 0]')
  })

  it('prevents long ranking labels from crowding the chart area', () => {
    expect(statsDashboardSource).toContain('const RANK_AXIS_LABEL_WIDTH = 150')
    expect(statsDashboardSource).toContain('const createRankAxisLabel')
    expect(statsDashboardSource).toContain('overflow: \'truncate\'')
    expect(statsDashboardSource).toContain('ellipsis: \'…\'')
    expect(statsDashboardSource).toContain('axisLabel: createRankAxisLabel(yAxisLabelMaxLen)')
  })

  it('keeps both donut charts visually consistent', () => {
    expect(statsDashboardSource).toContain('const donutPalette = [')
    expect(statsDashboardSource).toContain('color: donutPalette')
    expect(statsDashboardSource).toContain('const donutLabel = { show: false }')
    expect(statsDashboardSource).toContain('const donutLabelLine = { show: false }')
    expect(statsDashboardSource).toContain('label: donutLabel')
    expect(statsDashboardSource).toContain('labelLine: donutLabelLine')
    expect(statsDashboardSource).toContain('emphasis: { scale: true, scaleSize: 4 }')
  })

  it('keeps filter controls aligned as a compact desktop toolbar', () => {
    expect(statsFilterControlsSource).toMatch(
      /grid-template-columns:\s*minmax\(168px, 1\.1fr\)\s*minmax\(150px, 1fr\)\s*auto\s*minmax\(150px, 1fr\)\s*minmax\(180px, 1\.2fr\)/,
    )
    expect(sharedFilterStyles).toContain('text-transform: uppercase')
    expect(statsFilterControlsSource).toContain('.topn-value')
    expect(statsFilterControlsSource).toContain('border-radius: 999px')
    expect(statsFilterControlsSource).toContain('.character-stats-button')
  })

  it('keeps desktop status filters on one line and uses icon chips at compact widths', () => {
    expect(statsFilterControlsSource).toContain('aria-label="在馆"')
    expect(statsFilterControlsSource).toContain('aria-label="意向入手"')
    expect(statsFilterControlsSource).toContain('aria-label="出街中"')
    expect(statsFilterControlsSource).toContain('aria-label="已售出"')
    expect(statsFilterControlsSource.match(/class="stats-status-chip__icon"/g)).toHaveLength(4)
    expect(statsFilterControlsSource).toContain('app-filter-status')
    expect(sharedFilterStyles).toMatch(/\.app-filter-status\s*{[^}]*flex-wrap: nowrap;/s)
    expect(sharedFilterStyles).toContain('@media (min-width: 769px) and (max-width: 1279px)')
    expect(sharedFilterStyles).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));')
    expect(sharedFilterStyles).toMatch(/\.app-filter-status \.stats-status-chip__label[\s\S]*?display: none;/)
    expect(sharedFilterStyles).toMatch(/\.app-filter-status \.stats-status-chip__icon[\s\S]*?display: inline-flex;/)
  })
})
