import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const panelSource = readFileSync(resolve(process.cwd(), 'src/components/FilterPanel.vue'), 'utf8')
const statsSource = readFileSync(resolve(process.cwd(), 'src/components/StatsDashboard.vue'), 'utf8')
const statsControlsSource = readFileSync(resolve(process.cwd(), 'src/components/StatsFilterControls.vue'), 'utf8')
const appFilterPanelSource = readFileSync(resolve(process.cwd(), 'src/components/AppFilterPanel.vue'), 'utf8')
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
      expect(appFilterPanelSource).toContain(hook)
    }

    expect(panelSource).toContain('app-filter-fields')
    expect(statsSource).toContain('app-filter-fields')
    expect(appFilterPanelSource).toContain('app-filter-fields')
    expect(panelSource).toContain('app-filter-status')
    expect(statsControlsSource).toContain('app-filter-status')
  })

  it('两个面板共用同一个折叠过渡名', () => {
    expect(panelSource).toContain('<transition name="app-filter-collapse">')
    expect(statsSource).toContain('<transition name="app-filter-collapse">')
    expect(appFilterPanelSource).toContain('<transition name="app-filter-collapse">')
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
    // 标题右侧统计胶囊 + 桌面收起标题后的视觉隐藏标题
    expect(sharedStyles).toContain('.app-filter-meta')
    expect(sharedStyles).toContain('.app-visually-hidden')
  })

  it('把单选胶囊与纯文字胶囊也纳入同一套规格', () => {
    // 排序按钮（el-radio-button）与状态多选（el-checkbox-button）同款圆角胶囊
    expect(sharedStyles).toContain('.app-filter-status .el-radio-button__inner')
    expect(sharedStyles).toContain('.app-filter-status .el-radio-button.is-active .el-radio-button__inner')
    expect(sharedStyles).toMatch(/\.app-filter-status \.el-radio-button__inner \{[\s\S]*?border-radius: 999px;/)
    // 选中态要用与 Element Plus 同等以上的特异度覆盖（2.14 用了 :not(:disabled)）
    expect(sharedStyles).toContain('.app-filter-status .el-radio-button.is-active .el-radio-button__original-radio:not(:disabled) + .el-radio-button__inner')
    expect(sharedStyles).toMatch(/\.app-filter-status \.el-radio-button\.is-active \.el-radio-button__inner[\s\S]*?background: rgba\(212, 175, 55, 0\.13\);/)
    // 纯文字胶囊在紧凑桌面不被图标化收缩
    expect(sharedStyles).toContain('.app-filter-status--text-chips')
    expect(sharedStyles).toMatch(/\.app-filter-status--text-chips \.status-chip__label \{\s*display: inline;/)
    // 表头：标题与统计靠左成组，操作区仍贴右
    expect(sharedStyles).toMatch(/\.app-filter-header \{[\s\S]*?justify-content: flex-start;/)
    expect(sharedStyles).toMatch(/\.app-filter-actions \{[\s\S]*?margin-left: auto;/)
    // 统计胶囊的「结果不同」高亮态
    expect(sharedStyles).toContain('.app-filter-meta.is-active')
  })

  it('共享样式在 Element Plus 主题之后引入', () => {
    const themeIndex = mainSource.indexOf("import './styles/element-plus-theme.css'")
    const sharedIndex = mainSource.indexOf("import './styles/filterPanel.css'")

    expect(themeIndex).toBeGreaterThan(-1)
    expect(sharedIndex).toBeGreaterThan(themeIndex)
  })
})
