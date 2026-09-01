<template>
  <div class="club-detail-page">
    <el-button text class="back-button" @click="router.push('/clubs')">
      <el-icon><ArrowLeft /></el-icon>
      <span>返回社团目录</span>
    </el-button>

    <section v-if="pageError" class="state-panel state-panel--error" role="alert">
      <el-icon><WarningFilled /></el-icon>
      <div>
        <h1>社团页面暂时无法打开</h1>
        <p>{{ pageError }}</p>
      </div>
      <el-button type="primary" class="state-panel__action" @click="loadClub">
        <el-icon><Refresh /></el-icon>
        重试
      </el-button>
    </section>

    <template v-else-if="loading">
      <section class="club-hero club-hero--skeleton" aria-label="正在加载社团信息">
        <el-skeleton animated class="club-hero__skeleton" />
      </section>
      <section class="detail-layout detail-layout--skeleton" aria-label="正在加载公开内容">
        <el-skeleton animated :rows="7" class="profile-skeleton" />
        <div class="goods-grid goods-grid--skeleton">
          <article v-for="index in 4" :key="index" class="goods-card goods-card--skeleton">
            <el-skeleton animated />
          </article>
        </div>
      </section>
    </template>

    <template v-else-if="club">
      <section class="club-hero" aria-labelledby="club-title">
        <div class="club-hero__avatar" role="img" :aria-label="`${club.name}头像`">
          <el-image v-if="club.avatar" :src="club.avatar" :alt="`${club.name}头像`" fit="cover" lazy />
          <el-icon v-else><Shop /></el-icon>
        </div>

        <div class="club-hero__copy">
          <span class="club-hero__eyebrow"><el-icon><Shop /></el-icon><span>社团主页</span></span>
          <h1 id="club-title">{{ club.name }}</h1>
          <p class="club-description">{{ club.description || '这个社团还没有填写简介。' }}</p>
          <p v-if="club.announcement" class="announcement">
            <el-icon><Bell /></el-icon>
            <span>{{ club.announcement }}</span>
          </p>
        </div>

        <div class="club-hero__favorite">
          <span class="favorite-count"><el-icon><StarFilled /></el-icon><strong>{{ club.favorite_count ?? 0 }}</strong><span>人收藏</span></span>
          <el-button
            v-if="!authStore.isClub"
            type="primary"
            plain
            class="favorite-button"
            :loading="favoriteLoading"
            :aria-pressed="club.is_favorited ? 'true' : 'false'"
            @click="toggleFavorite"
          >
            <el-icon><StarFilled /></el-icon>
            <span>{{ club.is_favorited ? '已收藏' : '收藏社团' }}</span>
          </el-button>
        </div>
      </section>

      <section class="detail-layout">
        <aside class="profile-panel" aria-labelledby="profile-title">
          <div class="panel-heading">
            <span class="panel-heading__eyebrow">CONTACT</span>
            <h2 id="profile-title">社团资料</h2>
          </div>

          <dl class="profile-list">
            <div v-if="club.contact_name" class="profile-row">
              <dt><el-icon><User /></el-icon><span>联系人</span></dt>
              <dd>{{ club.contact_name }}</dd>
            </div>
            <div v-if="club.contact_phone" class="profile-row">
              <dt><el-icon><Phone /></el-icon><span>电话</span></dt>
              <dd><a class="profile-link" :href="`tel:${club.contact_phone}`">{{ club.contact_phone }}</a></dd>
            </div>
            <div v-if="club.contact_email" class="profile-row">
              <dt><el-icon><Message /></el-icon><span>邮箱</span></dt>
              <dd><a class="profile-link" :href="`mailto:${club.contact_email}`">{{ club.contact_email }}</a></dd>
            </div>
            <div v-if="club.address" class="profile-row">
              <dt><el-icon><Location /></el-icon><span>地址</span></dt>
              <dd>{{ club.address }}</dd>
            </div>
            <div v-if="club.business_hours" class="profile-row">
              <dt><el-icon><Clock /></el-icon><span>营业时间</span></dt>
              <dd>{{ club.business_hours }}</dd>
            </div>
          </dl>

          <div v-if="platformLinks.length || club.store_links?.length" class="store-links">
            <h3>店铺入口</h3>
            <div class="store-links__list">
              <a
                v-for="platform in platformLinks"
                :key="platform.key"
                class="store-link store-link--platform"
                :href="platform.url"
                target="_blank"
                rel="noreferrer"
                :aria-label="`${platform.label}（在新窗口打开）`"
                :title="`${platform.label}（在新窗口打开）`"
              >
                <img class="store-link__logo" :src="platform.logo" :alt="`${platform.label} logo`" />
                <span class="sr-only">{{ platform.label }}</span>
              </a>
              <a
                v-for="link in club.store_links"
                :key="link.url"
                class="store-link store-link--custom"
                :href="link.url"
                target="_blank"
                rel="noreferrer"
                :aria-label="`${link.label}（在新窗口打开）`"
                :title="`${link.label}（在新窗口打开）`"
              >
                <el-icon aria-hidden="true"><Link /></el-icon>
                <span class="sr-only">{{ link.label }}</span>
              </a>
            </div>
          </div>
          <p v-else class="profile-empty">社团暂未公开更多联系信息。</p>
        </aside>

        <section class="goods-panel" aria-labelledby="goods-title">
          <header class="section-heading">
            <div class="section-heading__title">
              <span class="section-heading__eyebrow">PUBLIC COLLECTION</span>
              <div class="section-heading__line">
                <h2 id="goods-title">社团谷子</h2>
                <span class="section-heading__count">共 {{ total }} 款</span>
              </div>
            </div>

            <div class="goods-toolbar" role="search" aria-label="搜索和筛选社团谷子">
              <el-input
                :model-value="filters.search"
                clearable
                placeholder="搜索名称、IP、角色、品类或主题"
                class="goods-search"
                @update:model-value="updateSearch"
                @keyup.enter="applySearchImmediately"
                @clear="applySearchImmediately"
              >
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>

              <el-button
                class="filter-toggle-button"
                :class="{ 'is-active': activeDetailedFilterCount > 0 }"
                :aria-expanded="isMobile ? mobileFilterVisible : filtersExpanded"
                @click="toggleFilterPanel"
              >
                <el-icon><Filter /></el-icon>
                <span>筛选</span>
                <strong v-if="activeDetailedFilterCount">{{ activeDetailedFilterCount }}</strong>
              </el-button>

              <div v-if="!isMobile" class="goods-sort-group" role="group" aria-label="谷子排序">
                <el-button
                  class="goods-sort-button"
                  :class="{ 'is-active': filters.ordering === 'default' }"
                  :aria-pressed="filters.ordering === 'default'"
                  @click="setOrdering('default')"
                >
                  社团排序
                </el-button>
                <el-button
                  class="goods-sort-button goods-sort-button--direction"
                  :class="{ 'is-active': filters.ordering === 'newest' || filters.ordering === 'oldest' }"
                  :aria-pressed="filters.ordering === 'newest' || filters.ordering === 'oldest'"
                  :aria-label="`上架时间，${filters.ordering === 'oldest' ? '从早到晚' : '从晚到早'}，点击切换方向`"
                  :title="`上架时间：${filters.ordering === 'oldest' ? '从早到晚' : '从晚到早'}`"
                  @click="toggleOrdering('time')"
                >
                  <span>上架时间</span>
                  <el-icon aria-hidden="true">
                    <ArrowUp v-if="filters.ordering === 'oldest'" />
                    <ArrowDown v-else />
                  </el-icon>
                </el-button>
                <el-button
                  class="goods-sort-button goods-sort-button--direction"
                  :class="{ 'is-active': filters.ordering === 'price_asc' || filters.ordering === 'price_desc' }"
                  :aria-pressed="filters.ordering === 'price_asc' || filters.ordering === 'price_desc'"
                  :aria-label="`价格，${filters.ordering === 'price_desc' ? '从高到低' : '从低到高'}，点击切换方向`"
                  :title="`价格：${filters.ordering === 'price_desc' ? '从高到低' : '从低到高'}`"
                  @click="toggleOrdering('price')"
                >
                  <span>价格</span>
                  <el-icon aria-hidden="true">
                    <ArrowUp v-if="filters.ordering === 'price_desc'" />
                    <ArrowDown v-else />
                  </el-icon>
                </el-button>
              </div>

            </div>
          </header>

          <div v-if="activeFilterChips.length" class="active-filter-row" aria-label="当前筛选条件">
            <el-tag
              v-for="chip in activeFilterChips"
              :key="chip.key"
              closable
              effect="plain"
              @close="removeFilter(chip.key)"
            >
              {{ chip.label }}
            </el-tag>
            <el-button text type="primary" class="clear-filter-link" @click="clearGoodsFilters">清除全部</el-button>
          </div>

          <transition name="filter-collapse">
            <div v-if="!isMobile && filtersExpanded" class="filter-collapse-wrapper">
              <section class="desktop-filter-panel" aria-label="详细筛选">
                <div v-if="facetsLoading" class="filter-loading" aria-label="正在加载筛选选项">
                  <el-skeleton animated :rows="2" />
                </div>
                <div v-else-if="facetsError" class="filter-error" role="alert">
                  <span>{{ facetsError }}</span>
                  <el-button text type="primary" @click="retryFacets">重试</el-button>
                </div>
                <ClubPublicGoodsFilterPanel
                  v-else
                  :model-value="filters"
                  :facets="facets"
                  :show-imported="canFilterImported"
                  @update:model-value="filters = $event"
                  @change="applyDesktopFilters"
                  @price-change="schedulePriceFilter"
                  @price-commit="commitPriceFilter"
                />
              </section>
            </div>
          </transition>

          <div v-if="goodsError" class="state-panel state-panel--compact" role="alert">
            <el-icon><WarningFilled /></el-icon>
            <span>{{ goodsError }}</span>
            <el-button text type="primary" @click="loadGoods">重试</el-button>
          </div>

          <div v-else-if="goodsLoading" class="goods-grid goods-grid--skeleton" aria-label="正在加载谷子">
            <article v-for="index in 4" :key="index" class="goods-card goods-card--skeleton">
              <el-skeleton animated />
            </article>
          </div>

          <div v-else class="goods-grid" aria-live="polite">
            <article
              v-for="item in goodsItems"
              :key="item.id"
              class="goods-card"
            >
              <button
                type="button"
                class="goods-card__detail-trigger"
                :aria-label="goodsAriaLabel(item)"
                @click="openGoodsDetail(item)"
              ></button>
              <div class="goods-card__media">
                <span v-if="canFilterImported && item.is_imported" class="goods-card__imported">
                  已导入<span v-if="item.imported_quantity"> · {{ item.imported_quantity }} 件</span>
                </span>
                <el-image
                  v-if="item.main_photo"
                  :src="item.main_photo"
                  :alt="`${item.name}图片`"
                  fit="cover"
                  lazy
                  class="goods-card__image"
                />
                <div v-else class="goods-card__image goods-card__image--placeholder" aria-label="暂无图片">
                  <el-icon><Picture /></el-icon>
                </div>
              </div>

              <div class="goods-card__body">
                <h3 :title="item.name">{{ item.name }}</h3>
                <p class="goods-card__meta">
                  <span>{{ item.ip?.name || '未标注 IP' }}</span>
                  <span class="goods-card__meta-separator">·</span>
                  <span>{{ item.category?.name || '未分类' }}</span>
                </p>
                <p v-if="item.characters?.length" class="goods-card__characters" :title="item.characters.map(character => character.name).join('、')">
                  {{ characterSummary(item) }}
                </p>
                <div v-if="item.theme || item.public_price !== null && item.public_price !== undefined" class="goods-card__facts">
                  <span v-if="item.theme" class="goods-card__theme" :title="item.theme.name">{{ item.theme.name }}</span>
                  <strong v-if="item.public_price !== null && item.public_price !== undefined" class="goods-card__price">¥{{ item.public_price }}</strong>
                </div>
                <div class="goods-card__footer">
                  <el-tag size="small" effect="plain" type="success">已上架</el-tag>
                  <el-button
                    v-if="!authStore.isClub"
                    type="primary"
                    size="small"
                    class="import-button club-import-button brand-add-btn"
                    @click.stop="importGoods(item)"
                  >
                    <span class="brand-add-btn__content">
                      <el-icon><Plus /></el-icon>
                      <span>加入谷仓</span>
                    </span>
                  </el-button>
                </div>
              </div>
            </article>
          </div>

          <el-empty
            v-if="!goodsLoading && !goodsError && goodsItems.length === 0"
            class="goods-empty"
            :description="hasGoodsFilters ? '没有找到匹配的公开谷子' : '这个社团还没有公开谷子'"
          >
            <el-button v-if="hasGoodsFilters" text type="primary" @click="clearGoodsFilters">清除筛选</el-button>
          </el-empty>

          <el-pagination
            v-if="total > pageSize"
            v-model:current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="prev, pager, next"
            @current-change="changePage"
          />
        </section>
      </section>
    </template>

    <el-drawer
      v-model="mobileFilterVisible"
      direction="btt"
      size="min(82vh, 680px)"
      class="mobile-filter-drawer"
      :with-header="false"
      :close-on-click-modal="true"
    >
      <section class="mobile-filter-sheet" aria-label="筛选社团谷子">
        <header class="mobile-filter-sheet__header">
          <div>
            <span>FILTER GOODS</span>
            <h2>筛选社团谷子</h2>
          </div>
          <el-button text circle aria-label="关闭筛选" @click="mobileFilterVisible = false">
            <el-icon><Close /></el-icon>
          </el-button>
        </header>

        <div class="mobile-filter-sheet__body">
          <label class="mobile-ordering-field">
            <span>排序方式</span>
            <el-select v-model="mobileDraftFilters.ordering" aria-label="移动端谷子排序">
              <el-option label="社团排序" value="default" />
              <el-option label="最新上架" value="newest" />
              <el-option label="最早上架" value="oldest" />
              <el-option label="价格从低到高" value="price_asc" />
              <el-option label="价格从高到低" value="price_desc" />
            </el-select>
          </label>

          <div v-if="facetsLoading" class="filter-loading" aria-label="正在加载筛选选项">
            <el-skeleton animated :rows="5" />
          </div>
          <div v-else-if="facetsError" class="filter-error" role="alert">
            <span>{{ facetsError }}</span>
            <el-button text type="primary" @click="retryFacets">重试</el-button>
          </div>
          <ClubPublicGoodsFilterPanel
            v-else
            v-model="mobileDraftFilters"
            :facets="facets"
            :show-imported="canFilterImported"
          />
        </div>

        <footer class="mobile-filter-sheet__footer">
          <el-button @click="resetMobileDraft">重置</el-button>
          <el-button type="primary" @click="applyMobileFilters">应用筛选</el-button>
        </footer>
      </section>
    </el-drawer>

    <el-dialog
      v-model="importVisible"
      title="加入我的谷仓"
      width="420px"
      class="club-dialog import-dialog"
      :close-on-click-modal="false"
    >
      <div class="import-dialog__intro">
        <el-image
          v-if="selected?.main_photo"
          :src="selected.main_photo"
          :alt="`${selected.name || '社团谷子'}图片`"
          fit="cover"
          class="import-dialog__image"
        />
        <span v-else class="import-dialog__icon"><el-icon><Plus /></el-icon></span>
        <div>
          <strong>{{ selected?.name || '社团谷子' }}</strong>
          <p>接下来会打开个人库存表单~ 社团公开信息已经帮你预先填好啦</p>
        </div>
      </div>

      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" class="dialog-primary-button club-import-button brand-add-btn" @click="confirmImport">
          <span class="brand-add-btn__content"><el-icon><Plus /></el-icon><span>确认加入</span></span>
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="detailVisible"
      :title="selectedDetail?.name || '谷子详情'"
      width="min(720px, 92vw)"
      class="club-dialog detail-dialog"
    >
      <div v-loading="detailLoading" class="goods-detail-dialog">
        <template v-if="selectedDetail">
          <div class="goods-detail-dialog__visual">
            <div class="goods-detail-dialog__media">
              <el-image
                v-if="activeDetailImage"
                :src="activeDetailImage"
                :alt="`${selectedDetail.name}图片`"
                fit="contain"
                class="goods-detail-dialog__image"
                :preview-src-list="detailPhotoUrls"
                :initial-index="Math.max(0, detailPhotoUrls.indexOf(activeDetailImage))"
              />
              <div v-else class="goods-detail-dialog__placeholder" aria-label="暂无图片">
                <el-icon><Picture /></el-icon>
                <span>暂无图片</span>
              </div>
            </div>
            <div v-if="detailPhotoUrls.length" class="goods-detail-dialog__photos" aria-label="图片预览">
              <button
                v-for="(photoUrl, index) in detailPhotoUrls"
                :key="photoUrl"
                type="button"
                class="goods-detail-dialog__photo-button"
                :class="{ 'is-active': photoUrl === activeDetailImage }"
                :aria-label="`${selectedDetail.name}图片 ${index + 1}`"
                @click="selectDetailImage(photoUrl)"
              >
                <el-image
                  :src="photoUrl"
                  :alt="`${selectedDetail.name}图片 ${index + 1}`"
                  fit="cover"
                  class="goods-detail-dialog__photo"
                />
              </button>
            </div>
          </div>
          <div class="goods-detail-dialog__content">
            <div class="goods-detail-dialog__headline">
              <span class="goods-detail-dialog__eyebrow">公开目录条目</span>
            </div>
            <div class="goods-detail-dialog__tags">
              <el-tag type="success" effect="plain">已上架</el-tag>
              <el-tag effect="plain" type="info">社团公开</el-tag>
            </div>
            <dl>
              <dt>IP作品</dt>
              <dd>{{ selectedDetail.ip?.name || '—' }}</dd>
              <dt>品类</dt>
              <dd :title="selectedDetail.category?.path_name || selectedDetail.category?.name">
                {{ selectedDetail.category?.path_name || selectedDetail.category?.name || '—' }}
              </dd>
              <template v-if="selectedDetail.theme">
                <dt>主题</dt>
                <dd :title="selectedDetail.theme.name">{{ selectedDetail.theme.name }}</dd>
              </template>
              <template v-if="selectedDetail.characters?.length">
                <dt>角色</dt>
                <dd class="goods-detail-dialog__character-list">
                  <span v-for="character in selectedDetail.characters" :key="character.id" class="goods-detail-dialog__character">
                    {{ character.name }}
                  </span>
                </dd>
              </template>
              <template v-if="selectedDetail.public_price !== null && selectedDetail.public_price !== undefined">
                <dt>公开价格</dt>
                <dd class="goods-detail-dialog__price">¥{{ selectedDetail.public_price }}</dd>
              </template>
              <dt>发布社团</dt>
              <dd>{{ club?.name || '—' }}</dd>
            </dl>
            <div v-if="selectedDetail.description" class="goods-detail-dialog__notes">
              <span>公开说明</span>
              <p>{{ selectedDetail.description }}</p>
            </div>
          </div>
        </template>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="selectedDetail && !authStore.isClub" type="primary" class="dialog-primary-button club-import-button brand-add-btn" @click="importGoods(selectedDetail)">
          <span class="brand-add-btn__content"><el-icon><Plus /></el-icon><span>加入谷仓</span></span>
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bell,
  Clock,
  Close,
  Filter,
  Link,
  Location,
  Message,
  Phone,
  Picture,
  Plus,
  Refresh,
  Search,
  Shop,
  StarFilled,
  User,
  WarningFilled,
} from '@element-plus/icons-vue'
import {
  favoriteClub,
  getClub,
  getClubGoods,
  getClubGoodsDetail,
  getClubGoodsFacets,
  unfavoriteClub,
} from '@/api/clubs'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { useAuthStore } from '@/stores/auth'
import ClubPublicGoodsFilterPanel from '@/views/club/ClubPublicGoodsFilterPanel.vue'
import {
  clubGoodsFilterCount,
  clubGoodsFiltersToApi,
  clubGoodsFiltersToQuery,
  createDefaultClubGoodsFilters,
  normalizeClubGoodsFilters,
  parseClubGoodsFilters,
} from '@/views/club/clubPublicGoodsFilters'
import type { ClubPublicGoodsFilterState } from '@/views/club/clubPublicGoodsFilters'
import type {
  Club,
  ClubGoodsFacets,
  ClubGoodsDetail,
  ClubGoodsListItem,
  ClubGoodsOrdering,
} from '@/api/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isMobile } = useResponsiveDevice()

const club = ref<Club | null>(null)
const goodsItems = ref<ClubGoodsListItem[]>([])
const loading = ref(false)
const pageError = ref('')
const goodsLoading = ref(false)
const goodsError = ref('')
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filters = ref<ClubPublicGoodsFilterState>(parseClubGoodsFilters(route.query))
const mobileDraftFilters = ref<ClubPublicGoodsFilterState>({ ...filters.value })
const filtersExpanded = ref(false)
const mobileFilterVisible = ref(false)
const facets = ref<ClubGoodsFacets>({
  ips: [],
  characters: [],
  categories: [],
  themes: [],
  price_bounds: { min: null, max: null },
})
const facetsLoading = ref(false)
const facetsError = ref('')
const facetsReady = ref(false)
const importVisible = ref(false)
const selected = ref<ClubGoodsListItem | null>(null)
const detailVisible = ref(false)
const detailLoading = ref(false)
const selectedDetail = ref<ClubGoodsDetail | null>(null)
const selectedDetailImage = ref<string | null>(null)
const favoriteLoading = ref(false)

type PlatformKey = 'taobao_url' | 'xiaohongshu_url' | 'weidian_url'
const platformLinkDefinitions: Array<{ key: PlatformKey; label: string; logo: string }> = [
  { key: 'taobao_url', label: '淘宝', logo: '/brand/taobao.png' },
  { key: 'xiaohongshu_url', label: '小红书', logo: '/brand/xiaohongshu.png' },
  { key: 'weidian_url', label: '微店', logo: '/brand/weidian.png' },
]

let goodsRequestSequence = 0
let clubRequestSequence = 0
let detailRequestSequence = 0
let facetsRequestSequence = 0
let searchTimer: number | undefined
let priceTimer: number | undefined
let lastWrittenRouteKey = ''
let lastLoadedFiltersKey = ''

const canFilterImported = computed(() => authStore.isAuthenticated && authStore.isCollector)
const activeDetailedFilterCount = computed(() => clubGoodsFilterCount(filters.value))
const hasGoodsFilters = computed(() => Boolean(filters.value.search.trim()) || activeDetailedFilterCount.value > 0)
const platformLinks = computed(() => platformLinkDefinitions
  .map(platform => ({ ...platform, url: club.value?.[platform.key]?.trim() || null }))
  .filter((platform): platform is typeof platform & { url: string } => Boolean(platform.url)))
const detailPhotoUrls = computed(() => {
  if (!selectedDetail.value) return []
  return [
    ...(selectedDetail.value.main_photo ? [selectedDetail.value.main_photo] : []),
    ...selectedDetail.value.additional_photos.map(photo => photo.image),
  ]
})
const activeDetailImage = computed(() => selectedDetailImage.value || detailPhotoUrls.value[0] || null)
const activeFilterChips = computed(() => {
  const value = filters.value
  const chips: Array<{ key: string; label: string }> = []
  if (value.search) chips.push({ key: 'search', label: `搜索：${value.search}` })
  const ip = facets.value.ips.find(option => option.id === value.ip)
  if (ip) chips.push({ key: 'ip', label: `IP：${ip.name}` })
  const character = facets.value.characters.find(option => option.id === value.character)
  if (character) chips.push({ key: 'character', label: `角色：${character.name}` })
  const category = facets.value.categories.find(option => option.id === value.category)
  if (category) chips.push({ key: 'category', label: `品类：${category.path_name}` })
  const theme = facets.value.themes.find(option => option.id === value.theme)
  if (theme) chips.push({ key: 'theme', label: `主题：${theme.name}` })
  if (value.price_min || value.price_max) {
    chips.push({
      key: 'price',
      label: `价格：${value.price_min || '0'} - ${value.price_max || '不限'}`,
    })
  }
  if (value.imported !== 'all' && canFilterImported.value) {
    chips.push({ key: 'imported', label: value.imported === 'imported' ? '已导入' : '未导入' })
  }
  return chips
})

function selectDetailImage(url: string) {
  selectedDetailImage.value = url
}

function currentClubId() {
  const id = Number(route.params.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

function routePage(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : 1
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

function routeQueryKey(query?: Record<string, unknown>) {
  const source = query || {}
  return Object.keys(source)
    .sort()
    .map((key) => {
      const value = source[key]
      return `${key}=${Array.isArray(value) ? value.join(',') : value ?? ''}`
    })
    .join('&')
}

function goodsAriaLabel(item: ClubGoodsListItem) {
  return `${item.name}，查看详情`
}

function characterSummary(item: ClubGoodsListItem) {
  const names = item.characters.map(character => character.name)
  return names.length > 2 ? `${names.slice(0, 2).join('、')} +${names.length - 2}` : names.join('、')
}

function clearInteractionTimers() {
  if (searchTimer) window.clearTimeout(searchTimer)
  if (priceTimer) window.clearTimeout(priceTimer)
  searchTimer = undefined
  priceTimer = undefined
}

function validPriceRange(value: ClubPublicGoodsFilterState) {
  if (!value.price_min || !value.price_max) return true
  if (Number(value.price_min) <= Number(value.price_max)) return true
  ElMessage.warning('最高价不能低于最低价')
  return false
}

function filterStateKey(value: ClubPublicGoodsFilterState) {
  return JSON.stringify({
    ...value,
    search: value.search.trim(),
  })
}

async function syncFiltersToRoute() {
  const query = clubGoodsFiltersToQuery(filters.value, page.value)
  const targetKey = routeQueryKey(query)
  lastWrittenRouteKey = targetKey
  if (targetKey === routeQueryKey(route.query)) return
  await router.replace({
    name: 'ClubDetail',
    params: { id: route.params.id },
    query,
  })
}

async function loadFacets(id = currentClubId()) {
  if (!id) return false
  const sequence = ++facetsRequestSequence
  facetsLoading.value = true
  facetsError.value = ''
  try {
    const result = await getClubGoodsFacets(id)
    if (sequence !== facetsRequestSequence) return false
    facets.value = result
    facetsReady.value = true
    return true
  } catch (error: any) {
    if (sequence !== facetsRequestSequence) return false
    facetsReady.value = false
    facetsError.value = error?.response?.data?.detail || error?.message || '筛选选项加载失败，请重试。'
    return false
  } finally {
    if (sequence === facetsRequestSequence) facetsLoading.value = false
  }
}

async function toggleFavorite() {
  if (!club.value || favoriteLoading.value) return
  if (!authStore.isAuthenticated) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  favoriteLoading.value = true
  const wasFavorited = Boolean(club.value.is_favorited)
  try {
    const result = wasFavorited ? await unfavoriteClub(club.value.id) : await favoriteClub(club.value.id)
    club.value = { ...club.value, ...result, is_favorited: !wasFavorited }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || error?.message || '收藏操作失败')
  } finally {
    favoriteLoading.value = false
  }
}

async function loadGoods() {
  const id = currentClubId()
  if (!id) return
  const sequence = ++goodsRequestSequence
  const requestFilters = { ...filters.value }
  const requestFiltersKey = filterStateKey(requestFilters)
  const requestPage = page.value
  goodsLoading.value = true
  goodsError.value = ''
  try {
    const result = await getClubGoods(id, clubGoodsFiltersToApi(requestFilters, requestPage, pageSize))
    if (sequence !== goodsRequestSequence) return
    goodsItems.value = result.results
    total.value = result.count
    lastLoadedFiltersKey = requestFiltersKey
  } catch (error: any) {
    if (sequence !== goodsRequestSequence) return
    goodsError.value = error?.response?.data?.detail || error?.message || '公开谷子加载失败，请重试。'
  } finally {
    if (sequence === goodsRequestSequence) goodsLoading.value = false
  }
}

async function loadClub() {
  const id = currentClubId()
  if (!id) {
    pageError.value = '社团地址无效。'
    return
  }
  const sequence = ++clubRequestSequence
  loading.value = true
  pageError.value = ''
  goodsError.value = ''
  filters.value = parseClubGoodsFilters(route.query)
  page.value = routePage(route.query?.page)
  try {
    const [result] = await Promise.all([getClub(id), loadFacets(id)])
    if (sequence !== clubRequestSequence) return
    club.value = result
    if (facetsReady.value) {
      filters.value = normalizeClubGoodsFilters(filters.value, facets.value, canFilterImported.value)
    } else if (!canFilterImported.value) {
      filters.value = { ...filters.value, imported: 'all' }
    }
    mobileDraftFilters.value = { ...filters.value }
    await syncFiltersToRoute()
    await loadGoods()
  } catch (error: any) {
    if (sequence !== clubRequestSequence) return
    club.value = null
    pageError.value = error?.response?.data?.detail || error?.message || '社团不存在或已下线。'
  } finally {
    if (sequence === clubRequestSequence) loading.value = false
  }
}

async function applyFilters(value: ClubPublicGoodsFilterState, resetPage = true) {
  if (!validPriceRange(value)) return false
  const next = { ...value, search: value.search.trim() }
  filters.value = next
  mobileDraftFilters.value = { ...filters.value }
  if (filterStateKey(next) === lastLoadedFiltersKey) return true
  if (resetPage) page.value = 1
  await syncFiltersToRoute()
  await loadGoods()
  return true
}

function clearGoodsFilters() {
  clearInteractionTimers()
  void applyFilters(createDefaultClubGoodsFilters())
}

function updateSearch(value: unknown) {
  filters.value = { ...filters.value, search: typeof value === 'string' ? value : '' }
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    searchTimer = undefined
    void applyFilters(filters.value)
  }, 300)
}

function applySearchImmediately() {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = undefined
  void applyFilters(filters.value)
}

function applyDesktopFilters(value: ClubPublicGoodsFilterState) {
  clearInteractionTimers()
  void applyFilters(value)
}

function schedulePriceFilter(value: ClubPublicGoodsFilterState) {
  filters.value = value
  if (priceTimer) window.clearTimeout(priceTimer)
  priceTimer = window.setTimeout(() => {
    priceTimer = undefined
    void applyFilters(value)
  }, 350)
}

function commitPriceFilter(value: ClubPublicGoodsFilterState) {
  if (priceTimer) window.clearTimeout(priceTimer)
  priceTimer = undefined
  void applyFilters(value)
}

function updateOrdering(value: unknown) {
  const allowed: ClubGoodsOrdering[] = ['default', 'newest', 'oldest', 'price_asc', 'price_desc']
  const ordering = allowed.includes(value as ClubGoodsOrdering) ? value as ClubGoodsOrdering : 'default'
  void applyFilters({ ...filters.value, ordering })
}

function setOrdering(ordering: ClubGoodsOrdering) {
  void applyFilters({ ...filters.value, ordering })
}

function toggleOrdering(type: 'time' | 'price') {
  const ordering: ClubGoodsOrdering = type === 'time'
    ? filters.value.ordering === 'newest' ? 'oldest' : 'newest'
    : filters.value.ordering === 'price_asc' ? 'price_desc' : 'price_asc'
  void applyFilters({ ...filters.value, ordering })
}

function toggleFilterPanel() {
  if (isMobile.value) {
    mobileDraftFilters.value = { ...filters.value }
    mobileFilterVisible.value = true
    return
  }
  filtersExpanded.value = !filtersExpanded.value
}

function resetMobileDraft() {
  mobileDraftFilters.value = {
    ...createDefaultClubGoodsFilters(),
    search: filters.value.search,
  }
}

async function applyMobileFilters() {
  if (!validPriceRange(mobileDraftFilters.value)) return
  mobileFilterVisible.value = false
  await applyFilters(mobileDraftFilters.value)
}

async function retryFacets() {
  const loaded = await loadFacets()
  if (!loaded) return
  const normalized = normalizeClubGoodsFilters(filters.value, facets.value, canFilterImported.value)
  if (JSON.stringify(normalized) !== JSON.stringify(filters.value)) {
    await applyFilters(normalized)
  } else {
    mobileDraftFilters.value = { ...filters.value }
  }
}

function removeFilter(key: string) {
  const next = { ...filters.value }
  if (key === 'search') next.search = ''
  if (key === 'ip') {
    next.ip = undefined
    next.character = undefined
  }
  if (key === 'character') next.character = undefined
  if (key === 'category') next.category = undefined
  if (key === 'theme') next.theme = undefined
  if (key === 'price') {
    next.price_min = ''
    next.price_max = ''
  }
  if (key === 'imported') next.imported = 'all'
  void applyFilters(next)
}

async function changePage(nextPage: number) {
  page.value = nextPage
  await syncFiltersToRoute()
  await loadGoods()
}

async function openGoodsDetail(item: ClubGoodsListItem) {
  const clubId = currentClubId()
  if (!clubId) return
  const sequence = ++detailRequestSequence
  detailVisible.value = true
  detailLoading.value = true
  selectedDetail.value = null
  selectedDetailImage.value = null
  favoriteLoading.value = false
  try {
    const result = await getClubGoodsDetail(clubId, item.id)
    if (sequence !== detailRequestSequence) return
    selectedDetail.value = result
    selectedDetailImage.value = result.main_photo || result.additional_photos[0]?.image || null
  } catch (error: any) {
    if (sequence !== detailRequestSequence) return
    detailVisible.value = false
    ElMessage.error(error?.response?.data?.detail || '加载谷子详情失败')
  } finally {
    if (sequence === detailRequestSequence) detailLoading.value = false
  }
}

function importGoods(item: ClubGoodsListItem | ClubGoodsDetail) {
  detailVisible.value = false
  selected.value = item
  if (!authStore.isAuthenticated) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  importVisible.value = true
}

function confirmImport() {
  if (!selected.value) return
  if (!authStore.isAuthenticated) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  importVisible.value = false
  router.push({ name: 'GoodsNew', query: { club_id: String(route.params.id), club_goods_id: selected.value.id } })
}

watch(() => route.params.id, () => {
  clearInteractionTimers()
  goodsRequestSequence += 1
  detailRequestSequence += 1
  facetsRequestSequence += 1
  filters.value = parseClubGoodsFilters(route.query)
  mobileDraftFilters.value = { ...filters.value }
  goodsItems.value = []
  total.value = 0
  importVisible.value = false
  detailVisible.value = false
  selected.value = null
  selectedDetail.value = null
  selectedDetailImage.value = null
  void loadClub()
})

watch(() => route.query, (query) => {
  if (!club.value) return
  const key = routeQueryKey(query)
  if (key === lastWrittenRouteKey) return
  lastWrittenRouteKey = key
  let next = parseClubGoodsFilters(query)
  if (facetsReady.value) {
    next = normalizeClubGoodsFilters(next, facets.value, canFilterImported.value)
  }
  filters.value = next
  mobileDraftFilters.value = { ...next }
  page.value = routePage(query?.page)
  void loadGoods()
}, { deep: true })

onMounted(() => {
  void loadClub()
})

onUnmounted(() => {
  clearInteractionTimers()
  goodsRequestSequence += 1
  detailRequestSequence += 1
  facetsRequestSequence += 1
})
</script>

<style scoped>
.club-detail-page {
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 24px 24px 64px;
  color: var(--text-dark);
}

.back-button {
  min-height: 36px;
  margin-bottom: 16px;
  padding: 0 10px;
  border-radius: var(--button-radius);
  color: var(--text-regular);
  transition: color var(--transition-fast), background-color var(--transition-fast), transform var(--transition-fast);
}

.back-button:hover,
.back-button:focus-visible {
  color: var(--primary-gold-dark);
  background: rgba(212, 175, 55, 0.1);
}

.back-button:active {
  transform: translateX(-2px);
}

.club-hero {
  position: relative;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  overflow: hidden;
  padding: 22px 24px;
  border: 1px solid rgba(212, 175, 55, 0.36);
  border-radius: var(--card-radius);
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.98), rgba(245, 245, 247, 0.94)),
    var(--bg-white);
  box-shadow: var(--shadow-md), 0 14px 34px rgba(31, 41, 55, 0.035), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.club-hero::before {
  position: absolute;
  top: 0;
  right: 12%;
  left: 12%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.72), rgba(162, 155, 254, 0.5), transparent);
  content: '';
}

.club-hero__avatar {
  display: grid;
  flex: none;
  width: 96px;
  height: 96px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.25);
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(162, 155, 254, 0.12)),
    var(--secondary-gray-dark);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82), var(--shadow-sm);
  color: var(--accent-purple-dark);
  font-size: 32px;
}

.club-hero__avatar .el-image,
.club-hero__avatar :deep(.el-image__inner) {
  width: 100%;
  height: 100%;
}

.club-hero__copy {
  min-width: 0;
}

.club-hero__favorite {
  display: grid;
  min-width: 118px;
  justify-items: end;
  gap: 10px;
  align-self: center;
}

.favorite-count {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  color: var(--text-light);
  font-size: var(--font-caption);
  white-space: nowrap;
}

.favorite-count .el-icon { color: var(--primary-gold-dark); }
.favorite-count strong { color: var(--text-dark); font-size: 20px; line-height: 1; }

.favorite-button {
  min-height: 34px;
  margin: 0;
  border-radius: var(--button-radius);
  border-color: rgba(212, 175, 55, 0.55);
  color: var(--primary-gold-dark);
  transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease;
}

.favorite-button:hover,
.favorite-button:focus-visible {
  border-color: var(--primary-gold-dark);
  color: #fff;
  background: var(--primary-gold-dark);
  box-shadow: 0 6px 16px rgba(184, 148, 31, 0.32);
}

.favorite-button[aria-pressed='true'] {
  border-color: var(--primary-gold-dark);
  color: #fff;
  background: var(--primary-gold-dark);
}

.favorite-button[aria-pressed='true']:hover,
.favorite-button[aria-pressed='true']:focus-visible {
  border-color: #9a7b16;
  background: #9a7b16;
}

.club-hero__eyebrow,
.section-heading__eyebrow,
.panel-heading__eyebrow {
  display: block;
  margin-bottom: 6px;
  color: var(--primary-gold-dark);
  font-size: var(--font-small);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0;
}

.club-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 8px;
  padding: 4px 8px;
  border: 1px solid rgba(212, 175, 55, 0.24);
  border-radius: 999px;
  background: rgba(255, 252, 240, 0.76);
}

.club-hero__eyebrow .el-icon {
  font-size: 12px;
}

.club-hero h1 {
  margin: 0;
  color: var(--text-dark);
  font-size: 28px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.club-description {
  max-width: 72ch;
  margin: 8px 0 0;
  color: var(--text-regular);
  font-size: var(--font-body);
  line-height: 1.6;
}

.announcement {
  display: inline-flex;
  align-items: flex-start;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  box-sizing: border-box;
  margin: 12px 0 0;
  padding: 8px 12px;
  border: 1px solid rgba(212, 175, 55, 0.18);
  border-left: 3px solid var(--primary-gold);
  border-radius: var(--button-radius);
  background: rgba(212, 175, 55, 0.1);
  color: #7d651f;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.announcement .el-icon {
  flex: none;
  margin-top: 2px;
  color: var(--primary-gold-dark);
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(220px, 250px) minmax(0, 1fr);
  gap: 24px;
  margin-top: 24px;
}

.profile-panel,
.goods-panel {
  min-width: 0;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: var(--card-radius-sm);
  background: var(--bg-white);
  box-shadow: var(--shadow-sm), 0 10px 26px rgba(31, 41, 55, 0.028), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.profile-panel {
  align-self: start;
  padding: 20px;
}

.goods-panel {
  padding: 20px;
}

.panel-heading h2,
.section-heading h2 {
  margin: 0;
  color: var(--text-dark);
  font-size: var(--font-section);
  line-height: 1.35;
}

.profile-list {
  display: grid;
  gap: 13px;
  margin: 20px 0 0;
}

.profile-row {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  font-size: var(--font-caption);
  line-height: 1.45;
}

.profile-row dt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-light);
  white-space: nowrap;
}

.profile-row dt .el-icon {
  color: var(--primary-gold-dark);
}

.profile-row dd {
  min-width: 0;
  margin: 0;
  color: var(--text-regular);
  overflow-wrap: anywhere;
}

.profile-link {
  color: inherit;
  text-decoration: none;
  transition: color var(--transition-fast), text-decoration-color var(--transition-fast);
}

.profile-link:hover,
.profile-link:focus-visible {
  color: var(--accent-purple-dark);
  text-decoration: underline;
  text-decoration-color: rgba(162, 155, 254, 0.6);
  text-underline-offset: 3px;
}

.store-links {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid rgba(212, 175, 55, 0.16);
}

.store-links h3 {
  margin: 0 0 2px;
  color: var(--text-light);
  font-size: var(--font-small);
  font-weight: 600;
}

.store-links__list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.store-link {
  display: inline-flex;
  width: 42px;
  height: 42px;
  min-width: 0;
  align-items: center;
  justify-content: center;
  padding: 7px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--accent-purple-dark);
  font-size: var(--font-caption);
  transition: transform var(--transition-fast);
}

.store-link__logo {
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 6px;
  object-fit: cover;
}

.store-link--custom .el-icon {
  font-size: 18px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.store-link:hover,
.store-link:focus-visible {
  transform: translateY(-1px);
}

.store-link:focus-visible {
  outline: 2px solid var(--accent-purple);
  outline-offset: 3px;
}

.profile-empty {
  margin: 20px 0 0;
  padding-top: 16px;
  border-top: 1px solid rgba(212, 175, 55, 0.16);
  color: var(--text-light);
  font-size: var(--font-caption);
  line-height: 1.5;
}

.section-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(430px, 620px);
  align-items: center;
  gap: 18px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.16);
}

.section-heading__title {
  min-width: 0;
}

.section-heading__line {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.section-heading__count {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  padding: 3px 9px;
  border: 1px solid rgba(162, 155, 254, 0.28);
  border-radius: var(--button-radius);
  background: rgba(246, 244, 255, 0.72);
  color: var(--accent-purple-dark);
  font-size: var(--font-caption);
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.goods-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.goods-search {
  flex: 1 1 250px;
  width: auto;
  min-width: 0;
}

.goods-toolbar :deep(.el-input__wrapper) {
  min-height: 36px;
  border-radius: var(--button-radius);
  box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.18) inset, var(--shadow-sm);
  transition: box-shadow var(--transition-fast), background-color var(--transition-fast);
}

.goods-toolbar :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.42) inset, var(--shadow-sm);
}

.goods-sort-group {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
}

.goods-sort-button {
  --sort-accent: var(--primary-gold-dark);
  --sort-accent-soft: #fff9eb;
  min-height: 36px;
  margin: 0;
  padding: 0 11px;
  border-radius: var(--button-radius);
  border-color: rgba(100, 116, 139, 0.28);
  color: var(--text-regular);
  background: rgba(248, 250, 252, 0.9);
  white-space: nowrap;
  transition: border-color var(--transition-fast), background-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}

.goods-sort-button:hover,
.goods-sort-button:focus-visible {
  border-color: rgba(184, 148, 31, 0.58);
  color: var(--sort-accent);
  background: var(--sort-accent-soft);
}

.goods-sort-button.is-active {
  border-color: var(--sort-accent);
  color: var(--sort-accent);
  background: var(--sort-accent-soft);
  box-shadow: 0 0 0 2px rgba(184, 148, 31, 0.12);
}

.goods-sort-button--direction {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.goods-sort-button--direction :deep(.el-icon) {
  font-size: 14px;
}

.filter-toggle-button {
  min-height: 36px;
  border-radius: var(--button-radius);
  border-color: rgba(162, 155, 254, 0.34);
  color: var(--accent-purple-dark);
  background: rgba(246, 244, 255, 0.7);
}

.filter-toggle-button.is-active {
  border-color: var(--accent-purple);
  background: var(--accent-purple-soft);
  box-shadow: 0 0 0 2px rgba(162, 155, 254, 0.1);
}

.filter-toggle-button strong {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  padding: 0 5px;
  border-radius: 10px;
  background: var(--accent-purple);
  color: #fff;
  font-size: 11px;
}

.active-filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: -4px 0 16px;
}

.active-filter-row :deep(.el-tag) {
  max-width: min(100%, 260px);
  border-color: rgba(162, 155, 254, 0.3);
  background: var(--accent-purple-soft);
  color: var(--accent-purple-dark);
}

.clear-filter-link {
  margin-left: auto;
}

.desktop-filter-panel {
  padding: 16px;
  border-top: 1px solid rgba(212, 175, 55, 0.14);
  border-bottom: 1px solid rgba(212, 175, 55, 0.14);
  background: rgba(250, 249, 246, 0.72);
}

/* 与谷仓筛选面板保持一致：用网格行高控制展开高度，并叠加轻微缩放。 */
.filter-collapse-wrapper {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  margin: -4px 0 20px;
  overflow: hidden;
}

.filter-collapse-wrapper > .desktop-filter-panel {
  min-height: 0;
  transform-origin: top center;
  will-change: transform;
}

.filter-loading {
  min-height: 92px;
}

.filter-error {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #8f4545;
  font-size: var(--font-caption);
}

.filter-collapse-enter-active,
.filter-collapse-leave-active {
  overflow: hidden;
  transition: grid-template-rows 0.3s ease, margin-bottom 0.3s ease, opacity 0.3s ease;
}

.filter-collapse-enter-active > .desktop-filter-panel,
.filter-collapse-leave-active > .desktop-filter-panel {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.filter-collapse-enter-from,
.filter-collapse-leave-to {
  grid-template-rows: minmax(0, 0fr);
  margin-bottom: 4px;
  opacity: 0;
}

.filter-collapse-enter-from > .desktop-filter-panel,
.filter-collapse-leave-to > .desktop-filter-panel {
  transform: translateY(-6px) scale(0.98);
}

.filter-collapse-enter-to,
.filter-collapse-leave-from {
  grid-template-rows: minmax(0, 1fr);
  margin-bottom: 20px;
  opacity: 1;
}

.filter-collapse-enter-to > .desktop-filter-panel,
.filter-collapse-leave-from > .desktop-filter-panel {
  transform: translateY(0) scale(1);
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  min-height: 120px;
}

@media (min-width: 1360px) {
  .goods-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.goods-card {
  position: relative;
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.24);
  border-radius: var(--card-radius-sm);
  outline: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(250, 249, 246, 0.96));
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: transform var(--transition-normal), border-color var(--transition-normal), box-shadow var(--transition-normal);
}

.goods-card:hover {
  border-color: rgba(212, 175, 55, 0.62);
  box-shadow: var(--shadow-md), 0 0 0 3px rgba(212, 175, 55, 0.08);
  transform: translateY(-3px);
}

.goods-card:focus-within {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px rgba(162, 155, 254, 0.22), var(--shadow-md);
}

.goods-card__detail-trigger {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: inherit;
  outline: none;
  background: transparent;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.goods-card__detail-trigger:active {
  background: rgba(162, 155, 254, 0.07);
}

.goods-card__media {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(162, 155, 254, 0.1)),
    var(--secondary-gray);
}

.goods-card__imported {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  max-width: calc(100% - 20px);
  overflow: hidden;
  padding: 5px 8px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: var(--button-radius);
  background: rgba(80, 72, 140, 0.88);
  box-shadow: var(--shadow-sm);
  color: #fff;
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-card__image {
  display: block;
  width: 100%;
  height: 100%;
  transition: transform var(--transition-normal);
}

.goods-card:hover .goods-card__image {
  transform: scale(1.025);
}

.goods-card__image--placeholder {
  display: grid;
  place-items: center;
  color: rgba(184, 148, 31, 0.52);
  font-size: 32px;
}

.goods-card__body {
  display: flex;
  min-width: 0;
  min-height: 190px;
  flex: 1;
  flex-direction: column;
  padding: 13px 14px 14px;
}

.goods-card h3 {
  display: -webkit-box;
  margin: 0 0 8px;
  overflow: hidden;
  color: var(--text-dark);
  font-size: var(--font-body);
  font-weight: 700;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
}

.goods-card__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  min-height: 20px;
  margin: 0;
  color: var(--text-light);
  font-size: var(--font-small);
  line-height: 1.4;
}

.goods-card__meta span:not(.goods-card__meta-separator) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-card__meta-separator {
  flex: none;
  color: var(--primary-gold-dark);
}

.goods-card__characters {
  margin: 7px 0 0;
  overflow: hidden;
  color: var(--text-regular);
  font-size: var(--font-small);
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-card__characters::before {
  margin-right: 5px;
  color: var(--primary-gold-dark);
  content: '角色';
  font-size: 10px;
  font-weight: 700;
}

.goods-card__facts {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}

.goods-card__theme {
  min-width: 0;
  overflow: hidden;
  padding: 3px 7px;
  border: 1px solid rgba(162, 155, 254, 0.24);
  border-radius: 4px;
  background: var(--accent-purple-soft);
  color: var(--accent-purple-dark);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goods-card__price {
  flex: none;
  color: #9a6e10;
  font-size: var(--font-caption);
}

.goods-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(212, 175, 55, 0.14);
}

.club-import-button {
  width: 96px;
  --brand-add-radius: var(--button-radius);
  --brand-add-padding-y: 7px;
  --brand-add-padding-x: 11px;
  --brand-add-min-height: 34px;
  --brand-add-font-size: 12px;
  --brand-add-gap: 5px;
}

.import-button {
  position: relative;
  z-index: 2;
  flex: none;
}

.import-button .brand-add-btn__content {
  gap: var(--brand-add-gap);
}

.goods-empty {
  min-height: 180px;
  padding: 28px 0;
}

.goods-panel :deep(.el-pagination) {
  justify-content: center;
  margin-top: 24px;
}

.state-panel {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
  padding: 22px 24px;
  border: 1px solid rgba(245, 108, 108, 0.22);
  border-radius: var(--card-radius-sm);
  background: rgba(255, 250, 250, 0.88);
  color: #8f4545;
}

.state-panel > .el-icon {
  flex: none;
  color: var(--el-color-danger);
  font-size: 22px;
}

.state-panel h1 {
  margin: 0;
  color: var(--text-dark);
  font-size: var(--font-section);
}

.state-panel p {
  margin: 4px 0 0;
  color: var(--text-regular);
  font-size: var(--font-caption);
}

.state-panel__action {
  flex: none;
  margin-left: auto;
  border-radius: var(--button-radius);
}

.state-panel--compact {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-color: rgba(245, 108, 108, 0.18);
  font-size: var(--font-caption);
}

.state-panel--compact .el-button {
  flex: none;
  margin-left: auto;
  border-radius: var(--button-radius);
}

.club-hero--skeleton {
  min-height: 168px;
}

.club-hero__skeleton {
  width: 100%;
}

.detail-layout--skeleton {
  align-items: start;
}

.profile-skeleton {
  min-height: 260px;
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--card-radius-sm);
  background: var(--bg-white);
}

.goods-grid--skeleton .goods-card {
  min-height: 300px;
  padding: 12px;
  cursor: default;
}

.goods-card--skeleton:hover,
.goods-card--skeleton:active {
  border-color: rgba(212, 175, 55, 0.24);
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transform: none;
}

.goods-card--skeleton :deep(.el-skeleton) {
  height: 100%;
}

.goods-card--skeleton :deep(.el-skeleton__item) {
  border-radius: var(--button-radius);
}

:deep(.club-dialog.el-dialog) {
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255, 255, 255, 0.76) inset;
}

:deep(.club-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.16);
}

:deep(.club-dialog .el-dialog__title) {
  color: var(--text-dark);
  font-size: var(--font-title);
  font-weight: 700;
}

:deep(.club-dialog .el-dialog__body) {
  max-height: min(70vh, 620px);
  overflow-y: auto;
  padding: 22px 24px;
}

:deep(.club-dialog .el-dialog__footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 24px 20px;
  border-top: 1px solid rgba(212, 175, 55, 0.12);
}

:deep(.club-dialog .el-dialog__footer .el-button) {
  border-radius: var(--button-radius);
}

.import-dialog__intro {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 20px;
}

.import-dialog__icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  border: 1px solid rgba(162, 155, 254, 0.28);
  border-radius: var(--button-radius);
  background: var(--accent-purple-soft);
  color: var(--accent-purple-dark);
}

.import-dialog__image {
  width: 38px;
  height: 38px;
  flex: none;
  overflow: hidden;
  border: 1px solid rgba(162, 155, 254, 0.28);
  border-radius: var(--button-radius);
  background: var(--accent-purple-soft);
}

.import-dialog__image :deep(.el-image__inner) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.import-dialog__intro strong {
  display: block;
  color: var(--text-dark);
  font-size: var(--font-body);
  line-height: 1.4;
}

.import-dialog__intro p {
  margin: 4px 0 0;
  color: var(--text-regular);
  font-size: var(--font-caption);
  line-height: 1.5;
}

.status-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.status-option {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 9px;
  min-height: 72px;
  padding: 11px;
  border: 1px solid rgba(212, 175, 55, 0.18);
  border-radius: var(--button-radius);
  outline: none;
  background: var(--bg-white);
  color: var(--text-regular);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition-fast), background-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.status-option:hover,
.status-option:focus-visible {
  border-color: rgba(162, 155, 254, 0.58);
  background: var(--accent-purple-soft);
}

.status-option:active {
  transform: scale(0.985);
}

.status-option.is-active {
  border-color: var(--accent-purple);
  background: var(--accent-purple-soft);
  box-shadow: 0 0 0 3px rgba(162, 155, 254, 0.14);
}

.status-option__dot {
  width: 10px;
  height: 10px;
  flex: none;
  margin-top: 4px;
  border: 2px solid currentColor;
  border-radius: 50%;
  color: var(--text-lighter);
}

.status-option.is-active .status-option__dot {
  border-color: var(--accent-purple-dark);
  background: var(--accent-purple-dark);
  box-shadow: inset 0 0 0 2px var(--accent-purple-soft);
}

.status-option--intended .status-option__dot,
.status-option--outdoor .status-option__dot {
  color: var(--el-color-warning);
}

.status-option--in_cabinet .status-option__dot {
  color: var(--el-color-success);
}

.status-option--sold .status-option__dot {
  color: var(--el-color-info);
}

.status-option__copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.status-option__copy strong {
  color: var(--text-dark);
  font-size: var(--font-caption);
}

.status-option__copy small {
  color: var(--text-light);
  font-size: var(--font-small);
  line-height: 1.4;
}

.dialog-primary-button {
  flex: none;
}

.goods-detail-dialog {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  gap: 24px;
  min-height: 220px;
}

.goods-detail-dialog__visual {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
}

.goods-detail-dialog__media {
  display: grid;
  aspect-ratio: 1;
  min-width: 0;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: var(--card-radius-sm);
  background: var(--secondary-gray);
}

.goods-detail-dialog__image,
.goods-detail-dialog__media :deep(.el-image__inner) {
  width: 100%;
  height: 100%;
}

.goods-detail-dialog__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  align-content: center;
  gap: 7px;
  color: var(--text-light);
  font-size: 36px;
}

.goods-detail-dialog__placeholder span {
  font-size: var(--font-caption);
}

.goods-detail-dialog__content {
  min-width: 0;
  padding-top: 2px;
}

.goods-detail-dialog__headline {
  margin-bottom: 16px;
}

.goods-detail-dialog__eyebrow {
  display: block;
  margin-bottom: 5px;
  color: var(--primary-gold-dark);
  font-size: var(--font-small);
  font-weight: 700;
}

.goods-detail-dialog__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.goods-detail-dialog dl {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 11px 10px;
  margin: 0;
  font-size: var(--font-body);
  line-height: 1.5;
}

.goods-detail-dialog dt {
  color: var(--text-light);
}

.goods-detail-dialog dd {
  min-width: 0;
  margin: 0;
  color: var(--text-regular);
  overflow-wrap: anywhere;
}

.goods-detail-dialog__character-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.goods-detail-dialog__character {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  padding: 3px 8px;
  border: 1px solid rgba(162, 155, 254, 0.3);
  border-radius: var(--button-radius);
  background: rgba(246, 244, 255, 0.7);
  color: var(--accent-purple-dark);
  font-size: var(--font-small);
  line-height: 1.35;
}

.goods-detail-dialog__price {
  color: var(--accent-purple-dark) !important;
  font-weight: 700;
}

.goods-detail-dialog__notes {
  margin-top: 20px;
  padding: 12px 14px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-left: 3px solid var(--primary-gold);
  border-radius: var(--button-radius);
  background: rgba(255, 252, 240, 0.62);
}

.goods-detail-dialog__notes span {
  display: block;
  margin-bottom: 5px;
  color: var(--primary-gold-dark);
  font-size: var(--font-small);
  font-weight: 700;
}

.goods-detail-dialog__notes p {
  margin: 0;
  color: var(--text-regular);
  font-size: var(--font-caption);
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.goods-detail-dialog__photos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.goods-detail-dialog__photo-button {
  display: block;
  width: 64px;
  height: 64px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.18);
  border-radius: var(--button-radius);
  outline: none;
  background: var(--secondary-gray);
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.goods-detail-dialog__photo-button:hover,
.goods-detail-dialog__photo-button:focus-visible {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px rgba(162, 155, 254, 0.18);
  transform: translateY(-1px);
}

.goods-detail-dialog__photo-button.is-active {
  border-color: var(--primary-gold-dark);
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
}

.goods-detail-dialog__photo-button .el-image,
.goods-detail-dialog__photo-button :deep(.el-image__inner) {
  display: block;
  width: 100%;
  height: 100%;
}

:global(.mobile-filter-drawer.el-drawer) {
  overflow: hidden;
  border-radius: 12px 12px 0 0;
}

:global(.mobile-filter-drawer .el-drawer__body) {
  padding: 0;
}

.mobile-filter-sheet {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--bg-white);
}

.mobile-filter-sheet__header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.18);
}

.mobile-filter-sheet__header span {
  color: var(--primary-gold-dark);
  font-size: 10px;
  font-weight: 700;
}

.mobile-filter-sheet__header h2 {
  margin: 2px 0 0;
  font-size: var(--font-section);
}

.mobile-filter-sheet__body {
  display: grid;
  min-height: 0;
  flex: 1;
  align-content: start;
  gap: 18px;
  overflow-y: auto;
  padding: 18px;
}

.mobile-ordering-field {
  display: grid;
  gap: 7px;
  color: var(--text-regular);
  font-size: var(--font-small);
  font-weight: 600;
}

.mobile-ordering-field :deep(.el-select) {
  width: 100%;
}

.mobile-filter-sheet__footer {
  display: grid;
  flex: none;
  grid-template-columns: 1fr 1.6fr;
  gap: 10px;
  padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(212, 175, 55, 0.18);
  background: rgba(255, 255, 255, 0.98);
}

.mobile-filter-sheet__footer .el-button {
  min-height: 42px;
  margin: 0;
  border-radius: var(--button-radius);
}

@media (max-width: 1024px) {
  .detail-layout {
    gap: 16px;
  }

  .section-heading {
    grid-template-columns: minmax(0, 1fr) minmax(380px, 1fr);
  }

  .goods-search {
    flex-basis: 180px;
  }
}

@media (min-width: 769px) and (max-width: 1140px) {
  .section-heading {
    grid-template-columns: 1fr;
  }

  .goods-toolbar {
    margin-top: 12px;
  }
}

@media (max-width: 900px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .profile-panel {
    order: 2;
  }

  .goods-panel {
    order: 1;
  }
}

@media (max-width: 768px) {
  .club-detail-page {
    padding: 20px 16px calc(40px + env(safe-area-inset-bottom));
  }

  .club-hero {
    grid-template-columns: 72px minmax(0, 1fr) auto;
    gap: 12px;
    padding: 18px;
  }

  .club-hero__avatar {
    width: 72px;
    height: 72px;
    border-radius: 18px;
    font-size: 26px;
  }

  .club-hero__favorite { min-width: 92px; }
  .favorite-button span { display: none; }
  .favorite-button { width: 36px; padding: 0; }

  .club-hero h1 {
    font-size: 22px;
  }

  .section-heading {
    grid-template-columns: 1fr;
  }

  .goods-panel {
    padding: 16px;
  }

  .goods-toolbar {
    grid-template-columns: minmax(0, 1fr) auto auto;
    margin-top: 14px;
  }

  .goods-grid {
    gap: 12px;
  }

  .goods-card__body {
    padding: 11px;
  }
}

@media (max-width: 600px) {
  .club-hero { grid-template-columns: 72px minmax(0, 1fr); }
  .club-hero__favorite { grid-column: 2; grid-row: 2; display: flex; align-items: center; justify-content: flex-start; min-width: 0; }
  .favorite-button span { display: inline; }
  .favorite-button { width: auto; padding: 0 12px; }
  .goods-detail-dialog {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .goods-detail-dialog__media {
    width: min(100%, 300px);
    justify-self: center;
  }

  .goods-detail-dialog__photos {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .club-detail-page {
    padding-right: 12px;
    padding-left: 12px;
  }

  .club-hero {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 10px;
    padding: 14px;
  }

  .club-hero__avatar {
    width: 64px;
    height: 64px;
    border-radius: 16px;
  }

  .club-hero__eyebrow {
    display: none;
  }

  .profile-panel,
  .goods-panel {
    padding: 14px;
  }

  .club-hero h1 {
    font-size: 20px;
  }

  .club-description {
    margin-top: 5px;
    font-size: var(--font-caption);
  }

  .goods-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .goods-card__body {
    min-height: 184px;
    padding: 10px;
  }

  .goods-card h3 {
    font-size: var(--font-caption);
  }

  .goods-card__footer {
    gap: 5px;
  }

  .club-import-button {
    width: 88px;
    --brand-add-padding-x: 8px;
    --brand-add-font-size: 11px;
  }

  .goods-card__imported {
    top: 7px;
    left: 7px;
    max-width: calc(100% - 14px);
    padding: 4px 6px;
  }

  :deep(.club-dialog .el-dialog__body) {
    padding: 18px 16px;
  }

  :deep(.club-dialog .el-dialog__footer) {
    padding: 12px 16px 16px;
  }

  .status-options {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .back-button,
  .store-link,
  .filter-toggle-button,
  .filter-collapse-wrapper,
  .filter-collapse-enter-active,
  .filter-collapse-leave-active,
  .goods-card,
  .goods-card__image,
  .status-option {
    transition: none;
  }

  .filter-collapse-wrapper > .desktop-filter-panel,
  .filter-collapse-enter-from,
  .filter-collapse-leave-to,
  .filter-collapse-enter-to,
  .filter-collapse-leave-from,
  .filter-collapse-enter-active > .desktop-filter-panel,
  .filter-collapse-leave-active > .desktop-filter-panel,
  .filter-collapse-enter-from > .desktop-filter-panel,
  .filter-collapse-leave-to > .desktop-filter-panel,
  .filter-collapse-enter-to > .desktop-filter-panel,
  .filter-collapse-leave-from > .desktop-filter-panel {
    transform: none;
  }

  .goods-card:hover,
  .goods-card:hover .goods-card__image,
  .store-link:hover,
  .status-option:active {
    transform: none;
  }

  .goods-detail-dialog__photo-button:hover,
  .goods-detail-dialog__photo-button:focus-visible {
    transform: none;
  }
}
</style>
