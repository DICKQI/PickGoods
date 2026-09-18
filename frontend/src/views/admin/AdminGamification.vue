<template>
  <div class="admin-page gamification-admin">
    <AdminPageHeader title="成就与奖励" subtitle="配置成就规则、限时活动、奖励素材和用户进度。">
      <el-button :loading="loading" @click="refreshAll">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </AdminPageHeader>

    <el-tabs v-model="activeTab" class="gamification-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="成就与活动" name="sets">
        <div class="toolbar">
          <el-input v-model="setSearch" clearable placeholder="搜索系列" @keyup.enter="loadSets">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" @click="openSetDialog()"><el-icon><Plus /></el-icon>新增系列</el-button>
        </div>
        <el-table v-loading="loading" :data="sets" row-key="id">
          <el-table-column prop="name" label="系列" min-width="150" />
          <el-table-column prop="code" label="编码" min-width="160" />
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.is_limited ? 'danger' : 'warning'" effect="plain">
                {{ row.is_limited ? '限时' : '永久' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="achievement_count" label="成就数" width="90" align="center" />
          <el-table-column label="时间窗" min-width="230">
            <template #default="{ row }">{{ formatWindow(row) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'" effect="plain">
                {{ row.is_active ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="170" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openAchievementDialog(undefined, row.id)">添加成就</el-button>
              <el-button link type="primary" @click="openSetDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeSet(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="section-title-row">
          <h3>成就规则</h3>
          <el-button type="primary" class="soft-button" @click="openAchievementDialog()">
            <el-icon><Plus /></el-icon>新增成就
          </el-button>
        </div>
        <el-table v-loading="loading" :data="achievements" row-key="id">
          <el-table-column prop="name" label="成就" min-width="160" />
          <el-table-column prop="set_name" label="系列" min-width="130" />
          <el-table-column prop="code" label="编码" min-width="150" />
          <el-table-column label="规则" min-width="230">
            <template #default="{ row }">{{ ruleSummary(row) }}</template>
          </el-table-column>
          <el-table-column prop="user_count" label="用户进度" width="100" align="center" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'" effect="plain">{{ row.is_active ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openAchievementDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeAchievement(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="奖励与素材" name="rewards">
        <div class="toolbar">
          <el-input v-model="rewardSearch" clearable placeholder="搜索奖励" @keyup.enter="loadRewards">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" @click="openRewardDialog()"><el-icon><Plus /></el-icon>新增奖励</el-button>
        </div>
        <el-table v-loading="loading" :data="rewards" row-key="id">
          <el-table-column label="预览" width="90">
            <template #default="{ row }">
              <div class="reward-thumb">
                <img v-if="row.asset_url" :src="row.asset_url" alt="" />
                <el-icon v-else><Medal /></el-icon>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="150" />
          <el-table-column prop="code" label="编码" min-width="170" />
          <el-table-column label="类型" min-width="130">
            <template #default="{ row }">{{ rewardTypeLabel(row.reward_type) }}</template>
          </el-table-column>
          <el-table-column prop="preset_key" label="预设键" min-width="130" />
          <el-table-column prop="achievement_count" label="关联成就" width="100" align="center" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'" effect="plain">{{ row.is_active ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openRewardDialog(row)">编辑</el-button>
              <el-button link type="success" @click="triggerAssetUpload(row.id)">上传素材</el-button>
              <el-button link type="danger" @click="removeReward(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <input ref="assetInput" class="sr-only-input" type="file" accept="image/*" @change="uploadAsset" />
      </el-tab-pane>

      <el-tab-pane label="用户进度" name="users">
        <div class="toolbar">
          <el-input v-model="userSearch" clearable placeholder="搜索用户名" @keyup.enter="loadUsers">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>
        <el-table v-loading="loading" :data="users" row-key="id">
          <el-table-column prop="username" label="用户" min-width="150" />
          <el-table-column prop="event_count" label="事件数" width="100" align="center" />
          <el-table-column prop="achievement_count" label="已解锁" width="100" align="center" />
          <el-table-column prop="claimed_count" label="已领取" width="100" align="center" />
          <el-table-column label="当前指标" min-width="360">
            <template #default="{ row }">
              <div class="metric-chips">
                <span>谷子 {{ row.metrics.goods_quantity }}</span>
                <span>痛柜 {{ row.metrics.valid_altars }}</span>
                <span>消费 ¥{{ Number(row.metrics.spend_amount).toFixed(2) }}</span>
                <span>IP {{ row.metrics.distinct_ip_count }}</span>
                <span>角色 {{ row.metrics.distinct_character_count }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="180">
            <template #default="{ row }">{{ row.updated_at ? formatDateTime(row.updated_at) : '—' }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="setDialogVisible" :title="setForm.id ? '编辑系列' : '新增系列'" width="min(92vw, 620px)">
      <el-form :model="setForm" label-position="top">
        <div class="form-grid">
          <el-form-item label="编码"><el-input v-model="setForm.code" maxlength="80" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="setForm.name" maxlength="100" /></el-form-item>
        </div>
        <el-form-item label="说明"><el-input v-model="setForm.description" type="textarea" :rows="2" /></el-form-item>
        <div class="form-grid">
          <el-form-item label="开始时间"><el-date-picker v-model="setForm.starts_at" type="datetime" value-format="YYYY-MM-DDTHH:mm:ssZ" /></el-form-item>
          <el-form-item label="结束时间"><el-date-picker v-model="setForm.ends_at" type="datetime" value-format="YYYY-MM-DDTHH:mm:ssZ" /></el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="标签"><el-input v-model="setForm.badge_label" maxlength="30" /></el-form-item>
          <el-form-item label="排序"><el-input-number v-model="setForm.order" :step="10" /></el-form-item>
        </div>
        <div class="switch-row">
          <el-checkbox v-model="setForm.is_limited">限时活动</el-checkbox>
          <el-checkbox v-model="setForm.is_active">启用</el-checkbox>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="setDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveSet">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="achievementDialogVisible" :title="achievementForm.id ? '编辑成就' : '新增成就'" width="min(96vw, 860px)">
      <el-form :model="achievementForm" label-position="top">
        <div class="form-grid form-grid--three">
          <el-form-item label="编码"><el-input v-model="achievementForm.code" maxlength="100" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="achievementForm.name" maxlength="100" /></el-form-item>
          <el-form-item label="所属系列">
            <el-select v-model="achievementForm.set"><el-option v-for="item in sets" :key="item.id" :label="item.name" :value="item.id" /></el-select>
          </el-form-item>
        </div>
        <el-form-item label="说明"><el-input v-model="achievementForm.description" type="textarea" :rows="2" /></el-form-item>
        <div class="form-grid">
          <el-form-item label="根规则">
            <el-radio-group v-model="achievementForm.root_operator">
              <el-radio-button value="ALL">全部满足</el-radio-button>
              <el-radio-button value="ANY">任一满足</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="关联奖励">
            <el-select v-model="achievementForm.rewards" multiple collapse-tags style="width: 100%">
              <el-option v-for="reward in rewards" :key="reward.id" :label="reward.name" :value="reward.id" />
            </el-select>
          </el-form-item>
        </div>
        <div class="switch-row">
          <el-checkbox v-model="achievementForm.is_limited">限定成就</el-checkbox>
          <el-checkbox v-model="achievementForm.is_active">启用</el-checkbox>
          <el-input-number v-model="achievementForm.order" :step="10" />
        </div>

        <div class="rule-heading">
          <strong>规则组与条件</strong>
          <el-button text type="primary" @click="addRuleGroup">添加规则组</el-button>
        </div>
        <section v-for="(group, groupIndex) in achievementForm.rule_groups" :key="groupIndex" class="rule-group">
          <header>
            <span>规则组 {{ groupIndex + 1 }}</span>
            <el-radio-group v-model="group.operator" size="small">
              <el-radio-button value="ALL">全部</el-radio-button>
              <el-radio-button value="ANY">任一</el-radio-button>
            </el-radio-group>
            <el-button link type="danger" @click="achievementForm.rule_groups.splice(groupIndex, 1)">删除组</el-button>
          </header>
          <div v-for="(condition, conditionIndex) in group.conditions" :key="conditionIndex" class="rule-condition">
            <el-select v-model="condition.metric">
              <el-option v-for="metric in metrics" :key="metric.value" :label="metric.label" :value="metric.value" />
            </el-select>
            <el-input-number v-model="condition.threshold" :min="0.01" :precision="2" />
            <el-input v-model="condition.filtersText" placeholder='筛选 JSON，例如 {"ip_ids":[1]}' />
            <el-button link type="danger" @click="group.conditions.splice(conditionIndex, 1)">删除</el-button>
          </div>
          <el-button text type="primary" @click="addCondition(group)">添加条件</el-button>
        </section>
        <el-alert
          :title="`规则预览：${achievementRulePreview}`"
          type="info"
          :closable="false"
          show-icon
        />
      </el-form>
      <template #footer>
        <el-button @click="achievementDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveAchievement">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rewardDialogVisible" :title="rewardForm.id ? '编辑奖励' : '新增奖励'" width="min(92vw, 660px)">
      <el-form :model="rewardForm" label-position="top">
        <div class="form-grid">
          <el-form-item label="编码"><el-input v-model="rewardForm.code" maxlength="80" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="rewardForm.name" maxlength="100" /></el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="类型">
            <el-select v-model="rewardForm.reward_type" style="width:100%">
              <el-option v-for="item in rewardTypes" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="稀有度">
            <el-select v-model="rewardForm.rarity" style="width:100%">
              <el-option label="普通" value="common" />
              <el-option label="稀有" value="rare" />
              <el-option label="史诗" value="epic" />
              <el-option label="限定" value="legendary" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="说明"><el-input v-model="rewardForm.description" type="textarea" :rows="2" /></el-form-item>
        <div class="form-grid">
          <el-form-item label="前端预设键">
            <el-select
              v-if="currentPresetOptions.length"
              v-model="rewardForm.preset_key"
              clearable
              style="width:100%"
              placeholder="选择已注册预设"
            >
              <el-option
                v-for="option in currentPresetOptions"
                :key="option"
                :label="option"
                :value="option"
              />
            </el-select>
            <el-input v-else v-model="rewardForm.preset_key" placeholder="徽章或贴纸包可留空" />
          </el-form-item>
          <el-form-item label="排序"><el-input-number v-model="rewardForm.order" :step="10" /></el-form-item>
        </div>
        <el-form-item label="主素材">
          <input type="file" accept="image/*" @change="handleRewardAssetChange" />
        </el-form-item>
        <el-checkbox v-model="rewardForm.is_active">启用奖励</el-checkbox>
      </el-form>
      <template #footer>
        <el-button @click="rewardDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveReward">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Medal, Plus, Refresh, Search } from '@element-plus/icons-vue'
import AdminPageHeader from './components/AdminPageHeader.vue'
import { formatDateTime } from '@/utils/datetime'
import {
  createAdminGamificationAchievement,
  createAdminGamificationReward,
  createAdminGamificationSet,
  deleteAdminGamificationAchievement,
  deleteAdminGamificationReward,
  deleteAdminGamificationSet,
  getAdminGamificationAchievements,
  getAdminGamificationRewards,
  getAdminGamificationSets,
  getAdminGamificationUsers,
  updateAdminGamificationAchievement,
  updateAdminGamificationReward,
  updateAdminGamificationSet,
  uploadAdminGamificationRewardAsset,
} from '@/api/gamification'
import type {
  AdminGamificationAchievement,
  AdminGamificationReward,
  AdminGamificationRuleGroup,
  AdminGamificationSet,
  AdminGamificationUser,
  GamificationMetric,
  GamificationOperator,
  GamificationRewardType,
} from '@/api/types'

type EditableCondition = AdminGamificationRuleGroup['conditions'][number] & { filtersText?: string }
type EditableGroup = Omit<AdminGamificationRuleGroup, 'conditions'> & { conditions: EditableCondition[] }

const activeTab = ref('sets')
const loading = ref(false)
const submitting = ref(false)
const setSearch = ref('')
const rewardSearch = ref('')
const userSearch = ref('')
const sets = ref<AdminGamificationSet[]>([])
const achievements = ref<AdminGamificationAchievement[]>([])
const rewards = ref<AdminGamificationReward[]>([])
const users = ref<AdminGamificationUser[]>([])

const setDialogVisible = ref(false)
const achievementDialogVisible = ref(false)
const rewardDialogVisible = ref(false)
const assetInput = ref<HTMLInputElement | null>(null)
const assetTargetId = ref<number | null>(null)
const rewardAssetFile = ref<File | null>(null)

const setForm = reactive<Partial<AdminGamificationSet>>({
  id: undefined,
  code: '',
  name: '',
  description: '',
  badge_label: '',
  starts_at: null,
  ends_at: null,
  is_limited: false,
  is_active: true,
  order: 0,
})

const achievementForm = reactive<{
  id?: number
  code: string
  set: number | null
  name: string
  description: string
  root_operator: GamificationOperator
  is_active: boolean
  is_limited: boolean
  order: number
  rewards: number[]
  rule_groups: EditableGroup[]
}>({
  code: '',
  set: null,
  name: '',
  description: '',
  root_operator: 'ALL',
  is_active: true,
  is_limited: false,
  order: 0,
  rewards: [],
  rule_groups: [],
})

const rewardForm = reactive<{
  id?: number
  code: string
  name: string
  description: string
  reward_type: GamificationRewardType
  rarity: AdminGamificationReward['rarity']
  preset_key: string
  order: number
  is_active: boolean
}>({
  code: '',
  name: '',
  description: '',
  reward_type: 'BADGE',
  rarity: 'common',
  preset_key: '',
  order: 0,
  is_active: true,
})

const metrics: Array<{ label: string; value: GamificationMetric }> = [
  { label: '新增谷子件数', value: 'GOODS_QUANTITY' },
  { label: '有效角色痛柜数', value: 'VALID_ALTARS' },
  { label: '累计消费金额', value: 'SPEND_AMOUNT' },
  { label: '去重 IP 数', value: 'DISTINCT_IP_COUNT' },
  { label: '去重角色数', value: 'DISTINCT_CHARACTER_COUNT' },
]

const rewardTypes: Array<{ label: string; value: GamificationRewardType }> = [
  { label: '成就徽章', value: 'BADGE' },
  { label: '头像框', value: 'PROFILE_FRAME' },
  { label: '收藏卡皮肤', value: 'PROFILE_CARD_SKIN' },
  { label: '手帐贴纸包', value: 'JOURNAL_STICKER_PACK' },
  { label: '手帐背景', value: 'JOURNAL_BACKGROUND' },
  { label: '痛柜主题', value: 'SHOWCASE_THEME' },
  { label: '痛柜效果', value: 'SHOWCASE_EFFECT' },
]

const presetOptionsByType: Partial<Record<GamificationRewardType, string[]>> = {
  PROFILE_FRAME: ['star-orbit', 'radiant-crown'],
  PROFILE_CARD_SKIN: ['neon-dream', 'collection-ledger'],
  JOURNAL_BACKGROUND: ['sakura-grid'],
  SHOWCASE_THEME: ['cream-stage', 'night-museum'],
  SHOWCASE_EFFECT: ['soft-glow', 'galaxy-flow', 'gold-fall'],
}
const currentPresetOptions = computed(() => presetOptionsByType[rewardForm.reward_type] || [])
watch(
  () => rewardForm.reward_type,
  () => {
    if (currentPresetOptions.value.length && !currentPresetOptions.value.includes(rewardForm.preset_key)) {
      rewardForm.preset_key = ''
    }
  },
)

const achievementRulePreview = computed(() => achievementForm.rule_groups
  .map(group => {
    const conditions = group.conditions.map(condition =>
      `${metrics.find(item => item.value === condition.metric)?.label || condition.metric} ≥ ${condition.threshold}`,
    )
    return conditions.length > 1
      ? `(${conditions.join(group.operator === 'ANY' ? ' 或 ' : ' 且 ')})`
      : conditions[0] || '空条件组'
  })
  .join(achievementForm.root_operator === 'ANY' ? ' 或 ' : ' 且 ') || '尚未配置条件')

async function loadSets() {
  sets.value = (await getAdminGamificationSets({ page_size: 100, search: setSearch.value || undefined })).results
}

async function loadAchievements() {
  achievements.value = (await getAdminGamificationAchievements({ page_size: 100 })).results
}

async function loadRewards() {
  rewards.value = (await getAdminGamificationRewards({ page_size: 100, search: rewardSearch.value || undefined })).results
}

async function loadUsers() {
  users.value = (await getAdminGamificationUsers({ page_size: 100, search: userSearch.value || undefined })).results
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([loadSets(), loadAchievements(), loadRewards(), loadUsers()])
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  if (activeTab.value === 'sets') void Promise.all([loadSets(), loadAchievements()])
  if (activeTab.value === 'rewards') void loadRewards()
  if (activeTab.value === 'users') void loadUsers()
}

function formatWindow(row: AdminGamificationSet) {
  if (!row.starts_at && !row.ends_at) return '永久'
  return `${row.starts_at ? formatDateTime(row.starts_at) : '不限'} 至 ${row.ends_at ? formatDateTime(row.ends_at) : '不限'}`
}

function openSetDialog(row?: AdminGamificationSet) {
  Object.assign(setForm, row || {
    id: undefined,
    code: '',
    name: '',
    description: '',
    badge_label: '',
    starts_at: null,
    ends_at: null,
    is_limited: false,
    is_active: true,
    order: 0,
  })
  setDialogVisible.value = true
}

async function saveSet() {
  if (!setForm.code || !setForm.name) return ElMessage.warning('请填写系列编码和名称')
  submitting.value = true
  try {
    if (setForm.id) await updateAdminGamificationSet(setForm.id, setForm)
    else await createAdminGamificationSet(setForm)
    setDialogVisible.value = false
    await loadSets()
    ElMessage.success('系列已保存')
  } finally {
    submitting.value = false
  }
}

async function removeSet(row: AdminGamificationSet) {
  try {
    await ElMessageBox.confirm(`删除系列“${row.name}”会同时删除其成就规则，确认继续？`, '删除系列', { type: 'warning' })
    await deleteAdminGamificationSet(row.id)
    await Promise.all([loadSets(), loadAchievements()])
    ElMessage.success('系列已删除')
  } catch (error) {
    if (!isDialogCancel(error)) ElMessage.error(adminErrorMessage(error, '删除系列失败'))
  }
}

function emptyCondition(): EditableCondition {
  return { metric: 'GOODS_QUANTITY', threshold: 1, filters: {}, filtersText: '{}', order: 0 }
}

function addRuleGroup() {
  achievementForm.rule_groups.push({ operator: 'ALL', order: achievementForm.rule_groups.length, conditions: [emptyCondition()] })
}

function addCondition(group: EditableGroup) {
  group.conditions.push(emptyCondition())
}

function openAchievementDialog(row?: AdminGamificationAchievement, presetSetId?: number) {
  if (row) {
    Object.assign(achievementForm, {
      ...row,
      rewards: row.rewards.map(Number),
      rule_groups: row.rule_groups.map(group => ({
        ...group,
        conditions: group.conditions.map(condition => ({
          ...condition,
          filtersText: JSON.stringify(condition.filters || {}, null, 0),
        })),
      })),
    })
  } else {
    Object.assign(achievementForm, {
      id: undefined,
      code: '',
      set: presetSetId || sets.value[0]?.id || null,
      name: '',
      description: '',
      root_operator: 'ALL',
      is_active: true,
      is_limited: false,
      order: 0,
      rewards: [],
      rule_groups: [{ operator: 'ALL', order: 0, conditions: [emptyCondition()] }],
    })
  }
  achievementDialogVisible.value = true
}

async function saveAchievement() {
  if (!achievementForm.code || !achievementForm.name || !achievementForm.set) return ElMessage.warning('请填写编码、名称和系列')
  if (!achievementForm.rule_groups.length) return ElMessage.warning('至少需要一组规则')
  let ruleGroups
  try {
    ruleGroups = achievementForm.rule_groups.map(group => ({
      operator: group.operator,
      order: group.order,
      conditions: group.conditions.map((condition, index) => ({
        metric: condition.metric,
        threshold: condition.threshold,
        filters: condition.filtersText ? JSON.parse(condition.filtersText) : (condition.filters || {}),
        order: index,
      })),
    }))
  } catch {
    return ElMessage.error('筛选条件必须是合法 JSON')
  }
  const payload = {
    code: achievementForm.code,
    set: achievementForm.set,
    name: achievementForm.name,
    description: achievementForm.description,
    root_operator: achievementForm.root_operator,
    is_active: achievementForm.is_active,
    is_limited: achievementForm.is_limited,
    order: achievementForm.order,
    rewards: achievementForm.rewards,
    rule_groups: ruleGroups,
  }
  submitting.value = true
  try {
    if (achievementForm.id) await updateAdminGamificationAchievement(achievementForm.id, payload)
    else await createAdminGamificationAchievement(payload)
    achievementDialogVisible.value = false
    await loadAchievements()
    ElMessage.success('成就规则已保存')
  } finally {
    submitting.value = false
  }
}

function ruleSummary(row: AdminGamificationAchievement) {
  return row.rule_groups
    .map(group => group.conditions.map(condition => `${metrics.find(item => item.value === condition.metric)?.label || condition.metric}≥${condition.threshold}`).join(group.operator === 'ANY' ? ' 或 ' : ' 且 '))
    .join(row.root_operator === 'ANY' ? ' 或 ' : ' 且 ')
}

async function removeAchievement(row: AdminGamificationAchievement) {
  try {
    await ElMessageBox.confirm(`确认删除成就“${row.name}”？已解锁记录会随成就一起移除。`, '删除成就', { type: 'warning' })
    await deleteAdminGamificationAchievement(row.id)
    await loadAchievements()
    ElMessage.success('成就已删除')
  } catch (error) {
    if (!isDialogCancel(error)) ElMessage.error(adminErrorMessage(error, '删除成就失败'))
  }
}

function openRewardDialog(row?: AdminGamificationReward) {
  rewardAssetFile.value = null
  Object.assign(rewardForm, row || {
    id: undefined,
    code: '',
    name: '',
    description: '',
    reward_type: 'BADGE',
    rarity: 'common',
    preset_key: '',
    order: 0,
    is_active: true,
  })
  rewardDialogVisible.value = true
}

function handleRewardAssetChange(event: Event) {
  rewardAssetFile.value = (event.target as HTMLInputElement).files?.[0] || null
}

function buildRewardFormData() {
  const formData = new FormData()
  for (const key of ['code', 'name', 'description', 'reward_type', 'rarity', 'preset_key', 'order', 'is_active'] as const) {
    formData.append(key, String(rewardForm[key] ?? ''))
  }
  if (rewardAssetFile.value) formData.append('asset', rewardAssetFile.value)
  return formData
}

async function saveReward() {
  if (!rewardForm.code || !rewardForm.name) return ElMessage.warning('请填写奖励编码和名称')
  submitting.value = true
  try {
    if (rewardForm.id) await updateAdminGamificationReward(rewardForm.id, buildRewardFormData())
    else await createAdminGamificationReward(buildRewardFormData())
    rewardDialogVisible.value = false
    await loadRewards()
    ElMessage.success('奖励已保存')
  } finally {
    submitting.value = false
  }
}

function triggerAssetUpload(rewardId: number) {
  assetTargetId.value = rewardId
  assetInput.value?.click()
}

async function uploadAsset(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const rewardId = assetTargetId.value
  if (!file || !rewardId) return
  const formData = new FormData()
  formData.append('name', file.name)
  formData.append('image', file)
  await uploadAdminGamificationRewardAsset(rewardId, formData)
  input.value = ''
  assetTargetId.value = null
  await loadRewards()
  ElMessage.success('素材已上传')
}

async function removeReward(row: AdminGamificationReward) {
  try {
    await ElMessageBox.confirm(`确认删除奖励“${row.name}”？若已有发放或成就关联，系统将阻止删除。`, '删除奖励', { type: 'warning' })
    await deleteAdminGamificationReward(row.id)
    await loadRewards()
    ElMessage.success('奖励已删除')
  } catch (error) {
    if (!isDialogCancel(error)) ElMessage.error(adminErrorMessage(error, '删除奖励失败'))
  }
}

function isDialogCancel(error: unknown) {
  return error === 'cancel' || error === 'close'
}

function adminErrorMessage(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return typeof detail === 'string' && detail.trim() ? detail : fallback
}

function rewardTypeLabel(type: GamificationRewardType) {
  return rewardTypes.find(item => item.value === type)?.label || type
}

onMounted(refreshAll)
</script>

<style scoped>
.gamification-admin { display: grid; gap: 16px; }
.gamification-tabs :deep(.el-tabs__content) { overflow: visible; }
.toolbar { display: flex; gap: 10px; margin-bottom: 14px; }
.toolbar .el-input { max-width: 360px; }
.section-title-row { display: flex; align-items: center; justify-content: space-between; margin: 28px 0 12px; }
.section-title-row h3 { margin: 0; }
.soft-button { color: var(--primary-gold-dark); }
.reward-thumb { display: grid; width: 48px; height: 48px; place-items: center; overflow: hidden; border-radius: 12px; color: #fff; background: linear-gradient(135deg, var(--accent-purple), var(--primary-gold)); }
.reward-thumb img { width: 100%; height: 100%; object-fit: contain; }
.metric-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.metric-chips span { padding: 4px 7px; border-radius: 999px; background: var(--bg-gray); font-size: 11px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
.form-grid--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.form-grid .el-select, .form-grid .el-date-editor { width: 100%; }
.switch-row { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; }
.rule-heading { display: flex; align-items: center; justify-content: space-between; margin: 8px 0; }
.rule-group { margin-bottom: 12px; padding: 14px; border: 1px solid var(--border-color); border-radius: 14px; background: var(--bg-gray); }
.rule-group > header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; font-weight: 700; }
.rule-group > header .el-button { margin-left: auto; }
.rule-condition { display: grid; grid-template-columns: 180px 130px minmax(0, 1fr) auto; gap: 8px; margin-bottom: 8px; }
@media (max-width: 768px) {
  .toolbar { flex-direction: column; }
  .toolbar .el-input { max-width: none; }
  .form-grid, .form-grid--three { grid-template-columns: 1fr; }
  .rule-condition { grid-template-columns: 1fr; padding-bottom: 10px; border-bottom: 1px dashed var(--border-color); }
}
</style>
