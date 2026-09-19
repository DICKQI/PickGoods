<template>
  <section class="club-gamification" aria-labelledby="club-gamification-title">
    <header class="gamification-header">
      <div>
        <p>CLUB REWARD STUDIO</p>
        <h2 id="club-gamification-title">成就与奖励</h2>
        <span>用户导入你的社团商品后，会自动推进这里发布的成就。</span>
      </div>
      <el-button :loading="loading" @click="refreshAll">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </header>

    <el-tabs v-model="activeTab" class="gamification-tabs">
      <el-tab-pane label="成就系列" name="sets">
        <div class="toolbar">
          <el-input v-model="setSearch" clearable placeholder="搜索系列" @keyup.enter="loadSets">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" @click="openSetDialog()">
            <el-icon><Plus /></el-icon>
            新增系列
          </el-button>
        </div>
        <el-table v-loading="loading" :data="sets" row-key="id">
          <el-table-column prop="name" label="系列" min-width="150" />
          <el-table-column label="活动类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.is_limited ? 'danger' : 'warning'" effect="plain">
                {{ row.is_limited ? '限时' : '长期' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="achievement_count" label="成就数" width="90" align="center" />
          <el-table-column prop="unlocked_count" label="已解锁" width="90" align="center" />
          <el-table-column prop="claimed_count" label="已领取" width="90" align="center" />
          <el-table-column label="时间窗" min-width="210">
            <template #default="{ row }">{{ formatWindow(row) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'" effect="plain">
                {{ row.is_active ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="190" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openAchievementDialog(undefined, row.id)">
                添加成就
              </el-button>
              <el-button link type="primary" @click="openSetDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeSet(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-row">
          <el-pagination
            v-model:current-page="setsPage"
            v-model:page-size="setsPageSize"
            :total="setsTotal"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="loadSets"
            @size-change="handleSetSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="成就规则" name="achievements">
        <div class="toolbar">
          <el-input
            v-model="achievementSearch"
            clearable
            placeholder="搜索成就"
            @keyup.enter="loadAchievements"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" @click="openAchievementDialog()">
            <el-icon><Plus /></el-icon>
            新增成就
          </el-button>
        </div>
        <el-table v-loading="loading" :data="achievements" row-key="id">
          <el-table-column prop="name" label="成就" min-width="160" />
          <el-table-column prop="set_name" label="系列" min-width="130" />
          <el-table-column label="规则" min-width="250">
            <template #default="{ row }">{{ ruleSummary(row) }}</template>
          </el-table-column>
          <el-table-column prop="user_count" label="参与用户" width="100" align="center" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'" effect="plain">
                {{ row.is_active ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
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
            :total="achievementsTotal"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="loadAchievements"
            @size-change="handleAchievementSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="奖励与素材" name="rewards">
        <div class="toolbar">
          <el-input v-model="rewardSearch" clearable placeholder="搜索奖励" @keyup.enter="loadRewards">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" @click="openRewardDialog()">
            <el-icon><Plus /></el-icon>
            新增奖励
          </el-button>
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
          <el-table-column label="类型" min-width="130">
            <template #default="{ row }">{{ rewardTypeLabel(row.reward_type) }}</template>
          </el-table-column>
          <el-table-column prop="preset_key" label="平台预设" min-width="130" />
          <el-table-column prop="achievement_count" label="关联成就" width="90" align="center" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'info'" effect="plain">
                {{ row.is_active ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openRewardDialog(row)">编辑</el-button>
              <el-button
                v-if="row.reward_type === 'JOURNAL_STICKER_PACK'"
                link
                type="primary"
                @click="triggerAssetUpload(row.id)"
              >
                上传素材
              </el-button>
              <el-button link type="danger" @click="removeReward(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-row">
          <el-pagination
            v-model:current-page="rewardsPage"
            v-model:page-size="rewardsPageSize"
            :total="rewardsTotal"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="loadRewards"
            @size-change="handleRewardSizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <input
      ref="assetInput"
      class="hidden-input"
      type="file"
      accept="image/*"
      @change="uploadAsset"
    />

    <el-dialog v-model="setDialogVisible" :title="setForm.id ? '编辑系列' : '新增系列'" width="min(92vw, 640px)">
      <el-form :model="setForm" label-position="top">
        <div class="form-grid">
          <el-form-item label="名称">
            <el-input v-model="setForm.name" maxlength="100" />
          </el-form-item>
          <el-form-item label="标签">
            <el-input v-model="setForm.badge_label" maxlength="30" placeholder="例如：社团限定" />
          </el-form-item>
        </div>
        <el-form-item label="说明">
          <el-input v-model="setForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <div class="switch-row">
          <el-checkbox v-model="setForm.is_limited">限时活动</el-checkbox>
          <el-checkbox v-model="setForm.is_active">启用系列</el-checkbox>
        </div>
        <div v-if="setForm.is_limited" class="form-grid">
          <el-form-item label="开始时间">
            <el-date-picker
              v-model="setForm.starts_at"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ssZ"
            />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-date-picker
              v-model="setForm.ends_at"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ssZ"
            />
          </el-form-item>
        </div>
        <el-form-item label="排序">
          <el-input-number v-model="setForm.order" :step="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="setDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveSet">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="achievementDialogVisible"
      :title="achievementForm.id ? '编辑成就' : '新增成就'"
      width="min(96vw, 980px)"
    >
      <el-form :model="achievementForm" label-position="top">
        <div class="form-grid">
          <el-form-item label="名称">
            <el-input v-model="achievementForm.name" maxlength="100" />
          </el-form-item>
          <el-form-item label="所属系列">
            <el-select v-model="achievementForm.set" style="width: 100%">
              <el-option v-for="item in sets" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="说明">
          <el-input v-model="achievementForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="根规则">
            <el-radio-group v-model="achievementForm.root_operator">
              <el-radio-button value="ALL">全部满足</el-radio-button>
              <el-radio-button value="ANY">任一满足</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="关联奖励">
            <el-select v-model="achievementForm.rewards" multiple collapse-tags style="width: 100%">
              <el-option
                v-for="reward in rewards"
                :key="reward.id"
                :label="reward.name"
                :value="reward.id"
              />
            </el-select>
          </el-form-item>
        </div>
        <div class="switch-row">
          <el-checkbox v-model="achievementForm.is_active">启用成就</el-checkbox>
          <el-input-number v-model="achievementForm.order" :step="10" />
        </div>

        <div class="rule-heading">
          <strong>规则组与条件</strong>
          <el-button text type="primary" @click="addRuleGroup">添加规则组</el-button>
        </div>
        <section
          v-for="(group, groupIndex) in achievementForm.rule_groups"
          :key="groupIndex"
          class="rule-group"
        >
          <header>
            <span>规则组 {{ groupIndex + 1 }}</span>
            <el-radio-group v-model="group.operator" size="small">
              <el-radio-button value="ALL">全部</el-radio-button>
              <el-radio-button value="ANY">任一</el-radio-button>
            </el-radio-group>
            <el-button link type="danger" @click="achievementForm.rule_groups.splice(groupIndex, 1)">
              删除组
            </el-button>
          </header>
          <article
            v-for="(condition, conditionIndex) in group.conditions"
            :key="conditionIndex"
            class="rule-condition"
          >
            <div class="rule-condition__main">
              <el-select v-model="condition.metric">
                <el-option
                  v-for="metric in metrics"
                  :key="metric.value"
                  :label="metric.label"
                  :value="metric.value"
                />
              </el-select>
              <el-input-number v-model="condition.threshold" :min="0.01" :precision="2" />
              <el-button
                link
                type="danger"
                @click="group.conditions.splice(conditionIndex, 1)"
              >
                删除条件
              </el-button>
            </div>
            <div class="rule-condition__filters">
              <el-select
                v-model="condition.filters.catalog_item_ids"
                multiple
                filterable
                collapse-tags
                placeholder="指定目录商品"
              >
                <el-option
                  v-for="item in catalogItems"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
              <el-select
                v-model="condition.filters.theme_ids"
                multiple
                filterable
                collapse-tags
                placeholder="社团主题"
              >
                <el-option
                  v-for="item in themes"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
              <el-select
                v-model="condition.filters.ip_ids"
                multiple
                filterable
                collapse-tags
                placeholder="IP"
              >
                <el-option
                  v-for="item in ips"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
              <el-select
                v-model="condition.filters.character_ids"
                multiple
                filterable
                collapse-tags
                placeholder="角色"
              >
                <el-option
                  v-for="item in characters"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
              <el-select
                v-model="condition.filters.category_ids"
                multiple
                filterable
                collapse-tags
                placeholder="品类"
              >
                <el-option
                  v-for="item in categories"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </div>
          </article>
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

    <el-dialog
      v-model="rewardDialogVisible"
      :title="rewardForm.id ? '编辑奖励' : '新增奖励'"
      width="min(92vw, 680px)"
    >
      <el-form :model="rewardForm" label-position="top">
        <div class="form-grid">
          <el-form-item label="名称">
            <el-input v-model="rewardForm.name" maxlength="100" />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="rewardForm.reward_type" style="width: 100%">
              <el-option
                v-for="item in rewardTypes"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="说明">
          <el-input v-model="rewardForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="平台预设">
            <el-select
              v-if="currentPresetOptions.length"
              v-model="rewardForm.preset_key"
              clearable
              style="width: 100%"
              placeholder="选择平台预设"
            >
              <el-option
                v-for="option in currentPresetOptions"
                :key="option"
                :label="option"
                :value="option"
              />
            </el-select>
            <el-input
              v-else
              v-model="rewardForm.preset_key"
              disabled
              placeholder="该类型使用社团上传素材"
            />
          </el-form-item>
          <el-form-item label="稀有度">
            <el-select v-model="rewardForm.rarity" style="width: 100%">
              <el-option label="普通" value="common" />
              <el-option label="稀有" value="rare" />
              <el-option label="史诗" value="epic" />
              <el-option label="限定" value="legendary" />
            </el-select>
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="排序">
            <el-input-number v-model="rewardForm.order" :step="10" />
          </el-form-item>
          <el-form-item
            v-if="rewardForm.reward_type === 'BADGE'"
            label="徽章主素材"
          >
            <input type="file" accept="image/*" @change="handleRewardAssetChange" />
          </el-form-item>
        </div>
        <el-checkbox v-model="rewardForm.is_active">启用奖励</el-checkbox>
      </el-form>
      <template #footer>
        <el-button @click="rewardDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveReward">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Medal, Plus, Refresh, Search } from '@element-plus/icons-vue'
import {
  createClubGamificationAchievement,
  createClubGamificationReward,
  createClubGamificationSet,
  deleteClubGamificationAchievement,
  deleteClubGamificationReward,
  deleteClubGamificationSet,
  getClubGamificationAchievements,
  getClubGamificationRewards,
  getClubGamificationSets,
  updateClubGamificationAchievement,
  updateClubGamificationReward,
  updateClubGamificationSet,
  uploadClubGamificationRewardAsset,
} from '@/api/clubGamification'
import { getMyClubGoods } from '@/api/clubs'
import {
  getCategoryList,
  getCharacterList,
  getIPList,
  getThemeList,
} from '@/api/metadata'
import { formatDateTime } from '@/utils/datetime'
import type {
  AdminGamificationAchievement,
  AdminGamificationAchievementInput,
  AdminGamificationReward,
  AdminGamificationRuleGroup,
  AdminGamificationSet,
  Category,
  Character,
  ClubCatalogItem,
  GamificationMetric,
  GamificationOperator,
  GamificationRewardType,
  IP,
  Theme,
} from '@/api/types'

interface EditableFilters {
  catalog_item_ids: string[]
  theme_ids: number[]
  ip_ids: number[]
  character_ids: number[]
  category_ids: number[]
}

type EditableCondition = Omit<AdminGamificationRuleGroup['conditions'][number], 'filters'> & {
  filters: EditableFilters
}
type EditableGroup = Omit<AdminGamificationRuleGroup, 'conditions'> & {
  conditions: EditableCondition[]
}

const activeTab = ref('sets')
const loading = ref(false)
const submitting = ref(false)
const setSearch = ref('')
const achievementSearch = ref('')
const rewardSearch = ref('')
const sets = ref<AdminGamificationSet[]>([])
const achievements = ref<AdminGamificationAchievement[]>([])
const rewards = ref<AdminGamificationReward[]>([])
const setsTotal = ref(0)
const achievementsTotal = ref(0)
const rewardsTotal = ref(0)
const setsPage = ref(1)
const achievementsPage = ref(1)
const rewardsPage = ref(1)
const setsPageSize = ref(20)
const achievementsPageSize = ref(20)
const rewardsPageSize = ref(20)

const catalogItems = ref<ClubCatalogItem[]>([])
const themes = ref<Theme[]>([])
const ips = ref<IP[]>([])
const characters = ref<Character[]>([])
const categories = ref<Category[]>([])
const assetInput = ref<HTMLInputElement | null>(null)
const assetTargetId = ref<number | null>(null)
const rewardAssetFile = ref<File | null>(null)

const setDialogVisible = ref(false)
const achievementDialogVisible = ref(false)
const rewardDialogVisible = ref(false)

const setForm = reactive<{
  id?: number
  name: string
  description: string
  badge_label: string
  starts_at: string | null
  ends_at: string | null
  is_limited: boolean
  is_active: boolean
  order: number
}>({
  name: '',
  description: '',
  badge_label: '',
  starts_at: null,
  ends_at: null,
  is_limited: false,
  is_active: true,
  order: 0,
})

const emptyFilters = (): EditableFilters => ({
  catalog_item_ids: [],
  theme_ids: [],
  ip_ids: [],
  character_ids: [],
  category_ids: [],
})

const emptyCondition = (): EditableCondition => ({
  metric: 'CLUB_GOODS_QUANTITY',
  threshold: 1,
  filters: emptyFilters(),
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
  name: string
  description: string
  reward_type: GamificationRewardType
  rarity: AdminGamificationReward['rarity']
  preset_key: string
  order: number
  is_active: boolean
}>({
  name: '',
  description: '',
  reward_type: 'BADGE',
  rarity: 'common',
  preset_key: '',
  order: 0,
  is_active: true,
})

const metrics: Array<{ label: string; value: GamificationMetric }> = [
  { label: '导入自家商品件数', value: 'CLUB_GOODS_QUANTITY' },
  { label: '导入自家商品公开价', value: 'CLUB_SPEND_AMOUNT' },
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
const currentPresetOptions = computed(
  () => presetOptionsByType[rewardForm.reward_type] || [],
)

const achievementRulePreview = computed(() =>
  achievementForm.rule_groups
    .map(group => {
      const conditions = group.conditions.map(
        condition =>
          `${metrics.find(item => item.value === condition.metric)?.label || condition.metric} ≥ ${condition.threshold}`,
      )
      return conditions.length > 1
        ? `(${conditions.join(group.operator === 'ANY' ? ' 或 ' : ' 且 ')})`
        : conditions[0] || '空条件组'
    })
    .join(achievementForm.root_operator === 'ANY' ? ' 或 ' : ' 且 ') || '尚未配置条件',
)

watch(
  () => rewardForm.reward_type,
  () => {
    if (!currentPresetOptions.value.length) {
      rewardForm.preset_key = ''
      return
    }
    if (!currentPresetOptions.value.includes(rewardForm.preset_key)) {
      rewardForm.preset_key = currentPresetOptions.value[0] || ''
    }
  },
)

async function loadSets() {
  const response = await getClubGamificationSets({
    page: setsPage.value,
    page_size: setsPageSize.value,
    search: setSearch.value || undefined,
  })
  sets.value = response.results
  setsTotal.value = response.count
}

async function loadAchievements() {
  const response = await getClubGamificationAchievements({
    page: achievementsPage.value,
    page_size: achievementsPageSize.value,
    search: achievementSearch.value || undefined,
  })
  achievements.value = response.results
  achievementsTotal.value = response.count
}

async function loadRewards() {
  const response = await getClubGamificationRewards({
    page: rewardsPage.value,
    page_size: rewardsPageSize.value,
    search: rewardSearch.value || undefined,
  })
  rewards.value = response.results
  rewardsTotal.value = response.count
}

async function loadMetadata() {
  const [catalogResult, themeResult, ipResult, characterResult, categoryResult] =
    await Promise.all([
      getMyClubGoods({ page_size: 100 }),
      getThemeList(),
      getIPList(),
      getCharacterList(),
      getCategoryList(),
    ])
  catalogItems.value = catalogResult.results
  themes.value = themeResult
  ips.value = ipResult
  characters.value = characterResult
  categories.value = categoryResult
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([loadSets(), loadAchievements(), loadRewards(), loadMetadata()])
  } finally {
    loading.value = false
  }
}

function handleSetSizeChange() {
  setsPage.value = 1
  void loadSets()
}

function handleAchievementSizeChange() {
  achievementsPage.value = 1
  void loadAchievements()
}

function handleRewardSizeChange() {
  rewardsPage.value = 1
  void loadRewards()
}

function openSetDialog(row?: AdminGamificationSet) {
  Object.assign(setForm, row || {
    id: undefined,
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

function openAchievementDialog(
  row?: AdminGamificationAchievement,
  presetSetId?: number,
) {
  Object.assign(achievementForm, row
    ? {
      ...row,
      rule_groups: row.rule_groups.map(group => ({
        ...group,
        conditions: group.conditions.map(condition => ({
          ...condition,
          filters: {
            ...emptyFilters(),
            ...(condition.filters || {}),
          },
        })),
      })),
    }
    : {
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
  achievementDialogVisible.value = true
}

function openRewardDialog(row?: AdminGamificationReward) {
  rewardAssetFile.value = null
  Object.assign(rewardForm, row || {
    id: undefined,
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

function addRuleGroup() {
  achievementForm.rule_groups.push({
    operator: 'ALL',
    order: achievementForm.rule_groups.length,
    conditions: [emptyCondition()],
  })
}

function addCondition(group: EditableGroup) {
  group.conditions.push({
    ...emptyCondition(),
    order: group.conditions.length,
  })
}

function buildSetPayload() {
  return {
    name: setForm.name,
    description: setForm.description,
    badge_label: setForm.badge_label,
    starts_at: setForm.is_limited ? setForm.starts_at : null,
    ends_at: setForm.is_limited ? setForm.ends_at : null,
    is_limited: setForm.is_limited,
    is_active: setForm.is_active,
    order: setForm.order,
  }
}

async function saveSet() {
  if (!setForm.name.trim()) return ElMessage.warning('请填写系列名称')
  if (setForm.is_limited && (!setForm.starts_at || !setForm.ends_at)) {
    return ElMessage.warning('限时活动必须设置开始和结束时间')
  }
  submitting.value = true
  try {
    if (setForm.id) await updateClubGamificationSet(setForm.id, buildSetPayload())
    else await createClubGamificationSet(buildSetPayload())
    setDialogVisible.value = false
    await Promise.all([loadSets(), loadAchievements()])
    ElMessage.success('系列已保存')
  } finally {
    submitting.value = false
  }
}

function buildAchievementPayload(): AdminGamificationAchievementInput {
  return {
    code: achievementForm.code,
    set: achievementForm.set || 0,
    name: achievementForm.name,
    description: achievementForm.description,
    root_operator: achievementForm.root_operator,
    is_active: achievementForm.is_active,
    is_limited: achievementForm.is_limited,
    order: achievementForm.order,
    rewards: achievementForm.rewards,
    rule_groups: achievementForm.rule_groups.map((group, groupIndex) => ({
      id: group.id,
      operator: group.operator,
      order: groupIndex,
      conditions: group.conditions.map((condition, conditionIndex) => ({
        id: condition.id,
        metric: condition.metric,
        threshold: condition.threshold,
        order: conditionIndex,
        filters: Object.fromEntries(
          Object.entries(condition.filters).filter(
            ([, values]) => Array.isArray(values) && values.length > 0,
          ),
        ),
      })),
    })),
  }
}

async function saveAchievement() {
  if (!achievementForm.name.trim() || !achievementForm.set) {
    return ElMessage.warning('请填写成就名称并选择系列')
  }
  if (
    achievementForm.rule_groups.some(group => group.conditions.length === 0)
  ) {
    return ElMessage.warning('每个规则组至少需要一个条件')
  }
  submitting.value = true
  try {
    const payload = buildAchievementPayload()
    if (achievementForm.id) {
      await updateClubGamificationAchievement(achievementForm.id, payload)
    } else {
      await createClubGamificationAchievement(payload)
    }
    achievementDialogVisible.value = false
    await Promise.all([loadAchievements(), loadSets()])
    ElMessage.success('成就已保存')
  } finally {
    submitting.value = false
  }
}

function buildRewardFormData() {
  const formData = new FormData()
  for (const key of [
    'name',
    'description',
    'reward_type',
    'rarity',
    'preset_key',
    'order',
    'is_active',
  ] as const) {
    formData.append(key, String(rewardForm[key] ?? ''))
  }
  if (rewardAssetFile.value) formData.append('asset', rewardAssetFile.value)
  return formData
}

async function saveReward() {
  if (!rewardForm.name.trim()) return ElMessage.warning('请填写奖励名称')
  if (
    currentPresetOptions.value.length &&
    !currentPresetOptions.value.includes(rewardForm.preset_key)
  ) {
    return ElMessage.warning('请选择有效的平台预设')
  }
  submitting.value = true
  try {
    if (rewardForm.id) {
      await updateClubGamificationReward(rewardForm.id, buildRewardFormData())
    } else {
      await createClubGamificationReward(buildRewardFormData())
    }
    rewardDialogVisible.value = false
    await Promise.all([loadRewards(), loadAchievements()])
    ElMessage.success('奖励已保存')
  } finally {
    submitting.value = false
  }
}

function handleRewardAssetChange(event: Event) {
  rewardAssetFile.value = (event.target as HTMLInputElement).files?.[0] || null
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
  await uploadClubGamificationRewardAsset(rewardId, formData)
  input.value = ''
  assetTargetId.value = null
  await loadRewards()
  ElMessage.success('素材已上传')
}

async function removeSet(row: AdminGamificationSet) {
  try {
    await ElMessageBox.confirm(
      `确认删除系列“${row.name}”？已有用户进度时系统会阻止删除。`,
      '删除系列',
      { type: 'warning' },
    )
    await deleteClubGamificationSet(row.id)
    await refreshAll()
    ElMessage.success('系列已删除')
  } catch (error) {
    if (!isDialogCancel(error)) throw error
  }
}

async function removeAchievement(row: AdminGamificationAchievement) {
  try {
    await ElMessageBox.confirm(
      `确认删除成就“${row.name}”？已有用户进度时应改为停用。`,
      '删除成就',
      { type: 'warning' },
    )
    await deleteClubGamificationAchievement(row.id)
    await refreshAll()
    ElMessage.success('成就已删除')
  } catch (error) {
    if (!isDialogCancel(error)) throw error
  }
}

async function removeReward(row: AdminGamificationReward) {
  try {
    await ElMessageBox.confirm(
      `确认删除奖励“${row.name}”？已发放或仍被成就引用时会阻止删除。`,
      '删除奖励',
      { type: 'warning' },
    )
    await deleteClubGamificationReward(row.id)
    await refreshAll()
    ElMessage.success('奖励已删除')
  } catch (error) {
    if (!isDialogCancel(error)) throw error
  }
}

function isDialogCancel(error: unknown) {
  return error === 'cancel' || error === 'close'
}

function rewardTypeLabel(type: GamificationRewardType) {
  return rewardTypes.find(item => item.value === type)?.label || type
}

function ruleSummary(row: AdminGamificationAchievement) {
  return row.rule_groups
    .map(group =>
      group.conditions
        .map(
          condition =>
            `${metrics.find(item => item.value === condition.metric)?.label || condition.metric} ≥ ${condition.threshold}`,
        )
        .join(group.operator === 'ANY' ? ' 或 ' : ' 且 '),
    )
    .join(row.root_operator === 'ANY' ? ' 或 ' : ' 且 ')
}

function formatWindow(row: AdminGamificationSet) {
  if (!row.starts_at && !row.ends_at) return '长期有效'
  return `${row.starts_at ? formatDateTime(row.starts_at) : '不限'} 至 ${row.ends_at ? formatDateTime(row.ends_at) : '不限'}`
}

onMounted(refreshAll)
</script>

<style scoped>
.club-gamification { display: grid; gap: 18px; }
.gamification-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 22px; border: 1px solid var(--border-color); border-radius: 16px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(245,241,255,.9)); }
.gamification-header p { margin: 0; color: var(--primary-gold-dark); font-size: var(--font-small); font-weight: 800; letter-spacing: .12em; }
.gamification-header h2 { margin: 5px 0; font-size: 25px; }
.gamification-header span { color: var(--text-light); font-size: var(--font-caption); }
.gamification-tabs :deep(.el-tabs__content) { overflow: visible; }
.toolbar { display: flex; gap: 10px; margin-bottom: 14px; }
.toolbar .el-input { max-width: 360px; }
.pagination-row { display: flex; justify-content: flex-end; margin-top: 16px; }
.reward-thumb { display: grid; width: 48px; height: 48px; place-items: center; overflow: hidden; border-radius: 12px; color: #fff; background: linear-gradient(135deg, var(--accent-purple), var(--primary-gold)); }
.reward-thumb img { width: 100%; height: 100%; object-fit: contain; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
.form-grid .el-date-editor, .form-grid .el-select { width: 100%; }
.switch-row { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; }
.rule-heading { display: flex; align-items: center; justify-content: space-between; margin: 8px 0; }
.rule-group { margin-bottom: 12px; padding: 14px; border: 1px solid var(--border-color); border-radius: 14px; background: var(--bg-gray); }
.rule-group > header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; font-weight: 700; }
.rule-group > header .el-button { margin-left: auto; }
.rule-condition { display: grid; gap: 10px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); }
.rule-condition__main { display: grid; grid-template-columns: 220px 140px auto; gap: 8px; align-items: center; }
.rule-condition__filters { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 8px; }
.hidden-input { display: none; }
@media (max-width: 768px) {
  .gamification-header { align-items: flex-start; padding: 17px; }
  .gamification-header h2 { font-size: 21px; }
  .toolbar { flex-direction: column; }
  .toolbar .el-input { max-width: none; }
  .form-grid, .rule-condition__main, .rule-condition__filters { grid-template-columns: 1fr; }
}
</style>
