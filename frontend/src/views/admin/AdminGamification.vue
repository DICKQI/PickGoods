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
          <el-input v-model="setSearch" clearable placeholder="搜索系列" @keyup.enter="searchSets">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="setActiveFilter" clearable placeholder="启用状态" @change="loadSets">
            <el-option label="启用" :value="true" />
            <el-option label="停用" :value="false" />
          </el-select>
          <el-select v-model="setLimitedFilter" clearable placeholder="活动类型" @change="loadSets">
            <el-option label="限时" :value="true" />
            <el-option label="永久" :value="false" />
          </el-select>
          <el-dropdown v-if="selectedSets.length" trigger="click" @command="bulkSets">
            <el-button plain>批量操作（{{ selectedSets.length }}）</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="enable">启用</el-dropdown-item>
                <el-dropdown-item command="disable">停用</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button type="primary" @click="openSetDialog()"><el-icon><Plus /></el-icon>新增系列</el-button>
        </div>
        <el-table v-loading="loading" :data="sets" row-key="id" @selection-change="selectedSets = $event">
          <el-table-column type="selection" width="46" />
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
          <el-table-column
            label="操作"
            width="190"
            fixed="right"
            class-name="gamification-actions"
          >
            <template #default="{ row }">
              <el-button link type="primary" @click="openAchievementDialog(undefined, row.id)">添加成就</el-button>
              <el-button link type="primary" @click="openSetDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeSet(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-row">
          <el-pagination
            v-model:current-page="setsPage"
            v-model:page-size="setsPageSize"
            :page-sizes="[20, 50, 100]"
            :total="setsTotal"
            layout="total, sizes, prev, pager, next"
            @size-change="loadSets"
            @current-change="loadSets"
          />
        </div>
        <div class="section-title-row">
          <div class="section-title-row__heading">
            <h3>成就规则</h3>
            <span>共 {{ achievementsTotal }} 条规则</span>
          </div>
        </div>
        <div class="toolbar achievement-toolbar">
          <el-select v-model="achievementSetFilter" clearable placeholder="筛选系列" @change="loadAchievements">
            <el-option v-for="item in sets" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
          <el-select v-model="achievementActiveFilter" clearable placeholder="状态" @change="loadAchievements">
            <el-option label="启用" :value="true" />
            <el-option label="停用" :value="false" />
          </el-select>
          <el-dropdown v-if="selectedAchievements.length" trigger="click" @command="bulkAchievements">
            <el-button plain>批量操作（{{ selectedAchievements.length }}）</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="enable">启用</el-dropdown-item>
                <el-dropdown-item command="disable">停用</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button type="primary" @click="openAchievementDialog()">
            <el-icon><Plus /></el-icon>新增成就
          </el-button>
        </div>
        <el-table v-loading="loading" :data="achievements" row-key="id" @selection-change="selectedAchievements = $event">
          <el-table-column type="selection" width="46" />
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
          <el-table-column
            label="操作"
            width="130"
            fixed="right"
            class-name="gamification-actions"
          >
            <template #default="{ row }">
              <el-button link type="primary" @click="openAchievementDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeAchievement(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-row">
          <el-pagination
            v-model:current-page="achievementsPage"
            v-model:page-size="achievementsPageSize"
            :page-sizes="[20, 50, 100]"
            :total="achievementsTotal"
            layout="total, sizes, prev, pager, next"
            @size-change="loadAchievements"
            @current-change="loadAchievements"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="奖励与素材" name="rewards">
        <div class="toolbar">
          <el-input v-model="rewardSearch" clearable placeholder="搜索奖励" @keyup.enter="searchRewards">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="rewardTypeFilter" clearable placeholder="奖励类型" @change="loadRewards">
            <el-option v-for="item in rewardTypes" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-select v-model="rewardActiveFilter" clearable placeholder="状态" @change="loadRewards">
            <el-option label="启用" :value="true" />
            <el-option label="停用" :value="false" />
          </el-select>
          <el-dropdown v-if="selectedRewards.length" trigger="click" @command="bulkRewards">
            <el-button plain>批量操作（{{ selectedRewards.length }}）</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="enable">启用</el-dropdown-item>
                <el-dropdown-item command="disable">停用</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button type="primary" @click="openRewardDialog()"><el-icon><Plus /></el-icon>新增奖励</el-button>
        </div>
        <el-table v-loading="loading" :data="rewards" row-key="id" @selection-change="selectedRewards = $event">
          <el-table-column type="selection" width="46" />
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
          <el-table-column
            label="操作"
            width="200"
            fixed="right"
            class-name="gamification-actions"
          >
            <template #default="{ row }">
              <el-button link type="primary" @click="openRewardDialog(row)">编辑</el-button>
              <el-button link type="success" @click="triggerAssetUpload(row.id)">上传素材</el-button>
              <el-button link type="danger" @click="removeReward(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-row">
          <el-pagination
            v-model:current-page="rewardsPage"
            v-model:page-size="rewardsPageSize"
            :page-sizes="[20, 50, 100]"
            :total="rewardsTotal"
            layout="total, sizes, prev, pager, next"
            @size-change="loadRewards"
            @current-change="loadRewards"
          />
        </div>
        <input ref="assetInput" class="sr-only-input" type="file" accept="image/*" @change="uploadAsset" />
      </el-tab-pane>

      <el-tab-pane label="用户进度" name="users">
        <div class="toolbar">
          <el-input v-model="userSearch" clearable placeholder="搜索用户名" @keyup.enter="searchUsers">
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
        <div class="pagination-row">
          <el-pagination
            v-model:current-page="usersPage"
            v-model:page-size="usersPageSize"
            :page-sizes="[20, 50, 100]"
            :total="usersTotal"
            layout="total, sizes, prev, pager, next"
            @size-change="loadUsers"
            @current-change="loadUsers"
          />
        </div>
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
            <div class="rule-condition__filters">
              <el-select
                v-model="condition.filters.ip_ids"
                multiple
                filterable
                remote
                collapse-tags
                placeholder="限定 IP"
                :remote-method="searchRuleIPs"
              >
                <el-option v-for="ip in ruleIPOptions" :key="ip.id" :label="ip.name" :value="ip.id" />
              </el-select>
              <el-select
                v-model="condition.filters.character_ids"
                multiple
                filterable
                remote
                collapse-tags
                placeholder="限定角色"
                :remote-method="searchRuleCharacters"
              >
                <el-option v-for="item in ruleCharacterOptions" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
              <el-select
                v-model="condition.filters.category_ids"
                multiple
                filterable
                collapse-tags
                placeholder="限定品类"
              >
                <el-option
                  v-for="item in ruleCategoryOptions"
                  :key="item.id"
                  :label="item.path_name || item.name"
                  :value="item.id"
                />
              </el-select>
              <el-select v-model="condition.filters.is_official" multiple placeholder="官谷属性">
                <el-option label="官谷" :value="true" />
                <el-option label="非官谷" :value="false" />
              </el-select>
            </div>
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
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Medal, Plus, Refresh, Search } from '@element-plus/icons-vue'
import AdminPageHeader from './components/AdminPageHeader.vue'
import { formatDateTime } from '@/utils/datetime'
import { createLatestRequestGuard } from '@/composables/useLatestRequest'
import {
  createAdminGamificationAchievement,
  createAdminGamificationReward,
  createAdminGamificationSet,
  bulkAdminGamificationAchievements,
  bulkAdminGamificationRewards,
  bulkAdminGamificationSets,
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
import {
  getAdminCategories,
  getAdminCharacters,
  getAdminIPs,
  type AdminCharacterListParams,
  type AdminIPListParams,
} from '@/api/admin'
import type {
  AdminGamificationAchievement,
  AdminGamificationReward,
  AdminGamificationRuleGroup,
  AdminGamificationSet,
  AdminGamificationUser,
  AdminCharacterListItem,
  AdminIPListItem,
  Category,
  GamificationMetric,
  GamificationOperator,
  GamificationRewardType,
} from '@/api/types'

interface EditableRuleFilters {
  ip_ids: number[]
  character_ids: number[]
  category_ids: number[]
  is_official: boolean[]
}
type EditableCondition = Omit<AdminGamificationRuleGroup['conditions'][number], 'filters'> & {
  filters: EditableRuleFilters
}
type EditableGroup = Omit<AdminGamificationRuleGroup, 'conditions'> & { conditions: EditableCondition[] }

const route = useRoute()
const activeTab = ref(
  ['sets', 'achievements', 'rewards', 'users'].includes(String(route.query.tab))
    ? String(route.query.tab)
    : 'sets',
)
const loading = ref(false)
const submitting = ref(false)
const setSearch = ref('')
const rewardSearch = ref('')
const userSearch = ref('')
const sets = ref<AdminGamificationSet[]>([])
const achievements = ref<AdminGamificationAchievement[]>([])
const rewards = ref<AdminGamificationReward[]>([])
const users = ref<AdminGamificationUser[]>([])
const selectedSets = ref<AdminGamificationSet[]>([])
const selectedAchievements = ref<AdminGamificationAchievement[]>([])
const selectedRewards = ref<AdminGamificationReward[]>([])
const setListRequests = createLatestRequestGuard()
const achievementListRequests = createLatestRequestGuard()
const rewardListRequests = createLatestRequestGuard()
const userListRequests = createLatestRequestGuard()
const setsPage = ref(1)
const achievementsPage = ref(1)
const rewardsPage = ref(1)
const usersPage = ref(1)
const setsPageSize = ref(20)
const achievementsPageSize = ref(20)
const rewardsPageSize = ref(20)
const usersPageSize = ref(20)
const setsTotal = ref(0)
const achievementsTotal = ref(0)
const rewardsTotal = ref(0)
const usersTotal = ref(0)
const setActiveFilter = ref<boolean | undefined>()
const setLimitedFilter = ref<boolean | undefined>()
const achievementSetFilter = ref<number | undefined>()
const achievementActiveFilter = ref<boolean | undefined>()
const rewardTypeFilter = ref<GamificationRewardType | undefined>()
const rewardActiveFilter = ref<boolean | undefined>()
const ruleIPOptions = ref<AdminIPListItem[]>([])
const ruleCharacterOptions = ref<AdminCharacterListItem[]>([])
const ruleCategoryOptions = ref<Category[]>([])

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
  const requestSequence = setListRequests.next()
  const response = await getAdminGamificationSets({
    page: setsPage.value,
    page_size: setsPageSize.value,
    search: setSearch.value || undefined,
    is_active: setActiveFilter.value,
    is_limited: setLimitedFilter.value,
  })
  if (!setListRequests.isLatest(requestSequence)) return
  sets.value = response.results
  setsTotal.value = response.count
}

async function loadAchievements() {
  const requestSequence = achievementListRequests.next()
  const response = await getAdminGamificationAchievements({
    page: achievementsPage.value,
    page_size: achievementsPageSize.value,
    set: achievementSetFilter.value,
    is_active: achievementActiveFilter.value,
  })
  if (!achievementListRequests.isLatest(requestSequence)) return
  achievements.value = response.results
  achievementsTotal.value = response.count
}

async function loadRewards() {
  const requestSequence = rewardListRequests.next()
  const response = await getAdminGamificationRewards({
    page: rewardsPage.value,
    page_size: rewardsPageSize.value,
    search: rewardSearch.value || undefined,
    reward_type: rewardTypeFilter.value,
    is_active: rewardActiveFilter.value,
  })
  if (!rewardListRequests.isLatest(requestSequence)) return
  rewards.value = response.results
  rewardsTotal.value = response.count
}

async function loadUsers() {
  const requestSequence = userListRequests.next()
  const response = await getAdminGamificationUsers({
    page: usersPage.value,
    page_size: usersPageSize.value,
    search: userSearch.value || undefined,
  })
  if (!userListRequests.isLatest(requestSequence)) return
  users.value = response.results
  usersTotal.value = response.count
}

async function loadRuleOptions() {
  const [ips, characters, categories] = await Promise.all([
    getAdminIPs({ page_size: 100 }),
    getAdminCharacters({ page_size: 100 } as AdminCharacterListParams),
    getAdminCategories({ ordering: 'order,id' }),
  ])
  ruleIPOptions.value = ips.results
  ruleCharacterOptions.value = characters.results
  ruleCategoryOptions.value = categories
}

async function searchRuleIPs(query: string) {
  const params: AdminIPListParams = {
    search: query || undefined,
    page_size: 100,
  }
  ruleIPOptions.value = (await getAdminIPs(params)).results
}

async function searchRuleCharacters(query: string) {
  const params: AdminCharacterListParams = {
    search: query || undefined,
    page_size: 100,
  }
  ruleCharacterOptions.value = (await getAdminCharacters(params)).results
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([
      loadSets(),
      loadAchievements(),
      loadRewards(),
      loadUsers(),
      loadRuleOptions(),
    ])
  } finally {
    loading.value = false
  }
}

function searchSets() {
  setsPage.value = 1
  void loadSets()
}

function searchRewards() {
  rewardsPage.value = 1
  void loadRewards()
}

function searchUsers() {
  usersPage.value = 1
  void loadUsers()
}

async function bulkSets(action: 'enable' | 'disable') {
  await ElMessageBox.confirm(
    `确认批量${action === 'enable' ? '启用' : '停用'} ${selectedSets.value.length} 个系列吗？`,
    '批量操作',
    { type: 'warning' },
  )
  await bulkAdminGamificationSets(selectedSets.value.map((item) => item.id), action)
  selectedSets.value = []
  await loadSets()
}

async function bulkAchievements(action: 'enable' | 'disable') {
  await ElMessageBox.confirm(
    `确认批量${action === 'enable' ? '启用' : '停用'} ${selectedAchievements.value.length} 个成就吗？`,
    '批量操作',
    { type: 'warning' },
  )
  await bulkAdminGamificationAchievements(
    selectedAchievements.value.map((item) => item.id),
    action,
  )
  selectedAchievements.value = []
  await loadAchievements()
}

async function bulkRewards(action: 'enable' | 'disable') {
  await ElMessageBox.confirm(
    `确认批量${action === 'enable' ? '启用' : '停用'} ${selectedRewards.value.length} 个奖励吗？`,
    '批量操作',
    { type: 'warning' },
  )
  await bulkAdminGamificationRewards(
    selectedRewards.value.map((item) => item.id),
    action,
  )
  selectedRewards.value = []
  await loadRewards()
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
  return {
    metric: 'GOODS_QUANTITY',
    threshold: 1,
    filters: {
      ip_ids: [],
      character_ids: [],
      category_ids: [],
      is_official: [],
    },
    order: 0,
  }
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
          filters: {
            ip_ids: [],
            character_ids: [],
            category_ids: [],
            is_official: [],
            ...(condition.filters || {}),
          },
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
  const ruleGroups = achievementForm.rule_groups.map(group => ({
    operator: group.operator,
    order: group.order,
    conditions: group.conditions.map((condition, index) => ({
      metric: condition.metric,
      threshold: condition.threshold,
      filters: Object.fromEntries(
        Object.entries(condition.filters).filter(
          ([, value]) => Array.isArray(value) && value.length > 0,
        ),
      ),
      order: index,
    })),
  }))
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

watch(
  () => route.query.tab,
  (tab) => {
    const nextTab = ['sets', 'achievements', 'rewards', 'users'].includes(String(tab))
      ? String(tab)
      : 'sets'
    if (activeTab.value === nextTab) return
    activeTab.value = nextTab
    if (nextTab === 'sets') void loadSets()
    if (nextTab === 'achievements') void loadAchievements()
    if (nextTab === 'rewards') void loadRewards()
    if (nextTab === 'users') void loadUsers()
  },
)
</script>

<style scoped>
.gamification-admin { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.gamification-tabs,
.gamification-tabs :deep(.el-tabs__content),
.gamification-tabs :deep(.el-tab-pane) { min-width: 0; }
.gamification-tabs :deep(.el-tabs__content) { overflow: hidden; }
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.toolbar .el-input { max-width: 360px; }
.toolbar .el-select { width: 150px; }
.section-title-row { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 16px; margin: 28px 0 12px; }
.section-title-row__heading { display: flex; min-width: 0; align-items: baseline; gap: 9px; }
.section-title-row h3 { flex: 0 0 auto; margin: 0; white-space: nowrap; }
.section-title-row__heading span { color: #9099a6; font-size: 12px; white-space: nowrap; }
.achievement-toolbar { margin-bottom: 12px; }
.achievement-toolbar .el-select { width: 190px; }
.achievement-toolbar > .el-button { flex: none; margin-left: auto; }
.pagination-row { display: flex; justify-content: flex-end; padding: 12px 0 4px; }
.reward-thumb { display: grid; width: 48px; height: 48px; place-items: center; overflow: hidden; border-radius: 12px; color: #fff; background: linear-gradient(135deg, var(--accent-purple), var(--primary-gold)); }
.reward-thumb img { width: 100%; height: 100%; object-fit: contain; }
.gamification-admin :deep(.gamification-actions .cell) { white-space: nowrap; }
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
.rule-condition { display: grid; grid-template-columns: 180px 130px minmax(0, 1fr) auto; gap: 8px; margin-bottom: 10px; }
.rule-condition__filters { display: grid; grid-template-columns: repeat(2, minmax(150px, 1fr)); gap: 8px; }
@media (max-width: 768px) {
  .toolbar { flex-direction: column; }
  .toolbar .el-input, .toolbar .el-select { width: 100%; max-width: none; }
  .section-title-row { align-items: stretch; flex-direction: column; gap: 10px; }
  .achievement-toolbar .el-select { width: 100%; }
  .achievement-toolbar > .el-button { width: 100%; margin-left: 0; }
  .form-grid, .form-grid--three { grid-template-columns: 1fr; }
  .rule-condition { grid-template-columns: 1fr; padding-bottom: 10px; border-bottom: 1px dashed var(--border-color); }
  .rule-condition__filters { grid-template-columns: 1fr; }
}
</style>
