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

      <div v-else-if="activeTab === 'barn'" key="barn" class="barn-section">
        <div
          class="barn-pull-refresh-wrapper"
          @touchstart.capture.passive="handleBarnPullStart"
          @touchmove="handleBarnPullMove"
          @touchend="handleBarnPullEnd"
          @touchcancel="resetBarnPullRefresh"
        >
          <div
            v-if="isMobile"
            class="pull-indicator"
            :style="{ height: `${pullDistance}px`, opacity: pullDistance > 0 ? 1 : 0 }"
          >
            <div class="pull-indicator-content">
              <el-icon v-if="isRefreshing" class="is-loading"><Loading /></el-icon>
              <el-icon v-else :style="{ transform: `rotate(${pullDistance > 50 ? 180 : 0}deg)` }"><Top /></el-icon>
              <span>{{ isRefreshing ? '正在刷新...' : (pullDistance > 50 ? '释放刷新' : '下拉刷新') }}</span>
            </div>
          </div>
          <div class="barn-pull-refresh-content" :style="barnPullRefreshStyle">
      <div class="barn-discovery" :class="{ 'is-search-expanded': mobileSearchExpanded }">
        <!-- 搜索栏 -->
        <Transition name="mobile-search-expand">
          <div
            v-if="!isMobile || mobileSearchExpanded"
            class="search-section"
            :class="{ 'search-section--mobile': isMobile }"
          >
            <SearchBar />
          </div>
        </Transition>

        <div v-if="isMobile" class="mobile-filter-strip">
          <button
            class="mobile-search-trigger"
            :class="{ 'is-active': mobileSearchExpanded || !!guziStore.filters.search }"
            type="button"
            :aria-expanded="mobileSearchExpanded ? 'true' : 'false'"
            @click="toggleMobileSearch"
          >
            <el-icon><Search /></el-icon>
            <span>{{ mobileSearchExpanded ? '收起' : '搜索' }}</span>
          </button>
          <button class="mobile-filter-trigger" type="button" @click="openMobileFilter">
            <el-icon><List /></el-icon>
            <span>筛选</span>
            <strong v-if="activeFilterCount > 0">{{ activeFilterCount }}</strong>
          </button>
          <div class="mobile-filter-chips" aria-label="当前筛选">
            <span
              v-for="chip in visibleMobileFilterChips"
              :key="chip"
              class="mobile-filter-chip"
            >
              {{ chip }}
            </span>
          </div>
        </div>
      </div>

      <!-- 筛选面板：桌面端仍为卡片，移动端放入底部面板 -->
      <FilterPanel v-if="!isMobile" />

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
      <div
        v-if="guziStore.loadingMore"
        class="loading-more"
        :class="{ 'loading-more--mobile': isMobile }"
      >
        <template v-if="isMobile">
          <div v-for="index in 4" :key="index" class="mobile-loading-card">
            <span class="mobile-loading-image"></span>
            <span class="mobile-loading-line"></span>
            <span class="mobile-loading-line short"></span>
          </div>
        </template>
        <template v-else>
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>加载中...</span>
        </template>
      </div>
      <!-- 已加载全部 -->
      <div v-else-if="!guziStore.hasMore && guziStore.guziList.length > 0" class="no-more">
        已加载全部 {{ guziStore.pagination.count }} 项
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
        </div>
        <div v-if="isMobile" class="mobile-filter-host">
          <div
            v-show="mobileFilterVisible"
            class="mobile-filter-backdrop"
            @click="closeMobileFilter"
          ></div>
          <section
            class="mobile-filter-sheet"
            :class="{ 'is-open': mobileFilterVisible }"
            :aria-hidden="!mobileFilterVisible"
          >
            <div class="mobile-filter-sheet-header">
              <span>筛选谷子</span>
              <button class="mobile-filter-close" type="button" @click="closeMobileFilter" aria-label="关闭筛选">
                <el-icon><Close /></el-icon>
              </button>
            </div>
            <div class="mobile-filter-sheet-body">
              <FilterPanel force-expanded />
            </div>
          </section>
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
import { ArrowLeft, ArrowRight, Delete, Edit, Top, Loading, List, Close, Search } from '@element-plus/icons-vue'
import { useGuziStore } from '@/stores/guzi'
import { useShowcaseStore } from '@/stores/showcase'
import SearchBar from '@/components/SearchBar.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import GoodsCard from '@/components/GoodsCard.vue'
import GoodsDrawer from '@/components/GoodsDrawer.vue'
import GoodsMultiDisplayDialog from '@/components/GoodsMultiDisplayDialog.vue'
import StatsDashboard from '@/components/StatsDashboard.vue'
import ShowcaseManager from '@/components/ShowcaseManager.vue'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { useMobilePullRefresh } from '@/composables/useMobilePullRefresh'
import type { GoodsListItem } from '@/api/types'
import { deleteGoods, getGoodsList, moveGoods } from '@/api/goods'

const router = useRouter()
const guziStore = useGuziStore()
const showcaseStore = useShowcaseStore()
const { isMobile } = useResponsiveDevice()

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
const mobileFilterVisible = ref(false)
const mobileSearchExpanded = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)
let sentinelObserver: IntersectionObserver | null = null
let bodyOverflowBeforeFilter = ''
let lastScrollY = 0

const SCROLL_COLLAPSE_DISTANCE = 48

const statusLabelMap: Record<string, string> = {
  in_cabinet: '在馆',
  outdoor: '出街中',
  sold: '已售出',
}

const activeFilterChips = computed(() => {
  const filters = guziStore.filters
  const chips: string[] = []

  if (guziStore.viewMode === 'similar') {
    chips.push('相似')
  }

  if (filters.search) {
    chips.push('搜索')
  }

  const statusValues = filters.status__in
    ? filters.status__in.split(',')
    : filters.status
      ? [filters.status]
      : []

  if (statusValues.length > 0) {
    chips.push(statusValues.map(status => statusLabelMap[status] ?? status).join('/'))
  }

  if (filters.is_official === true) {
    chips.push('官谷')
  } else if (filters.is_official === false) {
    chips.push('同人')
  }

  if (filters.ip) chips.push('IP')
  if (filters.character) chips.push('角色')
  if (filters.category) chips.push('品类')
  if (filters.theme) chips.push('主题')
  if (filters.location) chips.push('位置')
  if (filters.group_by) chips.push('分组')

  return chips.slice(0, 5)
})

const visibleMobileFilterChips = computed(() =>
  activeFilterChips.value.filter(chip => chip !== statusLabelMap.in_cabinet),
)

const activeFilterCount = computed(() => activeFilterChips.value.length)

const refreshBarnList = async () => {
  guziStore.pagination.page = 1
  await guziStore.searchGuziImmediate(guziStore.filters)
}

const {
  pullDistance,
  isRefreshing,
  handleTouchStart: handleBarnPullStart,
  handleTouchMove: handleBarnPullMove,
  handleTouchEnd: handleBarnPullEnd,
  reset: resetBarnPullRefresh,
} = useMobilePullRefresh({
  enabled: computed(() => isMobile.value && activeTab.value === 'barn'),
  blocked: () => (
    mobileFilterVisible.value ||
    mobileSearchExpanded.value ||
    drawerVisible.value ||
    contextMenuVisible.value ||
    multiDisplayVisible.value ||
    guziStore.selectionMode
  ),
  onRefresh: refreshBarnList,
})

const barnPullRefreshStyle = computed(() => (
  isMobile.value && pullDistance.value > 0
    ? { transform: `translateY(${pullDistance.value}px)` }
    : undefined
))

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
  closeMobileFilter()
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
    } catch {
      return
    }
  }

  guziStore.exitSelectionMode(true)
}

const toggleMobileSearch = () => {
  mobileSearchExpanded.value = !mobileSearchExpanded.value
}

const collapseMobileSearch = () => {
  mobileSearchExpanded.value = false
}

const openMobileFilter = () => {
  mobileFilterVisible.value = true
}

const closeMobileFilter = () => {
  mobileFilterVisible.value = false
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
      await refreshBarnList()
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
  if (!isMobile.value) {
    closeMobileFilter()
    collapseMobileSearch()
  }
}

const handleWindowScroll = () => {
  const currentScrollY = Math.max(window.scrollY || 0, 0)

  if (isMobile.value && currentScrollY > lastScrollY && currentScrollY >= SCROLL_COLLAPSE_DISTANCE) {
    collapseMobileSearch()
  }

  lastScrollY = currentScrollY
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

  lastScrollY = Math.max(window.scrollY || 0, 0)
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleWindowScroll, { passive: true })

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
  document.body.style.overflow = bodyOverflowBeforeFilter
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleWindowScroll)
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
    closeMobileFilter()
    if (tab !== 'barn') {
      collapseMobileSearch()
    }
    window.dispatchEvent(new CustomEvent('cloud-showcase:tab-changed', { detail: { tab } }))
  },
)

watch(isMobile, (mobile) => {
  if (!mobile) {
    closeMobileFilter()
    collapseMobileSearch()
  }
})

watch(mobileFilterVisible, (visible) => {
  if (visible) {
    if (!isMobile.value) return
    bodyOverflowBeforeFilter = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return
  }

  document.body.style.overflow = bodyOverflowBeforeFilter
})
</script>

<style scoped>
.cloud-showcase {
  padding: 20px;
  padding-bottom: 100px; /* 为底部浮动控件预留空间 */
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 64px); /* 减去导航栏高度 */
}

.search-section {
  margin-bottom: 24px;
}

.barn-discovery {
  margin-bottom: 20px;
}

.barn-pull-refresh-wrapper {
  position: relative;
}

.pull-indicator {
  width: 100%;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  color: #909399;
  pointer-events: none;
}

.pull-indicator-content {
  height: 50px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-bottom: 10px;
  font-size: 14px;
}

.pull-indicator-content .el-icon {
  font-size: 18px;
  transition: transform 0.3s;
}

.mobile-filter-strip,
.mobile-filter-host {
  display: none;
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
  .cloud-showcase {
    padding: 12px 10px 128px;
  }

  .cloud-tabs {
    position: sticky;
    top: calc(64px + env(safe-area-inset-top));
    z-index: 30;
    margin: 0 -10px 12px;
    padding: 0 10px 8px;
    background: rgba(247, 248, 250, 0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid rgba(212, 175, 55, 0.18);
  }

  .cloud-tabs :deep(.el-tabs__header) {
    margin: 0;
  }

  .cloud-tabs :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  .cloud-tabs :deep(.el-tabs__item) {
    height: 44px;
    padding: 0 18px;
    font-size: 16px;
    font-weight: 700;
  }

  .barn-discovery {
    margin-bottom: 12px;
    padding: 10px;
    border: 1px solid rgba(212, 175, 55, 0.22);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .search-section {
    margin-bottom: 10px;
  }

  .barn-discovery :deep(.search-bar) {
    margin-bottom: 0;
  }

  .barn-discovery :deep(.search-input) {
    max-width: none;
  }

  .barn-discovery :deep(.el-input__wrapper) {
    min-height: 42px;
    border-radius: 999px;
    box-shadow: none;
    background: #ffffff;
  }

  .mobile-filter-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .mobile-filter-trigger {
    flex: 0 0 auto;
    min-width: 86px;
    height: 36px;
    border: 1px solid rgba(212, 175, 55, 0.42);
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(212, 175, 55, 0.16), rgba(234, 205, 163, 0.24));
    color: var(--primary-gold-dark);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 700;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-filter-trigger .el-icon {
    font-size: 16px;
  }

  .mobile-filter-trigger strong {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--primary-gold);
    color: #fff;
    font-size: 11px;
    line-height: 18px;
  }

  .mobile-filter-chips {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-filter-chips::-webkit-scrollbar {
    display: none;
  }

  .mobile-filter-chip {
    flex: 0 0 auto;
    max-width: 96px;
    height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
    line-height: 28px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-filter-host {
    display: block;
  }

  .mobile-filter-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1300;
    background: rgba(15, 23, 42, 0.34);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  .mobile-filter-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1301;
    max-height: min(82dvh, 720px);
    padding: 12px 12px calc(16px + env(safe-area-inset-bottom));
    border-radius: 24px 24px 0 0;
    background: #ffffff;
    box-shadow: 0 -18px 48px rgba(15, 23, 42, 0.22);
    transform: translateY(104%);
    visibility: hidden;
    pointer-events: none;
    transition:
      transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0.28s;
  }

  .mobile-filter-sheet.is-open {
    transform: translateY(0);
    visibility: visible;
    pointer-events: auto;
  }

  .mobile-filter-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 2px 12px;
    color: var(--text-dark);
    font-size: 16px;
    font-weight: 800;
  }

  .mobile-filter-close {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: #f3f4f6;
    color: #64748b;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-filter-sheet-body {
    max-height: calc(min(82dvh, 720px) - 62px);
    overflow-y: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-filter-sheet-body :deep(.filter-panel) {
    margin-bottom: 0;
  }

  .goods-grid {
    grid-template-columns: repeat(2, 1fr);
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

  @supports not (top: env(safe-area-inset-top)) {
    .cloud-tabs {
      top: 64px;
    }
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

.loading-more--mobile {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 8px 0 20px;
}

.mobile-loading-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.mobile-loading-image,
.mobile-loading-line {
  display: block;
  border-radius: 12px;
  background: linear-gradient(90deg, #f1f5f9 0%, #ffffff 50%, #f1f5f9 100%);
  background-size: 220% 100%;
  animation: mobileSkeleton 1.2s ease-in-out infinite;
}

.mobile-loading-image {
  aspect-ratio: 1;
}

.mobile-loading-line {
  height: 12px;
}

.mobile-loading-line.short {
  width: 62%;
}

@keyframes mobileSkeleton {
  0% {
    background-position: 120% 0;
  }
  100% {
    background-position: -120% 0;
  }
}

/* 已加载全部 */
.no-more {
  text-align: center;
  padding: 24px 0;
  color: var(--text-lighter, #c0c4cc);
  font-size: 13px;
}

@media (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .cloud-showcase {
    padding: 12px 10px 128px;
    min-height: calc(100dvh - 64px);
  }

  .cloud-tabs {
    position: sticky;
    top: calc(64px + env(safe-area-inset-top));
    z-index: 30;
    margin: 0 -10px 12px;
    padding: 0 10px 8px;
    background: rgba(247, 248, 250, 0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid rgba(212, 175, 55, 0.18);
  }

  .cloud-tabs :deep(.el-tabs__header) {
    margin: 0;
  }

  .cloud-tabs :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  .cloud-tabs :deep(.el-tabs__item) {
    height: 44px;
    padding: 0 18px;
    font-size: 16px;
    font-weight: 700;
  }

  .barn-discovery {
    margin-bottom: 12px;
    padding: 10px;
    border: 1px solid rgba(212, 175, 55, 0.22);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .search-section {
    margin-bottom: 10px;
  }

  .barn-discovery :deep(.search-bar) {
    margin-bottom: 0;
  }

  .barn-discovery :deep(.search-input) {
    max-width: none;
  }

  .barn-discovery :deep(.el-input__wrapper) {
    min-height: 42px;
    border-radius: 999px;
    box-shadow: none;
    background: #ffffff;
  }

  .mobile-filter-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .mobile-filter-trigger {
    flex: 0 0 auto;
    min-width: 86px;
    height: 36px;
    border: 1px solid rgba(212, 175, 55, 0.42);
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(212, 175, 55, 0.16), rgba(234, 205, 163, 0.24));
    color: var(--primary-gold-dark);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 700;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-filter-trigger .el-icon {
    font-size: 16px;
  }

  .mobile-filter-trigger strong {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--primary-gold);
    color: #fff;
    font-size: 11px;
    line-height: 18px;
  }

  .mobile-filter-chips {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-filter-chips::-webkit-scrollbar {
    display: none;
  }

  .mobile-filter-chip {
    flex: 0 0 auto;
    max-width: 96px;
    height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
    line-height: 28px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-filter-host {
    display: block;
  }

  .mobile-filter-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1300;
    background: rgba(15, 23, 42, 0.34);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  .mobile-filter-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1301;
    max-height: min(82dvh, 720px);
    padding: 12px 12px calc(16px + env(safe-area-inset-bottom));
    border-radius: 24px 24px 0 0;
    background: #ffffff;
    box-shadow: 0 -18px 48px rgba(15, 23, 42, 0.22);
    transform: translateY(104%);
    visibility: hidden;
    pointer-events: none;
    transition:
      transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0.28s;
  }

  .mobile-filter-sheet.is-open {
    transform: translateY(0);
    visibility: visible;
    pointer-events: auto;
  }

  .mobile-filter-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 2px 12px;
    color: var(--text-dark);
    font-size: 16px;
    font-weight: 800;
  }

  .mobile-filter-close {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: #f3f4f6;
    color: #64748b;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-filter-sheet-body {
    max-height: calc(min(82dvh, 720px) - 62px);
    overflow-y: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-filter-sheet-body :deep(.filter-panel) {
    margin-bottom: 0;
  }

  .goods-grid {
    grid-template-columns: repeat(2, 1fr);
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

}

@media (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  @supports not (top: env(safe-area-inset-top)) {
    .cloud-tabs {
      top: 64px;
    }
  }

}

@media (max-width: 768px), (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .cloud-showcase {
    padding-top: 8px;
  }

  .barn-pull-refresh-content {
    will-change: transform;
  }

  .cloud-tabs {
    margin: 0 -10px 8px;
    padding: 0 10px 4px;
  }

  .cloud-tabs :deep(.el-tabs__item) {
    height: 38px;
    padding: 0 14px;
    font-size: 15px;
  }

  .barn-discovery {
    margin-bottom: 8px;
    padding: 6px;
    border-radius: 14px;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
  }

  .barn-discovery.is-search-expanded {
    padding-top: 8px;
  }

  .search-section {
    margin-bottom: 6px;
  }

  .mobile-search-expand-enter-active,
  .mobile-search-expand-leave-active {
    overflow: hidden;
    transition:
      opacity 0.2s ease,
      transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1),
      max-height 0.24s ease,
      margin-bottom 0.24s ease;
  }

  .mobile-search-expand-enter-from,
  .mobile-search-expand-leave-to {
    opacity: 0;
    transform: translateY(-6px);
    max-height: 0;
    margin-bottom: 0;
  }

  .mobile-search-expand-enter-to,
  .mobile-search-expand-leave-from {
    opacity: 1;
    transform: translateY(0);
    max-height: 56px;
  }

  .barn-discovery :deep(.el-input__wrapper) {
    min-height: 38px;
  }

  .mobile-filter-strip {
    gap: 6px;
  }

  .mobile-search-trigger,
  .mobile-filter-trigger {
    height: 32px;
    min-width: 0;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 700;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-search-trigger {
    flex: 0 0 72px;
    border: 1px solid rgba(148, 163, 184, 0.28);
    background: #ffffff;
    color: #64748b;
  }

  .mobile-search-trigger.is-active {
    border-color: rgba(212, 175, 55, 0.42);
    background: rgba(212, 175, 55, 0.12);
    color: var(--primary-gold-dark);
  }

  .mobile-filter-trigger {
    flex: 0 0 76px;
    border-color: rgba(212, 175, 55, 0.38);
  }

  .mobile-search-trigger .el-icon,
  .mobile-filter-trigger .el-icon {
    font-size: 15px;
  }

  .mobile-filter-trigger strong {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    line-height: 16px;
  }

  .mobile-filter-chips {
    gap: 5px;
  }

  .mobile-filter-chips:empty {
    display: none;
  }

  .mobile-filter-chip {
    max-width: 84px;
    height: 26px;
    padding: 0 8px;
    font-size: 11px;
    line-height: 24px;
  }

  .list-section {
    margin-top: 14px;
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
