<template>
  <aside class="journal-goods-picker">
    <div class="picker-header">
      <strong>谷子素材</strong>
      <el-input
        v-model="keyword"
        size="small"
        clearable
        placeholder="搜索谷子"
        @keyup.enter="loadGoods"
        @clear="loadGoods"
      />
    </div>

    <div v-if="loading" class="picker-state">
      <el-skeleton :rows="4" animated />
    </div>
    <div v-else-if="goodsList.length === 0" class="picker-state">
      <el-empty description="暂无可插入的谷子" :image-size="72" />
    </div>
    <div v-else class="picker-grid">
      <button
        v-for="goods in goodsList"
        :key="goods.id"
        class="picker-item"
        type="button"
        :title="goods.name"
        :disabled="!goods.main_photo"
        @click="insertGoods(goods)"
      >
        <el-image v-if="goods.main_photo" :src="goods.main_photo" fit="contain" class="picker-img">
          <template #error>
            <div class="picker-placeholder"><el-icon><Picture /></el-icon></div>
          </template>
        </el-image>
        <div v-else class="picker-placeholder"><el-icon><Picture /></el-icon></div>
        <span>{{ goods.name }}</span>
      </button>
    </div>
    <el-button v-if="nextPage" class="load-more" size="small" :loading="loadingMore" @click="loadMore">
      加载更多
    </el-button>
  </aside>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Picture } from '@element-plus/icons-vue'
import { getGoodsList } from '@/api/goods'
import type { GoodsListItem } from '@/api/types'

const emit = defineEmits<{
  insertGoods: [goods: GoodsListItem]
}>()

const props = withDefaults(defineProps<{
  ipId?: number
  characterId?: number
  categoryId?: number
  themeId?: number
  onlyWithImage?: boolean
}>(), {
  onlyWithImage: true,
})

const keyword = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const goodsList = ref<GoodsListItem[]>([])
const page = ref(1)
const nextPage = ref<number | null>(null)

const recentStorageKey = 'journal:recent-goods'

const rememberGoods = (goods: GoodsListItem) => {
  const current = JSON.parse(localStorage.getItem(recentStorageKey) || '[]') as Array<Pick<GoodsListItem, 'id' | 'name' | 'main_photo'>>
  const next = [
    { id: goods.id, name: goods.name, main_photo: goods.main_photo },
    ...current.filter(item => item.id !== goods.id),
  ].slice(0, 12)
  localStorage.setItem(recentStorageKey, JSON.stringify(next))
}

const insertGoods = (goods: GoodsListItem) => {
  rememberGoods(goods)
  emit('insertGoods', goods)
}

const loadGoods = async () => {
  loading.value = true
  page.value = 1
  try {
    const data = await getGoodsList({
      page: page.value,
      page_size: 18,
      search: keyword.value || undefined,
      status__in: 'in_cabinet,outdoor',
      has_main_photo: props.onlyWithImage,
      fields: 'journal_asset',
      ip: props.ipId,
      character: props.characterId,
      category: props.categoryId,
      theme: props.themeId,
    })
    goodsList.value = data.results || []
    nextPage.value = data.next
  } finally {
    loading.value = false
  }
}

const loadMore = async () => {
  if (!nextPage.value || loadingMore.value) return
  loadingMore.value = true
  page.value = nextPage.value
  try {
    const data = await getGoodsList({
      page: page.value,
      page_size: 18,
      search: keyword.value || undefined,
      status__in: 'in_cabinet,outdoor',
      has_main_photo: props.onlyWithImage,
      fields: 'journal_asset',
      ip: props.ipId,
      character: props.characterId,
      category: props.categoryId,
      theme: props.themeId,
    })
    goodsList.value = [...goodsList.value, ...(data.results || [])]
    nextPage.value = data.next
  } finally {
    loadingMore.value = false
  }
}

onMounted(loadGoods)
</script>

<style scoped>
.journal-goods-picker {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.picker-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picker-header strong {
  font-size: 14px;
  color: var(--text-dark);
}

.picker-state {
  padding: 16px 0;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: 620px;
  overflow-y: auto;
  padding-right: 2px;
}

.picker-item {
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: #fff;
  padding: 7px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  text-align: left;
  color: var(--text-dark);
}

.picker-item:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.picker-item span {
  min-width: 0;
  font-size: 12px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-img,
.picker-placeholder {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 7px;
  background: #f8fafc;
  overflow: hidden;
}

.picker-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}
</style>
