<template>
  <section class="achievement-page" aria-labelledby="achievement-title">
    <header class="achievement-hero">
      <div>
        <p>COLLECTION MILESTONES</p>
        <h2 id="achievement-title">我的成就</h2>
        <span>每一次收藏，都在为你点亮新的徽章。</span>
      </div>
      <el-button class="public-button" @click="openBadgePicker">
        <el-icon><Medal /></el-icon>
        公开展示
      </el-button>
    </header>

    <el-empty v-if="!store.overview.enabled && !store.overviewLoading" description="成就功能尚未开放" />
    <el-skeleton v-else-if="store.overviewLoading" :rows="8" animated />
    <template v-else>
      <div class="metric-grid">
        <div v-for="metric in metricCards" :key="metric.key" class="metric-card">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.unit }}</small>
        </div>
      </div>

      <section class="public-strip">
        <div>
          <strong>公开徽章墙</strong>
          <span>{{ selectedBadges.length ? `已选择 ${selectedBadges.length}/3 枚` : '默认仅自己可见' }}</span>
        </div>
        <div class="selected-badges">
          <span v-for="badge in selectedBadges" :key="badge.id" class="selected-badge">
            <img v-if="badge.asset_url" :src="badge.asset_url" alt="" />
            <el-icon v-else><Medal /></el-icon>
            {{ badge.name }}
          </span>
          <small v-if="selectedBadges.length === 0">未公开任何徽章</small>
        </div>
      </section>

      <section v-for="set in groupedAchievements" :key="set.id" class="set-section">
        <header class="set-header">
          <div>
            <span>{{ set.is_limited ? 'LIMITED EVENT' : 'COLLECTION SERIES' }}</span>
            <h3>{{ set.name }}</h3>
            <p>{{ set.description }}</p>
          </div>
          <div class="set-tags">
            <el-tag :type="set.is_limited ? 'danger' : 'warning'" effect="plain" round>
              {{ set.is_limited ? '限时活动' : set.badge_label || '永久成就' }}
            </el-tag>
            <el-tag v-if="set.club" type="info" effect="plain" round>
              {{ set.club.name }}
            </el-tag>
          </div>
        </header>

        <article
          v-for="item in set.items"
          :key="item.id"
          class="achievement-card"
          :class="[`is-${item.status}`, item.achievement.is_limited ? 'is-limited' : '']"
        >
          <div class="achievement-icon">
            <img v-if="primaryReward(item)?.asset_url" :src="primaryReward(item)?.asset_url || ''" alt="" />
            <el-icon v-else><Trophy /></el-icon>
          </div>
          <div class="achievement-main">
            <div class="achievement-title-row">
              <div>
                <h4>{{ item.achievement.name }}</h4>
                <p>{{ item.achievement.description || '完成下面的条件即可解锁。' }}</p>
              </div>
              <el-tag :type="statusTagType(item.status)" effect="dark" round>
                {{ statusLabel(item.status) }}
              </el-tag>
            </div>

            <el-progress
              :percentage="Number(item.progress_percent)"
              :stroke-width="9"
              :show-text="false"
              :status="item.status === 'claimed' ? 'success' : undefined"
            />
            <div class="rule-groups">
              <div v-for="(group, groupIndex) in item.progress.groups" :key="group.id" class="condition-group">
                <div class="group-label">
                  条件组 {{ groupIndex + 1 }} · {{ group.operator === 'ANY' ? '任一项满足' : '全部满足' }}
                </div>
                <div class="condition-list">
                  <div
                    v-for="condition in group.conditions"
                    :key="condition.id"
                    class="condition-item"
                    :class="{ 'is-satisfied': condition.satisfied }"
                  >
                    <el-icon><CircleCheck v-if="condition.satisfied" /><Clock v-else /></el-icon>
                    <span>{{ condition.label }}</span>
                    <strong>{{ formatMetric(condition.current, condition.metric) }} / {{ formatMetric(condition.target, condition.metric) }}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div class="reward-row">
              <span v-for="reward in item.rewards" :key="reward.id" class="reward-pill" :class="`rarity-${reward.rarity}`">
                {{ reward.name }}
              </span>
            </div>
          </div>
          <div class="achievement-action">
            <el-button
              v-if="item.status === 'unlocked'"
              type="primary"
              class="claim-button"
              :loading="claimingId === item.id"
              @click="claim(item)"
            >
              领取奖励
            </el-button>
            <span v-else-if="item.status === 'claimed'">已收入装扮库</span>
            <span v-else>{{ Number(item.progress_percent).toFixed(0) }}%</span>
          </div>
        </article>
      </section>
    </template>

    <el-dialog v-model="badgePickerVisible" title="选择公开徽章" width="min(92vw, 620px)">
      <p class="picker-tip">最多选择 3 枚，其他用户只会看到这些徽章，不会看到完整成就进度。</p>
      <el-checkbox-group v-model="draftBadgeIds" class="badge-picker-grid">
        <el-checkbox
          v-for="badge in ownedBadges"
          :key="badge.id"
          :value="badge.id"
          :disabled="draftBadgeIds.length >= 3 && !draftBadgeIds.includes(badge.id)"
          border
        >
          <span class="badge-option">
            <img v-if="badge.asset_url" :src="badge.asset_url" alt="" />
            <el-icon v-else><Medal /></el-icon>
            <span>{{ badge.name }}</span>
          </span>
        </el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="badgePickerVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingBadges" @click="saveBadges">保存展示</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, Clock, Medal, Trophy } from '@element-plus/icons-vue'
import { useGamificationStore } from '@/stores/gamification'
import type {
  GamificationAchievementSet,
  GamificationMetric,
  GamificationReward,
  UserGamificationAchievement,
} from '@/api/types'

const store = useGamificationStore()
const claimingId = ref<number | null>(null)
const badgePickerVisible = ref(false)
const savingBadges = ref(false)
const draftBadgeIds = ref<number[]>([])

const metricCards = computed(() => [
  { key: 'goods', label: '累计新增', value: store.overview.metrics.goods_quantity, unit: '件' },
  { key: 'altars', label: '角色痛柜', value: store.overview.metrics.valid_altars, unit: '个' },
  { key: 'spend', label: '累计消费', value: `¥${store.overview.metrics.spend_amount.toFixed(2)}`, unit: '' },
  { key: 'ip', label: '收藏 IP', value: store.overview.metrics.distinct_ip_count, unit: '个' },
  { key: 'characters', label: '关联角色', value: store.overview.metrics.distinct_character_count, unit: '位' },
])

const groupedAchievements = computed(() => {
  const groups = new Map<number, {
    id: number
    name: string
    description: string
    badge_label: string
    is_limited: boolean
    club?: GamificationAchievementSet['club']
    items: UserGamificationAchievement[]
  }>()
  for (const item of store.overview.achievements) {
    const set = item.achievement.set
    const group = groups.get(set.id) || {
      id: set.id,
      name: set.name,
      description: set.description,
      badge_label: set.badge_label,
      is_limited: set.is_limited,
      club: set.club,
      items: [],
    }
    group.items.push(item)
    groups.set(set.id, group)
  }
  return [...groups.values()]
})

const ownedBadges = computed(() => store.rewards.filter(
  reward => reward.owned && reward.reward_type === 'BADGE',
))

const selectedBadges = computed(() => ownedBadges.value.filter(
  reward => store.summary.public_badge_ids.includes(reward.id),
))

const primaryReward = (item: UserGamificationAchievement): GamificationReward | undefined =>
  item.rewards.find(reward => reward.reward_type === 'BADGE') || item.rewards[0]

function statusLabel(status: UserGamificationAchievement['status']) {
  return { locked: '进行中', unlocked: '待领取', claimed: '已完成' }[status]
}

function statusTagType(status: UserGamificationAchievement['status']) {
  return { locked: 'info', unlocked: 'warning', claimed: 'success' }[status] as 'info' | 'warning' | 'success'
}

function formatMetric(value: number, metric: GamificationMetric) {
  if (metric === 'SPEND_AMOUNT' || metric === 'CLUB_SPEND_AMOUNT') {
    return `¥${Number(value).toFixed(2)}`
  }
  return `${Number.isInteger(value) ? value : Number(value).toFixed(2)}`
}

async function claim(item: UserGamificationAchievement) {
  claimingId.value = item.id
  try {
    await store.claim(item.achievement.id)
    ElMessage.success('奖励已收入装扮库')
  } finally {
    claimingId.value = null
  }
}

function openBadgePicker() {
  draftBadgeIds.value = [...store.summary.public_badge_ids]
  badgePickerVisible.value = true
}

async function saveBadges() {
  savingBadges.value = true
  try {
    await store.setPublicBadges(draftBadgeIds.value)
    badgePickerVisible.value = false
    ElMessage.success(draftBadgeIds.value.length ? '公开徽章已更新' : '已关闭公开徽章展示')
  } finally {
    savingBadges.value = false
  }
}

onMounted(async () => {
  await Promise.all([store.loadOverview(true), store.loadRewards(true), store.loadSummary(true)])
  if (store.summary.unseen_count) await store.markSeen()
})
</script>

<style scoped>
.achievement-page { display: grid; gap: 18px; }
.achievement-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 24px;
  border-radius: 22px;
  color: #fff;
  background:
    radial-gradient(circle at 84% 10%, rgba(255, 255, 255, 0.3), transparent 24%),
    linear-gradient(125deg, #6f5bd9, #9a7ee8 58%, #d4af37);
  box-shadow: 0 18px 44px -26px rgba(65, 48, 150, 0.72);
}
.achievement-hero p { margin: 0 0 5px; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; opacity: .82; }
.achievement-hero h2 { margin: 0; font-size: 28px; }
.achievement-hero span { display: block; margin-top: 8px; opacity: .9; }
.public-button { flex: none; border: 1px solid rgba(255,255,255,.6); color: #fff; background: rgba(255,255,255,.14); }
.metric-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.metric-card {
  min-width: 0; padding: 16px; border: 1px solid rgba(212,175,55,.16); border-radius: 16px;
  background: rgba(255,255,255,.9); box-shadow: 0 10px 28px -24px rgba(55,43,21,.5);
}
.metric-card span, .metric-card small { display: block; color: var(--text-light); font-size: 12px; }
.metric-card strong { display: inline-block; margin: 7px 3px 3px 0; color: var(--text-dark); font-size: 22px; }
.public-strip {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px;
  border: 1px solid rgba(162,155,254,.2); border-radius: 16px; background: rgba(162,155,254,.07);
}
.public-strip strong, .public-strip span { display: block; }
.public-strip > div:first-child span { margin-top: 4px; color: var(--text-light); font-size: 12px; }
.selected-badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.selected-badge {
  display: inline-flex !important; align-items: center; gap: 5px; padding: 6px 9px; border-radius: 999px;
  background: #fff; color: var(--accent-purple-dark); font-size: 12px; box-shadow: 0 4px 14px rgba(89,70,160,.1);
}
.selected-badge img, .badge-option img { width: 20px; height: 20px; object-fit: contain; }
.set-section { display: grid; gap: 12px; }
.set-header { display: flex; justify-content: space-between; gap: 14px; padding: 8px 2px 0; }
.set-header span { color: var(--primary-gold-dark); font-size: 11px; font-weight: 800; letter-spacing: .12em; }
.set-header h3 { margin: 3px 0; font-size: 21px; }
.set-header p { margin: 0; color: var(--text-light); font-size: 13px; }
.set-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.achievement-card {
  display: grid; grid-template-columns: 70px minmax(0, 1fr) 120px; gap: 16px; align-items: center;
  padding: 18px; border: 1px solid rgba(44,39,30,.08); border-radius: 18px; background: #fff;
  box-shadow: 0 12px 32px -28px rgba(45,38,24,.65); transition: transform .18s ease, border-color .18s ease;
}
.achievement-card:hover { transform: translateY(-2px); border-color: rgba(162,155,254,.35); }
.achievement-card.is-unlocked { border-color: rgba(212,175,55,.6); background: linear-gradient(120deg,#fffdf6,#fff); }
.achievement-card.is-claimed { opacity: .88; }
.achievement-icon {
  display: grid; width: 66px; height: 66px; place-items: center; border-radius: 20px;
  color: #fff; font-size: 28px; background: linear-gradient(135deg, var(--accent-purple), var(--primary-gold));
}
.achievement-icon img { width: 52px; height: 52px; object-fit: contain; }
.achievement-title-row { display: flex; justify-content: space-between; gap: 12px; }
.achievement-title-row h4 { margin: 0; font-size: 17px; }
.achievement-title-row p { margin: 4px 0 12px; color: var(--text-light); font-size: 12px; }
.rule-groups { display: grid; gap: 10px; margin-top: 12px; }
.condition-group { padding: 9px 10px; border-radius: 10px; background: rgba(162, 155, 254, .06); }
.group-label { margin-bottom: 6px; color: var(--accent-purple-dark); font-size: 11px; font-weight: 700; }
.condition-list { display: grid; gap: 6px; }
.condition-item { display: flex; align-items: center; gap: 7px; color: var(--text-light); font-size: 12px; }
.condition-item strong { margin-left: auto; color: var(--text-regular); }
.condition-item.is-satisfied, .condition-item.is-satisfied strong { color: #2b9b69; }
.reward-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.reward-pill { padding: 4px 8px; border-radius: 999px; background: #f5f3ff; color: #6c5bce; font-size: 11px; }
.reward-pill.rarity-legendary { background: #fff4ca; color: #9a7100; }
.reward-pill.rarity-epic { background: #efe7ff; color: #7448c2; }
.achievement-action { display: grid; min-height: 68px; place-items: center; text-align: center; color: var(--text-light); font-weight: 700; }
.claim-button { --el-button-bg-color: var(--primary-gold); --el-button-border-color: var(--primary-gold); }
.picker-tip { margin-top: 0; color: var(--text-light); }
.badge-picker-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.badge-picker-grid :deep(.el-checkbox) { margin: 0; height: auto; padding: 10px; }
.badge-option { display: inline-flex; align-items: center; gap: 7px; }
@media (max-width: 768px) {
  .achievement-hero { align-items: flex-start; padding: 20px; }
  .metric-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .public-strip { align-items: flex-start; flex-direction: column; }
  .selected-badges { justify-content: flex-start; }
  .achievement-card { grid-template-columns: 54px minmax(0,1fr); align-items: start; padding: 15px; }
  .achievement-icon { width: 52px; height: 52px; border-radius: 15px; font-size: 22px; }
  .achievement-action { grid-column: 1 / -1; min-height: 0; }
  .achievement-action .el-button { width: 100%; }
  .badge-picker-grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .achievement-card { transition: none; }
}
</style>
