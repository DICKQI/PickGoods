<template>
  <div class="stats-filter-grid">
    <div class="stats-filter-item">
      <label>Top N</label>
      <div class="topn-control">
        <el-slider
          :model-value="top ?? 10"
          :min="3"
          :max="30"
          :step="1"
          :show-tooltip="false"
          @update:model-value="$emit('update:top', $event)"
        />
        <span class="topn-value">{{ top }}</span>
      </div>
    </div>

    <div class="stats-filter-item">
      <label>是否官谷</label>
      <el-select
        :model-value="isOfficial"
        placeholder="全部"
        clearable
        size="small"
        @update:model-value="$emit('update:isOfficial', $event)"
      >
        <el-option :value="true" label="官谷" />
        <el-option :value="false" label="同人/非官谷" />
      </el-select>
    </div>

    <div class="stats-filter-item">
      <label>状态</label>
      <el-checkbox-group
        :model-value="selectedStatuses"
        class="status-group"
        size="small"
        @update:model-value="$emit('update:selectedStatuses', $event)"
      >
        <el-checkbox-button label="in_cabinet">在馆</el-checkbox-button>
        <el-checkbox-button label="outdoor">出街中</el-checkbox-button>
        <el-checkbox-button label="sold">已售出</el-checkbox-button>
      </el-checkbox-group>
    </div>

    <div class="stats-filter-item">
      <label>IP作品</label>
      <el-select
        :model-value="ip"
        placeholder="全部IP"
        clearable
        filterable
        size="small"
        @update:model-value="$emit('update:ip', $event)"
      >
        <el-option
          v-for="opt in ipOptions"
          :key="opt.id"
          :label="opt.name"
          :value="opt.id"
        />
      </el-select>
    </div>

    <div class="stats-filter-item stats-filter-item--character-stats">
      <label>角色厨力</label>
      <div class="character-stats-control">
        <el-select
          :model-value="characterStatsTargetId"
          placeholder="搜索角色名"
          clearable
          filterable
          remote
          reserve-keyword
          size="small"
          :remote-method="searchCharacterStatsOptions"
          :loading="characterStatsLoading"
          @update:model-value="$emit('update:characterStatsTargetId', $event)"
        >
          <el-option
            v-for="character in characterStatsOptions"
            :key="character.id"
            :label="`${character.name} · ${character.ip.name}`"
            :value="character.id"
          />
        </el-select>
        <el-button
          type="primary"
          size="small"
          class="character-stats-button"
          :disabled="!characterStatsTargetId"
          @click="$emit('openCharacterStats')"
        >
          <el-icon><Top /></el-icon>
          <span>查看厨力</span>
        </el-button>
      </div>
    </div>

    <div class="stats-filter-item">
      <label>品类</label>
      <el-tree-select
        :model-value="category"
        :data="categoryTreeData"
        :props="{ label: 'label', value: 'id', children: 'children' }"
        placeholder="全部品类"
        clearable
        size="small"
        check-strictly
        @update:model-value="$emit('update:category', $event)"
      />
    </div>

    <div class="stats-filter-item stats-filter-item--range">
      <label>入手日期区间</label>
      <el-date-picker
        :model-value="purchaseDateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        size="small"
        @update:model-value="$emit('update:purchaseDateRange', $event)"
      />
    </div>

    <div class="stats-filter-item stats-filter-item--range">
      <label>录入日期区间</label>
      <el-date-picker
        :model-value="createdDateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        size="small"
        @update:model-value="$emit('update:createdDateRange', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Top } from '@element-plus/icons-vue'
import type { Character, GoodsStatus, IP } from '@/api/types'

interface CategoryTreeNode {
  id: number
  label: string
  children?: CategoryTreeNode[]
}

defineProps<{
  top?: number
  isOfficial?: boolean
  selectedStatuses: GoodsStatus[]
  ip?: number
  category?: number
  purchaseDateRange: [string, string] | null
  createdDateRange: [string, string] | null
  ipOptions: IP[]
  categoryTreeData: CategoryTreeNode[]
  characterStatsTargetId?: number
  characterStatsOptions: Character[]
  characterStatsLoading: boolean
  searchCharacterStatsOptions: (keyword: string) => void | Promise<void>
}>()

defineEmits<{
  'update:top': [value: number]
  'update:isOfficial': [value: boolean | undefined]
  'update:selectedStatuses': [value: GoodsStatus[]]
  'update:ip': [value: number | undefined]
  'update:category': [value: number | undefined]
  'update:purchaseDateRange': [value: [string, string] | null]
  'update:createdDateRange': [value: [string, string] | null]
  'update:characterStatsTargetId': [value: number | undefined]
  openCharacterStats: []
}>()
</script>

<style scoped>
.stats-filter-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(140px, 1fr));
  gap: 16px 20px;
  align-items: start;
}

.stats-filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.stats-filter-item--range {
  grid-column: span 2;
}

.stats-filter-item label {
  font-size: 12px;
  color: var(--text-light);
  font-weight: 500;
  line-height: 1.4;
  flex-shrink: 0;
}

.topn-control {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.topn-control :deep(.el-slider) {
  flex: 1;
}

.topn-value {
  width: 28px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  color: var(--text-dark);
  flex-shrink: 0;
}

.status-group {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.character-stats-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.character-stats-button {
  flex-shrink: 0;
}

.stats-filter-item :deep(.el-select),
.stats-filter-item :deep(.el-tree-select),
.stats-filter-item :deep(.el-date-editor) {
  width: 100%;
}

@media (max-width: 900px) {
  .stats-filter-grid {
    grid-template-columns: repeat(2, minmax(140px, 1fr));
  }

  .stats-filter-item--range {
    grid-column: span 2;
  }
}

@media (max-width: 480px) {
  .stats-filter-grid {
    grid-template-columns: 1fr;
  }

  .stats-filter-item--range {
    grid-column: span 1;
  }

  .character-stats-control {
    grid-template-columns: 1fr;
  }
}
</style>
