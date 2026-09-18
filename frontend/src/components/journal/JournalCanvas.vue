<template>
  <div class="journal-canvas-shell" :class="{ 'is-mobile': mobile }">
    <div v-if="!mobile" class="journal-canvas-toolbar">
      <div class="toolbar-tools" aria-label="画布工具">
        <el-tooltip content="选择" placement="bottom">
          <el-button size="small" :type="tool === 'select' ? 'primary' : 'default'" @click="tool = 'select'">
            <el-icon><Pointer /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="画笔" placement="bottom">
          <el-button size="small" :type="tool === 'draw' ? 'primary' : 'default'" @click="tool = 'draw'">
            <el-icon><EditPen /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="橡皮" placement="bottom">
          <el-button size="small" :type="tool === 'erase' ? 'primary' : 'default'" @click="tool = 'erase'">
            <el-icon><Brush /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="文字" placement="bottom">
          <el-button size="small" @click="addTextLayer()">
            <el-icon><Document /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="矩形" placement="bottom">
          <el-button size="small" @click="addShapeLayer('rect')">
            □
          </el-button>
        </el-tooltip>
        <el-tooltip content="圆形" placement="bottom">
          <el-button size="small" @click="addShapeLayer('circle')">
            ○
          </el-button>
        </el-tooltip>
        <el-tooltip content="吸管取色" placement="bottom">
          <el-button size="small" :type="tool === 'eyedropper' ? 'primary' : 'default'" @click="tool = 'eyedropper'">
            ◉
          </el-button>
        </el-tooltip>
        <el-tooltip content="删除图层" placement="bottom">
          <el-button size="small" :disabled="!selectedLayerId" @click="deleteSelectedLayer">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
      </div>

      <el-popover placement="bottom" trigger="click" width="260">
        <template #reference>
          <el-button class="toolbar-brush" size="small">
            {{ currentBrushLabel }} · {{ currentStrokeWidth }}px
          </el-button>
        </template>
        <div class="toolbar-brush-panel">
          <label class="toolbar-control-row">
            <span>颜色</span>
            <input v-model="brushColor" class="journal-color-input" type="color" aria-label="画笔颜色" />
          </label>
          <label class="toolbar-control-row">
            <span>{{ tool === 'erase' ? '橡皮' : '粗细' }}</span>
            <input
              v-if="tool === 'erase'"
              v-model.number="eraserWidth"
              class="journal-width-input"
              type="range"
              min="4"
              max="80"
              aria-label="橡皮粗细"
            />
            <input
              v-else
              v-model.number="brushWidth"
              class="journal-width-input"
              type="range"
              min="2"
              max="28"
              aria-label="画笔粗细"
            />
          </label>
          <div class="journal-brush-presets" aria-label="画笔类型">
            <button
              v-for="preset in brushPresets"
              :key="preset.type"
              class="brush-preset-btn"
              :class="{ 'is-active': brushType === preset.type }"
              type="button"
              @click="setBrushType(preset.type)"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>
      </el-popover>

      <div class="toolbar-palette journal-palette" aria-label="常用颜色">
        <button
          v-for="color in paletteColors"
          :key="color"
          class="palette-swatch"
          :class="{ 'is-active': brushColor.toLowerCase() === color.toLowerCase() }"
          :style="{ backgroundColor: color }"
          type="button"
          :aria-label="`选择颜色 ${color}`"
          @click="selectPaletteColor(color)"
        />
      </div>
    </div>

    <div
      ref="viewportRef"
      class="journal-canvas-viewport"
      :class="{
        'is-mobile': mobile,
        'is-panning': panning,
        'is-drawing-tool': tool === 'draw' || tool === 'erase' || tool === 'eyedropper',
      }"
      @mousedown.middle.prevent
      @auxclick.middle.prevent
      data-swipe-ignore
    >
      <v-stage
        ref="stageRef"
        :config="stageConfig"
        @mousedown="handlePointerStart"
        @mousemove="handlePointerMove"
        @mouseup="handlePointerEnd"
        @mouseleave="handlePointerLeave"
        @touchstart="handlePointerStart"
        @touchmove="handlePointerMove"
        @touchend="handlePointerEnd"
        @click="handleStageClick"
        @tap="handleStageClick"
      >
        <v-layer>
          <v-group :config="worldConfig">
            <v-group ref="pageGroupRef">
              <v-rect
                :config="{
                  id: 'journal-background',
                  x: canvasBounds.x,
                  y: canvasBounds.y,
                  width: canvasBounds.width,
                  height: canvasBounds.height,
                  fill: background,
                  shadowColor: 'rgba(15, 23, 42, 0.18)',
                  shadowBlur: 18,
                  shadowOffsetX: 0,
                  shadowOffsetY: 10,
                }"
              />

              <template v-for="(line, lineIndex) in backgroundPattern.lines" :key="`bg-line-${lineIndex}`">
                <v-line :config="{ points: line.points, stroke: line.stroke, strokeWidth: 1, listening: false, perfectDrawEnabled: false }" />
              </template>
              <template v-for="(dot, dotIndex) in backgroundPattern.dots" :key="`bg-dot-${dotIndex}`">
                <v-circle :config="{ x: dot.x, y: dot.y, radius: 1.6, fill: 'rgba(120, 120, 140, 0.28)', listening: false, perfectDrawEnabled: false }" />
              </template>

              <v-rect
                v-if="canvasExpanded && !exporting"
                :config="{
                  id: 'journal-page-boundary',
                  x: 0,
                  y: 0,
                  width,
                  height,
                  stroke: 'rgba(184, 148, 31, 0.42)',
                  strokeWidth: 1,
                  dash: [8, 6],
                  listening: false,
                  perfectDrawEnabled: false,
                }"
              />

              <template v-for="layer in sortedLayers" :key="layer.id">
                <template v-for="item in layer.items" :key="item.id">
                  <v-image
                    v-if="item.type === 'sticker' && layer.type === 'sticker'"
                    :ref="setNodeRef(layer.id)"
                    :config="imageConfig(layer, item)"
                    @click="selectLayer(layer.id, Boolean($event?.evt?.shiftKey))"
                    @tap="selectLayer(layer.id)"
                    @dragmove="handleLayerDragMove"
                    @dragend="handleDragEnd($event, layer.id)"
                    @transformend="handleTransformEnd($event, layer.id)"
                  />
                  <v-text
                    v-else-if="item.type === 'text' && layer.type === 'text'"
                    :ref="setNodeRef(layer.id)"
                    :config="textConfig(layer, item)"
                    @click="selectLayer(layer.id, Boolean($event?.evt?.shiftKey))"
                    @tap="selectLayer(layer.id)"
                    @dblclick="editTextLayer(layer.id)"
                    @dbltap="editTextLayer(layer.id)"
                    @dragmove="handleLayerDragMove"
                    @dragend="handleDragEnd($event, layer.id)"
                    @transformend="handleTransformEnd($event, layer.id)"
                  />
                  <v-line v-else-if="item.type === 'stroke' && layer.type === 'draw'" :config="drawConfig(layer, item)" />
                  <v-rect
                    v-else-if="item.type === 'shape' && item.shape_type === 'rect'"
                    :ref="setNodeRef(layer.id)"
                    :config="rectShapeConfig(layer, item)"
                    @click="selectLayer(layer.id, Boolean($event?.evt?.shiftKey))"
                    @tap="selectLayer(layer.id)"
                    @dragmove="handleLayerDragMove"
                    @dragend="handleDragEnd($event, layer.id)"
                    @transformend="handleTransformEnd($event, layer.id)"
                  />
                  <v-circle
                    v-else-if="item.type === 'shape' && item.shape_type === 'circle'"
                    :ref="setNodeRef(layer.id)"
                    :config="circleShapeConfig(layer, item)"
                    @click="selectLayer(layer.id, Boolean($event?.evt?.shiftKey))"
                    @tap="selectLayer(layer.id)"
                    @dragmove="handleLayerDragMove"
                    @dragend="handleDragEnd($event, layer.id)"
                    @transformend="handleTransformEnd($event, layer.id)"
                  />
                </template>
              </template>

              <v-transformer v-if="selectedLayerId && !exporting" ref="transformerRef" :config="{ rotateEnabled: true }" />
            </v-group>

            <template v-for="(guide, guideIndex) in activeGuides" :key="`guide-${guideIndex}`">
              <v-line :config="guideConfig(guide)" />
            </template>

            <v-circle v-if="eraserPreviewConfig.visible && !exporting" :config="eraserPreviewConfig" />
          </v-group>
        </v-layer>
      </v-stage>
      <textarea
        v-if="textEditor.visible"
        ref="textEditorRef"
        v-model="textEditor.value"
        class="text-inline-editor"
        :style="textEditorStyle"
        @keydown.stop
        @blur="commitInlineTextEdit"
      />
    </div>

    <div class="journal-zoom-controls">
      <el-button size="small" @click="setZoom(1)">100%</el-button>
      <el-button size="small" @click="setZoom(zoomLevel - 0.1)">-</el-button>
      <span>{{ Math.round(zoomLevel * 100) }}%</span>
      <el-button size="small" @click="setZoom(zoomLevel + 0.1)">+</el-button>
      <el-button v-if="mobile" size="small" @click="resetViewport">适应</el-button>
      <small v-if="!mobile">拖动空白处或按住中键平移；Ctrl+滚轮缩放</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Konva from 'konva'
import { Brush, Delete, Document, EditPen, Pointer } from '@element-plus/icons-vue'
import type {
  GoodsListItem,
  JournalBrushType,
  JournalDrawLayer,
  JournalLayer,
  JournalLayerItem,
  JournalPageContent,
  JournalShapeItem,
  JournalShapeLayer,
  JournalStickerItem,
  JournalStickerLayer,
  JournalStrokeItem,
  JournalTextItem,
  JournalTextLayer,
} from '@/api/types'
import { cloneJournalContent, cloneJournalLayer, normalizeJournalContent } from '@/utils/journalContent'

const props = withDefaults(defineProps<{
  modelValue: JournalPageContent
  width: number
  height: number
  background: string
  backgroundStyle?: 'plain' | 'dot' | 'line' | 'grid' | 'note' | 'sakura-grid'
  mobile?: boolean
}>(), {
  backgroundStyle: 'plain',
  mobile: false,
})

const emit = defineEmits<{
  'update:modelValue': [content: JournalPageContent]
}>()

type ToolMode = 'select' | 'draw' | 'erase' | 'eyedropper'
type AlignDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
type DistributeDirection = 'horizontal' | 'vertical'
type LayerMoveDirection = 'top' | 'up' | 'down' | 'bottom'
type LayerPatch = Partial<JournalLayer> & Record<string, unknown>
type Point2D = [number, number]

const stageRef = ref<any>(null)
const pageGroupRef = ref<any>(null)
const transformerRef = ref<any>(null)
const viewportRef = ref<HTMLElement | null>(null)
const viewportSize = ref({ width: 760, height: 520 })
let viewportResizeObserver: ResizeObserver | null = null
const tool = ref<ToolMode>('select')
const selectedLayerId = ref<string | null>(null)
const selectedLayerIds = ref<string[]>([])
const brushColor = ref('#8e7dff')
const brushWidth = ref(8)
const brushType = ref<JournalBrushType>('pen')
const brushOpacity = ref(1)
const drawing = ref(false)
const erasing = ref(false)
const panning = ref(false)
const eraserWidth = ref(20)
const eraserPointer = ref<{ x: number; y: number } | null>(null)
const zoomLevel = ref(1)
const canvasOffset = ref({ x: 12, y: 12 })
let mobileTouchGestureActive = false
let mobileTouchStartDistance = 0
let mobileTouchStartZoom = 1
let mobileTouchStartMidpoint = { x: 0, y: 0 }
let mobileTouchStartOffset = { x: 0, y: 0 }
let mobileGestureEndedAt = 0
const imageCache = new Map<string, HTMLImageElement>()
const nodeRefs = new Map<string, any>()
const undoStack = ref<JournalPageContent[]>([])
const redoStack = ref<JournalPageContent[]>([])
const recentColors = ref<string[]>([])
const clipboardLayer = ref<JournalLayer | null>(null)
const exporting = ref(false)
const activeGuides = ref<Array<{ axis: 'x' | 'y'; value: number }>>([])
const textEditorRef = ref<HTMLTextAreaElement | null>(null)
const textEditor = ref({
  visible: false,
  layerId: '',
  value: '',
  x: 0,
  y: 0,
  width: 240,
  fontSize: 32,
  lineHeight: 1.25,
  color: '#333333',
  fontFamily: 'sans-serif',
})

const brushPresets: Array<{ type: JournalBrushType; label: string; opacity: number; tension: number }> = [
  { type: 'pencil', label: '铅笔', opacity: 0.72, tension: 0.18 },
  { type: 'pen', label: '钢笔', opacity: 1, tension: 0.35 },
  { type: 'watercolor', label: '水彩', opacity: 0.46, tension: 0.5 },
  { type: 'marker', label: '马克笔', opacity: 0.66, tension: 0.24 },
  { type: 'highlighter', label: '荧光笔', opacity: 0.38, tension: 0.2 },
]

const paletteColors = [
  '#111827',
  '#333333',
  '#ffffff',
  '#D4AF37',
  '#A29BFE',
  '#8e7dff',
  '#f8b4c4',
  '#f7d6a4',
  '#b8e0d2',
  '#a7c7e7',
  '#6b7280',
  '#ef4444',
]

const localContent = ref<JournalPageContent>(normalizeJournalContent(props.modelValue))
undoStack.value = [cloneJournalContent(props.modelValue)]

const sortedLayers = computed(() =>
  [...localContent.value.layers].sort((a, b) => a.z_index - b.z_index),
)

const selectedLayer = computed(() =>
  localContent.value.layers.find(layer => layer.id === selectedLayerId.value) || null,
)

const selectedItem = computed(() => selectedLayer.value?.items[0] || null)
const currentBrushLabel = computed(() => (
  tool.value === 'erase'
    ? '橡皮'
    : brushPresets.find(preset => preset.type === brushType.value)?.label || '画笔'
))
const currentStrokeWidth = computed(() => (tool.value === 'erase' ? eraserWidth.value : brushWidth.value))
const toolStatusText = computed(() => `当前：${currentBrushLabel.value} ${currentStrokeWidth.value}px`)
const textEditorStyle = computed(() => ({
  left: `${canvasOffset.value.x + textEditor.value.x * scale.value}px`,
  top: `${canvasOffset.value.y + textEditor.value.y * scale.value}px`,
  width: `${Math.max(120, textEditor.value.width * scale.value)}px`,
  minHeight: `${Math.max(44, textEditor.value.fontSize * textEditor.value.lineHeight * scale.value * 2)}px`,
  fontSize: `${textEditor.value.fontSize * scale.value}px`,
  lineHeight: String(textEditor.value.lineHeight),
  color: textEditor.value.color,
  fontFamily: textEditor.value.fontFamily,
}))

const layersForPanel = computed(() =>
  [...localContent.value.layers].sort((a, b) => b.z_index - a.z_index).map(cloneJournalLayer),
)

const CANVAS_CONTENT_PADDING = 24

const getRotatedBounds = (
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
) => {
  const radians = rotation * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const corners = ([
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ] as Array<[number, number]>).map(([cornerX, cornerY]) => ({
    x: x + cornerX * cos - cornerY * sin,
    y: y + cornerX * sin + cornerY * cos,
  }))
  const xs = corners.map(point => point.x)
  const ys = corners.map(point => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

const getLayerRect = (layer: JournalLayer) => {
  const rects = layer.items.flatMap((item) => {
    if (item.type === 'stroke') {
      if (item.points.length < 2) return []
      const xs = item.points.filter((_, index) => index % 2 === 0)
      const ys = item.points.filter((_, index) => index % 2 === 1)
      const padding = item.stroke_width / 2
      const minX = Math.min(...xs) - padding
      const minY = Math.min(...ys) - padding
      const maxX = Math.max(...xs) + padding
      const maxY = Math.max(...ys) + padding
      return [{ x: minX, y: minY, width: maxX - minX, height: maxY - minY }]
    }

    if (item.type === 'text') {
      const longestLine = Math.max(1, ...item.text.split('\n').map(line => line.length))
      const textWidth = item.width || Math.max(item.font_size, longestLine * item.font_size * 0.95)
      const lineCount = Math.max(1, item.text.split('\n').length)
      const textHeight = item.font_size * (item.line_height || 1.25) * lineCount
      return [getRotatedBounds(item.x, item.y, textWidth, textHeight, item.rotation)]
    }

    return [getRotatedBounds(item.x, item.y, item.width, item.height, item.rotation)]
  })

  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const minX = Math.min(...rects.map(rect => rect.x))
  const minY = Math.min(...rects.map(rect => rect.y))
  const maxX = Math.max(...rects.map(rect => rect.x + rect.width))
  const maxY = Math.max(...rects.map(rect => rect.y + rect.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

const canvasBounds = computed(() => {
  let minX = 0
  let minY = 0
  let maxX = props.width
  let maxY = props.height

  localContent.value.layers.forEach((layer) => {
    if (layer.visible === false) return
    const rect = getLayerRect(layer)
    if (rect.width <= 0 && rect.height <= 0) return
    minX = Math.min(minX, rect.x - CANVAS_CONTENT_PADDING)
    minY = Math.min(minY, rect.y - CANVAS_CONTENT_PADDING)
    maxX = Math.max(maxX, rect.x + rect.width + CANVAS_CONTENT_PADDING)
    maxY = Math.max(maxY, rect.y + rect.height + CANVAS_CONTENT_PADDING)
  })

  const x = Math.floor(minX)
  const y = Math.floor(minY)
  return {
    x,
    y,
    width: Math.ceil(maxX - x),
    height: Math.ceil(maxY - y),
  }
})

const canvasExpanded = computed(() => (
  canvasBounds.value.x !== 0
  || canvasBounds.value.y !== 0
  || canvasBounds.value.width !== props.width
  || canvasBounds.value.height !== props.height
))

const PAGE_MARGIN = 12
const MIN_ZOOM = 0.2
const MAX_ZOOM = 3

const baseScale = computed(() => {
  const width = Math.max(1, viewportSize.value.width - PAGE_MARGIN * 2)
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, width / props.width))
})

const scale = computed(() => Math.min(
  MAX_ZOOM,
  Math.max(MIN_ZOOM, baseScale.value * zoomLevel.value),
))

const worldConfig = computed(() => ({
  x: canvasOffset.value.x,
  y: canvasOffset.value.y,
  scaleX: scale.value,
  scaleY: scale.value,
}))

const stageConfig = computed(() => ({
  width: Math.max(1, viewportSize.value.width),
  height: Math.max(1, viewportSize.value.height),
}))

const backgroundPattern = computed(() => {
  const style = props.backgroundStyle || 'plain'
  if (style === 'plain') {
    return {
      lines: [] as Array<{ points: number[]; stroke: string }>,
      dots: [] as Array<{ x: number; y: number }>,
    }
  }
  const gap = 48
  const lineColor = 'rgba(120, 120, 140, 0.16)'
  const lines: Array<{ points: number[]; stroke: string }> = []
  const dots: Array<{ x: number; y: number }> = []
  const bounds = canvasBounds.value
  const firstGridX = Math.ceil(bounds.x / gap) * gap
  const firstGridY = Math.ceil(bounds.y / gap) * gap
  const startX = firstGridX <= bounds.x ? firstGridX + gap : firstGridX
  const startY = firstGridY <= bounds.y ? firstGridY + gap : firstGridY
  const endX = bounds.x + bounds.width
  const endY = bounds.y + bounds.height

  if (style === 'dot' || style === 'sakura-grid') {
    const dotGap = style === 'sakura-grid' ? 40 : gap
    if (style === 'sakura-grid') {
      for (let y = startY; y < endY; y += dotGap) {
        for (let x = startX; x < endX; x += dotGap) {
          dots.push({ x, y })
        }
      }
      return { lines, dots }
    }
    for (let y = startY; y < endY; y += gap) {
      for (let x = startX; x < endX; x += gap) {
        dots.push({ x, y })
      }
    }
  } else if (style === 'grid') {
    for (let x = startX; x < endX; x += gap) lines.push({ points: [x, bounds.y, x, endY], stroke: lineColor })
    for (let y = startY; y < endY; y += gap) lines.push({ points: [bounds.x, y, endX, y], stroke: lineColor })
  } else if (style === 'line' || style === 'note') {
    for (let y = startY; y < endY; y += gap) lines.push({ points: [bounds.x, y, endX, y], stroke: lineColor })
    if (style === 'note') {
      const margin = Math.round(props.width * 0.12)
      lines.push({ points: [margin, bounds.y, margin, endY], stroke: 'rgba(220, 120, 120, 0.32)' })
    }
  }
  return { lines, dots }
})

const eraserPreviewConfig = computed(() => ({
  x: eraserPointer.value?.x ?? 0,
  y: eraserPointer.value?.y ?? 0,
  radius: Math.max(1, eraserWidth.value / 2),
  visible: tool.value === 'erase' && Boolean(eraserPointer.value),
  stroke: 'rgba(17, 24, 39, 0.78)',
  strokeWidth: Math.max(1, 1.5 / scale.value),
  dash: [6 / scale.value, 4 / scale.value],
  fill: 'rgba(17, 24, 39, 0.08)',
  listening: false,
}))

const cloneContent = (): JournalPageContent => ({
  version: 2,
  layers: localContent.value.layers.map(cloneJournalLayer),
})

const recordHistory = (content: JournalPageContent) => {
  undoStack.value = [...undoStack.value, cloneJournalContent(content)].slice(-80)
  redoStack.value = []
}

const emitLayers = (layers: JournalLayer[], options: { history?: boolean } = {}) => {
  const content = { version: 2, layers: layers.map(cloneJournalLayer) } satisfies JournalPageContent
  localContent.value = cloneJournalContent(content)
  if (options.history !== false) recordHistory(content)
  emit('update:modelValue', content)
}

const nextZIndex = () => Math.max(0, ...localContent.value.layers.map(layer => layer.z_index)) + 1

const createLayerId = (prefix: string) => (
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`
)

const setSelectedLayerIds = (ids: string[]) => {
  selectedLayerIds.value = [...new Set(ids)].filter(id => localContent.value.layers.some(layer => layer.id === id))
  selectedLayerId.value = selectedLayerIds.value[selectedLayerIds.value.length - 1] || null
}

const canEditLayer = (layer: JournalLayer) => !layer.locked && layer.visible !== false && layer.type !== 'draw'

const firstPositionedItem = (layer: JournalLayer) => {
  const item = layer.items[0]
  return item && 'x' in item && 'y' in item ? item : null
}

const patchLayerItem = (layer: JournalLayer, patch: Record<string, unknown>): JournalLayer => ({
  ...layer,
  items: layer.items.map((item, index) => index === 0 ? { ...item, ...patch } as JournalLayerItem : item),
} as JournalLayer)

const simplifyPoints = (points: number[], minDistance = 1.5) => {
  const simplified: number[] = []
  for (let index = 0; index < points.length; index += 2) {
    const x = points[index]
    const y = points[index + 1]
    if (typeof x !== 'number' || typeof y !== 'number') continue
    if (simplified.length < 2) {
      simplified.push(x, y)
      continue
    }
    const lastX = simplified[simplified.length - 2]!
    const lastY = simplified[simplified.length - 1]!
    if (Math.hypot(x - lastX, y - lastY) >= minDistance || index >= points.length - 2) {
      simplified.push(x, y)
    }
  }
  return simplified.length >= 2 ? simplified : points
}

const resolveGoodsImage = (goods: GoodsListItem) => goods.main_photo || ''

const addGoodsSticker = (goods: GoodsListItem, src = resolveGoodsImage(goods)) => {
  if (!src) return
  const stickerWidth = 260
  const stickerHeight = 260
  const layer: JournalStickerLayer = {
    id: createLayerId('sticker'),
    type: 'sticker',
    name: goods.name || '贴纸层',
    opacity: 1,
    z_index: nextZIndex(),
    items: [{
      id: createLayerId('sticker-item'),
      type: 'sticker',
      goods_id: goods.id,
      src,
      x: Math.round(props.mobile ? (props.width - stickerWidth) / 2 : props.width * 0.34),
      y: Math.round(props.mobile ? (props.height - stickerHeight) / 2 : props.height * 0.24),
      width: stickerWidth,
      height: stickerHeight,
      rotation: 0,
    }],
  }
  emitLayers([...localContent.value.layers, layer])
  setSelectedLayerIds([layer.id])
}

const addLocalSticker = (payload: { name: string; src: string; source?: 'decor' | 'upload' }) => {
  if (!payload.src) return
  const stickerWidth = payload.source === 'decor' ? 220 : 280
  const stickerHeight = payload.source === 'decor' ? 180 : 280
  const layer: JournalStickerLayer = {
    id: createLayerId('sticker'),
    type: 'sticker',
    name: payload.name || '贴纸层',
    opacity: 1,
    z_index: nextZIndex(),
    items: [{
      id: createLayerId('sticker-item'),
      type: 'sticker',
      goods_id: '',
      src: payload.src,
      x: Math.round(props.mobile ? (props.width - stickerWidth) / 2 : props.width * 0.32),
      y: Math.round(props.mobile ? (props.height - stickerHeight) / 2 : props.height * 0.22),
      width: stickerWidth,
      height: stickerHeight,
      rotation: 0,
    }],
  }
  emitLayers([...localContent.value.layers, layer])
  setSelectedLayerIds([layer.id])
}

const addShapeLayer = (shapeType: JournalShapeItem['shape_type'] = 'rect') => {
  const layer: JournalShapeLayer = {
    id: createLayerId('shape'),
    type: 'shape',
    name: shapeType === 'circle' ? '圆形' : '矩形',
    opacity: 1,
    z_index: nextZIndex(),
    items: [{
      id: createLayerId('shape-item'),
      type: 'shape',
      shape_type: shapeType,
      x: Math.round(props.width * 0.24),
      y: Math.round(props.height * 0.22),
      width: 220,
      height: 160,
      rotation: 0,
      fill: '#ffffff',
      stroke: brushColor.value,
      stroke_width: Math.max(2, Math.round(brushWidth.value / 2)),
    }],
  }
  emitLayers([...localContent.value.layers, layer])
  setSelectedLayerIds([layer.id])
}

const addTextLayer = (text = '写点什么') => {
  const layer: JournalTextLayer = {
    id: createLayerId('text'),
    type: 'text',
    name: text ? `文字：${text.slice(0, 12)}` : '文字层',
    opacity: 1,
    z_index: nextZIndex(),
    items: [{
      id: createLayerId('text-item'),
      type: 'text',
      text,
      x: Math.round(props.width * 0.18),
      y: Math.round(props.height * 0.18),
      font_size: 44,
      fill: '#333333',
      rotation: 0,
    }],
  }
  emitLayers([...localContent.value.layers, layer])
  setSelectedLayerIds([layer.id])
}

const setBrushType = (type: JournalBrushType) => {
  brushType.value = type
  brushOpacity.value = brushPresets.find(item => item.type === type)?.opacity ?? 1
}

const setTool = (mode: ToolMode) => {
  tool.value = mode
}

const setBrushWidth = (width: number) => {
  brushWidth.value = Math.min(80, Math.max(1, Math.round(Number(width) || 1)))
}

const setEraserWidth = (width: number) => {
  eraserWidth.value = Math.min(120, Math.max(4, Math.round(Number(width) || 20)))
}

const selectPaletteColor = (color: string) => {
  brushColor.value = color
  recentColors.value = [color, ...recentColors.value.filter(item => item.toLowerCase() !== color.toLowerCase())].slice(0, 8)
}

const clampZoom = (zoom: number) => (
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(zoom) || 1))
)

const getViewportRect = () => {
  const rect = viewportRef.value?.getBoundingClientRect()
  if (rect?.width && rect.height) return rect
  return {
    left: 0,
    top: 0,
    width: viewportSize.value.width,
    height: viewportSize.value.height,
  } as DOMRect
}

const zoomAtPoint = (zoom: number, point: { x: number; y: number }) => {
  const nextZoom = clampZoom(zoom)
  const currentScale = scale.value
  const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, baseScale.value * nextZoom))
  const worldX = (point.x - canvasOffset.value.x) / currentScale
  const worldY = (point.y - canvasOffset.value.y) / currentScale

  zoomLevel.value = nextZoom
  canvasOffset.value = {
    x: point.x - worldX * nextScale,
    y: point.y - worldY * nextScale,
  }
}

const setZoom = (zoom: number) => {
  const rect = getViewportRect()
  zoomAtPoint(zoom, {
    x: rect.width / 2,
    y: rect.height / 2,
  })
}

const handleWheel = (event: WheelEvent) => {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const rect = getViewportRect()
  const unit = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2
      ? rect.height
      : 1
  const delta = event.deltaY * unit
  zoomAtPoint(zoomLevel.value * Math.exp(-delta * 0.002), {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  })
}

const resetViewport = () => {
  panning.value = false
  zoomLevel.value = 1
  canvasOffset.value = { x: PAGE_MARGIN, y: PAGE_MARGIN }
}

const panCanvas = (deltaX: number, deltaY: number) => {
  canvasOffset.value = {
    x: Math.round(canvasOffset.value.x + (Number(deltaX) || 0)),
    y: Math.round(canvasOffset.value.y + (Number(deltaY) || 0)),
  }
}

const EDGE_AUTOPAN_THRESHOLD = 48
const EDGE_AUTOPAN_SPEED = 16
let autoPanFrame = 0
let autoPanVelocity = { x: 0, y: 0 }

const stopLayerAutoPan = () => {
  autoPanVelocity = { x: 0, y: 0 }
  if (autoPanFrame) {
    window.cancelAnimationFrame(autoPanFrame)
    autoPanFrame = 0
  }
}

const runLayerAutoPan = () => {
  autoPanFrame = 0
  if (autoPanVelocity.x === 0 && autoPanVelocity.y === 0) return
  panCanvas(autoPanVelocity.x, autoPanVelocity.y)
  autoPanFrame = window.requestAnimationFrame(runLayerAutoPan)
}

const edgePanSpeed = (position: number, size: number) => {
  const clamped = Math.min(size, Math.max(0, position))
  if (clamped < EDGE_AUTOPAN_THRESHOLD) {
    return -Math.ceil((1 - clamped / EDGE_AUTOPAN_THRESHOLD) * EDGE_AUTOPAN_SPEED)
  }
  if (clamped > size - EDGE_AUTOPAN_THRESHOLD) {
    return Math.ceil((1 - (size - clamped) / EDGE_AUTOPAN_THRESHOLD) * EDGE_AUTOPAN_SPEED)
  }
  return 0
}

const handleLayerDragMove = () => {
  if (props.mobile) {
    stopLayerAutoPan()
    return
  }
  const position = getStage()?.getPointerPosition?.()
  if (!position) return
  autoPanVelocity = {
    x: edgePanSpeed(position.x, viewportSize.value.width),
    y: edgePanSpeed(position.y, viewportSize.value.height),
  }
  if (!autoPanFrame && (autoPanVelocity.x !== 0 || autoPanVelocity.y !== 0)) {
    panCanvas(autoPanVelocity.x, autoPanVelocity.y)
    autoPanFrame = window.requestAnimationFrame(runLayerAutoPan)
  }
}

const touchDistance = (touches: TouchList) => {
  const first = touches[0]
  const second = touches[1]
  if (!first || !second) return 0
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
}

const touchMidpoint = (touches: TouchList) => {
  const first = touches[0]
  const second = touches[1]
  if (!first || !second) return { x: 0, y: 0 }
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  }
}

const handleMobileTouchStart = (event: TouchEvent) => {
  if (!props.mobile || event.touches.length < 2 || !viewportRef.value) return
  handlePointerEnd()
  const rect = getViewportRect()
  const midpoint = touchMidpoint(event.touches)
  mobileTouchGestureActive = true
  mobileTouchStartDistance = Math.max(1, touchDistance(event.touches))
  mobileTouchStartZoom = zoomLevel.value
  mobileTouchStartMidpoint = {
    x: midpoint.x - rect.left,
    y: midpoint.y - rect.top,
  }
  mobileTouchStartOffset = { ...canvasOffset.value }
  event.preventDefault()
  event.stopPropagation()
}

const handleMobileTouchMove = (event: TouchEvent) => {
  const viewport = viewportRef.value
  if (!props.mobile || !mobileTouchGestureActive || event.touches.length < 2 || !viewport) return
  event.preventDefault()
  event.stopPropagation()

  const rect = viewport.getBoundingClientRect()
  const rawMidpoint = touchMidpoint(event.touches)
  const midpoint = {
    x: rawMidpoint.x - rect.left,
    y: rawMidpoint.y - rect.top,
  }
  const distance = Math.max(1, touchDistance(event.touches))
  const ratio = distance / mobileTouchStartDistance
  const nextZoom = clampZoom(mobileTouchStartZoom * ratio)
  const startScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, baseScale.value * mobileTouchStartZoom))
  const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, baseScale.value * nextZoom))
  const worldX = (mobileTouchStartMidpoint.x - mobileTouchStartOffset.x) / startScale
  const worldY = (mobileTouchStartMidpoint.y - mobileTouchStartOffset.y) / startScale

  zoomLevel.value = nextZoom
  canvasOffset.value = {
    x: midpoint.x - worldX * nextScale,
    y: midpoint.y - worldY * nextScale,
  }
}

const handleMobileTouchEnd = (event: TouchEvent) => {
  if (!props.mobile) return
  if (event.touches.length < 2 && mobileTouchGestureActive) {
    mobileTouchGestureActive = false
    mobileGestureEndedAt = Date.now()
  }
}

const appendStrokeToLayer = (layerId: string, strokeItem: JournalStrokeItem) => {
  emitLayers(localContent.value.layers.map(layer => (
    layer.id === layerId
      ? { ...layer, items: [...layer.items, strokeItem] } as JournalLayer
      : layer
  )))
}

const nextDrawLayerName = () => `画笔层 ${localContent.value.layers.filter(item => item.type === 'draw').length + 1}`

const addBrushLayer = () => {
  const layer: JournalDrawLayer = {
    id: createLayerId('draw'),
    type: 'draw',
    name: nextDrawLayerName(),
    opacity: 1,
    z_index: nextZIndex(),
    items: [],
  }
  emitLayers([...localContent.value.layers, layer])
  setSelectedLayerIds([layer.id])
}

const addDrawLayer = (
  points: number[],
  stroke = brushColor.value,
  strokeWidth = brushWidth.value,
  type = brushType.value,
  opacity = brushOpacity.value,
) => {
  const currentLayer = selectedLayer.value
  if (currentLayer?.type === 'draw' && (currentLayer.locked || currentLayer.visible === false)) return

  const strokeItem: JournalStrokeItem = {
    id: createLayerId('stroke'),
    type: 'stroke',
    brush_type: type,
    points: simplifyPoints(points),
    stroke,
    stroke_width: strokeWidth,
    opacity,
  }

  if (currentLayer?.type === 'draw') {
    appendStrokeToLayer(currentLayer.id, strokeItem)
    return
  }

  const reusableDrawLayer = localContent.value.layers.find(layer => (
    layer.type === 'draw' && !layer.locked && layer.visible !== false
  ))
  if (reusableDrawLayer) {
    setSelectedLayerIds([reusableDrawLayer.id])
    appendStrokeToLayer(reusableDrawLayer.id, strokeItem)
    return
  }

  const layer: JournalDrawLayer = {
    id: createLayerId('draw'),
    type: 'draw',
    name: nextDrawLayerName(),
    opacity: 1,
    z_index: nextZIndex(),
    items: [strokeItem],
  }
  emitLayers([...localContent.value.layers, layer])
  setSelectedLayerIds([layer.id])
}

const deleteSelectedLayer = () => {
  if (!selectedLayerId.value) return
  emitLayers(localContent.value.layers.filter(layer => layer.id !== selectedLayerId.value))
  setSelectedLayerIds([])
}

const patchLayer = (layer: JournalLayer, patch: LayerPatch): JournalLayer => {
  const layerPatch: Record<string, unknown> = {}
  const itemPatch: Record<string, unknown> = {}
  Object.entries(patch).forEach(([key, value]) => {
    if (['locked', 'visible', 'name', 'opacity', 'z_index'].includes(key)) {
      layerPatch[key] = value
    } else {
      itemPatch[key] = value
    }
  })

  return {
    ...layer,
    ...layerPatch,
    items: Object.keys(itemPatch).length === 0
      ? layer.items
      : layer.items.map((item, index) => index === 0 ? { ...item, ...itemPatch } as JournalLayerItem : item),
  } as JournalLayer
}

const updateLayer = (id: string, patch: LayerPatch) => {
  const current = localContent.value.layers.find(layer => layer.id === id)
  const metadataKeys = new Set(['locked', 'visible', 'name'])
  const metadataOnly = Object.keys(patch).every(key => metadataKeys.has(key))
  if (current?.locked && !metadataOnly) return
  emitLayers(localContent.value.layers.map(layer => (
    layer.id === id ? patchLayer(layer, patch) : layer
  )))
}

const updateSelectedLayer = (patch: LayerPatch) => {
  if (!selectedLayerId.value) return
  updateLayer(selectedLayerId.value, patch)
}

const renameSelectedLayer = (name: string) => {
  updateSelectedLayer({ name })
}

const toggleSelectedLayerLock = () => {
  if (!selectedLayer.value) return
  updateSelectedLayer({ locked: !selectedLayer.value.locked })
}

const toggleLayerLock = (id: string) => {
  const layer = localContent.value.layers.find(item => item.id === id)
  if (!layer) return
  updateLayer(id, { locked: !layer.locked })
}

const toggleSelectedLayerVisibility = () => {
  if (!selectedLayer.value) return
  updateSelectedLayer({ visible: selectedLayer.value.visible === false })
}

const toggleLayerVisibility = (id: string) => {
  const layer = localContent.value.layers.find(item => item.id === id)
  if (!layer) return
  updateLayer(id, { visible: layer.visible === false })
}

const duplicateSelectedLayer = () => {
  if (!selectedLayer.value) return
  const source = cloneJournalLayer(selectedLayer.value)
  const copy: JournalLayer = {
    ...source,
    id: createLayerId(source.type),
    name: source.name ? `${source.name} 副本` : undefined,
    z_index: nextZIndex(),
    items: source.items.map(item => {
      const next = { ...item, id: createLayerId(item.type) } as JournalLayerItem
      if ('x' in next && 'y' in next) {
        return { ...next, x: next.x + 24, y: next.y + 24 } as JournalLayerItem
      }
      return next
    }),
  }
  emitLayers([...localContent.value.layers, copy])
  setSelectedLayerIds([copy.id])
}

const cloneLayerForPaste = (source: JournalLayer): JournalLayer => ({
  ...cloneJournalLayer(source),
  id: createLayerId(source.type),
  name: source.name ? `${source.name} 副本` : undefined,
  z_index: nextZIndex(),
  items: source.items.map(item => {
    const next = { ...item, id: createLayerId(item.type) } as JournalLayerItem
    if ('x' in next && 'y' in next) {
      return { ...next, x: next.x + 24, y: next.y + 24 } as JournalLayerItem
    }
    return next
  }),
})

const copySelectedLayer = () => {
  if (!selectedLayer.value) return
  clipboardLayer.value = cloneJournalLayer(selectedLayer.value)
}

const pasteLayer = () => {
  if (!clipboardLayer.value) return
  const copy = cloneLayerForPaste(clipboardLayer.value)
  emitLayers([...localContent.value.layers, copy])
  setSelectedLayerIds([copy.id])
  clipboardLayer.value = cloneJournalLayer(copy)
}

const getLayerBounds = (layer: JournalLayer) => {
  const rect = getLayerRect(layer)
  return { width: rect.width, height: rect.height }
}

const alignSelectedLayer = (direction: AlignDirection) => {
  const layer = selectedLayer.value
  if (!layer || layer.type === 'draw' || layer.locked) return
  const bounds = getLayerBounds(layer)
  const patch: LayerPatch = {}
  if (direction === 'left') patch.x = 0
  if (direction === 'center') patch.x = Math.round((props.width - bounds.width) / 2)
  if (direction === 'right') patch.x = Math.round(props.width - bounds.width)
  if (direction === 'top') patch.y = 0
  if (direction === 'middle') patch.y = Math.round((props.height - bounds.height) / 2)
  if (direction === 'bottom') patch.y = Math.round(props.height - bounds.height)
  updateSelectedLayer(patch)
}

const alignSelectedLayers = (direction: AlignDirection) => {
  const selected = localContent.value.layers.filter(layer => selectedLayerIds.value.includes(layer.id) && canEditLayer(layer))
  if (selected.length <= 1) {
    alignSelectedLayer(direction)
    return
  }
  const positioned = selected.map(layer => ({ layer, item: firstPositionedItem(layer), bounds: getLayerBounds(layer) }))
    .filter(entry => entry.item)
  if (positioned.length === 0) return

  const xs = positioned.map(entry => entry.item!.x)
  const ys = positioned.map(entry => entry.item!.y)
  const rights = positioned.map(entry => entry.item!.x + entry.bounds.width)
  const bottoms = positioned.map(entry => entry.item!.y + entry.bounds.height)
  const targetLeft = Math.min(...xs)
  const targetTop = Math.min(...ys)
  const targetRight = Math.max(...rights)
  const targetBottom = Math.max(...bottoms)
  const centerX = Math.round((targetLeft + targetRight) / 2)
  const centerY = Math.round((targetTop + targetBottom) / 2)

  emitLayers(localContent.value.layers.map(layer => {
    const entry = positioned.find(item => item.layer.id === layer.id)
    if (!entry?.item) return layer
    const patch: Record<string, unknown> = {}
    if (direction === 'left') patch.x = targetLeft
    if (direction === 'center') patch.x = Math.round(centerX - entry.bounds.width / 2)
    if (direction === 'right') patch.x = Math.round(targetRight - entry.bounds.width)
    if (direction === 'top') patch.y = targetTop
    if (direction === 'middle') patch.y = Math.round(centerY - entry.bounds.height / 2)
    if (direction === 'bottom') patch.y = Math.round(targetBottom - entry.bounds.height)
    return patchLayerItem(layer, patch)
  }))
}

const distributeSelectedLayers = (direction: DistributeDirection) => {
  const positioned = localContent.value.layers
    .filter(layer => selectedLayerIds.value.includes(layer.id) && canEditLayer(layer))
    .map(layer => ({ layer, item: firstPositionedItem(layer) }))
    .filter(entry => entry.item)
    .sort((a, b) => direction === 'horizontal' ? a.item!.x - b.item!.x : a.item!.y - b.item!.y)
  if (positioned.length < 3) return
  const first = positioned[0]!.item!
  const last = positioned[positioned.length - 1]!.item!
  const start = direction === 'horizontal' ? first.x : first.y
  const end = direction === 'horizontal' ? last.x : last.y
  const gap = (end - start) / (positioned.length - 1)

  emitLayers(localContent.value.layers.map(layer => {
    const index = positioned.findIndex(entry => entry.layer.id === layer.id)
    if (index < 0) return layer
    const next = Math.round(start + gap * index)
    return patchLayerItem(layer, direction === 'horizontal' ? { x: next } : { y: next })
  }))
}

const nudgeSelectedLayers = (deltaX: number, deltaY: number) => {
  const selected = selectedLayerIds.value.length > 0 ? selectedLayerIds.value : selectedLayerId.value ? [selectedLayerId.value] : []
  if (selected.length === 0) return
  emitLayers(localContent.value.layers.map(layer => {
    if (!selected.includes(layer.id) || !canEditLayer(layer)) return layer
    const item = firstPositionedItem(layer)
    if (!item) return layer
    return patchLayerItem(layer, {
      x: Math.round(item.x + deltaX),
      y: Math.round(item.y + deltaY),
    })
  }))
}

const getSnapPosition = (layerId: string, position: { x: number; y: number }, threshold = 6) => {
  const guides: Array<{ axis: 'x' | 'y'; value: number }> = []
  let nextX = position.x
  let nextY = position.y
  const xGuides = [0, Math.round(props.width / 2), props.width]
  const yGuides = [0, Math.round(props.height / 2), props.height]
  localContent.value.layers.forEach(layer => {
    if (layer.id === layerId || layer.visible === false) return
    const item = firstPositionedItem(layer)
    if (!item) return
    const bounds = getLayerBounds(layer)
    xGuides.push(item.x, Math.round(item.x + bounds.width / 2), item.x + bounds.width)
    yGuides.push(item.y, Math.round(item.y + bounds.height / 2), item.y + bounds.height)
  })
  const xGuide = xGuides.find(value => Math.abs(value - position.x) <= threshold)
  const yGuide = yGuides.find(value => Math.abs(value - position.y) <= threshold)
  if (typeof xGuide === 'number') {
    nextX = xGuide
    guides.push({ axis: 'x', value: xGuide })
  }
  if (typeof yGuide === 'number') {
    nextY = yGuide
    guides.push({ axis: 'y', value: yGuide })
  }
  return {
    x: Math.min(100000, Math.max(-100000, nextX)),
    y: Math.min(100000, Math.max(-100000, nextY)),
    guides,
  }
}

const distanceToSegment = (
  x: number,
  y: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) => {
  const deltaX = endX - startX
  const deltaY = endY - startY
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  if (lengthSquared === 0) return Math.hypot(x - startX, y - startY)
  const ratio = Math.max(0, Math.min(1, ((x - startX) * deltaX + (y - startY) * deltaY) / lengthSquared))
  const projectionX = startX + ratio * deltaX
  const projectionY = startY + ratio * deltaY
  return Math.hypot(x - projectionX, y - projectionY)
}

const strokeHitsPoint = (stroke: JournalStrokeItem, x: number, y: number, radius = 10) => {
  for (let index = 0; index < stroke.points.length; index += 2) {
    const px = stroke.points[index]
    const py = stroke.points[index + 1]
    if (typeof px === 'number' && typeof py === 'number' && Math.hypot(px - x, py - y) <= radius) {
      return true
    }
    const previousX = stroke.points[index - 2]
    const previousY = stroke.points[index - 1]
    if (
      typeof previousX === 'number' &&
      typeof previousY === 'number' &&
      typeof px === 'number' &&
      typeof py === 'number' &&
      distanceToSegment(x, y, previousX, previousY, px, py) <= radius
    ) {
      return true
    }
  }
  return false
}

const cloneStrokeWithPoints = (stroke: JournalStrokeItem, points: number[], index: number): JournalStrokeItem => ({
  ...stroke,
  id: index === 0 ? stroke.id : createLayerId('stroke'),
  points,
})

const roundEraserPoint = (value: number) => Math.round(value * 1000) / 1000

const addPointToRun = (run: number[], point: Point2D) => {
  const x = roundEraserPoint(point[0])
  const y = roundEraserPoint(point[1])
  const lastX = run[run.length - 2]
  const lastY = run[run.length - 1]
  if (lastX === x && lastY === y) return
  run.push(x, y)
}

const interpolatePoint = (start: Point2D, end: Point2D, ratio: number): Point2D => [
  start[0] + (end[0] - start[0]) * ratio,
  start[1] + (end[1] - start[1]) * ratio,
]

const segmentCircleIntersections = (start: Point2D, end: Point2D, x: number, y: number, radius: number) => {
  const deltaX = end[0] - start[0]
  const deltaY = end[1] - start[1]
  const fromCenterX = start[0] - x
  const fromCenterY = start[1] - y
  const a = deltaX * deltaX + deltaY * deltaY
  if (a === 0) return []
  const b = 2 * (fromCenterX * deltaX + fromCenterY * deltaY)
  const c = fromCenterX * fromCenterX + fromCenterY * fromCenterY - radius * radius
  const discriminant = b * b - 4 * a * c
  if (discriminant <= 0) return []
  const root = Math.sqrt(discriminant)
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter(ratio => ratio > 0 && ratio < 1)
    .sort((left, right) => left - right)
    .filter((ratio, index, ratios) => index === 0 || Math.abs(ratio - ratios[index - 1]!) > 0.0001)
}

const pointOutsideEraser = (point: Point2D, x: number, y: number, radius: number) => (
  Math.hypot(point[0] - x, point[1] - y) > radius
)

const segmentOutsideIntervals = (start: Point2D, end: Point2D, x: number, y: number, radius: number) => {
  const boundaries = [0, ...segmentCircleIntersections(start, end, x, y, radius), 1]
  const intervals: Array<{ start: number; end: number }> = []
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startRatio = boundaries[index]!
    const endRatio = boundaries[index + 1]!
    if (endRatio - startRatio <= 0.0001) continue
    const middle = interpolatePoint(start, end, (startRatio + endRatio) / 2)
    if (pointOutsideEraser(middle, x, y, radius)) {
      intervals.push({ start: startRatio, end: endRatio })
    }
  }
  return intervals
}

const splitStrokeByEraser = (stroke: JournalStrokeItem, x: number, y: number, radius: number) => {
  const pointPairs: Point2D[] = []
  for (let index = 0; index < stroke.points.length; index += 2) {
    const px = stroke.points[index]
    const py = stroke.points[index + 1]
    if (typeof px === 'number' && typeof py === 'number') pointPairs.push([px, py])
  }
  if (pointPairs.length < 2) {
    return strokeHitsPoint(stroke, x, y, radius) ? [] : [stroke]
  }

  const keptRuns: number[][] = []
  let currentRun: number[] = []
  let changed = false
  const finishRun = () => {
    if (currentRun.length >= 4) keptRuns.push(currentRun)
    currentRun = []
  }

  for (let index = 1; index < pointPairs.length; index += 1) {
    const previous = pointPairs[index - 1]!
    const current = pointPairs[index]!
    const intervals = segmentOutsideIntervals(previous, current, x, y, radius)
    if (intervals.length === 0) {
      changed = true
      finishRun()
      continue
    }

    intervals.forEach((interval, intervalIndex) => {
      const hadGapBefore = intervalIndex > 0 || interval.start > 0.0001
      const hasGapAfter = interval.end < 0.9999
      if (hadGapBefore) {
        changed = true
        finishRun()
      }
      addPointToRun(currentRun, interpolatePoint(previous, current, interval.start))
      addPointToRun(currentRun, interpolatePoint(previous, current, interval.end))
      if (hasGapAfter) {
        changed = true
        finishRun()
      }
    })
  }

  finishRun()
  return changed ? keptRuns.map((points, index) => cloneStrokeWithPoints(stroke, points, index)) : [stroke]
}

const eraseStrokeAtPoint = (x: number, y: number, width = eraserWidth.value) => {
  const targetLayerId = selectedLayer.value?.type === 'draw' ? selectedLayer.value.id : null
  if (!targetLayerId) return
  let changed = false
  const radius = Math.max(1, (Number(width) || eraserWidth.value) / 2)
  const layers = localContent.value.layers.map(layer => {
    if (layer.id !== targetLayerId || layer.type !== 'draw' || layer.locked || layer.visible === false) return layer
    const items: JournalLayerItem[] = layer.items.flatMap((item): JournalLayerItem[] => {
      if (item.type !== 'stroke') return [item]
      const nextItems = splitStrokeByEraser(item, x, y, radius)
      if (nextItems.length !== 1 || nextItems[0]?.points !== item.points) changed = true
      return nextItems
    })
    return { ...layer, items } as JournalLayer
  })
  if (changed) emitLayers(layers)
}

const normalizeZIndexes = (layers: JournalLayer[]) => (
  [...layers]
    .sort((a, b) => a.z_index - b.z_index)
    .map((layer, index) => ({ ...layer, z_index: index + 1 }) as JournalLayer)
)

const assignZIndexes = (layers: JournalLayer[]) => (
  layers.map((layer, index) => ({ ...layer, z_index: index + 1 }) as JournalLayer)
)

const moveSelectedLayer = (direction: LayerMoveDirection) => {
  if (!selectedLayerId.value) return
  const ordered = normalizeZIndexes(localContent.value.layers)
  const currentIndex = ordered.findIndex(layer => layer.id === selectedLayerId.value)
  if (currentIndex < 0) return

  const [current] = ordered.splice(currentIndex, 1)
  if (!current) return

  if (direction === 'top') {
    ordered.push(current)
  } else if (direction === 'bottom') {
    ordered.unshift(current)
  } else if (direction === 'up') {
    ordered.splice(Math.min(ordered.length, currentIndex + 1), 0, current)
  } else {
    ordered.splice(Math.max(0, currentIndex - 1), 0, current)
  }

  emitLayers(assignZIndexes(ordered))
}

const editTextLayer = (id = selectedLayerId.value || '') => {
  const layer = localContent.value.layers.find(item => item.id === id)
  if (!layer || layer.type !== 'text') return
  setSelectedLayerIds([layer.id])
  const item = layer.items[0]
  if (!item || item.type !== 'text') return
  textEditor.value = {
    visible: true,
    layerId: layer.id,
    value: item.text,
    x: item.x,
    y: item.y,
    width: item.width || 260,
    fontSize: item.font_size,
    lineHeight: item.line_height || 1.25,
    color: item.fill,
    fontFamily: item.font_family || 'sans-serif',
  }
  nextTick(() => {
    textEditorRef.value?.focus()
    textEditorRef.value?.select()
  })
}

const commitInlineTextEdit = () => {
  if (!textEditor.value.visible || !textEditor.value.layerId) return
  updateLayer(textEditor.value.layerId, { text: textEditor.value.value || '写点什么' })
  textEditor.value.visible = false
}

const getStage = () => stageRef.value?.getNode?.()

const getPointer = () => {
  const stage = getStage()
  const position = stage?.getPointerPosition?.()
  if (!position) return null
  return {
    x: Math.round((position.x - canvasOffset.value.x) / scale.value),
    y: Math.round((position.y - canvasOffset.value.y) / scale.value),
  }
}

const updateEraserPointer = () => {
  const pointer = getPointer()
  eraserPointer.value = pointer
  return pointer
}

let panStartClient = { x: 0, y: 0 }
let panStartOffset = { x: 0, y: 0 }
let panMoved = false
let suppressStageClick = false

const getClientPoint = (event: any) => {
  const source = event?.evt
  if (!source) return null
  if (typeof source.clientX === 'number' && typeof source.clientY === 'number') {
    return { x: source.clientX, y: source.clientY }
  }
  const touch = source.touches?.[0]
  return touch
    ? { x: touch.clientX, y: touch.clientY }
    : null
}

const isBackgroundPointer = (event: any) => {
  const target = event?.target
  if (!target) return true
  const stage = target.getStage?.()
  return target === stage || target.id?.() === 'journal-background'
}

const beginCanvasPan = (event: any) => {
  const point = getClientPoint(event)
  if (!point) return false
  panning.value = true
  panMoved = false
  suppressStageClick = false
  panStartClient = point
  panStartOffset = { ...canvasOffset.value }
  event?.evt?.preventDefault?.()
  return true
}

const handlePointerStart = (event: any) => {
  const mouseButton = event?.evt?.button
  if (!props.mobile && mouseButton === 1) {
    beginCanvasPan(event)
    return
  }
  if (
    !props.mobile
    && tool.value === 'select'
    && (typeof mouseButton !== 'number' || mouseButton === 0)
    && isBackgroundPointer(event)
  ) {
    beginCanvasPan(event)
    return
  }

  const pointer = tool.value === 'erase' ? updateEraserPointer() : getPointer()
  if (!pointer) return
  if (tool.value === 'eyedropper') {
    pickColorAtPoint(pointer.x, pointer.y)
    tool.value = 'draw'
    event?.evt?.preventDefault?.()
    return
  }
  if (tool.value === 'erase') {
    erasing.value = true
    eraseStrokeAtPoint(pointer.x, pointer.y)
    event?.evt?.preventDefault?.()
    return
  }
  if (tool.value !== 'draw') return
  drawing.value = true
  addDrawLayer([pointer.x, pointer.y])
  event?.evt?.preventDefault?.()
}

const handlePointerMove = (event: any) => {
  if (panning.value) {
    const point = getClientPoint(event)
    if (!point) return
    const deltaX = point.x - panStartClient.x
    const deltaY = point.y - panStartClient.y
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) panMoved = true
    canvasOffset.value = {
      x: Math.round(panStartOffset.x + deltaX),
      y: Math.round(panStartOffset.y + deltaY),
    }
    event?.evt?.preventDefault?.()
    return
  }

  if (tool.value === 'erase') {
    const pointer = updateEraserPointer()
    if (!erasing.value) return
    if (pointer) eraseStrokeAtPoint(pointer.x, pointer.y)
    event?.evt?.preventDefault?.()
    return
  }
  if (!drawing.value || tool.value !== 'draw') return
  const pointer = getPointer()
  const layer = selectedLayer.value
  if (!pointer || !layer || layer.type !== 'draw' || layer.locked) return
  const next = cloneContent()
  const drawLayer = next.layers.find(item => item.id === layer.id)
  if (!drawLayer || drawLayer.type !== 'draw') return
  const stroke = [...drawLayer.items].reverse().find(item => item.type === 'stroke')
  if (!stroke) return
  stroke.points = [...stroke.points, pointer.x, pointer.y]
  localContent.value = cloneJournalContent(next)
  emit('update:modelValue', next)
  event?.evt?.preventDefault?.()
}

const handlePointerEnd = () => {
  stopLayerAutoPan()
  if (panning.value) {
    panning.value = false
    suppressStageClick = panMoved
    activeGuides.value = []
    return
  }
  drawing.value = false
  erasing.value = false
  activeGuides.value = []
}

const handlePointerLeave = () => {
  handlePointerEnd()
  eraserPointer.value = null
}

const handleStageClick = (event: any) => {
  if (suppressStageClick) {
    suppressStageClick = false
    return
  }
  if (Date.now() - mobileGestureEndedAt < 350) return
  if (event?.target === event?.target?.getStage?.()) {
    setSelectedLayerIds([])
  }
}

const selectLayer = (id: string, additive = false) => {
  if (tool.value === 'draw') return
  if (additive) {
    setSelectedLayerIds(
      selectedLayerIds.value.includes(id)
        ? selectedLayerIds.value.filter(item => item !== id)
        : [...selectedLayerIds.value, id],
    )
    return
  }
  setSelectedLayerIds([id])
}

const handleDragEnd = (event: any, id: string) => {
  stopLayerAutoPan()
  const node = event.target
  const snapped = getSnapPosition(id, { x: Math.round(node.x()), y: Math.round(node.y()) })
  activeGuides.value = snapped.guides
  updateLayer(id, {
    x: snapped.x,
    y: snapped.y,
  })
}

const handleTransformEnd = (event: any, id: string) => {
  const node = event.target
  const layer = localContent.value.layers.find(item => item.id === id)
  const item = layer?.items[0]
  if (!layer || !item || layer.type === 'draw' || item.type === 'stroke') return
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  node.scaleX(1)
  node.scaleY(1)

  if (item.type === 'sticker') {
    updateLayer(id, {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.max(24, Math.round(item.width * scaleX)),
      height: Math.max(24, Math.round(item.height * scaleY)),
      rotation: Math.round(node.rotation()),
    })
    return
  }

  if (item.type === 'shape') {
    updateLayer(id, {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.max(12, Math.round(item.width * scaleX)),
      height: Math.max(12, Math.round(item.height * scaleY)),
      rotation: Math.round(node.rotation()),
    })
    return
  }

  updateLayer(id, {
    x: Math.round(node.x()),
    y: Math.round(node.y()),
    font_size: Math.max(12, Math.round(item.font_size * Math.max(scaleX, scaleY))),
    rotation: Math.round(node.rotation()),
  })
}

const getImage = (src: string) => {
  if (imageCache.has(src)) return imageCache.get(src)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  imageCache.set(src, img)
  return img
}

const isVisible = (layer: JournalLayer) => layer.visible !== false
const isDraggable = (layer: JournalLayer) => tool.value === 'select' && !layer.locked

const imageConfig = (layer: JournalLayer, item: JournalStickerItem) => ({
  id: layer.id,
  image: getImage(item.src),
  x: item.x,
  y: item.y,
  width: item.width,
  height: item.height,
  scaleX: item.flip_x ? -1 : 1,
  scaleY: item.flip_y ? -1 : 1,
  rotation: item.rotation,
  opacity: layer.opacity,
  draggable: isDraggable(layer),
  visible: isVisible(layer),
})

const textConfig = (layer: JournalLayer, item: JournalTextItem) => ({
  id: layer.id,
  text: item.text,
  x: item.x,
  y: item.y,
  fontSize: item.font_size,
  fontFamily: item.font_family,
  fontStyle: item.font_weight && item.font_weight !== '400' ? item.font_weight : undefined,
  width: item.width,
  lineHeight: item.line_height,
  align: item.align,
  fill: item.fill,
  stroke: item.stroke,
  strokeWidth: item.stroke_width,
  shadowEnabled: item.shadow_enabled,
  shadowColor: item.shadow_color,
  shadowBlur: item.shadow_blur,
  rotation: item.rotation,
  opacity: layer.opacity,
  draggable: isDraggable(layer),
  visible: isVisible(layer),
})

const rectShapeConfig = (layer: JournalLayer, item: JournalShapeItem) => ({
  id: layer.id,
  x: item.x,
  y: item.y,
  width: item.width,
  height: item.height,
  fill: item.fill,
  stroke: item.stroke,
  strokeWidth: item.stroke_width,
  rotation: item.rotation,
  opacity: layer.opacity,
  draggable: isDraggable(layer),
  visible: isVisible(layer),
})

const circleShapeConfig = (layer: JournalLayer, item: JournalShapeItem) => ({
  id: layer.id,
  x: item.x + item.width / 2,
  y: item.y + item.height / 2,
  radius: Math.min(item.width, item.height) / 2,
  fill: item.fill,
  stroke: item.stroke,
  strokeWidth: item.stroke_width,
  rotation: item.rotation,
  opacity: layer.opacity,
  draggable: isDraggable(layer),
  visible: isVisible(layer),
})

const drawConfig = (layer: JournalLayer, item: JournalStrokeItem) => ({
  id: item.id,
  points: item.points,
  stroke: item.stroke,
  strokeWidth: item.stroke_width,
  opacity: item.opacity * layer.opacity,
  visible: isVisible(layer),
  tension: brushPresets.find(preset => preset.type === item.brush_type)?.tension ?? 0.35,
  lineCap: 'round',
  lineJoin: 'round',
})

const setNodeRef = (id: string) => (node: any) => {
  if (node) {
    nodeRefs.set(id, node)
  } else {
    nodeRefs.delete(id)
  }
}

const attachTransformer = async () => {
  await nextTick()
  const transformer = transformerRef.value?.getNode?.()
  if (!transformer || !selectedLayerId.value) return
  const layer = selectedLayer.value
  if (!layer || layer.type === 'draw' || layer.locked || layer.visible === false) {
    transformer.nodes([])
    transformer.getLayer()?.batchDraw?.()
    return
  }
  const node = nodeRefs.get(selectedLayerId.value)?.getNode?.()
  transformer.nodes(node ? [node] : [])
  transformer.getLayer()?.batchDraw?.()
}

const pickColorAtPoint = (x: number, y: number) => {
  const positioned = [...localContent.value.layers]
    .filter(layer => layer.visible !== false)
    .sort((a, b) => b.z_index - a.z_index)
  const found = positioned.find(layer => {
    const item = firstPositionedItem(layer)
    const bounds = getLayerBounds(layer)
    return item && x >= item.x && y >= item.y && x <= item.x + bounds.width && y <= item.y + bounds.height
  })
  const item = found?.items[0]
  if (item?.type === 'text') brushColor.value = item.fill
  else if (item?.type === 'shape') brushColor.value = item.stroke || item.fill
  else if (item?.type === 'stroke') brushColor.value = item.stroke
}

const guideConfig = (guide: { axis: 'x' | 'y'; value: number }) => ({
  points: guide.axis === 'x' ? [guide.value, 0, guide.value, props.height] : [0, guide.value, props.width, guide.value],
  stroke: '#8e7dff',
  strokeWidth: 1,
  dash: [6, 6],
  listening: false,
})

const renderPageDataUrl = async (pixelRatio = 1): Promise<string | null> => {
  exporting.value = true
  await nextTick()
  let exportStage: Konva.Stage | null = null
  let exportContainer: HTMLDivElement | null = null
  try {
    const pageGroup = pageGroupRef.value?.getNode?.()
    if (!pageGroup) return null
    const ratio = Math.min(3, Math.max(1, Math.round(Number(pixelRatio) || 1)))
    exportContainer = document.createElement('div')
    exportContainer.style.position = 'fixed'
    exportContainer.style.left = '-100000px'
    exportContainer.style.top = '0'
    exportContainer.style.pointerEvents = 'none'
    document.body.appendChild(exportContainer)

    exportStage = new Konva.Stage({
      container: exportContainer,
      width: props.width,
      height: props.height,
    })
    const exportLayer = new Konva.Layer()
    exportLayer.add(pageGroup.clone({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    }))
    exportStage.add(exportLayer)
    exportLayer.draw()
    return exportStage.toDataURL({ pixelRatio: ratio })
  } finally {
    exportStage?.destroy()
    exportContainer?.remove()
    exporting.value = false
  }
}

const exportPngDataUrl = async (pixelRatio = 1): Promise<string | null> => (
  renderPageDataUrl(pixelRatio)
)

const exportPngBlob = async (pixelRatio = 1): Promise<Blob | null> => {
  const dataUrl = await renderPageDataUrl(pixelRatio)
  if (!dataUrl) return null
  const response = await fetch(dataUrl)
  return response.blob()
}

const handleKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    redo()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    event.preventDefault()
    copySelectedLayer()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
    event.preventDefault()
    pasteLayer()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    duplicateSelectedLayer()
    return
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedLayerId.value) {
    event.preventDefault()
    deleteSelectedLayer()
    return
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    const step = event.shiftKey ? 10 : 1
    const delta = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    }[event.key] || [0, 0]
    event.preventDefault()
    nudgeSelectedLayers(delta[0] ?? 0, delta[1] ?? 0)
  }
}

const canUndo = computed(() => undoStack.value.length > 1)
const canRedo = computed(() => redoStack.value.length > 0)

const undo = () => {
  if (!canUndo.value) return
  const current = undoStack.value[undoStack.value.length - 1]
  const previous = undoStack.value[undoStack.value.length - 2]
  if (!current || !previous) return
  redoStack.value = [cloneJournalContent(current), ...redoStack.value]
  undoStack.value = undoStack.value.slice(0, -1)
  localContent.value = cloneJournalContent(previous)
  emit('update:modelValue', cloneJournalContent(previous))
}

const redo = () => {
  const next = redoStack.value[0]
  if (!next) return
  redoStack.value = redoStack.value.slice(1)
  undoStack.value = [...undoStack.value, cloneJournalContent(next)]
  localContent.value = cloneJournalContent(next)
  emit('update:modelValue', cloneJournalContent(next))
}

watch(
  () => props.modelValue,
  (content) => {
    localContent.value = normalizeJournalContent(content)
    undoStack.value = [cloneJournalContent(content)]
    redoStack.value = []
    if (
      selectedLayerId.value &&
      !localContent.value.layers.some(layer => layer.id === selectedLayerId.value)
    ) {
      setSelectedLayerIds([])
    } else {
      setSelectedLayerIds(selectedLayerIds.value)
    }
  },
  { deep: true },
)

watch(selectedLayerId, attachTransformer)
watch(() => localContent.value.layers, attachTransformer, { deep: true })
watch(tool, (mode) => {
  if (mode !== 'erase') {
    eraserPointer.value = null
    erasing.value = false
  }
})

watch(
  () => [props.width, props.height],
  () => {
    resetViewport()
  },
)

const syncViewportSize = () => {
  const element = viewportRef.value
  if (!element) return
  viewportSize.value = {
    width: Math.max(1, element.clientWidth || 760),
    height: Math.max(1, element.clientHeight || 520),
  }
}

onMounted(() => {
  syncViewportSize()
  window.addEventListener('keydown', handleKeydown)
  const viewport = viewportRef.value
  viewport?.addEventListener('touchstart', handleMobileTouchStart, { capture: true, passive: false })
  viewport?.addEventListener('touchmove', handleMobileTouchMove, { capture: true, passive: false })
  viewport?.addEventListener('touchend', handleMobileTouchEnd, { capture: true, passive: true })
  viewport?.addEventListener('touchcancel', handleMobileTouchEnd, { capture: true, passive: true })
  viewport?.addEventListener('wheel', handleWheel, { passive: false })
  if (viewport && typeof ResizeObserver !== 'undefined') {
    viewportResizeObserver = new ResizeObserver(syncViewportSize)
    viewportResizeObserver.observe(viewport)
  }
})

onBeforeUnmount(() => {
  stopLayerAutoPan()
  viewportResizeObserver?.disconnect()
  viewportResizeObserver = null
  window.removeEventListener('keydown', handleKeydown)
  const viewport = viewportRef.value
  viewport?.removeEventListener('touchstart', handleMobileTouchStart, { capture: true })
  viewport?.removeEventListener('touchmove', handleMobileTouchMove, { capture: true })
  viewport?.removeEventListener('touchend', handleMobileTouchEnd, { capture: true })
  viewport?.removeEventListener('touchcancel', handleMobileTouchEnd, { capture: true })
  viewport?.removeEventListener('wheel', handleWheel)
  imageCache.clear()
  nodeRefs.clear()
})

defineExpose({
  tool,
  layers: layersForPanel,
  selectedLayer,
  selectedItem,
  selectedLayerId,
  selectedLayerIds,
  addGoodsSticker,
  addLocalSticker,
  addTextLayer,
  addBrushLayer,
  addDrawLayer,
  setBrushType,
  setTool,
  setBrushWidth,
  setEraserWidth,
  selectPaletteColor,
  addShapeLayer,
  backgroundPattern,
  canvasBounds,
  canvasExpanded,
  pickColorAtPoint,
  activeGuides,
  currentBrushLabel,
  currentStrokeWidth,
  toolStatusText,
  exporting,
  recentColors,
  paletteColors,
  brushType,
  brushColor,
  brushWidth,
  eraserWidth,
  eraserPointer,
  eraserPreviewConfig,
  zoomLevel,
  viewportSize,
  canvasOffset,
  panning,
  worldConfig,
  stageConfig,
  scale,
  getPointer,
  setZoom,
  resetViewport,
  panCanvas,
  handleLayerDragMove,
  handlePointerEnd,
  canUndo,
  canRedo,
  undo,
  redo,
  selectLayer,
  nudgeSelectedLayers,
  alignSelectedLayers,
  distributeSelectedLayers,
  getSnapPosition,
  eraseStrokeAtPoint,
  updateSelectedLayer,
  renameSelectedLayer,
  toggleSelectedLayerLock,
  toggleSelectedLayerVisibility,
  toggleLayerLock,
  toggleLayerVisibility,
  duplicateSelectedLayer,
  copySelectedLayer,
  pasteLayer,
  alignSelectedLayer,
  moveSelectedLayer,
  deleteSelectedLayer,
  editTextLayer,
  exportPngBlob,
  exportPngDataUrl,
})
</script>

<style scoped>
.journal-canvas-shell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.journal-canvas-shell:not(.is-mobile) {
  flex: 1;
  min-height: 0;
}

.journal-canvas-toolbar {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
}

.journal-color-input {
  width: 34px;
  height: 30px;
  padding: 0;
  border: 0;
  background: transparent;
}

.journal-width-input {
  width: 104px;
}

.journal-eraser-size {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-light);
  font-size: 12px;
  white-space: nowrap;
}

.journal-eraser-size input {
  width: 96px;
}

.journal-brush-presets,
.journal-palette {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.toolbar-brush-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbar-control-row {
  display: grid;
  grid-template-columns: auto 52px auto minmax(120px, 1fr);
  align-items: center;
  gap: 8px;
  color: var(--text-light);
  font-size: 13px;
  white-space: nowrap;
}

.toolbar-control-row .journal-color-input {
  width: 52px;
  height: 34px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 7px;
}

.toolbar-brush-panel .journal-brush-presets {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.brush-preset-btn {
  min-width: 0;
  height: 34px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 7px;
  background: #fff;
  color: var(--text-dark);
  padding: 0 8px;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.brush-preset-btn.is-active {
  border-color: rgba(212, 175, 55, 0.58);
  background: rgba(212, 175, 55, 0.1);
  color: var(--primary-gold-dark);
}

.palette-swatch {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(15, 23, 42, 0.16);
  border-radius: 50%;
  cursor: pointer;
}

.palette-swatch.is-active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(162, 155, 254, 0.7);
}

.journal-canvas-viewport {
  position: relative;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border-radius: 8px;
  background:
    linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.12) 75%);
  background-size: 22px 22px;
  background-position: 0 0, 0 11px, 11px -11px, -11px 0;
}

.journal-canvas-shell:not(.is-mobile) .journal-canvas-viewport {
  flex: 1;
  min-height: 0;
  cursor: grab;
}

.journal-canvas-shell:not(.is-mobile) .journal-canvas-viewport.is-drawing-tool {
  cursor: crosshair;
}

.journal-canvas-shell:not(.is-mobile) .journal-canvas-viewport.is-panning {
  cursor: grabbing;
  user-select: none;
}

.journal-canvas-viewport :deep(.konvajs-content) {
  margin: 0;
}

.text-inline-editor {
  position: absolute;
  z-index: 8;
  min-width: 120px;
  border: 1px solid rgba(142, 125, 255, 0.52);
  border-radius: 6px;
  padding: 6px 8px;
  outline: 2px solid rgba(142, 125, 255, 0.16);
  background: rgba(255, 255, 255, 0.96);
  resize: both;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
}

.journal-zoom-controls {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-light);
  font-size: 12px;
}

.journal-zoom-controls :deep(.el-button + .el-button) {
  margin-left: 0 !important;
}

.journal-zoom-controls span {
  min-width: 42px;
  text-align: center;
  color: var(--text-dark);
  font-weight: 700;
}

.journal-canvas-shell.is-mobile {
  position: relative;
  height: 100%;
  min-height: 0;
  gap: 0;
}

.journal-canvas-viewport.is-mobile {
  flex: 1;
  min-height: 0;
  padding: 8px;
  border-radius: 0;
  overscroll-behavior: contain;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.journal-canvas-shell.is-mobile .journal-zoom-controls {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 5;
  min-height: 40px;
  padding: 4px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.journal-canvas-shell.is-mobile .journal-zoom-controls :deep(.el-button) {
  min-width: 40px;
  height: 36px;
  padding: 0 10px;
  border-radius: 999px;
}
</style>
