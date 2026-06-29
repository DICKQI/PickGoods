<template>
  <aside class="journal-goods-picker">
    <div class="picker-header">
      <strong>谷子素材</strong>
      <div class="picker-tabs" role="tablist" aria-label="素材类型">
        <button
          class="picker-tab"
          :class="{ 'is-active': activeTab === 'goods' }"
          type="button"
          data-test="picker-tab-goods"
          @click="activeTab = 'goods'"
        >
          谷子
        </button>
        <button
          class="picker-tab"
          :class="{ 'is-active': activeTab === 'stickers' }"
          type="button"
          data-test="picker-tab-stickers"
          @click="activeTab = 'stickers'"
        >
          贴纸
        </button>
        <button
          class="picker-tab"
          :class="{ 'is-active': activeTab === 'upload' }"
          type="button"
          data-test="picker-tab-upload"
          @click="activeTab = 'upload'"
        >
          上传
        </button>
      </div>
      <el-input
        v-if="activeTab === 'goods'"
        v-model="keyword"
        size="small"
        clearable
        placeholder="搜索谷子"
        @keyup.enter="loadGoods"
        @clear="loadGoods"
      />
    </div>

    <section v-if="activeTab === 'goods' && recentGoods.length > 0" class="recent-goods-strip" aria-label="最近使用素材">
      <div class="recent-goods-title">最近使用</div>
      <div class="recent-goods-list">
        <button
          v-for="goods in recentGoods"
          :key="goods.id"
          class="recent-goods-item"
          type="button"
          :title="goods.name"
          @click="insertRecentGoods(goods)"
        >
          <img v-if="goods.main_photo" :src="goods.main_photo" alt="" />
          <span v-else class="picker-placeholder"><el-icon><Picture /></el-icon></span>
          <small>{{ goods.name }}</small>
        </button>
      </div>
    </section>

    <div v-if="activeTab === 'stickers'" class="decor-sticker-grid">
      <button
        v-for="sticker in decorStickers"
        :key="sticker.id"
        class="decor-sticker-item"
        type="button"
        :title="sticker.name"
        @click="insertDecorSticker(sticker)"
      >
        <img :src="sticker.src" alt="" />
        <span>{{ sticker.name }}</span>
      </button>
    </div>

    <div v-else-if="activeTab === 'upload'" class="upload-panel">
      <input ref="fileInputRef" type="file" accept="image/*" @change="handleLocalImageChange" />
      <small>选择本地图片后会作为贴纸插入当前页面。</small>
    </div>

    <div v-else-if="loading" class="picker-state">
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
  insertDecorSticker: [sticker: DecorSticker]
  insertLocalImage: [payload: { name: string; src: string }]
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
const activeTab = ref<'goods' | 'stickers' | 'upload'>('goods')
const loading = ref(false)
const loadingMore = ref(false)
const goodsList = ref<GoodsListItem[]>([])
const page = ref(1)
const nextPage = ref<number | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const recentStorageKey = 'journal:recent-goods'
type RecentGoods = Pick<GoodsListItem, 'id' | 'name' | 'main_photo'>
type DecorSticker = {
  id: string
  name: string
  src: string
}
const recentGoods = ref<RecentGoods[]>([])

const svgSticker = (label: string, fill: string, stroke: string) => (
  `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
      <rect x="12" y="18" width="136" height="84" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
      <text x="80" y="72" text-anchor="middle" font-size="26" font-family="sans-serif" fill="${stroke}">${label}</text>
    </svg>
  `)}`
)

const decorStickers: DecorSticker[] = [
  { id: 'tape-pink', name: '粉色胶带', src: svgSticker('TAPE', '#ffe4ec', '#db7093') },
  { id: 'note-gold', name: '金色便签', src: svgSticker('NOTE', '#fff4bd', '#b8911f') },
  { id: 'bubble-blue', name: '对话框', src: svgSticker('HI', '#e0f2fe', '#0284c7') },
  { id: 'flower-green', name: '花边', src: svgSticker('✿', '#dcfce7', '#16a34a') },
]

const readRecentGoods = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentStorageKey) || '[]') as RecentGoods[]
    recentGoods.value = parsed
      .filter(item => item && item.id && item.name)
      .slice(0, 12)
  } catch {
    recentGoods.value = []
  }
}

const rememberGoods = (goods: GoodsListItem) => {
  const current = recentGoods.value
  const next = [
    { id: goods.id, name: goods.name, main_photo: goods.main_photo },
    ...current.filter(item => item.id !== goods.id),
  ].slice(0, 12)
  localStorage.setItem(recentStorageKey, JSON.stringify(next))
  recentGoods.value = next
}

const insertGoods = (goods: GoodsListItem) => {
  rememberGoods(goods)
  emit('insertGoods', goods)
}

const insertRecentGoods = (goods: RecentGoods) => {
  emit('insertGoods', goods as GoodsListItem)
}

const insertDecorSticker = (sticker: DecorSticker) => {
  emit('insertDecorSticker', { ...sticker, type: 'decor' } as DecorSticker)
}

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error || new Error('读取本地图片失败'))
  reader.readAsDataURL(file)
})

const handleLocalImageChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const src = await readFileAsDataUrl(file)
  emit('insertLocalImage', { name: file.name || '本地图片', src })
  if (fileInputRef.value) fileInputRef.value.value = ''
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

onMounted(() => {
  readRecentGoods()
  loadGoods()
})
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

.picker-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.picker-tab {
  height: 30px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 7px;
  background: #fff;
  color: var(--text-light);
  cursor: pointer;
}

.picker-tab.is-active {
  border-color: rgba(212, 175, 55, 0.58);
  background: rgba(212, 175, 55, 0.1);
  color: var(--primary-gold-dark);
  font-weight: 700;
}

.recent-goods-strip {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-goods-title {
  color: var(--text-light);
  font-size: 12px;
  font-weight: 700;
}

.recent-goods-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.recent-goods-item {
  width: 64px;
  flex: 0 0 auto;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: #fff;
  color: var(--text-dark);
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px;
  cursor: pointer;
}

.recent-goods-item img,
.recent-goods-item .picker-placeholder {
  width: 50px;
  height: 50px;
  border-radius: 7px;
  object-fit: contain;
  background: #f8fafc;
}

.recent-goods-item small {
  min-width: 0;
  color: var(--text-dark);
  font-size: 11px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: 620px;
  overflow-y: auto;
  padding-right: 2px;
}

.decor-sticker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.decor-sticker-item {
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
}

.decor-sticker-item img {
  width: 100%;
  aspect-ratio: 1.2;
  object-fit: contain;
}

.decor-sticker-item span,
.upload-panel small {
  color: var(--text-light);
  font-size: 12px;
}

.upload-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.34);
  border-radius: 8px;
  background: #fff;
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
