<template>
  <div class="admin-page">
    <AdminPageHeader title="操作日志" subtitle="追踪管理员高风险操作，不提供回滚与数据恢复。">
      <el-button :loading="exporting" @click="handleExport">
        <el-icon><Download /></el-icon>
        导出当前结果
      </el-button>
    </AdminPageHeader>

    <el-card class="admin-search-card" shadow="never">
      <div class="admin-search-flex">
        <el-input
          v-model="filters.search"
          clearable
          placeholder="搜索摘要、资源 ID 或管理员"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-input
          v-model="filters.action"
          clearable
          placeholder="动作，如 user.create"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-input
          v-model="filters.resource_type"
          clearable
          placeholder="资源类型"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          clearable
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <div v-loading="loading" class="content-body">
      <el-empty v-if="!loading && logs.length === 0" description="没有匹配的操作日志" />
      <template v-else>
        <div class="admin-table-wrapper">
          <el-table :data="logs" row-key="id">
            <el-table-column prop="created_at" label="时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="管理员" width="140">
              <template #default="{ row }">{{ row.actor_name || '已删除账号' }}</template>
            </el-table-column>
            <el-table-column prop="action" label="动作" min-width="180" />
            <el-table-column label="资源" min-width="180">
              <template #default="{ row }">
                <span>{{ resourceLabel(row.resource_type) }}</span>
                <code v-if="row.resource_id" class="resource-id">#{{ row.resource_id }}</code>
              </template>
            </el-table-column>
            <el-table-column prop="summary" label="摘要" min-width="260" show-overflow-tooltip />
            <el-table-column prop="ip_address" label="来源 IP" width="140">
              <template #default="{ row }">{{ row.ip_address || '—' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="admin-pagination">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :page-sizes="[20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="loadLogs"
          />
        </div>
      </template>
    </div>

    <el-drawer
      v-model="detailVisible"
      class="admin-detail-drawer"
      title="操作详情"
      size="min(92vw, 560px)"
      destroy-on-close
    >
      <div v-if="selectedLog" class="audit-detail">
        <dl>
          <div><dt>操作时间</dt><dd>{{ formatDateTime(selectedLog.created_at) }}</dd></div>
          <div><dt>管理员</dt><dd>{{ selectedLog.actor_name || '已删除账号' }}</dd></div>
          <div><dt>动作</dt><dd>{{ selectedLog.action }}</dd></div>
          <div><dt>资源</dt><dd>{{ resourceLabel(selectedLog.resource_type) }} #{{ selectedLog.resource_id || '—' }}</dd></div>
          <div><dt>来源 IP</dt><dd>{{ selectedLog.ip_address || '—' }}</dd></div>
          <div><dt>摘要</dt><dd>{{ selectedLog.summary }}</dd></div>
        </dl>
        <section class="audit-detail__changes">
          <h3>脱敏变更</h3>
          <pre>{{ formattedChanges }}</pre>
        </section>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Download, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { exportAdminResource, getAdminAuditLogs } from '@/api/admin'
import type { AdminAuditLog } from '@/api/types'
import { downloadBlob } from '@/utils/download'
import { formatDateTime } from '@/utils/datetime'
import { createLatestRequestGuard } from '@/composables/useLatestRequest'
import AdminPageHeader from './components/AdminPageHeader.vue'

const loading = ref(false)
const exporting = ref(false)
const logs = ref<AdminAuditLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const dateRange = ref<[string, string] | null>(null)
const detailVisible = ref(false)
const selectedLog = ref<AdminAuditLog | null>(null)
const logListRequests = createLatestRequestGuard()
const filters = reactive({
  search: '',
  action: '',
  resource_type: '',
})

const requestParams = computed(() => ({
  page: page.value,
  page_size: pageSize.value,
  search: filters.search || undefined,
  action: filters.action || undefined,
  resource_type: filters.resource_type || undefined,
  created_at__gte: dateRange.value?.[0]
    ? `${dateRange.value[0]}T00:00:00+08:00`
    : undefined,
  created_at__lte: dateRange.value?.[1]
    ? `${dateRange.value[1]}T23:59:59+08:00`
    : undefined,
}))

const formattedChanges = computed(() =>
  JSON.stringify(selectedLog.value?.changes || {}, null, 2),
)

const resourceLabels: Record<string, string> = {
  user: '用户',
  goods: '谷子',
  goods_craft: '谷子工艺',
  bgm_settings: 'BGM 配置',
  bgm_sync_job: 'BGM 任务',
  export: '数据导出',
  gamification_set: '成就系列',
  gamification_achievement: '成就',
  gamification_reward: '奖励',
  audit: '审计',
}

function resourceLabel(value: string) {
  return resourceLabels[value] || value
}

async function loadLogs() {
  const requestSequence = logListRequests.next()
  loading.value = true
  try {
    const response = await getAdminAuditLogs(requestParams.value)
    if (!logListRequests.isLatest(requestSequence)) return
    logs.value = response.results
    total.value = response.count
  } finally {
    if (logListRequests.isLatest(requestSequence)) loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  void loadLogs()
}

function handleSizeChange() {
  page.value = 1
  void loadLogs()
}

function resetFilters() {
  filters.search = ''
  filters.action = ''
  filters.resource_type = ''
  dateRange.value = null
  handleSearch()
}

function openDetail(row: AdminAuditLog) {
  selectedLog.value = row
  detailVisible.value = true
}

async function handleExport() {
  exporting.value = true
  try {
    const blob = await exportAdminResource('audit-logs', requestParams.value)
    downloadBlob(blob, `admin-audit-logs-${Date.now()}.csv`)
    ElMessage.success('导出已开始')
  } finally {
    exporting.value = false
  }
}

watch(dateRange, handleSearch)
onMounted(loadLogs)
</script>

<style scoped>
.content-body {
  min-height: 320px;
}

.resource-id {
  margin-left: 6px;
  color: #9099a6;
  font-size: 11px;
}

.audit-detail {
  padding: 20px;
}

.audit-detail dl {
  display: flex;
  margin: 0;
  flex-direction: column;
}

.audit-detail dl > div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 12px;
  border-bottom: 1px solid #eef0f3;
  padding: 12px 0;
}

.audit-detail dt {
  color: #9099a6;
  font-size: 12px;
}

.audit-detail dd {
  min-width: 0;
  margin: 0;
  color: #303846;
  font-size: 13px;
  word-break: break-word;
}

.audit-detail__changes {
  margin-top: 20px;
}

.audit-detail__changes h3 {
  margin: 0 0 10px;
  font-size: 14px;
}

.audit-detail__changes pre {
  max-height: 360px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8f9fb;
  color: #4b5563;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  padding: 14px;
  white-space: pre-wrap;
}
</style>
