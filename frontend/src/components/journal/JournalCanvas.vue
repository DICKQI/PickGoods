<template>
  <div class="journal-canvas-shell">
    <div class="journal-canvas-toolbar">
      <el-button size="small" :type="tool === 'select' ? 'primary' : 'default'" @click="tool = 'select'">
        <el-icon><Pointer /></el-icon>
      </el-button>
      <el-button size="small" :type="tool === 'draw' ? 'primary' : 'default'" @click="tool = 'draw'">
        <el-icon><EditPen /></el-icon>
      </el-button>
      <el-button size="small" :type="tool === 'erase' ? 'primary' : 'default'" @click="tool = 'erase'">
        橡皮
      </el-button>
      <el-button size="small" @click="addTextLayer()">
        <el-icon><Document /></el-icon>
      </el-button>
      <el-button size="small" :disabled="!selectedLayerId" @click="deleteSelectedLayer">
        <el-icon><Delete /></el-icon>
      </el-button>
      <input v-model="brushColor" class="journal-color-input" type="color" aria-label="画笔颜色" />
      <input v-model.number="brushWidth" class="journal-width-input" type="range" min="2" max="28" aria-label="画笔粗细" />
      <label v-if="tool === 'erase'" class="journal-eraser-size">
        <span>橡皮 {{ eraserWidth }}px</span>
        <input v-model.number="eraserWidth" type="range" min="4" max="80" aria-label="橡皮粗细" />
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
      <div class="journal-palette" aria-label="常用颜色">
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

    <div ref="viewportRef" class="journal-canvas-viewport">
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
          <v-rect :config="{ id: 'journal-background', x: 0, y: 0, width, height, fill: background }" />

          <template v-for="layer in sortedLayers" :key="layer.id">
            <template v-for="item in layer.items" :key="item.id">
              <v-image
                v-if="item.type === 'sticker' && layer.type === 'sticker'"
                :ref="setNodeRef(layer.id)"
                :config="imageConfig(layer, item)"
                @click="selectLayer(layer.id, Boolean($event?.evt?.shiftKey))"
                @tap="selectLayer(layer.id)"
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
                @dragend="handleDragEnd($event, layer.id)"
                @transformend="handleTransformEnd($event, layer.id)"
              />
              <v-line v-else-if="item.type === 'stroke' && layer.type === 'draw'" :config="drawConfig(layer, item)" />
            </template>
          </template>

          <v-transformer v-if="selectedLayerId" ref="transformerRef" :config="{ rotateEnabled: true }" />
          <v-circle v-if="eraserPreviewConfig.visible" :config="eraserPreviewConfig" />
        </v-layer>
      </v-stage>
    </div>

    <div class="journal-zoom-controls">
      <el-button size="small" @click="setZoom(1)">100%</el-button>
      <el-button size="small" @click="setZoom(zoomLevel - 0.1)">-</el-button>
      <span>{{ Math.round(zoomLevel * 100) }}%</span>
      <el-button size="small" @click="setZoom(zoomLevel + 0.1)">+</el-button>
      <small>按住方向键微调，Shift 可加速移动</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Delete, Document, EditPen, Pointer } from '@element-plus/icons-vue'
import type {
  GoodsListItem,
  JournalBrushType,
  JournalDrawLayer,
  JournalLayer,
  JournalLayerItem,
  JournalPageContent,
  JournalStickerItem,
  JournalStickerLayer,
  JournalStrokeItem,
  JournalTextItem,
  JournalTextLayer,
} from '@/api/types'
import { cloneJournalContent, cloneJournalLayer, normalizeJournalContent } from '@/utils/journalContent'

const props = defineProps<{
  modelValue: JournalPageContent
  width: number
  height: number
  background: string
}>()

const emit = defineEmits<{
  'update:modelValue': [content: JournalPageContent]
}>()

type ToolMode = 'select' | 'draw' | 'erase'
type AlignDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
type DistributeDirection = 'horizontal' | 'vertical'
type LayerMoveDirection = 'top' | 'up' | 'down' | 'bottom'
type LayerPatch = Partial<JournalLayer> & Record<string, unknown>
type Point2D = [number, number]

const stageRef = ref<any>(null)
const transformerRef = ref<any>(null)
const viewportRef = ref<HTMLElement | null>(null)
const tool = ref<ToolMode>('select')
const selectedLayerId = ref<string | null>(null)
const selectedLayerIds = ref<string[]>([])
const brushColor = ref('#8e7dff')
const brushWidth = ref(8)
const brushType = ref<JournalBrushType>('pen')
const brushOpacity = ref(1)
const drawing = ref(false)
const erasing = ref(false)
const eraserWidth = ref(20)
const eraserPointer = ref<{ x: number; y: number } | null>(null)
const zoomLevel = ref(1)
const canvasOffset = ref({ x: 0, y: 0 })
const imageCache = new Map<string, HTMLImageElement>()
const nodeRefs = new Map<string, any>()
const undoStack = ref<JournalPageContent[]>([])
const redoStack = ref<JournalPageContent[]>([])
const recentColors = ref<string[]>([])

const brushPresets: Array<{ type: JournalBrushType; label: string; opacity: number; tension: number }> = [
  { type: 'pencil', label: '铅笔', opacity: 0.72, tension: 0.18 },
  { type: 'pen', label: '钢笔', opacity: 1, tension: 0.35 },
  { type: 'watercolor', label: '水彩', opacity: 0.46, tension: 0.5 },
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

const layersForPanel = computed(() =>
  [...localContent.value.layers].sort((a, b) => b.z_index - a.z_index).map(cloneJournalLayer),
)

const scale = computed(() => {
  const maxWidth = viewportRef.value?.clientWidth ? viewportRef.value.clientWidth - 24 : 760
  return Math.min(3, Math.max(0.2, maxWidth / props.width) * zoomLevel.value)
})

const stageConfig = computed(() => ({
  width: props.width * scale.value,
  height: props.height * scale.value,
  scaleX: scale.value,
  scaleY: scale.value,
  x: canvasOffset.value.x,
  y: canvasOffset.value.y,
}))

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
      x: Math.round(props.width * 0.34),
      y: Math.round(props.height * 0.24),
      width: 260,
      height: 260,
      rotation: 0,
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

const setZoom = (zoom: number) => {
  zoomLevel.value = Math.min(3, Math.max(0.2, Number(zoom) || 1))
}

const panCanvas = (deltaX: number, deltaY: number) => {
  canvasOffset.value = {
    x: Math.round(canvasOffset.value.x + (Number(deltaX) || 0)),
    y: Math.round(canvasOffset.value.y + (Number(deltaY) || 0)),
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

const toggleSelectedLayerVisibility = () => {
  if (!selectedLayer.value) return
  updateSelectedLayer({ visible: selectedLayer.value.visible === false })
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

const getLayerBounds = (layer: JournalLayer) => {
  const item = layer.items[0]
  if (item?.type === 'sticker') return { width: item.width, height: item.height }
  if (item?.type === 'text') return { width: 0, height: item.font_size }
  return { width: 0, height: 0 }
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
  return { x: nextX, y: nextY, guides }
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
  selectedLayerId.value = layer.id
}

const getStage = () => stageRef.value?.getNode?.()

const getPointer = () => {
  const stage = getStage()
  const position = stage?.getPointerPosition?.()
  if (!position) return null
  return {
    x: Math.round(position.x / scale.value),
    y: Math.round(position.y / scale.value),
  }
}

const updateEraserPointer = () => {
  const pointer = getPointer()
  eraserPointer.value = pointer
  return pointer
}

const handlePointerStart = (event: any) => {
  const pointer = tool.value === 'erase' ? updateEraserPointer() : getPointer()
  if (!pointer) return
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
  drawing.value = false
  erasing.value = false
}

const handlePointerLeave = () => {
  handlePointerEnd()
  eraserPointer.value = null
}

const handleStageClick = (event: any) => {
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
  const node = event.target
  const snapped = getSnapPosition(id, { x: Math.round(node.x()), y: Math.round(node.y()) })
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

const exportPngBlob = async (): Promise<Blob | null> => {
  const stage = getStage()
  const dataUrl = stage?.toDataURL?.({ pixelRatio: 1 })
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

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  imageCache.clear()
  nodeRefs.clear()
})

defineExpose({
  layers: layersForPanel,
  selectedLayer,
  selectedItem,
  selectedLayerId,
  selectedLayerIds,
  addGoodsSticker,
  addTextLayer,
  addBrushLayer,
  addDrawLayer,
  setBrushType,
  setBrushWidth,
  setEraserWidth,
  selectPaletteColor,
  recentColors,
  paletteColors,
  brushType,
  brushColor,
  brushWidth,
  eraserWidth,
  eraserPointer,
  eraserPreviewConfig,
  zoomLevel,
  canvasOffset,
  setZoom,
  panCanvas,
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
  duplicateSelectedLayer,
  alignSelectedLayer,
  moveSelectedLayer,
  deleteSelectedLayer,
  editTextLayer,
  exportPngBlob,
})
</script>

<style scoped>
.journal-canvas-shell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.brush-preset-btn {
  height: 30px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 7px;
  background: #fff;
  color: var(--text-dark);
  padding: 0 9px;
  font-size: 12px;
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
  min-width: 0;
  overflow: auto;
  padding: 12px;
  border-radius: 8px;
  background:
    linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.12) 75%);
  background-size: 22px 22px;
  background-position: 0 0, 0 11px, 11px -11px, -11px 0;
}

.journal-canvas-viewport :deep(.konvajs-content) {
  margin: 0 auto;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
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
</style>
