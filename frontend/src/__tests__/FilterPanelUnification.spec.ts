import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const panelSource = readFileSync(resolve(process.cwd(), 'src/components/FilterPanel.vue'), 'utf8')
const statsSource = readFileSync(resolve(process.cwd(), 'src/components/StatsDashboard.vue'), 'utf8')
const statsControlsSource = readFileSync(resolve(process.cwd(), 'src/components/StatsFilterControls.vue'), 'utf8')
const sharedStyles = readFileSync(resolve(process.cwd(), 'src/styles/filterPanel.css'), 'utf8')
const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8')

describe('筛选面板统一视觉系统', () => {
  it('两个面板复用同一组样式钩子', () => {
    for (const hook of [
      'app-filter-surface',
      'app-filter-header',
      'app-filter-actions',
      'app-filter-collapse-wrapper',
    ]) {
      expect(panelSource).toContain(hook)
      expect(statsSource).toContain(hook)
    }

    expect(panelSource).toContain('app-filter-fields')
    expect(statsSource).toContain('app-filter-fields')
    expect(panelSource).toContain('app-filter-status')
    expect(statsControlsSource).toContain('app-filter-status')
  })

  it('两个面板共用同一个折叠过渡名', () => {
    expect(panelSource).toContain('<transition name="app-filter-collapse">')
    expect(statsSource).toContain('<transition name="app-filter-collapse">')
    expect(panelSource).not.toContain('filter-collapse-enter-active')
    expect(statsSource).not.toContain('stats-filter-collapse')
  })

  it('共享样式覆盖表面、标签、控件、胶囊与减少动效', () => {
    expect(sharedStyles).toContain('.app-filter-surface .el-card__body')
    expect(sharedStyles).toContain('.app-filter-fields label')
    expect(sharedStyles).toContain('.app-filter-fields .el-select__wrapper')
    expect(statsSource).toContain('mobile-stats-filter-grid app-filter-fields')
    expect(sharedStyles).toContain('.app-filter-status .el-checkbox-button__inner')
    expect(sharedStyles).toContain('.app-filter-collapse-enter-from')
    expect(sharedStyles).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('共享样式在 Element Plus 主题之后引入', () => {
    const themeIndex = mainSource.indexOf("import './styles/element-plus-theme.css'")
    const sharedIndex = mainSource.indexOf("import './styles/filterPanel.css'")

    expect(themeIndex).toBeGreaterThan(-1)
    expect(sharedIndex).toBeGreaterThan(themeIndex)
  })
})
