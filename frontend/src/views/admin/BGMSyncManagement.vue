<template>
  <div class="bgm-sync-container">
    <!-- 顶部设置卡片 -->
    <el-card class="settings-card" shadow="never">
      <div class="settings-header">
        <div class="title-wrapper">
          <h2 class="page-title">BGM 自动同步</h2>
          <span class="sub-title">定时从 Bangumi 拉取已绑定 IP 的角色变更，支持审计</span>
        </div>
      </div>

      <div v-loading="settingsLoading" class="settings-body">
        <template v-if="settings">
        <div class="settings-row">
          <div class="setting-item">
            <span class="setting-label">自动同步</span>
            <el-switch
              v-model="settings.auto_sync_enabled"
              :loading="settingsSaving"
              @change="handleSaveSettings"
            />
            <span class="setting-hint">{{ settings.auto_sync_enabled ? '已开启' : '已关闭' }}</span>
          </div>

          <div class="setting-item">
            <span class="setting-label">同步频率</span>
            <el-select
              v-model="settings.frequency"
              :disabled="settingsSaving"
              style="width: 140px"
              @change="handleSaveSettings"
            >
              <el-option label="每天" value="daily" />
              <el-option label="每 3 天" value="every_3_days" />
              <el-option label="每周" value="weekly" />
            </el-select>
          </div>

          <div class="setting-item">
            <span class="setting-label">请求间隔(ms)</span>
            <el-input-number
              v-model="settings.request_interval_ms"
              :min="500"
              :max="10000"
              :step="500"
              :disabled="settingsSaving"
              style="width: 130px"
              @change="handleSaveSettings"
            />
          </div>
        </div>

        <div class="status-row">
          <div class="status-item">
            <span class="status-label">上次执行</span>
            <span class="status-value">{{ formatDateTime(settings.last_run_at) }}</span>
          </div>
          <div v-if="settings.auto_sync_enabled" class="status-item">
            <span class="status-label">下次执行</span>
            <span class="status-value">{{ formatDateTime(settings.next_run_at) }}</span>
          </div>
          <div v-else class="status-item">
            <span class="status-label">下次执行</span>
            <span class="status-value status-disabled">自动同步已关闭</span>
          </div>
          <div class="status-item">
            <span class="status-label">已绑定 BGM 的 IP</span>
            <span class="status-value">{{ boundIpCount }}</span>
          </div>
        </div>

        <div class="action-row">
          <el-button
            type="primary"
            :loading="runNowLoading"
            :disabled="!!runningJobId"
            @click="handleRunNow"
          >
            <el-icon><CaretRight /></el-icon>
            立即执行
          </el-button>
          <span v-if="runningJobId" class="running-hint">
            任务 #{{ runningJobId }} 执行中...
          </span>
        </div>
        </template>
      </div>
    </el-card>

    <!-- 任务历史 -->
    <el-card class="jobs-card" shadow="never">
      <div class="jobs-header">
        <h3 class="section-title">任务历史</h3>
        <div class="jobs-filters">
          <el-select
            v-model="jobFilter.status"
            placeholder="状态"
            clearable
            style="width: 130px"
            @change="fetchJobs"
          >
            <el-option label="执行中" value="running" />
            <el-option label="全部成功" value="succeeded" />
            <el-option label="部分成功" value="partial" />
            <el-option label="失败" value="failed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
          <el-select
            v-model="jobFilter.trigger"
            placeholder="触发方式"
            clearable
            style="width: 130px"
            @change="fetchJobs"
          >
            <el-option label="定时调度" value="scheduled" />
            <el-option label="手动触发" value="manual" />
          </el-select>
          <el-button @click="fetchJobs">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <div v-loading="jobsLoading" class="jobs-body">
        <el-table :data="jobs" style="width: 100%" @row-click="handleJobClick">
          <el-table-column prop="id" label="#" width="70" align="center" />
          <el-table-column prop="started_at" label="开始时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.started_at) }}</template>
          </el-table-column>
          <el-table-column prop="trigger" label="触发方式" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row.trigger === 'manual' ? 'warning' : 'info'" size="small" effect="plain">
                {{ row.trigger === 'manual' ? '手动' : '定时' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)" size="small">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="total_ips" label="总数" width="80" align="center" />
          <el-table-column prop="success_count" label="成功" width="80" align="center">
            <template #default="{ row }">
              <span class="count-success">{{ row.success_count }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="failed_count" label="失败" width="80" align="center">
            <template #default="{ row }">
              <span :class="{ 'count-failed': row.failed_count > 0 }">{{ row.failed_count }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="created_total" label="新增角色" width="100" align="center" />
          <el-table-column prop="linked_total" label="回填ID" width="90" align="center" />
          <el-table-column prop="duration_display" label="耗时" width="100" align="center" />
          <el-table-column prop="triggered_by" label="触发人" width="110" align="center">
            <template #default="{ row }">
              {{ row.triggered_by || '—' }}
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrapper">
          <el-pagination
            v-model:current-page="jobsPage"
            v-model:page-size="jobsPageSize"
            :page-sizes="[10, 20, 50]"
            :total="jobsTotal"
            layout="total, sizes, prev, pager, next"
            @size-change="fetchJobs"
            @current-change="fetchJobs"
          />
        </div>

        <el-empty v-if="!jobsLoading && jobs.length === 0" description="暂无同步记录" />
      </div>
    </el-card>

    <!-- 明细抽屉 -->
    <el-drawer
      v-model="itemsDrawerVisible"
      :title="itemsDrawerTitle"
      size="60%"
      direction="rtl"
    >
      <div v-if="itemsDrawerVisible && selectedJob" class="items-summary">
        <el-tag :type="getStatusTagType(selectedJob.status)" size="small">
          {{ getStatusLabel(selectedJob.status) }}
        </el-tag>
        <span class="summary-text">
          总数 {{ selectedJob.total_ips }} · 成功 {{ selectedJob.success_count }} ·
          失败 {{ selectedJob.failed_count }} · 新增 {{ selectedJob.created_total }} ·
          回填 {{ selectedJob.linked_total }}
        </span>
      </div>

      <div class="items-filters">
        <el-input
          v-model="itemFilter.ip_name_snapshot"
          placeholder="按 IP 名搜索"
          clearable
          style="width: 200px"
          @change="fetchJobItems"
        />
        <el-select
          v-model="itemFilter.status"
          placeholder="状态"
          clearable
          style="width: 140px"
          @change="fetchJobItems"
        >
          <el-option label="成功" value="success" />
          <el-option label="无变更" value="no_change" />
          <el-option label="跳过" value="skipped_unbound" />
          <el-option label="失败" value="error" />
        </el-select>
      </div>

      <div v-loading="itemsLoading" class="items-body">
        <el-table :data="jobItems" style="width: 100%">
          <el-table-column prop="ip_name_snapshot" label="IP 名称" min-width="150" />
          <el-table-column prop="status" label="状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="getItemStatusTagType(row.status)" size="small">
                {{ getItemStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="created_count" label="新增" width="80" align="center" />
          <el-table-column prop="linked_count" label="回填" width="80" align="center" />
          <el-table-column prop="duration_ms" label="耗时(ms)" width="110" align="center" />
          <el-table-column prop="error_message" label="错误信息" min-width="200">
            <template #default="{ row }">
              <el-tooltip
                v-if="row.error_message"
                :content="row.error_message"
                placement="top"
                :show-after="300"
              >
                <span class="error-text">{{ row.error_message }}</span>
              </el-tooltip>
              <span v-else class="no-error">—</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrapper">
          <el-pagination
            v-model:current-page="itemsPage"
            v-model:page-size="itemsPageSize"
            :page-sizes="[20, 50, 100]"
            :total="itemsTotal"
            layout="total, sizes, prev, pager, next"
            @size-change="fetchJobItems"
            @current-change="fetchJobItems"
          />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { CaretRight, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getBGMSyncSettings,
  updateBGMSyncSettings,
  runBGMSyncNow,
  getBGMSyncJob,
  listBGMSyncJobs,
  listBGMSyncJobItems,
  type BGMSyncSettings,
  type BGMSyncJob,
  type BGMSyncJobItem,
} from '@/api/admin'

// ==================== 设置 ====================
const settings = ref<BGMSyncSettings | null>(null)
const settingsLoading = ref(false)
const settingsSaving = ref(false)
const runNowLoading = ref(false)
const runningJobId = ref<number | null>(null)
const boundIpCount = ref(0)
// 手动触发后的轮询句柄：每 5s 拉一次当前 job 状态，直到离开 running
let runPollTimer: ReturnType<typeof setInterval> | null = null
const RUN_POLL_INTERVAL_MS = 5000

const fetchSettings = async () => {
  settingsLoading.value = true
  try {
    const data = await getBGMSyncSettings()
    settings.value = data
    boundIpCount.value = data.bound_ip_count || 0
  } catch (err: any) {
    ElMessage.error(err?.message || '获取设置失败')
  } finally {
    settingsLoading.value = false
  }
}

const handleSaveSettings = async () => {
  if (!settings.value) return
  settingsSaving.value = true
  try {
    const data = await updateBGMSyncSettings({
      auto_sync_enabled: settings.value.auto_sync_enabled,
      frequency: settings.value.frequency,
      request_interval_ms: settings.value.request_interval_ms,
    })
    settings.value = data
    ElMessage.success('设置已保存')
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
    await fetchSettings()
  } finally {
    settingsSaving.value = false
  }
}

const handleRunNow = async () => {
  try {
    await ElMessageBox.confirm(
      '将立即对所有已绑定 BGM 的 IP 执行一次同步。可能需要较长时间，确认继续？',
      '立即执行',
      { confirmButtonText: '执行', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  runNowLoading.value = true
  try {
    const job = await runBGMSyncNow()
    runningJobId.value = job.id
    ElMessage.success(`任务 #${job.id} 已开始执行`)
    await fetchJobs()
    // 启动轮询：后台线程才刚开始跑，保持 runningJobId 直到本次 job 完成
    startRunPolling(job.id)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.detail || err?.message || '执行失败')
  } finally {
    runNowLoading.value = false
  }
}

/**
 * 轮询指定 job 直到其 status 离开 running。
 *
 * 后台同步耗时较长（受 IP 数与 request_interval_ms 影响），HTTP 立即返回 job 摘要
 * 后该函数接管运行态展示：每 RUN_POLL_INTERVAL_MS 拉一次单条 job，刷新任务列表与设置，
 * 完成或失败后清空 runningJobId 并给出结果提示。
 */
const startRunPolling = (jobId: number) => {
  stopRunPolling()
  runPollTimer = setInterval(async () => {
    try {
      const job = await getBGMSyncJob(jobId)
      if (job.status !== 'running') {
        // 任务已结束：刷新列表/设置，展示结果
        stopRunPolling()
        runningJobId.value = null
        await Promise.all([fetchJobs(), fetchSettings()])
        if (job.status === 'failed') {
          ElMessage.error(`任务 #${jobId} 执行失败`)
        } else if (job.status === 'partial') {
          ElMessage.warning(`任务 #${jobId} 部分成功（成功 ${job.success_count} / 失败 ${job.failed_count}）`)
        } else {
          ElMessage.success(`任务 #${jobId} 已完成（新增 ${job.created_total} · 回填 ${job.linked_total}）`)
        }
      } else {
        // 仍在执行：刷新列表让用户看到进度
        await fetchJobs()
      }
    } catch {
      // 单次拉取失败不中断轮询（可能是瞬时网络抖动）
    }
  }, RUN_POLL_INTERVAL_MS)
}

const stopRunPolling = () => {
  if (runPollTimer !== null) {
    clearInterval(runPollTimer)
    runPollTimer = null
  }
}

// ==================== 任务列表 ====================
const jobs = ref<BGMSyncJob[]>([])
const jobsLoading = ref(false)
const jobsPage = ref(1)
const jobsPageSize = ref(20)
const jobsTotal = ref(0)
const jobFilter = ref<{ status: string | null; trigger: string | null }>({
  status: null,
  trigger: null,
})

const fetchJobs = async () => {
  jobsLoading.value = true
  try {
    const resp = await listBGMSyncJobs({
      page: jobsPage.value,
      page_size: jobsPageSize.value,
      status: jobFilter.value.status || undefined,
      trigger: jobFilter.value.trigger || undefined,
    })
    jobs.value = resp.results.map(j => ({ ...j, duration_display: formatDuration(j) }))
    jobsTotal.value = resp.count
  } catch (err: any) {
    ElMessage.error(err?.message || '获取任务列表失败')
  } finally {
    jobsLoading.value = false
  }
}

const formatDuration = (job: BGMSyncJob): string => {
  if (!job.finished_at || !job.started_at) return '—'
  const ms = new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`
}

// ==================== 明细抽屉 ====================
const itemsDrawerVisible = ref(false)
const selectedJob = ref<BGMSyncJob | null>(null)
const jobItems = ref<BGMSyncJobItem[]>([])
const itemsLoading = ref(false)
const itemsPage = ref(1)
const itemsPageSize = ref(20)
const itemsTotal = ref(0)
const itemFilter = ref<{ ip_name_snapshot: string | null; status: string | null }>({
  ip_name_snapshot: null,
  status: null,
})

const itemsDrawerTitle = computed(() =>
  selectedJob.value ? `任务 #${selectedJob.value.id} 明细` : '任务明细',
)

const handleJobClick = (job: BGMSyncJob) => {
  selectedJob.value = job
  itemsDrawerVisible.value = true
  itemsPage.value = 1
  itemFilter.value = { ip_name_snapshot: null, status: null }
  fetchJobItems()
}

const fetchJobItems = async () => {
  if (!selectedJob.value) return
  itemsLoading.value = true
  try {
    const resp = await listBGMSyncJobItems(selectedJob.value.id, {
      page: itemsPage.value,
      page_size: itemsPageSize.value,
      status: itemFilter.value.status || undefined,
      ip_name_snapshot: itemFilter.value.ip_name_snapshot || undefined,
    })
    jobItems.value = resp.results
    itemsTotal.value = resp.count
  } catch (err: any) {
    ElMessage.error(err?.message || '获取明细失败')
  } finally {
    itemsLoading.value = false
  }
}

// ==================== 工具函数 ====================
const formatDateTime = (dt: string | null | undefined): string => {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getStatusTagType = (s: string): '' | 'success' | 'info' | 'warning' | 'danger' => {
  const map: Record<string, '' | 'success' | 'info' | 'warning' | 'danger'> = {
    running: 'warning',
    succeeded: 'success',
    partial: 'warning',
    failed: 'danger',
    cancelled: 'info',
  }
  return map[s] || ''
}

const getStatusLabel = (s: string): string => {
  const map: Record<string, string> = {
    running: '执行中',
    succeeded: '全部成功',
    partial: '部分成功',
    failed: '失败',
    cancelled: '已取消',
  }
  return map[s] || s
}

const getItemStatusTagType = (s: string): '' | 'success' | 'info' | 'warning' | 'danger' => {
  const map: Record<string, '' | 'success' | 'info' | 'warning' | 'danger'> = {
    success: 'success',
    no_change: 'info',
    skipped_unbound: 'info',
    error: 'danger',
  }
  return map[s] || ''
}

const getItemStatusLabel = (s: string): string => {
  const map: Record<string, string> = {
    success: '成功',
    no_change: '无变更',
    skipped_unbound: '跳过',
    error: '失败',
  }
  return map[s] || s
}

onMounted(() => {
  fetchSettings()
  fetchJobs()
})

onUnmounted(() => {
  // 离开页面时停止轮询，避免泄漏 setInterval 与对已卸载组件的异步更新
  stopRunPolling()
})
</script>

<style scoped>
.bgm-sync-container {
  padding: 20px;
  max-width: 1280px;
  margin: 0 auto;
}

.settings-card,
.jobs-card {
  border-radius: 12px;
  border: none;
  margin-bottom: 20px;
}

.title-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.sub-title {
  font-size: 13px;
  color: #909399;
}

.settings-body {
  padding-top: 8px;
}

.settings-row {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  margin-bottom: 20px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.setting-hint {
  font-size: 12px;
  color: #909399;
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  padding: 16px;
  background: #f7f8fa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-label {
  font-size: 12px;
  color: #909399;
}

.status-value {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.status-disabled {
  color: #909399;
  font-weight: 400;
}

.status-disabled {
  color: #909399;
  font-weight: 400;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.running-hint {
  font-size: 13px;
  color: #e6a23c;
}

.jobs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.jobs-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.jobs-body {
  min-height: 200px;
}

.count-success {
  color: #67c23a;
  font-weight: 600;
}

.count-failed {
  color: #f56c6c;
  font-weight: 600;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0;
}

.items-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f7f8fa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.summary-text {
  font-size: 13px;
  color: #606266;
}

.items-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.error-text {
  color: #f56c6c;
  cursor: help;
  display: inline-block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-error {
  color: #c0c4cc;
}

:deep(.el-table__row) {
  cursor: pointer;
}

@media (max-width: 768px) {
  .bgm-sync-container {
    padding: 16px;
  }

  .settings-row,
  .status-row {
    flex-direction: column;
    gap: 16px;
  }

  .jobs-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .jobs-filters {
    width: 100%;
  }
}
</style>
