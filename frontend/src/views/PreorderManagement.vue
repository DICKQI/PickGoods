<template>
  <div class="preorder-page">
    <div class="preorder-page-inner">
      <!-- 玻璃拟态 Hero：眉题 + 标题 + 统计指标（桌面端） -->
      <section v-if="!isMobile" class="preorder-hero">
        <div class="preorder-hero-left">
          <span class="preorder-eyebrow">PREORDER &amp; REMINDER</span>
          <h1 class="preorder-title">预购与尾款提醒</h1>
          <p class="preorder-subtitle">登记外部平台下单的手办定金，临近补款期时右上角通知中心会提醒你</p>
        </div>
        <div class="preorder-hero-right">
          <div class="preorder-metrics" role="group" aria-label="预购统计">
            <div class="preorder-metric">
              <span class="metric-value">{{ stats.pending_count }}</span>
              <span class="metric-label">待补款</span>
            </div>
            <div class="preorder-metric">
              <span class="metric-value is-purple">{{ stats.due_this_month }}</span>
              <span class="metric-label">本月到期</span>
            </div>
            <div class="preorder-metric">
              <span class="metric-value is-purple">{{ stats.due_this_quarter }}</span>
              <span class="metric-label">本季到期</span>
            </div>
            <div class="preorder-metric">
              <span class="metric-value">{{ stats.converted_count }}</span>
              <span class="metric-label">已转正</span>
            </div>
            <div class="preorder-metric">
              <span class="metric-value is-gold">¥{{ formatAmount(stats.total_pending_balance) }}</span>
              <span class="metric-label">待补尾款</span>
            </div>
          </div>
          <el-button class="preorder-add-btn" type="primary" :icon="Plus" @click="openCreate">新增预购</el-button>
        </div>
      </section>

      <!-- 工具栏：状态筛选 + 搜索（桌面端） -->
      <section v-if="!isMobile" class="preorder-toolbar">
        <el-segmented
          v-model="statusFilter"
          :options="STATUS_OPTIONS"
          class="preorder-status-filter"
          @change="handleFilterChange"
        />
        <el-input
          v-model="searchKeyword"
          placeholder="搜索手办名称"
          clearable
          class="preorder-search"
          @input="handleSearchInput"
          @clear="handleSearchClear"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </section>

      <!-- 精装表格面板（桌面端） -->
      <section v-if="!isMobile" class="preorder-table-panel">
        <el-table
          v-if="!isMobile"
          ref="tableRef"
          v-loading="loading"
          :data="preorders"
          row-key="id"
          class="preorder-table"
          :class="{ 'is-switching': switching }"
          :row-class-name="rowClassName"
        >
          <el-table-column label="手办名称" min-width="200">
            <template #default="{ row }">
              <span class="preorder-name-cell">
                <span class="preorder-name-tile"><el-icon><ShoppingCart /></el-icon></span>
                <OverflowMarquee class="preorder-name-text" :text="row.name" />
              </span>
            </template>
          </el-table-column>
          <el-table-column label="平台 / 店铺" min-width="150">
            <template #default="{ row }">
              <div class="cell-platform">
                <span v-if="row.platform" class="platform-tag">{{ row.platform }}</span>
                <span v-if="row.shop_name" class="cell-shop">{{ row.shop_name }}</span>
                <span v-if="!row.platform && !row.shop_name" class="cell-muted">—</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="定金 / 尾款" width="160">
            <template #default="{ row }">
              <div class="cell-amount">
                <span class="deposit">¥{{ formatAmount(row.deposit_amount) }}</span>
                <span class="cell-muted">尾款 {{ row.balance_amount !== null && row.balance_amount !== undefined ? '¥' + formatAmount(row.balance_amount) : '未知' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="预计补款时间" width="230" sortable :sort-by="sortByMonth">
            <template #default="{ row }">
              <span class="preorder-month-cell">
                <span>{{ formatMonth(row) }}</span>
                <span v-if="isDueNow(row)" class="month-due-tag">{{ row.time_granularity === 'quarter' ? '补款期' : '已到期' }}</span>
                <span v-if="row.delay_count > 0" class="month-delay-tag" :title="`已延期 ${row.delay_count} 次`">延期×{{ row.delay_count }}</span>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <span class="preorder-status-pill" :class="row.status">{{ statusLabel(row.status) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="290" fixed="right">
            <template #default="{ row }">
              <div class="cell-actions">
                <el-button v-if="row.status === 'pending'" link type="primary" size="small" class="action-mark" @click="handleMarkPaid(row)">标记补款</el-button>
                <el-button v-if="row.status === 'pending'" link type="warning" size="small" class="action-delay" @click="openDelay(row)">延期</el-button>
                <el-button v-if="row.status === 'paid'" link type="primary" size="small" class="action-convert" @click="openConvert(row)">转正为谷子</el-button>
                <el-button v-if="row.status === 'converted' && row.goods_id" link type="primary" size="small" class="action-goods" @click="goToGoods(row)">查看谷子</el-button>
                <el-button link type="info" size="small" class="action-edit" @click="openEdit(row)">编辑</el-button>
                <el-button v-if="row.status === 'pending'" link type="warning" size="small" class="action-cancel" @click="handleCancelPreorder(row)">取消</el-button>
                <el-button link type="danger" size="small" class="action-delete" @click="handleDelete(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <el-empty
          v-if="!isMobile && !loading && !switching && preorders.length === 0"
          :description="emptyText"
          :image-size="88"
          class="preorder-empty"
        />
        <div v-if="!isMobile && total > pageSize" class="pagination-wrapper">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            @current-change="handlePageChange"
          />
        </div>
      </section>

      <!-- 移动端：紧凑页头 + 主次统计 + 吸顶筛选 + 无限滚动卡片 -->
      <section
        v-if="isMobile"
        class="preorder-mobile-page"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <div class="preorder-mobile-pull" :style="{ height: pullDistance + 'px' }">
          <el-icon :class="{ 'is-spinning': isRefreshing }"><Loading /></el-icon>
          <span>{{ isRefreshing ? '刷新中…' : '下拉刷新' }}</span>
        </div>

        <header class="preorder-mobile-header">
          <h1 class="preorder-mobile-title">预购与尾款提醒</h1>
        </header>

        <PreorderMobileStats :stats="stats" />

        <PreorderMobileFilterBar
          v-model:status-filter="statusFilter"
          v-model:search-keyword="searchKeyword"
          :total="total"
          @search="handleSearchInput"
          @clear="handleSearchClear"
          @status-change="handleFilterChange"
        />

        <div v-if="loading" class="preorder-mobile-skeletons">
          <div v-for="n in 3" :key="n" class="preorder-mobile-skeleton"></div>
        </div>

        <template v-else>
          <div class="preorder-mobile-list" :class="{ 'is-switching': switching }" @scroll.passive="handleListScroll">
            <div v-for="item in preorders" :id="'preorder-row-' + item.id" :key="item.id">
              <PreorderMobileCard
                :ref="setCardRef(item.id)"
                :item="item"
                :highlight="item.id === highlightId"
                @primary="handleMobilePrimary(item)"
                @menu="openCardMenu(item)"
                @swipe-action="handleMobileSwipe(item, $event)"
                @swipe-start="closeAllSwipe(item.id)"
              />
            </div>
          </div>
          <el-empty
            v-if="!switching && preorders.length === 0"
            :description="emptyText"
            :image-size="88"
          >
            <el-button type="primary" class="preorder-mobile-empty-btn" @click="openCreate">新增预购</el-button>
          </el-empty>
          <div ref="sentinelRef" class="preorder-mobile-sentinel" :class="{ 'is-hidden': !hasNext }">
            <span v-if="hasNext && !loadError">加载中…</span>
          </div>
          <div v-if="!hasNext && preorders.length > 0" class="preorder-mobile-end">没有更多了</div>
          <button v-if="loadError" type="button" class="preorder-mobile-retry" @click="loadMore">
            加载失败，点击重试
          </button>
        </template>
      </section>

      <!-- 移动端：新增预购 FAB -->
      <button v-if="isMobile" type="button" class="preorder-mobile-fab" aria-label="新增预购" @click="openCreate">
        <el-icon><Plus /></el-icon>
      </button>

      <!-- 新增 / 编辑对话框（编辑器式） -->
      <el-dialog
        v-if="!isMobile"
        v-model="formDialogVisible"
        :title="editingTarget ? '编辑预购' : '新增预购'"
        width="920px"
        class="custom-dialog preorder-editor-dialog preorder-form-dialog"
        :show-close="false"
        :close-on-click-modal="false"
        align-center
      >
        <template #header>
          <div class="preorder-editor-header">
            <span class="preorder-editor-icon"><el-icon><ShoppingCart /></el-icon></span>
            <div class="preorder-editor-heading">
              <span class="preorder-editor-kicker">PREORDER FORM</span>
              <h3>{{ editingTarget ? '编辑预购' : '新增预购' }}</h3>
              <p>{{ editingTarget ? '修改订单信息、金额与备注' : '登记外部平台下单的手办定金' }}</p>
            </div>
            <button type="button" class="preorder-editor-close" aria-label="关闭" @click="formDialogVisible = false">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </template>
        <PreorderEditorForm
          :visible="formDialogVisible"
          :editing-target="editingTarget"
          @close="formDialogVisible = false"
          @saved="handleEditorSaved"
        />
      </el-dialog>

      <!-- 跳票延期对话框（同款编辑器式） -->
      <el-dialog
        v-if="!isMobile"
        v-model="delayDialogVisible"
        title="跳票延期"
        width="640px"
        class="custom-dialog preorder-editor-dialog preorder-action-dialog preorder-delay-dialog"
        :show-close="false"
        :close-on-click-modal="false"
        align-center
      >
        <template #header>
          <div class="preorder-editor-header">
            <span class="preorder-editor-icon"><el-icon><Clock /></el-icon></span>
            <div class="preorder-editor-heading">
              <span class="preorder-editor-kicker">DELAY PREORDER</span>
              <h3>跳票延期</h3>
              <p>厂家跳票时顺延补款时间，旧提醒自动失效并按新时间重新提醒</p>
            </div>
            <button type="button" class="preorder-editor-close" aria-label="关闭" @click="delayDialogVisible = false">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </template>
        <PreorderDelayDialog
          :visible="delayDialogVisible"
          :target="delayTarget"
          @close="delayDialogVisible = false"
          @delayed="handleDelaySettled"
        />
      </el-dialog>

      <!-- 转正为谷子对话框（同款编辑器式） -->
      <el-dialog
        v-if="!isMobile"
        v-model="convertDialogVisible"
        title="转正为谷子"
        width="640px"
        class="custom-dialog preorder-editor-dialog preorder-action-dialog preorder-convert-dialog"
        :show-close="false"
        :close-on-click-modal="false"
        align-center
      >
        <template #header>
          <div class="preorder-editor-header">
            <span class="preorder-editor-icon is-purple"><el-icon><MagicStick /></el-icon></span>
            <div class="preorder-editor-heading">
              <span class="preorder-editor-kicker">CONVERT TO GOODS</span>
              <h3>转正为谷子</h3>
              <p>补款完成后将预购登记转为平台内谷子</p>
            </div>
            <button type="button" class="preorder-editor-close" aria-label="关闭" @click="convertDialogVisible = false">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </template>
        <ConvertGoodsForm
          :visible="convertDialogVisible"
          :target="convertTarget"
          @close="convertDialogVisible = false"
          @converted="handleConverted"
        />
      </el-dialog>

      <!-- 移动端：新增 / 编辑底部抽屉 -->
      <BaseBottomSheet
        v-if="isMobile"
        v-model="formDialogVisible"
        :title="editingTarget ? '编辑预购' : '新增预购'"
        :subtitle="editingTarget ? '修改订单信息、金额与备注' : '登记外部平台下单的手办定金'"
      >
        <PreorderEditorForm
          :visible="formDialogVisible"
          :editing-target="editingTarget"
          @close="formDialogVisible = false"
          @saved="handleEditorSaved"
        />
      </BaseBottomSheet>

      <!-- 移动端：跳票延期底部抽屉 -->
      <BaseBottomSheet
        v-if="isMobile"
        v-model="delayDialogVisible"
        title="跳票延期"
        subtitle="厂家跳票时顺延补款时间，旧提醒自动失效"
      >
        <PreorderDelayDialog
          :visible="delayDialogVisible"
          :target="delayTarget"
          @close="delayDialogVisible = false"
          @delayed="handleDelaySettled"
        />
      </BaseBottomSheet>

      <!-- 移动端：转正为谷子底部抽屉 -->
      <BaseBottomSheet
        v-if="isMobile"
        v-model="convertDialogVisible"
        title="转正为谷子"
        subtitle="补款完成后将预购登记转为平台内谷子"
      >
        <ConvertGoodsForm
          :visible="convertDialogVisible"
          :target="convertTarget"
          @close="convertDialogVisible = false"
          @converted="handleConverted"
        />
      </BaseBottomSheet>

      <!-- 移动端：卡片 ⋯ 操作菜单 -->
      <MobileActionSheet
        v-model="menuSheetVisible"
        :title="menuItem ? menuItem.name : ''"
        :actions="menuActions"
        @select="handleMenuSelect"
      />

      <!-- 移动端：危险操作底部确认面板 -->
      <MobileActionSheet
        v-model="confirmSheetVisible"
        :title="confirmSheet ? confirmSheet.title : ''"
        :actions="[]"
        :message="confirmSheet ? confirmSheet.message : ''"
        :confirm-text="confirmSheet ? confirmSheet.confirmText : '确认'"
        :confirm-tone="confirmSheet ? confirmSheet.tone : 'primary'"
        @confirm="handleConfirmAction"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, Close, Delete, Edit, Loading, MagicStick, Plus, Search, ShoppingCart } from '@element-plus/icons-vue'
import * as reminderApi from '@/api/reminder'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { usePreorderList } from '@/composables/usePreorderList'
import { usePreorderStats } from '@/composables/usePreorderStats'
import { useMobilePullRefresh } from '@/composables/useMobilePullRefresh'
import BaseBottomSheet from '@/components/ui/BaseBottomSheet.vue'
import OverflowMarquee from '@/components/ui/OverflowMarquee.vue'
import MobileActionSheet from '@/components/MobileActionSheet.vue'
import PreorderEditorForm from '@/components/preorder/PreorderEditorForm.vue'
import PreorderDelayDialog from '@/components/preorder/PreorderDelayDialog.vue'
import ConvertGoodsForm from '@/components/preorder/ConvertGoodsForm.vue'
import PreorderMobileStats from '@/components/preorder/PreorderMobileStats.vue'
import PreorderMobileFilterBar from '@/components/preorder/PreorderMobileFilterBar.vue'
import PreorderMobileCard from '@/components/preorder/PreorderMobileCard.vue'
import { PREORDER_STATUS_OPTIONS } from '@/utils/preorder'
import { formatAmount, formatMonth, isDueNow, preorderStatusLabel } from '@/utils/preorder'
import type { Preorder, PreorderStatus } from '@/api/types'

const route = useRoute()
const router = useRouter()
const { isMobile } = useResponsiveDevice()

const STATUS_OPTIONS = PREORDER_STATUS_OPTIONS
const statusLabel = preorderStatusLabel

const sortByMonth = (row: Preorder) => row.estimated_month

// ─── 统计概览 ───
const { stats, loadStats } = usePreorderStats()

// ─── 列表（桌面分页 / 移动无限滚动共用逻辑） ───
const list = usePreorderList({
  isInfinite: () => isMobile.value,
  initialStatus: (route.query.status as PreorderStatus | '') || '',
})
const {
  preorders,
  total,
  page,
  pageSize,
  loading,
  switching,
  hasNext,
  loadError,
  statusFilter,
  searchKeyword,
  emptyText,
  loadInitial,
  loadMore,
  refresh,
  handleFilterChange,
  handleSearchInput,
  handleSearchClear,
  loadUntilId,
} = list
const highlightId = ref<string | null>(null)
const tableRef = ref()

// ─── 移动端左滑复位：滚动 / 点击非操作区时统一收起所有已展开的滑动操作 ───
const cardRefs = new Map<string, InstanceType<typeof PreorderMobileCard>>()
const setCardRef = (id: string) => (el: unknown) => {
  if (el) {
    cardRefs.set(id, el as InstanceType<typeof PreorderMobileCard>)
  } else {
    cardRefs.delete(id)
  }
}
const closeAllSwipe = (exceptId?: string) => {
  cardRefs.forEach((card, id) => {
    if (id !== exceptId) card.closeSwipe()
  })
}
const handleGlobalTouchStart = (e: Event) => {
  const target = e.target as HTMLElement | null
  // 点击已露出的“编辑/删除”按钮时不收起，保证操作可点中
  if (target?.closest('.preorder-mobile-card__swipe-actions')) return
  closeAllSwipe()
}
const handleWindowScroll = () => closeAllSwipe()
const handleListScroll = () => closeAllSwipe()
let swipeResetListenersAttached = false
const syncSwipeResetListeners = (mobile: boolean) => {
  if (mobile && !swipeResetListenersAttached) {
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
    window.addEventListener('touchstart', handleGlobalTouchStart, { passive: true })
    swipeResetListenersAttached = true
  } else if (!mobile && swipeResetListenersAttached) {
    window.removeEventListener('scroll', handleWindowScroll)
    window.removeEventListener('touchstart', handleGlobalTouchStart)
    swipeResetListenersAttached = false
  }
}

const handlePageChange = (p: number) => {
  page.value = p
  loadInitial()
}

const rowClassName = ({ row }: { row: Preorder }) =>
  highlightId.value === row.id ? 'preorder-row-highlight' : ''

// 通知点击跳转：高亮并滚动定位目标预购
// - 目标在当前列表 → 直接高亮；
// - 不在当前列表 → 清空筛选，按最大页容量探测其所在页码并跳转（预购总数
//   超过 100 条时探测失败，退化为回到第一页）；
// - 桌面表格行通过 el-table 的 data-row-key 定位滚动，移动端卡片有行 id。
const locatePreorderPage = async (id: string): Promise<number | null> => {
  try {
    const data = await reminderApi.listPreorders({ page_size: 100 })
    const index = data.results.findIndex((p) => p.id === id)
    if (index === -1) return null
    return Math.floor(index / pageSize) + 1
  } catch {
    return null
  }
}

const clearHighlightQuery = () => {
  const query = { ...route.query }
  delete query.highlight
  router.replace({ path: route.path, query })
}

const applyHighlight = (id: string) => {
  highlightId.value = id
  nextTick(() => {
    // 移动端卡片有行 id；桌面 el-table 的 tr 无 data-row-key 属性（EP 2.13），
    // 用响应式高亮 class 定位
    const el =
      document.getElementById('preorder-row-' + id) ??
      tableRef.value?.$el?.querySelector?.('tr.preorder-row-highlight')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  // 清除 query，避免刷新后重复高亮
  clearHighlightQuery()
  setTimeout(() => {
    highlightId.value = null
  }, 4000)
}

const resolveHighlight = async () => {
  const id = typeof route.query.highlight === 'string' ? route.query.highlight : null
  if (!id) return
  if (preorders.value.some((p) => p.id === id)) {
    applyHighlight(id)
    return
  }
  // 目标不在当前列表：清空筛选后定位
  statusFilter.value = ''
  searchKeyword.value = ''
  if (isMobile.value) {
    // 移动端无限滚动：回到第一页后顺序翻页探测
    page.value = 1
    await loadInitial()
    const found = await loadUntilId(id)
    if (found) {
      applyHighlight(id)
    } else {
      ElMessage.info('未找到对应预购，已回到第一页')
      clearHighlightQuery()
    }
    return
  }
  // 桌面分页：按最大页容量探测其所在页码并跳转
  const targetPage = await locatePreorderPage(id)
  page.value = targetPage ?? 1
  await loadInitial()
  if (preorders.value.some((p) => p.id === id)) {
    applyHighlight(id)
  } else {
    // 超出探测范围等极端情况：清除 query，避免刷新后重复处理
    clearHighlightQuery()
  }
}

// 已停留在本页时再次点击通知：query 变化触发重新定位
watch(
  () => route.query.highlight,
  (highlight) => {
    if (typeof highlight === 'string') resolveHighlight()
  }
)

// ─── 新增 / 编辑（表单逻辑在 PreorderEditorForm / usePreorderEditor） ───
const formDialogVisible = ref(false)
const editingTarget = ref<Preorder | null>(null)

const openCreate = () => {
  editingTarget.value = null
  formDialogVisible.value = true
}

const openEdit = (item: Preorder) => {
  editingTarget.value = item
  formDialogVisible.value = true
}

const handleEditorSaved = async () => {
  formDialogVisible.value = false
  // 移动端无限滚动：回到第一页，保证新增/修改记录立即可见
  if (isMobile.value) page.value = 1
  await Promise.all([loadInitial(), loadStats()])
}

// ─── 跳票延期（表单逻辑在 PreorderDelayDialog / usePreorderDelay） ───
const delayDialogVisible = ref(false)
const delayTarget = ref<Preorder | null>(null)

const openDelay = (item: Preorder) => {
  delayTarget.value = item
  delayDialogVisible.value = true
}

const handleDelaySettled = async () => {
  delayDialogVisible.value = false
  ElMessage.success('已延期，提醒已按新时间更新')
  if (isMobile.value) page.value = 1
  await Promise.all([loadInitial(), loadStats()])
}

// ─── 状态流转（桌面 ElMessageBox 确认；移动端复用 perform* + 底部确认面板） ───
const performMarkPaid = async (item: Preorder) => {
  const updated = await reminderApi.markPreorderPaid(item.id)
  ElMessage.success('已标记补款')
  if (isMobile.value) {
    // 移动端保持无限滚动列表不坍塌：本地替换该条状态，仅刷新统计
    preorders.value = preorders.value.map((p) => (p.id === item.id ? updated : p))
    await loadStats()
  } else {
    await Promise.all([loadInitial(), loadStats()])
  }
}

const performCancelPreorder = async (item: Preorder) => {
  await reminderApi.cancelPreorder(item.id)
  ElMessage.success('已取消')
  if (isMobile.value) {
    preorders.value = preorders.value.map((p) =>
      p.id === item.id ? { ...p, status: 'cancelled' as const } : p
    )
    await loadStats()
  } else {
    await Promise.all([loadInitial(), loadStats()])
  }
}

const deleteMessage = (item: Preorder) =>
  item.goods_id
    ? '该预购已转正为谷子，删除仅移除预购记录，谷子不受影响。确定删除？'
    : '确定删除「' + item.name + '」？相关通知将一并删除。'

const performDelete = async (item: Preorder) => {
  await reminderApi.deletePreorder(item.id)
  ElMessage.success('已删除')
  if (isMobile.value) {
    preorders.value = preorders.value.filter((p) => p.id !== item.id)
    total.value = Math.max(0, total.value - 1)
    await loadStats()
  } else {
    await Promise.all([loadInitial(), loadStats()])
  }
}

const handleMarkPaid = async (item: Preorder) => {
  await ElMessageBox.confirm(
    '确认将「' + item.name + '」标记为已补款？此操作不可撤销。',
    '标记已补款',
    { type: 'warning', confirmButtonText: '确认补款', cancelButtonText: '再想想' }
  )
  await performMarkPaid(item)
}

const handleCancelPreorder = async (item: Preorder) => {
  await ElMessageBox.confirm(
    '确认取消「' + item.name + '」的预购登记？相关提醒将失效。',
    '取消预购',
    { type: 'warning', confirmButtonText: '确认取消', cancelButtonText: '再想想' }
  )
  await performCancelPreorder(item)
}

const handleDelete = async (item: Preorder) => {
  await ElMessageBox.confirm(deleteMessage(item), '删除预购', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await performDelete(item)
}

// ─── 移动端：卡片主操作 / ⋯ 菜单 / 左滑快捷操作 ───
const menuItem = ref<Preorder | null>(null)
const menuSheetVisible = ref(false)

const menuActions = computed(() => {
  const item = menuItem.value
  if (!item) return []
  const actions: Array<{ key: string; label: string; icon: Component; tone?: 'default' | 'primary' | 'danger' }> = [
    { key: 'edit', label: '编辑', icon: markRaw(Edit) },
  ]
  if (item.status === 'pending') {
    actions.push({ key: 'delay', label: '跳票延期', icon: markRaw(Clock), tone: 'primary' })
    actions.push({ key: 'cancel', label: '取消预购', icon: markRaw(Close), tone: 'danger' })
  }
  actions.push({ key: 'delete', label: '删除', icon: markRaw(Delete), tone: 'danger' })
  return actions
})

interface MobileConfirm {
  title: string
  message: string
  confirmText: string
  tone: 'primary' | 'danger'
  action: () => Promise<void>
}

const confirmSheet = ref<MobileConfirm | null>(null)
const confirmSheetVisible = ref(false)

const requestConfirm = (config: MobileConfirm) => {
  confirmSheet.value = config
  confirmSheetVisible.value = true
}

const handleConfirmAction = async () => {
  const config = confirmSheet.value
  if (!config) return
  await config.action()
}

const openCardMenu = (item: Preorder) => {
  menuItem.value = item
  menuSheetVisible.value = true
}

const handleMenuSelect = (key: string) => {
  const item = menuItem.value
  if (!item) return
  if (key === 'edit') {
    openEdit(item)
  } else if (key === 'delay') {
    openDelay(item)
  } else if (key === 'cancel') {
    requestConfirm({
      title: '取消预购',
      message: '确认取消「' + item.name + '」的预购登记？相关提醒将失效。',
      confirmText: '确认取消',
      tone: 'danger',
      action: () => performCancelPreorder(item),
    })
  } else if (key === 'delete') {
    requestConfirm({
      title: '删除预购',
      message: deleteMessage(item),
      confirmText: '删除',
      tone: 'danger',
      action: () => performDelete(item),
    })
  }
}

const handleMobilePrimary = (item: Preorder) => {
  if (item.status === 'pending') {
    requestConfirm({
      title: '标记已补款',
      message: '确认将「' + item.name + '」标记为已补款？此操作不可撤销。',
      confirmText: '确认补款',
      tone: 'primary',
      action: () => performMarkPaid(item),
    })
  } else if (item.status === 'paid') {
    openConvert(item)
  } else if (item.status === 'converted' && item.goods_id) {
    goToGoods(item)
  }
}

const handleMobileSwipe = (item: Preorder, key: 'edit' | 'delete') => {
  if (key === 'edit') {
    openEdit(item)
  } else {
    requestConfirm({
      title: '删除预购',
      message: deleteMessage(item),
      confirmText: '删除',
      tone: 'danger',
      action: () => performDelete(item),
    })
  }
}

// ─── 移动端：下拉刷新 ───
const {
  pullDistance,
  isRefreshing,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = useMobilePullRefresh({
  enabled: isMobile,
  onRefresh: async () => {
    await Promise.all([refresh(), loadStats()])
  },
})

// ─── 移动端：无限滚动哨兵 ───
const sentinelRef = ref<HTMLElement | null>(null)
let sentinelObserver: IntersectionObserver | null = null

const setupSentinelObserver = () => {
  sentinelObserver?.disconnect()
  if (typeof IntersectionObserver === 'undefined' || !sentinelRef.value) return
  sentinelObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMore()
      }
    },
    { rootMargin: '200px 0px' }
  )
  sentinelObserver.observe(sentinelRef.value)
}

// 设备断点切换：重置到第一页，避免分页 / 合并语义错乱；
// 并重建哨兵观察，避免断点往返后观察器仍挂在已卸载的旧 DOM 上
watch(isMobile, (mobile) => {
  page.value = 1
  loadInitial()
  nextTick(setupSentinelObserver)
  syncSwipeResetListeners(mobile)
})

const goToGoods = (item: Preorder) => {
  if (item.goods_id) {
    router.push('/goods/' + item.goods_id + '/edit')
  }
}

// ─── 转正为谷子（表单逻辑在 ConvertGoodsForm / usePreorderConvert） ───
const convertDialogVisible = ref(false)
const convertTarget = ref<Preorder | null>(null)

const openConvert = (item: Preorder) => {
  convertTarget.value = item
  convertDialogVisible.value = true
}

const handleConverted = async () => {
  convertDialogVisible.value = false
  if (isMobile.value) page.value = 1
  await Promise.all([loadInitial(), loadStats()])
}

onMounted(async () => {
  syncSwipeResetListeners(isMobile.value)
  loadStats()
  await loadInitial()
  nextTick(setupSentinelObserver)
  // 带 highlight 进入页面（通知跳转 / 刷新）：列表加载完成后尝试定位
  if (route.query.highlight) await resolveHighlight()
})

onUnmounted(() => {
  syncSwipeResetListeners(false)
  sentinelObserver?.disconnect()
  list.clearSearchTimer()
})
</script>
<style scoped>
/* ─── 页面背景：柔和金紫渐变 ─── */
.preorder-page {
  min-height: calc(100vh - 64px);
  padding: 24px 20px 48px;
  background:
    radial-gradient(1100px 460px at 88% -10%, rgba(212, 175, 55, 0.13), transparent 62%),
    radial-gradient(900px 440px at -6% 2%, rgba(162, 155, 254, 0.15), transparent 58%),
    linear-gradient(180deg, #fcfbf7 0%, #f8f6ff 100%);
}

.preorder-page-inner {
  max-width: 1400px;
  margin: 0 auto;
}

/* ─── 玻璃拟态 Hero ─── */
.preorder-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  padding: 26px 30px;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 20px;
  background:
    radial-gradient(circle at 94% -20%, rgba(212, 175, 55, 0.22), transparent 44%),
    radial-gradient(circle at 0% 130%, rgba(162, 155, 254, 0.18), transparent 46%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(250, 248, 255, 0.9));
  backdrop-filter: blur(14px);
  box-shadow:
    0 16px 40px -18px rgba(212, 175, 55, 0.3),
    0 10px 30px -18px rgba(162, 155, 254, 0.28);
  overflow: hidden;
}

.preorder-hero::after {
  content: '';
  position: absolute;
  right: -70px;
  bottom: -90px;
  width: 230px;
  height: 230px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.16), transparent 66%);
  pointer-events: none;
}

.preorder-hero-left {
  position: relative;
  z-index: 1;
  min-width: 280px;
}

.preorder-eyebrow {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 248, 230, 0.9);
  border: 1px solid rgba(212, 175, 55, 0.35);
  color: #8a650b;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}

.preorder-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  color: #2f2a20;
  line-height: 1.25;
  background: linear-gradient(120deg, #2f2a20 30%, #9a740b 90%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.preorder-subtitle {
  margin: 8px 0 0;
  font-size: 13px;
  color: #6f6a7f;
  line-height: 1.55;
}

.preorder-hero-right {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
}

/* 指标胶囊 */
.preorder-metrics {
  display: inline-flex;
  border: 1px solid rgba(212, 175, 55, 0.24);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(6px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  overflow: hidden;
}

.preorder-metric {
  min-width: 96px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  border-left: 1px solid rgba(212, 175, 55, 0.14);
}

.preorder-metric:first-child {
  border-left: none;
}

.metric-value {
  font-size: 20px;
  font-weight: 800;
  color: #2f2a20;
  line-height: 1.2;
}

.metric-value.is-purple {
  color: var(--accent-purple-dark);
}

.metric-value.is-gold {
  color: #9a740b;
}

.metric-label {
  font-size: 11px;
  color: #6b7280;
}

/* 新增按钮：紫色渐变胶囊 */
.preorder-add-btn {
  height: 40px;
  padding: 0 22px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-purple-hover) 100%);
  font-weight: 800;
  letter-spacing: 0.02em;
  box-shadow: 0 8px 20px -8px rgba(142, 125, 255, 0.55);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.preorder-add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px -8px rgba(142, 125, 255, 0.6);
}

/* ─── 工具栏 ─── */
.preorder-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
  padding: 12px 16px;
  border: 1px solid rgba(212, 175, 55, 0.18);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 26px -20px rgba(17, 24, 39, 0.35);
}

/* 状态筛选：圆润胶囊 + 柔和香槟金选中态
   （el-segmented 2.13 的选项圆角为硬编码 calc(--el-border-radius-base - 2px)，
   需直接覆盖规则而非 CSS 变量） */
.preorder-status-filter :deep(.el-segmented) {
  --el-segmented-bg-color: rgba(244, 243, 247, 0.9);
  --el-segmented-padding: 3px;
  --el-segmented-item-selected-bg-color: linear-gradient(135deg, #fdf4da 0%, #f4da94 100%);
  --el-segmented-item-selected-color: #7a5b08;
  --el-segmented-item-hover-bg-color: rgba(212, 175, 55, 0.1);
  --el-segmented-item-hover-color: #8a650b;
  --el-segmented-item-active-bg-color: rgba(212, 175, 55, 0.18);
  border-radius: 999px;
  box-shadow: inset 0 1px 3px rgba(41, 34, 24, 0.06);
}

.preorder-status-filter :deep(.el-segmented__item) {
  padding: 0 18px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: color 0.2s ease, background-color 0.2s ease;
}

/* 选中滑块：全圆角 + 柔和金影 + 内高光 */
.preorder-status-filter :deep(.el-segmented__item-selected) {
  border-radius: 999px;
  box-shadow: 0 3px 10px rgba(212, 175, 55, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.preorder-status-filter :deep(.el-segmented__item.is-selected) {
  font-weight: 800;
}

.preorder-search {
  width: 240px;
}

.preorder-search :deep(.el-input__wrapper) {
  min-height: 38px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.preorder-search :deep(.el-input__wrapper.is-focus) {
  border-color: rgba(212, 175, 55, 0.72);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
}

/* ─── 精装表格面板 ─── */
.preorder-table-panel {
  position: relative;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 18px 44px -24px rgba(212, 175, 55, 0.32),
    0 10px 28px -18px rgba(162, 155, 254, 0.24);
  overflow: hidden;
}

.preorder-table-panel::before {
  content: '';
  display: block;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--primary-gold) 30%, var(--accent-purple) 70%, transparent);
}

.preorder-table {
  --el-table-border-color: rgba(212, 175, 55, 0.12);
  --el-table-row-hover-bg-color: #fffaf0;
  --el-table-header-text-color: #64748b;
}

/* 切换筛选/翻页时的轻量加载态：仅内容变淡，避免 v-loading 遮罩闪烁 */
.preorder-table.is-switching {
  opacity: 0.55;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

/* 首次加载遮罩：更透明更快，减少白罩闪烁感 */
.preorder-table-panel :deep(.el-loading-mask) {
  background-color: rgba(255, 255, 255, 0.45);
  transition: opacity 0.15s ease;
}

.preorder-table :deep(.el-table__header th.el-table__cell) {
  height: 46px;
  background: linear-gradient(180deg, #fdf9ef 0%, #f8f5ff 100%);
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.preorder-table :deep(.el-table__body td.el-table__cell) {
  height: 54px;
  transition: background-color 0.16s ease, box-shadow 0.16s ease;
}

.preorder-table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: #fffaf0;
}

/* 行悬停时首列左侧金条 */
.preorder-table :deep(.el-table__body tr:hover > td.el-table__cell:first-child) {
  box-shadow: inset 3px 0 0 rgba(212, 175, 55, 0.9);
}

/* 首列：金紫渐变图标瓦片 + 名称 */
.preorder-name-cell {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-width: 0;
}

.preorder-name-tile {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(162, 155, 254, 0.18));
  border: 1px solid rgba(212, 175, 55, 0.3);
  color: #9a740b;
  font-size: 17px;
}

.preorder-name-text {
  flex: 1;
  min-width: 0;
  color: #243042;
  font-weight: 700;
}

.cell-platform {
  display: flex;
  align-items: center;
  gap: 6px;
}

.platform-tag {
  flex-shrink: 0;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.1);
  color: #8a650b;
  font-weight: 600;
}

.cell-shop {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-amount {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.cell-amount .deposit {
  color: #9a740b;
  font-weight: 700;
}

.cell-muted {
  color: #c0c4cc;
  font-size: 12px;
}

/* 月份列：到期标签 */
.preorder-month-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.preorder-month-cell > span {
  flex-shrink: 0;
  white-space: nowrap;
}

.month-due-tag {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(162, 155, 254, 0.14);
  color: var(--accent-purple-dark);
  font-size: 11px;
  font-weight: 700;
}

/* 延期次数标签：暖橙提醒（厂家跳票痕迹） */
.month-delay-tag {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(230, 162, 60, 0.14);
  border: 1px solid rgba(230, 162, 60, 0.28);
  color: #b88230;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

/* 状态胶囊 */
.preorder-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.6;
}

.preorder-status-pill.pending {
  background: rgba(212, 175, 55, 0.14);
  color: #9a740b;
}

.preorder-status-pill.paid {
  background: rgba(162, 155, 254, 0.16);
  color: var(--accent-purple-dark);
}

.preorder-status-pill.converted {
  background: linear-gradient(135deg, #d4af37, #a29bfe);
  color: #fff;
}

.preorder-status-pill.cancelled {
  background: #f0f0f2;
  color: #9ca3af;
}

/* 操作列 */
.cell-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}

.cell-actions :deep(.el-button) {
  font-weight: 600;
}

.cell-actions .action-mark,
.cell-actions .action-convert {
  color: var(--accent-purple-dark);
}

.cell-actions .action-mark:hover,
.cell-actions .action-convert:hover {
  color: var(--accent-purple-dark);
  background: rgba(162, 155, 254, 0.12);
}

.cell-actions .action-edit {
  color: #8a650b;
}

.cell-actions .action-edit:hover {
  color: #8a650b;
  background: rgba(212, 175, 55, 0.13);
}

.cell-actions .action-cancel {
  color: #c77700;
}

.cell-actions .action-cancel:hover {
  color: #c77700;
  background: rgba(230, 162, 60, 0.12);
}

/* 跳票延期：暖橙色，与取消区分（金色系延后语义） */
.cell-actions .action-delay {
  color: #b88230;
}

.cell-actions .action-delay:hover {
  color: #b88230;
  background: rgba(230, 162, 60, 0.12);
}

.cell-actions .action-delete:hover {
  background: rgba(239, 68, 68, 0.1);
}

:deep(.preorder-row-highlight) {
  background-color: rgba(212, 175, 55, 0.12) !important;
  transition: background-color 0.3s ease;
}

.preorder-empty {
  padding: 48px 0;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 14px 16px;
  border-top: 1px solid rgba(212, 175, 55, 0.12);
}

.pagination-wrapper :deep(.el-pagination) {
  --el-pagination-bg-color: #f5f7fa;
  --el-pagination-hover-color: #8a650b;
}

/* ─── 编辑器式对话框 ─── */
:global(.el-dialog.preorder-editor-dialog:not(.is-mobile)) {
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 72px);
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 24px;
  background:
    radial-gradient(circle at 92% 0%, rgba(212, 175, 55, 0.2), transparent 32%),
    radial-gradient(circle at 0% 0%, rgba(162, 155, 254, 0.16), transparent 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(250, 248, 255, 0.97));
  box-shadow: 0 30px 80px rgba(41, 34, 24, 0.22), 0 12px 28px rgba(41, 34, 24, 0.1);
}

:global(.el-dialog.preorder-editor-dialog .el-dialog__header) {
  display: block;
  flex: 0 0 auto;
  padding: 0;
  margin-right: 0;
}

:global(.el-dialog.preorder-editor-dialog .el-dialog__body) {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  max-height: calc(100vh - 120px);
  overflow: hidden;
}

:global(.preorder-form-dialog .el-dialog__body) {
  max-height: calc(100vh - 120px);
}

:global(.preorder-editor-dialog .el-dialog__footer) {
  padding: 14px 28px 22px;
  background: rgba(255, 255, 255, 0.92);
}

.preorder-editor-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 28px 18px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.14);
  background:
    radial-gradient(620px 170px at 88% 0%, rgba(212, 175, 55, 0.18), transparent 62%),
    radial-gradient(460px 150px at 0% 0%, rgba(162, 155, 254, 0.14), transparent 60%);
}

.preorder-editor-icon {
  flex-shrink: 0;
  width: 54px;
  height: 54px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.22), rgba(162, 155, 254, 0.2));
  border: 1px solid rgba(212, 175, 55, 0.3);
  color: #9a740b;
  font-size: 24px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 20px -10px rgba(212, 175, 55, 0.5);
}

.preorder-editor-icon.is-purple {
  background: linear-gradient(135deg, rgba(162, 155, 254, 0.24), rgba(212, 175, 55, 0.18));
  color: var(--accent-purple-dark);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 20px -10px rgba(162, 155, 254, 0.5);
}

.preorder-editor-kicker {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(212, 175, 55, 0.3);
  color: #8a6c14;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preorder-editor-heading h3 {
  margin: 7px 0 2px;
  font-size: 22px;
  font-weight: 800;
  color: #2f2a20;
}

.preorder-editor-heading p {
  margin: 0;
  font-size: 13px;
  color: #6f6a7f;
}

.preorder-editor-close {
  margin-left: auto;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid #e5e7eb;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6b7280;
  font-size: 15px;
  transition: transform 0.3s ease, color 0.2s ease, border-color 0.2s ease;
}

.preorder-editor-close:hover {
  transform: rotate(90deg);
  color: #9a740b;
  border-color: rgba(212, 175, 55, 0.4);
}

@media (max-height: 820px) and (min-width: 769px) {
  .preorder-editor-header {
    gap: 10px;
    padding: 6px 20px;
  }

  .preorder-editor-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    font-size: 16px;
  }

  .preorder-editor-kicker,
  .preorder-editor-heading p {
    display: none;
  }

  .preorder-editor-heading h3 {
    margin: 0;
    font-size: 17px;
  }

  .preorder-editor-close {
    width: 32px;
    height: 32px;
  }
}

.preorder-editor-form {
  padding: 20px 28px 4px;
}

.preorder-editor-section {
  margin-bottom: 18px;
  padding: 18px 20px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.09), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 12px 26px -26px rgba(17, 24, 39, 0.5);
}

.preorder-editor-section-title {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 16px;
}

.preorder-editor-section-title::before {
  content: '';
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--primary-gold);
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.12);
}

.preorder-editor-section-title h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #2f2a20;
}

.preorder-editor-section-title p {
  margin: 0 0 0 auto;
  font-size: 12px;
  color: #9ca3af;
}

.preorder-editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

/* ─── 截图识别（弱化入口，置于表单末尾、默认收起） ─── */
.preorder-ocr-section {
  border-top: 1px dashed rgba(212, 175, 55, 0.25);
  padding-top: 12px;
}

.preorder-ocr-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: none;
  color: #9ca3af;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s;
}

.preorder-ocr-toggle:hover {
  color: #b88230;
}

.preorder-ocr-chevron {
  font-size: 12px;
  transition: transform 0.2s;
}

.preorder-ocr-chevron.is-open {
  transform: rotate(180deg);
}

.preorder-ocr-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #c0c4cc;
  line-height: 1.6;
}

.preorder-ocr-body {
  margin-top: 12px;
}

.preorder-ocr-body :deep(.el-upload) {
  width: 100%;
}

.preorder-ocr-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 18px;
  border-radius: 12px;
  border: 1px dashed rgba(212, 175, 55, 0.45);
  background: #fdfaf3;
  color: #7a6a3a;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
}

.preorder-ocr-trigger:hover {
  border-color: var(--primary-gold);
  background: #fbf5e4;
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.12);
}

.preorder-ocr-trigger.is-loading {
  cursor: wait;
  opacity: 0.8;
}

.preorder-ocr-trigger .is-spinning {
  animation: preorder-ocr-rotate 1.1s linear infinite;
}

@keyframes preorder-ocr-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.preorder-ocr-warnings {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(230, 162, 60, 0.1);
  border: 1px solid rgba(230, 162, 60, 0.28);
  color: #b88230;
  font-size: 12.5px;
  line-height: 1.6;
}

.preorder-ocr-warnings .el-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.preorder-editor-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.preorder-editor-form :deep(.el-form-item__label) {
  margin-bottom: 6px;
  color: #5f5874;
  font-weight: 800;
  font-size: 13px;
  line-height: 1.4;
}

.preorder-editor-form :deep(.el-input__wrapper),
.preorder-editor-form :deep(.el-select__wrapper),
.preorder-editor-form :deep(.el-textarea__inner) {
  min-height: 44px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6px 18px -14px rgba(162, 155, 254, 0.45);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.preorder-editor-form :deep(.el-input__wrapper.is-focus),
.preorder-editor-form :deep(.el-select__wrapper.is-focused) {
  border-color: rgba(162, 155, 254, 0.5);
  box-shadow: 0 0 0 3px rgba(196, 181, 253, 0.2), 0 10px 22px -14px rgba(162, 155, 254, 0.5);
}

.preorder-editor-form :deep(.el-input-number) {
  width: 100%;
}

.preorder-editor-form :deep(.el-input-number .el-input__wrapper) {
  padding-left: 12px;
  padding-right: 12px;
}

.preorder-editor-cancel,
.preorder-editor-submit {
  min-width: 96px;
  min-height: 40px;
  border-radius: 12px;
  font-weight: 800;
}

.preorder-editor-cancel {
  border: 1px solid rgba(212, 175, 55, 0.35);
  color: #8a650b;
  background: rgba(255, 248, 230, 0.6);
}

.preorder-editor-cancel:hover {
  background: rgba(255, 248, 230, 0.95);
  border-color: rgba(212, 175, 55, 0.5);
  color: #8a650b;
}

.preorder-editor-submit {
  border: none;
  background: linear-gradient(135deg, var(--accent-purple), var(--accent-purple-hover));
  box-shadow: 0 8px 20px -8px rgba(142, 125, 255, 0.55);
}

.preorder-editor-submit:hover {
  background: linear-gradient(135deg, var(--accent-purple-hover), var(--accent-purple-dark));
}

/* 表单内粒度切换：与右侧输入控件等高（44px）、同圆角（12px），消除左右高度不齐 */
/* 注意：granularity-select 即 el-segmented 根元素本身，容器样式与变量必须写在此处 */
.granularity-select {
  --el-segmented-bg-color: rgba(244, 243, 247, 0.9);
  --el-segmented-padding: 2px;
  --el-segmented-item-selected-bg-color: linear-gradient(135deg, #fdf4da 0%, #f4da94 100%);
  --el-segmented-item-selected-color: #7a5b08;
  --el-segmented-item-hover-bg-color: rgba(212, 175, 55, 0.1);
  --el-segmented-item-hover-color: #8a650b;
  width: 100%;
  height: 44px;
  padding: 2px;
  box-sizing: border-box;
  border-radius: 12px;
}

.granularity-select :deep(.el-segmented__item) {
  height: 40px;
  line-height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.granularity-select :deep(.el-segmented__item-selected) {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

/* 转正提示条 */
.convert-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 18px 28px 0;
  padding: 10px 14px;
  border: 1px solid rgba(142, 125, 255, 0.2);
  border-radius: 12px;
  background: rgba(142, 125, 255, 0.08);
  color: #6b5fe8;
  font-size: 13px;
  line-height: 1.6;
}

.convert-tip-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.convert-hint {
  font-size: 12px;
  color: #c0c4cc;
  line-height: 1.6;
}

/* ─── 移动端：页面骨架 / 卡片列表 / FAB / 刷新指示 ─── */
.preorder-mobile-page {
  min-height: calc(100dvh - 64px - env(safe-area-inset-top));
}

.preorder-mobile-pull {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  overflow: hidden;
  color: #9a740b;
  font-size: 12px;
  font-weight: 700;
  transition: height 0.18s ease;
}

.preorder-mobile-pull .is-spinning {
  animation: preorder-mobile-spin 1s linear infinite;
}

@keyframes preorder-mobile-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.preorder-mobile-header {
  padding: 4px 2px 10px;
}

.preorder-mobile-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #2f2a20;
}

.preorder-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
  transition: opacity 0.2s ease;
}

.preorder-mobile-list.is-switching {
  opacity: 0.55;
  pointer-events: none;
}

.preorder-mobile-skeletons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}

.preorder-mobile-skeleton {
  height: 168px;
  border-radius: 14px;
  background: linear-gradient(100deg, #f3f1f7 40%, #faf9fd 50%, #f3f1f7 60%);
  background-size: 200% 100%;
  animation: preorder-mobile-shimmer 1.3s ease-in-out infinite;
}

@keyframes preorder-mobile-shimmer {
  from { background-position: 180% 0; }
  to { background-position: -20% 0; }
}

.preorder-mobile-sentinel {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 12px;
}

.preorder-mobile-sentinel.is-hidden {
  min-height: 12px;
}

.preorder-mobile-end {
  padding: 4px 0 12px;
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
}

.preorder-mobile-retry {
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 12px;
  background: #fffdf6;
  color: #8a650b;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-empty-btn {
  min-height: 44px;
  border-radius: 12px;
  font-weight: 800;
}

.preorder-mobile-fab {
  position: fixed;
  right: 18px;
  bottom: calc(76px + env(safe-area-inset-bottom));
  z-index: 950;
  width: 56px;
  height: 56px;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-gold), #b8941f 60%, var(--accent-purple-hover));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  box-shadow:
    0 16px 30px rgba(96, 78, 18, 0.28),
    0 5px 14px rgba(142, 125, 255, 0.25);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}

.preorder-mobile-fab:active {
  transform: scale(0.94);
}

@supports not (bottom: calc(76px + env(safe-area-inset-bottom))) {
  .preorder-mobile-fab {
    bottom: 76px;
  }
}

@media (max-width: 768px) {
  .preorder-page {
    padding: 12px 12px calc(90px + env(safe-area-inset-bottom));
  }
}

@supports not (padding: calc(90px + env(safe-area-inset-bottom))) {
  @media (max-width: 768px) {
    .preorder-page {
      padding: 12px 12px 90px;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .preorder-mobile-skeleton {
    animation: none;
  }
}
</style>
