<template>
  <div class="cloud-showcase">
    <!-- 顶部 Tab：云展柜 / 谷仓 / 统计 -->
    <el-tabs v-model="activeTab" class="cloud-tabs">
      <el-tab-pane label="展柜" name="showcase" />
      <el-tab-pane label="谷仓" name="barn" />
      <el-tab-pane label="统计看板" name="stats" />
    </el-tabs>

    <!-- Tab 内容区域 - 添加过渡动画 -->
    <Transition name="tab-fade" mode="out-in">
      <div v-if="activeTab === 'showcase'" key="showcase" class="showcase-section" v-loading="showcaseRefreshing">
        <ShowcaseManager />
      </div>

      <div v-else-if="activeTab === 'barn'" key="barn">
      <!-- 搜索栏 -->
      <div class="search-section">
        <SearchBar />
      </div>

      <!-- 筛选面板 -->
      <FilterPanel />

      <Transition name="selection-bar" appear>
        <div v-if="guziStore.selectionMode" class="selection-status-bar">
          <span>多选模式</span>
          <strong>已选 {{ guziStore.selectedGoodsCount }} 个谷子</strong>
          <span class="selection-hint">可继续搜索、筛选或翻页添加更多谷子</span>
          <el-button
            v-if="guziStore.selectedGoodsCount > 0"
            text
            class="selection-clear-btn"
            @click="guziStore.clearGoodsSelection()"
          >
            清空
          </el-button>
        </div>
      </Transition>

      <!-- 列表区域 -->
      <div class="list-section">
        <!-- 添加 Transition 组件包裹内容 -->
        <Transition name="fade-slide" mode="out-in">
          <!-- Loading 状态 -->
          <div v-if="guziStore.loading" key="loading" class="loading-container">
            <el-skeleton :rows="5" animated />
          </div>

          <!-- 错误状态 -->
          <div v-else-if="guziStore.error" key="error" class="error-container">
            <el-alert :title="guziStore.error" type="error" :closable="false" />
          </div>

          <!-- 空数据状态 -->
          <div v-else-if="guziStore.guziList.length === 0" key="empty" class="empty-container">
            <el-empty description="暂无谷子数据" />
          </div>

          <!-- 商品列表状态 -->
          <div v-else class="goods-grid" key="grid">
            <GoodsCard
              v-for="goods in guziStore.guziList"
              :key="goods.id"
              :goods="goods"
              :selectable="guziStore.selectionMode"
              :selected="guziStore.isGoodsSelected(goods.id)"
              @click="handleCardClick"
              @select="handleCardSelect"
              @location-click="handleLocationClick"
              @context-menu="handleCardContextMenu"
            />
          </div>
        </Transition>
      </div>

      <!-- 哨兵元素：滚动到此处触发加载更多 -->
      <div v-if="guziStore.guziList.length > 0" ref="sentinelRef" class="scroll-sentinel"></div>
      <!-- 加载更多指示器 -->
      <div v-if="guziStore.loadingMore" class="loading-more">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <!-- 已加载全部 -->
      <div v-else-if="!guziStore.hasMore && guziStore.guziList.length > 0" class="no-more">
        已加载全部 {{ guziStore.pagination.count }} 项
      </div>
      <!-- 每页数量选择器 -->
      <div
        v-if="guziStore.guziList.length > 0 && guziStore.viewMode === 'standard'"
        class="page-size-float"
      >
        <div class="page-size-wrapper">
          <el-select
            v-model="pageSize"
            class="page-size-select"
            @change="handleSizeChange"
          >
            <el-option
              v-for="size in [12, 18, 24, 30, 36, 42]"
              :key="size"
              :label="`${size}项/页`"
              :value="size"
            />
          </el-select>
        </div>
      </div>

      <!-- 详情抽屉 -->
      <GoodsDrawer v-model="drawerVisible" :goods-id="selectedGoodsId" />

      <GoodsMultiDisplayDialog
        v-model="multiDisplayVisible"
        :goods-list="guziStore.selectedGoodsList"
        @remove="guziStore.removeGoodsSelection"
        @clear="guziStore.clearGoodsSelection"
      />

      <!-- 右键菜单 -->
      <div
        v-if="contextMenuVisible"
        class="context-menu-overlay"
        @click="closeContextMenu"
        @contextmenu.prevent
      >
        <div
          class="context-menu"
          :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
          @click.stop
        >
          <div
            class="context-menu-item"
            :class="{ 'is-disabled': moveDisabledToTop }"
            @click="handleMoveToTop"
          >
            <el-icon class="context-menu-icon"><Top /></el-icon>
            <span>置顶到本页顶部</span>
          </div>
          <div
            class="context-menu-item"
            :class="{ 'is-disabled': moveDisabledForward }"
            @click="handleMoveForward"
          >
            <el-icon class="context-menu-icon"><ArrowLeft /></el-icon>
            <span>前移</span>
          </div>
          <div
            class="context-menu-item"
            :class="{ 'is-disabled': moveDisabledBackward }"
            @click="handleMoveBackward"
          >
            <el-icon class="context-menu-icon"><ArrowRight /></el-icon>
            <span>后移</span>
          </div>
          <div class="context-menu-item" @click="handleEditGoods">
            <el-icon class="context-menu-icon"><Edit /></el-icon>
            <span>编辑</span>
          </div>
          <div class="context-menu-item context-menu-item-danger" @click="handleDeleteGoods">
            <el-icon class="context-menu-icon"><Delete /></el-icon>
            <span>删除</span>
          </div>
        </div>
      </div>
    </div>

      <div v-else key="stats" class="stats-section" v-loading="statsRefreshing">
        <StatsDashboard />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight, Delete, Edit, Top, Loading } from '@element-plus/icons-vue'
import { useGuziStore } from '@/stores/guzi'
import { useShowcaseStore } from '@/stores/showcase'
import SearchBar from '@/components/SearchBar.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import GoodsCard from '@/components/GoodsCard.vue'
import GoodsDrawer from '@/components/GoodsDrawer.vue'
import GoodsMultiDisplayDialog from '@/components/GoodsMultiDisplayDialog.vue'
import StatsDashboard from '@/components/StatsDashboard.vue'
import ShowcaseManager from '@/components/ShowcaseManager.vue'
import type { GoodsListItem } from '@/api/types'
import { deleteGoods, getGoodsList, moveGoods } from '@/api/goods'

const router = useRouter()
const guziStore = useGuziStore()
const showcaseStore = useShowcaseStore()

const activeTab = ref<'showcase' | 'barn' | 'stats'>('barn')

const drawerVisible = ref(false)
const selectedGoodsId = ref<string>('')
const multiDisplayVisible = ref(false)

const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuGoods = ref<GoodsListItem | null>(null)
const moveLoading = ref(false)

// 刷新状态
const showcaseRefreshing = ref(false)
const statsRefreshing = ref(false)

// 移动端检测
const isMobile = ref(window.innerWidth < 768)
const sentinelRef = ref<HTMLElement | null>(null)
let sentinelObserver: IntersectionObserver | null = null

const pageSize = computed({
  get: () => guziStore.pagination.page_size,
  set: (val) => guziStore.setPageSize(val),
})

const contextMenuIndex = computed(() => {
  if (!contextMenuGoods.value) return -1
  return guziStore.guziList.findIndex(item => item.id === contextMenuGoods.value?.id)
})

const isFirstItemInList = computed(() => {
  return contextMenuGoods.value && contextMenuIndex.value === 0
})

const isLastItemLastPage = computed(() => {
  if (!contextMenuGoods.value) return false
  const idx = contextMenuIndex.value
  return idx === guziStore.guziList.length - 1 && !guziStore.hasMore
})

const isFirstItemInCurrentPage = computed(() => {
  return contextMenuGoods.value && contextMenuIndex.value === 0
})

const moveDisabledToTop = computed(() => moveLoading.value || isFirstItemInCurrentPage.value)
const moveDisabledForward = computed(() => moveLoading.value || isFirstItemInList.value)
const moveDisabledBackward = computed(() => moveLoading.value || isLastItemLastPage.value)

const handleCardClick = (goods: GoodsListItem) => {
  if (guziStore.selectionMode) {
    guziStore.toggleGoodsSelection(goods)
    return
  }
  selectedGoodsId.value = goods.id
  drawerVisible.value = true
}

const handleCardSelect = (goods: GoodsListItem) => {
  guziStore.toggleGoodsSelection(goods)
}

const handleCardContextMenu = (payload: { goods: GoodsListItem; x: number; y: number }) => {
  if (guziStore.selectionMode) return
  contextMenuGoods.value = payload.goods
  contextMenuX.value = payload.x
  contextMenuY.value = payload.y
  contextMenuVisible.value = true
}

const handleLocationClick = (path: string) => {
  if (guziStore.selectionMode) return
  // 跳转到位置管理页
  router.push({ name: 'Location', query: { highlight: path } })
}

const handleSelectionEnter = () => {
  closeContextMenu()
  drawerVisible.value = false
  guziStore.enterSelectionMode()
}

const handleSelectionConfirm = () => {
  closeContextMenu()
  if (guziStore.selectedGoodsCount === 0) {
    ElMessage.warning('请先选择要同屏展示的谷子')
    return
  }
  multiDisplayVisible.value = true
}

const handleSelectionExit = async () => {
  closeContextMenu()
  multiDisplayVisible.value = false

  if (guziStore.selectedGoodsCount > 0) {
    try {
      await ElMessageBox.confirm(
        `当前已选择 ${guziStore.selectedGoodsCount} 个谷子，退出多选后将清空选择。`,
        '退出多选模式',
        {
          confirmButtonText: '退出',
          cancelButtonText: '继续选择',
          type: 'warning',
        },
      )
    } catch (error) {
      return
    }
  }

  guziStore.exitSelectionMode(true)
}

const handleSizeChange = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const closeContextMenu = () => {
  contextMenuVisible.value = false
}

const handleEditGoods = () => {
  if (!contextMenuGoods.value) return
  const id = contextMenuGoods.value.id
  closeContextMenu()
  router.push({ name: 'GoodsEdit', params: { id } })
}

const handleDeleteGoods = async () => {
  if (!contextMenuGoods.value) return
  const goods = contextMenuGoods.value
  closeContextMenu()
  try {
    await ElMessageBox.confirm(
      `确认删除「${goods.name}」吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await deleteGoods(goods.id)
    ElMessage.success('删除成功')
    guziStore.pagination.page = 1
    guziStore.searchGuziImmediate()
  } catch (error: any) {
    // 用户取消
    if (error === 'cancel' || error === 'close') return
    ElMessage.error('删除失败')
  }
}

const extractResults = (response: any): GoodsListItem[] => {
  if (Array.isArray(response)) return response
  if (response && Array.isArray(response.results)) return response.results
  return []
}

const fetchAnchorItem = async (page: number, take: 'first' | 'last') => {
  const response = await getGoodsList({
    ...guziStore.filters,
    page,
    page_size: guziStore.pagination.page_size,
  })
  const list = extractResults(response)
  if (!list.length) return null
  return take === 'first' ? list[0] : list[list.length - 1]
}

const handleMove = async (direction: 'forward' | 'backward') => {
  if (!contextMenuGoods.value) return
  if (moveLoading.value) return

  const goods = contextMenuGoods.value
  const idx = contextMenuIndex.value

  if (idx === -1) {
    ElMessage.warning('未找到当前卡片，无法排序')
    return
  }

  // 前移：保护列表第一项
  if (direction === 'forward' && isFirstItemInList.value) {
    ElMessage.info('第一页最前面的卡片无法再前移')
    return
  }

  // 后移：最后一页最后一项无法后移
  if (direction === 'backward' && isLastItemLastPage.value) {
    ElMessage.info('已经是最后一个位置，无法后移')
    return
  }

  moveLoading.value = true

  try {
    let anchorId = ''
    const position: 'before' | 'after' = direction === 'forward' ? 'before' : 'after'

    if (direction === 'forward') {
      if (idx > 0) {
        const anchor = guziStore.guziList[idx - 1]
        if (!anchor) {
          ElMessage.error('未找到前一项，无法前移')
          return
        }
        anchorId = anchor.id
      } else {
        const prevPage = guziStore.pagination.page - 1
        const anchorItem = await fetchAnchorItem(prevPage, 'last')
        if (!anchorItem) {
          ElMessage.error('未找到前一页的锚点，无法前移')
          return
        }
        anchorId = anchorItem.id
      }
    } else {
      if (idx < guziStore.guziList.length - 1) {
        const anchor = guziStore.guziList[idx + 1]
        if (!anchor) {
          ElMessage.error('未找到后一项，无法后移')
          return
        }
        anchorId = anchor.id
      } else {
        const nextPage = guziStore.pagination.page + 1
        const anchorItem = await fetchAnchorItem(nextPage, 'first')
        if (!anchorItem) {
          ElMessage.error('未找到后一页的锚点，无法后移')
          return
        }
        anchorId = anchorItem.id
      }
    }

    await moveGoods(goods.id, {
      anchor_id: anchorId,
      position,
    })

    closeContextMenu()
    ElMessage.success('排序已更新')
    guziStore.pagination.page = 1
    await guziStore.searchGuziImmediate()
  } catch (error: any) {
    console.error('排序移动失败:', error)
    const detail = error?.response?.data?.detail || error?.message || '排序失败'
    ElMessage.error(detail)
  } finally {
    moveLoading.value = false
  }
}

const handleMoveForward = () => {
  if (moveDisabledForward.value) {
    if (isFirstItemInList.value) {
      ElMessage.info('已经是列表第一项，无法前移')
    }
    return
  }
  handleMove('forward')
}

const handleMoveBackward = () => {
  if (moveDisabledBackward.value) {
    if (isLastItemLastPage.value) {
      ElMessage.info('已经是最后一个位置，无法后移')
    }
    return
  }
  handleMove('backward')
}

const handleMoveToTop = async () => {
  if (!contextMenuGoods.value) return
  if (moveLoading.value) return
  if (isFirstItemInCurrentPage.value) {
    ElMessage.info('当前商品已经是列表第一项')
    return
  }

  const goods = contextMenuGoods.value
  const idx = contextMenuIndex.value

  if (idx === -1) {
    ElMessage.warning('未找到当前卡片，无法置顶')
    return
  }

  // 如果当前项不是第一项，移动到第一项之前
  if (idx > 0) {
    const firstItem = guziStore.guziList[0]
    if (!firstItem) {
      ElMessage.error('未找到本页第一项，无法置顶')
      return
    }

    moveLoading.value = true
    try {
      await moveGoods(goods.id, {
        anchor_id: firstItem.id,
        position: 'before',
      })
      closeContextMenu()
      ElMessage.success('已置顶到本页顶部')
      guziStore.pagination.page = 1
      await guziStore.searchGuziImmediate()
    } catch (error: any) {
      console.error('置顶失败:', error)
      const detail = error?.response?.data?.detail || error?.message || '置顶失败'
      ElMessage.error(detail)
    } finally {
      moveLoading.value = false
    }
  }
}

let statsRefreshCompleteHandler: (() => void) | null = null

const handleShowcaseRefresh = async () => {
  try {
    if (activeTab.value === 'barn') {
      // 重新应用当前的筛选条件进行搜索
      await guziStore.searchGuziImmediate(guziStore.filters)
      return
    }
    if (activeTab.value === 'showcase') {
      showcaseRefreshing.value = true
      try {
        await showcaseStore.fetchList()
        if (showcaseStore.activeShowcaseId) {
          await showcaseStore.fetchDetail(showcaseStore.activeShowcaseId)
        }
      } finally {
        showcaseRefreshing.value = false
      }
      return
    }
    // stats：交给 StatsDashboard 自己监听刷新事件处理
    statsRefreshing.value = true
    window.dispatchEvent(new CustomEvent('cloud-showcase:stats-refresh'))
    // 监听刷新完成事件
    statsRefreshCompleteHandler = () => {
      statsRefreshing.value = false
      if (statsRefreshCompleteHandler) {
        window.removeEventListener('cloud-showcase:stats-refresh-complete', statsRefreshCompleteHandler)
        statsRefreshCompleteHandler = null
      }
    }
    window.addEventListener('cloud-showcase:stats-refresh-complete', statsRefreshCompleteHandler)
  } finally {
    // 通知 Layout.vue 刷新完成
    window.dispatchEvent(new CustomEvent('cloud-showcase:refresh-complete'))
  }
}

const handleResize = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  // 重置到第一页并初始化加载数据（立即执行，不使用防抖）
  guziStore.pagination.page = 1
  guziStore.searchGuziImmediate()

  // 将当前 Tab 同步给布局层（用于控制右下角 + 号显示）
  window.dispatchEvent(new CustomEvent('cloud-showcase:tab-changed', { detail: { tab: activeTab.value } }))

  // 设置无限滚动哨兵观察器
  sentinelObserver = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      guziStore.loadMore()
    }
  }, {
    rootMargin: '200px',
  })

  // 监听哨兵元素挂载
  watch(sentinelRef, (el) => {
    if (el && sentinelObserver) {
      sentinelObserver.unobserve(el)
      sentinelObserver.observe(el)
    }
  }, { immediate: true })

  window.addEventListener('resize', handleResize)

  // 监听右下角"刷新"按钮事件，按当前 Tab 执行对应刷新
  window.addEventListener('cloud-showcase:refresh', handleShowcaseRefresh as EventListener)
  window.addEventListener('cloud-showcase:selection-enter', handleSelectionEnter as EventListener)
  window.addEventListener('cloud-showcase:selection-confirm', handleSelectionConfirm as EventListener)
  window.addEventListener('cloud-showcase:selection-exit', handleSelectionExit as EventListener)
})

onUnmounted(() => {
  if (sentinelObserver) {
    sentinelObserver.disconnect()
  }
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('cloud-showcase:refresh', handleShowcaseRefresh as EventListener)
  window.removeEventListener('cloud-showcase:selection-enter', handleSelectionEnter as EventListener)
  window.removeEventListener('cloud-showcase:selection-confirm', handleSelectionConfirm as EventListener)
  window.removeEventListener('cloud-showcase:selection-exit', handleSelectionExit as EventListener)
  if (statsRefreshCompleteHandler) {
    window.removeEventListener('cloud-showcase:stats-refresh-complete', statsRefreshCompleteHandler)
  }
})

watch(
  () => activeTab.value,
  (tab) => {
    window.dispatchEvent(new CustomEvent('cloud-showcase:tab-changed', { detail: { tab } }))
  },
)
</script>

<style scoped>
.cloud-showcase {
  padding: 20px;
  padding-bottom: 100px; /* 为固定分页器预留空间 */
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 64px); /* 减去导航栏高度 */
}

.search-section {
  margin-bottom: 24px;
}

.cloud-tabs {
  margin-top: 4px;
}

.list-section {
  margin-top: 24px;
  min-height: 400px; /* 给列表区域一个最小高度，防止切换时的闪烁塌陷 */
}

.selection-status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0 18px;
  padding: 10px 14px;
  border: 1px solid rgba(212, 175, 55, 0.35);
  border-radius: 8px;
  background: rgba(212, 175, 55, 0.08);
  color: var(--text-dark);
  font-size: 14px;
  max-height: 72px;
  overflow: hidden;
  transform-origin: top center;
}

.selection-bar-enter-active,
.selection-bar-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1),
    max-height 0.24s ease,
    margin 0.24s ease,
    padding-top 0.24s ease,
    padding-bottom 0.24s ease,
    border-color 0.24s ease;
}

.selection-bar-enter-from,
.selection-bar-leave-to {
  opacity: 0;
  transform: translateY(-8px) scaleY(0.96);
  max-height: 0;
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-color: transparent;
}

.selection-status-bar strong {
  color: var(--primary-gold-dark);
}

.selection-hint {
  color: var(--text-secondary, #909399);
  font-size: 13px;
  flex: 1;
  min-width: 0;
}

.selection-clear-btn {
  color: var(--primary-gold-dark);
  flex: none;
}

.stats-section {
  margin-top: 16px;
}

.showcase-section {
  margin-top: 16px;
}

/* Tab 切换过渡动画 - 参考 Layout.vue 的 page-fade 效果 */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 列表切换过渡动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0, 0.1, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.loading-container,
.error-container,
.empty-container {
  padding: 40px 20px;
  text-align: center;
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .goods-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .selection-status-bar {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }

  .selection-hint {
    line-height: 1.4;
  }

  .cloud-showcase {
    padding-bottom: 120px; /* 移动端预留更多空间 */
  }
}

/* 哨兵元素：无限滚动触发点 */
.scroll-sentinel {
  height: 1px;
  width: 100%;
}

/* 加载更多指示器 */
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
  color: var(--text-secondary, #909399);
  font-size: 14px;
}

/* 已加载全部 */
.no-more {
  text-align: center;
  padding: 24px 0;
  color: var(--text-lighter, #c0c4cc);
  font-size: 13px;
}

/* 每页数量选择器 - 悬浮固定在右下角 */
.page-size-float {
  position: fixed;
  bottom: 24px;
  right: 90px;
  z-index: 100;
}

.page-size-wrapper {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 8px 12px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1), 0 -2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.8);
  pointer-events: auto;
  transition: all var(--transition-normal);
  display: inline-flex;
  align-items: center;
}

.page-size-wrapper:hover {
  box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.12), 0 -4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.page-size-select {
  width: 90px;
}

/* 去掉 el-select 2.8.x 的边框（box-shadow inset 方式）和背景 */
.page-size-select :deep(.el-select__wrapper) {
  background-color: transparent !important;
  box-shadow: none !important;
  border-radius: 8px;
  padding: 0 4px;
  height: 32px;
}

/* 所有状态下都不显示框 */
.page-size-select :deep(.el-select__wrapper.is-focused),
.page-size-select :deep(.el-select__wrapper.is-hovering),
.page-size-select :deep(.el-select__wrapper:hover) {
  box-shadow: none !important;
}

.page-size-select :deep(.el-select__placeholder) {
  color: var(--text-dark);
}

.page-size-select :deep(.el-select__caret) {
  color: var(--text-secondary, #909399);
}

.page-size-select :deep(.el-select__selected-item) {
  font-size: 14px;
  color: var(--text-dark);
}

@media (max-width: 768px) {
  .page-size-float {
    bottom: calc(80px + env(safe-area-inset-bottom));
    right: 70px;
  }

  .page-size-wrapper {
    padding: 6px 10px;
    border-radius: 12px;
  }

  .page-size-select {
    width: 85px;
  }

  .page-size-select :deep(.el-select__selected-item) {
    font-size: 13px;
  }

  /* 兼容不支持 safe-area-inset-bottom 的环境 */
  @supports not (bottom: env(safe-area-inset-bottom)) {
    .page-size-float {
      bottom: 80px;
    }
  }
}

.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
}

.context-menu {
  position: fixed;
  min-width: 140px;
  background-color: var(--bg-white);
  border-radius: 10px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-color);
  padding: 6px 0;
  z-index: 2100;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-dark);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.context-menu-icon {
  flex: none;
  font-size: 16px;
  color: inherit;
}

.context-menu-item:focus,
.context-menu-item:active {
  outline: none;
}

.context-menu-item:hover {
  background-color: var(--primary-gold-light);
  color: var(--primary-gold-dark);
}

.context-menu-item.is-disabled {
  color: var(--text-lighter);
  cursor: not-allowed;
  background-color: transparent !important;
}

.context-menu-item-danger {
  color: #F56C6C;
}

.context-menu-item-danger:hover {
  background-color: rgba(245, 108, 108, 0.1);
  color: #F56C6C;
}
</style>
