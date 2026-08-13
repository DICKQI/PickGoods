<template>
  <div class="preorder-page">
    <div class="preorder-page-inner">
      <!-- 玻璃拟态 Hero：眉题 + 标题 + 统计指标 -->
      <section class="preorder-hero">
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
              <span class="metric-value is-gold">¥{{ formatAmount(stats.total_pending_deposit) }}</span>
              <span class="metric-label">待补定金</span>
            </div>
          </div>
          <el-button class="preorder-add-btn" type="primary" :icon="Plus" @click="openCreate">新增预购</el-button>
        </div>
      </section>

      <!-- 工具栏：状态筛选 + 搜索 -->
      <section class="preorder-toolbar">
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

      <!-- 精装表格面板 -->
      <section class="preorder-table-panel">
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
          <el-table-column label="手办名称" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="preorder-name-cell">
                <span class="preorder-name-tile"><el-icon><ShoppingCart /></el-icon></span>
                <span class="preorder-name-text">{{ row.name }}</span>
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
                <span class="cell-muted">尾款 {{ row.balance_amount ? '¥' + formatAmount(row.balance_amount) : '未知' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="预计补款时间" width="150" sortable :sort-by="sortByMonth">
            <template #default="{ row }">
              <span class="preorder-month-cell">
                <span>{{ formatMonth(row) }}</span>
                <span v-if="isDueNow(row)" class="month-due-tag">{{ row.time_granularity === 'quarter' ? '补款期' : '已到期' }}</span>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <span class="preorder-status-pill" :class="row.status">{{ statusLabel(row.status) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <div class="cell-actions">
                <el-button v-if="row.status === 'pending'" link type="primary" size="small" class="action-mark" @click="handleMarkPaid(row)">标记补款</el-button>
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

      <!-- 移动端卡片列表（保持现状） -->
      <div v-if="isMobile" class="preorder-mobile-list">
        <div
          v-for="item in preorders"
          :id="'preorder-row-' + item.id"
          :key="item.id"
          class="preorder-card"
          :class="{ 'is-highlight': item.id === highlightId }"
        >
          <div class="preorder-card-head">
            <span class="preorder-card-name">{{ item.name }}</span>
            <el-tag :type="statusTagType(item.status)" size="small">{{ statusLabel(item.status) }}</el-tag>
          </div>
          <div class="preorder-card-meta">
            <span v-if="item.platform || item.shop_name">{{ [item.platform, item.shop_name].filter(Boolean).join(" · ") }}</span>
            <span v-if="item.order_no" class="cell-muted">订单 {{ item.order_no }}</span>
          </div>
          <div class="preorder-card-meta">
            <span>定金 ¥{{ formatAmount(item.deposit_amount) }}</span>
            <span class="cell-muted">尾款 {{ item.balance_amount ? "¥" + formatAmount(item.balance_amount) : "未知" }}</span>
            <span class="preorder-card-month">{{ formatMonth(item) }}</span>
          </div>
          <div v-if="item.notes" class="preorder-card-notes">{{ item.notes }}</div>
          <div class="preorder-card-actions">
            <el-button v-if="item.status === 'pending'" size="small" type="primary" plain @click="handleMarkPaid(item)">标记补款</el-button>
            <el-button v-if="item.status === 'paid'" size="small" type="primary" plain @click="openConvert(item)">转正为谷子</el-button>
            <el-button v-if="item.status === 'converted' && item.goods_id" size="small" type="primary" plain @click="goToGoods(item)">查看谷子</el-button>
            <el-button v-if="item.status === 'pending'" size="small" @click="handleCancelPreorder(item)">取消</el-button>
            <el-button size="small" @click="openEdit(item)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="handleDelete(item)">删除</el-button>
          </div>
        </div>
        <el-empty v-if="!loading && !switching && preorders.length === 0" :description="emptyText" :image-size="88" />
        <div v-if="total > pageSize" class="preorder-mobile-pagination">
          <el-pagination
            background
            layout="prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            @current-change="handlePageChange"
          />
        </div>
      </div>

      <!-- 新增 / 编辑对话框（编辑器式） -->
      <el-dialog
        v-model="formDialogVisible"
        :title="editingId ? '编辑预购' : '新增预购'"
        width="640px"
        class="custom-dialog preorder-editor-dialog"
        :show-close="false"
        :close-on-click-modal="false"
        align-center
      >
        <template #header>
          <div class="preorder-editor-header">
            <span class="preorder-editor-icon"><el-icon><ShoppingCart /></el-icon></span>
            <div class="preorder-editor-heading">
              <span class="preorder-editor-kicker">PREORDER FORM</span>
              <h3>{{ editingId ? '编辑预购' : '新增预购' }}</h3>
              <p>{{ editingId ? '修改登记信息；改期后旧提醒自动失效并按新月份重新提醒' : '登记外部平台下单的手办定金' }}</p>
            </div>
            <button type="button" class="preorder-editor-close" aria-label="关闭" @click="formDialogVisible = false">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </template>
        <el-form ref="formRef" :model="form" :rules="formRules" label-position="top" class="preorder-editor-form">
          <section class="preorder-editor-section">
            <div class="preorder-editor-section-title">
              <h4>基本信息</h4>
              <p>手办名称与下单渠道</p>
            </div>
            <el-form-item label="手办名称" prop="name">
              <el-input v-model="form.name" placeholder="例如：流萤 1/7 手办" maxlength="200" />
            </el-form-item>
            <div class="preorder-editor-grid">
              <el-form-item label="下单平台">
                <el-select v-model="form.platform" placeholder="选择或输入平台" filterable allow-create clearable style="width: 100%">
                  <el-option v-for="p in PLATFORM_OPTIONS" :key="p" :label="p" :value="p" />
                </el-select>
              </el-form-item>
              <el-form-item label="店铺名称">
                <el-input v-model="form.shop_name" placeholder="选填" maxlength="100" />
              </el-form-item>
            </div>
            <el-form-item label="订单号">
              <el-input v-model="form.order_no" placeholder="选填" maxlength="100" />
            </el-form-item>
          </section>

          <section class="preorder-editor-section">
            <div class="preorder-editor-section-title">
              <h4>金额与补款</h4>
              <p>定金必填，尾款未知可留空</p>
            </div>
            <div class="preorder-editor-grid">
              <el-form-item label="定金金额" prop="deposit_amount">
                <el-input-number v-model="form.deposit_amount" :min="0" :precision="2" :controls="false" placeholder="0.00" style="width: 100%" />
              </el-form-item>
              <el-form-item label="尾款金额">
                <el-input-number v-model="form.balance_amount" :min="0" :precision="2" :controls="false" placeholder="未知可留空" style="width: 100%" />
              </el-form-item>
            </div>
            <div class="preorder-editor-grid">
              <el-form-item label="时间粒度">
                <el-segmented
                  v-model="form.time_granularity"
                  :options="GRANULARITY_OPTIONS"
                  class="granularity-select"
                  @change="handleGranularityChange"
                />
              </el-form-item>
              <el-form-item :label="form.time_granularity === 'quarter' ? '预计补款季度' : '预计补款月份'" prop="estimated_month">
                <el-date-picker
                  v-if="form.time_granularity === 'month'"
                  v-model="form.estimated_month"
                  type="month"
                  value-format="YYYY-MM"
                  placeholder="选择预计补款月份"
                  style="width: 100%"
                  :clearable="false"
                />
                <!-- EP 2.13 无 type="quarter" 面板，季度用下拉选择（契约值 'YYYY-Qn'） -->
                <el-select
                  v-else
                  v-model="form.estimated_month"
                  placeholder="选择预计补款季度"
                  style="width: 100%"
                  class="quarter-select"
                >
                  <el-option v-for="opt in quarterOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </el-form-item>
            </div>
          </section>

          <section class="preorder-editor-section">
            <div class="preorder-editor-section-title">
              <h4>备注</h4>
              <p>选填</p>
            </div>
            <el-form-item label="">
              <el-input v-model="form.notes" type="textarea" :rows="3" placeholder="选填" />
            </el-form-item>
          </section>
        </el-form>
        <template #footer>
          <el-button class="preorder-editor-cancel" @click="formDialogVisible = false">取消</el-button>
          <el-button class="preorder-editor-submit" type="primary" :loading="formSubmitting" @click="submitForm">保存</el-button>
        </template>
      </el-dialog>

      <!-- 转正为谷子对话框（同款编辑器式） -->
      <el-dialog
        v-model="convertDialogVisible"
        title="转正为谷子"
        width="640px"
        class="custom-dialog preorder-editor-dialog"
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
        <div class="convert-tip">
          <el-icon class="convert-tip-icon"><InfoFilled /></el-icon>
          <span>金额自动带入（定金 + 尾款），购入日期为补款日；默认保存为草稿，可稍后补充图片等信息。</span>
        </div>
        <el-form ref="convertRef" :model="convertForm" :rules="convertRules" label-position="top" class="preorder-editor-form">
          <section class="preorder-editor-section">
            <div class="preorder-editor-section-title">
              <h4>谷子信息</h4>
              <p>名称默认预填预购名</p>
            </div>
            <el-form-item label="谷子名称" prop="name">
              <el-input v-model="convertForm.name" maxlength="200" />
            </el-form-item>
            <div class="preorder-editor-grid">
              <el-form-item label="IP作品" prop="ip">
                <el-select v-model="convertForm.ip" placeholder="选择IP" filterable style="width: 100%" @change="handleConvertIpChange">
                  <el-option v-for="ip in ipOptions" :key="ip.id" :label="ip.name" :value="ip.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="品类" prop="category">
                <el-tree-select
                  v-model="convertForm.category"
                  :data="categoryTreeOptions"
                  :props="{ label: 'name', value: 'id', children: 'children' }"
                  placeholder="选择品类"
                  style="width: 100%"
                  check-strictly
                  filterable
                />
              </el-form-item>
            </div>
            <el-form-item label="角色" :required="convertForm.status !== 'draft'">
              <el-select v-model="convertForm.characters" placeholder="选择角色（可多选）" multiple filterable :disabled="!convertForm.ip" style="width: 100%">
                <el-option v-for="c in ipCharacters" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
              <div v-if="convertForm.status === 'draft'" class="convert-hint">草稿状态角色可暂不选择</div>
            </el-form-item>
          </section>

          <section class="preorder-editor-section">
            <div class="preorder-editor-section-title">
              <h4>状态与归属</h4>
              <p>非草稿状态需至少关联一个角色</p>
            </div>
            <el-form-item label="状态">
              <el-radio-group v-model="convertForm.status">
                <el-radio-button value="draft">草稿</el-radio-button>
                <el-radio-button value="in_cabinet">在馆</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <div class="preorder-editor-grid">
              <el-form-item label="主题">
                <el-select v-model="convertForm.theme" placeholder="选填" clearable filterable style="width: 100%">
                  <el-option v-for="theme in themeOptions" :key="theme.id" :label="theme.name" :value="theme.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="备注">
                <el-input v-model="convertForm.notes" type="textarea" :rows="2" placeholder="选填" />
              </el-form-item>
            </div>
          </section>
        </el-form>
        <template #footer>
          <el-button class="preorder-editor-cancel" @click="convertDialogVisible = false">取消</el-button>
          <el-button class="preorder-editor-submit" type="primary" :loading="convertSubmitting" @click="submitConvert">转正</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, InfoFilled, MagicStick, Plus, Search, ShoppingCart } from '@element-plus/icons-vue'
import * as reminderApi from '@/api/reminder'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { useMetadataStore } from '@/stores/metadata'
import type { Category, GoodsStatus, Preorder, PreorderInput, PreorderStats, PreorderStatus } from '@/api/types'

const route = useRoute()
const router = useRouter()
const { isMobile } = useResponsiveDevice()
const metadataStore = useMetadataStore()

const PLATFORM_OPTIONS = ['淘宝', '天猫', '京东', '拼多多', '抖音', 'B站会员购', '代购', '线下展会', '其他']

const GRANULARITY_OPTIONS: Array<{ label: string; value: 'month' | 'quarter' }> = [
  { label: '按月', value: 'month' },
  { label: '按季度', value: 'quarter' },
]

// 季度下拉选项（'YYYY-Qn'，前一年 ~ 后两年，覆盖远期预购）
const quarterOptions = computed(() => {
  const year = new Date().getFullYear()
  const options: Array<{ label: string; value: string }> = []
  for (let y = year - 1; y <= year + 2; y++) {
    for (let q = 1; q <= 4; q++) {
      options.push({ label: `${y}年 Q${q}`, value: `${y}-Q${q}` })
    }
  }
  return options
})

const STATUS_OPTIONS: Array<{ label: string; value: PreorderStatus | '' }> = [
  { label: '全部', value: '' },
  { label: '待补款', value: 'pending' },
  { label: '已补款', value: 'paid' },
  { label: '已转正', value: 'converted' },
  { label: '已取消', value: 'cancelled' },
]

const STATUS_LABELS: Record<string, string> = {
  pending: '待补款',
  paid: '已补款',
  converted: '已转正',
  cancelled: '已取消',
}

const STATUS_TAG_TYPES: Record<string, 'warning' | 'success' | 'primary' | 'info'> = {
  pending: 'warning',
  paid: 'success',
  converted: 'primary',
  cancelled: 'info',
}

const statusLabel = (s: string) => STATUS_LABELS[s] || s
const statusTagType = (s: string) => STATUS_TAG_TYPES[s] || 'info'

const formatAmount = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00'
  return Number(value).toFixed(2)
}

const sortByMonth = (row: Preorder) => row.estimated_month

// 季度字符串 ↔ 月份转换（表单 '2026-Q3' ↔ 后端存储 '2026-07-01'）
const quarterToMonth = (q: string): string => {
  const m = q.match(/^(\d{4})-Q([1-4])$/i)
  if (!m) return q
  const month = (Number(m[2]) - 1) * 3 + 1
  return `${m[1]}-${String(month).padStart(2, '0')}-01`
}

const monthToQuarter = (ymd: string): string => {
  const d = new Date(ymd + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-Q${q}`
}

const toMonthStart = (v: string, granularity: 'month' | 'quarter'): string => {
  // 提交时统一转为粒度起点日期：月粒度 '2026-08' → '2026-08-01'；季度 '2026-Q3' → '2026-07-01'
  if (granularity === 'quarter') return quarterToMonth(v)
  return v + '-01'
}

const formatMonth = (row: Preorder): string => {
  if (!row.estimated_month) return '—'
  const d = new Date(row.estimated_month + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return row.estimated_month
  if (row.time_granularity === 'quarter') {
    const q = Math.floor(d.getMonth() / 3) + 1
    return `${d.getFullYear()}年 Q${q}`
  }
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月'
}

// 已到补款期（待补款且预计月份不晚于当月）
const isDueNow = (row: Preorder): boolean => {
  if (row.status !== 'pending') return false
  const month = new Date(row.estimated_month + 'T00:00:00')
  if (Number.isNaN(month.getTime())) return false
  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return month <= thisMonth
}

// ─── 统计概览 ───
const stats = ref<PreorderStats>({
  pending_count: 0,
  due_this_month: 0,
  due_this_quarter: 0,
  converted_count: 0,
  total_pending_deposit: '0.00',
})

const loadStats = async () => {
  try {
    const data = await reminderApi.getPreorderStats()
    stats.value = data
  } catch {
    // 统计失败不阻断页面
  }
}

// ─── 列表 ───
const preorders = ref<Preorder[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 12
// 首次加载：全遮罩；切换（筛选/搜索/翻页）：仅内容变淡，避免遮罩闪烁
const loading = ref(false)
const switching = ref(false)
const statusFilter = ref<PreorderStatus | ''>((route.query.status as PreorderStatus | '') || '')
const searchKeyword = ref('')
const highlightId = ref<string | null>(null)
const tableRef = ref()

const emptyText = computed(() =>
  statusFilter.value || searchKeyword.value
    ? '没有找到匹配的预购'
    : '还没有预购登记，点击「新增预购」登记第一笔手办定金吧'
)

const loadList = async (mode: 'initial' | 'switch' = 'switch') => {
  if (mode === 'initial') {
    loading.value = true
  } else {
    switching.value = true
  }
  try {
    const data = await reminderApi.listPreorders({
      page: page.value,
      page_size: pageSize,
      status: statusFilter.value || undefined,
      search: searchKeyword.value || undefined,
    })
    preorders.value = data.results
    total.value = data.count
  } catch {
    // 全局错误提示已由 request 拦截器处理
  } finally {
    loading.value = false
    switching.value = false
  }
}

const handleFilterChange = () => {
  page.value = 1
  loadList()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
const handleSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadList()
  }, 300)
}

const handleSearchClear = () => {
  page.value = 1
  loadList()
}

const handlePageChange = (p: number) => {
  page.value = p
  loadList()
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
  // 目标不在当前列表：清空筛选，跨页定位后跳转
  statusFilter.value = ''
  searchKeyword.value = ''
  const targetPage = await locatePreorderPage(id)
  page.value = targetPage ?? 1
  await loadList()
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

// ─── 新增 / 编辑 ───
const formDialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formSubmitting = ref(false)
const formRef = ref()
const form = reactive<PreorderInput>({
  name: '',
  platform: '',
  shop_name: '',
  order_no: '',
  deposit_amount: 0,
  balance_amount: null,
  time_granularity: 'month',
  estimated_month: '',
  notes: '',
})

const formRules = {
  name: [{ required: true, message: '请输入手办名称', trigger: 'blur' }],
  deposit_amount: [{ required: true, message: '请输入定金金额', trigger: 'blur' }],
  estimated_month: [{ required: true, message: '请选择预计补款时间', trigger: 'change' }],
}

const resetForm = () => {
  editingId.value = null
  form.name = ''
  form.platform = ''
  form.shop_name = ''
  form.order_no = ''
  form.deposit_amount = 0
  form.balance_amount = null
  form.time_granularity = 'month'
  form.estimated_month = ''
  form.notes = ''
  formRef.value?.clearValidate()
}

const openCreate = () => {
  resetForm()
  formDialogVisible.value = true
}

const openEdit = (item: Preorder) => {
  editingId.value = item.id
  form.name = item.name
  form.platform = item.platform || ''
  form.shop_name = item.shop_name || ''
  form.order_no = item.order_no || ''
  form.deposit_amount = Number(item.deposit_amount)
  form.balance_amount = item.balance_amount !== null ? Number(item.balance_amount) : null
  form.time_granularity = item.time_granularity
  // 按粒度回填表单值：月粒度 '2026-08-01' → '2026-08'；季度粒度 → '2026-Q3'
  form.estimated_month =
    item.time_granularity === 'quarter'
      ? monthToQuarter(item.estimated_month)
      : (item.estimated_month || '').slice(0, 7)
  form.notes = item.notes || ''
  formDialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

// 切换时间粒度时清空已选时间，避免残留不匹配的格式
const handleGranularityChange = () => {
  form.estimated_month = ''
}

const submitForm = async () => {
  await formRef.value.validate()
  formSubmitting.value = true
  try {
    const payload: PreorderInput = {
      ...form,
      deposit_amount: form.deposit_amount,
      balance_amount: form.balance_amount ?? null,
      time_granularity: form.time_granularity,
      // 统一转为粒度起点日期：后端按粒度归一化存储
      estimated_month: form.estimated_month
        ? toMonthStart(form.estimated_month, form.time_granularity ?? 'month')
        : '',
    }
    if (editingId.value) {
      await reminderApi.updatePreorder(editingId.value, payload)
      ElMessage.success('预购已更新')
    } else {
      await reminderApi.createPreorder(payload)
      ElMessage.success('预购已登记，到补款期将自动提醒')
    }
    formDialogVisible.value = false
    await Promise.all([loadList(), loadStats()])
  } catch {
    // 校验错误由表单 / 拦截器提示
  } finally {
    formSubmitting.value = false
  }
}

// ─── 状态流转 ───
const handleMarkPaid = async (item: Preorder) => {
  await ElMessageBox.confirm(
    '确认将「' + item.name + '」标记为已补款？此操作不可撤销。',
    '标记已补款',
    { type: 'warning', confirmButtonText: '确认补款', cancelButtonText: '再想想' }
  )
  await reminderApi.markPreorderPaid(item.id)
  ElMessage.success('已标记补款')
  await Promise.all([loadList(), loadStats()])
}

const handleCancelPreorder = async (item: Preorder) => {
  await ElMessageBox.confirm(
    '确认取消「' + item.name + '」的预购登记？相关提醒将失效。',
    '取消预购',
    { type: 'warning', confirmButtonText: '确认取消', cancelButtonText: '再想想' }
  )
  await reminderApi.cancelPreorder(item.id)
  ElMessage.success('已取消')
  await Promise.all([loadList(), loadStats()])
}

const handleDelete = async (item: Preorder) => {
  const message = item.goods_id
    ? '该预购已转正为谷子，删除仅移除预购记录，谷子不受影响。确定删除？'
    : '确定删除「' + item.name + '」？相关通知将一并删除。'
  await ElMessageBox.confirm(message, '删除预购', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  await reminderApi.deletePreorder(item.id)
  ElMessage.success('已删除')
  await Promise.all([loadList(), loadStats()])
}

const goToGoods = (item: Preorder) => {
  if (item.goods_id) {
    router.push('/goods/' + item.goods_id + '/edit')
  }
}

// ─── 转正为谷子 ───
const convertDialogVisible = ref(false)
const convertTarget = ref<Preorder | null>(null)
const convertSubmitting = ref(false)
const convertRef = ref()
const convertForm = reactive({
  name: '',
  ip: undefined as number | undefined,
  category: undefined as number | undefined,
  characters: [] as number[],
  status: 'draft' as GoodsStatus,
  theme: null as number | null,
  notes: '',
})

const convertRules = {
  name: [{ required: true, message: '请输入谷子名称', trigger: 'blur' }],
  ip: [{ required: true, message: '请选择IP作品', trigger: 'change' }],
  category: [{ required: true, message: '请选择品类', trigger: 'change' }],
}

const ipOptions = computed(() => metadataStore.ips)
const themeOptions = computed(() => metadataStore.themes)
const ipCharacters = computed(() =>
  convertForm.ip ? metadataStore.charactersByIP[convertForm.ip] || [] : []
)

const buildCategoryTree = (list: Category[]) => {
  const map = new Map<number, Category & { children: Category[] }>()
  list.forEach((item) => map.set(item.id, { ...item, children: [] }))
  const roots: Category[] = []
  map.forEach((node) => {
    if (node.parent !== null && map.has(node.parent)) {
      map.get(node.parent)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortTree = (nodes: Category[]) => {
    nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
    nodes.forEach((n) => n.children && sortTree(n.children))
  }
  sortTree(roots)
  return roots
}

const categoryTreeOptions = computed(() => buildCategoryTree(metadataStore.categories))

const openConvert = async (item: Preorder) => {
  convertTarget.value = item
  convertForm.name = item.name
  convertForm.ip = undefined
  convertForm.category = undefined
  convertForm.characters = []
  convertForm.status = 'draft'
  convertForm.theme = null
  convertForm.notes = item.notes || ''
  convertDialogVisible.value = true
  nextTick(() => convertRef.value?.clearValidate())
  // 确保元数据可用
  await Promise.allSettled([
    metadataStore.fetchIPs(),
    metadataStore.fetchCategories(),
    metadataStore.fetchThemes(),
  ])
}

const handleConvertIpChange = () => {
  convertForm.characters = []
  if (convertForm.ip) {
    metadataStore.fetchIPCharacters(convertForm.ip)
  }
}

const submitConvert = async () => {
  await convertRef.value.validate()
  if (convertForm.status !== 'draft' && convertForm.characters.length === 0) {
    ElMessage.warning('非草稿状态至少需要关联一个角色')
    return
  }
  if (!convertTarget.value) return
  convertSubmitting.value = true
  try {
    await reminderApi.convertPreorderToGoods(convertTarget.value.id, {
      name: convertForm.name,
      ip: convertForm.ip!,
      category: convertForm.category!,
      characters: convertForm.characters,
      theme: convertForm.theme ?? null,
      status: convertForm.status,
      notes: convertForm.notes || null,
    })
    ElMessage.success('已转正为谷子，可在谷子编辑页补充图片等信息')
    convertDialogVisible.value = false
    await Promise.all([loadList(), loadStats()])
  } catch {
    // 400 / 409 错误已由拦截器或全局提示展示
  } finally {
    convertSubmitting.value = false
  }
}

onMounted(async () => {
  loadStats()
  await loadList('initial')
  // 带 highlight 进入页面（通知跳转 / 刷新）：列表加载完成后尝试定位
  if (route.query.highlight) await resolveHighlight()
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
  display: inline-flex;
  align-items: center;
  gap: 11px;
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
}

.month-due-tag {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(162, 155, 254, 0.14);
  color: var(--accent-purple-dark);
  font-size: 11px;
  font-weight: 700;
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
:global(.preorder-editor-dialog:not(.is-mobile) .el-dialog) {
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 72px);
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 24px;
  background:
    radial-gradient(circle at 92% 0%, rgba(212, 175, 55, 0.2), transparent 32%),
    radial-gradient(circle at 0% 0%, rgba(162, 155, 254, 0.16), transparent 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(250, 248, 255, 0.97));
  box-shadow: 0 30px 80px rgba(41, 34, 24, 0.22), 0 12px 28px rgba(41, 34, 24, 0.1);
}

:global(.preorder-editor-dialog .el-dialog__header) {
  display: none;
}

:global(.preorder-editor-dialog .el-dialog__body) {
  padding: 0;
  max-height: calc(100vh - 170px);
  overflow-y: auto;
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

/* 表单内粒度切换：小号胶囊 */
.granularity-select {
  width: 100%;
}

.granularity-select :deep(.el-segmented) {
  --el-segmented-bg-color: rgba(244, 243, 247, 0.9);
  --el-segmented-padding: 2px;
  --el-segmented-item-selected-bg-color: linear-gradient(135deg, #fdf4da 0%, #f4da94 100%);
  --el-segmented-item-selected-color: #7a5b08;
  --el-segmented-item-hover-bg-color: rgba(212, 175, 55, 0.1);
  --el-segmented-item-hover-color: #8a650b;
  width: 100%;
  border-radius: 999px;
}

.granularity-select :deep(.el-segmented__item) {
  padding: 0 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}

.granularity-select :deep(.el-segmented__item-selected) {
  border-radius: 999px;
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

/* ─── 移动端（保持现状，仅微调间距） ─── */
.preorder-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preorder-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.preorder-card.is-highlight {
  border-color: var(--primary-gold);
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.25);
}

.preorder-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.preorder-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-dark);
  word-break: break-all;
}

.preorder-card-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}

.preorder-card-month {
  margin-left: auto;
  color: var(--primary-gold);
  font-weight: 600;
}

.preorder-card-notes {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  word-break: break-all;
}

.preorder-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.preorder-mobile-pagination {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

@media (max-width: 768px) {
  .preorder-page {
    padding: 16px 12px 90px;
  }

  .preorder-hero {
    padding: 20px 18px;
    border-radius: 16px;
  }

  .preorder-hero-right {
    align-items: stretch;
    width: 100%;
  }

  .preorder-metrics {
    width: 100%;
  }

  .preorder-metric {
    flex: 1;
    min-width: 0;
  }

  .preorder-add-btn {
    width: 100%;
  }

  .preorder-toolbar {
    align-items: stretch;
    padding: 12px;
  }

  .preorder-search {
    width: 100%;
  }

  .preorder-status-filter {
    width: 100%;
    overflow-x: auto;
  }
}
</style>
