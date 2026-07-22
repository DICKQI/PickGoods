import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const imageCropperSource = readFileSync(resolve(process.cwd(), 'src/views/goods-form/components/ImageCropper.vue'), 'utf8')

const cssRuleBlock = (source: string, selector: string) => {
  const start = source.indexOf(`\n${selector} {`)
  expect(start).toBeGreaterThan(-1)

  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  expect(open).toBeGreaterThan(start)
  expect(close).toBeGreaterThan(open)

  return source.slice(open + 1, close)
}

describe('ImageCropper dialog layout', () => {
  it('keeps the desktop cropper dialog inside the viewport with fixed footer space', () => {
    const dialogRule = cssRuleBlock(imageCropperSource, '.crop-dialog :deep(.el-dialog)')
    const bodyRule = cssRuleBlock(imageCropperSource, '.crop-dialog :deep(.el-dialog__body)')
    const layoutRule = cssRuleBlock(imageCropperSource, '.crop-layout-inner')

    expect(dialogRule).toContain('max-height: calc(100dvh - 48px);')
    expect(dialogRule).toContain('display: flex;')
    expect(dialogRule).toContain('flex-direction: column;')
    expect(bodyRule).toContain('overflow: hidden;')
    expect(layoutRule).toContain('height: min(520px, calc(100dvh - 360px));')
  })

  it('bounds the live preview panel instead of letting it fill over the footer', () => {
    const previewViewRule = cssRuleBlock(imageCropperSource, '.crop-preview-view')
    const previewCardRule = cssRuleBlock(imageCropperSource, '.crop-preview-view .live-preview-card')
    const previewImageRule = cssRuleBlock(imageCropperSource, '.crop-preview-view .live-preview-img')
    const basePreviewImageRule = cssRuleBlock(imageCropperSource, '.live-preview-img')

    expect(previewViewRule).toContain('max-width: 420px;')
    expect(previewCardRule).toContain('height: min(420px, 100%);')
    expect(previewCardRule).not.toContain('flex: 1;')
    expect(previewImageRule).toContain('max-height: 100%;')
    expect(previewImageRule).toContain('width: auto;')
    expect(basePreviewImageRule).not.toContain('border-radius:')
  })
})
