<template>
  <section class="journal-workspace" data-test="journal-workspace">
    <header class="journal-topbar">
      <div class="journal-heading">
        <h2>手帐</h2>
        <span>{{ statusText }}</span>
      </div>
      <div class="journal-actions">
        <el-button :loading="journalStore.saving" @click="createBook">
          <el-icon class="el-icon--left"><Plus /></el-icon>
          新手帐
        </el-button>
        <el-button :disabled="!journalStore.activePage" :loading="journalStore.saving" @click="savePage">
          <el-icon class="el-icon--left"><DocumentChecked /></el-icon>
          保存
        </el-button>
        <el-button type="primary" class="btn-accent" :disabled="!journalStore.activePage" @click="exportPreview">
          <el-icon class="el-icon--left"><Download /></el-icon>
          更新缩略图
        </el-button>
      </div>
    </header>

    <div v-if="journalStore.error" class="journal-error">
      <el-alert :title="journalStore.error" type="error" :closable="false" />
    </div>

    <div class="journal-layout">
      <aside class="journal-sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title">
            <strong>手帐本</strong>
            <span>{{ journalStore.books.length }}</span>
          </div>
          <div v-if="journalStore.books.length === 0 && !journalStore.loading" class="empty-mini">
            还没有手帐
          </div>
          <button
            v-for="book in journalStore.books"
            :key="book.id"
            class="book-row"
            :class="{ 'is-active': book.id === journalStore.activeBookId }"
            type="button"
            @click="journalStore.setActiveBook(book.id)"
            @contextmenu.prevent="openBookContextMenu($event, book.id)"
          >
            <span>{{ book.title }}</span>
            <small>{{ book.page_count || 0 }} 页</small>
          </button>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-title">
            <strong>页面</strong>
            <el-button text size="small" :disabled="!journalStore.activeBookId" @click="journalStore.createPage">
              <el-icon><Plus /></el-icon>
            </el-button>
          </div>
          <button
            v-for="page in journalStore.pages"
            :key="page.id"
            class="page-row"
            :class="{ 'is-active': page.id === journalStore.activePageId }"
            type="button"
            draggable="true"
            @click="journalStore.setActivePage(page.id)"
            @contextmenu.prevent="openPageContextMenu($event, page.id)"
            @dragstart="handlePageDragStart(page.id)"
            @dragover.prevent
            @drop.prevent="handlePageDrop(page.id)"
          >
            <img v-if="page.preview_image" class="page-thumb" :src="page.preview_image" alt="" />
            <span>{{ page.title }}</span>
            <small>{{ page.width }} x {{ page.height }} · {{ formatDateTime(page.updated_at) }}</small>
          </button>
        </div>

        <el-button
          v-if="journalStore.activeBook"
          class="delete-book-btn"
          type="danger"
          plain
          :disabled="journalStore.saving"
          @click="deleteBook"
        >
          <el-icon class="el-icon--left"><Delete /></el-icon>
          删除当前手帐
        </el-button>
      </aside>

      <div
        v-if="bookContextMenu.visible"
        class="page-context-menu"
        :style="{ left: `${bookContextMenu.x}px`, top: `${bookContextMenu.y}px` }"
        @click.stop
      >
        <button type="button" @click="renameContextBook">重命名</button>
      </div>

      <div
        v-if="pageContextMenu.visible"
        class="page-context-menu"
        :style="{ left: `${pageContextMenu.x}px`, top: `${pageContextMenu.y}px` }"
        @click.stop
      >
        <button type="button" @click="renameContextPage">重命名</button>
        <button type="button" @click="duplicateContextPage">复制页面</button>
        <button class="is-danger" type="button" @click="confirmDeleteContextPage">
          <el-icon><Delete /></el-icon>
          删除页面
        </button>
      </div>

      <main class="journal-editor">
        <div v-if="journalStore.loading || journalStore.pageLoading" class="journal-loading">
          <el-skeleton :rows="10" animated />
        </div>
        <div v-else-if="!journalStore.activePage" class="journal-empty">
          <el-empty description="创建一本手帐开始拼贴吧">
            <el-button type="primary" class="btn-accent" @click="createBook">创建手帐</el-button>
          </el-empty>
        </div>
        <JournalCanvas
          v-else
          ref="canvasRef"
          :model-value="journalStore.activePage.content || fallbackContent"
          :width="journalStore.activePage.width"
          :height="journalStore.activePage.height"
          :background="journalStore.activePage.background"
          @update:model-value="handleContentUpdate"
        />
      </main>

      <aside class="journal-side-panel">
        <el-tabs v-model="sideTab" stretch>
          <el-tab-pane label="素材" name="goods">
            <JournalGoodsPicker @insert-goods="insertGoods" />
          </el-tab-pane>
          <el-tab-pane label="图层" name="layers">
            <div class="panel-section">
              <div class="sidebar-title">
                <strong>图层</strong>
                <span>{{ canvasLayers.length }}</span>
              </div>
              <div class="layer-order-actions">
                <el-button size="small" type="primary" plain @click="canvasRef?.addBrushLayer">
                  <el-icon class="el-icon--left"><Plus /></el-icon>
                  新建画笔层
                </el-button>
              </div>
              <div v-if="canvasLayers.length === 0" class="empty-mini">暂无图层</div>
              <button
                v-for="layer in canvasLayers"
                :key="layer.id"
                class="layer-row"
                :class="{ 'is-active': layer.id === selectedLayer?.id }"
                type="button"
                @click="canvasRef?.selectLayer(layer.id)"
              >
                <span>{{ layerLabel(layer) }}</span>
                <small>{{ layer.items.length }} 项 · z {{ layer.z_index }}</small>
              </button>
            </div>

            <div v-if="selectedLayer" class="panel-section layer-controls">
              <div class="sidebar-title">
                <strong>选中图层</strong>
                <el-button text size="small" type="danger" @click="canvasRef?.deleteSelectedLayer">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>

              <div class="layer-order-actions">
                <el-button size="small" @click="canvasRef?.moveSelectedLayer('top')">置顶</el-button>
                <el-button size="small" @click="canvasRef?.moveSelectedLayer('up')">上移</el-button>
                <el-button size="small" @click="canvasRef?.moveSelectedLayer('down')">下移</el-button>
                <el-button size="small" @click="canvasRef?.moveSelectedLayer('bottom')">置底</el-button>
              </div>

              <div class="layer-order-actions">
                <el-button size="small" @click="canvasRef?.toggleSelectedLayerLock">
                  {{ selectedLayer.locked ? '解锁' : '锁定' }}
                </el-button>
                <el-button size="small" @click="canvasRef?.toggleSelectedLayerVisibility">
                  {{ selectedLayer.visible === false ? '显示' : '隐藏' }}
                </el-button>
                <el-button size="small" @click="canvasRef?.duplicateSelectedLayer">复制</el-button>
              </div>

              <label class="control-row">
                <span>透明度</span>
                <el-slider
                  :model-value="selectedLayer.opacity"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  @update:model-value="updateLayerOpacity"
                />
              </label>

              <label v-if="selectedLayer.type !== 'draw' && selectedItem" class="control-row">
                <span>旋转</span>
                <el-input-number
                  :model-value="'rotation' in selectedItem ? selectedItem.rotation : 0"
                  :min="-180"
                  :max="180"
                  size="small"
                  @update:model-value="updateLayerRotation"
                />
              </label>

              <template v-if="selectedStickerItem">
                <label class="control-row">
                  <span>宽度</span>
                  <el-input-number
                    :model-value="selectedStickerItem.width"
                    :min="24"
                    size="small"
                    @update:model-value="updateStickerWidth"
                  />
                </label>
                <label class="control-row">
                  <span>高度</span>
                  <el-input-number
                    :model-value="selectedStickerItem.height"
                    :min="24"
                    size="small"
                    @update:model-value="updateStickerHeight"
                  />
                </label>
              </template>

              <template v-if="selectedTextItem">
                <label class="control-row">
                  <span>内容</span>
                  <el-input
                    :model-value="selectedTextItem.text"
                    size="small"
                    @update:model-value="updateTextContent"
                  />
                </label>
                <label class="control-row">
                  <span>字号</span>
                  <el-input-number
                    :model-value="selectedTextItem.font_size"
                    :min="12"
                    :max="180"
                    size="small"
                    @update:model-value="updateTextFontSize"
                  />
                </label>
                <label class="control-row">
                  <span>颜色</span>
                  <input
                    class="journal-color-input"
                    type="color"
                    :value="selectedTextItem.fill"
                    @input="updateTextFill"
                  />
                </label>
              </template>
            </div>
          </el-tab-pane>
          <el-tab-pane label="版本" name="versions">
            <div class="panel-section">
              <div class="sidebar-title">
                <strong>版本历史</strong>
                <span>{{ journalStore.versions.length }}</span>
              </div>
              <div v-if="journalStore.versionLoading" class="picker-state">
                <el-skeleton :rows="4" animated />
              </div>
              <div v-else-if="journalStore.versions.length === 0" class="empty-mini">暂无版本</div>
              <div v-else class="version-list">
                <div v-for="version in journalStore.versions" :key="version.id" class="version-row">
                  <div>
                    <strong>v{{ version.version_no }}</strong>
                    <small>{{ formatDateTime(version.created_at) }}</small>
                  </div>
                  <div class="version-actions">
                    <el-button size="small" :disabled="journalStore.saving" @click="restoreVersion(version.id)">
                      恢复
                    </el-button>
                    <el-button
                      text
                      size="small"
                      type="danger"
                      :disabled="journalStore.saving"
                      @click="journalStore.deleteVersion(version.id)"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                  <span v-if="version.preview_image" class="version-preview-flag">有预览</span>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, DocumentChecked, Download, Plus } from '@element-plus/icons-vue'
import { useJournalStore } from '@/stores/journal'
import JournalCanvas from './JournalCanvas.vue'
import JournalGoodsPicker from './JournalGoodsPicker.vue'
import type { GoodsListItem, JournalLayer, JournalPageContent, JournalStickerItem, JournalTextItem } from '@/api/types'

const journalStore = useJournalStore()
const canvasRef = ref<InstanceType<typeof JournalCanvas> | null>(null)
const fallbackContent: JournalPageContent = { version: 2, layers: [] }
const sideTab = ref('goods')
const pageContextMenu = ref({
  visible: false,
  pageId: '',
  x: 0,
  y: 0,
})
const bookContextMenu = ref({
  visible: false,
  bookId: '',
  x: 0,
  y: 0,
})
let autoSaveTimer: number | null = null
const draggingPageId = ref<string | null>(null)

const statusText = computed(() => {
  if (journalStore.saving) return '保存中'
  if (journalStore.dirty) return '有未保存修改'
  if (journalStore.activePage) return '已保存'
  return '准备开始'
})

const createBook = async () => {
  try {
    const title = await ElMessageBox.prompt('给这本手帐起个名字', '新建手帐', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputValue: '我的手帐',
      inputPattern: /\S+/,
      inputErrorMessage: '请输入手帐名称',
    })
    await journalStore.createBook(title.value.trim())
  } catch {
    // user cancelled
  }
}

const deleteBook = async () => {
  if (!journalStore.activeBook) return
  try {
    await ElMessageBox.confirm(`确认删除《${journalStore.activeBook.title}》吗？`, '删除手帐', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await journalStore.removeBook(journalStore.activeBook.id)
  } catch {
    // user cancelled
  }
}

const openBookContextMenu = (event: MouseEvent, bookId: string) => {
  closePageContextMenu()
  const menuWidth = 108
  const menuHeight = 40
  bookContextMenu.value = {
    visible: true,
    bookId,
    x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
    y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
  }
}

const closeBookContextMenu = () => {
  bookContextMenu.value.visible = false
}

const renameContextBook = async () => {
  const bookId = bookContextMenu.value.bookId
  closeBookContextMenu()
  const book = journalStore.books.find(item => item.id === bookId)
  if (!book) return
  try {
    const result = await ElMessageBox.prompt('请输入手帐本名称', '重命名手帐本', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: book.title,
      inputPattern: /\S+/,
      inputErrorMessage: '手帐本名称不能为空',
    })
    const saved = await journalStore.renameBook(book.id, result.value.trim())
    if (saved) ElMessage.success('手帐本已重命名')
  } catch {
    // user cancelled
  }
}

const deletePage = async (pageId: string) => {
  closePageContextMenu()
  const page = journalStore.pages.find(item => item.id === pageId)
  if (!page) return
  if (journalStore.pages.length <= 1) {
    ElMessage.warning('至少需要保留 1 页')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除《${page.title}》吗？`, '删除页面', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    const deleted = await journalStore.removePage(page.id)
    if (deleted) ElMessage.success('页面已删除')
  } catch {
    // user cancelled
  }
}

const openPageContextMenu = (event: MouseEvent, pageId: string) => {
  closeBookContextMenu()
  const menuWidth = 116
  const menuHeight = 112
  pageContextMenu.value = {
    visible: true,
    pageId,
    x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
    y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
  }
}

const closePageContextMenu = () => {
  pageContextMenu.value.visible = false
}

const closeContextMenus = () => {
  closeBookContextMenu()
  closePageContextMenu()
}

const confirmDeleteContextPage = async () => {
  const pageId = pageContextMenu.value.pageId
  await deletePage(pageId)
}

const renameContextPage = async () => {
  const pageId = pageContextMenu.value.pageId
  closePageContextMenu()
  const page = journalStore.pages.find(item => item.id === pageId)
  if (!page) return
  try {
    const result = await ElMessageBox.prompt('请输入页面名称', '重命名页面', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: page.title,
      inputPattern: /\S+/,
      inputErrorMessage: '页面名称不能为空',
    })
    const saved = await journalStore.renamePage(page.id, result.value.trim())
    if (saved) ElMessage.success('页面已重命名')
  } catch {
    // user cancelled
  }
}

const duplicateContextPage = async () => {
  const pageId = pageContextMenu.value.pageId
  closePageContextMenu()
  const duplicated = await journalStore.duplicatePage(pageId)
  if (duplicated) ElMessage.success('页面已复制')
}

const handlePageDragStart = (pageId: string) => {
  draggingPageId.value = pageId
}

const handlePageDrop = async (targetPageId: string) => {
  const sourcePageId = draggingPageId.value
  draggingPageId.value = null
  if (!sourcePageId || sourcePageId === targetPageId) return
  const ids = journalStore.pages.map(page => page.id)
  const fromIndex = ids.indexOf(sourcePageId)
  const toIndex = ids.indexOf(targetPageId)
  if (fromIndex < 0 || toIndex < 0) return
  const [moved] = ids.splice(fromIndex, 1)
  if (!moved) return
  ids.splice(toIndex, 0, moved)
  await journalStore.reorderPages(ids)
}

const handleContentUpdate = (content: JournalPageContent) => {
  journalStore.updateActivePageContent(content)
}

const canvasLayers = computed(() => canvasRef.value?.layers || [])
const selectedLayer = computed(() => canvasRef.value?.selectedLayer || null)
const selectedItem = computed(() => canvasRef.value?.selectedItem || null)
const selectedStickerItem = computed(() => (
  selectedItem.value?.type === 'sticker' ? selectedItem.value as JournalStickerItem : null
))
const selectedTextItem = computed(() => (
  selectedItem.value?.type === 'text' ? selectedItem.value as JournalTextItem : null
))

const layerLabel = (layer: JournalLayer) => {
  if (layer.name) return layer.name
  if (layer.type === 'sticker') return '贴纸层'
  if (layer.type === 'text') return '文字层'
  return '画笔层'
}

const updateSelectedLayer = (patch: Record<string, unknown>) => {
  canvasRef.value?.updateSelectedLayer(patch)
}

const toNumber = (value: unknown, fallback: number) => {
  const next = Number(value ?? fallback)
  return Number.isFinite(next) ? next : fallback
}

const updateLayerOpacity = (value: unknown) => {
  updateSelectedLayer({ opacity: toNumber(value, 1) })
}

const updateLayerRotation = (value: unknown) => {
  updateSelectedLayer({ rotation: toNumber(value, 0) })
}

const updateStickerWidth = (value: unknown) => {
  updateSelectedLayer({ width: toNumber(value, 24) })
}

const updateStickerHeight = (value: unknown) => {
  updateSelectedLayer({ height: toNumber(value, 24) })
}

const updateTextContent = (value: string | number) => {
  updateSelectedLayer({ text: String(value) })
}

const updateTextFontSize = (value: unknown) => {
  updateSelectedLayer({ font_size: toNumber(value, 12) })
}

const updateTextFill = (event: Event) => {
  updateSelectedLayer({ fill: (event.target as HTMLInputElement).value })
}

const savePage = async () => {
  const saved = await journalStore.saveActivePage()
  if (saved) ElMessage.success('手帐已保存')
}

const restoreVersion = async (versionId: string) => {
  try {
    await ElMessageBox.confirm('恢复后会用该版本覆盖当前页面，并生成一个新的当前版本。', '恢复版本', {
      confirmButtonText: '恢复',
      cancelButtonText: '取消',
      type: 'warning',
    })
    const restored = await journalStore.restoreVersion(versionId)
    if (restored) ElMessage.success('已恢复并保存')
  } catch {
    // user cancelled
  }
}

const insertGoods = (goods: GoodsListItem) => {
  canvasRef.value?.addGoodsSticker(goods)
}

const exportPreview = async () => {
  const blob = await canvasRef.value?.exportPngBlob()
  if (!blob) {
    ElMessage.warning('当前环境暂时无法导出画布')
    return
  }
  const file = new File([blob], `journal-${journalStore.activePageId || 'page'}.png`, { type: 'image/png' })
  await journalStore.uploadPreview(file)
  ElMessage.success('页面缩略图已更新，可在左侧页面列表查看')
}

const formatDateTime = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

watch(
  () => journalStore.activePage?.content,
  () => {
    if (!journalStore.dirty) return
    if (autoSaveTimer !== null) window.clearTimeout(autoSaveTimer)
    autoSaveTimer = window.setTimeout(() => {
      journalStore.saveActivePage({ createVersion: false })
      autoSaveTimer = null
    }, 1200)
  },
  { deep: true },
)

onMounted(() => {
  journalStore.fetchBooks()
  window.addEventListener('click', closeContextMenus)
  window.addEventListener('scroll', closeContextMenus, true)
  window.addEventListener('resize', closeContextMenus)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeContextMenus)
  window.removeEventListener('scroll', closeContextMenus, true)
  window.removeEventListener('resize', closeContextMenus)
  if (autoSaveTimer !== null) {
    window.clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
})
</script>

<style scoped>
.journal-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.journal-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
}

.journal-heading {
  min-width: 0;
}

.journal-heading h2 {
  margin: 0;
  color: var(--text-dark);
  font-size: 22px;
  line-height: 1.2;
}

.journal-heading span {
  display: block;
  margin-top: 4px;
  color: var(--text-light);
  font-size: 13px;
}

.journal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.journal-error {
  margin-top: -4px;
}

.journal-layout {
  min-height: 720px;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  gap: 14px;
  align-items: start;
}

.journal-sidebar,
.journal-side-panel,
.journal-editor {
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
}

.journal-sidebar,
.journal-side-panel {
  padding: 14px;
}

.journal-editor {
  padding: 14px;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.sidebar-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-dark);
}

.sidebar-title strong {
  font-size: 14px;
}

.sidebar-title span,
.page-row small,
.book-row small {
  color: var(--text-light);
  font-size: 12px;
}

.book-row,
.page-row,
.layer-row {
  width: 100%;
  min-height: 46px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  background: #fff;
  color: var(--text-dark);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 8px 10px;
  cursor: pointer;
  text-align: left;
}

.page-row {
  position: relative;
  padding-left: 58px;
}

.page-thumb {
  position: absolute;
  left: 8px;
  top: 8px;
  width: 38px;
  height: 38px;
  border-radius: 6px;
  object-fit: cover;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.book-row span,
.page-row span,
.layer-row span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
}

.book-row.is-active,
.page-row.is-active,
.layer-row.is-active {
  border-color: rgba(212, 175, 55, 0.58);
  background: rgba(212, 175, 55, 0.1);
}

.layer-controls {
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.layer-order-actions,
.version-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.layer-order-actions :deep(.el-button + .el-button) {
  margin-left: 0 !important;
}

.control-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: var(--text-light);
  font-size: 12px;
}

.control-row > :not(span) {
  min-width: 0;
}

.control-row :deep(.el-slider) {
  padding: 0 10px;
  box-sizing: border-box;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 620px;
  overflow-y: auto;
}

.version-row {
  min-width: 0;
  padding: 9px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-row strong {
  color: var(--text-dark);
  font-size: 13px;
}

.version-row small,
.version-preview-flag {
  display: block;
  margin-top: 2px;
  color: var(--text-light);
  font-size: 12px;
}

.empty-mini {
  min-height: 54px;
  display: flex;
  align-items: center;
  color: var(--text-light);
  font-size: 13px;
}

.delete-book-btn {
  width: 100%;
}

.page-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 108px;
  padding: 4px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
}

.page-context-menu button {
  width: 100%;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dark);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 13px;
  cursor: pointer;
}

.page-context-menu button:hover {
  background: rgba(148, 163, 184, 0.12);
}

.page-context-menu button.is-danger {
  color: var(--el-color-danger);
}

.page-context-menu button.is-danger:hover {
  background: var(--el-color-danger-light-9);
}

.journal-loading,
.journal-empty {
  min-height: 520px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.journal-loading {
  display: block;
  padding: 24px;
}

@media (max-width: 1100px) {
  .journal-layout {
    grid-template-columns: 200px minmax(0, 1fr);
  }

  .journal-side-panel {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .journal-topbar {
    align-items: stretch;
    flex-direction: column;
    padding: 12px;
  }

  .journal-actions {
    justify-content: stretch;
  }

  .journal-actions :deep(.el-button) {
    flex: 1;
  }

  .journal-layout {
    min-height: 0;
    grid-template-columns: 1fr;
  }

  .journal-sidebar {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
