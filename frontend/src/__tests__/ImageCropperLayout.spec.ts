import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (relativePath: string) => (
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')
)

describe('ImageCropper layout', () => {
  const cropperSource = source('src/views/goods-form/components/ImageCropper.vue')
  const previewSource = source('src/views/goods-form/components/ImageEditPreview.vue')

  it('桌面使用受视口约束的沉浸式三栏布局', () => {
    expect(cropperSource).toContain('编辑谷子主图')
    expect(cropperSource).not.toContain('编辑商品主图')
    expect(cropperSource).toContain("'min(1440px, calc(100vw - 48px))'")
    expect(cropperSource).toContain(':global(.image-editor-dialog.el-dialog) {')
    expect(cropperSource).toContain('max-height: min(860px, calc(100dvh - 48px));')
    expect(cropperSource).toContain('margin: 24px auto;')
    expect(cropperSource).toContain('grid-template-columns: 72px minmax(0, 1fr) 376px;')
    expect(cropperSource).toContain('overflow: hidden;')
  })

  it('中等屏检查器贴边常驻，移动端使用全屏布局', () => {
    expect(cropperSource).toContain('@media (max-width: 1199px) and (min-width: 769px)')
    expect(cropperSource).toContain('position: absolute;')
    expect(cropperSource).toContain('@media (max-width: 768px)')
    expect(cropperSource).toContain('grid-template-columns: minmax(0, 1fr);')
  })

  it('输出预览有固定尺寸且不会撑破检查器', () => {
    expect(previewSource).toContain('height: 188px;')
    expect(previewSource).toContain('max-width: calc(100% - 20px);')
    expect(previewSource).toContain('max-height: calc(100% - 20px);')
    expect(cropperSource).toContain('.image-editor-inspector__preview {')
    expect(cropperSource).toContain('flex: 0 0 auto;')
    expect(cropperSource).toContain('.image-editor-inspector__scroll {')
    expect(cropperSource).toContain('overflow-y: auto;')
    expect(cropperSource).toContain('overscroll-behavior: contain;')
  })

  it('画布接线右键拖图且不改变现有左键裁剪模式', () => {
    expect(cropperSource).toContain('@pointerdown="handleRightDragPointerDown"')
    expect(cropperSource).toContain('@contextmenu="handleRightDragContextMenu"')
    expect(cropperSource).toContain("dragMode: 'crop'")
  })
})
