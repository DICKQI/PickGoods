import type {
  JournalDrawLayer,
  JournalLayer,
  JournalLayerItem,
  JournalLegacyLayer,
  JournalPageContent,
  JournalPageContentV1,
  JournalStickerLayer,
  JournalTextLayer,
} from '@/api/types'

export type AnyJournalPageContent = JournalPageContent | JournalPageContentV1 | null | undefined

export const emptyJournalContent = (): JournalPageContent => ({ version: 2, layers: [] })

const cloneItem = (item: JournalLayerItem): JournalLayerItem => (
  item.type === 'stroke'
    ? { ...item, points: [...item.points] }
    : { ...item }
)

export const cloneJournalLayer = (layer: JournalLayer): JournalLayer => ({
  ...layer,
  items: layer.items.map(cloneItem),
})

export const cloneJournalContent = (content?: AnyJournalPageContent): JournalPageContent => {
  const normalized = normalizeJournalContent(content)
  return {
    version: 2,
    layers: normalized.layers.map(cloneJournalLayer),
  }
}

const layerNameFromText = (text?: string) => {
  const value = (text || '').trim()
  return value ? `文字：${value.slice(0, 12)}` : undefined
}

const makeStickerLayer = (layer: Extract<JournalLegacyLayer, { type: 'sticker' }>, index: number): JournalStickerLayer => ({
  id: layer.id,
  type: 'sticker',
  name: layer.name || `贴纸层 ${index}`,
  locked: layer.locked,
  visible: layer.visible,
  opacity: layer.opacity,
  z_index: layer.z_index,
  items: [{
    id: `${layer.id}-sticker`,
    type: 'sticker',
    goods_id: layer.goods_id,
    src: layer.src,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
  }],
})

const makeTextLayer = (layer: Extract<JournalLegacyLayer, { type: 'text' }>, index: number): JournalTextLayer => ({
  id: layer.id,
  type: 'text',
  name: layer.name || layerNameFromText(layer.text) || `文字层 ${index}`,
  locked: layer.locked,
  visible: layer.visible,
  opacity: 1,
  z_index: layer.z_index,
  items: [{
    id: `${layer.id}-text`,
    type: 'text',
    text: layer.text,
    x: layer.x,
    y: layer.y,
    font_size: layer.font_size,
    fill: layer.fill,
    rotation: layer.rotation,
  }],
})

const migrateV1Content = (content: JournalPageContentV1): JournalPageContent => {
  const layers = [...(content.layers || [])].sort((a, b) => a.z_index - b.z_index)
  const nextLayers: JournalLayer[] = []
  const drawItems: JournalDrawLayer['items'] = []
  let drawZIndex = 0
  let stickerIndex = 1
  let textIndex = 1

  layers.forEach((layer) => {
    if (layer.type === 'draw') {
      drawZIndex = drawZIndex || layer.z_index
      drawItems.push({
        id: `${layer.id}-stroke`,
        type: 'stroke',
        brush_type: layer.brush_type || 'pen',
        points: [...layer.points],
        stroke: layer.stroke,
        stroke_width: layer.stroke_width,
        opacity: layer.opacity,
      })
      return
    }
    if (layer.type === 'sticker') {
      nextLayers.push(makeStickerLayer(layer, stickerIndex))
      stickerIndex += 1
      return
    }
    nextLayers.push(makeTextLayer(layer, textIndex))
    textIndex += 1
  })

  if (drawItems.length > 0) {
    nextLayers.push({
      id: 'imported-draw-layer',
      type: 'draw',
      name: '导入画笔层',
      opacity: 1,
      z_index: drawZIndex || 1,
      items: drawItems,
    })
  }

  return {
    version: 2,
    layers: nextLayers
      .sort((a, b) => a.z_index - b.z_index)
      .map((layer, index) => ({ ...layer, z_index: index + 1 })),
  }
}

export const normalizeJournalContent = (content?: AnyJournalPageContent): JournalPageContent => {
  if (!content || !Array.isArray(content.layers)) return emptyJournalContent()
  if (content.version === 1) return migrateV1Content(content)
  return {
    version: 2,
    layers: content.layers.map(cloneJournalLayer),
  }
}
