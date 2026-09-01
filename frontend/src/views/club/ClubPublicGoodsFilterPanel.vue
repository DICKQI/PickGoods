<template>
  <div
    class="public-filter-grid"
    :class="{ 'public-filter-grid--with-imported': showImported && facets.imported_counts }"
  >
    <label class="public-filter-field">
      <span>IP 作品</span>
      <el-select
        :model-value="modelValue.ip"
        clearable
        filterable
        placeholder="全部 IP"
        @update:model-value="updateIP"
      >
        <el-option
          v-for="option in facets.ips"
          :key="option.id"
          :label="`${option.name} (${option.count})`"
          :value="option.id"
        />
      </el-select>
    </label>

    <label class="public-filter-field">
      <span>角色</span>
      <el-select
        :model-value="modelValue.character"
        clearable
        filterable
        :disabled="!modelValue.ip"
        :placeholder="modelValue.ip ? '全部角色' : '请先选择 IP'"
        @update:model-value="updateImmediate({ character: numericValue($event) })"
      >
        <el-option
          v-for="option in characterOptions"
          :key="option.id"
          :label="`${option.name} (${option.count})`"
          :value="option.id"
        />
      </el-select>
    </label>

    <label class="public-filter-field">
      <span>品类</span>
      <el-tree-select
        :model-value="modelValue.category"
        :data="categoryTree"
        :props="{ label: 'label', value: 'id', children: 'children' }"
        clearable
        filterable
        check-strictly
        :render-after-expand="false"
        placeholder="全部品类"
        @update:model-value="updateImmediate({ category: numericValue($event) })"
      />
    </label>

    <label class="public-filter-field">
      <span>主题</span>
      <el-select
        :model-value="modelValue.theme"
        clearable
        filterable
        placeholder="全部主题"
        @update:model-value="updateImmediate({ theme: numericValue($event) })"
      >
        <el-option
          v-for="option in facets.themes"
          :key="option.id"
          :label="`${option.name} (${option.count})`"
          :value="option.id"
        />
      </el-select>
    </label>

    <div class="public-filter-field public-filter-field--price">
      <span>公开价格</span>
      <div class="price-range">
        <el-input
          :model-value="modelValue.price_min"
          inputmode="decimal"
          :placeholder="facets.price_bounds.min ? `最低 ${facets.price_bounds.min}` : '最低价'"
          aria-label="最低公开价格"
          @update:model-value="updatePrice('price_min', $event)"
          @blur="commitPrice"
          @keyup.enter="commitPrice"
        >
          <template #prefix>¥</template>
        </el-input>
        <span class="price-range__separator">至</span>
        <el-input
          :model-value="modelValue.price_max"
          inputmode="decimal"
          :placeholder="facets.price_bounds.max ? `最高 ${facets.price_bounds.max}` : '最高价'"
          aria-label="最高公开价格"
          @update:model-value="updatePrice('price_max', $event)"
          @blur="commitPrice"
          @keyup.enter="commitPrice"
        >
          <template #prefix>¥</template>
        </el-input>
      </div>
    </div>

    <label v-if="showImported && facets.imported_counts" class="public-filter-field">
      <span>导入状态</span>
      <el-select
        :model-value="modelValue.imported"
        @update:model-value="updateImported"
      >
        <el-option
          :label="`全部 (${facets.imported_counts.imported + facets.imported_counts.unimported})`"
          value="all"
        />
        <el-option :label="`未导入 (${facets.imported_counts.unimported})`" value="unimported" />
        <el-option :label="`已导入 (${facets.imported_counts.imported})`" value="imported" />
      </el-select>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  ClubGoodsFacets,
  ClubGoodsImportedFilter,
} from '@/api/types'
import type { ClubPublicGoodsFilterState } from './clubPublicGoodsFilters'

interface CategoryTreeNode {
  id: number
  label: string
  children?: CategoryTreeNode[]
}

const props = defineProps<{
  modelValue: ClubPublicGoodsFilterState
  facets: ClubGoodsFacets
  showImported: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ClubPublicGoodsFilterState]
  change: [value: ClubPublicGoodsFilterState]
  'price-change': [value: ClubPublicGoodsFilterState]
  'price-commit': [value: ClubPublicGoodsFilterState]
}>()

const characterOptions = computed(() => (
  props.modelValue.ip
    ? props.facets.characters.filter(option => option.ip_id === props.modelValue.ip)
    : []
))

const categoryTree = computed<CategoryTreeNode[]>(() => {
  const nodes = new Map<number, CategoryTreeNode>()
  props.facets.categories.forEach((category) => {
    nodes.set(category.id, {
      id: category.id,
      label: `${category.name} (${category.count})`,
      children: [],
    })
  })
  const roots: CategoryTreeNode[] = []
  props.facets.categories.forEach((category) => {
    const node = nodes.get(category.id)!
    const parent = category.parent ? nodes.get(category.parent) : undefined
    if (parent) parent.children!.push(node)
    else roots.push(node)
  })
  nodes.forEach((node) => {
    if (node.children?.length === 0) delete node.children
  })
  return roots
})

function numericValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function nextValue(patch: Partial<ClubPublicGoodsFilterState>) {
  return { ...props.modelValue, ...patch }
}

function updateImmediate(patch: Partial<ClubPublicGoodsFilterState>) {
  const value = nextValue(patch)
  emit('update:modelValue', value)
  emit('change', value)
}

function updateIP(value: unknown) {
  updateImmediate({ ip: numericValue(value), character: undefined })
}

function updateImported(value: unknown) {
  const imported = value === 'imported' || value === 'unimported' ? value : 'all'
  updateImmediate({ imported: imported as ClubGoodsImportedFilter })
}

function updatePrice(key: 'price_min' | 'price_max', value: unknown) {
  const cleaned = typeof value === 'string' ? value.replace(/[^\d.]/g, '') : ''
  const [whole = '', ...decimalParts] = cleaned.split('.')
  const normalized = cleaned
    ? `${whole || '0'}${decimalParts.length ? `.${decimalParts.join('').slice(0, 2)}` : ''}`.slice(0, 12)
    : ''
  const next = nextValue({ [key]: normalized })
  emit('update:modelValue', next)
  emit('price-change', next)
}

function commitPrice() {
  emit('price-commit', props.modelValue)
}
</script>

<style scoped>
.public-filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px 16px;
}

.public-filter-field {
  display: grid;
  min-width: 0;
  gap: 7px;
  color: var(--text-regular);
  font-size: var(--font-small);
  font-weight: 600;
}

.public-filter-field > :deep(.el-select),
.public-filter-field > :deep(.el-tree-select) {
  width: 100%;
}

.public-filter-field :deep(.el-select__wrapper),
.public-filter-field :deep(.el-input__wrapper) {
  min-height: 38px;
  border-radius: var(--button-radius);
}

.price-range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
}

.price-range__separator {
  color: var(--text-light);
  font-weight: 400;
}

@media (min-width: 1360px) {
  .public-filter-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(240px, 1.55fr);
    column-gap: 14px;
  }

  .public-filter-grid--with-imported {
    grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(240px, 1.55fr) minmax(0, 1fr);
  }
}

@media (max-width: 1100px) {
  .public-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .public-filter-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
