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

  it('renders a fixed mobile sticky header mirror for the active expanded IP', () => {
    expect(source).toContain('v-if="activeStickyIP"')
    expect(source).toContain('class="mobile-sticky-ip-header ip-card-item is-expanded"')
    expect(source).toContain(':style="{ top: mobileStickyTop }"')
    expect(source).toContain('const activeStickyIPId = ref<number | null>(null)')
    expect(source).toContain('const activeStickyIP = computed(() => (')
    expect(source).toContain("window.addEventListener('scroll', queueUpdateMobileStickyHeader")
    expect(source).toContain('.mobile-sticky-ip-header')
    expect(source).toContain('position: fixed;')
  })

  it('keeps IP expansion single-selection', () => {
    expect(source).toContain('expandedIPs.value = [ipId]')
    expect(source).toContain('expandedIPs.value = [row.id]')
    expect(source).toContain('expandedIPs.value = [newIpId]')
    expect(source).not.toContain('expandedIPs.value.push(ipId)')
    expect(source).not.toContain('expandedIPs.value.push(newIpId)')
  })
})
