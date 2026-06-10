import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourcePath = resolve(process.cwd(), 'src/components/StatsDashboard.vue')
const source = readFileSync(sourcePath, 'utf8')

describe('StatsDashboard mobile overview carousel', () => {
  it('keeps edge cards inset from the viewport when snapped', () => {
    expect(source).toContain('--overview-card-width: calc(80vw - 40px);')
    expect(source).toContain('--overview-track-padding: 16px;')
    expect(source).toContain('scroll-padding-inline: var(--overview-track-padding);')
    expect(source).toContain('padding: 0 var(--overview-track-padding);')
    expect(source).toContain('margin: 0;')
    expect(source).toContain('flex: 0 0 var(--overview-card-width);')
    expect(source).toContain('max-width: var(--overview-card-width);')
    expect(source).toContain('width: var(--overview-card-width);')
    expect(source).toContain('margin-left: 0 !important;')
    expect(source).toContain('margin-right: 0 !important;')
    expect(source).not.toContain('--overview-edge-space: calc((100vw - var(--overview-card-width)) / 2);')
    expect(source).not.toContain('margin: 0 calc(0px - var(--overview-edge-space));')
  })

  it('allows tapping a card to switch the carousel to that card', () => {
    expect(source).toContain('@click="scrollOverviewTo(0)"')
    expect(source).toContain('@click="scrollOverviewTo(1)"')
    expect(source).toContain('@click="scrollOverviewTo(2)"')
    expect(source).toContain('const scrollOverviewTo = (index: number) => {')
    expect(source).toContain('const left = target.offsetLeft - trackPadding')
    expect(source).toContain("el.scrollTo({ left, behavior: 'smooth' })")
    expect(source).not.toContain('scrollIntoView')
  })
})
