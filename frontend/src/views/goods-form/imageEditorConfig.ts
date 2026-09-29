import type { HslColorKey } from './cropHistory'

export type ImageEditorTool = 'crop' | 'adjust' | 'correct' | 'shape'

export interface AspectRatioOption {
  label: string
  value: string
  description: string
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { label: '自由', value: 'free', description: '自定义裁切范围' },
  { label: '1:1', value: '1:1', description: '正方形' },
  { label: '圆形', value: 'circle', description: '透明圆形画布' },
  { label: '47:65', value: '47:65-ellipse', description: '透明椭圆画布' },
  { label: '63:93', value: '63:93-ellipse', description: '透明椭圆画布' },
]

export const IMAGE_EDITOR_TOOLS: Array<{
  key: ImageEditorTool
  label: string
  description: string
}> = [
  { key: 'crop', label: '裁剪', description: '比例与构图' },
  { key: 'adjust', label: '调整', description: '亮度与色彩' },
  { key: 'correct', label: '校正', description: '旋转与透视' },
  { key: 'shape', label: '外形', description: '圆角与边距' },
]

export const HSL_COLOR_TABS: Array<{ key: HslColorKey; label: string }> = [
  { key: 'red', label: '红' },
  { key: 'orange', label: '橙' },
  { key: 'yellow', label: '黄' },
  { key: 'green', label: '绿' },
  { key: 'cyan', label: '青' },
  { key: 'blue', label: '蓝' },
  { key: 'purple', label: '紫' },
]
