<template>
  <div class="showcase-manager">
    <!-- 背景装饰 -->
    <div class="bg-decoration"></div>

    <div class="layout single-page">
      <!-- 列表 / 详情页切换过渡 -->
      <Transition name="detail-fade" mode="out-in">
        <!-- 列表页 -->
        <div v-if="viewMode === 'list'" key="list" class="panel-container full-panel">
          <el-card shadow="never" class="glass-card adaptive-card">
            <template #header>
              <div class="panel-header">
                <div class="header-left">
                  <div class="panel-title">
                    <el-icon><Collection /></el-icon>
                  </div>
                  <el-radio-group v-model="showcaseStore.scope" size="small" @change="handleScopeChange" class="scope-switch">
                    <el-radio-button label="private">我的展柜</el-radio-button>
                    <el-radio-button label="public">公共展柜</el-radio-button>
                  </el-radio-group>
                </div>
                <el-button
                  data-test="showcase-create-button"
                  :style="{ visibility: showcaseStore.scope === 'private' ? 'visible' : 'hidden' }"
                  type="primary"
                  class="brand-add-btn brand-add-btn--compact showcase-create-btn"
                  @click="openCreateShowcase"
                >
                  <span class="brand-add-btn__content showcase-create-btn__content">
                    <el-icon class="showcase-create-btn__icon"><Plus /></el-icon>
                    <span class="showcase-create-btn__label">新增展柜</span>
                  </span>
                </el-button>
              </div>
            </template>

            <div class="scroll-content">
              <ShowcaseListView
                :showcases="showcaseStore.list"
                :loading="showcaseStore.listLoading"
                :error="showcaseStore.error"
                :pagination="{
                  total: showcaseStore.pagination.count,
                  page: showcaseStore.pagination.page,
                  pageSize: showcaseStore.pagination.page_size,
                }"
                :get-preview-photos="showcaseStore.getPreviewPhotos"
                :is-preview-loading="showcaseStore.isPreviewLoading"
                :enable-watermark="isReadonly"
                @select="handleEnterShowcaseDetail"
                @context-menu="openShowcaseContextMenu"
                @page-change="handleListPageChange"
              />
            </div>
          </el-card>
        </div>

        <!-- 详情页 -->
        <div v-else key="detail" class="showcase-detail-stage">
          <ShowcaseDetailView
            :loading="showcaseStore.detailLoading"
            :showcase="showcaseStore.activeShowcase"
            :goods="showcaseStore.sortedShowcaseGoods"
            :readonly="isReadonly"
            @back="backToList"
            @add-goods="openAddGoods"
            @edit-showcase="openEditShowcase"
            @delete-showcase="handleDeleteShowcase"
            @open-goods="handleOpenGoodsDetail"
            @goods-context-menu="openGoodsContextMenu"
            @goods-context-menu-from-dom="openGoodsContextMenuFromDom"
          />
        </div>
      </Transition>
    </div>

    <!-- 右键菜单（谷子/展柜共用遮罩） -->
    <div v-if="contextMenu.visible" class="context-menu-overlay" @click="closeContextMenu" @contextmenu.prevent>
      <div
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
        @contextmenu.prevent
      >
        <!-- 谷子卡片右键菜单 -->
        <template v-if="contextMenu.type === 'goods'">
          <div class="context-menu-item" :class="{ 'is-disabled': isFirst(contextMenu.goodsId!) }" @click="ctxMoveUp">
            <el-icon class="context-menu-icon"><Top /></el-icon>
            上移
          </div>
          <div class="context-menu-item" :class="{ 'is-disabled': isLast(contextMenu.goodsId!) }" @click="ctxMoveDown">
            <el-icon class="context-menu-icon"><Bottom /></el-icon>
            下移
          </div>
          <div class="context-menu-item context-menu-item-danger" @click="ctxRemoveFromShowcase">
            <el-icon class="context-menu-icon"><Delete /></el-icon>
            移除
          </div>
        </template>

        <!-- 左侧展柜右键菜单 -->
        <template v-else-if="contextMenu.type === 'showcase'">
          <div class="context-menu-item" @click="ctxEditShowcase">
            <el-icon class="context-menu-icon"><Edit /></el-icon>
            编辑
          </div>
          <div class="context-menu-item context-menu-item-danger" @click="ctxDeleteShowcase">
            <el-icon class="context-menu-icon"><Delete /></el-icon>
            删除
          </div>
        </template>
      </div>
    </div>

    <GoodsDrawer v-model="goodsDrawerVisible" :goods-id="selectedGoodsId" />

    <ShowcaseAddGoodsDialog
      v-model="addDialogVisible"
      :existing-goods-ids="existingShowcaseGoodsIds"
      :mutating="showcaseStore.mutating"
      @add="handleAddToShowcase"
      @open-detail="openGoodsDetailFromAdd"
    />

    <el-dialog
      v-model="showcaseDialogVisible"
      width="min(92vw, 560px)"
      class="custom-dialog showcase-dialog"
      align-center
    >
      <template #header>
        <div class="showcase-dialog-header">
          <span class="showcase-dialog-kicker">{{ showcaseDialogMode === 'create' ? 'Curate Showcase' : 'Refine Showcase' }}</span>
          <h3 class="showcase-dialog-title">{{ showcaseDialogTitle }}</h3>
          <p class="showcase-dialog-subtitle">
            {{ showcaseDialogMode === 'create' ? '用一个更完整的名字、描述和封面，为你的展柜定下第一眼印象。' : '微调名称、描述和封面，让这个展柜更贴近你现在的收藏氛围。' }}
          </p>
        </div>
      </template>
      <el-form :model="showcaseForm" label-position="top" class="showcase-dialog-form">
        <section class="showcase-form-section showcase-form-section--primary">
          <el-form-item label="展柜名称">
            <el-input v-model="showcaseForm.name" maxlength="200" show-word-limit placeholder="给你的痛柜起个名字" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="showcaseForm.description" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="写点什么..." />
          </el-form-item>
        </section>

        <section class="showcase-form-section showcase-form-section--secondary">
          <el-form-item label="封面图片（可选）">
            <div class="showcase-cover-field">
              <el-upload
                v-model:file-list="showcaseCoverFileList"
                list-type="picture-card"
                :auto-upload="false"
                :limit="1"
                :on-change="handleCoverChange"
                :on-remove="handleCoverRemove"
                :http-request="dummyUpload"
                accept="image/*"
                :class="{ 'hide-upload-trigger': showcaseCoverFileList.length >= 1 }"
              >
                <el-icon><Plus /></el-icon>
              </el-upload>
              <div class="cover-tip">建议使用 1:1 或 4:3 比例图片</div>
            </div>
          </el-form-item>
        </section>

        <section class="showcase-form-section showcase-form-section--settings">
          <div class="showcase-visibility-row">
            <div class="showcase-visibility-copy">
              <span class="showcase-visibility-title">是否公开</span>
              <span class="showcase-visibility-desc">公开后，其他人可以在公共展柜中看到这个展柜。</span>
            </div>
            <el-switch v-model="showcaseForm.is_public" active-color="#A29BFE" />
          </div>
        </section>
      </el-form>
      <template #footer>
        <div class="showcase-dialog-footer">
          <el-button class="showcase-dialog-cancel" @click="showcaseDialogVisible = false">取消</el-button>
          <el-button type="primary" class="showcase-dialog-submit btn-accent" :loading="showcaseStore.mutating" @click="submitShowcase">
            保存
          </el-button>
        </div>
      </template>
    </el-dialog>


  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type UploadFile } from 'element-plus'
import {
  Plus,
  Delete,
  Edit,
  Top,
  Bottom,
  Collection,
} from '@element-plus/icons-vue'
import GoodsDrawer from '@/components/GoodsDrawer.vue'
import ShowcaseAddGoodsDialog from '@/components/showcase/ShowcaseAddGoodsDialog.vue'
import ShowcaseListView from '@/components/showcase/ShowcaseListView.vue'
import ShowcaseDetailView from '@/components/showcase/ShowcaseDetailView.vue'
import { useShowcaseStore } from '@/stores/showcase'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { uploadShowcaseCoverImage } from '@/api/showcase'
import type { GoodsListItem } from '@/api/types'

const { isMobile } = useResponsiveDevice()

const showcaseStore = useShowcaseStore()
const viewMode = ref<'list' | 'detail'>('list')

const isReadonly = computed(() => showcaseStore.scope === 'public')

const showCurrentPage = computed({
  get: () => showcaseStore.pagination.page,
  set: (val) => {
    showcaseStore.fetchList({ page: val, page_size: showcaseStore.pagination.page_size })
  },
})
const showcaseCurrentPage = showCurrentPage
const handleListPageChange = (page: number) => {
  // computed ref 在 template 里有自动解包，但这里显式写，避免歧义
  showcaseCurrentPage.value = page
}

const handleScopeChange = async () => {
  showcaseStore.pagination.page = 1
  showcaseStore.error = null
  showcaseStore.activeShowcaseId = null
  showcaseStore.activeShowcase = null
  await showcaseStore.fetchList({ page: 1 })
}

const backToList = async () => {
  // 先清空当前选中的展柜
  showcaseStore.activeShowcaseId = null
  showcaseStore.activeShowcase = null
  // 返回「我的展柜」列表时，强制刷新一次列表数据
  await showcaseStore.fetchList({
    page: showcaseStore.pagination.page,
    page_size: showcaseStore.pagination.page_size,
  })
  viewMode.value = 'list'
}

const goodsDrawerVisible = ref(false)
const selectedGoodsId = ref<string>('')
const handleOpenGoodsDetail = (goods: GoodsListItem) => {
  if (isReadonly.value) return
  selectedGoodsId.value = goods.id
  goodsDrawerVisible.value = true
}
const openGoodsDetailFromAdd = (id: string) => {
  selectedGoodsId.value = id
  goodsDrawerVisible.value = true
}

const contextMenu = reactive<{
  visible: boolean
  type: 'goods' | 'showcase' | null
  x: number
  y: number
  goodsId: string | null
  showcaseId: string | null
}>({
  visible: false,
  type: null,
  x: 0,
  y: 0,
  goodsId: null,
  showcaseId: null,
})

const clampMenuPosition = (x: number, y: number) => {
  // 估一个菜单尺寸，避免贴边溢出（不要求精确）
  const w = 180
  const h = 140
  const maxX = Math.max(8, window.innerWidth - w - 8)
  const maxY = Math.max(8, window.innerHeight - h - 8)
  return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) }
}

const closeContextMenu = () => {
  contextMenu.visible = false
  contextMenu.type = null
  contextMenu.goodsId = null
  contextMenu.showcaseId = null
}

const openGoodsContextMenu = (payload: { goods: GoodsListItem; x: number; y: number }) => {
  if (isReadonly.value) return
  const pos = clampMenuPosition(payload.x, payload.y)
  contextMenu.visible = true
  contextMenu.type = 'goods'
  contextMenu.x = pos.x
  contextMenu.y = pos.y
  contextMenu.goodsId = payload.goods.id
  contextMenu.showcaseId = null
}

const openGoodsContextMenuFromDom = (goodsId: string, event: MouseEvent) => {
  if (isReadonly.value) return
  const pos = clampMenuPosition(event.clientX, event.clientY)
  contextMenu.visible = true
  contextMenu.type = 'goods'
  contextMenu.x = pos.x
  contextMenu.y = pos.y
  contextMenu.goodsId = goodsId
  contextMenu.showcaseId = null
}

const openShowcaseContextMenu = (showcaseId: string, event: MouseEvent) => {
  if (isReadonly.value) return
  const pos = clampMenuPosition(event.clientX, event.clientY)
  contextMenu.visible = true
  contextMenu.type = 'showcase'
  contextMenu.x = pos.x
  contextMenu.y = pos.y
  contextMenu.showcaseId = showcaseId
  contextMenu.goodsId = null
}

const showcaseDialogVisible = ref(false)
const showcaseDialogMode = ref<'create' | 'edit'>('create')
const showcaseForm = reactive<{ id?: string; name: string; description: string; is_public: boolean }>({
  name: '',
  description: '',
  is_public: true,
})
const showcaseDialogTitle = computed(() => (showcaseDialogMode.value === 'create' ? '新建展柜' : '编辑展柜'))

// 展柜封面本地状态
const showcaseCoverFile = ref<File | null>(null)
const showcaseCoverFileList = ref<UploadFile[]>([])

const resetShowcaseCoverState = () => {
  showcaseCoverFile.value = null
  showcaseCoverFileList.value = []
}

const dummyUpload = () => Promise.resolve()

const handleCoverChange = (file: UploadFile) => {
  if (file.raw) {
    showcaseCoverFile.value = file.raw
    // 仅保留一条记录，使用当前选择的文件作为预览
    showcaseCoverFileList.value = [
      {
        name: file.name || 'cover_image',
        url: file.url,
        status: 'success',
      } as UploadFile,
    ]
  } else {
    showcaseCoverFile.value = null
    showcaseCoverFileList.value = []
  }
}

const handleCoverRemove = () => {
  showcaseCoverFile.value = null
  showcaseCoverFileList.value = []
}

const openCreateShowcase = () => {
  showcaseDialogMode.value = 'create'
  Object.assign(showcaseForm, { id: undefined, name: '', description: '', is_public: true })
  showcaseDialogVisible.value = true
  resetShowcaseCoverState()
}
const openEditShowcase = () => {
  if (!showcaseStore.activeShowcase) return
  showcaseDialogMode.value = 'edit'
  const { id, name, description, is_public } = showcaseStore.activeShowcase
  Object.assign(showcaseForm, { id, name, description: description || '', is_public: is_public ?? true })
  showcaseDialogVisible.value = true
  // 预填现有封面预览（不把远端封面当作待上传文件，仅做展示）
  if (showcaseStore.activeShowcase.cover_image) {
    showcaseCoverFile.value = null
    showcaseCoverFileList.value = [
      {
        name: 'current_cover',
        url: showcaseStore.activeShowcase.cover_image,
        status: 'success',
      } as UploadFile,
    ]
  } else {
    resetShowcaseCoverState()
  }
}

const submitShowcase = async () => {
  if (!showcaseForm.name.trim()) return ElMessage.warning('请输入展柜名称')
  const payload = {
    name: showcaseForm.name.trim(),
    description: showcaseForm.description?.trim() || null,
    is_public: showcaseForm.is_public,
  }
  let success = false
  let targetId: string | undefined
  if (showcaseDialogMode.value === 'create') {
    const created = await showcaseStore.createOne(payload)
    success = !!created
    if (created) {
      targetId = created.id
    }
  } else {
    if (showcaseForm.id) {
      const updated = await showcaseStore.updateOne(showcaseForm.id, payload)
      success = !!updated
      if (updated) {
        targetId = updated.id
      }
    }
  }
  if (success) {
    // 如有选择新的封面文件，调用封面上传 / 更新接口
    if (targetId && showcaseCoverFile.value) {
      try {
        await uploadShowcaseCoverImage(targetId, showcaseCoverFile.value)
        // 上传封面后刷新当前展柜详情和列表，保证左侧缩略图与详情封面同步
        await Promise.all([
          showcaseStore.fetchDetail(targetId),
          showcaseStore.fetchList({ page: showcaseStore.pagination.page, page_size: showcaseStore.pagination.page_size }),
        ])
      } catch (err: any) {
        ElMessage.error('封面上传失败：' + (err?.message || '未知错误'))
      }
    }
    ElMessage.success(showcaseDialogMode.value === 'create' ? '展柜已创建' : '展柜已更新')
    showcaseDialogVisible.value = false
    // 提交完成后清理本地封面选择状态
    resetShowcaseCoverState()
  }
}

const handleDeleteShowcase = async () => {
  if (!showcaseStore.activeShowcaseId) return
  try {
    await ElMessageBox.confirm('确认删除该展柜吗？里面的谷子不会被删除，仅解除关联。', '删除警告', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
    })
    const ok = await showcaseStore.removeOne(showcaseStore.activeShowcaseId)
    if (ok) {
      ElMessage.success('已删除')
      if (isMobile.value) backToList()
    }
  } catch {
    /* ignore */
  }
}

const handleDeleteShowcaseById = async (id: string) => {
  try {
    await ElMessageBox.confirm('确认删除该展柜吗？里面的谷子不会被删除，仅解除关联。', '删除警告', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
    })
    const ok = await showcaseStore.removeOne(id)
    if (ok) {
      ElMessage.success('已删除')
      if (isMobile.value) backToList()
    }
  } catch {
    /* ignore */
  }
}

const handleSelectShowcase = async (id: string) => {
  await showcaseStore.setActive(id)
}

const handleEnterShowcaseDetail = async (id: string) => {
  await handleSelectShowcase(id)
  viewMode.value = 'detail'
}

const addDialogVisible = ref(false)
const recentlyAddedGoodsIds = ref<Set<string>>(new Set())
const existingShowcaseGoodsIds = computed(() => [
  ...new Set([
    ...showcaseStore.sortedShowcaseGoods.map((item) => item.goods.id),
    ...recentlyAddedGoodsIds.value,
  ]),
])

const openAddGoods = () => {
  recentlyAddedGoodsIds.value = new Set()
  addDialogVisible.value = true
}

const handleAddToShowcase = async (goodsId: string) => {
  const showcaseId = showcaseStore.activeShowcaseId
  if (!showcaseId) return
  const created = await showcaseStore.addGoods({ showcaseId, goodsId })
  if (created) {
    const nextAddedIds = new Set(recentlyAddedGoodsIds.value)
    nextAddedIds.add(goodsId)
    recentlyAddedGoodsIds.value = nextAddedIds
    ElMessage.success('已加入展柜')
  } else if (showcaseStore.mutationStatus === 400) ElMessage.info(showcaseStore.mutationMessage || '该谷子已在展柜中')
}

const handleRemoveFromShowcase = async (goodsId: string) => {
  const showcaseId = showcaseStore.activeShowcaseId
  if (!showcaseId) return
  const ok = await showcaseStore.removeGoods({ showcaseId, goodsId })
  if (ok) ElMessage.success('已移除')
}

const findInList = (goodsId: string) => {
  const items = showcaseStore.sortedShowcaseGoods
  const index = items.findIndex((x) => x.goods.id === goodsId)
  return index > -1 ? { items, index } : null
}
const isFirst = (id: string) => {
  const f = findInList(id)
  return f ? f.index === 0 : true
}
const isLast = (id: string) => {
  const f = findInList(id)
  return f ? f.index >= f.items.length - 1 : true
}

const moveUp = async (goodsId: string) => {
  const showcaseId = showcaseStore.activeShowcaseId
  const found = findInList(goodsId)
  if (!showcaseId || !found || found.index === 0) return
  const prev = found.items[found.index - 1]
  if (!prev) return
  await showcaseStore.moveGoods(showcaseId, {
    goods_id: goodsId,
    anchor_goods_id: prev.goods.id,
    position: 'before',
  })
}

const moveDown = async (goodsId: string) => {
  const showcaseId = showcaseStore.activeShowcaseId
  const found = findInList(goodsId)
  if (!showcaseId || !found || found.index >= found.items.length - 1) return
  const next = found.items[found.index + 1]
  if (!next) return
  await showcaseStore.moveGoods(showcaseId, {
    goods_id: goodsId,
    anchor_goods_id: next.goods.id,
    position: 'after',
  })
}

const ctxMoveUp = async () => {
  const id = contextMenu.goodsId
  if (!id || isFirst(id)) return
  closeContextMenu()
  await moveUp(id)
}
const ctxMoveDown = async () => {
  const id = contextMenu.goodsId
  if (!id || isLast(id)) return
  closeContextMenu()
  await moveDown(id)
}
const ctxRemoveFromShowcase = async () => {
  const id = contextMenu.goodsId
  if (!id) return
  closeContextMenu()
  await handleRemoveFromShowcase(id)
}

const ctxEditShowcase = async () => {
  const id = contextMenu.showcaseId
  if (!id) return
  closeContextMenu()
  await showcaseStore.setActive(id)
  openEditShowcase()
}

const ctxDeleteShowcase = async () => {
  const id = contextMenu.showcaseId
  if (!id) return
  closeContextMenu()
  await handleDeleteShowcaseById(id)
}

onMounted(async () => {
  showcaseStore.activeShowcaseId = null
  showcaseStore.activeShowcase = null
  viewMode.value = 'list'
  await showcaseStore.fetchList()
})

watch(
  () => showcaseStore.list.map((x) => x.id).join(','),
  () => {
    // 列表变更（首次加载/翻页/创建/删除刷新）后拉取预览图（前四张谷子主图）
    showcaseStore.fetchPreviewPhotos(showcaseStore.list.map((x) => x.id))
  },
  { immediate: true },
)
</script>

<style scoped>
.showcase-manager {
  --c-brand: #d4af37;
  --c-brand-light: rgba(212, 175, 55, 0.1);
  --c-accent: #a29bfe;
  --c-accent-hover: #8e86fa;
  --c-bg: #f5f5f7;
  --c-text-main: #2c3e50;
  --c-text-sub: #909399;
  --radius-lg: 16px;
  --radius-md: 12px;

  /*
   * 优化后的阴影系统（更“悬浮”、更“柔和”）：
   * - 大模糊 + 负扩散（negative spread）收缩阴影，消除边缘生硬感
   * - 多层叠加形成弥散云端质感
   */
  --shadow-float:
    0 10px 40px -10px rgba(0, 0, 0, 0.08),
    0 2px 10px -2px rgba(0, 0, 0, 0.04);

  /* 更通透的玻璃边框色，减少黑边感 */
  --c-border-glass: rgba(255, 255, 255, 0.6);
  --glass-bg: rgba(255, 255, 255, 0.85);

  width: 100%;
  min-height: calc(100vh - 80px);
  position: relative;
  /* 只允许垂直滚动，禁止横向滚动避免底部滑动条 */
  overflow-x: hidden;
  overflow-y: auto;
  font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
}

.bg-decoration {
  position: absolute;
  top: -50%;
  right: -20%;
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, rgba(162, 155, 254, 0.15) 0%, transparent 20%);
  pointer-events: none;
  z-index: 0;
}

.layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 10px;
  position: relative;
  z-index: 1;
}

.layout.single-page {
  display: block;
}

.panel-container {
  display: flex;
  flex-direction: column;
  align-self: flex-start;
}

.full-panel {
  width: 100%;
}

.showcase-detail-stage {
  width: min(100%, 1640px);
  margin: 0 auto;
  padding: 28px 20px 72px;
}

.left-panel {
  width: 340px;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.right-panel {
  flex: 1;
  min-width: 0;
}

.glass-card {
  /* 核心布局 */
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 确保内容不溢出圆角 */

  /* 视觉样式 */
  border-radius: var(--radius-lg);
  border: 1px solid var(--c-border-glass);

  /* 背景与毛玻璃 */
  background: var(--glass-bg);
  backdrop-filter: blur(16px); /* 稍微增加模糊度提升质感 */
  -webkit-backdrop-filter: blur(16px);

  /* 关键优化：背景裁切，防止背景色溢出圆角造成直角伪影 */
  background-clip: padding-box;

  /* 应用优化后的柔和阴影 */
  box-shadow: var(--shadow-float);

  /* 消除可能的渲染层级问题 */
  transform: translateZ(0);
}

/* Element Plus Card：隐藏组件自带边框，避免与玻璃边框叠加 */
:deep(.el-card) {
  border: none;
}

/* 桌面端：内容少时缩短，内容多时最大高度 + 内部滚动 */
.adaptive-card {
  height: fit-content;
  min-height: 500px;
  max-height: calc(100vh - 100px);
}

:deep(.el-card__body) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
}
:deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

/* 更轻盈的 Header 分割线（覆盖默认值） */
::deep(.el-card__header) {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.panel-header .header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
/* Header 轻分割线（最终覆盖，避免旧值残留） */
::deep(.el-card__header) {
  padding: 18px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-accent {
  background-color: var(--c-accent);
  border-color: var(--c-accent);
  color: #fff;
}
.btn-accent:hover {
  background-color: var(--c-accent-hover);
  border-color: var(--c-accent-hover);
}

.showcase-create-btn {
  --brand-add-padding-y: 10px;
  --brand-add-padding-x: 16px;
  --brand-add-gap: 0;
  --brand-add-min-height: 40px;
  flex-shrink: 0;
}

.showcase-create-btn__content {
  gap: 0;
}

.showcase-create-btn__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-right: 10px;
  transform: translateY(-0.5px);
}

.showcase-create-btn__label {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  white-space: nowrap;
}

.scroll-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.scroll-content::-webkit-scrollbar {
  width: 6px;
}
.scroll-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.state-box {
  padding: 12px 0;
}
.state-box.empty {
  padding: 24px 0;
}

.showcase-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.showcase-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;
}
.showcase-item:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.showcase-item.active {
  border-color: var(--c-brand);
  background: linear-gradient(to right, rgba(212, 175, 55, 0.05), rgba(162, 155, 254, 0.05));
}
.showcase-cover {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f0f0f0;
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover-img {
  width: 100%;
  height: 100%;
}
.cover-placeholder {
  color: #ccc;
  font-size: 20px;
}
.showcase-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}
.showcase-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text-main);
}
.showcase-desc {
  font-size: 12px;
  color: var(--c-text-sub);
  margin-top: 4px;
}
.active-icon {
  color: var(--c-brand);
  font-size: 16px;
  margin-left: 8px;
}
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pager-container {
  display: flex;
  justify-content: center;
  padding: 10px 0 0;
}

.detail-header .header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-empty-state {
  padding: 24px 0;
}
.detail-loading {
  padding: 16px;
}
.detail-info-banner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  gap: 20px;
}
.detail-name {
  font-size: 24px;
  color: var(--c-text-main);
  margin: 0;
  font-weight: 800;
}
.detail-desc {
  color: var(--c-text-sub);
  font-size: 14px;
  margin: 8px 0;
  line-height: 1.5;
}
.custom-divider {
  margin: 20px 0;
  border-color: rgba(0, 0, 0, 0.06);
}

/* 列表 / 详情切换过渡动画，参考 CloudShowcase.vue 中 tab-fade */
.detail-fade-enter-active,
.detail-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.detail-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.detail-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.detail-name {
  font-size: 24px;
  color: var(--c-text-main);
  margin: 0;
  font-weight: 800;
}
.detail-desc {
  color: var(--c-text-sub);
  font-size: 14px;
  margin: 8px 0;
  line-height: 1.5;
}
.custom-divider {
  margin: 20px 0;
  border-color: rgba(0, 0, 0, 0.06);
}

.section-header {
  display: flex;
  align-items: baseline;
  margin-bottom: 16px;
}
.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text-main);
}
.section-count {
  margin-left: 8px;
  font-size: 13px;
  color: var(--c-text-sub);
}
.goods-empty {
  padding: 16px 0;
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
}
.goods-wrapper {
  position: relative;
  transition: transform 0.2s;
}
.goods-wrapper:hover {
  transform: translateY(-4px);
  z-index: 2;
}
.goods-control {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;
}
.goods-wrapper:hover .goods-control {
  opacity: 1;
}
@media (hover: none) {
  .goods-control {
    opacity: 1;
    background: rgba(255, 255, 255, 0.7);
  }
}

.text-danger {
  color: #f56c6c;
}

/* 右键菜单（复用谷仓风格） */
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: transparent;
}
.context-menu {
  position: fixed;
  min-width: 170px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
  padding: 6px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--c-text-main);
}
.context-menu-icon {
  font-size: 16px;
  color: #606266;
}
.context-menu-item:hover {
  background: rgba(162, 155, 254, 0.12);
}
.context-menu-item.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.context-menu-item.is-disabled:hover {
  background: transparent;
}
.context-menu-item-danger {
  color: #f56c6c;
}
.context-menu-item-danger .context-menu-icon {
  color: #f56c6c;
}


.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

:global(.showcase-dialog) {
  border-radius: 28px;
  overflow: hidden;
}

:global(.showcase-dialog .el-dialog) {
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 247, 255, 0.96)),
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.14), transparent 30%);
  box-shadow:
    0 28px 70px rgba(41, 34, 24, 0.18),
    0 10px 24px rgba(41, 34, 24, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

:global(.showcase-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 28px 28px 18px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.12);
  background: rgba(255, 255, 255, 0.96);
}

:global(.showcase-dialog .el-dialog__headerbtn) {
  top: 22px;
  right: 22px;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  transition: background-color var(--transition-fast), transform var(--transition-fast);
}

:global(.showcase-dialog .el-dialog__headerbtn:hover) {
  background: rgba(162, 155, 254, 0.14);
  transform: rotate(90deg);
}

:global(.showcase-dialog .el-dialog__headerbtn .el-dialog__close) {
  color: #7d7892;
  font-size: 16px;
}

:global(.showcase-dialog .el-dialog__body) {
  padding: 22px 28px 0;
}

:global(.showcase-dialog .el-dialog__footer) {
  padding: 18px 28px 24px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: inset 0 18px 24px -28px rgba(212, 175, 55, 0.28);
}

.showcase-dialog-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 440px;
}

.showcase-dialog-kicker {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(162, 155, 254, 0.12);
  color: #7c6fda;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.showcase-dialog-title {
  margin: 0;
  font-size: 28px;
  line-height: 1.12;
  font-weight: 700;
  color: #2f2a20;
}

.showcase-dialog-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #7a748c;
}

.showcase-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.showcase-form-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 18px 16px;
  border: 1px solid rgba(212, 175, 55, 0.1);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.84)),
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.1), transparent 30%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.showcase-form-section--primary {
  gap: 16px;
}

.showcase-form-section--secondary {
  background:
    linear-gradient(180deg, rgba(250, 248, 255, 0.96), rgba(255, 255, 255, 0.9)),
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.12), transparent 34%);
}

.showcase-form-section--settings {
  padding-top: 16px;
  padding-bottom: 16px;
}

.showcase-dialog-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.showcase-dialog-form :deep(.el-form-item__label) {
  margin-bottom: 8px;
  color: #5f5874;
  font-weight: 700;
  line-height: 1.2;
}

.showcase-dialog-form :deep(.el-input__wrapper),
.showcase-dialog-form :deep(.el-textarea__inner) {
  border-radius: 14px;
  border: 1px solid rgba(212, 175, 55, 0.1);
  background: rgba(255, 255, 255, 0.82);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 8px 24px rgba(162, 155, 254, 0.06);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background-color var(--transition-fast);
}

.showcase-dialog-form :deep(.el-input__wrapper) {
  padding: 6px 12px;
}

.showcase-dialog-form :deep(.el-textarea__inner) {
  min-height: 108px !important;
  padding: 12px 14px;
}

.showcase-dialog-form :deep(.el-input__wrapper:hover),
.showcase-dialog-form :deep(.el-textarea__inner:hover) {
  border-color: rgba(162, 155, 254, 0.24);
}

.showcase-dialog-form :deep(.el-input__wrapper.is-focus),
.showcase-dialog-form :deep(.el-textarea__inner:focus) {
  border-color: rgba(162, 155, 254, 0.46);
  box-shadow:
    0 0 0 3px rgba(196, 181, 253, 0.2),
    0 12px 28px rgba(162, 155, 254, 0.1);
  background: rgba(255, 255, 255, 0.96);
}

.showcase-dialog-form :deep(.el-input__count),
.showcase-dialog-form :deep(.el-input__count-inner),
.showcase-dialog-form :deep(.el-textarea__count) {
  color: #9a96ab;
  background: transparent;
}

.showcase-dialog-form :deep(.el-input__inner::placeholder),
.showcase-dialog-form :deep(.el-textarea__inner::placeholder) {
  color: #b1adbf;
}

.showcase-cover-field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.showcase-cover-field :deep(.el-upload--picture-card),
.showcase-cover-field :deep(.el-upload-list__item) {
  width: 156px;
  height: 156px;
  border-radius: 22px;
}

.showcase-cover-field :deep(.el-upload--picture-card) {
  border: 1px dashed rgba(162, 155, 254, 0.34);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(245, 243, 255, 0.82)),
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.18), transparent 34%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    0 12px 28px rgba(162, 155, 254, 0.08);
  transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.showcase-cover-field :deep(.el-upload--picture-card:hover) {
  transform: translateY(-1px);
  border-color: rgba(162, 155, 254, 0.58);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 16px 32px rgba(162, 155, 254, 0.14);
}

.showcase-cover-field :deep(.el-upload--picture-card .el-icon) {
  font-size: 28px;
  color: #8f82eb;
}

.cover-tip {
  margin-top: 0;
  max-width: 220px;
  font-size: 13px;
  line-height: 1.6;
  color: #8d879c;
}

.showcase-visibility-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.showcase-visibility-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.showcase-visibility-title {
  font-size: 14px;
  font-weight: 700;
  color: #463f59;
}

.showcase-visibility-desc {
  font-size: 12px;
  line-height: 1.6;
  color: #918ba4;
}

.showcase-visibility-row :deep(.el-switch) {
  flex-shrink: 0;
}

.showcase-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.showcase-dialog-cancel {
  border-radius: 999px;
  border-color: rgba(162, 155, 254, 0.18);
  color: #6a6578;
  background: rgba(255, 255, 255, 0.78);
}

.showcase-dialog-submit {
  min-width: 108px;
  border-radius: 999px;
  box-shadow: 0 12px 24px rgba(162, 155, 254, 0.18);
}

/* 选中一张封面后隐藏新增按钮（只保留已选卡片） */
.hide-upload-trigger :deep(.el-upload--picture-card) {
  display: none;
}

.showcase-cover-field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.cover-tip {
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--c-text-sub, #909399);
}

@media (max-width: 768px) {
  .showcase-manager {
    min-height: calc(100vh - 50px);
    height: calc(100vh - 50px);
  }
  .layout {
    gap: 0;
    padding: 0;
    display: block;
    height: 100%;
  }

  .left-panel,
  .right-panel,
  .full-panel {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    align-self: unset;
  }

  .panel-container {
    height: 100%;
  }

  .glass-card {
    border-radius: 0;
    border: none;
    box-shadow: none;
  }

  /* 移动端恢复卡片填满可用高度 */
  .adaptive-card {
    height: 100%;
    max-height: none;
  }

  .detail-info-banner {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .panel-header {
    align-items: flex-start;
  }

  .panel-header .header-left {
    min-width: 0;
    flex-wrap: wrap;
    gap: 12px;
  }

  .showcase-create-btn {
    --brand-add-padding-y: 9px;
    --brand-add-padding-x: 14px;
    --brand-add-font-size: 13px;
    --brand-add-min-height: 36px;
  }

  .showcase-create-btn__icon {
    width: 16px;
    height: 16px;
    margin-right: 8px;
  }

  :global(.showcase-dialog .el-dialog) {
    width: min(96vw, 560px) !important;
    border-radius: 22px;
  }

  :global(.showcase-dialog .el-dialog__header) {
    padding: 22px 20px 16px;
  }

  :global(.showcase-dialog .el-dialog__body) {
    padding: 18px 20px 0;
  }

  :global(.showcase-dialog .el-dialog__footer) {
    padding: 16px 20px 20px;
  }

  .showcase-dialog-title {
    font-size: 24px;
  }

  .showcase-dialog-subtitle {
    font-size: 13px;
  }

  .showcase-form-section {
    padding: 16px 14px 14px;
    border-radius: 18px;
  }

  .showcase-cover-field :deep(.el-upload--picture-card),
  .showcase-cover-field :deep(.el-upload-list__item) {
    width: 140px;
    height: 140px;
  }

  .showcase-visibility-row {
    align-items: flex-start;
  }

  .showcase-dialog-footer {
    flex-direction: column-reverse;
  }

  .showcase-dialog-footer :deep(.el-button) {
    width: 100%;
    margin-left: 0;
  }

  .add-goods-btn {
    width: 100%;
  }

  .goods-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .right-panel {
    z-index: 10;
    background: var(--c-bg);
  }
}

@media (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .showcase-manager {
    min-height: calc(100dvh - 50px);
    height: calc(100dvh - 50px);
  }

  .layout {
    gap: 0;
    padding: 0;
    display: block;
    height: 100%;
  }

  .left-panel,
  .right-panel,
  .full-panel {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    align-self: unset;
  }

  .panel-container {
    height: 100%;
  }

  .glass-card {
    border-radius: 0;
    border: none;
    box-shadow: none;
  }

  .adaptive-card {
    height: 100%;
    max-height: none;
  }

  .detail-info-banner {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .panel-header {
    align-items: flex-start;
  }

  .panel-header .header-left {
    min-width: 0;
    flex-wrap: wrap;
    gap: 12px;
  }

  .showcase-create-btn {
    --brand-add-padding-y: 9px;
    --brand-add-padding-x: 14px;
    --brand-add-font-size: 13px;
    --brand-add-min-height: 36px;
  }

  .showcase-create-btn__icon {
    width: 16px;
    height: 16px;
    margin-right: 8px;
  }

  :global(.showcase-dialog .el-dialog) {
    width: min(96vw, 560px) !important;
    border-radius: 22px;
  }

  :global(.showcase-dialog .el-dialog__header) {
    padding: 22px 20px 16px;
  }

  :global(.showcase-dialog .el-dialog__body) {
    padding: 18px 20px 0;
  }

  :global(.showcase-dialog .el-dialog__footer) {
    padding: 16px 20px 20px;
  }

  .showcase-dialog-title {
    font-size: 24px;
  }

  .showcase-dialog-subtitle {
    font-size: 13px;
  }

  .showcase-form-section {
    padding: 16px 14px 14px;
    border-radius: 18px;
  }

  .showcase-cover-field :deep(.el-upload--picture-card),
  .showcase-cover-field :deep(.el-upload-list__item) {
    width: 140px;
    height: 140px;
  }

  .showcase-visibility-row {
    align-items: flex-start;
  }

  .showcase-dialog-footer {
    flex-direction: column-reverse;
  }

  .showcase-dialog-footer :deep(.el-button) {
    width: 100%;
    margin-left: 0;
  }

  .add-goods-btn {
    width: 100%;
  }

  .goods-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .right-panel {
    z-index: 10;
    background: var(--c-bg);
  }
}
</style>
