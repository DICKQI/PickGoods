import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const showcaseManagerSource = readFileSync(resolve(process.cwd(), 'src/components/ShowcaseManager.vue'), 'utf8')

describe('ShowcaseManager add button', () => {
  it('renders a branded text add button for private showcases', () => {
    expect(showcaseManagerSource).toContain('data-test="showcase-create-button"')
    expect(showcaseManagerSource).toContain('class="brand-add-btn brand-add-btn--compact showcase-create-btn"')
    expect(showcaseManagerSource).toContain('class="brand-add-btn__content showcase-create-btn__content"')
    expect(showcaseManagerSource).toContain('class="showcase-create-btn__icon"')
    expect(showcaseManagerSource).toContain('class="showcase-create-btn__label"')
    expect(showcaseManagerSource).toContain('<span class="showcase-create-btn__label">新增展柜</span>')
    expect(showcaseManagerSource).not.toContain('type="primary" circle class="btn-accent"')
  })
})
