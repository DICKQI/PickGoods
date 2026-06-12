import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourcePath = join(process.cwd(), 'src/views/IPCharacterManagement.vue')
const source = readFileSync(sourcePath, 'utf-8')

describe('IPCharacterManagement mobile layout', () => {
  it('does not render or reserve space for the side pinyin index', () => {
    expect(source).not.toContain('az-index-bar')
    expect(source).not.toContain('az-index-item')
    expect(source).not.toContain('data-index-anchor')
    expect(source).not.toContain('showIndexBar')
    expect(source).not.toContain('has-index-bar')
  })

  it('keeps the mobile character count as a labeled metric separate from card controls', () => {
    expect(source).toContain('class="card-actions-panel"')
    expect(source).toContain('class="character-count-chip"')
    expect(source).toContain('class="count-label">角色</span>')
    expect(source).toContain('class="card-control-row"')
    expect(source).not.toContain('character-count-badge')
  })

  it('keeps expanded mobile IP headers outside the swipe-transformed content', () => {
    const stickyShellStart = source.indexOf('class="ip-card-sticky-shell"')
    const characterListComment = source.indexOf('<!-- 展开的角色列表 -->', stickyShellStart)
    const stickyHeaderTemplate = source.slice(stickyShellStart, characterListComment)

    expect(source).toContain(':class="{ \'is-sorting\': isSorting }"')
    expect(source).toContain(':data-ip-id="item.id"')
    expect(stickyShellStart).toBeGreaterThan(-1)
    expect(characterListComment).toBeGreaterThan(stickyShellStart)
    expect(stickyHeaderTemplate).toContain('class="swipe-content"')
    expect(stickyHeaderTemplate).not.toContain('class="character-list"')
    expect(source.indexOf('class="character-list"', characterListComment)).toBeGreaterThan(characterListComment)
  })

  it('sticks the original expanded mobile IP header without rendering a mirror card', () => {
    const stickyRuleStart = source.indexOf('.ip-card-item.is-expanded > .ip-card-sticky-shell')
    const stickyRuleEnd = source.indexOf('}', stickyRuleStart)
    const stickyRule = source.slice(stickyRuleStart, stickyRuleEnd)
    const cardStart = source.indexOf('class="ip-card-item"')
    const cardEnd = source.indexOf('class="ip-card-sticky-shell"', cardStart)
    const cardTemplate = source.slice(cardStart, cardEnd)
    const stickyShellStart = source.indexOf('class="ip-card-sticky-shell"')
    const stickyShellEnd = source.indexOf('class="ip-swipe-item"', stickyShellStart)
    const stickyShellTemplate = source.slice(stickyShellStart, stickyShellEnd)

    expect(source).not.toContain('mobile-sticky-ip-header')
    expect(source).not.toContain('const activeStickyIP = computed')
    expect(source).toContain("window.addEventListener('scroll', queueUpdateMobileStickyHeader")
    expect(source).toContain('const activeStickyIPId = ref<number | null>(null)')
    expect(source).toContain('const stickyHeaderState = ref<Record<number, MobileStickyState>>({})')
    expect(source).toContain('const getMobileStickyCardStyle = (ipId: number)')
    expect(source).toContain('const getMobileStickyShellStyle = (ipId: number)')
    expect(source).toContain("position: 'fixed'")
    expect(source).toContain("'--mobile-sticky-shell-height'")
    expect(cardTemplate).toContain("'is-sticky-active': activeStickyIPId === item.id")
    expect(cardTemplate).toContain(':style="getMobileStickyCardStyle(item.id)"')
    expect(stickyShellTemplate).toContain(":class=\"{ 'is-stuck': activeStickyIPId === item.id }\"")
    expect(stickyShellTemplate).toContain(':style="getMobileStickyShellStyle(item.id)"')
    expect(stickyRuleStart).toBeGreaterThan(-1)
    expect(stickyRule).not.toContain('will-change: transform;')
  })

  it('keeps IP expansion single-selection', () => {
    expect(source).toContain('expandedIPs.value = [ipId]')
    expect(source).toContain('expandedIPs.value = [row.id]')
    expect(source).toContain('expandedIPs.value = [newIpId]')
    expect(source).not.toContain('expandedIPs.value.push(ipId)')
    expect(source).not.toContain('expandedIPs.value.push(newIpId)')
  })

  it('uses a compact mobile create button with a bottom action sheet', () => {
    expect(source).toContain("import MobileActionSheet from '@/components/MobileActionSheet.vue'")
    expect(source).toContain('const mobileAddSheetVisible = ref(false)')
    expect(source).toContain('const ipMobileCreateActions = [')
    expect(source).toContain('class="header-actions desktop-create-actions"')
    expect(source).toContain('class="mobile-create-actions"')
    expect(source).toContain('class="mobile-add-btn"')
    expect(source).toContain('@click="openMobileAddSheet"')
    expect(source).toContain('v-model="mobileAddSheetVisible"')
    expect(source).toContain('@select="handleMobileCreateAction"')
  })

  it('keeps the mobile search button inline and compacts the filter card', () => {
    expect(source).toContain('.search-card {')
    expect(source).toContain('.search-flex {')
    expect(source).toContain('grid-template-columns: minmax(0, 1fr) auto;')
    expect(source).toContain('grid-row: 2;')
    expect(source).not.toContain('.search-flex,\n  .filter-flex {\n    flex-direction: column;')
  })
})
