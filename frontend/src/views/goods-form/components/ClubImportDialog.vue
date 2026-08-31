<template>
  <el-dialog
    :model-value="modelValue"
    class="club-import-workspace"
    width="min(1180px, calc(100vw - 32px))"
    :close-on-click-modal="false"
    :show-close="true"
    @update:model-value="emit('update:modelValue', $event)"
    @open="handleOpen"
  >
    <template #header>
      <div class="club-import-header">
        <div>
          <span class="club-import-kicker">PUBLIC CATALOG</span>
          <h2>从社团导入谷子</h2>
          <p>{{ queueMode ? '继续处理本次导入队列，完成后可返回继续浏览。' : '按社团浏览公开谷子，支持搜索、筛选和跨页选择。' }}</p>
        </div>
        <div v-if="!queueMode" class="club-import-summary">
          <strong>{{ selectedCount }}</strong>
          <span>项已选择</span>
        </div>
        <div v-else class="club-import-summary club-import-summary--queue">
          <strong>{{ queueResolvedCount }}/{{ queueStore.items.length }}</strong>
          <span>项已处理</span>
        </div>
      </div>
    </template>

    <div v-if="queueMode" class="club-import-results">
      <div class="club-import-results__toolbar">
        <div>
          <strong>本次导入队列</strong>
          <span>已完成的条目不会重复处理，待处理和失败条目可以继续。</span>
        </div>
        <el-button text type="primary" @click="queueMode = false">继续浏览社团</el-button>
      </div>
      <div class="club-import-result-list">
        <article v-for="item in queueStore.items" :key="item.goodsId" class="club-import-result-row">
          <div class="club-import-result-row__thumb">
            <el-image v-if="item.mainPhoto" :src="item.mainPhoto" :alt="`${item.name}图片`" fit="cover" />
            <el-icon v-else><Picture /></el-icon>
          </div>
          <div class="club-import-result-row__copy">
            <strong :title="item.name">{{ item.name }}</strong>
            <span>{{ item.clubName }} · {{ item.ipName || '未标注 IP' }} · {{ item.categoryName || '未分类' }}</span>
            <small v-if="item.resultMessage">{{ item.resultMessage }}</small>
          </div>
          <el-tag size="small" effect="plain" :type="queueStatusType(item.status)">{{ queueStatusText(item.status) }}</el-tag>
          <div class="club-import-result-row__actions">
            <el-button
              v-if="item.status === 'pending' || item.status === 'processing' || item.status === 'failed'"
              size="small"
              type="primary"
              plain
              @click="processQueueItem(item)">继续处理</el-button>
            <el-button
              v-if="item.status === 'pending' || item.status === 'failed'"
              size="small"
              text
              type="info"
              @click="skipQueueItem(item)">跳过</el-button>
            <el-button v-if="item.status === 'completed' && item.resultGoodsId" size="small" text type="primary" @click="emit('edit', item.resultGoodsId)">编辑</el-button>
          </div>
        </article>
      </div>
      <el-empty v-if="queueStore.items.length === 0" description="暂无导入队列" />
      <div class="club-import-results__footer">
        <span v-if="queueStore.isComplete">本次队列已处理完成，可以继续浏览其他社团。</span>
        <span v-else>还有 {{ queueStore.unresolvedItems.length }} 项待处理。</span>
        <el-button @click="emit('update:modelValue', false)">关闭</el-button>
      </div>
    </div>

    <div v-else class="club-import-browser">
      <aside class="club-import-clubs" aria-label="社团列表">
        <div class="club-import-panel-heading">
          <div>
            <strong>社团</strong>
            <span>{{ clubTotal }} 个公开社团</span>
          </div>
          <el-button v-if="clubSearch" text size="small" @click="clearClubSearch">清除</el-button>
        </div>
        <el-input
          v-model="clubSearch"
          clearable
          placeholder="搜索社团名称或简介"
          aria-label="搜索社团名称或简介"
          @clear="loadClubs(1)"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>

        <div v-loading="clubLoading" class="club-import-club-list" aria-live="polite">
          <button
            v-for="club in clubs"
            :key="club.id"
            type="button"
            class="club-import-club-row"
            :class="{ 'is-active': club.id === selectedClubId }"
            @click="selectClub(club.id)"
          >
            <span class="club-import-club-row__avatar">
              <el-image v-if="club.avatar" :src="club.avatar" :alt="`${club.name}头像`" fit="cover" lazy />
              <el-icon v-else><Shop /></el-icon>
            </span>
            <span class="club-import-club-row__copy">
              <strong :title="club.name">{{ club.name }}</strong>
              <small>{{ club.goods_count }} 件上架谷子</small>
            </span>
            <el-icon class="club-import-club-row__arrow"><ArrowRight /></el-icon>
          </button>
          <el-empty v-if="!clubLoading && !clubError && clubs.length === 0" :image-size="56" description="暂无匹配社团" />
          <div v-if="clubError" class="club-import-inline-error">
            <el-icon><WarningFilled /></el-icon>
            <span>{{ clubError }}</span>
            <el-button text type="primary" @click="loadClubs(clubPage)">重试</el-button>
          </div>
        </div>
        <el-pagination
          v-if="clubTotal > clubPageSize"
          v-model:current-page="clubPage"
          :page-size="clubPageSize"
          :total="clubTotal"
          small
          layout="prev, pager, next"
          @current-change="loadClubs"
        />
      </aside>

      <section class="club-import-goods" aria-label="社团谷子列表">
        <div class="club-import-goods-heading">
          <div class="club-import-panel-heading">
            <div>
              <strong>{{ selectedClub?.name || '选择一个社团' }}</strong>
              <span v-if="selectedClub">{{ goodsTotal }} 件公开谷子</span>
            </div>
          </div>
          <el-input
            v-model="goodsSearch"
            clearable
            :disabled="!selectedClubId"
            placeholder="搜索谷子名称、IP或品类"
            aria-label="搜索谷子名称、IP或品类"
            @clear="loadGoods(1)"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>
        <div class="club-import-goods-toolbar">
          <el-radio-group v-model="importFilter" size="small" @change="handleGoodsFilterChange">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="unimported">未导入</el-radio-button>
            <el-radio-button label="imported">已导入</el-radio-button>
          </el-radio-group>
          <el-checkbox
            v-if="goods.length"
            :model-value="pageFullySelected"
            :indeterminate="pagePartiallySelected"
            @change="toggleCurrentPage"
          >选择本页</el-checkbox>
        </div>

        <div v-loading="goodsLoading" class="club-import-goods-list" aria-live="polite">
          <article
            v-for="item in goods"
            :key="item.id"
            class="club-import-goods-row"
            :class="{ 'is-selected': isSelected(item.id) }"
            tabindex="0"
            @click="toggleItem(item)"
            @keydown.enter.prevent="toggleItem(item)"
            @keydown.space.prevent="toggleItem(item)"
          >
            <el-checkbox
              :model-value="isSelected(item.id)"
              :aria-label="`选择${item.name}`"
              @click.stop
              @change="toggleItem(item)"
            />
            <div class="club-import-goods-row__thumb">
              <el-image v-if="item.main_photo" :src="item.main_photo" :alt="`${item.name}图片`" fit="cover" lazy />
              <el-icon v-else><Picture /></el-icon>
            </div>
            <div class="club-import-goods-row__copy">
              <div class="club-import-goods-row__title">
                <strong :title="item.name">{{ item.name }}</strong>
                <el-tag v-if="item.is_imported" size="small" effect="plain" type="warning">已导入{{ item.imported_quantity ? ` · ${item.imported_quantity}件` : '' }}</el-tag>
              </div>
              <span>{{ item.ip?.name || '未标注 IP' }} · {{ item.category?.name || '未分类' }}</span>
              <small v-if="item.characters?.length">{{ item.characters.slice(0, 3).map(character => character.name).join('、') }}<template v-if="item.characters.length > 3"> 等</template></small>
            </div>
            <strong class="club-import-goods-row__price">{{ formatPrice(item.public_price) }}</strong>
          </article>
          <el-empty v-if="!goodsLoading && !goodsError && selectedClubId && goods.length === 0" :image-size="72" description="暂无匹配谷子" />
          <div v-if="!selectedClubId && !goodsLoading" class="club-import-goods-placeholder">
            <el-icon><Shop /></el-icon>
            <strong>先选择左侧社团</strong>
            <span>社团公开谷子会显示在这里</span>
          </div>
          <div v-if="goodsError" class="club-import-inline-error club-import-inline-error--goods">
            <el-icon><WarningFilled /></el-icon>
            <span>{{ goodsError }}</span>
            <el-button text type="primary" @click="loadGoods(goodsPage)">重试</el-button>
          </div>
        </div>
        <el-pagination
          v-if="goodsTotal > goodsPageSize"
          v-model:current-page="goodsPage"
          :page-size="goodsPageSize"
          :total="goodsTotal"
          small
          layout="prev, pager, next"
          @current-change="loadGoods"
        />
      </section>
    </div>

    <template #footer>
      <div v-if="!queueMode" class="club-import-footer">
        <div class="club-import-footer__selection">
          <el-icon><Checked /></el-icon>
          <strong>{{ selectedCount }}</strong>
          <span>项待处理</span>
          <small v-if="selectedCount">将按顺序逐条打开新增谷子表单</small>
        </div>
        <div class="club-import-footer__actions">
          <el-button @click="emit('update:modelValue', false)">取消</el-button>
          <el-button type="primary" :disabled="selectedCount === 0" @click="startQueue">开始处理</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { ArrowRight, Checked, Picture, Search, Shop, WarningFilled } from '@element-plus/icons-vue'
import { getClubGoods, getClubs } from '@/api/clubs'
import type { Club, ClubGoodsListItem } from '@/api/types'
import { useClubImportQueueStore, type ClubImportQueueItem } from '@/stores/clubImportQueue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  process: [queueId: string, item: ClubImportQueueItem]
  edit: [goodsId: string]
}>()

const queueStore = useClubImportQueueStore()
const queueMode = ref(false)
const clubs = ref<Club[]>([])
const clubSearch = ref('')
const clubLoading = ref(false)
const clubError = ref('')
const clubPage = ref(1)
const clubPageSize = 20
const clubTotal = ref(0)
const selectedClubId = ref<number | null>(null)
const goods = ref<ClubGoodsListItem[]>([])
const goodsSearch = ref('')
const goodsLoading = ref(false)
const goodsError = ref('')
const goodsPage = ref(1)
const goodsPageSize = 20
const goodsTotal = ref(0)
const importFilter = ref<'all' | 'imported' | 'unimported'>('all')
const selectedItems = ref<Record<string, ClubImportQueueItem>>({})
let clubSearchTimer: ReturnType<typeof setTimeout> | undefined
let goodsSearchTimer: ReturnType<typeof setTimeout> | undefined
let clubRequestSequence = 0
let goodsRequestSequence = 0

const selectedCount = computed(() => Object.keys(selectedItems.value).length)
const selectedClub = computed(() => clubs.value.find(club => club.id === selectedClubId.value) || null)
const queueResolvedCount = computed(() => queueStore.items.filter(item => item.status === 'completed' || item.status === 'skipped').length)
const currentPageSelectedCount = computed(() => goods.value.filter(item => isSelected(item.id)).length)
const pageFullySelected = computed(() => goods.value.length > 0 && currentPageSelectedCount.value === goods.value.length)
const pagePartiallySelected = computed(() => currentPageSelectedCount.value > 0 && !pageFullySelected.value)

function formatPrice(price?: string | null) {
  return price ? `￥${price}` : '价格待定'
}

function queueStatusText(status: ClubImportQueueItem['status']) {
  return { pending: '待处理', processing: '处理中', completed: '已完成', skipped: '已跳过', failed: '失败' }[status]
}

function queueStatusType(status: ClubImportQueueItem['status']) {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'skipped') return 'info'
  if (status === 'processing') return 'warning'
  return ''
}

async function loadClubs(page = 1) {
  const sequence = ++clubRequestSequence
  clubLoading.value = true
  clubError.value = ''
  try {
    const result = await getClubs({ page, page_size: clubPageSize, search: clubSearch.value.trim() || undefined })
    if (sequence !== clubRequestSequence) return
    clubs.value = result.results
    clubPage.value = result.page
    clubTotal.value = result.count
    if (!selectedClubId.value && clubs.value.length) await selectClub(clubs.value[0]!.id)
    else if (selectedClubId.value && !clubs.value.some(club => club.id === selectedClubId.value)) {
      selectedClubId.value = null
      goods.value = []
      goodsTotal.value = 0
    }
  } catch (error: any) {
    if (sequence === clubRequestSequence) clubError.value = error?.response?.data?.detail || error?.message || '社团加载失败，请重试。'
  } finally {
    if (sequence === clubRequestSequence) clubLoading.value = false
  }
}

async function selectClub(clubId: number) {
  if (selectedClubId.value === clubId) return
  selectedClubId.value = clubId
  goodsSearch.value = ''
  await loadGoods(1)
}

async function loadGoods(page = 1) {
  if (!selectedClubId.value) return
  const sequence = ++goodsRequestSequence
  goodsLoading.value = true
  goodsError.value = ''
  try {
    const result = await getClubGoods(selectedClubId.value, {
      page,
      page_size: goodsPageSize,
      search: goodsSearch.value.trim() || undefined,
      imported: importFilter.value,
    })
    if (sequence !== goodsRequestSequence) return
    goods.value = result.results
    goodsPage.value = result.page
    goodsTotal.value = result.count
  } catch (error: any) {
    if (sequence === goodsRequestSequence) goodsError.value = error?.response?.data?.detail || error?.message || '谷子加载失败，请重试。'
  } finally {
    if (sequence === goodsRequestSequence) goodsLoading.value = false
  }
}

function isSelected(goodsId: string) {
  return Boolean(selectedItems.value[goodsId])
}

function toggleItem(item: ClubGoodsListItem) {
  const next = { ...selectedItems.value }
  if (next[item.id]) delete next[item.id]
  else {
    next[item.id] = {
      goodsId: item.id,
      clubId: selectedClubId.value!,
      clubName: selectedClub.value?.name || '社团',
      name: item.name,
      mainPhoto: item.main_photo || null,
      ipName: item.ip?.name || null,
      categoryName: item.category?.name || null,
      imported: Boolean(item.is_imported),
      importedQuantity: item.imported_quantity ?? null,
      importedGoodsId: item.imported_goods_id ?? null,
      status: 'pending',
    }
  }
  selectedItems.value = next
}

function toggleCurrentPage(value: boolean | string | number) {
  const checked = Boolean(value)
  const next = { ...selectedItems.value }
  goods.value.forEach(item => {
    if (checked) {
      next[item.id] = {
        goodsId: item.id,
        clubId: selectedClubId.value!,
        clubName: selectedClub.value?.name || '社团',
        name: item.name,
        mainPhoto: item.main_photo || null,
        ipName: item.ip?.name || null,
        categoryName: item.category?.name || null,
        imported: Boolean(item.is_imported),
        importedQuantity: item.imported_quantity ?? null,
        importedGoodsId: item.imported_goods_id ?? null,
        status: 'pending',
      }
    } else delete next[item.id]
  })
  selectedItems.value = next
}

function clearClubSearch() {
  clubSearch.value = ''
  loadClubs(1)
}

function handleGoodsFilterChange() {
  goodsPage.value = 1
  void loadGoods(1)
}

function startQueue() {
  const queueId = queueStore.start(Object.values(selectedItems.value))
  const item = queueStore.nextPending()
  if (!item) return
  queueMode.value = true
  emit('process', queueId, item)
}

function processQueueItem(item: ClubImportQueueItem) {
  const queueId = queueStore.queueId
  if (!queueId) return
  queueStore.markProcessing(item.goodsId)
  emit('process', queueId, { ...item, status: 'processing' })
}

function skipQueueItem(item: ClubImportQueueItem) {
  queueStore.markSkipped(item.goodsId, '用户暂时跳过')
}

async function handleOpen() {
  queueMode.value = queueStore.items.length > 0 && Boolean(queueStore.queueId)
  if (queueMode.value) return
  if (!clubs.value.length || clubSearch.value) await loadClubs(1)
}

watch(() => props.modelValue, value => {
  if (value) void handleOpen()
}, { immediate: true })

watch(clubSearch, () => {
  if (clubSearchTimer) clearTimeout(clubSearchTimer)
  clubSearchTimer = setTimeout(() => { void loadClubs(1) }, 260)
})

watch(goodsSearch, () => {
  if (!selectedClubId.value) return
  if (goodsSearchTimer) clearTimeout(goodsSearchTimer)
  goodsSearchTimer = setTimeout(() => { void loadGoods(1) }, 260)
})

onUnmounted(() => {
  if (clubSearchTimer) clearTimeout(clubSearchTimer)
  if (goodsSearchTimer) clearTimeout(goodsSearchTimer)
})
</script>

<style scoped>
:global(.el-dialog.club-import-workspace) {
  display: flex;
  flex-direction: column;
  max-height: min(860px, calc(100dvh - 32px));
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: var(--card-radius);
  background: #fff;
}

:global(.club-import-workspace .el-dialog__header) {
  flex: none;
  margin: 0;
  padding: 22px 28px 18px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.16);
}

:global(.club-import-workspace .el-dialog__body) {
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

:global(.club-import-workspace .el-dialog__footer) {
  flex: none;
  margin: 0;
  padding: 14px 28px 18px;
  border-top: 1px solid rgba(17, 24, 39, 0.08);
}

.club-import-header,
.club-import-footer,
.club-import-results__toolbar,
.club-import-results__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.club-import-kicker {
  display: block;
  margin-bottom: 5px;
  color: var(--primary-gold-dark);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.club-import-header h2 {
  margin: 0;
  color: var(--text-dark);
  font-size: 22px;
  line-height: 1.3;
}

.club-import-header p {
  margin: 6px 0 0;
  color: var(--text-light);
  font-size: 13px;
}

.club-import-summary {
  display: flex;
  flex: none;
  align-items: baseline;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--button-radius);
  background: rgba(162, 155, 254, 0.1);
  color: var(--accent-purple-dark);
}

.club-import-summary strong { font-size: 20px; }
.club-import-summary span { font-size: 12px; }
.club-import-summary--queue { background: rgba(212, 175, 55, 0.12); color: var(--primary-gold-dark); }

.club-import-browser {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 0;
  height: min(610px, calc(100dvh - 230px));
}

.club-import-clubs,
.club-import-goods {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
}

.club-import-clubs {
  border-right: 1px solid rgba(17, 24, 39, 0.08);
  background: #fbfbfd;
}

.club-import-goods { padding-right: 24px; }

.club-import-panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.club-import-panel-heading > div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.club-import-panel-heading strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-dark);
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-import-panel-heading span {
  flex: none;
  color: var(--text-light);
  font-size: 12px;
}

.club-import-club-list,
.club-import-goods-list {
  min-height: 0;
  flex: 1;
  overflow: auto;
}

.club-import-club-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.club-import-club-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 9px;
  padding: 9px;
  border: 1px solid transparent;
  border-radius: var(--button-radius);
  outline: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.club-import-club-row:hover,
.club-import-club-row:focus-visible { border-color: rgba(162, 155, 254, 0.32); background: #fff; }
.club-import-club-row.is-active { border-color: rgba(162, 155, 254, 0.42); background: rgba(246, 244, 255, 0.95); }

.club-import-club-row__avatar {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  overflow: hidden;
  border-radius: var(--button-radius);
  background: rgba(212, 175, 55, 0.12);
  color: var(--primary-gold-dark);
}

.club-import-club-row__avatar :deep(.el-image),
.club-import-club-row__avatar :deep(img) { width: 100%; height: 100%; }
.club-import-club-row__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
.club-import-club-row__copy strong { overflow: hidden; color: var(--text-dark); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.club-import-club-row__copy small { color: var(--text-light); font-size: 11px; }
.club-import-club-row__arrow { flex: none; color: var(--text-light); }

.club-import-goods-heading { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 320px); align-items: center; gap: 16px; }
.club-import-goods-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 28px; }
.club-import-goods-list { display: flex; flex-direction: column; gap: 7px; padding-right: 2px; }

.club-import-goods-row {
  display: grid;
  grid-template-columns: 20px 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  min-height: 72px;
  padding: 8px 10px;
  border: 1px solid #ebeef5;
  border-radius: var(--button-radius);
  outline: none;
  background: #fff;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
}

.club-import-goods-row:hover,
.club-import-goods-row:focus-visible { border-color: rgba(162, 155, 254, 0.42); box-shadow: 0 3px 12px rgba(75, 65, 130, 0.08); }
.club-import-goods-row.is-selected { border-color: rgba(162, 155, 254, 0.7); background: rgba(246, 244, 255, 0.82); box-shadow: 0 0 0 2px rgba(162, 155, 254, 0.1); }

.club-import-goods-row__thumb,
.club-import-result-row__thumb {
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: var(--button-radius);
  background: #f5f6fa;
  color: #b4bac7;
}

.club-import-goods-row__thumb { width: 56px; height: 56px; }
.club-import-goods-row__thumb :deep(.el-image),
.club-import-goods-row__thumb :deep(img) { width: 100%; height: 100%; }
.club-import-goods-row__copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.club-import-goods-row__title { display: flex; min-width: 0; align-items: center; gap: 7px; }
.club-import-goods-row__title strong { min-width: 0; overflow: hidden; color: var(--text-dark); font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.club-import-goods-row__copy > span { overflow: hidden; color: var(--text-regular); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.club-import-goods-row__copy small { overflow: hidden; color: var(--text-light); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.club-import-goods-row__price { min-width: 62px; color: var(--primary-gold-dark); font-size: 13px; text-align: right; white-space: nowrap; }

.club-import-goods-placeholder,
.club-import-inline-error {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--text-light);
  font-size: 13px;
}

.club-import-goods-placeholder { flex-direction: column; border: 1px dashed rgba(212, 175, 55, 0.28); border-radius: var(--button-radius); }
.club-import-goods-placeholder .el-icon { color: var(--primary-gold); font-size: 28px; }
.club-import-goods-placeholder strong { color: var(--text-regular); font-size: 14px; }
.club-import-inline-error { min-height: 80px; color: var(--danger-color, #f56c6c); }
.club-import-inline-error--goods { flex: 1; }

.club-import-footer__selection { display: flex; align-items: center; gap: 6px; color: var(--text-regular); font-size: 13px; }
.club-import-footer__selection .el-icon { color: var(--accent-purple); }
.club-import-footer__selection strong { color: var(--accent-purple-dark); font-size: 18px; }
.club-import-footer__selection small { margin-left: 8px; color: var(--text-light); }
.club-import-footer__actions { display: flex; gap: 10px; }

.club-import-results { display: flex; height: min(610px, calc(100dvh - 230px)); min-height: 0; flex-direction: column; gap: 16px; padding: 20px 28px; }
.club-import-results__toolbar > div { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.club-import-results__toolbar strong { color: var(--text-dark); font-size: 16px; }
.club-import-results__toolbar span { color: var(--text-light); font-size: 12px; }
.club-import-result-list { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 7px; overflow: auto; }
.club-import-result-row { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto auto; align-items: center; gap: 11px; padding: 8px 10px; border: 1px solid #ebeef5; border-radius: var(--button-radius); }
.club-import-result-row__thumb { width: 48px; height: 48px; }
.club-import-result-row__thumb :deep(.el-image), .club-import-result-row__thumb :deep(img) { width: 100%; height: 100%; }
.club-import-result-row__copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.club-import-result-row__copy strong { overflow: hidden; color: var(--text-dark); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.club-import-result-row__copy span, .club-import-result-row__copy small { overflow: hidden; color: var(--text-light); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.club-import-result-row__copy small { color: var(--danger-color, #f56c6c); }
.club-import-result-row__actions { display: flex; align-items: center; gap: 4px; }
.club-import-results__footer { color: var(--text-light); font-size: 12px; }

:global(.club-import-workspace .el-pagination) { justify-content: center; margin-top: auto; }

@media (max-width: 820px) {
  :global(.el-dialog.club-import-workspace) { width: calc(100vw - 20px) !important; max-height: calc(100dvh - 20px); }
  :global(.club-import-workspace .el-dialog__header) { padding: 18px 18px 14px; }
  :global(.club-import-workspace .el-dialog__footer) { padding: 12px 18px 14px; }
  .club-import-browser { grid-template-columns: 230px minmax(0, 1fr); height: calc(100dvh - 210px); }
  .club-import-clubs, .club-import-goods { padding: 14px; }
  .club-import-goods { padding-right: 16px; }
  .club-import-goods-heading { grid-template-columns: 1fr; gap: 8px; }
  .club-import-goods-row { grid-template-columns: 20px 48px minmax(0, 1fr); }
  .club-import-goods-row__thumb { width: 48px; height: 48px; }
  .club-import-goods-row__price { display: none; }
}

@media (max-width: 560px) {
  .club-import-header { align-items: flex-start; }
  .club-import-header h2 { font-size: 19px; }
  .club-import-header p { max-width: 220px; line-height: 1.5; }
  .club-import-summary { display: none; }
  .club-import-browser { grid-template-columns: 1fr; height: calc(100dvh - 205px); }
  .club-import-clubs { max-height: 210px; border-right: 0; border-bottom: 1px solid rgba(17, 24, 39, 0.08); }
  .club-import-club-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .club-import-goods { min-height: 0; }
  .club-import-footer { align-items: stretch; flex-direction: column; gap: 10px; }
  .club-import-footer__selection small { display: none; }
  .club-import-footer__actions { justify-content: flex-end; }
  .club-import-results { height: calc(100dvh - 205px); padding: 16px 18px; }
  .club-import-result-row { grid-template-columns: 42px minmax(0, 1fr) auto; }
  .club-import-result-row__thumb { width: 42px; height: 42px; }
  .club-import-result-row > .el-tag { display: none; }
  .club-import-result-row__actions { grid-column: 2 / -1; justify-content: flex-end; }
}
</style>
