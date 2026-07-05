import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const showcaseManagerSource = readFileSync(resolve(process.cwd(), 'src/components/ShowcaseManager.vue'), 'utf8')
const showcaseDetailSource = readFileSync(resolve(process.cwd(), 'src/components/showcase/ShowcaseDetailView.vue'), 'utf8')

describe('ShowcaseManager dialog cover layout', () => {
  function cssRuleBlock(source: string, selector: string) {
    const start = source.indexOf(selector)
    expect(start).toBeGreaterThan(-1)

    const open = source.indexOf('{', start)
    const close = source.indexOf('}', open)
    expect(open).toBeGreaterThan(start)
    expect(close).toBeGreaterThan(open)

    return source.slice(open + 1, close)
  }

  it('places the cover tip below the upload preview inside a dedicated vertical wrapper', () => {
    expect(showcaseManagerSource).toContain('class="showcase-cover-field"')
    expect(showcaseManagerSource).toContain('class="cover-tip"')
    expect(showcaseManagerSource).toContain('.showcase-cover-field {')
    expect(showcaseManagerSource).toContain('flex-direction: column;')
    expect(showcaseManagerSource).toContain('gap: 10px;')

    const coverFieldStart = showcaseManagerSource.indexOf('class="showcase-cover-field"')
    const uploadIndex = showcaseManagerSource.indexOf('<el-upload', coverFieldStart)
    const tipIndex = showcaseManagerSource.indexOf('class="cover-tip"', coverFieldStart)

    expect(coverFieldStart).toBeGreaterThan(-1)
    expect(uploadIndex).toBeGreaterThan(coverFieldStart)
    expect(tipIndex).toBeGreaterThan(uploadIndex)
  })

  it('uses branded dialog sections for header, grouped form body, settings row, and footer actions', () => {
    expect(showcaseManagerSource).toContain('class="showcase-dialog-header"')
    expect(showcaseManagerSource).toContain('class="showcase-dialog-kicker"')
    expect(showcaseManagerSource).toContain('class="showcase-dialog-title"')
    expect(showcaseManagerSource).toContain('class="showcase-dialog-subtitle"')
    expect(showcaseManagerSource).toContain('class="showcase-editor-shell"')
    expect(showcaseManagerSource).toContain('class="showcase-dialog-form"')
    expect(showcaseManagerSource).toContain('class="showcase-form-section showcase-form-section--primary"')
    expect(showcaseManagerSource).toContain('class="showcase-form-section showcase-form-section--secondary"')
    expect(showcaseManagerSource).toContain('class="showcase-visibility-row"')
    expect(showcaseManagerSource).toContain('class="showcase-visibility-copy"')
    expect(showcaseManagerSource).toContain('class="showcase-dialog-footer"')
    expect(showcaseManagerSource).toContain('class="showcase-dialog-cancel"')
    expect(showcaseManagerSource).toContain('class="showcase-dialog-submit btn-accent"')
  })

  it('styles the dialog footer as a seamless bottom area without a hard divider line or branded gradient fill', () => {
    const footerStyleStart = showcaseManagerSource.indexOf(':global(.showcase-dialog .el-dialog__footer) {')
    const footerStyleEnd = showcaseManagerSource.indexOf('}', footerStyleStart)
    const footerStyle = showcaseManagerSource.slice(footerStyleStart, footerStyleEnd)

    expect(footerStyleStart).toBeGreaterThan(-1)
    expect(footerStyle).not.toContain('border-top:')
    expect(footerStyle).toContain('background: rgba(255, 255, 255, 0.94);')
    expect(footerStyle).toContain('padding: 18px 28px 24px;')
  })

  it('resets the dialog shell padding so the branded content does not shrink inside an outer ring', () => {
    const dialogStyleStart = showcaseManagerSource.indexOf(':global(.showcase-dialog .el-dialog) {')
    const dialogStyleEnd = showcaseManagerSource.indexOf('}', dialogStyleStart)
    const dialogStyle = showcaseManagerSource.slice(dialogStyleStart, dialogStyleEnd)

    expect(dialogStyleStart).toBeGreaterThan(-1)
    expect(dialogStyle).toContain('padding: 0;')
    expect(dialogStyle).toContain('overflow: hidden;')
  })

  it('uses a clean solid header background instead of a tinted gradient block', () => {
    const headerStyleStart = showcaseManagerSource.indexOf(':global(.showcase-dialog .el-dialog__header) {')
    const headerStyleEnd = showcaseManagerSource.indexOf('}', headerStyleStart)
    const headerStyle = showcaseManagerSource.slice(headerStyleStart, headerStyleEnd)

    expect(headerStyleStart).toBeGreaterThan(-1)
    expect(headerStyle).toContain('background: rgba(255, 255, 255, 0.96);')
    expect(headerStyle).not.toContain('radial-gradient')
  })

  it('renders the mobile showcase editor as the shared bottom-sheet pattern', () => {
    expect(showcaseManagerSource).toContain(":class=\"['custom-dialog', 'showcase-dialog', { 'is-showcase-editor-mobile': isMobile }]\"")
    expect(showcaseManagerSource).toContain(":width=\"isMobile ? '100vw' : 'min(92vw, 560px)'\"")
    expect(showcaseManagerSource).toContain(':align-center="!isMobile"')
    expect(showcaseManagerSource).toContain(':show-close="!isMobile"')
    expect(showcaseManagerSource).toContain(':lock-scroll="!isMobile"')
    expect(showcaseManagerSource).toContain('v-if="isMobile" class="showcase-editor-hero"')
    expect(showcaseManagerSource).toContain('class="showcase-editor-hero-icon"')
    expect(showcaseManagerSource).toContain('class="showcase-editor-close"')
  })

  it('prevents the mobile showcase sheet from jittering during animation', () => {
    const overlayRule = cssRuleBlock(showcaseManagerSource, ':global(.el-overlay-dialog:has(.is-showcase-editor-mobile))')
    const sheetRule = cssRuleBlock(showcaseManagerSource, ':global(.el-dialog.is-showcase-editor-mobile)')

    expect(overlayRule).toContain('overflow: hidden;')
    expect(sheetRule).toContain('min-width: 100vw;')
    expect(sheetRule).toContain('flex: 0 0 100vw;')
    expect(showcaseManagerSource).toContain(':global(.dialog-fade-enter-active .el-overlay-dialog:has(.is-showcase-editor-mobile))')
    expect(showcaseManagerSource).toContain('animation: showcase-editor-overlay-fade-in 0.28s')
    expect(showcaseManagerSource).toContain('@keyframes showcase-editor-overlay-fade-in')
  })

  it('separates mobile list and detail scrolling so detail uses natural page scroll', () => {
    expect(showcaseManagerSource).toContain('class="showcase-manager"')
    expect(showcaseManagerSource).toContain(":class=\"{ 'is-detail-mode': viewMode === 'detail' }\"")

    const mobileDetailRule = cssRuleBlock(showcaseManagerSource, '.showcase-manager.is-detail-mode')
    const mobileDetailLayoutRule = cssRuleBlock(showcaseManagerSource, '.showcase-manager.is-detail-mode .layout')
    const mobileDetailStageRule = cssRuleBlock(showcaseManagerSource, '.showcase-manager.is-detail-mode .showcase-detail-stage')

    expect(mobileDetailRule).toContain('height: auto;')
    expect(mobileDetailRule).toContain('min-height: auto;')
    expect(mobileDetailRule).toContain('overflow: visible;')
    expect(mobileDetailLayoutRule).toContain('height: auto;')
    expect(mobileDetailLayoutRule).toContain('overflow: visible;')
    expect(mobileDetailStageRule).toContain('padding: 8px 10px calc(24px + env(safe-area-inset-bottom));')
  })

  it('keeps mobile list mode constrained to a single internal list scroller', () => {
    const mobileListRule = cssRuleBlock(showcaseManagerSource, '.showcase-manager:not(.is-detail-mode)')
    const scrollContentRule = cssRuleBlock(showcaseManagerSource, '.scroll-content')

    expect(mobileListRule).toContain('height: calc(100vh - 50px);')
    expect(mobileListRule).toContain('overflow-y: hidden;')
    expect(scrollContentRule).toContain('overflow-y: auto;')
  })

  it('does not add a second mobile scroll container inside showcase detail content', () => {
    expect(showcaseDetailSource).toContain('.detail-root {')
    expect(showcaseDetailSource).toContain('.detail-content {')

    const mobileBlockStart = showcaseDetailSource.indexOf('@media (max-width: 768px)')
    const mobileBlock = showcaseDetailSource.slice(mobileBlockStart)

    expect(mobileBlock).toContain('.goods-grid {')
    expect(mobileBlock).toContain('grid-template-columns: repeat(2, 1fr);')
    expect(mobileBlock).not.toContain('.detail-root {\n    overflow-y: auto;')
    expect(mobileBlock).not.toContain('.detail-content {\n    overflow-y: auto;')
    expect(mobileBlock).not.toContain('max-height: calc(100')
  })
})
