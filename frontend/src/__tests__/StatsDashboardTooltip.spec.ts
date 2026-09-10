import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/components/StatsDashboard.vue'), 'utf8')

describe('StatsDashboard tooltip cleanup', () => {
  it('keeps tooltips appended to body for unclipped rendering', () => {
    expect(source).toContain('appendToBody: true')
  })

  it('hides body-appended tooltips when the dashboard is hidden or left', () => {
    // 主动收起：ECharts 的 appendToBody tooltip 在移动端点击后没有 mouseout，会一直留在 body 上
    expect(source).toContain('const hideAllTips = () => {')
    expect(source).toContain("instance.dispatchAction({ type: 'hideTip' })")
    // 切标签页 / 跳其它大区（看板被 KeepAlive 缓存，不会触发卸载）
    expect(source).toContain('const stopHideTipsOnNavigate = router.afterEach(() => hideAllTips())')
    expect(source).toContain('onDeactivated(() => hideAllTips())')
    expect(source).toContain('onActivated(() => hideAllTips())')
    expect(source).toContain('onBeforeUnmount(() => stopHideTipsOnNavigate())')
    // 看板自身滚动时也不留悬浮提示
    expect(source).toContain("window.addEventListener('scroll', hideAllTips, { passive: true })")
    expect(source).toContain("window.removeEventListener('scroll', hideAllTips)")
    // 卸载时先收起再销毁实例
    expect(source).toMatch(/hideAllTips\(\)\s*\n\s*disposeCharts\(\)/)
  })
})
