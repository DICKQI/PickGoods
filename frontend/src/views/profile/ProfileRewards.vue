<template>
  <section class="reward-page" aria-labelledby="reward-title">
    <header class="reward-header">
      <div>
        <p>REWARD WARDROBE</p>
        <h2 id="reward-title">我的装扮库</h2>
        <span>成就奖励永久保留，可随时切换已经拥有的装扮。</span>
      </div>
      <el-tag effect="plain" round>已拥有 {{ store.ownedRewards.length }} 件</el-tag>
    </header>

    <el-tabs v-model="activeType" class="reward-tabs">
      <el-tab-pane
        v-for="tab in tabs"
        :key="tab.key"
        :label="tab.label"
        :name="tab.key"
      >
        <el-empty v-if="filteredRewards.length === 0" :description="tab.empty" />
        <div v-else class="reward-grid">
          <article
            v-for="reward in filteredRewards"
            :key="reward.id"
            class="reward-card"
            :class="[`rarity-${reward.rarity}`, { 'is-locked': !reward.owned, 'is-equipped': isEquipped(reward) }]"
          >
            <div class="reward-preview" :class="previewClass(reward)">
              <img v-if="reward.asset_url" :src="reward.asset_url" alt="" />
              <el-icon v-else><component :is="rewardIcon(reward.reward_type)" /></el-icon>
              <span v-if="!reward.owned" class="lock-mask"><el-icon><Lock /></el-icon></span>
            </div>
            <div class="reward-copy">
              <div class="reward-title">
                <h3>{{ reward.name }}</h3>
                <el-tag size="small" effect="plain" :type="rarityTag(reward.rarity)">
                  {{ rarityLabel(reward.rarity) }}
                </el-tag>
              </div>
              <p>{{ reward.description || rewardTypeLabel(reward.reward_type) }}</p>
              <span v-if="reward.owned" class="owned-time">已拥有</span>
              <span v-else class="locked-source">
                解锁来源：{{ reward.source_achievement?.name || '完成对应成就' }}
              </span>
            </div>
            <div class="reward-actions">
              <el-button
                v-if="equipSlot(reward)"
                :type="isEquipped(reward) ? 'success' : 'primary'"
                :plain="isEquipped(reward)"
                :disabled="!reward.owned || reward.is_active === false"
                @click="toggleEquip(reward)"
              >
                {{ isEquipped(reward) ? '使用中' : '装备' }}
              </el-button>
              <span v-else-if="reward.owned && reward.is_active !== false">
                {{ rewardUsageText(reward) }}
              </span>
              <span v-else-if="reward.owned">奖励已停用</span>
              <span v-else>尚未解锁</span>
            </div>
          </article>
        </div>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Brush,
  Collection,
  Lock,
  Medal,
  Picture,
  Star,
} from '@element-plus/icons-vue'
import { useGamificationStore } from '@/stores/gamification'
import type {
  GamificationEquipmentSlot,
  GamificationReward,
  GamificationRewardType,
} from '@/api/types'

const store = useGamificationStore()
const activeType = ref<GamificationRewardType | 'ALL'>('ALL')

const tabs: Array<{ key: GamificationRewardType | 'ALL'; label: string; empty: string }> = [
  { key: 'ALL', label: '全部', empty: '暂时还没有装扮奖励' },
  { key: 'BADGE', label: '徽章', empty: '完成成就后，徽章会出现在这里' },
  { key: 'PROFILE_FRAME', label: '头像框', empty: '还没有解锁头像框' },
  { key: 'PROFILE_CARD_SKIN', label: '收藏卡', empty: '还没有解锁收藏卡皮肤' },
  { key: 'JOURNAL_STICKER_PACK', label: '贴纸', empty: '还没有解锁手帐贴纸包' },
  { key: 'JOURNAL_BACKGROUND', label: '手帐背景', empty: '还没有解锁手帐背景' },
  { key: 'SHOWCASE_THEME', label: '痛柜主题', empty: '还没有解锁痛柜主题' },
  { key: 'SHOWCASE_EFFECT', label: '痛柜效果', empty: '还没有解锁痛柜效果' },
]

const filteredRewards = computed(() => activeType.value === 'ALL'
  ? store.rewards
  : store.rewards.filter(reward => reward.reward_type === activeType.value))

const slotByType: Partial<Record<GamificationRewardType, GamificationEquipmentSlot>> = {
  PROFILE_FRAME: 'PROFILE_FRAME',
  PROFILE_CARD_SKIN: 'PROFILE_CARD_SKIN',
  SHOWCASE_THEME: 'DEFAULT_SHOWCASE_THEME',
  SHOWCASE_EFFECT: 'DEFAULT_SHOWCASE_EFFECT',
}

const equipSlot = (reward: GamificationReward) => slotByType[reward.reward_type]

function isEquipped(reward: GamificationReward) {
  const slot = equipSlot(reward)
  return Boolean(slot && store.equipped(slot)?.id === reward.id)
}

async function toggleEquip(reward: GamificationReward) {
  const slot = equipSlot(reward)
  if (!slot) return
  const target = isEquipped(reward) ? null : reward.id
  await store.equip(slot, target)
  ElMessage.success(target ? `${reward.name}已装备` : '已取消装备')
}

function rewardIcon(type: GamificationRewardType) {
  return {
    BADGE: Medal,
    PROFILE_FRAME: Star,
    PROFILE_CARD_SKIN: Collection,
    JOURNAL_STICKER_PACK: Brush,
    JOURNAL_BACKGROUND: Picture,
    SHOWCASE_THEME: Collection,
    SHOWCASE_EFFECT: Star,
  }[type]
}

function previewClass(reward: GamificationReward) {
  return reward.reward_type.toLowerCase()
}

function rarityLabel(rarity: GamificationReward['rarity']) {
  return { common: '普通', rare: '稀有', epic: '史诗', legendary: '限定' }[rarity]
}

function rarityTag(rarity: GamificationReward['rarity']) {
  return { common: 'info', rare: 'primary', epic: 'warning', legendary: 'danger' }[rarity] as
    | 'info' | 'primary' | 'warning' | 'danger'
}

function rewardTypeLabel(type: GamificationRewardType) {
  return {
    BADGE: '成就徽章',
    PROFILE_FRAME: '头像框',
    PROFILE_CARD_SKIN: '收藏卡皮肤',
    JOURNAL_STICKER_PACK: '手帐贴纸包',
    JOURNAL_BACKGROUND: '手帐页面背景',
    SHOWCASE_THEME: '痛柜主题',
    SHOWCASE_EFFECT: '痛柜互动效果',
  }[type]
}

function rewardUsageText(reward: GamificationReward) {
  return {
    BADGE: '可在成就页选择公开展示',
    JOURNAL_STICKER_PACK: '可在手帐素材中使用',
    JOURNAL_BACKGROUND: '可在手帐页面设置中选择',
    SHOWCASE_THEME: '可在展柜编辑中选择',
    SHOWCASE_EFFECT: '可在展柜编辑中选择',
    PROFILE_FRAME: '已应用为头像框',
    PROFILE_CARD_SKIN: '已应用为收藏卡皮肤',
  }[reward.reward_type]
}

onMounted(() => Promise.all([store.loadRewards(true), store.loadSummary(true)]))
</script>

<style scoped>
.reward-page { display: grid; gap: 18px; }
.reward-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 4px 2px 0; }
.reward-header p { margin: 0; color: var(--primary-gold-dark); font-size: 11px; font-weight: 800; letter-spacing: .14em; }
.reward-header h2 { margin: 4px 0; font-size: 26px; }
.reward-header span { color: var(--text-light); font-size: 13px; }
.reward-tabs :deep(.el-tabs__header) { margin-bottom: 18px; }
.reward-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.reward-card {
  display: flex; min-width: 0; flex-direction: column; overflow: hidden;
  border: 1px solid rgba(44,39,30,.09); border-radius: 18px; background: #fff;
  box-shadow: 0 12px 34px -30px rgba(45,38,24,.7); transition: transform .18s ease, box-shadow .18s ease;
}
.reward-card:hover { transform: translateY(-3px); box-shadow: 0 18px 38px -30px rgba(45,38,24,.8); }
.reward-card.is-locked { filter: saturate(.45); }
.reward-card.is-equipped { border-color: rgba(212,175,55,.65); box-shadow: 0 0 0 2px rgba(212,175,55,.1); }
.reward-preview {
  position: relative; display: grid; height: 128px; place-items: center; overflow: hidden;
  color: #fff; font-size: 42px;
  background: linear-gradient(135deg, #9a8be9, #d4af37);
}
.reward-preview img { width: 100%; height: 100%; object-fit: contain; padding: 18px; }
.reward-preview.profile_frame { background: conic-gradient(from 20deg,#f6d365,#fda085,#a18cd1,#f6d365); }
.reward-preview.profile_card_skin { background: linear-gradient(135deg,#171b3c,#a29bfe 60%,#ffcf70); }
.reward-preview.journal_sticker_pack { background: linear-gradient(135deg,#ffdff0,#e0f2fe,#fff4bd); color:#8b5fbf; }
.reward-preview.journal_background { background: linear-gradient(135deg,#fff4f6,#fce7f3,#fff); color:#d16e9b; }
.reward-preview.showcase_theme { background: linear-gradient(135deg,#1d1d35,#5f4b8b,#d4af37); }
.reward-preview.showcase_effect { background: radial-gradient(circle at 50% 40%,#fff5b7,#a29bfe 45%,#17172f); }
.lock-mask { position: absolute; inset: 0; display: grid; place-items: center; color:#fff; background: rgba(26,24,35,.48); font-size: 26px; }
.reward-copy { flex: 1; padding: 15px 15px 8px; }
.reward-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.reward-title h3 { margin: 0; font-size: 16px; }
.reward-copy p { min-height: 34px; margin: 8px 0; color: var(--text-light); font-size: 12px; line-height: 1.45; }
.owned-time { color: #3c9b72; font-size: 12px; font-weight: 700; }
.locked-source { color: var(--text-light); font-size: 11px; }
.reward-actions { display: grid; min-height: 54px; place-items: center; padding: 8px 14px 14px; color: var(--text-light); font-size: 12px; text-align: center; }
.reward-actions .el-button { width: 100%; }
@media (max-width: 900px) { .reward-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 560px) {
  .reward-header { align-items: flex-start; flex-direction: column; }
  .reward-grid { grid-template-columns: 1fr; }
  .reward-preview { height: 112px; }
}
@media (prefers-reduced-motion: reduce) { .reward-card { transition: none; } }
</style>
