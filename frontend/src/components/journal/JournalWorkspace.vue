<template>
  <section
    class="journal-workspace"
    :class="{ 'journal-workspace--mobile': isMobile, 'has-mobile-context': showMobilePaintContext }"
    data-test="journal-workspace"
  >
    <header v-if="isMobile" class="journal-mobile-header">
      <button class="journal-mobile-icon-btn" type="button" aria-label="返回" @click="handleMobileBack">
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <button class="journal-mobile-page-switch" type="button" @click="openMobilePanel('pages')">
        <strong>{{ journalStore.activeBook?.title || '新建手帐' }}</strong>
        <span>
          <i class="journal-status-dot" :class="statusInfo.className" aria-hidden="true" />
          {{ mobilePageLabel }} · {{ statusInfo.text }}
        </span>
      </button>
      <div class="journal-mobile-header-actions">
        <button
          class="journal-mobile-icon-btn"
          type="button"
          aria-label="撤销"
          :disabled="!canvasCanUndo"
          @click="canvasRef?.undo()"
        >
          <el-icon><RefreshLeft /></el-icon>
        </button>
        <button
          class="journal-mobile-icon-btn"
          type="button"
          aria-label="重做"
          :disabled="!canvasCanRedo"
          @click="canvasRef?.redo()"
        >
          <el-icon><RefreshRight /></el-icon>
        </button>
        <button
          class="journal-mobile-save-btn"
          type="button"
          :disabled="!journalStore.activePage || journalStore.saving"
          @click="savePage"
        >
          {{ journalStore.saving ? '保存中' : '保存' }}
        </button>
        <button class="journal-mobile-icon-btn" type="button" aria-label="更多" @click="openMobilePanel('more')">
          <el-icon><MoreFilled /></el-icon>
        </button>
      </div>
    </header>

    <header v-if="!isMobile" class="journal-topbar">
      <div class="journal-heading">
        <h2>手帐</h2>
        <span class="journal-status" :class="statusInfo.className">
          <i class="journal-status-dot" aria-hidden="true" />
          {{ statusInfo.text }}
        </span>
      </div>
      <div class="journal-actions">
        <input ref="coverInputRef" class="sr-only-input" type="file" accept="image/*" @change="handleCoverUpload" />
        <el-button
          v-if="journalStore.books.length > 0"
          data-test="journal-create-book-top"
          class="brand-add-btn brand-add-btn--compact journal-create-btn"
          :loading="journalStore.saving"
          @click="createBook"
        >
          <el-icon class="el-icon--left"><Plus /></el-icon>
          新手帐
        </el-button>
        <el-button :disabled="!journalStore.activeBook" @click="coverInputRef?.click()">
          设置封面
        </el-button>
        <el-button :disabled="!journalStore.activePage" :loading="journalStore.saving" @click="savePage">
          <el-icon class="el-icon--left"><DocumentChecked /></el-icon>
          保存
        </el-button>
        <el-select v-model="exportScale" class="export-scale-select" size="small" :disabled="!journalStore.activePage" aria-label="导出倍率">
          <el-option label="1x" :value="1" />
          <el-option label="2x" :value="2" />
          <el-option label="3x" :value="3" />
        </el-select>
        <el-button :disabled="!journalStore.activePage" @click="downloadCurrentPage">
          导出图片
        </el-button>
        <el-button :disabled="!journalStore.activePage" @click="downloadLongImage">
          导出长图
        </el-button>
        <el-button :disabled="!journalStore.activePage" @click="downloadShareImage">
          分享图
        </el-button>
        <el-button :disabled="!journalStore.activePage" @click="createPublicShare">
          公开链接
        </el-button>
        <el-button :disabled="journalStore.pages.length === 0" @click="readerMode = true">
          读者模式
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
      <aside
        class="journal-sidebar"
        :class="{ 'is-mobile-open': mobilePanel === 'pages' }"
      >
        <div v-if="isMobile" class="journal-mobile-sheet-handle" aria-hidden="true" />
        <div v-if="isMobile" class="journal-mobile-sheet-heading">
          <div>
            <strong>手帐与页面</strong>
            <small>{{ journalStore.books.length }} 本 · {{ journalStore.pages.length }} 页</small>
          </div>
          <button class="journal-mobile-sheet-close" type="button" aria-label="关闭" @click="closeMobilePanel">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-title">
            <strong>手帐本</strong>
            <span>
              {{ journalStore.books.length }}
              <el-button v-if="isMobile" text size="small" @click="createBook">
                <el-icon><Plus /></el-icon>
                新建
              </el-button>
            </span>
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
            @click="selectMobileBook(book.id)"
            @contextmenu.prevent="openBookContextMenu($event, book.id)"
          >
            <img v-if="book.cover_image" class="book-cover-thumb" :src="book.cover_image" alt="" />
            <span v-else class="book-cover-thumb book-cover-placeholder" aria-hidden="true">手</span>
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
            :draggable="!isMobile"
            @click="selectMobilePage(page.id)"
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

        <div v-if="isMobile && journalStore.activeBook" class="journal-mobile-page-actions">
          <div class="journal-mobile-action-group">
            <strong>当前手帐</strong>
            <div>
              <el-button size="small" @click="coverInputRef?.click()">设置封面</el-button>
              <el-button size="small" @click="renameBookById(journalStore.activeBook.id)">重命名</el-button>
              <el-button size="small" type="danger" plain @click="deleteBook">删除</el-button>
            </div>
          </div>
          <div v-if="journalStore.activePage" class="journal-mobile-action-group">
            <strong>当前页面</strong>
            <div>
              <el-button size="small" :disabled="activePageIndex <= 0" @click="moveMobilePage(-1)">上移</el-button>
              <el-button
                size="small"
                :disabled="activePageIndex < 0 || activePageIndex >= journalStore.pages.length - 1"
                @click="moveMobilePage(1)"
              >下移</el-button>
              <el-button size="small" @click="renamePageById(journalStore.activePage.id)">重命名</el-button>
              <el-button size="small" @click="duplicatePageById(journalStore.activePage.id)">复制</el-button>
              <el-button size="small" type="danger" plain @click="deletePage(journalStore.activePage.id)">删除</el-button>
            </div>
          </div>
        </div>
      </aside>

      <Teleport to="body">
        <div
          v-if="bookContextMenu.visible"
          ref="bookContextMenuRef"
          class="page-context-menu"
          :style="{
            left: `${bookContextMenu.x}px`,
            top: `${bookContextMenu.y}px`,
            visibility: bookContextMenuPositioned ? 'visible' : 'hidden',
          }"
          @click.stop
        >
          <button type="button" @click="renameContextBook">重命名</button>
        </div>

        <div
          v-if="pageContextMenu.visible"
          ref="pageContextMenuRef"
          class="page-context-menu"
          :style="{
            left: `${pageContextMenu.x}px`,
            top: `${pageContextMenu.y}px`,
            visibility: pageContextMenuPositioned ? 'visible' : 'hidden',
          }"
          @click.stop
        >
          <button type="button" @click="renameContextPage">重命名</button>
          <button type="button" @click="duplicateContextPage">复制页面</button>
          <button class="is-danger" type="button" @click="confirmDeleteContextPage">
            <el-icon><Delete /></el-icon>
            删除页面
          </button>
        </div>
      </Teleport>

      <main class="journal-editor">
        <div v-if="journalStore.loading || journalStore.pageLoading" class="journal-loading">
          <el-skeleton :rows="10" animated />
        </div>
        <div v-else-if="!journalStore.activePage" class="journal-empty">
          <div class="journal-empty-illustration" aria-hidden="true">
            <span />
            <i />
          </div>
          <el-empty description="创建一本手帐开始拼贴吧">
            <el-button
              data-test="journal-create-book-empty"
              type="primary"
              class="brand-add-btn brand-add-btn--hero journal-create-btn journal-create-btn--hero"
              @click="createBook"
            >创建手帐</el-button>
          </el-empty>
        </div>
        <JournalCanvas
          v-else
          ref="canvasRef"
          :mobile="isMobile"
          :model-value="journalStore.activePage.content || fallbackContent"
          :width="journalStore.activePage.width"
          :height="journalStore.activePage.height"
          :background="journalStore.activePage.background"
          :background-style="journalStore.activePage.background_style || 'plain'"
          @update:model-value="handleContentUpdate"
        />
      </main>

      <aside
        class="journal-side-panel"
        :class="{ 'is-mobile-open': showMobileInspector }"
      >
        <div v-if="isMobile" class="journal-mobile-sheet-handle" aria-hidden="true" />
        <div v-if="isMobile" class="journal-mobile-sheet-heading">
          <div>
            <strong>{{ mobileInspectorTitle }}</strong>
            <small>页面、素材与图层工具</small>
          </div>
          <button class="journal-mobile-sheet-close" type="button" aria-label="关闭" @click="closeMobilePanel">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <el-tabs v-model="sideTab" stretch>
          <el-tab-pane label="素材" name="goods">
            <JournalGoodsPicker
              :mobile="isMobile"
              @insert-goods="insertGoods"
              @insert-decor-sticker="insertDecorSticker"
              @insert-local-image="insertLocalImage"
            />
          </el-tab-pane>
          <el-tab-pane label="图层" name="layers">
            <div v-if="journalStore.activePage" class="panel-section background-settings">
              <div class="sidebar-title">
                <strong>页面设置</strong>
              </div>
              <label class="control-row">
                <span>尺寸</span>
                <el-select :model-value="activeSizePreset" size="small" @update:model-value="applySizePreset">
                  <el-option label="手帐页" value="journal" />
                  <el-option label="正方形" value="square" />
                  <el-option label="A4 竖版" value="a4" />
                  <el-option label="手机壁纸" value="phone" />
                </el-select>
              </label>
              <label class="control-row">
                <span>模板</span>
                <el-select size="small" placeholder="选择模板" @update:model-value="applyPageTemplate">
                  <el-option label="奶油点阵" value="warm-dot" />
                  <el-option label="蓝调网格" value="blue-grid" />
                  <el-option label="横线便签" value="note-line" />
                </el-select>
              </label>
              <label class="control-row">
                <span>颜色</span>
                <input
                  class="journal-color-input"
                  type="color"
                  :value="journalStore.activePage.background"
                  @input="updatePageBackgroundColor"
                />
              </label>
              <label class="control-row">
                <span>样式</span>
                <el-select
                  :model-value="journalStore.activePage.background_style || 'plain'"
                  size="small"
                  @update:model-value="updatePageBackgroundStyle"
                >
                  <el-option label="纯色" value="plain" />
                  <el-option label="点阵" value="dot" />
                  <el-option label="横线" value="line" />
                  <el-option label="网格" value="grid" />
                  <el-option label="手帐纸" value="note" />
                </el-select>
              </label>
            </div>

            <div class="panel-section">
              <div class="sidebar-title">
                <strong>图层</strong>
                <span>{{ canvasLayers.length }}</span>
              </div>
              <div v-if="selectedLayerIds.length > 1" class="multi-align-actions">
                <el-button data-test="align-left" size="small" @click="canvasRef?.alignSelectedLayers('left')">左对齐</el-button>
                <el-button data-test="align-top" size="small" @click="canvasRef?.alignSelectedLayers('top')">上对齐</el-button>
                <el-button data-test="distribute-horizontal" size="small" @click="canvasRef?.distributeSelectedLayers('horizontal')">横向分布</el-button>
                <el-button data-test="distribute-vertical" size="small" @click="canvasRef?.distributeSelectedLayers('vertical')">纵向分布</el-button>
              </div>
              <div class="layer-order-actions">
                <el-button size="small" type="primary" @click="canvasRef?.addBrushLayer">
                  <el-icon class="el-icon--left"><Plus /></el-icon>
                  新建画笔层
                </el-button>
                <el-button size="small" @click="canvasRef?.addShapeLayer('rect')">矩形</el-button>
                <el-button size="small" @click="canvasRef?.addShapeLayer('circle')">圆形</el-button>
                <el-button size="small" @click="canvasRef?.setTool('eyedropper')">吸管</el-button>
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
                <span class="layer-thumb" :style="layerThumbStyle(layer)">
                  <img v-if="layerThumbImage(layer)" :src="layerThumbImage(layer)!" alt="" />
                  <span v-else>{{ layerThumbText(layer) }}</span>
                </span>
                <span class="layer-main">
                  <span>{{ layerLabel(layer) }}</span>
                  <small>{{ layerSummary(layer) }}</small>
                </span>
                <span class="layer-inline-actions" @click.stop>
                  <button
                    :data-test="`layer-visibility-${layer.id}`"
                    type="button"
                    :aria-label="layer.visible === false ? '显示图层' : '隐藏图层'"
                    @click="canvasRef?.toggleLayerVisibility(layer.id)"
                  >
                    <el-icon>
                      <Hide v-if="layer.visible === false" />
                      <View v-else />
                    </el-icon>
                  </button>
                  <button
                    :data-test="`layer-lock-${layer.id}`"
                    type="button"
                    :aria-label="layer.locked ? '解锁图层' : '锁定图层'"
                    @click="canvasRef?.toggleLayerLock(layer.id)"
                  >
                    <el-icon>
                      <Lock v-if="layer.locked" />
                      <Unlock v-else />
                    </el-icon>
                  </button>
                </span>
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
                <label class="control-row">
                  <span>字体</span>
                  <el-select
                    :model-value="selectedTextItem.font_family || 'sans-serif'"
                    size="small"
                    @update:model-value="updateTextFontFamily"
                  >
                    <el-option label="清爽无衬线" value="sans-serif" />
                    <el-option label="温柔衬线" value="serif" />
                    <el-option label="手写感" value="'Comic Sans MS', cursive" />
                    <el-option label="等宽标注" value="monospace" />
                  </el-select>
                </label>
                <label class="control-row">
                  <span>粗细</span>
                  <el-select
                    :model-value="selectedTextItem.font_weight || '400'"
                    size="small"
                    @update:model-value="updateTextFontWeight"
                  >
                    <el-option label="常规" value="400" />
                    <el-option label="中粗" value="600" />
                    <el-option label="加粗" value="700" />
                  </el-select>
                </label>
                <label class="control-row">
                  <span>对齐</span>
                  <span class="segmented-inline">
                    <button
                      v-for="option in textAlignOptions"
                      :key="option.value"
                      type="button"
                      :class="{ 'is-active': (selectedTextItem.align || 'left') === option.value }"
                      @click="updateTextAlign(option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </span>
                </label>
                <label class="control-row">
                  <span>行高</span>
                  <el-input-number
                    :model-value="selectedTextItem.line_height || 1.25"
                    :min="0.8"
                    :max="3"
                    :step="0.05"
                    size="small"
                    @update:model-value="updateTextLineHeight"
                  />
                </label>
                <label class="control-row">
                  <span>描边</span>
                  <input
                    class="journal-color-input"
                    type="color"
                    :value="selectedTextItem.stroke || '#ffffff'"
                    @input="updateTextStroke"
                  />
                </label>
                <label class="control-row">
                  <span>描边宽</span>
                  <el-input-number
                    :model-value="selectedTextItem.stroke_width || 0"
                    :min="0"
                    :max="12"
                    size="small"
                    @update:model-value="updateTextStrokeWidth"
                  />
                </label>
                <label class="control-row">
                  <span>阴影</span>
                  <input
                    type="checkbox"
                    :checked="Boolean(selectedTextItem.shadow_enabled)"
                    @change="updateTextShadowEnabled"
                  />
                </label>
                <label class="control-row">
                  <span>阴影色</span>
                  <input
                    class="journal-color-input"
                    type="color"
                    :value="selectedTextItem.shadow_color || '#999999'"
                    @input="updateTextShadowColor"
                  />
                </label>
                <label class="control-row">
                  <span>阴影强度</span>
                  <el-input-number
                    :model-value="selectedTextItem.shadow_blur || 0"
                    :min="0"
                    :max="40"
                    size="small"
                    @update:model-value="updateTextShadowBlur"
                  />
                </label>
              </template>

              <template v-if="selectedShapeItem">
                <label class="control-row">
                  <span>宽度</span>
                  <el-input-number :model-value="selectedShapeItem.width" :min="12" size="small" @update:model-value="updateShapeWidth" />
                </label>
                <label class="control-row">
                  <span>高度</span>
                  <el-input-number :model-value="selectedShapeItem.height" :min="12" size="small" @update:model-value="updateShapeHeight" />
                </label>
                <label class="control-row">
                  <span>填充</span>
                  <input class="journal-color-input" type="color" :value="selectedShapeItem.fill" @input="updateShapeFill" />
                </label>
                <label class="control-row">
                  <span>描边</span>
                  <input class="journal-color-input" type="color" :value="selectedShapeItem.stroke" @input="updateShapeStroke" />
                </label>
                <label class="control-row">
                  <span>线宽</span>
                  <el-input-number :model-value="selectedShapeItem.stroke_width" :min="0" :max="80" size="small" @update:model-value="updateShapeStrokeWidth" />
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

    <button
      v-if="isMobile && mobilePanel"
      class="journal-mobile-sheet-backdrop"
      type="button"
      aria-label="关闭面板"
      @click="closeMobilePanel"
    />

    <div
      v-if="isMobile"
      class="journal-mobile-dock"
      :class="{ 'has-context': showMobilePaintContext }"
    >
      <div v-if="showMobilePaintContext" class="journal-mobile-brush-context">
        <template v-if="mobileTool === 'draw'">
          <label class="journal-mobile-color-control">
            <span>颜色</span>
            <input type="color" :value="mobileBrushColor" aria-label="画笔颜色" @input="handleMobileBrushColor" />
          </label>
          <div class="journal-mobile-brush-presets" aria-label="画笔类型">
            <button
              v-for="preset in mobileBrushPresets"
              :key="preset.type"
              type="button"
              :class="{ 'is-active': mobileBrushType === preset.type }"
              @click="setMobileBrushType(preset.type)"
            >
              {{ preset.label }}
            </button>
          </div>
        </template>
        <label class="journal-mobile-width-control">
          <span>{{ mobileTool === 'erase' ? '橡皮' : '粗细' }}</span>
          <input
            type="range"
            :min="mobileTool === 'erase' ? 4 : 2"
            :max="mobileTool === 'erase' ? 80 : 28"
            :value="mobileTool === 'erase' ? mobileEraserWidth : mobileBrushWidth"
            @input="handleMobileBrushWidth"
          />
          <strong>{{ mobileTool === 'erase' ? mobileEraserWidth : mobileBrushWidth }}px</strong>
        </label>
      </div>

      <nav class="journal-mobile-toolbar" aria-label="手帐工具">
        <button
          type="button"
          :class="{ 'is-active': mobileTool === 'select' }"
          :aria-pressed="mobileTool === 'select'"
          @click="setMobileTool('select')"
        >
          <el-icon><Pointer /></el-icon>
          <span>选择</span>
        </button>
        <button
          type="button"
          :class="{ 'is-active': mobileTool === 'draw' }"
          :aria-pressed="mobileTool === 'draw'"
          :disabled="!journalStore.activePage"
          @click="setMobileTool('draw')"
        >
          <el-icon><EditPen /></el-icon>
          <span>画笔</span>
        </button>
        <button
          type="button"
          :class="{ 'is-active': mobileTool === 'erase' }"
          :aria-pressed="mobileTool === 'erase'"
          :disabled="!journalStore.activePage"
          @click="setMobileTool('erase')"
        >
          <el-icon><Brush /></el-icon>
          <span>橡皮</span>
        </button>
        <button
          type="button"
          :disabled="!journalStore.activePage"
          @click="handleMobileAddText"
        >
          <el-icon><Document /></el-icon>
          <span>文字</span>
        </button>
        <button
          type="button"
          :disabled="!journalStore.activePage"
          @click="openMobileInspector('goods')"
        >
          <el-icon><Picture /></el-icon>
          <span>素材</span>
        </button>
        <button
          type="button"
          :disabled="!journalStore.activePage"
          @click="openMobileInspector('layers')"
        >
          <el-icon><Grid /></el-icon>
          <span>图层</span>
        </button>
      </nav>
    </div>

    <BaseBottomSheet
      v-model="mobileMoreOpen"
      title="更多"
      subtitle="导出、分享、页面维护与版本"
      size="auto"
    >
      <div class="journal-mobile-more">
        <section class="journal-mobile-more-section">
          <div class="journal-mobile-more-title">
            <strong>导出倍率</strong>
            <div class="journal-mobile-segmented">
              <button
                v-for="scale in [1, 2, 3]"
                :key="scale"
                type="button"
                :class="{ 'is-active': exportScale === scale }"
                @click="exportScale = scale"
              >{{ scale }}x</button>
            </div>
          </div>
          <div class="journal-mobile-more-grid">
            <button type="button" :disabled="!journalStore.activePage" @click="runMobileMore(downloadCurrentPage)">
              <el-icon><Download /></el-icon>
              <span>导出图片</span>
            </button>
            <button type="button" :disabled="!journalStore.activePage" @click="runMobileMore(downloadLongImage)">
              <el-icon><DocumentChecked /></el-icon>
              <span>导出长图</span>
            </button>
            <button type="button" :disabled="!journalStore.activePage" @click="runMobileMore(downloadShareImage)">
              <el-icon><Share /></el-icon>
              <span>分享图</span>
            </button>
            <button type="button" :disabled="!journalStore.activePage" @click="runMobileMore(createPublicShare)">
              <el-icon><Link /></el-icon>
              <span>公开链接</span>
            </button>
          </div>
        </section>
        <section class="journal-mobile-more-section">
          <div class="journal-mobile-more-list">
            <button type="button" :disabled="journalStore.pages.length === 0" @click="openMobileReader">
              <el-icon><View /></el-icon>
              <span>读者模式</span>
            </button>
            <button type="button" :disabled="!journalStore.activePage" @click="runMobileMore(exportPreview)">
              <el-icon><Picture /></el-icon>
              <span>更新缩略图</span>
            </button>
            <button type="button" :disabled="!journalStore.activeBook" @click="runMobileMore(() => coverInputRef?.click())">
              <el-icon><Camera /></el-icon>
              <span>设置封面</span>
            </button>
            <button type="button" :disabled="!journalStore.activePage" @click="openMobileInspector('versions')">
              <el-icon><RefreshLeft /></el-icon>
              <span>版本历史</span>
            </button>
          </div>
        </section>
      </div>
    </BaseBottomSheet>

    <BaseBottomSheet
      v-model="mobileExitSheet"
      title="保存失败"
      subtitle="当前修改尚未写入服务器"
      size="auto"
    >
      <div class="journal-mobile-exit">
        <p>{{ journalStore.error || '请检查网络后重试。' }}</p>
        <el-button type="primary" :loading="exitSaving" @click="retryMobileExit">重试保存</el-button>
        <el-button :disabled="exitSaving" @click="discardMobileExit">放弃修改并退出</el-button>
        <el-button text :disabled="exitSaving" @click="mobileExitSheet = false">继续编辑</el-button>
      </div>
    </BaseBottomSheet>

    <div v-if="readerMode" class="reader-overlay">
      <button class="reader-close" type="button" @click="readerMode = false">关闭</button>
      <button class="reader-nav reader-nav--prev" type="button" :disabled="readerIndex <= 0" @click="readerIndex -= 1">上一页</button>
      <div class="reader-page">
        <img v-if="readerPage?.preview_image" :src="readerPage.preview_image" alt="" />
        <div v-else class="reader-placeholder" :style="{ background: readerPage?.background || '#fffaf0' }">
          {{ readerPage?.title || '暂无页面' }}
        </div>
        <strong>{{ readerPage?.title }}</strong>
      </div>
      <button class="reader-nav reader-nav--next" type="button" :disabled="readerIndex >= journalStore.pages.length - 1" @click="readerIndex += 1">下一页</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Brush,
  Camera,
  Close,
  Delete,
  Document,
  DocumentChecked,
  Download,
  EditPen,
  Grid,
  Hide,
  Link,
  Lock,
  MoreFilled,
  Picture,
  Plus,
  Pointer,
  RefreshLeft,
  RefreshRight,
  Share,
  Unlock,
  View,
} from '@element-plus/icons-vue'
import { useJournalStore } from '@/stores/journal'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import BaseBottomSheet from '@/components/ui/BaseBottomSheet.vue'
import JournalCanvas from './JournalCanvas.vue'
import JournalGoodsPicker from './JournalGoodsPicker.vue'
import type { GoodsListItem, JournalLayer, JournalPageContent, JournalShapeItem, JournalStickerItem, JournalTextItem } from '@/api/types'
import { getContextMenuPosition } from '@/utils/contextMenuPosition'

const journalStore = useJournalStore()
const router = useRouter()
const { isMobile } = useResponsiveDevice()
const canvasRef = ref<InstanceType<typeof JournalCanvas> | null>(null)
const fallbackContent: JournalPageContent = { version: 2, layers: [] }
type BackgroundStyle = 'plain' | 'dot' | 'line' | 'grid' | 'note'
type SizePreset = 'journal' | 'square' | 'a4' | 'phone'
type MobileJournalPanel = 'pages' | 'materials' | 'layers' | 'versions' | 'more' | null
type MobileBrushType = 'pencil' | 'pen' | 'watercolor' | 'marker' | 'highlighter'
const sideTab = ref('goods')
const mobilePanel = ref<MobileJournalPanel>(null)
const mobileExitSheet = ref(false)
const exitSaving = ref(false)
const mobileTool = ref<'select' | 'draw' | 'erase'>('select')
const mobileBrushColor = ref('#8e7dff')
const mobileBrushWidth = ref(8)
const mobileEraserWidth = ref(20)
const mobileBrushType = ref<MobileBrushType>('pen')
const mobileBrushPresets: Array<{ type: MobileBrushType; label: string }> = [
  { type: 'pencil', label: '铅笔' },
  { type: 'pen', label: '钢笔' },
  { type: 'watercolor', label: '水彩' },
  { type: 'marker', label: '马克笔' },
  { type: 'highlighter', label: '荧光' },
]
const coverInputRef = ref<HTMLInputElement | null>(null)
const exportScale = ref(2)
const readerMode = ref(false)
const readerIndex = ref(0)
const pageContextMenu = ref({
  visible: false,
  pageId: '',
  x: 0,
  y: 0,
})
const pageContextMenuRef = ref<HTMLElement | null>(null)
const pageContextMenuPositioned = ref(false)
const bookContextMenu = ref({
  visible: false,
  bookId: '',
  x: 0,
  y: 0,
})
const bookContextMenuRef = ref<HTMLElement | null>(null)
const bookContextMenuPositioned = ref(false)
let contextMenuPositionRequest = 0
let autoSaveTimer: number | null = null
const draggingPageId = ref<string | null>(null)

const statusText = computed(() => {
  if (journalStore.saving) return '保存中'
  if (journalStore.dirty) return '有未保存修改'
  if (journalStore.activePage) return '已保存'
  return '准备开始'
})

const statusInfo = computed(() => {
  if (journalStore.saving) return { text: statusText.value, className: 'is-saving' }
  if (journalStore.dirty) return { text: statusText.value, className: 'is-dirty' }
  if (journalStore.activePage) return { text: statusText.value, className: 'is-saved' }
  return { text: statusText.value, className: 'is-idle' }
})
const mobilePageLabel = computed(() => {
  const page = journalStore.activePage
  if (!page) return '还没有页面'
  const index = journalStore.pages.findIndex(item => item.id === page.id)
  return `第 ${index >= 0 ? index + 1 : page.page_no} / ${journalStore.pages.length} 页`
})
const activePageIndex = computed(() => (
  journalStore.pages.findIndex(page => page.id === journalStore.activePageId)
))
const showMobilePaintContext = computed(() => (
  isMobile.value && (mobileTool.value === 'draw' || mobileTool.value === 'erase')
))
const showMobileInspector = computed(() => (
  mobilePanel.value === 'materials'
  || mobilePanel.value === 'layers'
  || mobilePanel.value === 'versions'
))
const mobileInspectorTitle = computed(() => {
  if (sideTab.value === 'goods') return '素材'
  if (sideTab.value === 'versions') return '版本历史'
  return '图层与页面'
})
const mobileMoreOpen = computed({
  get: () => mobilePanel.value === 'more',
  set: (visible: boolean) => {
    mobilePanel.value = visible ? 'more' : null
  },
})
const canvasCanUndo = computed(() => Boolean(canvasRef.value?.canUndo))
const canvasCanRedo = computed(() => Boolean(canvasRef.value?.canRedo))
const readerPage = computed(() => journalStore.pages[readerIndex.value] || journalStore.activePage)
const activeSizePreset = computed<SizePreset>(() => {
  const page = journalStore.activePage
  if (!page) return 'journal'
  if (page.width === page.height) return 'square'
  if (page.width === 1240 && page.height === 1754) return 'a4'
  if (page.width === 1080 && page.height === 1920) return 'phone'
  return 'journal'
})
const textAlignOptions = [
  { label: '左', value: 'left' },
  { label: '中', value: 'center' },
  { label: '右', value: 'right' },
]

const closeMobilePanel = () => {
  mobilePanel.value = null
}

const openMobilePanel = (panel: Exclude<MobileJournalPanel, null>) => {
  if (panel === 'pages') {
    closeContextMenus()
  }
  mobilePanel.value = panel
}

const selectMobileBook = async (bookId: string) => {
  await journalStore.setActiveBook(bookId)
  if (isMobile.value) closeMobilePanel()
}

const selectMobilePage = async (pageId: string) => {
  await journalStore.setActivePage(pageId)
  if (isMobile.value) closeMobilePanel()
}

const openMobileInspector = (tab: 'goods' | 'layers' | 'versions') => {
  sideTab.value = tab
  openMobilePanel(tab === 'goods' ? 'materials' : tab === 'versions' ? 'versions' : 'layers')
}

const setMobileTool = (tool: 'select' | 'draw' | 'erase') => {
  mobileTool.value = tool
  canvasRef.value?.setTool(tool)
}

const handleMobileBrushColor = (event: Event) => {
  const color = (event.target as HTMLInputElement).value
  mobileBrushColor.value = color
  canvasRef.value?.selectPaletteColor(color)
}

const setMobileBrushType = (type: MobileBrushType) => {
  mobileBrushType.value = type
  canvasRef.value?.setBrushType(type)
}

const handleMobileBrushWidth = (event: Event) => {
  const width = Number((event.target as HTMLInputElement).value)
  if (mobileTool.value === 'erase') {
    mobileEraserWidth.value = width
    canvasRef.value?.setEraserWidth(width)
    return
  }
  mobileBrushWidth.value = width
  canvasRef.value?.setBrushWidth(width)
}

const handleMobileAddText = () => {
  if (!journalStore.activePage) return
  closeMobilePanel()
  mobileTool.value = 'select'
  canvasRef.value?.setTool('select')
  canvasRef.value?.addTextLayer()
}

const runMobileMore = (action: () => void | Promise<void>) => {
  closeMobilePanel()
  void action()
}

const openMobileReader = () => {
  closeMobilePanel()
  readerMode.value = true
}

const leaveMobileJournal = () => {
  closeMobilePanel()
  if (window.history.state?.back) router.back()
  else void router.push('/showcase?tab=barn')
}

const handleMobileBack = async () => {
  if (journalStore.dirty) {
    const saved = await journalStore.saveActivePage({ createVersion: false })
    if (!saved) {
      mobileExitSheet.value = true
      return
    }
  }
  leaveMobileJournal()
}

const handleJournalExitBlocked = () => {
  if (isMobile.value) mobileExitSheet.value = true
}

const retryMobileExit = async () => {
  exitSaving.value = true
  try {
    const saved = await journalStore.saveActivePage({ createVersion: false })
    if (!saved) return
    mobileExitSheet.value = false
    leaveMobileJournal()
  } finally {
    exitSaving.value = false
  }
}

const discardMobileExit = async () => {
  exitSaving.value = true
  try {
    const discarded = await journalStore.discardActivePageChanges()
    if (!discarded) {
      ElMessage.error(journalStore.error || '无法载入服务器版本，请稍后重试')
      return
    }
    mobileExitSheet.value = false
    leaveMobileJournal()
  } finally {
    exitSaving.value = false
  }
}

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

const positionJournalContextMenu = async (
  kind: 'book' | 'page',
  x: number,
  y: number,
) => {
  const request = ++contextMenuPositionRequest
  await nextTick()
  if (request !== contextMenuPositionRequest) return

  const menu = kind === 'book' ? bookContextMenuRef.value : pageContextMenuRef.value
  if (!menu) return
  const rect = menu.getBoundingClientRect()
  const position = getContextMenuPosition({
    x,
    y,
    menuWidth: rect.width,
    menuHeight: rect.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  })

  if (kind === 'book') {
    bookContextMenu.value.x = position.left
    bookContextMenu.value.y = position.top
    bookContextMenuPositioned.value = true
  } else {
    pageContextMenu.value.x = position.left
    pageContextMenu.value.y = position.top
    pageContextMenuPositioned.value = true
  }
}

const openBookContextMenu = (event: MouseEvent, bookId: string) => {
  closePageContextMenu()
  bookContextMenuPositioned.value = false
  bookContextMenu.value = {
    visible: true,
    bookId,
    x: event.clientX,
    y: event.clientY,
  }
  void positionJournalContextMenu('book', event.clientX, event.clientY)
}

const closeBookContextMenu = () => {
  contextMenuPositionRequest += 1
  bookContextMenu.value.visible = false
  bookContextMenuPositioned.value = false
}

const renameBookById = async (bookId: string) => {
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

const renameContextBook = async () => {
  const bookId = bookContextMenu.value.bookId
  closeBookContextMenu()
  await renameBookById(bookId)
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
  pageContextMenuPositioned.value = false
  pageContextMenu.value = {
    visible: true,
    pageId,
    x: event.clientX,
    y: event.clientY,
  }
  void positionJournalContextMenu('page', event.clientX, event.clientY)
}

const closePageContextMenu = () => {
  contextMenuPositionRequest += 1
  pageContextMenu.value.visible = false
  pageContextMenuPositioned.value = false
}

const closeContextMenus = () => {
  closeBookContextMenu()
  closePageContextMenu()
}

const confirmDeleteContextPage = async () => {
  const pageId = pageContextMenu.value.pageId
  await deletePage(pageId)
}

const renamePageById = async (pageId: string) => {
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

const renameContextPage = async () => {
  const pageId = pageContextMenu.value.pageId
  closePageContextMenu()
  await renamePageById(pageId)
}

const duplicatePageById = async (pageId: string) => {
  const duplicated = await journalStore.duplicatePage(pageId)
  if (duplicated) ElMessage.success('页面已复制')
}

const duplicateContextPage = async () => {
  const pageId = pageContextMenu.value.pageId
  closePageContextMenu()
  await duplicatePageById(pageId)
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

const moveMobilePage = async (direction: -1 | 1) => {
  const index = activePageIndex.value
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= journalStore.pages.length) return
  const ids = journalStore.pages.map(page => page.id)
  const [moved] = ids.splice(index, 1)
  if (!moved) return
  ids.splice(targetIndex, 0, moved)
  await journalStore.reorderPages(ids)
}

const handleContentUpdate = (content: JournalPageContent) => {
  journalStore.updateActivePageContent(content)
}

const canvasLayers = computed(() => canvasRef.value?.layers || [])
const selectedLayer = computed(() => canvasRef.value?.selectedLayer || null)
const selectedItem = computed(() => canvasRef.value?.selectedItem || null)
const selectedLayerIds = computed(() => canvasRef.value?.selectedLayerIds || [])
const selectedStickerItem = computed(() => (
  selectedItem.value?.type === 'sticker' ? selectedItem.value as JournalStickerItem : null
))
const selectedTextItem = computed(() => (
  selectedItem.value?.type === 'text' ? selectedItem.value as JournalTextItem : null
))
const selectedShapeItem = computed(() => (
  selectedItem.value?.type === 'shape' ? selectedItem.value as JournalShapeItem : null
))

const layerLabel = (layer: JournalLayer) => {
  if (layer.name) return layer.name
  if (layer.type === 'sticker') return '贴纸层'
  if (layer.type === 'text') return '文字层'
  if (layer.type === 'shape') return '形状层'
  return '画笔层'
}

const layerThumbImage = (layer: JournalLayer) => {
  const item = layer.items[0]
  return item?.type === 'sticker' ? item.src : null
}

const layerThumbText = (layer: JournalLayer) => {
  const item = layer.items[0]
  if (item?.type === 'text') return item.text.slice(0, 2) || '字'
  if (item?.type === 'stroke') return ''
  if (item?.type === 'shape') return item.shape_type === 'circle' ? '圆' : '形'
  return layer.type === 'draw' ? '画' : '贴'
}

const layerThumbStyle = (layer: JournalLayer) => {
  const item = layer.items.find(entry => entry.type === 'stroke')
  if (item?.type === 'stroke') {
    return { backgroundColor: item.stroke }
  }
  return {}
}

const layerSummary = (layer: JournalLayer) => {
  const item = layer.items[0]
  if (item?.type === 'text') return item.text.slice(0, 18) || '空文字'
  if (item?.type === 'sticker') return `${item.width} x ${item.height} · z ${layer.z_index}`
  if (item?.type === 'shape') return `${item.shape_type} · ${item.width} x ${item.height}`
  return `${layer.items.length} 笔 · z ${layer.z_index}`
}

const applySizePreset = (value: unknown) => {
  const presets: Record<SizePreset, { width: number; height: number }> = {
    journal: { width: 1080, height: 1440 },
    square: { width: 1200, height: 1200 },
    a4: { width: 1240, height: 1754 },
    phone: { width: 1080, height: 1920 },
  }
  const preset = presets[String(value) as SizePreset] || presets.journal
  journalStore.updateActivePageSettings(preset)
}

const applyPageTemplate = (value: unknown) => {
  const templates: Record<string, { background: string; background_style: BackgroundStyle }> = {
    'warm-dot': { background: '#fff7ed', background_style: 'dot' },
    'blue-grid': { background: '#eff6ff', background_style: 'grid' },
    'note-line': { background: '#fffaf0', background_style: 'note' },
  }
  const template = templates[String(value)]
  if (template) journalStore.updateActivePageSettings(template)
}

const updatePageBackgroundColor = (event: Event) => {
  journalStore.updateActivePageBackground({
    background: (event.target as HTMLInputElement).value,
  })
}

const updatePageBackgroundStyle = (value: unknown) => {
  const style = ['plain', 'dot', 'line', 'grid', 'note'].includes(String(value))
    ? String(value) as BackgroundStyle
    : 'plain'
  journalStore.updateActivePageBackground({
    background_style: style,
  })
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

const updateTextFontFamily = (value: unknown) => updateSelectedLayer({ font_family: String(value || 'sans-serif') })
const updateTextFontWeight = (value: unknown) => updateSelectedLayer({ font_weight: String(value || '400') })
const updateTextAlign = (value: unknown) => updateSelectedLayer({ align: String(value || 'left') })
const updateTextLineHeight = (value: unknown) => updateSelectedLayer({ line_height: toNumber(value, 1.25) })
const updateTextStroke = (event: Event) => updateSelectedLayer({ stroke: (event.target as HTMLInputElement).value })
const updateTextStrokeWidth = (value: unknown) => updateSelectedLayer({ stroke_width: toNumber(value, 0) })
const updateTextShadowEnabled = (event: Event) => updateSelectedLayer({
  shadow_enabled: (event.target as HTMLInputElement).checked,
})
const updateTextShadowColor = (event: Event) => updateSelectedLayer({ shadow_color: (event.target as HTMLInputElement).value })
const updateTextShadowBlur = (value: unknown) => updateSelectedLayer({ shadow_blur: toNumber(value, 0) })
const updateShapeWidth = (value: unknown) => updateSelectedLayer({ width: toNumber(value, 12) })
const updateShapeHeight = (value: unknown) => updateSelectedLayer({ height: toNumber(value, 12) })
const updateShapeFill = (event: Event) => updateSelectedLayer({ fill: (event.target as HTMLInputElement).value })
const updateShapeStroke = (event: Event) => updateSelectedLayer({ stroke: (event.target as HTMLInputElement).value })
const updateShapeStrokeWidth = (value: unknown) => updateSelectedLayer({ stroke_width: toNumber(value, 0) })

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
  closeMobilePanel()
}

const insertDecorSticker = (sticker: { id: string; name: string; src: string }) => {
  canvasRef.value?.addLocalSticker({ name: sticker.name, src: sticker.src, source: 'decor' })
  closeMobilePanel()
}

const insertLocalImage = (payload: { name: string; src: string }) => {
  canvasRef.value?.addLocalSticker({ name: payload.name, src: payload.src, source: 'upload' })
  closeMobilePanel()
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const dataUrlToImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = reject
  image.crossOrigin = 'anonymous'
  image.src = src
})

const downloadCurrentPage = async () => {
  const blob = await canvasRef.value?.exportPngBlob(exportScale.value)
  if (!blob) {
    ElMessage.warning('当前环境暂时无法导出画布')
    return
  }
  downloadBlob(blob, `journal-${journalStore.activePage?.title || 'page'}-${exportScale.value}x.png`)
}

const downloadShareImage = async () => {
  const dataUrl = await canvasRef.value?.exportPngDataUrl(exportScale.value)
  if (!dataUrl) {
    ElMessage.warning('当前环境暂时无法生成分享图')
    return
  }
  const image = await dataUrlToImage(dataUrl)
  const canvas = document.createElement('canvas')
  const padding = 72
  canvas.width = image.width + padding * 2
  canvas.height = image.height + padding * 2 + 84
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#fffaf0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, padding, padding)
  ctx.fillStyle = 'rgba(51, 51, 51, 0.72)'
  ctx.font = '28px sans-serif'
  ctx.fillText(journalStore.activeBook?.title || '我的手帐', padding, canvas.height - 52)
  ctx.font = '22px sans-serif'
  ctx.fillText('PickGoods Journal', padding, canvas.height - 22)
  canvas.toBlob(blob => {
    if (blob) downloadBlob(blob, `journal-share-${journalStore.activePage?.title || 'page'}.png`)
  }, 'image/png')
}

const downloadLongImage = async () => {
  const pageImages: string[] = []
  const currentDataUrl = await canvasRef.value?.exportPngDataUrl(1)
  for (const page of journalStore.pages) {
    if (page.id === journalStore.activePageId && currentDataUrl) {
      pageImages.push(currentDataUrl)
    } else if (page.preview_image) {
      pageImages.push(page.preview_image)
    }
  }
  if (pageImages.length === 0) {
    ElMessage.warning('请先为页面更新缩略图，或停留在当前页导出')
    return
  }
  const images = await Promise.all(pageImages.map(dataUrlToImage))
  const width = Math.max(...images.map(image => image.width))
  const gap = 32
  const height = images.reduce((sum, image) => sum + image.height, 0) + gap * Math.max(0, images.length - 1)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#fffaf0'
  ctx.fillRect(0, 0, width, height)
  let y = 0
  images.forEach(image => {
    ctx.drawImage(image, Math.round((width - image.width) / 2), y)
    y += image.height + gap
  })
  canvas.toBlob(blob => {
    if (blob) downloadBlob(blob, `journal-book-${journalStore.activeBook?.title || 'pages'}.png`)
  }, 'image/png')
}

const handleCoverUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !journalStore.activeBook) return
  await journalStore.uploadBookCover(journalStore.activeBook.id, file)
  ;(event.target as HTMLInputElement).value = ''
  ElMessage.success('封面已更新')
}

const createPublicShare = async () => {
  const share = await journalStore.createPublicShare()
  if (!share) return
  await navigator.clipboard?.writeText(share.url || `${location.origin}/api/journal-public/${share.token}/`)
  ElMessage.success('公开只读链接已复制')
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
      journalStore.saveActivePage({ createVersion: false }).then(saved => {
        if (!saved && journalStore.error) ElMessage.error(`${journalStore.error}，稍后会继续重试`)
      })
      autoSaveTimer = null
    }, 1200)
  },
  { deep: true },
)

watch(
  () => journalStore.revisionConflict,
  async (conflict) => {
    if (!conflict) return
    try {
      await ElMessageBox.confirm('页面已在别处更新，刷新后会载入服务器上的最新版本。', '保存冲突', {
        confirmButtonText: '刷新页面',
        cancelButtonText: '稍后处理',
        type: 'warning',
      })
      await journalStore.fetchPageDetail(conflict.pageId)
      journalStore.clearRevisionConflict()
      ElMessage.success('已刷新到最新版本')
    } catch {
      journalStore.clearRevisionConflict()
    }
  },
)

watch(
  () => journalStore.activePageId,
  (pageId) => {
    const index = journalStore.pages.findIndex(page => page.id === pageId)
    if (index >= 0) readerIndex.value = index
  },
)

// 响应云展柜页面的「刷新」事件：保留当前选中页与未保存内容，仅重载当前页与版本列表。
// 完成后派发 journal-refresh-complete，由云展柜页驱动 Layout 关闭刷新态。
const handleJournalRefresh = async () => {
  try {
    if (journalStore.dirty) {
      const saved = await journalStore.saveActivePage({ createVersion: false })
      // 保存失败（如 409 冲突）时中止刷新，避免用服务端版本覆盖本地未保存内容
      if (!saved) return
    }
    const pageId = journalStore.activePageId
    if (!pageId) {
      await journalStore.fetchBooks()
      return
    }
    try {
      await journalStore.fetchPageDetail(pageId)
      await journalStore.fetchVersions(pageId)
    } catch {
      // 当前页可能已被删除，退化为整本刷新
      await journalStore.fetchBooks()
    }
  } finally {
    // 通知云展柜页刷新完成（驱动 Layout 关闭刷新态）
    window.dispatchEvent(new CustomEvent('cloud-showcase:journal-refresh-complete'))
  }
}

onMounted(() => {
  journalStore.fetchBooks()
  window.addEventListener('click', closeContextMenus)
  window.addEventListener('scroll', closeContextMenus, true)
  window.addEventListener('resize', closeContextMenus)
  window.addEventListener('cloud-showcase:journal-refresh', handleJournalRefresh)
  window.addEventListener('cloud-showcase:journal-exit-blocked', handleJournalExitBlocked)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeContextMenus)
  window.removeEventListener('scroll', closeContextMenus, true)
  window.removeEventListener('resize', closeContextMenus)
  window.removeEventListener('cloud-showcase:journal-refresh', handleJournalRefresh)
  window.removeEventListener('cloud-showcase:journal-exit-blocked', handleJournalExitBlocked)
  if (autoSaveTimer !== null) {
    window.clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
})
</script>

<style scoped>
.journal-workspace {
  --journal-panel-border: rgba(148, 163, 184, 0.18);
  --journal-soft-border: rgba(148, 163, 184, 0.16);
  --journal-paper: rgba(255, 255, 255, 0.9);
  --journal-accent-soft: rgba(212, 175, 55, 0.1);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sr-only-input {
  position: fixed;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.export-scale-select {
  width: 78px;
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  color: var(--text-light);
  font-size: 13px;
}

.journal-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #94a3b8;
}

.journal-status.is-saved .journal-status-dot {
  background: #22c55e;
}

.journal-status.is-dirty .journal-status-dot {
  background: #f59e0b;
}

.journal-status.is-saving .journal-status-dot {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(142, 125, 255, 0.24);
  border-top-color: #8e7dff;
  background: transparent;
  animation: journal-status-spin 0.8s linear infinite;
}

@keyframes journal-status-spin {
  to {
    transform: rotate(360deg);
  }
}

.journal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.journal-create-btn {
  flex-shrink: 0;
}

.journal-create-btn--hero {
  margin-top: 8px;
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
  border: 1px solid var(--journal-panel-border);
  border-radius: 8px;
  background: var(--journal-paper);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
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

.book-row {
  position: relative;
  padding-left: 54px;
}

.book-cover-thumb {
  position: absolute;
  left: 8px;
  top: 7px;
  width: 34px;
  height: 34px;
  border-radius: 7px;
  object-fit: cover;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.book-cover-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-gold-dark);
  font-size: 12px;
  font-weight: 700;
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

.layer-row {
  min-height: 52px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
}

.layer-thumb {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: #f8fafc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-light);
  font-size: 12px;
  overflow: hidden;
}

.layer-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.layer-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.layer-inline-actions {
  display: inline-flex;
  gap: 6px;
}

.layer-inline-actions button {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  background: #fff;
  color: var(--text-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}

.layer-inline-actions button:hover {
  border-color: rgba(212, 175, 55, 0.45);
  background: rgba(212, 175, 55, 0.08);
  color: var(--primary-gold-dark);
}

.background-settings {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.multi-align-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
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

.segmented-inline {
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.segmented-inline button {
  min-width: 0;
  height: 26px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  background: #fff;
  color: var(--text-light);
  cursor: pointer;
}

.segmented-inline button.is-active {
  border-color: rgba(212, 175, 55, 0.58);
  background: var(--journal-accent-soft);
  color: var(--primary-gold-dark);
  font-weight: 700;
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
  max-width: calc(100vw - 16px);
  box-sizing: border-box;
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.journal-loading {
  display: block;
  padding: 24px;
}

.journal-empty-illustration {
  width: 148px;
  height: 108px;
  position: relative;
  margin-bottom: -12px;
}

.journal-empty-illustration span,
.journal-empty-illustration i {
  position: absolute;
  display: block;
  border: 2px solid rgba(212, 175, 55, 0.48);
  background: #fff7ed;
}

.journal-empty-illustration span {
  left: 14px;
  top: 14px;
  width: 92px;
  height: 70px;
  border-radius: 8px;
  transform: rotate(-7deg);
}

.journal-empty-illustration i {
  right: 12px;
  top: 24px;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: #e0f2fe;
}

.reader-overlay {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: grid;
  grid-template-columns: auto minmax(240px, 780px) auto;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 40px;
  background: rgba(15, 23, 42, 0.78);
}

.reader-close {
  position: fixed;
  top: 18px;
  right: 18px;
}

.reader-close,
.reader-nav {
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  padding: 10px 14px;
  cursor: pointer;
}

.reader-nav:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.reader-page {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  color: #fff;
}

.reader-page img,
.reader-placeholder {
  max-width: min(72vw, 760px);
  max-height: 78vh;
  border-radius: 8px;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.34);
}

.reader-placeholder {
  width: min(72vw, 520px);
  aspect-ratio: 3 / 4;
  display: grid;
  place-items: center;
  color: var(--text-light);
}

@media (max-width: 1100px) {
  .journal-layout {
    grid-template-columns: 200px minmax(0, 1fr);
  }

  .journal-side-panel {
    grid-column: 1 / -1;
  }
}

.journal-workspace--mobile {
  --journal-mobile-dock-height: calc(68px + env(safe-area-inset-bottom, 0px));
  position: fixed;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-gray);
}

.journal-workspace--mobile.has-mobile-context {
  --journal-mobile-dock-height: calc(116px + env(safe-area-inset-bottom, 0px));
}

.journal-mobile-header {
  position: relative;
  z-index: 20;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  min-height: calc(56px + var(--app-safe-area-top, env(safe-area-inset-top, 0px)));
  padding: var(--app-safe-area-top, env(safe-area-inset-top, 0px)) 8px 0;
  border-bottom: 1px solid rgba(212, 175, 55, 0.16);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 1px 0 rgba(148, 163, 184, 0.08);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.journal-mobile-icon-btn,
.journal-mobile-save-btn,
.journal-mobile-page-switch {
  border: 0;
  background: transparent;
  color: var(--text-dark);
  -webkit-tap-highlight-color: transparent;
}

.journal-mobile-icon-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.journal-mobile-icon-btn:active:not(:disabled),
.journal-mobile-save-btn:active:not(:disabled) {
  background: rgba(212, 175, 55, 0.12);
}

.journal-mobile-icon-btn:disabled,
.journal-mobile-save-btn:disabled {
  opacity: 0.36;
}

.journal-mobile-page-switch {
  min-width: 0;
  min-height: 48px;
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  text-align: left;
}

.journal-mobile-page-switch strong,
.journal-mobile-page-switch span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.journal-mobile-page-switch strong {
  font-size: 15px;
}

.journal-mobile-page-switch span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-light);
  font-size: 11px;
}

.journal-mobile-page-switch .journal-status-dot.is-saved {
  background: #22c55e;
}

.journal-mobile-page-switch .journal-status-dot.is-dirty {
  background: #f59e0b;
}

.journal-mobile-page-switch .journal-status-dot.is-saving {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(142, 125, 255, 0.24);
  border-top-color: #8e7dff;
  background: transparent;
  animation: journal-status-spin 0.8s linear infinite;
}

.journal-mobile-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.journal-mobile-save-btn {
  min-width: 54px;
  height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--primary-gold), var(--primary-gold-dark));
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 6px 16px rgba(212, 175, 55, 0.22);
}

.journal-layout {
  flex: 1;
  min-height: 0;
  display: block;
  padding: 0 0 var(--journal-mobile-dock-height);
}

.journal-workspace--mobile .journal-editor {
  height: 100%;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.journal-workspace--mobile .journal-loading,
.journal-workspace--mobile .journal-empty {
  height: 100%;
  min-height: 0;
}

.journal-workspace--mobile .journal-error {
  position: absolute;
  top: calc(60px + var(--app-safe-area-top, env(safe-area-inset-top, 0px)));
  left: 8px;
  right: 8px;
  z-index: 30;
}

.journal-mobile-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2100;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 -8px 28px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.journal-mobile-toolbar {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 2px;
  min-height: 64px;
  padding: 5px 6px calc(5px + env(safe-area-inset-bottom, 0px));
}

.journal-mobile-toolbar button {
  min-width: 0;
  min-height: 52px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--text-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 11px;
  -webkit-tap-highlight-color: transparent;
}

.journal-mobile-toolbar button .el-icon {
  font-size: 21px;
}

.journal-mobile-toolbar button.is-active {
  color: var(--primary-gold-dark);
  background: rgba(212, 175, 55, 0.12);
  font-weight: 800;
}

.journal-mobile-toolbar button:disabled {
  opacity: 0.32;
}

.journal-mobile-brush-context {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  overflow-x: auto;
}

.journal-mobile-color-control,
.journal-mobile-width-control {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-light);
  font-size: 12px;
}

.journal-mobile-color-control input {
  width: 38px;
  height: 34px;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  background: transparent;
}

.journal-mobile-width-control input {
  width: 92px;
}

.journal-mobile-width-control strong {
  min-width: 34px;
  color: var(--text-dark);
  font-size: 11px;
}

.journal-mobile-brush-presets {
  display: inline-flex;
  gap: 5px;
}

.journal-mobile-brush-presets button {
  min-width: 48px;
  min-height: 34px;
  padding: 0 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  background: #fff;
  color: var(--text-light);
  font-size: 11px;
  white-space: nowrap;
}

.journal-mobile-brush-presets button.is-active {
  border-color: rgba(212, 175, 55, 0.52);
  color: var(--primary-gold-dark);
  background: rgba(212, 175, 55, 0.1);
  font-weight: 800;
}

.journal-mobile-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2200;
  border: 0;
  background: rgba(15, 23, 42, 0.26);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.journal-workspace--mobile .journal-sidebar,
.journal-workspace--mobile .journal-side-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2300;
  width: 100%;
  max-height: min(82dvh, 720px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 14px calc(18px + env(safe-area-inset-bottom, 0px));
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-bottom: 0;
  border-radius: 20px 20px 0 0;
  background: rgba(255, 255, 255, 0.99);
  box-shadow: 0 -18px 44px rgba(15, 23, 42, 0.18);
  transform: translateY(105%);
  visibility: hidden;
  pointer-events: none;
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.24s;
}

.journal-workspace--mobile .journal-side-panel {
  max-height: min(90dvh, 780px);
}

.journal-workspace--mobile .journal-sidebar.is-mobile-open,
.journal-workspace--mobile .journal-side-panel.is-mobile-open {
  transform: translateY(0);
  visibility: visible;
  pointer-events: auto;
}

.journal-mobile-sheet-handle {
  width: 38px;
  height: 4px;
  margin: 2px auto 10px;
  border-radius: 999px;
  background: rgba(51, 51, 51, 0.14);
}

.journal-mobile-sheet-heading {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 0 12px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.14);
  background: rgba(255, 255, 255, 0.98);
}

.journal-mobile-sheet-heading > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.journal-mobile-sheet-heading strong {
  font-size: 18px;
}

.journal-mobile-sheet-heading small {
  color: var(--text-light);
  font-size: 12px;
}

.journal-mobile-sheet-close {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 50%;
  background: #fff;
  color: var(--text-light);
  display: inline-grid;
  place-items: center;
}

.journal-workspace--mobile .journal-sidebar .sidebar-section:first-of-type,
.journal-workspace--mobile .journal-sidebar .sidebar-section:nth-of-type(2) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.journal-workspace--mobile .journal-sidebar .sidebar-section:nth-of-type(2) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.journal-workspace--mobile .journal-sidebar .sidebar-title,
.journal-workspace--mobile .journal-sidebar .empty-mini {
  grid-column: 1 / -1;
}

.journal-workspace--mobile .book-row {
  min-height: 58px;
}

.journal-workspace--mobile .delete-book-btn {
  display: none;
}

.journal-workspace--mobile .page-row {
  min-height: 132px;
  padding: 76px 7px 7px;
  justify-content: flex-end;
  gap: 3px;
  text-align: center;
}

.journal-workspace--mobile .page-thumb {
  left: 50%;
  top: 7px;
  width: calc(100% - 14px);
  height: 64px;
  transform: translateX(-50%);
  border-radius: 9px;
}

.journal-workspace--mobile .page-row span,
.journal-workspace--mobile .page-row small {
  width: 100%;
  text-align: center;
}

.journal-workspace--mobile .page-row small {
  font-size: 10px;
}

.journal-mobile-page-actions {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.journal-mobile-action-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.journal-mobile-action-group > strong {
  font-size: 13px;
}

.journal-mobile-action-group > div {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.journal-mobile-action-group :deep(.el-button) {
  min-height: 40px;
  margin-left: 0 !important;
}

.journal-workspace--mobile .journal-side-panel :deep(.el-tabs__header) {
  position: sticky;
  top: 72px;
  z-index: 3;
  margin: 0 0 14px;
  padding-top: 4px;
  background: rgba(255, 255, 255, 0.98);
}

.journal-workspace--mobile .journal-side-panel :deep(.el-tabs__item) {
  min-height: 44px;
  font-size: 14px;
}

.journal-workspace--mobile .panel-section {
  gap: 14px;
}

.journal-workspace--mobile .control-row {
  grid-template-columns: 68px minmax(0, 1fr);
  min-height: 44px;
  font-size: 13px;
}

.journal-workspace--mobile .control-row :deep(.el-input-number),
.journal-workspace--mobile .control-row :deep(.el-select) {
  width: 100%;
}

.journal-workspace--mobile .layer-row {
  min-height: 58px;
}

.journal-workspace--mobile .layer-inline-actions button {
  width: 44px;
  height: 44px;
}

.journal-workspace--mobile .segmented-inline button {
  min-height: 40px;
}

.journal-workspace--mobile .version-list {
  max-height: none;
}

.journal-mobile-more {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.journal-mobile-more-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.journal-mobile-more-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.journal-mobile-more-title > strong {
  font-size: 14px;
}

.journal-mobile-segmented {
  display: inline-grid;
  grid-template-columns: repeat(3, 48px);
  gap: 4px;
  padding: 3px;
  border-radius: 12px;
  background: var(--secondary-gray);
}

.journal-mobile-segmented button {
  min-height: 34px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-light);
  font-size: 12px;
}

.journal-mobile-segmented button.is-active {
  color: var(--primary-gold-dark);
  background: #fff;
  font-weight: 800;
  box-shadow: var(--shadow-sm);
}

.journal-mobile-more-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.journal-mobile-more-grid button,
.journal-mobile-more-list button {
  min-height: 52px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 14px;
  background: #fff;
  color: var(--text-dark);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 0 14px;
  text-align: left;
}

.journal-mobile-more-grid button .el-icon,
.journal-mobile-more-list button .el-icon {
  color: var(--primary-gold-dark);
  font-size: 19px;
}

.journal-mobile-more-grid button:disabled,
.journal-mobile-more-list button:disabled {
  opacity: 0.38;
}

.journal-mobile-more-list {
  display: grid;
  gap: 8px;
}

.journal-mobile-exit {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.journal-mobile-exit p {
  margin: 0 0 4px;
  color: var(--text-light);
  font-size: 13px;
  line-height: 1.6;
}

.journal-mobile-exit :deep(.el-button) {
  min-height: 46px;
  margin-left: 0;
  border-radius: 12px;
}

.journal-workspace--mobile .reader-overlay {
  position: fixed;
  inset: 0;
  z-index: 2600;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 10px;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 14px calc(14px + env(safe-area-inset-bottom, 0px));
}

.journal-workspace--mobile .reader-close {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top, 0px));
  right: 14px;
}

.journal-workspace--mobile .reader-page {
  grid-column: 1 / -1;
  grid-row: 1;
  min-height: 0;
  padding-top: 48px;
}

.journal-workspace--mobile .reader-page img,
.journal-workspace--mobile .reader-placeholder {
  max-width: 100%;
  max-height: 68dvh;
}

.journal-workspace--mobile .reader-nav {
  min-height: 46px;
}

.journal-workspace--mobile .reader-nav--prev {
  grid-column: 1;
  grid-row: 2;
}

.journal-workspace--mobile .reader-nav--next {
  grid-column: 2;
  grid-row: 2;
}

@media (prefers-reduced-motion: reduce) {
  .journal-workspace--mobile .journal-sidebar,
  .journal-workspace--mobile .journal-side-panel {
    transition: none;
  }
}
</style>
