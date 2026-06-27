<template>
  <div class="journal-canvas-shell">
    <div class="journal-canvas-toolbar">
      <el-button size="small" :type="tool === 'select' ? 'primary' : 'default'" @click="tool = 'select'">
        <el-icon><Pointer /></el-icon>
      </el-button>
      <el-button size="small" :type="tool === 'draw' ? 'primary' : 'default'" @click="tool = 'draw'">
        <el-icon><EditPen /></el-icon>
      </el-button>
      <el-button size="small" @click="addTextLayer()">
        <el-icon><Document /></el-icon>
      </el-button>
      <el-button size="small" :disabled="!selectedLayerId" @click="deleteSelectedLayer">
        <el-icon><Delete /></el-icon>
      </el-button>
      <input v-model="brushColor" class="journal-color-input" type="color" aria-label="画笔颜色" />
      <input v-model.number="brushWidth" class="journal-width-input" type="range" min="2" max="28" aria-label="画笔粗细" />
    </div>

    <div ref="viewportRef" class="journal-canvas-viewport">
      <v-stage
        ref="stageRef"
        :config="stageConfig"
        @mousedown="handlePointerStart"
        @mousemove="handlePointerMove"
        @mouseup="handlePointerEnd"
        @touchstart="handlePointerStart"
        @touchmove="handlePointerMove"
        @touchend="handlePointerEnd"
        @click="handleStageClick"
        @tap="handleStageClick"
      >
        <v-layer>
          <v-rect :config="{ id: 'journal-background', x: 0, y: 0, width, height, fill: background }" />

          <template v-for="layer in sortedLayers" :key="layer.id">
            <v-image
              v-if="layer.type === 'sticker'"
              :ref="setNodeRef(layer.id)"
              :config="imageConfig(layer)"
              @click="selectLayer(layer.id)"
              @tap="selectLayer(layer.id)"
              @dblclick="editTextLayer(layer.id)"
              @dbltap="editTextLayer(layer.id)"
              @dragend="handleDragEnd($event, layer.id)"
              @transformend="handleTransformEnd($event, layer.id)"
            />
            <v-text
              v-else-if="layer.type === 'text'"
              :ref="setNodeRef(layer.id)"
              :config="textConfig(layer)"
              @click="selectLayer(layer.id)"
              @tap="selectLayer(layer.id)"
              @dragend="handleDragEnd($event, layer.id)"
              @transformend="handleTransformEnd($event, layer.id)"
            />
            <v-line v-else :config="drawConfig(layer)" />
          </template>

          <v-transformer v-if="selectedLayerId" ref="transformerRef" :config="{ rotateEnabled: true }" />
        </v-layer>
      </v-stage>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Delete, Document, EditPen, Pointer } from '@element-plus/icons-vue'
import type {
  GoodsListItem,
  JournalDrawLayer,
  JournalLayer,
  JournalPageContent,
  JournalStickerLayer,
  JournalTextLayer,
} from '@/api/types'

const props = defineProps<{
  modelValue: JournalPageContent
  width: number
  height: number
  background: string
}>()

const emit = defineEmits<{
  'update:modelValue': [content: JournalPageContent]
}>()

type ToolMode = 'select' | 'draw'

const stageRef = ref<any>(null)
const transformerRef = ref<any>(null)
const viewportRef = ref<HTMLElement | null>(null)
const tool = ref<ToolMode>('select')
const selectedLayerId = ref<string | null>(null)
const brushColor = ref('#8e7dff')
const brushWidth = ref(8)
const drawing = ref(false)
const imageCache = new Map<string, HTMLImageElement>()
const nodeRefs = new Map<string, any>()

const cloneLayer = (layer: JournalLayer): JournalLayer => (
  layer.type === 'draw'
    ? { ...layer, points: [...layer.points] }
    : { ...layer }
)

const cloneJournalContent = (content?: JournalPageContent | null): JournalPageContent => ({
  version: 1,
  layers: [...(content?.layers || [])].map(cloneLayer),
})

const localContent = ref<JournalPageContent>(cloneJournalContent(props.modelValue))

const sortedLayers = computed(() =>
  [...localContent.value.layers].sort((a, b) => a.z_index - b.z_index),
)

const selectedLayer = computed(() =>
  localContent.value.layers.find(layer => layer.id === selectedLayerId.value) || null,
)

const layersForPanel = computed(() =>
  [...localContent.value.layers].sort((a, b) => b.z_index - a.z_index).map(cloneLayer),
)

const scale = computed(() => {
  const maxWidth = viewportRef.value?.clientWidth ? viewportRef.value.clientWidth - 24 : 760
  return Math.min(1, Math.max(0.2, maxWidth / props.width))
})

const stageConfig = computed(() => ({
  width: props.width * scale.value,
  height: props.height * scale.value,
  scaleX: scale.value,
  scaleY: scale.value,
}))

const cloneContent = (): JournalPageContent => ({
  version: 1,
  layers: localContent.value.layers.map(cloneLayer),
})

const emitLayers = (layers: JournalLayer[]) => {
  const content = { version: 1, layers: layers.map(cloneLayer) } satisfies JournalPageContent
  localContent.value = cloneJournalContent(content)
  emit('update:modelValue', content)
}

const nextZIndex = () => Math.max(0, ...localContent.value.layers.map(layer => layer.z_index)) + 1

const createLayerId = (prefix: string) => (
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`
)

const resolveGoodsImage = (goods: GoodsListItem) => goods.main_photo || ''

const addGoodsSticker = (goods: GoodsListItem, src = resolveGoodsImage(goods)) => {
  if (!src) return
  const layer: JournalStickerLayer = {
    id: createLayerId('sticker'),
    type: 'sticker',
    goods_id: goods.id,
    src,
    x: Math.round(props.width * 0.34),
    y: Math.round(props.height * 0.24),
    width: 260,
    height: 260,
    rotation: 0,
    opacity: 1,
    z_index: nextZIndex(),
  }
  emitLayers([...localContent.value.layers, layer])
  selectedLayerId.value = layer.id
}

const addTextLayer = (text = '写点什么') => {
  const layer: JournalTextLayer = {
    id: createLayerId('text'),
    type: 'text',
    text,
    x: Math.round(props.width * 0.18),
    y: Math.round(props.height * 0.18),
    font_size: 44,
    fill: '#333333',
    rotation: 0,
    z_index: nextZIndex(),
  }
  emitLayers([...localContent.value.layers, layer])
  selectedLayerId.value = layer.id
}

const addDrawLayer = (points: number[], stroke = brushColor.value, strokeWidth = brushWidth.value) => {
  const layer: JournalDrawLayer = {
    id: createLayerId('draw'),
    type: 'draw',
    points,
    stroke,
    stroke_width: strokeWidth,
    opacity: 1,
    z_index: nextZIndex(),
  }
  emitLayers([...localContent.value.layers, layer])
}

const deleteSelectedLayer = () => {
  if (!selectedLayerId.value) return
  emitLayers(localContent.value.layers.filter(layer => layer.id !== selectedLayerId.value))
  selectedLayerId.value = null
}

const updateSelectedLayer = (patch: Partial<JournalLayer>) => {
  if (!selectedLayerId.value) return
  updateLayer(selectedLayerId.value, patch)
}

type LayerMoveDirection = 'top' | 'up' | 'down' | 'bottom'

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
  const nextText = window.prompt('编辑文字', layer.text)
  if (nextText === null) return
  updateLayer(layer.id, { text: nextText } as Partial<JournalLayer>)
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

const handlePointerStart = (event: any) => {
  if (tool.value !== 'draw') return
  const pointer = getPointer()
  if (!pointer) return
  drawing.value = true
  addDrawLayer([pointer.x, pointer.y])
  event?.evt?.preventDefault?.()
}

const handlePointerMove = (event: any) => {
  if (!drawing.value || tool.value !== 'draw') return
  const pointer = getPointer()
  const lastLayer = localContent.value.layers[localContent.value.layers.length - 1]
  if (!pointer || !lastLayer || lastLayer.type !== 'draw') return
  const next = cloneContent()
  const drawLayer = next.layers.find(layer => layer.id === lastLayer.id)
  if (!drawLayer || drawLayer.type !== 'draw') return
  drawLayer.points = [...drawLayer.points, pointer.x, pointer.y]
  localContent.value = cloneJournalContent(next)
  emit('update:modelValue', next)
  event?.evt?.preventDefault?.()
}

const handlePointerEnd = () => {
  drawing.value = false
}

const handleStageClick = (event: any) => {
  if (event?.target === event?.target?.getStage?.()) {
    selectedLayerId.value = null
  }
}

const selectLayer = (id: string) => {
  if (tool.value === 'draw') return
  selectedLayerId.value = id
}

const updateLayer = (id: string, patch: Partial<JournalLayer>) => {
  emitLayers(localContent.value.layers.map(layer => (
    layer.id === id ? { ...layer, ...patch } as JournalLayer : layer
  )))
}

const handleDragEnd = (event: any, id: string) => {
  const node = event.target
  updateLayer(id, {
    x: Math.round(node.x()),
    y: Math.round(node.y()),
  } as Partial<JournalLayer>)
}

const handleTransformEnd = (event: any, id: string) => {
  const node = event.target
  const layer = localContent.value.layers.find(item => item.id === id)
  if (!layer || layer.type === 'draw') return
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  node.scaleX(1)
  node.scaleY(1)

  if (layer.type === 'sticker') {
    updateLayer(id, {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.max(24, Math.round(layer.width * scaleX)),
      height: Math.max(24, Math.round(layer.height * scaleY)),
      rotation: Math.round(node.rotation()),
    } as Partial<JournalLayer>)
    return
  }

  updateLayer(id, {
    x: Math.round(node.x()),
    y: Math.round(node.y()),
    font_size: Math.max(12, Math.round(layer.font_size * Math.max(scaleX, scaleY))),
    rotation: Math.round(node.rotation()),
  } as Partial<JournalLayer>)
}

const getImage = (src: string) => {
  if (imageCache.has(src)) return imageCache.get(src)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  imageCache.set(src, img)
  return img
}

const imageConfig = (layer: JournalStickerLayer) => ({
  id: layer.id,
  image: getImage(layer.src),
  x: layer.x,
  y: layer.y,
  width: layer.width,
  height: layer.height,
  rotation: layer.rotation,
  opacity: layer.opacity,
  draggable: tool.value === 'select',
})

const textConfig = (layer: JournalTextLayer) => ({
  id: layer.id,
  text: layer.text,
  x: layer.x,
  y: layer.y,
  fontSize: layer.font_size,
  fill: layer.fill,
  rotation: layer.rotation,
  draggable: tool.value === 'select',
})

const drawConfig = (layer: JournalDrawLayer) => ({
  id: layer.id,
  points: layer.points,
  stroke: layer.stroke,
  strokeWidth: layer.stroke_width,
  opacity: layer.opacity,
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
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedLayerId.value) {
    event.preventDefault()
    deleteSelectedLayer()
  }
}

watch(
  () => props.modelValue,
  (content) => {
    localContent.value = cloneJournalContent(content)
    if (
      selectedLayerId.value &&
      !localContent.value.layers.some(layer => layer.id === selectedLayerId.value)
    ) {
      selectedLayerId.value = null
    }
  },
  { deep: true },
)

watch(selectedLayerId, attachTransformer)
watch(() => localContent.value.layers, attachTransformer, { deep: true })

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
  selectedLayerId,
  addGoodsSticker,
  addTextLayer,
  addDrawLayer,
  selectLayer,
  updateSelectedLayer,
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
</style>
