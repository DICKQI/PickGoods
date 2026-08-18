<template>
  <div class="preorder-delay-form-root">
    <el-form label-position="top" class="preorder-delay-form">
      <section class="preorder-delay-section">
        <div class="preorder-delay-section-title">
          <h4>当前预计补款</h4>
          <p>厂家跳票时可顺延补款时间</p>
        </div>
        <div class="preorder-delay-current">
          <span class="preorder-delay-current-icon"><el-icon><Calendar /></el-icon></span>
          <span class="preorder-delay-current-text">{{ currentText }}</span>
          <span v-if="targetRef && targetRef.delay_count > 0" class="preorder-delay-badge">已延期 {{ targetRef.delay_count }} 次</span>
        </div>
        <p class="preorder-delay-hint">延期后旧提醒自动失效，并按新时间重新提醒</p>
      </section>

      <section class="preorder-delay-section">
        <div class="preorder-delay-section-title">
          <h4>延期到</h4>
          <p>只能顺延到更晚的时间</p>
        </div>
        <el-segmented v-model="selectedKey" :options="segmentedOptions" class="preorder-delay-options" />
        <div v-if="selectedKey === 'custom'" class="preorder-delay-custom">
          <el-date-picker
            v-if="!isQuarter"
            v-model="customMonth"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择延期后的月份"
            style="width: 100%"
            :clearable="false"
            :disabled-date="customDisabledDate"
          />
          <el-select v-else v-model="customQuarter" placeholder="选择延期后的季度" style="width: 100%">
            <el-option v-for="opt in quarterOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </div>
      </section>

      <section class="preorder-delay-section">
        <div class="preorder-delay-section-title">
          <h4>延期说明</h4>
          <p>会写入通知与历史记录</p>
        </div>
        <el-form-item label="">
          <el-input v-model="reason" maxlength="100" placeholder="延期原因，默认「厂家跳票」" />
        </el-form-item>
        <el-form-item label="">
          <el-input v-model="note" type="textarea" :rows="2" placeholder="补充说明（选填），如官方公告延期到某月" />
        </el-form-item>
      </section>

      <section class="preorder-delay-section">
        <div class="preorder-delay-section-title">
          <h4>延期历史</h4>
          <p>{{ records.length ? `共 ${records.length} 次` : '' }}</p>
        </div>
        <div v-if="historyLoading" class="preorder-delay-history-empty">加载中…</div>
        <div v-else-if="historyError" class="preorder-delay-history-empty">
          <span>历史加载失败</span>
          <el-button link type="primary" size="small" @click="loadHistory">重试</el-button>
        </div>
        <div v-else-if="!records.length" class="preorder-delay-history-empty">暂无延期记录</div>
        <ul v-else class="preorder-delay-history">
          <li v-for="r in records" :key="r.id" class="preorder-delay-history-item">
            <div class="preorder-delay-history-main">
              <span class="preorder-delay-history-from">{{ formatRecordPeriod(r.from_month, r.from_granularity) }}</span>
              <el-icon class="preorder-delay-history-arrow"><Right /></el-icon>
              <span class="preorder-delay-history-to">{{ formatRecordPeriod(r.to_month, r.to_granularity) }}</span>
              <span class="preorder-delay-history-reason">{{ r.reason }}</span>
            </div>
            <div class="preorder-delay-history-meta">
              <span>{{ formatRecordTime(r.created_at) }}</span>
              <span v-if="r.note">{{ r.note }}</span>
            </div>
          </li>
        </ul>
      </section>
    </el-form>

    <div class="preorder-delay-form-footer">
      <el-button class="preorder-delay-cancel" @click="$emit('close')">取消</el-button>
      <el-button class="preorder-delay-submit" type="primary" :loading="submitting" @click="handleSubmit">
        确认延期
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { Calendar, Right } from '@element-plus/icons-vue'
import { usePreorderDelay } from '@/composables/usePreorderDelay'
import { formatPeriod } from '@/utils/preorder'
import type { Preorder } from '@/api/types'

const props = defineProps<{
  visible: boolean
  target: Preorder | null
}>()

const emit = defineEmits<{
  close: []
  delayed: []
}>()

const delay = usePreorderDelay()
// 顶层解包：模板中对 ref / reactive 的自动解包只作用于顶层绑定
// （target 与 props 键重名，解构重命名为 targetRef）
const {
  target: targetRef,
  isQuarter,
  quickOptions,
  selectedKey,
  customMonth,
  customQuarter,
  customDisabledDate,
  quarterOptions,
  reason,
  note,
  records,
  historyLoading,
  historyError,
  submitting,
  open,
  loadHistory,
} = delay

const currentText = computed(() => {
  const item = targetRef.value
  return item ? formatPeriod(item.estimated_month, item.time_granularity) : ''
})

const segmentedOptions = computed(() => [
  ...quickOptions.value.map((o) => ({ label: o.label, value: o.key })),
  { label: '自定义', value: 'custom' },
])

const formatRecordPeriod = (ymd: string, granularity: 'month' | 'quarter') =>
  formatPeriod(ymd, granularity)

const formatRecordTime = (iso: string) =>
  new Date(iso).toLocaleString('zh-CN', { hour12: false })

// 打开 / 切换目标时重置表单并加载历史
watch(
  [() => props.visible, () => props.target],
  ([visible]) => {
    if (visible && props.target) open(props.target)
  },
  { immediate: true }
)

const handleSubmit = async () => {
  const ok = await delay.submit()
  if (ok) emit('delayed')
}

// 暴露延期状态：页面级测试通过子组件实例访问表单/历史状态
defineExpose({ delay })
</script>

<style scoped>
.preorder-delay-form-root {
  display: flex;
  flex-direction: column;
}

@media (min-width: 769px) {
  .preorder-delay-form-root {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }

  .preorder-delay-form {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
}

.preorder-delay-form {
  padding: 20px 28px 4px;
}

.preorder-delay-section {
  margin-bottom: 16px;
  padding: 16px 18px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.09), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 12px 26px -26px rgba(17, 24, 39, 0.5);
}

.preorder-delay-section-title {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 12px;
}

.preorder-delay-section-title::before {
  content: '';
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--primary-gold);
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.12);
}

.preorder-delay-section-title h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #2f2a20;
}

.preorder-delay-section-title p {
  margin: 0 0 0 auto;
  font-size: 12px;
  color: #9ca3af;
}

/* 当前时间展示条 */
.preorder-delay-current {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(162, 155, 254, 0.1));
  border: 1px solid rgba(212, 175, 55, 0.22);
}

.preorder-delay-current-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  color: #9a740b;
  font-size: 15px;
}

.preorder-delay-current-text {
  font-size: 15px;
  font-weight: 800;
  color: #2f2a20;
}

.preorder-delay-badge {
  margin-left: auto;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(230, 162, 60, 0.16);
  border: 1px solid rgba(230, 162, 60, 0.32);
  color: #b88230;
  font-size: 11px;
  font-weight: 700;
}

.preorder-delay-hint {
  margin: 10px 2px 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.6;
}

/* 快捷选项：圆润胶囊，选中态金渐变 */
.preorder-delay-options {
  --el-segmented-bg-color: rgba(244, 243, 247, 0.9);
  --el-segmented-padding: 3px;
  --el-segmented-item-selected-bg-color: linear-gradient(135deg, #fdf4da 0%, #f4da94 100%);
  --el-segmented-item-selected-color: #7a5b08;
  --el-segmented-item-hover-bg-color: rgba(212, 175, 55, 0.1);
  --el-segmented-item-hover-color: #8a650b;
  width: 100%;
  padding: 3px;
  box-sizing: border-box;
  border-radius: 12px;
}

.preorder-delay-options :deep(.el-segmented__item) {
  padding: 0 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}

.preorder-delay-options :deep(.el-segmented__item-selected) {
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.preorder-delay-custom {
  margin-top: 12px;
}

.preorder-delay-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.preorder-delay-form :deep(.el-input__wrapper),
.preorder-delay-form :deep(.el-select__wrapper),
.preorder-delay-form :deep(.el-textarea__inner) {
  min-height: 44px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6px 18px -14px rgba(162, 155, 254, 0.45);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.preorder-delay-form :deep(.el-input__wrapper.is-focus),
.preorder-delay-form :deep(.el-select__wrapper.is-focused) {
  border-color: rgba(162, 155, 254, 0.5);
  box-shadow: 0 0 0 3px rgba(196, 181, 253, 0.2), 0 10px 22px -14px rgba(162, 155, 254, 0.5);
}

/* 延期历史 */
.preorder-delay-history {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.preorder-delay-history-item {
  padding: 10px 12px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
}

.preorder-delay-history-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.preorder-delay-history-from {
  color: #9ca3af;
  font-size: 13px;
  font-weight: 600;
  text-decoration: line-through;
}

.preorder-delay-history-arrow {
  color: #c0c4cc;
  font-size: 12px;
}

.preorder-delay-history-to {
  color: #2f2a20;
  font-size: 13px;
  font-weight: 800;
}

.preorder-delay-history-reason {
  margin-left: auto;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(230, 162, 60, 0.12);
  color: #b88230;
  font-size: 11px;
  font-weight: 700;
}

.preorder-delay-history-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  font-size: 11.5px;
  color: #c0c4cc;
}

.preorder-delay-history-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 0;
  color: #c0c4cc;
  font-size: 12.5px;
}

/* 底部操作：桌面弹窗 / 移动抽屉共用，吸底 */
.preorder-delay-form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 28px 20px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid rgba(212, 175, 55, 0.12);
}

.preorder-delay-cancel,
.preorder-delay-submit {
  min-width: 104px;
  min-height: 40px;
  border-radius: 12px;
  font-weight: 800;
}

.preorder-delay-cancel {
  border: 1px solid rgba(212, 175, 55, 0.35);
  color: #8a650b;
  background: rgba(255, 248, 230, 0.6);
}

.preorder-delay-cancel:hover {
  background: rgba(255, 248, 230, 0.95);
  border-color: rgba(212, 175, 55, 0.5);
  color: #8a650b;
}

.preorder-delay-submit {
  border: none;
  background: linear-gradient(135deg, var(--accent-purple), var(--accent-purple-hover));
  box-shadow: 0 8px 20px -8px rgba(142, 125, 255, 0.55);
}

.preorder-delay-submit:hover {
  background: linear-gradient(135deg, var(--accent-purple-hover), var(--accent-purple-dark));
}

@media (max-width: 768px) {
  .preorder-delay-form {
    padding: 16px 14px 4px;
  }

  .preorder-delay-section {
    margin-bottom: 14px;
    padding: 14px;
  }

  .preorder-delay-form-footer {
    position: sticky;
    bottom: 0;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  }

  .preorder-delay-cancel,
  .preorder-delay-submit {
    flex: 1;
    min-height: 48px;
  }
}
</style>
