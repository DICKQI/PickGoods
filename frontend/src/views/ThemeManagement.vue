<template>
  <div class="theme-management-container">
    <section class="desktop-theme-workbench hidden-xs-only">
      <header class="desktop-theme-header">
        <div class="desktop-theme-heading">
          <span class="desktop-theme-eyebrow">主题资料库</span>
          <div class="desktop-theme-title-row">
            <h1>主题</h1>
            <div class="desktop-theme-metrics" aria-label="主题统计">
              <span class="desktop-theme-metric">
                <span>全部</span>
                <strong>{{ allThemes.length }}</strong>
              </span>
              <span class="desktop-theme-metric" :class="{ 'is-active': hasActiveFilters }">
                <span>当前结果</span>
                <strong>{{ filteredThemeList.length }}</strong>
              </span>
            </div>
          </div>
          <p>把主题名称、备注和参考图收拾整齐，之后筛选起来更轻松啦~</p>
        </div>
        <el-button
          type="primary"
          class="brand-add-btn brand-add-btn--compact desktop-theme-add"
          @click="handleAdd"
        >
          <span class="brand-add-btn__content">
            <el-icon><Plus /></el-icon>
            <span>新增主题</span>
          </span>
        </el-button>
      </header>

      <section class="desktop-theme-toolbar" aria-label="主题筛选工具栏">
        <el-input
          v-model="searchText"
          class="desktop-theme-search"
          placeholder="搜索主题名称或描述"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select
          v-model="sortBy"
          class="desktop-theme-sort"
          placeholder="排序方式"
          clearable
          @change="handleSortChange"
        >
          <el-option label="创建时间正序" value="created_asc" />
          <el-option label="创建时间倒序" value="created_desc" />
          <el-option label="名称正序" value="name_asc" />
          <el-option label="名称倒序" value="name_desc" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          class="desktop-theme-date"
          style="width: 100%"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          clearable
          @change="handleDateRangeChange"
        />
        <div class="desktop-theme-toolbar-actions">
          <el-button type="primary" class="desktop-theme-search-button" @click="handleSearch">
            <el-icon><Search /></el-icon>
            <span>搜索</span>
          </el-button>
          <el-button v-if="hasActiveFilters" class="desktop-theme-clear" @click="clearFilters">
            <el-icon><Close /></el-icon>
            <span>清除</span>
          </el-button>
          <el-tooltip content="刷新主题列表" placement="top">
            <el-button
              class="desktop-theme-refresh"
              circle
              :loading="loading"
              aria-label="刷新主题列表"
              @click="handleRefresh"
            >
              <el-icon v-if="!loading"><Refresh /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </section>

      <section v-loading="loading" class="desktop-theme-table-panel">
        <div ref="tableContainerRef" class="table-container">
          <el-table
            :data="paginatedThemeList"
            class="pc-table"
            row-key="id"
            :height="tableHeight"
            style="width: 100%"
          >
            <el-table-column prop="name" label="主题名称" min-width="220" fixed>
              <template #default="{ row }">
                <div class="theme-item-name">
                  <span class="theme-icon-tile" aria-hidden="true">
                    <el-icon class="theme-icon"><Star /></el-icon>
                  </span>
                  <span class="theme-name-text">{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" min-width="360">
              <template #default="{ row }">
                <el-tooltip :content="row.description || '暂无描述'" placement="top" :show-after="500">
                  <span class="description-text" :class="{ 'is-empty': !row.description }">
                    {{ row.description || '暂无描述' }}
                  </span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180" sortable>
              <template #default="{ row }">
                <span class="time-text">{{ formatDate(row.created_at) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="112" align="center" fixed="right">
              <template #default="{ row }">
                <div class="desktop-theme-actions">
                  <el-tooltip content="编辑主题" placement="top" :show-after="400">
                    <el-button
                      text
                      circle
                      class="desktop-theme-action desktop-theme-action--edit"
                      :aria-label="`编辑主题 ${row.name}`"
                      @click="handleEdit(row)"
                    >
                      <el-icon><Edit /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="删除主题" placement="top" :show-after="400">
                    <el-button
                      text
                      circle
                      class="desktop-theme-action desktop-theme-action--delete"
                      :aria-label="`删除主题 ${row.name}`"
                      @click="handleDelete(row)"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
            <template #empty>
              <div class="desktop-theme-empty">
                <el-empty :description="hasActiveFilters ? '没有找到匹配的主题' : '还没有主题'" :image-size="88">
                  <el-button v-if="hasActiveFilters" @click="clearFilters">清除筛选条件</el-button>
                  <el-button v-else type="primary" class="desktop-theme-empty-add" @click="handleAdd">
                    <el-icon><Plus /></el-icon>
                    <span>新增主题</span>
                  </el-button>
                </el-empty>
              </div>
            </template>
          </el-table>
        </div>

        <div v-if="filteredThemeList.length > 0" class="pagination-wrapper">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="filteredThemeList.length"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </section>
    </section>

    <section class="visible-xs-only mobile-theme-workbench">
    <!-- ================= 顶部区域 ================= -->
    <div class="header-section">
      <div class="title-wrapper">
        <h2 class="page-title">主题</h2>
        <span class="sub-title">给不同主题的谷子贴上可爱的分类标签吧~</span>
      </div>
      <div class="header-actions">
        <el-button class="add-btn" type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          <span>新增主题</span>
        </el-button>
      </div>
    </div>

    <!-- 统计信息栏 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">全部主题</span>
        <span class="stat-value">{{ allThemes.length }}</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-label">筛选结果</span>
        <span class="stat-value highlight">{{ filteredThemeList.length }}</span>
      </div>
    </div>

    <el-card class="search-card" shadow="never">
      <div class="search-filter-container">
        <div class="search-row">
          <el-input
            v-model="searchText"
            placeholder="搜索主题名称或描述..."
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
            class="custom-search"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button class="search-btn" type="primary" @click="handleSearch">搜索</el-button>
        </div>
        <div class="filter-row">
          <el-select
            v-model="sortBy"
            placeholder="排序方式"
            clearable
            @change="handleSortChange"
            class="sort-select"
          >
            <el-option label="创建时间正序" value="created_asc" />
            <el-option label="创建时间倒序" value="created_desc" />
            <el-option label="名称正序" value="name_asc" />
            <el-option label="名称倒序" value="name_desc" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            clearable
            @change="handleDateRangeChange"
            class="date-picker"
          />
          <el-button v-if="hasActiveFilters" text type="primary" @click="clearFilters">
            <el-icon><Close /></el-icon>
            清除筛选
          </el-button>
        </div>
      </div>
    </el-card>
    <!-- ================= 顶部区域结束 ================= -->

    <div v-loading="loading" class="content-body">
      <!-- 移动端视图 -->
      <div class="visible-xs-only mobile-list-container">
        <!-- 移动端筛选状态栏 -->
        <div class="mobile-filter-bar" v-if="hasActiveFilters">
          <div class="mobile-filter-summary">
            <span class="filter-result">找到 {{ filteredThemeList.length }} 个结果</span>
            <div class="mobile-filter-chips">
              <span v-for="chip in mobileFilterChips" :key="chip" class="mobile-filter-chip">{{ chip }}</span>
            </div>
          </div>
          <el-button text size="small" @click="clearFilters">
            <el-icon><Close /></el-icon>
            清除
          </el-button>
        </div>

        <!-- 下拉刷新容器 -->
        <div
          class="pull-refresh-wrapper"
          ref="scrollContainerRef"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
        >
          <!-- 下拉加载提示区 -->
          <div class="pull-indicator" :style="{ height: `${pullDistance}px`, opacity: pullDistance > 0 ? 1 : 0 }">
            <div class="indicator-content">
              <el-icon v-if="isRefreshing" class="is-loading"><Loading /></el-icon>
              <el-icon v-else :style="{ transform: `rotate(${pullDistance > 50 ? 180 : 0}deg)` }"><Top /></el-icon>
              <span class="indicator-text">
                {{ isRefreshing ? '正在刷新...' : (pullDistance > 50 ? '释放刷新' : '下拉刷新') }}
              </span>
            </div>
          </div>

          <!-- 内容区域 -->
          <div class="theme-list-inner" :style="{ transform: `translateY(${pullDistance}px)` }">
            <!-- 移动端使用分页加载更多 -->
            <div
              v-for="item in mobileDisplayList"
              :key="item.id"
              class="mobile-card"
            >
              <div class="mobile-card-spine" aria-hidden="true"></div>
              <div class="mobile-card-left" @click="handleEdit(item)">
                <div class="icon-placeholder">
                  <el-icon><Star /></el-icon>
                </div>
                <div class="card-info">
                  <div class="card-name">{{ item.name }}</div>
                  <div class="card-description">{{ item.description || '暂无描述' }}</div>
                  <div class="card-meta">
                    <span class="card-meta-pill">主题</span>
                    <span class="card-time">{{ formatDate(item.created_at) }}</span>
                  </div>
                </div>
              </div>
              <div class="mobile-card-right">
                <div class="mobile-more" @click.stop="openMobileActions(item)">
                  <el-icon><MoreFilled /></el-icon>
                </div>
              </div>
            </div>

            <!-- 哨兵元素：滚动到此处触发加载更多 -->
            <div v-if="hasMoreMobileData" ref="sentinelRef" class="scroll-sentinel"></div>
            <!-- 加载更多指示器 -->
            <div class="load-more-wrapper" v-if="loadingMoreMobile">
              加载中...
            </div>

            <el-empty v-if="!loading && mobileDisplayList.length === 0" description="暂无主题数据" />
          </div>
        </div>
      </div>

      <!-- 无数据时的空状态引导 -->
      <div v-if="!loading && filteredThemeList.length === 0 && hasActiveFilters" class="empty-filter-result">
        <el-empty description="没有找到匹配的主题">
          <el-button type="primary" @click="clearFilters">清除筛选条件</el-button>
        </el-empty>
      </div>
    </div>
    </section>

    <!-- 弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isMobile ? undefined : dialogTitle"
      :width="themeEditorDialogWidth"
      :class="['custom-dialog', 'theme-editor-dialog', { 'is-theme-editor-mobile': isMobile }]"
      :align-center="!isMobile"
      :show-close="!isMobile"
      :lock-scroll="!isMobile"
    >
      <div class="theme-editor-shell">
        <div v-if="!isMobile" class="theme-editor-desktop-header">
          <div class="theme-editor-desktop-icon" aria-hidden="true">
            <el-icon><Star /></el-icon>
          </div>
          <div class="theme-editor-desktop-copy">
            <span class="theme-editor-desktop-kicker">Theme Library</span>
            <h3 class="theme-editor-desktop-title">{{ dialogTitle }}</h3>
            <p>把名称、描述和参考图收进主题档案，之后筛选和搭配就更直观啦~</p>
          </div>
          <button
            class="theme-editor-desktop-close"
            type="button"
            aria-label="关闭主题编辑弹窗"
            :disabled="submitting"
            @click="dialogVisible = false"
          >
            <el-icon><Close /></el-icon>
          </button>
        </div>

        <div v-if="isMobile" class="theme-editor-hero">
          <div class="theme-editor-hero-icon" aria-hidden="true">
            <el-icon><Star /></el-icon>
          </div>
          <div class="theme-editor-hero-copy">
            <h3>{{ dialogTitle }}</h3>
            <p>把主题分类和参考图一起整理好吧~</p>
          </div>
          <button
            class="theme-editor-close"
            type="button"
            aria-label="关闭主题编辑面板"
            :disabled="submitting"
            @click="dialogVisible = false"
          >
            <el-icon><Close /></el-icon>
          </button>
        </div>

        <div class="theme-editor-body">
          <el-form
            :model="formData"
            :rules="formRules"
            ref="formRef"
            label-position="top"
            class="theme-editor-form"
          >
            <section class="theme-editor-section theme-editor-section--identity">
              <div class="theme-editor-section-header">
                <div>
                  <h4>基础信息</h4>
                  <p>取个清楚又好记的名字，让主题更容易找到吧~</p>
                </div>
              </div>

              <el-form-item label="主题名称" prop="name">
                <el-input
                  v-model="formData.name"
                  placeholder="例如：夏日祭、海灯节、生日谷"
                  maxlength="100"
                  show-word-limit
                />
              </el-form-item>

              <el-form-item label="主题描述" prop="description">
                <el-input
                  v-model="formData.description"
                  type="textarea"
                  :rows="5"
                  placeholder="记录店铺、工艺、画师或这个主题的补充信息"
                  maxlength="500"
                  show-word-limit
                />
              </el-form-item>
            </section>

            <section class="theme-editor-section theme-editor-section-photos theme-editor-section--photos">
              <div class="theme-editor-section-header">
                <div>
                  <h4>参考图片</h4>
                  <p>拍立得、官图和工艺细节，都可以放进参考图里哦~</p>
                </div>
              </div>

              <div v-if="isEdit && editingId" v-loading="loadingThemeDetail" class="theme-additional-photos-section">
                <div
                  v-if="existingThemeImages.length > 0 || newThemePhotoFiles.length > 0"
                  class="theme-photo-grid"
                >
                  <div
                    v-for="(photo, index) in existingThemeImages"
                    :key="photo.id"
                    class="theme-photo-item"
                  >
                    <div class="theme-photo-preview-wrap">
                      <el-image
                        :src="photo.image"
                        fit="cover"
                        class="theme-photo-preview"
                        :preview-src-list="existingThemeImages.map((p) => p.image)"
                        :initial-index="index"
                      >
                        <template #error>
                          <div class="theme-image-error">
                            <el-icon><Picture /></el-icon>
                          </div>
                        </template>
                      </el-image>
                      <el-button
                        type="danger"
                        size="small"
                        :icon="Delete"
                        circle
                        class="theme-photo-remove"
                        @click="handleRemoveExistingThemePhoto(photo.id)"
                      />
                    </div>
                    <el-input
                      v-model="photo.label"
                      placeholder="图片标签（可选）"
                      size="small"
                      class="theme-photo-label-input"
                      @blur="handleThemePhotoLabelChange(photo)"
                    />
                  </div>

                  <div
                    v-for="(file, index) in newThemePhotoFiles"
                    :key="`new-${index}`"
                    class="theme-photo-item is-new"
                  >
                    <div class="theme-photo-preview-wrap">
                      <el-image
                        :src="file.preview"
                        fit="cover"
                        class="theme-photo-preview"
                      >
                        <template #error>
                          <div class="theme-image-error">
                            <el-icon><Picture /></el-icon>
                          </div>
                        </template>
                      </el-image>
                      <el-button
                        type="danger"
                        size="small"
                        :icon="Delete"
                        circle
                        class="theme-photo-remove"
                        @click="handleRemoveNewThemePhoto(index)"
                      />
                    </div>
                    <el-input
                      v-model="file.label"
                      placeholder="图片标签（可选）"
                      size="small"
                      class="theme-photo-label-input"
                    />
                  </div>
                </div>

                <el-upload
                  v-model:file-list="themeImageUploadList"
                  list-type="picture-card"
                  :auto-upload="false"
                  :on-change="handleThemePhotoChange"
                  :on-remove="handleThemePhotoUploadRemove"
                  :http-request="dummyThemeUpload"
                  :show-file-list="false"
                  accept="image/*"
                  multiple
                  class="theme-photo-upload"
                >
                  <template #trigger>
                    <div class="theme-photo-add-card">
                      <el-icon><Plus /></el-icon>
                      <span>添加图片</span>
                    </div>
                  </template>
                </el-upload>
              </div>

              <div v-else class="theme-editor-image-note">
                <span class="theme-editor-image-note-icon" aria-hidden="true">
                  <el-icon><Picture /></el-icon>
                </span>
                <span>保存后可继续添加参考图</span>
              </div>
            </section>
          </el-form>
        </div>
      </div>
      <template #footer>
        <div class="theme-editor-footer">
          <el-button
            class="theme-editor-cancel"
            :text="isMobile"
            :disabled="submitting"
            @click="dialogVisible = false"
          >
            取消
          </el-button>
          <el-button type="primary" class="submit-btn" @click="handleSubmit" :loading="submitting">
            {{ isMobile ? '保存主题' : '确定' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <MobileActionSheet
      v-model="mobileDrawerVisible"
      :title="themeActionSheetTitle"
      :actions="themeMobileActions"
      @select="handleThemeMobileAction"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Plus, Search, Star, Refresh, Loading, Top, MoreFilled, Edit, Delete, Picture, Close } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useMetadataStore } from '@/stores/metadata'
import MobileActionSheet from '@/components/MobileActionSheet.vue'
import { useMobilePullRefresh } from '@/composables/useMobilePullRefresh'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import {
  getThemeList,
  getThemeDetail,
  createTheme,
  updateTheme,
  deleteTheme,
  uploadThemeImages,
  updateThemeImageLabel,
  deleteThemeImage,
} from '@/api/metadata'
import type { Theme, ThemeImage } from '@/api/types'

interface ExistingThemeImage extends ThemeImage {
  label?: string
  originalLabel?: string
}

interface NewThemePhotoFile {
  file: File
  preview: string
  label?: string
}

const loading = ref(false)
const submitting = ref(false)
const searchText = ref('')
const allThemes = ref<Theme[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const { isMobile } = useResponsiveDevice()

const mobileDrawerVisible = ref(false)
const currentActionRow = ref<Theme | null>(null)

const authStore = useAuthStore()
const metadataStore = useMetadataStore()

const scrollContainerRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
let sentinelObserver: IntersectionObserver | null = null

const sortBy = ref<string>('')
const dateRange = ref<[string, string] | null>(null)

const currentPage = ref(1)
const pageSize = ref(20)
const tableContainerRef = ref<HTMLElement | null>(null)
const tableHeight = ref(400)

const mobilePageSize = 10
const mobileDisplayList = ref<Theme[]>([])
const loadingMoreMobile = ref(false)

const {
  pullDistance,
  isRefreshing,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = useMobilePullRefresh({
  enabled: isMobile,
  onRefresh: async () => {
    try {
      await fetchThemeList(true)
      ElMessage.success('刷新成功')
    } catch {
      ElMessage.error('刷新失败')
    }
  },
})

const formData = ref({
  name: '',
  description: '',
})

const existingThemeImages = ref<ExistingThemeImage[]>([])
const newThemePhotoFiles = ref<NewThemePhotoFile[]>([])
const themeImageUploadList = ref<UploadFile[]>([])
const loadingThemeDetail = ref(false)

const dummyThemeUpload = () => {}

const formRules: FormRules = {
  name: [
    { required: true, message: '主题名称不能为空', trigger: 'blur' },
    { max: 100, message: '主题名称不能超过100个字符', trigger: 'blur' }
  ],
  description: [
    { max: 500, message: '描述不能超过500个字符', trigger: 'blur' }
  ],
}

const dialogTitle = computed(() => isEdit.value ? '✨ 修改主题' : '✨ 新增主题')
const themeEditorDialogWidth = computed(() => {
  if (isMobile.value) return '100vw'
  return isEdit.value && editingId.value ? '820px' : '720px'
})

const hasActiveFilters = computed(() => {
  return searchText.value.trim() !== '' || sortBy.value !== '' || (dateRange.value !== null && dateRange.value.length === 2)
})

const sortLabelMap: Record<string, string> = {
  created_asc: '创建时间正序',
  created_desc: '创建时间倒序',
  name_asc: '名称正序',
  name_desc: '名称倒序',
}

const mobileFilterChips = computed(() => {
  const chips: string[] = []
  if (searchText.value.trim()) chips.push('关键词')
  if (sortBy.value) chips.push(sortLabelMap[sortBy.value] || '排序')
  if (dateRange.value?.length === 2) chips.push('日期范围')
  return chips
})

const filteredThemeList = computed(() => {
  let result = [...allThemes.value]

  const keyword = searchText.value.trim().toLowerCase()
  if (keyword) {
    result = result.filter(theme =>
      theme.name.toLowerCase().includes(keyword) ||
      (theme.description && theme.description.toLowerCase().includes(keyword))
    )
  }

  if (dateRange.value && dateRange.value.length === 2) {
    const [startDate, endDate] = dateRange.value
    result = result.filter(theme => {
      if (!theme.created_at) return false
      const themeDate = theme.created_at.split('T')[0] || ''
      return themeDate >= startDate && themeDate <= endDate
    })
  }

  if (sortBy.value) {
    switch (sortBy.value) {
      case 'created_asc':
        result.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        break
      case 'created_desc':
        result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        break
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        break
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'))
        break
    }
  } else {
    result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  }

  return result
})

const paginatedThemeList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredThemeList.value.slice(start, end)
})

const hasMoreMobileData = computed(() => {
  return mobileDisplayList.value.length < filteredThemeList.value.length
})

watch(filteredThemeList, () => {
  currentPage.value = 1
  updateMobileDisplayList()
  nextTick(updateTableHeight)
}, { immediate: false })

watch(isMobile, () => {
  nextTick(updateTableHeight)
})

const updateMobileDisplayList = () => {
  mobileDisplayList.value = filteredThemeList.value.slice(0, mobilePageSize)
}

const loadMoreMobile = () => {
  if (loadingMoreMobile.value || !hasMoreMobileData.value) return
  loadingMoreMobile.value = true
  const currentLength = mobileDisplayList.value.length
  const nextBatch = filteredThemeList.value.slice(currentLength, currentLength + mobilePageSize)
  mobileDisplayList.value = [...mobileDisplayList.value, ...nextBatch]
  nextTick(() => {
    loadingMoreMobile.value = false
  })
}

const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
}

const handleSortChange = () => {
  currentPage.value = 1
}

const handleDateRangeChange = () => {
  currentPage.value = 1
}

const clearFilters = () => {
  searchText.value = ''
  sortBy.value = ''
  dateRange.value = null
  currentPage.value = 1
}

const updateTableHeight = () => {
  if (tableContainerRef.value && !isMobile.value) {
    const containerRect = tableContainerRef.value.getBoundingClientRect()
    const windowHeight = window.innerHeight
    const paginationHeight = filteredThemeList.value.length > 0 ? 70 : 0
    const bottomGap = 24
    const availableHeight = windowHeight - containerRect.top - paginationHeight - bottomGap
    tableHeight.value = Math.max(200, Math.min(availableHeight, 800))
  }
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—'
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

const fetchThemeList = async (force = false) => {
  loading.value = true
  try {
    const data = await metadataStore.fetchThemes(force)
    allThemes.value = data || []
    updateMobileDisplayList()
    await nextTick()
    updateTableHeight()
  } finally {
    loading.value = false
  }
}

const handleSearch = () => fetchThemeList()
const handleRefresh = () => fetchThemeList(true)

const handleAdd = () => {
  isEdit.value = false
  editingId.value = null
  formData.value = { name: '', description: '店铺：\n工艺：\n画师：\n主题：' }
  existingThemeImages.value = []
  newThemePhotoFiles.value = []
  dialogVisible.value = true
}

const handleEdit = async (row: Theme) => {
  isEdit.value = true
  editingId.value = row.id
  formData.value = {
    name: row.name,
    description: row.description || ''
  }
  existingThemeImages.value = []
  newThemePhotoFiles.value = []
  dialogVisible.value = true
  loadingThemeDetail.value = true
  try {
    const detail = await getThemeDetail(row.id)
    existingThemeImages.value = (detail.images || []).map((img) => ({
      ...img,
      label: img.label ?? '',
      originalLabel: img.label ?? '',
    }))
  } catch (error: any) {
    if (error?.response?.status === 404) {
      dialogVisible.value = false
      editingId.value = null
      ElMessage.warning('该主题已不存在或不属于当前用户，已刷新列表')
      await fetchThemeList(true)
    } else {
      ElMessage.error('加载主题详情失败')
    }
  } finally {
    loadingThemeDetail.value = false
  }
}

const handleDelete = async (row: Theme) => {
  try {
    await ElMessageBox.confirm(
      `确定删除主题《${row.name}》吗？删除后，关联到该主题的谷子的主题字段将被清空。`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await deleteTheme(row.id)
    ElMessage.success('已删除')
    fetchThemeList(true)
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const openMobileActions = (row: Theme) => {
  currentActionRow.value = row
  mobileDrawerVisible.value = true
}

const themeActionSheetTitle = computed(() => (
  currentActionRow.value ? `对「${currentActionRow.value.name}」进行操作` : '主题操作'
))

const themeMobileActions = computed(() => [
  { key: 'edit', label: '编辑主题', icon: Edit, tone: 'primary' as const },
  { key: 'delete', label: '删除主题', icon: Delete, tone: 'danger' as const },
])

const handleThemeMobileAction = (key: string) => {
  if (key === 'edit') handleMobileEdit()
  if (key === 'delete') handleMobileDelete()
}

const handleMobileCardClick = (row: Theme) => {
  handleEdit(row)
}

const handleMobileEdit = () => {
  if (currentActionRow.value) {
    handleEdit(currentActionRow.value)
    mobileDrawerVisible.value = false
  }
}

const handleMobileDelete = () => {
  if (currentActionRow.value) {
    mobileDrawerVisible.value = false
    handleDelete(currentActionRow.value)
  }
}

const handleThemePhotoLabelChange = async (photo: ExistingThemeImage) => {
  if (!editingId.value || photo.originalLabel === photo.label) return
  try {
    const label = photo.label?.trim() ?? ''
    await updateThemeImageLabel(editingId.value, [photo.id], label)
    photo.originalLabel = photo.label
    ElMessage.success('标签已更新')
  } catch (err: any) {
    photo.label = photo.originalLabel
    ElMessage.error('标签更新失败：' + (err?.message || '未知错误'))
  }
}

const handleRemoveExistingThemePhoto = async (photoId: number) => {
  if (!editingId.value) return
  try {
    await ElMessageBox.confirm('确定要删除这张图片吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteThemeImage(editingId.value, photoId)
    existingThemeImages.value = existingThemeImages.value.filter((p) => p.id !== photoId)
    ElMessage.success('已删除')
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败：' + (err?.message || '未知错误'))
    }
  }
}

const handleThemePhotoChange = (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (file) {
    newThemePhotoFiles.value.push({
      file,
      preview: URL.createObjectURL(file),
      label: '',
    })
  }
  themeImageUploadList.value = []
}

const handleThemePhotoUploadRemove = () => {
  themeImageUploadList.value = []
}

const handleRemoveNewThemePhoto = (index: number) => {
  const item = newThemePhotoFiles.value[index]
  if (item?.preview) URL.revokeObjectURL(item.preview)
  newThemePhotoFiles.value.splice(index, 1)
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      const payload = {
        name: formData.value.name.trim(),
        description: formData.value.description?.trim() || null,
      }
      if (isEdit.value && editingId.value) {
        await updateTheme(editingId.value, payload)
        for (const photo of newThemePhotoFiles.value) {
          await uploadThemeImages(editingId.value!, [photo.file], {
            label: photo.label?.trim() ?? '',
          })
        }
        newThemePhotoFiles.value.forEach((p) => {
          if (p.preview) URL.revokeObjectURL(p.preview)
        })
        newThemePhotoFiles.value = []
        ElMessage.success('更新成功')
      } else {
        await createTheme(payload)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      fetchThemeList(true)
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.detail || (isEdit.value ? '更新失败' : '创建失败'))
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  window.addEventListener('resize', updateTableHeight)
  fetchThemeList()
  nextTick(() => {
    updateTableHeight()
  })

  // 设置无限滚动哨兵观察器（仅移动端使用，但提前创建以保持简洁）
  sentinelObserver = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      loadMoreMobile()
    }
  }, {
    rootMargin: '100px',
  })

  // 监听哨兵元素挂载
  watch(sentinelRef, (el, oldEl) => {
    if (oldEl && sentinelObserver) {
      sentinelObserver.unobserve(oldEl)
    }
    if (el && sentinelObserver) {
      sentinelObserver.observe(el)
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTableHeight)
  if (sentinelObserver) {
    sentinelObserver.disconnect()
  }
  newThemePhotoFiles.value.forEach((p) => {
    if (p.preview) URL.revokeObjectURL(p.preview)
  })
})
</script>

<style scoped>
/* =========== PC/通用基础样式 =========== */
.theme-management-container {
  padding: 18px;
  max-width: 1480px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
}

.desktop-theme-workbench {
  color: #243042;
}

.desktop-theme-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 16px;
}

.desktop-theme-heading {
  min-width: 0;
}

.desktop-theme-eyebrow {
  display: block;
  margin-bottom: 3px;
  color: #8a650b;
  font-size: 12px;
  font-weight: 800;
}

.desktop-theme-title-row {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.desktop-theme-title-row h1 {
  margin: 0;
  color: #243042;
  font-size: 25px;
  font-weight: 700;
  line-height: 1.2;
}

.desktop-theme-heading > p {
  margin: 5px 0 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.45;
}

.desktop-theme-metrics {
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.84);
}

.desktop-theme-metric {
  min-width: 92px;
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 7px;
  padding: 6px 11px;
  color: #6b7280;
  font-size: 11px;
  border-left: 1px solid #e5e7eb;
}

.desktop-theme-metric:first-child {
  border-left: 0;
}

.desktop-theme-metric strong {
  color: #243042;
  font-size: 16px;
  line-height: 1;
}

.desktop-theme-metric.is-active strong {
  color: var(--accent-purple-dark);
}

.desktop-theme-add {
  --brand-add-radius: 8px;
  flex-shrink: 0;
}

.desktop-theme-toolbar {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) 168px minmax(280px, 320px) auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.desktop-theme-search,
.desktop-theme-sort,
.desktop-theme-date {
  width: 100%;
  min-width: 0;
}

.desktop-theme-search :deep(.el-input__wrapper),
.desktop-theme-sort :deep(.el-select__wrapper),
.desktop-theme-date:deep(.el-input__wrapper) {
  min-height: 38px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  box-shadow: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.desktop-theme-search :deep(.el-input__wrapper:hover),
.desktop-theme-sort :deep(.el-select__wrapper:hover),
.desktop-theme-date:deep(.el-input__wrapper:hover) {
  border-color: rgba(212, 175, 55, 0.48);
}

.desktop-theme-search :deep(.el-input__wrapper.is-focus),
.desktop-theme-sort :deep(.el-select__wrapper.is-focused),
.desktop-theme-date:deep(.el-input__wrapper.is-active) {
  border-color: rgba(212, 175, 55, 0.72);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
}

.desktop-theme-date :deep(.el-range-input) {
  min-width: 0;
  background: transparent;
}

.desktop-theme-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  white-space: nowrap;
}

.desktop-theme-search-button,
.desktop-theme-clear,
.desktop-theme-refresh {
  min-height: 38px;
  margin-left: 0;
  border-radius: 8px;
  font-weight: 700;
}

.desktop-theme-search-button {
  padding-inline: 15px;
}

.desktop-theme-clear {
  color: #475569;
  border-color: #e2e8f0;
  background: #fff;
}

.desktop-theme-clear:hover,
.desktop-theme-clear:focus {
  color: #7a5b08;
  border-color: rgba(212, 175, 55, 0.48);
  background: #fffaf0;
}

.desktop-theme-refresh {
  width: 38px;
  color: #64748b;
  border-color: #e2e8f0;
}

.desktop-theme-refresh:hover,
.desktop-theme-refresh:focus-visible {
  color: #7a5b08;
  border-color: rgba(212, 175, 55, 0.48);
  background: #fffaf0;
}

.desktop-theme-table-panel {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 3px 14px rgba(15, 23, 42, 0.04);
}

.table-container {
  overflow: hidden;
}

.pc-table {
  --el-table-border-color: #edf0f4;
  --el-table-header-bg-color: #f8fafc;
  --el-table-row-hover-bg-color: #fffaf0;
}

.pc-table :deep(.el-table__header-wrapper th.el-table__cell) {
  height: 46px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  background: #f8fafc;
}

.pc-table :deep(.el-table__body td.el-table__cell) {
  height: 52px;
  transition: background-color 0.16s ease, box-shadow 0.16s ease;
}

.pc-table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: #fffaf0;
}

.pc-table :deep(.el-table__body tr:hover > td.el-table__cell:first-child) {
  box-shadow: inset 3px 0 0 rgba(212, 175, 55, 0.9);
}

.theme-item-name {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 11px;
  color: #243042;
  font-weight: 700;
}

.theme-icon-tile {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(212, 175, 55, 0.26);
  border-radius: 8px;
  background: linear-gradient(135deg, #fff8e6, #fff);
}

.theme-icon {
  color: #9a740b;
  font-size: 17px;
}

.theme-name-text,
.description-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.description-text {
  display: block;
  max-width: 520px;
  color: #526071;
  font-size: 13px;
}

.description-text.is-empty {
  color: #a0a8b4;
}

.time-text {
  color: #7b8492;
  font-size: 13px;
}

.desktop-theme-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.desktop-theme-action {
  width: 34px;
  height: 34px;
  margin-left: 0;
  border-radius: 8px;
  font-size: 16px;
}

.desktop-theme-action--edit {
  color: #8a650b;
}

.desktop-theme-action--edit:hover,
.desktop-theme-action--edit:focus-visible {
  color: #6b4a05;
  background: rgba(212, 175, 55, 0.13);
}

.desktop-theme-action--delete {
  color: #d45454;
}

.desktop-theme-action--delete:hover,
.desktop-theme-action--delete:focus-visible {
  color: #b42323;
  background: rgba(239, 68, 68, 0.1);
}

.desktop-theme-action:focus-visible,
.desktop-theme-refresh:focus-visible {
  outline: 2px solid rgba(212, 175, 55, 0.62);
  outline-offset: 2px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 14px 16px;
  border-top: 1px solid #edf0f4;
  background: #fff;
}

.pagination-wrapper :deep(.el-pagination) {
  --el-pagination-bg-color: #f5f7fa;
  --el-pagination-hover-color: #8a650b;
}

.desktop-theme-empty {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.desktop-theme-empty-add {
  border-radius: 8px;
}

@media (min-width: 769px) and (max-width: 1180px) {
  .desktop-theme-toolbar {
    grid-template-columns: minmax(0, 1fr) 168px;
  }

  .desktop-theme-date {
    grid-column: 1;
  }

  .desktop-theme-toolbar-actions {
    grid-column: 2;
  }
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.sub-title {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
  display: block;
}

/* 统计信息栏 */
.stats-bar {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #f6f4ff 0%, #ebe7ff 100%);
  border-radius: 12px;
  padding: 14px 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(142, 125, 255, 0.1);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: #606266;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.stat-value.highlight {
  color: #8e7dff;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: #dcdfe6;
  margin: 0 20px;
}

/* 搜索卡片 */
.search-card {
  border-radius: 12px;
  border: none;
  margin-bottom: 20px;
}

.search-filter-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-row {
  display: flex;
  gap: 8px;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.custom-search {
  flex: 1;
}

.sort-select {
  width: 140px;
}

.date-picker {
  width: 280px;
}

.add-btn, .search-btn, .submit-btn {
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
  border: none;
  border-radius: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* PC端列表外壳 */
.theme-list-wrapper {
  background: transparent;
  position: relative;
  min-height: 200px;
}

.theme-list-inner {
  transition: transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28);
  will-change: transform;
}

/* 下拉刷新样式 */
.pull-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}

.indicator-content {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: #909399;
  padding-bottom: 10px;
}

.indicator-content .el-icon {
  font-size: 18px;
  transition: transform 0.3s;
}

/* =========== 移动端适配样式 =========== */

.mobile-list-container {
  padding: 0;
  background-color: transparent;
  border-radius: 0;
}

.mobile-filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 14px;
  margin-bottom: 14px;
  box-shadow:
    0 10px 28px -22px rgba(17, 24, 39, 0.36),
    inset 3px 0 0 rgba(212, 175, 55, 0.72);
}

.mobile-filter-summary {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-result {
  font-size: 13px;
  line-height: 1.35;
  color: var(--text-dark);
  font-weight: 700;
}

.mobile-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mobile-filter-chip {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(162, 155, 254, 0.12);
  color: var(--accent-purple-dark);
  border: 1px solid rgba(162, 155, 254, 0.22);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.mobile-card {
  position: relative;
  min-height: 88px;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 16px;
  padding: 14px 12px 14px 16px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  box-shadow:
    0 10px 28px -20px rgba(17, 24, 39, 0.36),
    0 3px 10px -8px rgba(212, 175, 55, 0.18);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
  cursor: pointer;
  border: 1px solid rgba(212, 175, 55, 0.12);
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}

.mobile-card:active {
  transform: scale(0.98);
  border-color: rgba(212, 175, 55, 0.3);
}

.mobile-card:last-child {
  margin-bottom: 0;
}

.mobile-card-spine {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 0;
  width: 4px;
  border-radius: 0 999px 999px 0;
  background: linear-gradient(180deg, var(--primary-gold), var(--accent-purple));
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08);
}

.mobile-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.icon-placeholder {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.14), rgba(162, 155, 254, 0.12));
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-gold-dark);
  font-size: 20px;
}

.card-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 5px;
}

.card-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.25;
}

.card-description {
  font-size: 13px;
  color: var(--text-light);
  line-height: 1.45;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.card-meta-pill {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.1);
  color: var(--primary-gold-dark);
  font-size: 11px;
  font-weight: 800;
}

.card-time {
  font-size: 12px;
  color: var(--text-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.mobile-card-right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-lighter);
  font-size: 18px;
  flex-shrink: 0;
}

.mobile-more {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--secondary-gray);
  color: var(--text-light);
  transition: transform var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
}

.mobile-more:active {
  transform: scale(0.94);
  background: rgba(162, 155, 254, 0.12);
  color: var(--accent-purple-dark);
}

/* 加载更多 */
.load-more-wrapper {
  display: flex;
  justify-content: center;
  padding: 22px 0 calc(22px + env(safe-area-inset-bottom));
  color: var(--text-light, #909399);
  font-size: 13px;
}

.scroll-sentinel {
  height: 1px;
  width: 100%;
}

/* 空结果筛选 */
.empty-filter-result {
  padding: 40px 20px;
  background: #fff;
  border-radius: 12px;
  margin-top: 16px;
}

/* 主题附加图片区块 */
.theme-editor-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:global(.theme-editor-dialog:not(.is-theme-editor-mobile) .el-dialog),
:global(.el-dialog.theme-editor-dialog:not(.is-theme-editor-mobile)) {
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 72px);
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 26px;
  background:
    radial-gradient(circle at 92% 0%, rgba(212, 175, 55, 0.2), transparent 30%),
    radial-gradient(circle at 0% 0%, rgba(162, 155, 254, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(250, 248, 255, 0.96));
  box-shadow:
    0 30px 80px rgba(41, 34, 24, 0.2),
    0 12px 28px rgba(41, 34, 24, 0.1);
}

:global(.theme-editor-dialog:not(.is-theme-editor-mobile) .el-dialog__header),
:global(.el-dialog.theme-editor-dialog:not(.is-theme-editor-mobile) .el-dialog__header) {
  display: none;
}

:global(.theme-editor-dialog:not(.is-theme-editor-mobile) .el-dialog__body),
:global(.el-dialog.theme-editor-dialog:not(.is-theme-editor-mobile) .el-dialog__body) {
  padding: 0;
  max-height: calc(100vh - 156px);
  overflow: hidden;
}

:global(.theme-editor-dialog:not(.is-theme-editor-mobile) .el-dialog__footer),
:global(.el-dialog.theme-editor-dialog:not(.is-theme-editor-mobile) .el-dialog__footer) {
  padding: 16px 28px 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: inset 0 16px 28px -30px rgba(41, 34, 24, 0.32);
}

.theme-editor-desktop-header {
  position: relative;
  display: flex;
  gap: 16px;
  padding: 28px 30px 22px;
  overflow: hidden;
  border-bottom: 1px solid rgba(212, 175, 55, 0.14);
  background:
    radial-gradient(circle at 90% 0%, rgba(212, 175, 55, 0.24), transparent 30%),
    linear-gradient(135deg, rgba(212, 175, 55, 0.16), rgba(162, 155, 254, 0.15)),
    rgba(255, 255, 255, 0.94);
}

.theme-editor-desktop-header::after {
  content: '';
  position: absolute;
  right: -46px;
  bottom: -70px;
  width: 176px;
  height: 176px;
  border-radius: 50%;
  background: rgba(212, 175, 55, 0.12);
  pointer-events: none;
}

.theme-editor-desktop-icon {
  width: 54px;
  height: 54px;
  flex: 0 0 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  color: var(--primary-gold-dark);
  font-size: 26px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow:
    inset 0 0 0 1px rgba(212, 175, 55, 0.24),
    0 16px 28px -20px rgba(17, 24, 39, 0.38);
}

.theme-editor-desktop-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.theme-editor-desktop-kicker {
  display: inline-flex;
  width: fit-content;
  margin-bottom: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.68);
  color: #8a6c14;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.theme-editor-desktop-title {
  margin: 0;
  color: #2f2a20;
  font-size: 26px;
  font-weight: 800;
  line-height: 1.16;
}

.theme-editor-desktop-copy p {
  max-width: 540px;
  margin: 8px 0 0;
  color: #6f6a7f;
  font-size: 14px;
  line-height: 1.7;
}

.theme-editor-desktop-close {
  position: absolute;
  top: 22px;
  right: 22px;
  z-index: 2;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(144, 147, 153, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  color: #7d7892;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.18s ease, transform 0.18s ease, color 0.18s ease;
}

.theme-editor-desktop-close:hover {
  color: #8a6c14;
  background: rgba(255, 255, 255, 0.94);
  transform: rotate(90deg);
}

.theme-editor-desktop-close:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
}

.theme-editor-body {
  min-height: 0;
  max-height: calc(100vh - 252px);
  overflow-y: auto;
  padding: 22px 28px 4px;
  overscroll-behavior: contain;
}

.theme-editor-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.theme-editor-section {
  width: 100%;
  padding: 18px;
  border: 1px solid rgba(212, 175, 55, 0.12);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.86)),
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.1), transparent 34%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 14px 34px -30px rgba(17, 24, 39, 0.52);
}

.theme-editor-section-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.theme-editor-section-header h4 {
  margin: 0;
  color: var(--text-dark);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.25;
}

.theme-editor-section-header p {
  margin: 5px 0 0;
  color: var(--text-light);
  font-size: 13px;
  line-height: 1.55;
}

.theme-editor-section :deep(.el-form-item) {
  margin-bottom: 16px;
}

.theme-editor-section :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.theme-editor-section :deep(.el-form-item__label) {
  margin-bottom: 8px;
  color: #5f5874;
  font-weight: 800;
  line-height: 1.2;
}

.theme-editor-section :deep(.el-input__wrapper),
.theme-editor-section :deep(.el-textarea__inner) {
  border: 1px solid rgba(212, 175, 55, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 8px 24px rgba(162, 155, 254, 0.06);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.theme-editor-section :deep(.el-input__wrapper) {
  min-height: 44px;
}

.theme-editor-section :deep(.el-textarea__inner) {
  min-height: 136px !important;
  padding: 12px 14px;
  line-height: 1.6;
}

.theme-editor-section :deep(.el-input__wrapper:hover),
.theme-editor-section :deep(.el-textarea__inner:hover) {
  border-color: rgba(162, 155, 254, 0.24);
}

.theme-editor-section :deep(.el-input__wrapper.is-focus),
.theme-editor-section :deep(.el-textarea__inner:focus) {
  border-color: rgba(162, 155, 254, 0.48);
  box-shadow:
    0 0 0 3px rgba(196, 181, 253, 0.2),
    0 12px 28px rgba(162, 155, 254, 0.1);
  background: rgba(255, 255, 255, 0.96);
}

.theme-editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.theme-editor-cancel,
.theme-editor-footer .submit-btn {
  min-width: 96px;
  min-height: 40px;
  border-radius: 12px;
  font-weight: 800;
}

.theme-additional-photos-section {
  width: 100%;
}

.theme-photo-grid,
.existing-theme-photos,
.new-theme-photos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.theme-photo-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(212, 175, 55, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.68);
}

.theme-photo-preview-wrap {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
}

.theme-photo-preview {
  width: 100%;
  height: 132px;
  border-radius: 14px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  overflow: hidden;
}

.theme-photo-remove {
  position: absolute;
  top: 6px;
  right: 6px;
}

.theme-image-error {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #c0c4cc;
  font-size: 24px;
}

.theme-photo-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.theme-photo-label-input {
  flex: 1;
  min-width: 0;
}

.theme-photo-add-card {
  width: 100%;
  height: 100%;
  min-height: 132px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--accent-purple-dark);
  font-size: 13px;
  font-weight: 700;
}

.theme-photo-upload :deep(.el-upload--picture-card) {
  width: 140px;
  height: 132px;
  border-radius: 16px;
  border: 1px dashed rgba(212, 175, 55, 0.3);
  background: rgba(255, 255, 255, 0.72);
}

.theme-photo-upload :deep(.el-upload--picture-card:hover) {
  border-color: #8e7dff;
}

.theme-editor-image-note {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 74px;
  padding: 16px;
  border: 1px dashed rgba(162, 155, 254, 0.28);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(162, 155, 254, 0.1), rgba(212, 175, 55, 0.08)),
    rgba(255, 255, 255, 0.74);
  color: #6f6a7f;
  font-size: 14px;
  font-weight: 800;
}

.theme-editor-image-note-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  color: #8e7dff;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 0 0 1px rgba(162, 155, 254, 0.16);
}

@media (max-width: 768px) {
  :global(.el-overlay-dialog:has(.is-theme-editor-mobile)) {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
    overflow: hidden;
  }

  :global(.dialog-fade-enter-active .el-overlay-dialog:has(.is-theme-editor-mobile)) {
    animation: theme-editor-overlay-fade-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  :global(.dialog-fade-leave-active .el-overlay-dialog:has(.is-theme-editor-mobile)) {
    animation: theme-editor-overlay-fade-out 0.22s cubic-bezier(0.4, 0, 1, 1) both;
  }

  :global(.el-dialog.is-theme-editor-mobile) {
    width: 100vw !important;
    min-width: 100vw;
    max-width: 100vw;
    flex: 0 0 100vw;
    box-sizing: border-box;
    max-height: 88vh;
    padding: 0;
    margin: 0 !important;
    border-radius: 20px 20px 0 0;
    overflow: hidden;
    background:
      linear-gradient(180deg, rgba(255, 252, 246, 0.98) 0%, rgba(255, 255, 255, 0.98) 36%),
      var(--bg-white);
    box-shadow: 0 -16px 42px rgba(17, 24, 39, 0.18);
    animation: theme-editor-sheet-enter 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    transform-origin: center bottom;
  }

  @keyframes theme-editor-overlay-fade-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes theme-editor-overlay-fade-out {
    from {
      opacity: 1;
    }

    to {
      opacity: 0;
    }
  }

  @keyframes theme-editor-sheet-enter {
    from {
      opacity: 0;
      transform: translate3d(0, 100%, 0);
    }

    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }

  :global(.dialog-fade-leave-active .el-dialog.is-theme-editor-mobile) {
    animation: theme-editor-sheet-leave 0.22s cubic-bezier(0.4, 0, 1, 1) both;
  }

  @keyframes theme-editor-sheet-leave {
    from {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }

    to {
      opacity: 0;
      transform: translate3d(0, 100%, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.el-dialog.is-theme-editor-mobile),
    :global(.dialog-fade-leave-active .el-dialog.is-theme-editor-mobile) {
      animation: none;
    }
  }

  :global(.el-dialog.is-theme-editor-mobile .el-dialog__header) {
    display: none;
  }

  :global(.el-dialog.is-theme-editor-mobile .el-dialog__body) {
    padding: 0;
    max-height: calc(88vh - 84px);
    overflow: hidden;
  }

  :global(.el-dialog.is-theme-editor-mobile .el-dialog__footer) {
    padding: 0;
  }

  .theme-editor-shell {
    max-height: calc(88vh - 84px);
  }

  .theme-editor-hero {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 18px 16px;
    background:
      radial-gradient(circle at 18% 18%, rgba(212, 175, 55, 0.2), transparent 34%),
      linear-gradient(135deg, rgba(212, 175, 55, 0.14), rgba(162, 155, 254, 0.13));
    border-bottom: 1px solid rgba(212, 175, 55, 0.18);
  }

  .theme-editor-hero::before {
    content: '';
    position: absolute;
    top: 8px;
    left: 50%;
    width: 42px;
    height: 4px;
    border-radius: 999px;
    background: rgba(184, 148, 31, 0.24);
    transform: translateX(-50%);
  }

  .theme-editor-hero-icon {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.72);
    color: var(--primary-gold-dark);
    font-size: 22px;
    box-shadow:
      inset 0 0 0 1px rgba(212, 175, 55, 0.18),
      0 10px 24px -18px rgba(17, 24, 39, 0.32);
  }

  .theme-editor-hero-copy {
    flex: 1;
    min-width: 0;
    padding-top: 6px;
  }

  .theme-editor-hero-copy h3 {
    margin: 0;
    color: var(--text-dark);
    font-size: 18px;
    font-weight: 800;
    line-height: 1.25;
  }

  .theme-editor-hero-copy p {
    margin: 4px 0 0;
    color: var(--text-light);
    font-size: 12px;
    line-height: 1.4;
  }

  .theme-editor-close {
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.82);
    color: var(--text-light);
    font-size: 18px;
    box-shadow: inset 0 0 0 1px rgba(212, 175, 55, 0.16);
    transition: transform var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
  }

  .theme-editor-close:active {
    transform: scale(0.94);
    color: var(--accent-purple-dark);
    background: rgba(255, 255, 255, 0.96);
  }

  .theme-editor-close:disabled {
    opacity: 0.5;
  }

  .theme-editor-body {
    padding: 14px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .theme-editor-form {
    gap: 14px;
    padding-bottom: 4px;
  }

  .theme-editor-section {
    padding: 14px;
    border: 1px solid rgba(212, 175, 55, 0.14);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 12px 30px -24px rgba(17, 24, 39, 0.36);
  }

  .theme-editor-section-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .theme-editor-section-header h4 {
    margin: 0;
    color: var(--text-dark);
    font-size: 15px;
    font-weight: 800;
    line-height: 1.25;
  }

  .theme-editor-section-header p {
    margin: 4px 0 0;
    color: var(--text-light);
    font-size: 12px;
    line-height: 1.45;
  }

  .theme-editor-section :deep(.el-form-item) {
    margin-bottom: 14px;
  }

  .theme-editor-section :deep(.el-form-item:last-child) {
    margin-bottom: 0;
  }

  .theme-editor-section :deep(.el-form-item__label) {
    margin-bottom: 6px;
    color: var(--text-dark);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.4;
  }

  .theme-editor-section :deep(.el-input__wrapper),
  .theme-editor-section :deep(.el-textarea__inner) {
    border: 1px solid rgba(212, 175, 55, 0.16);
    border-radius: 13px;
    background: #fbfaff;
    box-shadow: none;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
  }

  .theme-editor-section :deep(.el-input__wrapper) {
    min-height: 42px;
  }

  .theme-editor-section :deep(.el-textarea__inner) {
    min-height: 134px !important;
    padding: 12px;
    line-height: 1.55;
    resize: none;
  }

  .theme-editor-section :deep(.el-input__wrapper:hover),
  .theme-editor-section :deep(.el-textarea__inner:hover) {
    border-color: rgba(162, 155, 254, 0.38);
  }

  .theme-editor-section :deep(.el-input__wrapper.is-focus),
  .theme-editor-section :deep(.el-textarea__inner:focus) {
    border-color: var(--primary-gold);
    background: #fff;
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
  }

  .theme-photo-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }

  .theme-photo-item {
    padding: 8px;
    border: 1px solid rgba(212, 175, 55, 0.14);
    border-radius: 14px;
    background: rgba(245, 245, 247, 0.72);
  }

  .theme-photo-preview-wrap,
  .theme-photo-preview {
    height: 118px;
    border-radius: 12px;
  }

  .theme-photo-preview {
    border-color: rgba(212, 175, 55, 0.16);
  }

  .theme-photo-remove {
    top: 7px;
    right: 7px;
    width: 28px;
    height: 28px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
  }

  .theme-photo-label-input :deep(.el-input__wrapper) {
    min-height: 34px;
    border-radius: 10px;
    background: #fff;
  }

  .theme-photo-upload {
    width: 100%;
  }

  .theme-photo-upload :deep(.el-upload--picture-card) {
    width: 100%;
    height: 92px;
    border: 1px dashed rgba(162, 155, 254, 0.44);
    border-radius: 14px;
    background:
      linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(162, 155, 254, 0.1)),
      #fff;
  }

  .theme-photo-upload :deep(.el-upload--picture-card:hover) {
    border-color: var(--accent-purple);
  }

  .theme-photo-add-card {
    min-height: 90px;
    color: var(--accent-purple-dark);
  }

  .theme-photo-add-card .el-icon {
    font-size: 22px;
  }

  .theme-editor-image-note {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 72px;
    padding: 14px;
    border: 1px dashed rgba(212, 175, 55, 0.32);
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(162, 155, 254, 0.08));
    color: var(--primary-gold-dark);
    font-size: 13px;
    font-weight: 700;
    text-align: center;
  }

  .theme-editor-footer {
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(82px, 0.45fr) minmax(0, 1fr);
    gap: 10px;
    padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(212, 175, 55, 0.16);
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(14px);
  }

  .theme-editor-footer .el-button {
    width: 100%;
    min-height: 42px;
    margin: 0;
    border-radius: 13px;
    font-weight: 800;
  }

  .theme-editor-cancel {
    color: var(--text-light);
  }

  .existing-theme-photos,
  .new-theme-photos {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .theme-photo-preview {
    height: 100px;
  }

  .theme-photo-upload :deep(.el-upload--picture-card) {
    width: 100px;
    height: 100px;
  }
}

/* 响应式断点控制 */
@media (max-width: 768px) {
  .theme-management-container { padding: 12px; }

  .header-section { margin-bottom: 10px; }

  .page-title { font-size: 18px; }

  .sub-title {
    font-size: 11px;
    display: block;
    margin-top: 2px;
    line-height: 1.4;
    color: #909399;
    max-width: 200px;
  }

  .add-btn span { display: none; }
  .add-btn { width: 40px; height: 40px; border-radius: 50%; padding: 0; justify-content: center; }

  .stats-bar {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    margin-bottom: 8px;
    border-radius: 8px;
  }

  .stat-label { font-size: 11px; }
  .stat-value { font-size: 15px; }
  .stat-divider { height: 16px; margin: 0 10px; }

  .search-card {
    margin-bottom: 10px;
    overflow: hidden;
    border-radius: 8px;
  }

  .search-card :deep(.el-card__body) { padding: 12px; }

  .search-filter-container { gap: 8px; }

  .search-row { gap: 6px; }

  .filter-row {
    gap: 6px;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .sort-select {
    width: 120px;
    flex-shrink: 0;
  }

  .date-picker {
    width: 100%;
    min-width: 0;
    flex-shrink: 1;
  }

  /* 移动端三大控件圆润化 */
  .custom-search :deep(.el-input__wrapper),
  .sort-select :deep(.el-select__wrapper) {
    border-radius: 10px;
    border-color: #e8e4f0;
    background: #fbfaff;
    box-shadow: none;
    transition: border-color 0.25s, box-shadow 0.25s;
  }

  /* 日期区间选择器需独立处理 —— 其内部结构为 .el-date-editor--daterange.el-range-editor.el-input__wrapper */
  .date-picker :deep(.el-input__wrapper) {
    border-radius: 10px !important;
    border: 1px solid #e8e4f0 !important;
    background: #fbfaff !important;
    box-shadow: none !important;
    transition: border-color 0.25s, box-shadow 0.25s;
  }

  .date-picker :deep(.el-range-input) {
    background: transparent;
    font-size: 13px;
  }

  .date-picker :deep(.el-range-separator) {
    color: #c0b8d0;
    font-size: 12px;
  }

  .custom-search :deep(.el-input__wrapper:hover),
  .sort-select :deep(.el-select__wrapper:hover) {
    border-color: #c5b8f0;
  }

  .date-picker :deep(.el-input__wrapper:hover) {
    border-color: #c5b8f0 !important;
  }

  .custom-search :deep(.el-input.is-focus .el-input__wrapper),
  .sort-select :deep(.el-select.is-focus .el-select__wrapper) {
    border-color: #8e7dff;
    box-shadow: 0 0 0 3px rgba(142, 125, 255, 0.08);
  }

  .date-picker :deep(.is-active.el-input__wrapper) {
    border-color: #8e7dff !important;
    box-shadow: 0 0 0 3px rgba(142, 125, 255, 0.08) !important;
  }

  .search-btn {
    border-radius: 10px;
    height: 36px;
    padding: 0 14px;
    font-size: 13px;
  }

  .hidden-xs-only { display: none !important; }

  .theme-list-wrapper {
    box-shadow: none !important;
    background: transparent !important;
    padding: 0;
    min-height: auto;
  }

  .desktop-view {
    display: none;
  }

  .mobile-list-container {
    display: block;
  }
}

@media (min-width: 769px) {
  .visible-xs-only { display: none !important; }
  .desktop-view { display: block; }
}

@media (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .theme-management-container { padding: 12px; }

  .header-section { margin-bottom: 10px; }

  .page-title { font-size: 18px; }

  .add-btn span { display: none; }

  .add-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    padding: 0;
    justify-content: center;
  }

  .sub-title {
    font-size: 11px;
    display: block;
    margin-top: 2px;
    line-height: 1.4;
    color: #909399;
    max-width: 200px;
  }

  .stats-bar {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    margin-bottom: 8px;
    border-radius: 8px;
  }

  .stat-label { font-size: 11px; }
  .stat-value { font-size: 15px; }
  .stat-divider { height: 16px; margin: 0 10px; }

  .search-card {
    margin-bottom: 10px;
    overflow: hidden;
    border-radius: 8px;
  }

  .search-card :deep(.el-card__body) { padding: 12px; }

  .search-filter-container { gap: 8px; }

  .search-row { gap: 6px; }

  .filter-row {
    gap: 6px;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .sort-select {
    width: 120px;
    flex-shrink: 0;
  }

  .date-picker {
    width: 100%;
    min-width: 0;
    flex-shrink: 1;
  }

  /* 移动端三大控件圆润化 */
  .custom-search :deep(.el-input__wrapper),
  .sort-select :deep(.el-select__wrapper) {
    border-radius: 10px;
    border-color: #e8e4f0;
    background: #fbfaff;
    box-shadow: none;
    transition: border-color 0.25s, box-shadow 0.25s;
  }

  /* 日期区间选择器需独立处理 —— 其内部结构为 .el-date-editor--daterange.el-range-editor.el-input__wrapper */
  .date-picker :deep(.el-input__wrapper) {
    border-radius: 10px !important;
    border: 1px solid #e8e4f0 !important;
    background: #fbfaff !important;
    box-shadow: none !important;
    transition: border-color 0.25s, box-shadow 0.25s;
  }

  .date-picker :deep(.el-range-input) {
    background: transparent;
    font-size: 13px;
  }

  .date-picker :deep(.el-range-separator) {
    color: #c0b8d0;
    font-size: 12px;
  }

  .custom-search :deep(.el-input__wrapper:hover),
  .sort-select :deep(.el-select__wrapper:hover) {
    border-color: #c5b8f0;
  }

  .date-picker :deep(.el-input__wrapper:hover) {
    border-color: #c5b8f0 !important;
  }

  .custom-search :deep(.el-input.is-focus .el-input__wrapper),
  .sort-select :deep(.el-select.is-focus .el-select__wrapper) {
    border-color: #8e7dff;
    box-shadow: 0 0 0 3px rgba(142, 125, 255, 0.08);
  }

  .date-picker :deep(.is-active.el-input__wrapper) {
    border-color: #8e7dff !important;
    box-shadow: 0 0 0 3px rgba(142, 125, 255, 0.08) !important;
  }

  .search-btn {
    border-radius: 10px;
    height: 36px;
    padding: 0 14px;
    font-size: 13px;
  }

  .hidden-xs-only,
  .desktop-view {
    display: none !important;
  }

  .visible-xs-only,
  .mobile-list-container {
    display: block !important;
  }

  .theme-list-wrapper {
    box-shadow: none !important;
    background: transparent !important;
    padding: 0;
    min-height: auto;
  }

  .existing-theme-photos,
  .new-theme-photos {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .theme-photo-preview {
    height: 100px;
  }

  .theme-photo-upload :deep(.el-upload--picture-card) {
    width: 100px;
    height: 100px;
  }
}
</style>
