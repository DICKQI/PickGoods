<template>
  <div class="ip-character-management-container">
    <!-- 顶部操作区 -->
    <div class="header-section">
      <div class="title-wrapper">
        <h2 class="page-title">IP作品与角色管理</h2>
        <span class="sub-title">管理您的作品分类及其角色</span>
      </div>

      <!-- 合并后的操作按钮 -->
      <div class="header-actions desktop-create-actions" v-if="authStore.isAdmin">
        <el-dropdown trigger="click" @command="handleActionCommand">
          <el-button type="primary" class="action-dropdown-btn">
            <el-icon class="icon-left"><Plus /></el-icon>
            <span>新增 / 导入</span>
            <el-icon class="icon-right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu class="custom-dropdown-menu">
              <el-dropdown-item command="bgm">
                <div class="menu-item-content">
                  <el-icon><Search /></el-icon>
                  <span>从 Bangumi 导入</span>
                  <el-tag size="small" type="info" effect="plain" class="menu-tag">推荐</el-tag>
                </div>
              </el-dropdown-item>
              <el-dropdown-item divided command="ip">
                <div class="menu-item-content">
                  <el-icon><Collection /></el-icon>
                  <span>新增作品 (IP)</span>
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="character">
                <div class="menu-item-content">
                  <el-icon><UserFilled /></el-icon>
                  <span>新增角色</span>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div class="mobile-create-actions" v-if="authStore.isAdmin">
        <el-button
          type="primary"
          class="mobile-add-btn"
          circle
          title="新增 / 导入"
          aria-label="新增 / 导入"
          @click="openMobileAddSheet"
        >
          <el-icon><Plus /></el-icon>
        </el-button>
      </div>
    </div>

    <MobileActionSheet
      v-if="authStore.isAdmin"
      v-model="mobileAddSheetVisible"
      title="新增 / 导入"
      :actions="ipMobileCreateActions"
      @select="handleMobileCreateAction"
    />

    <!-- 搜索与筛选卡片 -->
    <el-card class="search-card" shadow="never">
      <div class="search-filter-container">
        <div class="search-flex">
          <el-input
            v-model="searchText"
            placeholder="搜索作品名称或关键词..."
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
            class="custom-search"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button class="search-btn" type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            <span>搜索</span>
          </el-button>
        </div>
        <div class="filter-flex">
          <el-select
            v-model="selectedSubjectTypes"
            placeholder="筛选作品类型（可多选）"
            multiple
            clearable
            collapse-tags
            collapse-tags-tooltip
            @change="handleSearch"
            class="filter-select"
            style="width: 100%"
          >
            <el-option label="书籍" :value="1" />
            <el-option label="动画" :value="2" />
            <el-option label="音乐" :value="3" />
            <el-option label="游戏" :value="4" />
            <el-option label="三次元/特摄" :value="6" />
          </el-select>
        </div>
      </div>
    </el-card>

    <!-- 内容展示区 -->
    <div v-loading="loading" class="content-body">
      <!-- PC端：精致的表格 -->
      <!-- 修改点：data绑定sortedIpList，添加sort-change事件 -->
      <div class="desktop-view">
        <el-table
          ref="tableRef"
          :data="sortedIpList"
          border-radius="12"
          style="width: 100%"
          row-key="id"
          @expand-change="handleTableExpandChange"
          @sort-change="handleSortChange"
        >
          <el-table-column v-if="authStore.isAdmin" label="排序" width="80" align="center">
            <template #default>
              <div class="drag-handle" @click.stop>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
            </template>
          </el-table-column>
          <el-table-column type="expand" width="50">
            <template #default="{ row }">
              <div class="character-expand-section">
                <div class="expand-header">
                  <span class="expand-title">角色列表</span>
                  <el-button
                    v-if="authStore.isAdmin"
                    size="small"
                    type="primary"
                    text
                    @click="handleAddCharacterForIP(row)"
                  >
                    <el-icon><Plus /></el-icon>
                    为该IP添加角色
                  </el-button>
                </div>
                <div v-loading="characterLoadingMap[row.id]" class="character-content">
                  <template v-if="characterMap[row.id]?.length">
                    <div class="character-grid character-grid--desktop">
                      <div
                        v-for="char in characterMap[row.id]"
                        :key="char.id"
                        class="character-tile"
                        :class="{ clickable: authStore.isAdmin }"
                        @click="authStore.isAdmin && handleEditCharacter(char)"
                      >
                        <el-avatar :size="40" :src="char.avatar || undefined" shape="square" class="char-avatar tile-avatar">
                          <el-icon><UserFilled /></el-icon>
                        </el-avatar>
                        <div class="character-name-compact" :title="char.name">{{ char.name }}</div>

                        <el-button
                          v-if="authStore.isAdmin"
                          class="tile-delete-btn"
                          size="small"
                          text
                          type="danger"
                          @click.stop="handleDeleteCharacter(char)"
                          title="删除"
                        >
                          <el-icon><Delete /></el-icon>
                        </el-button>
                      </div>
                    </div>
                  </template>
                  <el-empty
                    v-else-if="!characterLoadingMap[row.id]"
                    description="该作品下暂无角色"
                    :image-size="80"
                  />
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 修改点：添加 sortable="custom" 和 prop -->
          <el-table-column prop="name" label="作品名称" min-width="180" sortable="custom">
            <template #default="{ row }">
              <span class="table-name">
                {{ row.name }}
                <el-tooltip
                  v-if="row.bgm_subject_id"
                  :content="`已绑定 Bangumi (ID: ${row.bgm_subject_id})`"
                  placement="top"
                >
                  <el-icon class="bgm-bound-icon" :size="14"><Link /></el-icon>
                </el-tooltip>
              </span>
            </template>
          </el-table-column>

          <!-- 修改点：添加 sortable="custom" 和 prop -->
          <el-table-column prop="subject_type" label="作品类型" width="120" align="center" sortable="custom">
            <template #default="{ row }">
              <el-tag
                v-if="row.subject_type"
                size="small"
                effect="plain"
                class="subject-type-tag"
                :type="getSubjectTypeTagType(row.subject_type)"
              >
                {{ getSubjectTypeLabel(row.subject_type) }}
              </el-tag>
              <span v-else class="no-type">-</span>
            </template>
          </el-table-column>

          <el-table-column label="检索关键词" min-width="250">
            <template #default="{ row }">
              <div class="tag-group">
                <el-tag
                  v-for="keyword in row.keywords || []"
                  :key="keyword.id"
                  effect="plain"
                  round
                  size="small"
                  class="custom-tag"
                >
                  {{ keyword.value }}
                </el-tag>
              </div>
            </template>
          </el-table-column>

          <!-- 修改点：添加 sortable="custom" 和 prop="character_count" -->
          <el-table-column prop="character_count" label="角色数量" width="120" align="center" sortable="custom">
            <template #default="{ row }">
              <span class="character-count">{{ row.character_count ?? (characterMap[row.id]?.length || 0) }}</span>
            </template>
          </el-table-column>

          <el-table-column v-if="authStore.isAdmin" label="操作" width="175" align="right" fixed="right">
            <template #default="{ row }">
              <div class="action-inline">
                <el-tooltip
                  content="从 Bangumi 更新角色（增量同步）"
                  placement="top"
                  :show-after="500"
                >
                  <el-button
                    link
                    type="info"
                    class="bgm-sync-btn"
                    @click="handleOpenBGMSync(row)"
                    title="从 BGM 更新"
                  >
                    <el-icon :size="16"><Refresh /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-button link type="primary" @click="handleEditIP(row)" title="编辑">
                  <el-icon :size="16"><Edit /></el-icon>
                </el-button>
                <el-button link type="danger" @click="handleDeleteIP(row)" title="删除">
                  <el-icon :size="16"><Delete /></el-icon>
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 移动端：现代化卡片 -->
      <div
        class="mobile-view pull-refresh-wrapper"
        ref="scrollContainerRef"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <!-- 下拉加载提示区 -->
        <div
          class="pull-indicator"
          :style="{
            height: `${pullDistance}px`,
            opacity: pullDistance > 0 ? 1 : 0,
            transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.25, 0.8, 0.5, 1)'
          }"
        >
          <div class="indicator-content">
            <el-icon v-if="isRefreshing" class="is-loading"><Loading /></el-icon>
            <el-icon v-else :style="{ transform: `rotate(${pullDistance > 50 ? 180 : 0}deg)` }"><Top /></el-icon>
            <span class="indicator-text">
              {{ isRefreshing ? '正在刷新...' : (pullDistance > 50 ? '释放刷新' : '下拉刷新') }}
            </span>
          </div>
        </div>

        <!-- 内容区域 -->
        <!-- 修改点：遍历 sortedIpList，保持顺序一致 -->
        <div class="mobile-view-inner" ref="mobileListRef" :class="{ 'is-sorting': isSorting }">
          <div
            v-for="item in sortedIpList"
            :key="item.id"
            class="ip-card-item"
            :class="{
              'is-expanded': expandedIPs.includes(item.id),
              'is-sticky-active': activeStickyIPId === item.id,
            }"
            :data-ip-id="item.id"
            :style="getMobileStickyCardStyle(item.id)"
          >
            <div
              class="ip-card-sticky-shell"
              :class="{ 'is-stuck': activeStickyIPId === item.id }"
              :style="getMobileStickyShellStyle(item.id)"
            >
              <div
                class="ip-swipe-item"
                :class="{ open: openSwipeId === item.id, dragging: swipeTouch.id === item.id && swipeTouch.dragging }"
                @touchstart="onCardTouchStart($event, item.id)"
                @touchmove="onCardTouchMove($event)"
                @touchend="onCardTouchEnd"
                @touchcancel="onCardTouchEnd"
              >
                <div class="swipe-actions" v-if="authStore.isAdmin">
                  <button class="swipe-action-btn sync" type="button" @click.stop="handleOpenBGMSync(item)">
                    <el-icon><Refresh /></el-icon>
                    <span>更新</span>
                  </button>
                  <button class="swipe-action-btn edit" type="button" @click.stop="handleEditIP(item)">
                    <el-icon><Edit /></el-icon>
                    <span>编辑</span>
                  </button>
                  <button class="swipe-action-btn delete" type="button" @click.stop="handleDeleteIP(item)">
                    <el-icon><Delete /></el-icon>
                    <span>删除</span>
                  </button>
                </div>

                <div class="swipe-content" :style="getSwipeContentStyle(item.id)">
                  <div class="ip-card-spine" aria-hidden="true"></div>
                  <div class="card-main" @click="handleMobileCardClick(item.id)">
                    <div class="card-info">
                      <div class="name-row">
                        <div class="name-text">
                          <span class="name-label">{{ item.name }}</span>
                          <el-icon
                            v-if="item.bgm_subject_id"
                            class="bgm-bound-icon-mobile"
                            :size="14"
                          ><Link /></el-icon>
                        </div>
                      </div>
                      <div v-if="item.subject_type" class="meta-row">
                        <span class="subject-type-pill">
                          {{ getSubjectTypeLabel(item.subject_type) }}
                        </span>
                      </div>
                      <div class="keyword-row">
                        <span v-for="keyword in item.keywords || []" :key="keyword.id" class="mini-tag">
                          {{ keyword.value }}
                        </span>
                        <span v-if="!item.keywords?.length" class="no-tag">暂无关键词</span>
                      </div>
                    </div>
                    <div class="card-actions-panel">
                      <div
                        class="character-count-chip"
                        :aria-label="`角色数量：${item.character_count ?? (characterMap[item.id]?.length || 0)}`"
                      >
                        <span class="count-value">{{ item.character_count ?? (characterMap[item.id]?.length || 0) }}</span>
                        <span class="count-label">角色</span>
                      </div>
                      <div class="card-control-row">
                        <div class="card-drag-handle mobile-drag-handle" v-if="authStore.isAdmin" @click.stop>
                          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                          </svg>
                        </div>
                        <button
                          class="mobile-expand-indicator"
                          type="button"
                          :aria-label="expandedIPs.includes(item.id) ? '收起角色列表' : '展开角色列表'"
                          @click.stop="handleMobileCardClick(item.id)"
                        >
                          <el-icon><ArrowRight /></el-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 展开的角色列表 -->
            <Transition name="mobile-expand">
              <div
                v-if="expandedIPs.includes(item.id)"
                v-loading="characterLoadingMap[item.id]"
                class="character-list"
              >
                <div class="character-list-header">
                  <span>角色列表</span>
                  <el-button
                    v-if="authStore.isAdmin"
                    size="small"
                    type="primary"
                    text
                    @click.stop="handleAddCharacterForIP(item)"
                  >
                    <el-icon><Plus /></el-icon>
                    添加角色
                  </el-button>
                </div>
                <template v-if="characterMap[item.id]?.length">
                  <div class="character-grid character-grid--mobile">
                    <div
                      v-for="char in characterMap[item.id]"
                      :key="char.id"
                      class="character-tile"
                      :class="{ clickable: authStore.isAdmin }"
                      @click="authStore.isAdmin && handleEditCharacter(char)"
                    >
                      <el-avatar :size="46" :src="char.avatar || undefined" shape="square" class="char-avatar tile-avatar">
                        <el-icon><UserFilled /></el-icon>
                      </el-avatar>
                      <div class="character-name-compact" :title="char.name">{{ char.name }}</div>

                      <el-button
                        v-if="authStore.isAdmin"
                        class="tile-delete-btn"
                        size="small"
                        text
                        type="danger"
                        @click.stop="handleDeleteCharacter(char)"
                        title="删除"
                      >
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                  </div>
                </template>
                <el-empty v-else description="暂无角色" :image-size="60" />
              </div>
            </Transition>
          </div>
        </div>

      </div>
      <el-empty v-if="!loading && ipList.length === 0" description="没有找到相关的作品" />
    </div>

    <!-- 刷新按钮 - 右下角悬浮（仅PC端） -->
    <div class="refresh-fab hidden-xs-only" @click="handleRefresh" :class="{ loading: loading }">
      <el-icon v-if="!loading"><Refresh /></el-icon>
      <el-icon v-else class="is-loading"><Loading /></el-icon>
    </div>

    <!-- IP编辑弹窗 (保持不变) -->
    <el-dialog
      v-model="ipDialogVisible"
      :title="ipDialogTitle"
      :width="dialogWidth"
      class="custom-dialog"
      align-center
    >
      <el-form :model="ipFormData" :rules="ipFormRules" ref="ipFormRef" label-position="top">
        <el-form-item label="作品官方全称" prop="name">
          <el-input v-model="ipFormData.name" placeholder="例如：崩坏：星穹铁道" />
        </el-form-item>
        <el-form-item label="作品类型">
          <el-select
            v-model="ipFormData.subject_type"
            placeholder="选择作品类型（可选）"
            clearable
            style="width: 100%"
          >
            <el-option label="书籍" :value="1" />
            <el-option label="动画" :value="2" />
            <el-option label="音乐" :value="3" />
            <el-option label="游戏" :value="4" />
            <el-option label="三次元/特摄" :value="6" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联关键词 (别名/缩写)">
          <div class="keyword-manager-box">
            <div class="input-inline">
              <el-input
                v-model="newKeyword"
                placeholder="输入别名后点添加"
                @keyup.enter="handleAddKeyword"
              >
                <template #append>
                  <el-button @click="handleAddKeyword">添加</el-button>
                </template>
              </el-input>
            </div>
            <div class="tags-wrapper">
              <el-tag
                v-for="(keyword, index) in ipFormData.keywords"
                :key="index"
                closable
                round
                @close="handleRemoveKeyword(index)"
              >
                {{ keyword }}
              </el-tag>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="ipDialogVisible = false">取消</el-button>
          <el-button type="primary" class="submit-btn" @click="handleSubmitIP" :loading="submitting">
            保存更改
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- BGM导入弹窗 (保持不变) -->
    <el-dialog
      v-model="bgmDialogVisible"
      :width="bgmDialogWidth"
      class="custom-dialog bgm-dialog"
      align-center
      :close-on-click-modal="false"
    >
      <template #header>
        <div class="bgm-dialog-header">
          <span class="bgm-dialog-kicker">{{ bgmDialogMode === 'import' ? 'Bangumi Import' : 'Bangumi Sync' }}</span>
          <h3 class="bgm-dialog-title">{{ bgmDialogMode === 'import' ? '从 Bangumi 导入角色' : '从 Bangumi 更新角色' }}</h3>
          <p class="bgm-dialog-subtitle">
            从 Bangumi 获取角色资料并整理成可批量导入的候选列表，帮助你更快完成作品角色建档。
          </p>
        </div>
      </template>
      <div class="bgm-import-container">
        <!-- 搜索阶段 -->
        <div v-if="bgmStep === 'search'" class="bgm-step-search">
          <div class="bgm-flow-panel">
            <el-form @submit.prevent="handleBGMSearch" class="bgm-search-form" label-width="136px">
              <el-form-item label="IP作品名称">
                <el-input
                  v-model="bgmSearchInput"
                  placeholder="例如：崩坏：星穹铁道"
                  clearable
                  @keyup.enter="handleBGMSearch"
                  :disabled="bgmSearching"
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="作品类型（可选）">
                <el-select
                  v-model="bgmSubjectType"
                  placeholder="选择作品类型（不选则搜索所有类型）"
                  clearable
                  :disabled="bgmSearching"
                  style="width: 100%"
                >
                  <el-option label="所有类型" :value="undefined" />
                  <el-option label="书籍" :value="1" />
                  <el-option label="动画" :value="2" />
                  <el-option label="音乐" :value="3" />
                  <el-option label="游戏" :value="4" />
                  <el-option label="三次元/特摄" :value="6" />
                </el-select>
              </el-form-item>
              <div class="bgm-search-actions">
                <el-button
                  type="primary"
                  class="bgm-dialog-submit brand-add-btn brand-add-btn--compact"
                  @click="handleBGMSearch"
                  :loading="bgmSearching"
                  :disabled="!bgmSearchInput.trim()"
                >
                  搜索BGM
                </el-button>
              </div>
            </el-form>
          </div>
        </div>

        <!-- 搜索中等待页面 -->
        <div v-if="bgmStep === 'searching'" class="bgm-step-searching">
          <div class="searching-content">
            <el-icon class="searching-icon"><Loading /></el-icon>
            <h3>正在搜索Bangumi...</h3>
            <p>请耐心等待，正在从Bangumi API获取角色信息</p>
            <div class="searching-progress">
              <el-progress :percentage="50" :indeterminate="true" />
            </div>
          </div>
        </div>

        <!-- 作品列表展示 -->
        <div v-if="bgmStep === 'subjects'" class="bgm-step-subjects">
          <div class="bgm-results-shell">
            <div class="results-header">
              <h3>选择作品</h3>
              <p class="results-subtitle">找到 {{ bgmSubjects.length }} 个相关作品，请点击选择一个</p>
            </div>
            <div class="bgm-subjects-list">
               <div
                 v-for="subject in bgmSubjects"
                 :key="subject.id"
                 class="bgm-subject-item"
                 @click="handleBGMSelectSubject(subject)"
               >
                  <el-image
                    :src="subject.image"
                    class="bgm-subject-cover"
                    fit="cover"
                    loading="lazy"
                  >
                    <template #error>
                      <div class="image-slot">
                        <el-icon><Picture /></el-icon>
                      </div>
                    </template>
                  </el-image>
                  <div class="bgm-subject-info">
                    <h4 class="subject-name" :title="subject.name">{{ subject.name }}</h4>
                    <div class="subject-meta">
                      <el-tag size="small" type="info">{{ subject.type_name }}</el-tag>
                      <span class="subject-cn" v-if="subject.name_cn && subject.name_cn !== subject.name">{{ subject.name_cn }}</span>
                    </div>
                  </div>
                  <div class="bgm-subject-arrow">
                    <el-icon><ArrowRight /></el-icon>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <!-- 获取角色中等待页面 -->
        <div v-if="bgmStep === 'loading-characters'" class="bgm-step-searching">
          <div class="searching-content">
            <el-icon class="searching-icon"><Loading /></el-icon>
            <h3>正在获取角色列表...</h3>
            <p>正在从Bangumi API获取选中作品的角色信息</p>
          </div>
        </div>

        <!-- 搜索结果展示 -->
        <div v-if="bgmStep === 'results'" class="bgm-step-results">
          <div class="bgm-results-shell">
            <div class="results-header">
              <h3>搜索结果：{{ bgmSearchResult?.ip_name }}</h3>
              <p class="results-subtitle">找到 {{ bgmSearchResult?.characters.length || 0 }} 个角色，请勾选需要导入的角色</p>
            </div>
            <div class="results-actions-top">
              <el-button size="small" @click="handleBGMSelectAll">全选</el-button>
              <el-button size="small" @click="handleBGMSelectNone">取消全选</el-button>
              <span class="selected-count">已选择 {{ bgmSelectedCharacters.length }} 个角色</span>
            </div>
            <div class="results-filter">
              <el-input
                v-model="bgmCharacterKeyword"
                size="small"
                placeholder="按角色名搜索"
                clearable
                class="results-filter-input"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </div>
            <div class="character-list-container">
              <div
                v-for="(char, index) in bgmSearchResult?.characters || []"
                :key="index"
                class="bgm-character-item"
                :class="{ selected: bgmSelectedCharacters.includes(index) }"
                v-show="
                  !bgmCharacterKeyword.trim() ||
                  char.name.toLowerCase().includes(bgmCharacterKeyword.trim().toLowerCase())
                "
                @click="handleBGMToggleCharacter(index)"
              >
                <el-checkbox
                  :model-value="bgmSelectedCharacters.includes(index)"
                  @change="handleBGMToggleCharacter(index)"
                  @click.stop
                />
                <el-avatar :size="50" :src="char.avatar || undefined" shape="square" class="char-avatar">
                  <el-icon><UserFilled /></el-icon>
                </el-avatar>
                <div class="char-info">
                  <div class="char-name">{{ char.name }}</div>
                  <div class="char-relation">{{ char.relation }}</div>
                </div>
              </div>
            </div>
            <div v-if="!bgmSearchResult?.characters.length" class="empty-results">
              <el-empty description="未找到角色信息" />
            </div>
          </div>
        </div>

        <!-- 导入中 -->
        <div v-if="bgmStep === 'importing'" class="bgm-step-importing">
          <div class="importing-content">
            <el-icon class="importing-icon"><Loading /></el-icon>
            <h3>正在导入角色...</h3>
            <p>请稍候，正在将选中的角色添加到数据库</p>
            <div class="importing-progress">
              <el-progress :percentage="50" :indeterminate="true" />
            </div>
          </div>
        </div>

        <!-- 导入结果 -->
        <div v-if="bgmStep === 'imported'" class="bgm-step-imported">
          <div class="imported-content">
            <el-icon class="success-icon"><CircleCheck /></el-icon>
            <h3>导入完成！</h3>
            <div class="import-summary bgm-summary-card">
              <p>成功创建：<strong>{{ bgmImportResult?.created || 0 }}</strong> 个角色</p>
              <p>已存在跳过：<strong>{{ bgmImportResult?.skipped || 0 }}</strong> 个角色</p>
            </div>
            <div class="import-details" v-if="bgmImportResult?.details.length">
              <el-collapse>
                <el-collapse-item title="查看详情" name="details">
                  <div
                    v-for="(detail, idx) in bgmImportResult.details"
                    :key="idx"
                    class="detail-item"
                    :class="detail.status"
                  >
                    <el-icon>
                      <CircleCheck v-if="detail.status === 'created'" />
                      <Warning v-else-if="detail.status === 'already_exists'" />
                      <CircleClose v-else />
                    </el-icon>
                    <span class="detail-text">
                      {{ detail.ip_name }} - {{ detail.character_name }}
                      <span class="detail-status">
                        ({{ detail.status === 'created' ? '已创建' : detail.status === 'already_exists' ? '已存在' : '错误' }})
                      </span>
                    </span>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="bgm-dialog-footer">
          <el-button v-if="bgmStep === 'search'" class="bgm-dialog-cancel" @click="bgmDialogVisible = false">取消</el-button>
          <el-button v-if="bgmStep === 'subjects'" class="bgm-dialog-cancel" @click="handleBGMReset">返回搜索</el-button>
          <el-button
            v-if="bgmStep === 'results'"
            class="bgm-dialog-cancel"
            @click="bgmStep = 'subjects'"
          >
            返回作品列表
          </el-button>
          <el-button
            v-if="bgmStep === 'results'"
            type="primary"
            class="bgm-dialog-submit brand-add-btn brand-add-btn--compact"
            @click="handleBGMConfirmImport"
            :disabled="bgmSelectedCharacters.length === 0"
            :loading="bgmImporting"
          >
            确认导入 ({{ bgmSelectedCharacters.length }})
          </el-button>
          <el-button
            v-if="bgmStep === 'imported'"
            type="primary"
            class="bgm-dialog-submit brand-add-btn brand-add-btn--compact"
            @click="handleBGMClose"
          >
            完成
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- BGM 增量更新弹窗 -->
    <el-dialog
      v-model="bgmSyncDialogVisible"
      :width="bgmDialogWidth"
      class="custom-dialog bgm-dialog"
      align-center
      :close-on-click-modal="false"
    >
      <template #header>
        <div class="bgm-dialog-header">
          <span class="bgm-dialog-kicker">{{ bgmDialogMode === 'import' ? 'Bangumi Import' : 'Bangumi Sync' }}</span>
          <h3 class="bgm-dialog-title">{{ bgmDialogMode === 'import' ? '从 Bangumi 导入角色' : '从 Bangumi 更新角色' }}</h3>
          <p class="bgm-dialog-subtitle">
            对比本地角色与 Bangumi 最新条目，预览差异后再应用更新，保持角色资料与关联信息一致。
          </p>
        </div>
      </template>
      <div class="bgm-import-container">
        <!-- 步骤：未绑定 subject 时的搜索回填 -->
        <div v-if="bgmSyncStep === 'link_search'" class="bgm-step-search">
          <div class="bgm-flow-panel">
            <div class="bgm-sync-alert-card">
              <el-alert
                type="info"
                :closable="false"
                show-icon
                class="bgm-sync-alert"
              >
                <template #title>
                  该作品尚未关联 Bangumi 条目。请搜索并选择对应的 BGM 作品以建立关联，后续更新将自动识别。
                </template>
              </el-alert>
            </div>
            <el-form @submit.prevent="handleBGMSyncSearch" class="bgm-search-form" label-width="136px">
              <el-form-item label="搜索关键词">
                <el-input
                  v-model="bgmSyncSearchInput"
                  :placeholder="bgmSyncTargetIP?.name || '例如：崩坏：星穹铁道'"
                  clearable
                  @keyup.enter="handleBGMSyncSearch"
                  :disabled="bgmSyncSearching"
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="作品类型（可选）">
                <el-select
                  v-model="bgmSyncSubjectType"
                  placeholder="选择作品类型（不选则搜索所有类型）"
                  clearable
                  :disabled="bgmSyncSearching"
                  style="width: 100%"
                >
                  <el-option label="所有类型" :value="undefined" />
                  <el-option label="书籍" :value="1" />
                  <el-option label="动画" :value="2" />
                  <el-option label="音乐" :value="3" />
                  <el-option label="游戏" :value="4" />
                  <el-option label="三次元/特摄" :value="6" />
                </el-select>
              </el-form-item>
              <div class="bgm-search-actions">
                <el-button
                  type="primary"
                  class="bgm-dialog-submit brand-add-btn brand-add-btn--compact"
                  @click="handleBGMSyncSearch"
                  :loading="bgmSyncSearching"
                  :disabled="!bgmSyncSearchInput.trim()"
                >
                  搜索BGM
                </el-button>
              </div>
            </el-form>
          </div>
        </div>

        <!-- 步骤：搜索中 -->
        <div v-if="bgmSyncStep === 'link_searching'" class="bgm-step-searching">
          <div class="searching-content">
            <el-icon class="searching-icon"><Loading /></el-icon>
            <h3>正在搜索 Bangumi...</h3>
            <el-progress :percentage="50" :indeterminate="true" />
          </div>
        </div>

        <!-- 步骤：选择 subject（仅未绑定时出现） -->
        <div v-if="bgmSyncStep === 'link_subjects'" class="bgm-step-subjects">
          <div class="bgm-results-shell">
            <div class="results-header">
              <h3>选择作品</h3>
              <p class="results-subtitle">找到 {{ bgmSyncSubjects.length }} 个相关作品，请点击选择一个进行关联</p>
            </div>
            <div class="bgm-subjects-list">
              <div
                v-for="subject in bgmSyncSubjects"
                :key="subject.id"
                class="bgm-subject-item"
                @click="handleBGMSyncPickSubject(subject)"
              >
                <el-image :src="subject.image" class="bgm-subject-cover" fit="cover" loading="lazy">
                  <template #error>
                    <div class="image-slot"><el-icon><Picture /></el-icon></div>
                  </template>
                </el-image>
                <div class="bgm-subject-info">
                  <h4 class="subject-name" :title="subject.name">{{ subject.name }}</h4>
                  <div class="subject-meta">
                    <el-tag size="small" type="info">{{ subject.type_name }}</el-tag>
                    <span class="subject-cn" v-if="subject.name_cn && subject.name_cn !== subject.name">{{ subject.name_cn }}</span>
                  </div>
                </div>
                <div class="bgm-subject-arrow"><el-icon><ArrowRight /></el-icon></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 步骤：预览加载中 -->
        <div v-if="bgmSyncStep === 'previewing'" class="bgm-step-searching">
          <div class="searching-content">
            <el-icon class="searching-icon"><Loading /></el-icon>
            <h3>正在从 Bangumi 获取最新角色列表...</h3>
            <el-progress :percentage="50" :indeterminate="true" />
          </div>
        </div>

        <!-- 步骤：预览 diff -->
        <div v-if="bgmSyncStep === 'preview' && bgmSyncPreview" class="bgm-step-results">
          <div class="bgm-results-shell">
            <div class="results-header">
              <h3>更新预览：{{ bgmSyncPreview.bgm_subject_name }}</h3>
              <p class="results-subtitle">
                本地「{{ bgmSyncPreview.ip_name }}」与 BGM 比对结果：
                新增 <strong>{{ bgmSyncPreview.summary.new || 0 }}</strong> ·
                回填ID <strong>{{ bgmSyncPreview.summary.link_by_name || 0 }}</strong> ·
                已关联 <strong>{{ bgmSyncPreview.summary.matched || 0 }}</strong> ·
                本地独有 <strong>{{ bgmSyncPreview.summary.local_only || 0 }}</strong>
              </p>
            </div>

            <div v-if="bgmSyncPreview.subject_type_will_update" class="bgm-sync-notice">
              <div class="bgm-sync-alert-card">
                <el-alert type="warning" :closable="false" show-icon>
                  <template #title>
                    将更新本地作品类型为「{{ getSubjectTypeLabel(bgmSyncPreview.bgm_subject_type) }}」
                  </template>
                </el-alert>
              </div>
            </div>

            <div class="results-actions-top">
              <el-button size="small" @click="handleBGMSyncSelectAllNew">全选新增</el-button>
              <el-button size="small" @click="handleBGMSyncSelectNone">取消全选</el-button>
              <span class="selected-count">已选择 {{ bgmSyncSelectedItems.length }} 项</span>
            </div>

            <div class="results-filter">
              <el-input
                v-model="bgmSyncFilter"
                size="small"
                placeholder="按角色名筛选"
                clearable
                class="results-filter-input"
              >
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
            </div>

            <div class="character-list-container bgm-sync-list">
              <div
                v-for="(item, idx) in bgmSyncPreview.items"
                :key="idx"
                class="bgm-character-item bgm-sync-item"
                :class="[
                  `action-${item.action}`,
                  {
                    selected: isBGMSyncItemSelected(idx),
                    selectable: isBGMSyncItemSelectable(item),
                  },
                ]"
                v-show="!bgmSyncFilter.trim() || item.name.toLowerCase().includes(bgmSyncFilter.trim().toLowerCase())"
                @click="handleBGMSyncToggle(idx)"
              >
                <el-checkbox
                  v-if="isBGMSyncItemSelectable(item)"
                  :model-value="isBGMSyncItemSelected(idx)"
                  @change="handleBGMSyncToggle(idx)"
                  @click.stop
                />
                <el-icon v-else class="sync-fixed-icon">
                  <CircleCheck v-if="item.action === 'matched'" />
                  <Minus v-else-if="item.action === 'local_only'" />
                  <Warning v-else-if="item.action === 'skipped_duplicate'" />
                </el-icon>
                <el-avatar :size="42" :src="item.avatar || undefined" shape="square" class="char-avatar">
                  <el-icon><UserFilled /></el-icon>
                </el-avatar>
                <div class="char-info">
                  <div class="char-name">{{ item.name }}</div>
                  <div class="char-relation">{{ getBGMSyncActionLabel(item.action) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 步骤：应用中 -->
        <div v-if="bgmSyncStep === 'applying'" class="bgm-step-importing">
          <div class="importing-content">
            <el-icon class="importing-icon"><Loading /></el-icon>
            <h3>正在应用更新...</h3>
            <el-progress :percentage="50" :indeterminate="true" />
          </div>
        </div>

        <!-- 步骤：完成 -->
        <div v-if="bgmSyncStep === 'done' && bgmSyncApplyResult" class="bgm-step-imported">
          <div class="imported-content">
            <el-icon class="success-icon"><CircleCheck /></el-icon>
            <h3>更新完成！</h3>
            <div class="import-summary bgm-summary-card">
              <p>新增角色：<strong>{{ bgmSyncApplyResult.created_count }}</strong></p>
              <p>回填 ID：<strong>{{ bgmSyncApplyResult.linked_count }}</strong></p>
              <p v-if="bgmSyncApplyResult.subject_linked">已建立 BGM 关联</p>
              <p v-if="bgmSyncApplyResult.subject_type_updated">已更新作品类型</p>
            </div>
            <div class="import-details" v-if="bgmSyncApplyResult.details.length">
              <el-collapse>
                <el-collapse-item title="查看详情" name="details">
                  <div
                    v-for="(detail, idx) in bgmSyncApplyResult.details"
                    :key="idx"
                    class="detail-item"
                    :class="detail.status"
                  >
                    <el-icon>
                      <CircleCheck v-if="detail.status === 'created'" />
                      <Link v-else-if="detail.status === 'linked'" />
                      <CircleClose v-else />
                    </el-icon>
                    <span class="detail-text">
                      {{ detail.name }}
                      <span class="detail-status">({{ detail.status === 'created' ? '新增' : detail.status === 'linked' ? '回填ID' : '错误' }})</span>
                    </span>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="bgm-dialog-footer">
          <el-button v-if="bgmSyncStep === 'link_search'" class="bgm-dialog-cancel" @click="bgmSyncDialogVisible = false">取消</el-button>
          <el-button v-if="bgmSyncStep === 'link_subjects'" class="bgm-dialog-cancel" @click="handleBGMSyncResetToSearch">返回搜索</el-button>
          <el-button v-if="bgmSyncStep === 'preview'" class="bgm-dialog-cancel" @click="bgmSyncDialogVisible = false">取消</el-button>
          <el-button
            v-if="bgmSyncStep === 'preview'"
            type="primary"
            class="bgm-dialog-submit brand-add-btn brand-add-btn--compact"
            @click="handleBGMSyncApply"
            :disabled="bgmSyncSelectedItems.length === 0 && !bgmSyncPreview?.subject_type_will_update && !bgmSyncPreview?.will_link_subject"
            :loading="bgmSyncApplying"
          >
            应用更新 ({{ bgmSyncSelectedItems.length }})
          </el-button>
          <el-button v-if="bgmSyncStep === 'done'" type="primary" class="bgm-dialog-submit brand-add-btn brand-add-btn--compact" @click="handleBGMSyncClose">完成</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 角色编辑弹窗 (保持不变) -->
    <el-dialog
      v-model="characterDialogVisible"
      :title="characterDialogTitle"
      :width="dialogWidth"
      class="custom-dialog"
      align-center
    >
      <el-form
        :model="characterFormData"
        :rules="characterFormRules"
        ref="characterFormRef"
        label-position="top"
      >
        <div class="form-layout">
          <div class="avatar-col">
            <div class="avatar-mode-switch">
              <el-radio-group v-model="avatarInputMode" size="small" class="mode-radio-group">
                <el-radio-button value="upload">上传文件</el-radio-button>
                <el-radio-button value="url">输入URL</el-radio-button>
              </el-radio-group>
            </div>
            <!-- 文件上传模式 -->
            <el-upload
              v-if="avatarInputMode === 'upload'"
              class="avatar-uploader"
              :auto-upload="false"
              :show-file-list="false"
              @change="handleAvatarFileChange"
            >
              <img v-if="avatarPreview" :src="avatarPreview" class="preview-img" />
              <el-icon v-else class="uploader-icon"><Plus /></el-icon>
              <div class="upload-label">点击上传</div>
            </el-upload>
            <!-- URL输入模式 -->
            <div v-else class="avatar-url-input">
              <el-input
                v-model="avatarUrlInput"
                placeholder="输入头像图片URL"
                clearable
                @input="handleAvatarUrlInput"
              >
                <template #prefix>
                  <el-icon><Link /></el-icon>
                </template>
              </el-input>
              <div v-if="avatarPreview" class="url-preview">
                <img :src="avatarPreview" class="preview-img" alt="头像预览" />
              </div>
            </div>
          </div>
          <div class="info-col">
            <el-form-item label="角色名称" prop="name">
              <el-input v-model="characterFormData.name" placeholder="输入角色名" />
            </el-form-item>
            <el-form-item label="所属作品" prop="ip_id">
              <el-select
                v-model="characterFormData.ip_id"
                placeholder="选择所属IP"
                filterable
                style="width: 100%"
              >
                <el-option v-for="ip in ipList" :key="ip.id" :label="ip.name" :value="ip.id" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="false" label="性别" prop="gender">
              <el-radio-group v-model="characterFormData.gender" class="custom-radio">
                <el-radio-button value="female">女</el-radio-button>
                <el-radio-button value="male">男</el-radio-button>
                <el-radio-button value="other">其他</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="characterDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          class="submit-btn"
          @click="handleSubmitCharacter"
          :loading="submitting"
        >
          保存信息
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, reactive, watch } from 'vue'
import type { CSSProperties } from 'vue'
import {
  Plus,
  Edit,
  Delete,
  Search,
  ArrowRight,
  UserFilled,
  Loading,
  CircleCheck,
  Warning,
  CircleClose,
  Refresh,
  ArrowDown,
  Collection,
  Link,
  Top,
  Picture,
  Minus,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules, UploadFile } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useMetadataStore } from '@/stores/metadata'
import { useMobilePullRefresh } from '@/composables/useMobilePullRefresh'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import MobileActionSheet from '@/components/MobileActionSheet.vue'
import {
  getIPList,
  getIPDetail,
  createIP,
  updateIP,
  deleteIP,
  getIPCharacters,
  batchUpdateIPOrder,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  searchBGMCharacters,
  createBGMCharacters,
  searchBGMSubjects,
  getBGMCharactersBySubjectId,
  previewBGMSync,
  applyBGMSync,
} from '@/api/metadata'
import Sortable from 'sortablejs'
import type {
  IP,
  Character,
  CharacterGender,
  BGMSearchResponse,
  BGMCreateCharactersResponse,
  BGMSubject,
  BGMSyncPreviewResponse,
  BGMSyncApplyResponse,
  BGMSyncDiffItem,
} from '@/api/types'

const { isMobile } = useResponsiveDevice()

const authStore = useAuthStore()
const metadataStore = useMetadataStore()
const mobileAddSheetVisible = ref(false)

const ipMobileCreateActions = [
  { key: 'bgm', label: '从 Bangumi 导入', icon: Search },
  { key: 'ip', label: '新增作品 (IP)', icon: Collection, tone: 'primary' as const },
  { key: 'character', label: '新增角色', icon: UserFilled },
]

onMounted(() => {
  document.addEventListener('click', handleDocumentClick, true)
  window.addEventListener('scroll', queueUpdateMobileStickyHeader, { passive: true })
  window.addEventListener('resize', queueUpdateMobileStickyHeader)
  fetchIPList()
  nextTick(() => queueUpdateMobileStickyHeader())
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick, true)
  window.removeEventListener('scroll', queueUpdateMobileStickyHeader)
  window.removeEventListener('resize', queueUpdateMobileStickyHeader)
  if (mobileStickyRaf != null) {
    window.cancelAnimationFrame(mobileStickyRaf)
    mobileStickyRaf = null
  }
  destroySortables()
})

const handleDocumentClick = (evt: MouseEvent) => {
  if (!isMobile.value) return
  if (openSwipeId.value == null) return
  const target = evt.target as HTMLElement | null
  if (!target) return
  if (target.closest('.ip-swipe-item')) return
  closeSwipe(openSwipeId.value)
}

// 下拉刷新相关状态
const scrollContainerRef = ref<HTMLElement | null>(null)
const isSorting = ref(false)
const {
  pullDistance,
  isRefreshing,
  isDragging,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = useMobilePullRefresh({
  enabled: isMobile,
  blocked: isSorting,
  onRefresh: async () => {
    try {
      await fetchIPList(true)
      ElMessage.success('刷新成功')
    } catch {
      ElMessage.error('刷新失败')
    }
  },
})

// 拖拽排序相关
const tableRef = ref()
const mobileListRef = ref<HTMLElement | null>(null)
let sortableTable: ReturnType<typeof Sortable.create> | null = null
let sortableMobile: ReturnType<typeof Sortable.create> | null = null

// 移动端：侧滑操作（编辑/删除）
const SWIPE_ACTION_WIDTH = 132 // px
const openSwipeId = ref<number | null>(null)
const swipeOffsetMap = ref<Record<number, number>>({})
const swipeTouch = reactive({
  id: null as number | null,
  startX: 0,
  startY: 0,
  dragging: false,
  moved: false,
})

const closeSwipe = (id?: number) => {
  const targetId = id ?? openSwipeId.value
  if (targetId == null) return
  swipeOffsetMap.value = { ...swipeOffsetMap.value, [targetId]: 0 }
  if (openSwipeId.value === targetId) openSwipeId.value = null
}

const openSwipe = (id: number) => {
  openSwipeId.value = id
  swipeOffsetMap.value = { ...swipeOffsetMap.value, [id]: -SWIPE_ACTION_WIDTH }
}

const shouldDisableSwipe = () => {
  if (!isMobile.value) return true
  if (isSorting.value) return true
  if (isDragging.value) return true
  if (pullDistance.value > 0) return true
  return false
}

const onCardTouchStart = (e: TouchEvent, id: number) => {
  if (shouldDisableSwipe()) return
  const target = e.target as HTMLElement | null
  if (target?.closest?.('.mobile-drag-handle')) return
  const t = e.touches?.[0]
  if (!t) return

  if (openSwipeId.value != null && openSwipeId.value !== id) {
    closeSwipe(openSwipeId.value)
  }

  swipeTouch.id = id
  swipeTouch.startX = t.clientX
  swipeTouch.startY = t.clientY
  swipeTouch.dragging = false
  swipeTouch.moved = false

  if (swipeOffsetMap.value[id] == null) {
    swipeOffsetMap.value = { ...swipeOffsetMap.value, [id]: openSwipeId.value === id ? -SWIPE_ACTION_WIDTH : 0 }
  }
}

const onCardTouchMove = (e: TouchEvent) => {
  if (shouldDisableSwipe()) return
  const id = swipeTouch.id
  if (id == null) return
  const t = e.touches?.[0]
  if (!t) return

  const dx = t.clientX - swipeTouch.startX
  const dy = t.clientY - swipeTouch.startY

  if (!swipeTouch.dragging) {
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (absX < 10) return
    if (absX <= absY + 6) return
    swipeTouch.dragging = true
  }

  swipeTouch.moved = true
  if (e.cancelable) e.preventDefault()

  const base = openSwipeId.value === id ? -SWIPE_ACTION_WIDTH : 0
  let nextOffset = base + dx
  nextOffset = Math.min(0, Math.max(-SWIPE_ACTION_WIDTH, nextOffset))
  swipeOffsetMap.value = { ...swipeOffsetMap.value, [id]: nextOffset }
}

const onCardTouchEnd = () => {
  const id = swipeTouch.id
  if (id == null) return

  if (swipeTouch.dragging) {
    const offset = swipeOffsetMap.value[id] ?? 0
    if (offset <= -SWIPE_ACTION_WIDTH / 2) {
      openSwipe(id)
    } else {
      closeSwipe(id)
    }
  }

  swipeTouch.id = null
  swipeTouch.dragging = false
}

const handleMobileCardClick = async (ipId: number) => {
  if (swipeTouch.moved) {
    swipeTouch.moved = false
    return
  }

  if (openSwipeId.value === ipId) {
    closeSwipe(ipId)
    return
  }

  await toggleExpand(ipId)
}

const getSwipeContentStyle = (id: number) => {
  const offset = swipeOffsetMap.value[id] ?? (openSwipeId.value === id ? -SWIPE_ACTION_WIDTH : 0)
  return {
    transform: `translateX(${offset}px)`,
    transition: swipeTouch.id === id && swipeTouch.dragging ? 'none' : 'transform 0.22s ease',
  }
}

// 弹窗宽度计算
const dialogWidth = computed(() => {
  if (isMobile.value) {
    return '90%'
  }
  return '600px'
})

// BGM导入弹窗需要更宽
const bgmDialogWidth = computed(() => {
  if (isMobile.value) {
    return '90%'
  }
  return '800px'
})

// 状态管理
const loading = ref(false)
const submitting = ref(false)
const searchText = ref('')
const selectedSubjectTypes = ref<number[]>([])
const ipList = ref<IP[]>([])
const characterMap = ref<Record<number, Character[]>>({})
const characterLoadingMap = ref<Record<number, boolean>>({})
const expandedIPs = ref<number[]>([])

// 排序状态管理
const sortState = ref<{ prop: string, order: string }>({ prop: '', order: '' })

// 监听表格排序变化
const handleSortChange = ({ prop, order }: { prop: string, order: string }) => {
  sortState.value = { prop, order }
}

// 纯前端排序计算属性
const sortedIpList = computed(() => {
  const list = [...ipList.value].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id)
  if (!sortState.value.prop || !sortState.value.order) return list

  return list.sort((a, b) => {
    let result = 0

    // 根据作品名称排序 (支持中文拼音)
    if (sortState.value.prop === 'name') {
      result = a.name.localeCompare(b.name, 'zh-CN')
    }
    // 根据作品类型排序 (数值)
    else if (sortState.value.prop === 'subject_type') {
      const typeA = a.subject_type || 0
      const typeB = b.subject_type || 0
      result = typeA - typeB
    }
    // 根据角色数量排序
    else if (sortState.value.prop === 'character_count') {
      const countA = a.character_count ?? (characterMap.value[a.id]?.length || 0)
      const countB = b.character_count ?? (characterMap.value[b.id]?.length || 0)
      result = countA - countB
    }

    return sortState.value.order === 'descending' ? -result : result
  })
})

type MobileStickyState = {
  top: number
  left: number
  width: number
  height: number
}

const activeStickyIPId = ref<number | null>(null)
const stickyHeaderState = ref<Record<number, MobileStickyState>>({})
let mobileStickyRaf: number | null = null

const resetMobileStickyHeader = () => {
  activeStickyIPId.value = null
  stickyHeaderState.value = {}
}

const getMobileStickyTopOffset = () => {
  const navbar = document.querySelector<HTMLElement>('.navbar')
  const navBottom = navbar?.getBoundingClientRect().bottom ?? 64
  return Math.max(64, Math.ceil(navBottom)) + 8
}

const updateMobileStickyHeader = () => {
  if (!isMobile.value || isSorting.value || expandedIPs.value.length === 0) {
    resetMobileStickyHeader()
    return
  }

  const top = getMobileStickyTopOffset()
  const expandedIds = new Set(expandedIPs.value)
  const expandedCards = Array.from(
    document.querySelectorAll<HTMLElement>('.mobile-view-inner .ip-card-item.is-expanded[data-ip-id]')
  )
  const nextStates: Record<number, MobileStickyState> = {}
  let nextActiveId: number | null = null

  for (const card of expandedCards) {
    const id = Number(card.dataset.ipId)
    if (!Number.isFinite(id) || !expandedIds.has(id)) continue

    const header = card.querySelector<HTMLElement>('.ip-card-sticky-shell')
    if (!header) continue

    const cardRect = card.getBoundingClientRect()
    const headerHeight = header.offsetHeight || header.getBoundingClientRect().height

    if (cardRect.top > top || cardRect.bottom <= top + headerHeight) continue

    nextStates[id] = {
      top,
      left: Math.round(cardRect.left),
      width: Math.round(cardRect.width),
      height: Math.ceil(headerHeight),
    }
    nextActiveId = id
  }

  applyMobileStickyState(nextActiveId, nextStates)
}

const isSameMobileStickyState = (
  current: Record<number, MobileStickyState>,
  next: Record<number, MobileStickyState>
) => {
  const currentKeys = Object.keys(current)
  const nextKeys = Object.keys(next)
  if (currentKeys.length !== nextKeys.length) return false

  return nextKeys.every((key) => {
    const id = Number(key)
    const a = current[id]
    const b = next[id]
    return !!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
  })
}

const applyMobileStickyState = (nextActiveId: number | null, nextStates: Record<number, MobileStickyState>) => {
  if (activeStickyIPId.value !== nextActiveId) {
    activeStickyIPId.value = nextActiveId
  }

  if (!isSameMobileStickyState(stickyHeaderState.value, nextStates)) {
    stickyHeaderState.value = nextStates
  }
}

const queueUpdateMobileStickyHeader = () => {
  if (typeof window === 'undefined') return
  if (mobileStickyRaf != null) return

  mobileStickyRaf = window.requestAnimationFrame(() => {
    mobileStickyRaf = null
    updateMobileStickyHeader()
  })
}

const getMobileStickyShellStyle = (ipId: number): CSSProperties | undefined => {
  const state = stickyHeaderState.value[ipId]
  if (!state) return undefined

  return {
    position: 'fixed',
    top: `${state.top}px`,
    left: `${state.left}px`,
    width: `${state.width}px`,
    transform: 'none',
  }
}

const getMobileStickyCardStyle = (ipId: number): CSSProperties | undefined => {
  const state = stickyHeaderState.value[ipId]
  if (!state) return undefined

  return {
    '--mobile-sticky-shell-height': `${state.height}px`,
  } as CSSProperties
}

watch(
  () => sortedIpList.value.map((x) => x.id).join(','),
  () => {
    // 筛选/刷新导致列表变化时，关闭已打开的侧滑，避免残留偏移
    if (openSwipeId.value != null) closeSwipe(openSwipeId.value)
  }
)

watch(
  () => [
    isMobile.value,
    isSorting.value,
    expandedIPs.value.join(','),
    sortedIpList.value.map((x) => x.id).join(','),
  ],
  () => {
    nextTick(() => queueUpdateMobileStickyHeader())
  },
  { flush: 'post' }
)

const destroySortables = () => {
  if (sortableTable) {
    sortableTable.destroy()
    sortableTable = null
  }
  if (sortableMobile) {
    sortableMobile.destroy()
    sortableMobile = null
  }
}

const handleRowReorder = async (oldIndex: number, newIndex: number) => {
  if (oldIndex === newIndex) return
  if (sortState.value.prop) {
    ElMessage.warning('请清空表格排序后再进行拖拽排序')
    await fetchIPList(true)
    return
  }

  const list = [...sortedIpList.value]
  const moved = list[oldIndex]
  const target = list[newIndex]
  if (!moved || !target) return

  list.splice(oldIndex, 1)
  list.splice(newIndex, 0, moved)

  const items = list.map((item, index) => ({
    id: item.id,
    order: index * 10,
  }))

  const orderMap = new Map(items.map((i) => [i.id, i.order]))
  ipList.value = list.map((item) => ({
    ...item,
    order: orderMap.get(item.id) ?? item.order,
  }))

  await nextTick()
  initDragSort()

  try {
    await batchUpdateIPOrder(items)
    ElMessage.success('排序已更新')
  } catch (err: any) {
    ElMessage.error(err?.message || '排序更新失败，已回滚')
    await fetchIPList(true)
  }
}

const initDragSort = () => {
  destroySortables()
  if (typeof window === 'undefined' || !authStore.isAdmin) return

  const tableEl = tableRef.value?.$el as HTMLElement | undefined
  const tbody = tableEl?.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
  if (tbody) {
    sortableTable = Sortable.create(tbody, {
      handle: '.drag-handle',
      draggable: '.el-table__row',
      filter: '.el-table__expanded-row',
      animation: 150,
      onStart: () => {
        isSorting.value = true
      },
      onEnd: (evt: any) => {
        isSorting.value = false
        handleRowReorder(evt.oldIndex ?? 0, evt.newIndex ?? 0)
      },
    })
  }

  const mobileListEl = mobileListRef.value
  if (mobileListEl) {
    sortableMobile = Sortable.create(mobileListEl, {
      handle: '.mobile-drag-handle',
      draggable: '.ip-card-item',
      animation: 150,
      onStart: () => {
        isSorting.value = true
      },
      onEnd: (evt: any) => {
        isSorting.value = false
        handleRowReorder(evt.oldIndex ?? 0, evt.newIndex ?? 0)
      },
    })
  }
}

// IP相关
const ipDialogVisible = ref(false)
const ipDialogTitle = computed(() => (isEditIP.value ? '📝 编辑作品资料' : '✨ 新增IP作品'))
const isEditIP = ref(false)
const editingIPId = ref<number | null>(null)
const ipFormRef = ref<FormInstance>()
const newKeyword = ref('')
const ipFormData = ref({
  name: '',
  keywords: [] as string[],
  subject_type: null as number | null,
})
const ipFormRules: FormRules = {
  name: [{ required: true, message: '请输入作品名称', trigger: 'blur' }],
}

// 角色相关
const characterDialogVisible = ref(false)
const characterDialogTitle = computed(() =>
  isEditCharacter.value ? '🎭 编辑角色资料' : '✨ 迎接新角色'
)
const isEditCharacter = ref(false)
const editingCharacterId = ref<number | null>(null)
const editingCharacterOriginalIpId = ref<number | null>(null)
const characterFormRef = ref<FormInstance>()
const avatarPreview = ref('')
const avatarFile = ref<File | null>(null)
const avatarInputMode = ref<'upload' | 'url'>('upload')
const avatarUrlInput = ref('')
const characterFormData = ref({
  name: '',
  ip_id: null as number | null,
  gender: 'other' as CharacterGender,
})
const characterFormRules: FormRules = {
  name: [{ required: true, message: '请输入角色名', trigger: 'blur' }],
  ip_id: [{ required: true, message: '请选择所属IP', trigger: 'change' }],
}

// BGM导入相关
const bgmDialogVisible = ref(false)
const bgmDialogMode = computed<'import' | 'sync'>(() => (bgmDialogVisible.value ? 'import' : 'sync'))
type BGMStep = 'search' | 'searching' | 'subjects' | 'loading-characters' | 'results' | 'importing' | 'imported'
const bgmStep = ref<BGMStep>('search')
const bgmSearchInput = ref('')
const bgmSubjectType = ref<number | undefined>(undefined)
const bgmSearching = ref(false)
const bgmCharacterKeyword = ref('')
const bgmSubjects = ref<BGMSubject[]>([])
const bgmSearchResult = ref<BGMSearchResponse | null>(null)
const bgmSelectedCharacters = ref<number[]>([])
const bgmImporting = ref(false)
const bgmImportResult = ref<BGMCreateCharactersResponse | null>(null)

const getGenderLabel = (g: CharacterGender) =>
  ({ male: '男', female: '女', other: '其他' }[g] || '未知')

// 获取作品类型标签
const getSubjectTypeLabel = (type: number | null | undefined) => {
  if (!type) return ''
  const map: Record<number, string> = {
    1: '书籍',
    2: '动画',
    3: '音乐',
    4: '游戏',
    6: '三次元/特摄',
  }
  return map[type] || '未知'
}

// 获取作品类型标签颜色
const getSubjectTypeTagType = (type: number | null | undefined): '' | 'success' | 'info' | 'warning' | 'danger' => {
  if (!type) return ''
  const map: Record<number, '' | 'success' | 'info' | 'warning' | 'danger'> = {
    1: 'warning', // 书籍 - 黄色
    2: 'success', // 动画 - 绿色
    3: 'info',    // 音乐 - 蓝色
    4: 'danger',  // 游戏 - 红色
    6: '',        // 三次元/特摄 - 默认
  }
  return map[type] || ''
}

const setIPCharacterCount = (ipId: number, count: number) => {
  const ip = ipList.value.find((x) => x.id === ipId)
  if (!ip) return
  ip.character_count = count
}

const syncIPCharacterCountFromMap = (ipId: number) => {
  const list = characterMap.value[ipId]
  if (!list) return
  setIPCharacterCount(ipId, list.length)
}

const handleActionCommand = (command: string) => {
  switch (command) {
    case 'bgm':
      handleOpenBGMImport()
      break
    case 'ip':
      handleAddIP()
      break
    case 'character':
      handleAddCharacter()
      break
  }
}

const openMobileAddSheet = () => {
  mobileAddSheetVisible.value = true
}

const handleMobileCreateAction = (command: string) => {
  handleActionCommand(command)
}

const fetchIPList = async (force = false) => {
  loading.value = true
  try {
    const allIPs = await metadataStore.fetchIPs(force)

    let filtered = allIPs
    if (searchText.value.trim()) {
      const lowerSearch = searchText.value.trim().toLowerCase()
      filtered = filtered.filter(ip =>
        ip.name.toLowerCase().includes(lowerSearch) ||
        (ip.keywords && ip.keywords.some(k => k.value.toLowerCase().includes(lowerSearch)))
      )
    }

    if (selectedSubjectTypes.value.length > 0) {
      filtered = filtered.filter(ip =>
        ip.subject_type && selectedSubjectTypes.value.includes(ip.subject_type)
      )
    }

    ipList.value = filtered
    characterMap.value = {}
    expandedIPs.value = []
    await nextTick()
    initDragSort()
  } catch (err: any) {
    ElMessage.error(err.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const fetchIPCharacters = async (ipId: number) => {
  if (characterLoadingMap.value[ipId]) return

  // 先检查 Store 内存中是否有数据，如果有，先展示（虽然 Store 内部有检查，但这里可以避免 loading 状态闪烁）
  if (metadataStore.charactersByIP[ipId]) {
    characterMap.value[ipId] = metadataStore.charactersByIP[ipId]
    syncIPCharacterCountFromMap(ipId)
    return
  }

  characterLoadingMap.value[ipId] = true
  try {
    // 调用 Store 的按需获取方法
    const data = await metadataStore.fetchIPCharacters(ipId)
    characterMap.value[ipId] = data
    syncIPCharacterCountFromMap(ipId)
  } catch (err: any) {
    ElMessage.error(err.message || '加载角色失败')
    characterMap.value[ipId] = []
    syncIPCharacterCountFromMap(ipId)
  } finally {
    characterLoadingMap.value[ipId] = false
  }
}

const toggleExpand = async (ipId: number) => {
  if (expandedIPs.value.includes(ipId)) {
    expandedIPs.value = []
    resetMobileStickyHeader()
    return
  }

  expandedIPs.value = [ipId]
  await fetchIPCharacters(ipId)
  await nextTick()
  queueUpdateMobileStickyHeader()
}

const handleTableExpandChange = async (row: IP, expandedRows: IP[]) => {
  const isExpanded = expandedRows.some((r) => r.id === row.id)
  if (isExpanded) {
    for (const expandedRow of expandedRows) {
      if (expandedRow.id !== row.id) {
        tableRef.value?.toggleRowExpansion?.(expandedRow, false)
      }
    }
    expandedIPs.value = [row.id]
    await fetchIPCharacters(row.id)
  } else if (expandedIPs.value.includes(row.id)) {
    expandedIPs.value = []
  }
}

const handleSearch = () => fetchIPList()

const handleRefresh = () => {
  fetchIPList(true)
}

const handleAddIP = () => {
  isEditIP.value = false
  editingIPId.value = null
  ipFormData.value = { name: '', keywords: [], subject_type: null }
  newKeyword.value = ''
  ipDialogVisible.value = true
}

const handleEditIP = async (row: IP) => {
  isEditIP.value = true
  editingIPId.value = row.id
  try {
    const detail = await getIPDetail(row.id)
    ipFormData.value = {
      name: detail.name,
      keywords: detail.keywords?.map((k) => k.value) || [],
      subject_type: detail.subject_type ?? null,
    }
  } catch {
    ipFormData.value = {
      name: row.name,
      keywords: row.keywords?.map((k) => k.value) || [],
      subject_type: row.subject_type ?? null,
    }
  }
  newKeyword.value = ''
  ipDialogVisible.value = true
}

const handleDeleteIP = async (row: IP) => {
  try {
    await ElMessageBox.confirm(
      `确定删除作品《${row.name}》吗？这将导致关联的角色数据丢失。`,
      '警告',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '点错了',
        type: 'warning',
        buttonSize: 'default',
      }
    )
    await deleteIP(row.id)
    ElMessage.success('已安全删除')
    delete characterMap.value[row.id]
    fetchIPList(true)
  } catch {}
}

const handleAddKeyword = () => {
  const val = newKeyword.value.trim()
  if (!val) return
  if (ipFormData.value.keywords.includes(val)) return ElMessage.warning('关键词已存在')
  ipFormData.value.keywords.push(val)
  newKeyword.value = ''
}

const handleRemoveKeyword = (index: number) => {
  ipFormData.value.keywords.splice(index, 1)
}

const handleSubmitIP = async () => {
  if (!ipFormRef.value) return
  await ipFormRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      const data = {
        name: ipFormData.value.name,
        keywords: ipFormData.value.keywords,
        subject_type: ipFormData.value.subject_type ?? null,
      }
      if (isEditIP.value && editingIPId.value) {
        await updateIP(editingIPId.value, data)
        if (expandedIPs.value.includes(editingIPId.value)) {
          delete characterMap.value[editingIPId.value]
          await fetchIPCharacters(editingIPId.value)
        }
      } else {
        await createIP(data)
      }
      ElMessage.success('操作成功')
      ipDialogVisible.value = false
      fetchIPList(true)
    } catch (err: any) {
      ElMessage.error(err.message || '操作失败')
    } finally {
      submitting.value = false
    }
  })
}

const handleAddCharacter = () => {
  isEditCharacter.value = false
  editingCharacterId.value = null
  editingCharacterOriginalIpId.value = null
  characterFormData.value = { name: '', ip_id: null, gender: 'other' }
  avatarPreview.value = ''
  avatarFile.value = null
  avatarUrlInput.value = ''
  avatarInputMode.value = 'upload'
  characterDialogVisible.value = true
}

const handleAddCharacterForIP = (ip: IP) => {
  isEditCharacter.value = false
  editingCharacterId.value = null
  editingCharacterOriginalIpId.value = null
  characterFormData.value = { name: '', ip_id: ip.id, gender: 'other' }
  avatarPreview.value = ''
  avatarFile.value = null
  avatarUrlInput.value = ''
  avatarInputMode.value = 'upload'
  characterDialogVisible.value = true
}

const handleEditCharacter = (row: Character) => {
  isEditCharacter.value = true
  editingCharacterId.value = row.id
  editingCharacterOriginalIpId.value = row.ip.id
  characterFormData.value = {
    name: row.name,
    ip_id: row.ip.id,
    gender: row.gender,
  }
  if (row.avatar) {
    if (row.avatar.startsWith('http://') || row.avatar.startsWith('https://')) {
      avatarInputMode.value = 'url'
      avatarUrlInput.value = row.avatar
      avatarPreview.value = row.avatar
    } else {
      avatarInputMode.value = 'url'
      avatarUrlInput.value = row.avatar
      avatarPreview.value = row.avatar
    }
  } else {
    avatarInputMode.value = 'upload'
    avatarUrlInput.value = ''
    avatarPreview.value = ''
  }
  avatarFile.value = null
  characterDialogVisible.value = true
}

const handleDeleteCharacter = async (row: Character) => {
  try {
    await ElMessageBox.confirm(
      `确定删除角色《${row.name}》吗？关联的谷子数据也会受到影响。`,
      '警告',
      {
        type: 'warning',
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
      }
    )
    await deleteCharacter(row.id)
    await metadataStore.fetchIPCharacters(row.ip.id, true) // 刷新该IP的角色缓存
    ElMessage.success('已删除')
    if (ipList.value.find((x) => x.id === row.ip.id)?.character_count != null) {
      setIPCharacterCount(row.ip.id, Math.max(0, (ipList.value.find((x) => x.id === row.ip.id)?.character_count || 0) - 1))
    }
    if (characterMap.value[row.ip.id]) {
      delete characterMap.value[row.ip.id]
      await fetchIPCharacters(row.ip.id)
    }
  } catch {}
}

const handleAvatarFileChange = (file: UploadFile) => {
  if (file.raw) {
    avatarFile.value = file.raw
    avatarUrlInput.value = ''
    const reader = new FileReader()
    reader.onload = (e) => (avatarPreview.value = e.target?.result as string)
    reader.readAsDataURL(file.raw)
  }
}

const handleAvatarUrlInput = (value: string) => {
  avatarUrlInput.value = value
  if (value.trim()) {
    try {
      new URL(value.trim())
      avatarPreview.value = value.trim()
      avatarFile.value = null
    } catch {
      avatarPreview.value = ''
    }
  } else {
    avatarPreview.value = ''
  }
}

const handleSubmitCharacter = async () => {
  if (!characterFormRef.value) return
  await characterFormRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      let data: FormData | { name: string; ip_id: number; gender: CharacterGender; avatar?: string | null }

      if (avatarInputMode.value === 'upload' && avatarFile.value) {
        const formData = new FormData()
        formData.append('name', characterFormData.value.name)
        formData.append('ip_id', String(characterFormData.value.ip_id))
        formData.append('gender', characterFormData.value.gender)
        formData.append('avatar', avatarFile.value)
        data = formData
      } else {
        data = {
          name: characterFormData.value.name,
          ip_id: characterFormData.value.ip_id!,
          gender: characterFormData.value.gender,
          avatar: avatarInputMode.value === 'url' && avatarUrlInput.value.trim()
            ? avatarUrlInput.value.trim()
            : null,
        }
      }

      const newIpId = characterFormData.value.ip_id!
      const oldIpId = editingCharacterOriginalIpId.value
      if (isEditCharacter.value && editingCharacterId.value) {
        await updateCharacter(editingCharacterId.value, data)
        await metadataStore.fetchIPCharacters(newIpId, true) // 刷新新IP的角色缓存

        if (oldIpId && oldIpId !== newIpId) {
          await metadataStore.fetchIPCharacters(oldIpId, true) // 刷新旧IP的角色缓存
          if (characterMap.value[oldIpId]) {
            delete characterMap.value[oldIpId]
            await fetchIPCharacters(oldIpId)
          } else if (ipList.value.find((x) => x.id === oldIpId)?.character_count != null) {
            setIPCharacterCount(
              oldIpId,
              Math.max(0, (ipList.value.find((x) => x.id === oldIpId)?.character_count || 0) - 1)
            )
          }

          if (characterMap.value[newIpId]) {
            delete characterMap.value[newIpId]
            await fetchIPCharacters(newIpId)
          } else if (ipList.value.find((x) => x.id === newIpId)?.character_count != null) {
            setIPCharacterCount(newIpId, (ipList.value.find((x) => x.id === newIpId)?.character_count || 0) + 1)
          }
        } else {
          if (characterMap.value[newIpId]) {
            delete characterMap.value[newIpId]
            await fetchIPCharacters(newIpId)
          }
        }
      } else {
        await createCharacter(data)
        await metadataStore.fetchIPCharacters(newIpId, true) // 刷新该IP的角色缓存
        delete characterMap.value[newIpId]
        if (ipList.value.find((x) => x.id === newIpId)?.character_count != null) {
          setIPCharacterCount(newIpId, (ipList.value.find((x) => x.id === newIpId)?.character_count || 0) + 1)
        }
        await fetchIPCharacters(newIpId)
        expandedIPs.value = [newIpId]
      }
      ElMessage.success('保存成功')
      characterDialogVisible.value = false
      editingCharacterOriginalIpId.value = null
    } catch (err: any) {
      ElMessage.error(err.message || '操作失败')
    } finally {
      submitting.value = false
    }
  })
}

const handleOpenBGMImport = () => {
  bgmDialogVisible.value = true
  handleBGMReset()
}

const handleBGMReset = () => {
  bgmStep.value = 'search'
  bgmSearchInput.value = ''
  bgmSubjectType.value = undefined
  bgmCharacterKeyword.value = ''
  bgmSubjects.value = []
  bgmSearchResult.value = null
  bgmSelectedCharacters.value = []
  bgmImportResult.value = null
}

const handleBGMSearch = async () => {
  const keyword = bgmSearchInput.value.trim()
  if (!keyword) {
    ElMessage.warning('请输入IP作品名称')
    return
  }

  bgmSearching.value = true
  bgmStep.value = 'searching'

  try {
    const response = await searchBGMSubjects(keyword, bgmSubjectType.value)
    bgmSubjects.value = response.subjects
    if (bgmSubjects.value.length === 0) {
      ElMessage.warning('未找到相关作品')
      bgmStep.value = 'search'
    } else {
      bgmStep.value = 'subjects'
    }
  } catch (err: any) {
    ElMessage.error(err.message || '搜索失败')
    bgmStep.value = 'search'
  } finally {
    bgmSearching.value = false
  }
}

const handleBGMSelectSubject = async (subject: BGMSubject) => {
  bgmStep.value = 'loading-characters'
  try {
    const response = await getBGMCharactersBySubjectId(subject.id)
    // 转换响应格式以适配现有逻辑
    bgmSearchResult.value = {
      ip_name: response.subject_name,
      characters: response.characters
    }
    bgmCharacterKeyword.value = ''
    bgmSelectedCharacters.value = []
    bgmStep.value = 'results'
  } catch (err: any) {
    ElMessage.error(err.message || '获取角色列表失败')
    bgmStep.value = 'subjects'
  }
}

const handleBGMSelectAll = () => {
  if (!bgmSearchResult.value) return
  bgmSelectedCharacters.value = bgmSearchResult.value.characters.map((_, index) => index)
}

const handleBGMSelectNone = () => {
  bgmSelectedCharacters.value = []
}

const handleBGMToggleCharacter = (index: number) => {
  const idx = bgmSelectedCharacters.value.indexOf(index)
  if (idx > -1) {
    bgmSelectedCharacters.value.splice(idx, 1)
  } else {
    bgmSelectedCharacters.value.push(index)
  }
}

const handleBGMConfirmImport = async () => {
  const result = bgmSearchResult.value
  if (!result || bgmSelectedCharacters.value.length === 0) {
    ElMessage.warning('请至少选择一个角色')
    return
  }

  bgmImporting.value = true
  bgmStep.value = 'importing'

  try {
    const charactersToImport = bgmSelectedCharacters.value
      .map((index) => result.characters[index])
      .filter((char): char is (typeof result.characters)[number] => !!char)
      .map((char) => ({
        ip_name: result.ip_name,
        character_name: char.name,
        avatar: char.avatar || null,
      }))

    const createResult = await createBGMCharacters(charactersToImport, bgmSubjectType.value)
    bgmImportResult.value = createResult
    bgmStep.value = 'imported'

    await fetchIPList(true)

    ElMessage.success(`成功导入 ${createResult.created} 个角色`)
  } catch (err: any) {
    ElMessage.error(err.message || '导入失败')
    bgmStep.value = 'results'
  } finally {
    bgmImporting.value = false
  }
}

const handleBGMClose = () => {
  bgmDialogVisible.value = false
  handleBGMReset()
  fetchIPList(true)
}

// ==================== BGM 增量更新（从已有 IP 触发） ====================
type BGMSyncStep =
  | 'link_search'
  | 'link_searching'
  | 'link_subjects'
  | 'previewing'
  | 'preview'
  | 'applying'
  | 'done'

const bgmSyncDialogVisible = ref(false)
const bgmSyncStep = ref<BGMSyncStep>('preview')
const bgmSyncTargetIP = ref<IP | null>(null)
const bgmSyncSearchInput = ref('')
const bgmSyncSubjectType = ref<number | undefined>(undefined)
const bgmSyncSearching = ref(false)
const bgmSyncSubjects = ref<BGMSubject[]>([])
const bgmSyncPickedSubjectId = ref<number | null>(null)
const bgmSyncPreview = ref<BGMSyncPreviewResponse | null>(null)
const bgmSyncSelectedItems = ref<number[]>([])
const bgmSyncFilter = ref('')
const bgmSyncApplying = ref(false)
const bgmSyncApplyResult = ref<BGMSyncApplyResponse | null>(null)

const resetBGMSyncState = () => {
  bgmSyncTargetIP.value = null
  bgmSyncSearchInput.value = ''
  bgmSyncSubjectType.value = undefined
  bgmSyncSubjects.value = []
  bgmSyncPickedSubjectId.value = null
  bgmSyncPreview.value = null
  bgmSyncSelectedItems.value = []
  bgmSyncFilter.value = ''
  bgmSyncApplyResult.value = null
}

const handleOpenBGMSync = async (ip: IP) => {
  resetBGMSyncState()
  bgmSyncTargetIP.value = ip
  bgmSyncDialogVisible.value = true

  if (ip.bgm_subject_id) {
    // 已绑定：直接进入预览
    await runBGMSyncPreview(ip.id, null)
    return
  }
  // 未绑定：进入搜索回填流程，预填 IP 名称
  bgmSyncSearchInput.value = ip.name
  bgmSyncSubjectType.value = ip.subject_type ?? undefined
  bgmSyncStep.value = 'link_search'
}

const handleBGMSyncSearch = async () => {
  const keyword = bgmSyncSearchInput.value.trim()
  if (!keyword) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  bgmSyncSearching.value = true
  bgmSyncStep.value = 'link_searching'
  try {
    const resp = await searchBGMSubjects(keyword, bgmSyncSubjectType.value)
    bgmSyncSubjects.value = resp.subjects
    if (!resp.subjects.length) {
      ElMessage.warning('未找到相关作品')
      bgmSyncStep.value = 'link_search'
    } else {
      bgmSyncStep.value = 'link_subjects'
    }
  } catch (err: any) {
    ElMessage.error(err?.message || '搜索失败')
    bgmSyncStep.value = 'link_search'
  } finally {
    bgmSyncSearching.value = false
  }
}

const handleBGMSyncResetToSearch = () => {
  bgmSyncSubjects.value = []
  bgmSyncStep.value = 'link_search'
}

const handleBGMSyncPickSubject = async (subject: BGMSubject) => {
  if (!bgmSyncTargetIP.value) return
  bgmSyncPickedSubjectId.value = subject.id
  await runBGMSyncPreview(bgmSyncTargetIP.value.id, subject.id)
}

const runBGMSyncPreview = async (ipId: number, subjectId: number | null) => {
  bgmSyncStep.value = 'previewing'
  try {
    const resp = await previewBGMSync(ipId, subjectId)
    bgmSyncPreview.value = resp
    // 默认选中所有 new + link_by_name
    bgmSyncSelectedItems.value = resp.items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => it.action === 'new' || it.action === 'link_by_name')
      .map(({ idx }) => idx)
    bgmSyncStep.value = 'preview'
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.detail || err?.message || '获取更新预览失败')
    // 出错时：若是历史 IP 回填流程则回到 subjects 列表，否则回到搜索/关闭
    if (bgmSyncSubjects.value.length) {
      bgmSyncStep.value = 'link_subjects'
    } else if (bgmSyncTargetIP.value && !bgmSyncTargetIP.value.bgm_subject_id) {
      bgmSyncStep.value = 'link_search'
    } else {
      bgmSyncDialogVisible.value = false
    }
  }
}

const isBGMSyncItemSelectable = (item: BGMSyncDiffItem) =>
  item.action === 'new' || item.action === 'link_by_name'

const isBGMSyncItemSelected = (idx: number) => bgmSyncSelectedItems.value.includes(idx)

const handleBGMSyncToggle = (idx: number) => {
  const item = bgmSyncPreview.value?.items[idx]
  if (!item || !isBGMSyncItemSelectable(item)) return
  const pos = bgmSyncSelectedItems.value.indexOf(idx)
  if (pos >= 0) {
    bgmSyncSelectedItems.value.splice(pos, 1)
  } else {
    bgmSyncSelectedItems.value.push(idx)
  }
}

const handleBGMSyncSelectAllNew = () => {
  if (!bgmSyncPreview.value) return
  bgmSyncSelectedItems.value = bgmSyncPreview.value.items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => isBGMSyncItemSelectable(it))
    .map(({ idx }) => idx)
}

const handleBGMSyncSelectNone = () => {
  bgmSyncSelectedItems.value = []
}

const getBGMSyncActionLabel = (action: BGMSyncDiffItem['action']) => {
  const map: Record<BGMSyncDiffItem['action'], string> = {
    new: '新增',
    link_by_name: '按名字回填 BGM ID',
    matched: '已关联，无需变动',
    local_only: '本地独有（不处理）',
    skipped_duplicate: 'BGM 重复，已跳过',
  }
  return map[action] || action
}

const handleBGMSyncApply = async () => {
  if (!bgmSyncTargetIP.value || !bgmSyncPreview.value) return
  bgmSyncApplying.value = true
  bgmSyncStep.value = 'applying'
  try {
    const items = bgmSyncSelectedItems.value
      .map((idx) => bgmSyncPreview.value!.items[idx])
      .filter((it): it is BGMSyncDiffItem => !!it && isBGMSyncItemSelectable(it))
      .map((it) => ({
        action: it.action as 'new' | 'link_by_name',
        bgm_character_id: it.bgm_character_id ?? null,
        name: it.name,
        avatar: it.avatar ?? null,
        local_character_id: it.local_character_id ?? null,
      }))

    const subjectId = bgmSyncTargetIP.value.bgm_subject_id
      ? null
      : bgmSyncPickedSubjectId.value

    const result = await applyBGMSync(bgmSyncTargetIP.value.id, items, {
      subjectId,
      updateSubjectType: true,
    })
    bgmSyncApplyResult.value = result
    bgmSyncStep.value = 'done'
    // 刷新缓存
    metadataStore.charactersByIP[bgmSyncTargetIP.value.id] = []
    await fetchIPList(true)
    ElMessage.success(`新增 ${result.created_count} · 回填 ${result.linked_count}`)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.detail || err?.message || '更新失败')
    bgmSyncStep.value = 'preview'
  } finally {
    bgmSyncApplying.value = false
  }
}

const handleBGMSyncClose = () => {
  bgmSyncDialogVisible.value = false
  resetBGMSyncState()
  fetchIPList(true)
}
</script>

<style scoped>
/* 容器设计：参考云展柜布局 */
.ip-character-management-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
}

/* 顶部标题区 */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.title-wrapper {
  min-width: 0;
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
}

.desktop-create-actions {
  display: flex;
}

.mobile-create-actions {
  display: none;
}

/* 聚合操作按钮 */
.action-dropdown-btn {
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  height: auto;
  font-size: 14px;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(142, 125, 255, 0.3);
}

.action-dropdown-btn:hover,
.action-dropdown-btn:focus {
  background: linear-gradient(135deg, #b0a4ff 0%, #9d8eff 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(142, 125, 255, 0.4);
}

.action-dropdown-btn .icon-left {
  margin-right: 6px;
}

.action-dropdown-btn .icon-right {
  margin-left: 8px;
  font-size: 12px;
}

.mobile-add-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  padding: 0;
  font-size: 20px;
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
  box-shadow: 0 8px 18px rgba(142, 125, 255, 0.28);
}

.mobile-add-btn:active {
  transform: scale(0.96);
}

/* 下拉菜单内容样式 */
.menu-item-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
}

.menu-item-content .el-icon {
  font-size: 16px;
  color: #606266;
}

.menu-tag {
  margin-left: auto;
  transform: scale(0.9);
}

/* 搜索框美化 */
.search-card {
  margin-bottom: 18px;
  border-radius: 16px;
  border: 1px solid rgba(212, 175, 55, 0.08);
  box-shadow: 0 8px 22px -18px rgba(17, 24, 39, 0.28);
}

.search-card :deep(.el-card__body) {
  padding: 20px;
}

.search-filter-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-flex {
  display: flex;
  gap: 8px;
}

.filter-flex {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-select {
  flex: 1;
}

.custom-search :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e4e7ed inset;
}

.custom-search {
  min-width: 0;
}

/* 品牌色按钮（用于弹窗提交等主操作） */
.submit-btn {
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
}

/* 搜索按钮默认样式（PC 保持现有强样式；移动端会在 media query 内弱化） */
.search-btn {
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
  border: none;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 86px;
  padding: 10px 20px;
}


/* PC端表格样式 */
.desktop-view {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

/* 刷新按钮 - 右下角悬浮 */
.refresh-fab {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 30px;
  box-shadow: 0 4px 16px rgba(163, 150, 255, 0.4);
  cursor: pointer;
  transition: all var(--transition-normal);
  z-index: 999;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  border: none;
}

.refresh-fab:hover {
  transform: scale(1.1) rotate(180deg);
  box-shadow: 0 6px 20px rgba(163, 150, 255, 0.6);
}

.refresh-fab:focus,
.refresh-fab:active {
  outline: none;
}

.refresh-fab.loading {
  cursor: not-allowed;
  opacity: 0.8;
}

.refresh-fab .is-loading {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.table-name {
  font-weight: 600;
  color: #404144;
}

.bgm-bound-icon {
  color: #67c23a;
  margin-left: 6px;
  vertical-align: middle;
  flex-shrink: 0;
}

.custom-tag {
  border: 1px solid #d9d4ff;
  color: #5a4bff;
  background: linear-gradient(135deg, #f6f4ff 0%, #ebe7ff 100%);
  box-shadow: 0 6px 12px rgba(90, 75, 255, 0.08);
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  align-items: center;
}

.character-count {
  font-weight: 600;
  color: #606266;
}

.no-type {
  color: #c0c4cc;
  font-style: italic;
}

/* 作品类型标签（动画/游戏）：低饱和配色，贴合页面调性 */
:deep(.subject-type-tag.el-tag--success) {
  --el-tag-bg-color: #edf6f2;
  --el-tag-border-color: #bfe3d3;
  --el-tag-text-color: #2f7a60;
}

:deep(.subject-type-tag.el-tag--danger) {
  --el-tag-bg-color: #f7eeee;
  --el-tag-border-color: #e5c2c6;
  --el-tag-text-color: #9a3f4b;
}

/* 展开区域样式 */
.character-expand-section {
  padding: 16px;
  background: #fafbfc;
}

.expand-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.expand-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.character-content {
  min-height: 50px;
}

/* 角色列表 Grid（PC + 移动端共用） */
.character-grid {
  display: grid;
  gap: 10px;
}

.character-grid--desktop {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.character-grid--mobile {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

.character-tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #f2f6fc;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.character-tile.clickable {
  cursor: pointer;
}

.character-tile.clickable:hover {
  transform: translateY(-1px);
  border-color: #e6e2ff;
  box-shadow: 0 6px 16px rgba(142, 125, 255, 0.10);
}

.tile-avatar {
  flex-shrink: 0;
}

.character-name-compact {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-delete-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  padding: 4px;
  height: auto;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
}

.tile-delete-btn:hover {
  background: rgba(255, 255, 255, 1);
}

.character-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid #f2f6fc;
}

.char-info-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.char-avatar {
  border: 1px solid #e4e7ed;
}

.table-avatar {
  flex-shrink: 0;
}

.char-details {
  display: flex;
  align-items: center;
  gap: 8px;
}

.char-name {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
}

.gender-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.gender-badge.female {
  background: #fff0f0;
  color: #f56c6c;
}

.gender-badge.male {
  background: #ecf5ff;
  color: #409eff;
}

.gender-badge.other {
  background: #f0f0f0;
  color: #909399;
}

.char-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-inline {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  white-space: nowrap;
}

.char-actions .el-button,
.action-inline .el-button {
  padding: 4px;
  margin: 0;
  height: auto;
}

/* 移动端现代化卡片设计 */
.mobile-view {
  display: none;
  flex-direction: column;
  position: relative;
}

.mobile-view-inner {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: calc(18px + env(safe-area-inset-bottom));
}

/* 下拉刷新相关样式 */
.pull-indicator {
  position: relative;
  width: 100%;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  justify-content: center;
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
  width: 100%;
}

.indicator-content .el-icon {
  font-size: 18px;
  transition: transform 0.3s;
}

.indicator-text {
  font-size: 14px;
  color: #909399;
}

.ip-card-item {
  background: rgba(255, 255, 255, 0.96);
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 10px 28px -20px rgba(17, 24, 39, 0.36),
    0 3px 10px -8px rgba(212, 175, 55, 0.18);
  border: 1px solid rgba(212, 175, 55, 0.12);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
}

.ip-card-item.is-expanded {
  overflow: visible;
  border-color: rgba(212, 175, 55, 0.34);
  box-shadow:
    0 14px 34px -22px rgba(17, 24, 39, 0.38),
    0 4px 16px rgba(212, 175, 55, 0.12);
}

.ip-card-item.is-sticky-active {
  padding-top: var(--mobile-sticky-shell-height, 0px);
}

.ip-card-sticky-shell {
  position: relative;
  z-index: 1;
  background: #fff;
  border-radius: 16px;
}

.ip-card-item.is-expanded > .ip-card-sticky-shell {
  z-index: 20;
  border-radius: 16px 16px 0 0;
  box-shadow:
    0 12px 28px -22px rgba(17, 24, 39, 0.48),
    0 1px 0 rgba(212, 175, 55, 0.16);
}

.ip-card-item.is-expanded > .ip-card-sticky-shell.is-stuck {
  z-index: 990;
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 14px 30px -20px rgba(17, 24, 39, 0.48),
    0 4px 14px -10px rgba(212, 175, 55, 0.32);
}

.mobile-view-inner.is-sorting .ip-card-item.is-expanded > .ip-card-sticky-shell {
  position: relative;
  top: auto;
  left: auto;
  width: auto;
  transform: none !important;
  z-index: 1;
}

.ip-card-item.is-expanded > .ip-card-sticky-shell .ip-swipe-item {
  border-radius: 16px 16px 0 0;
}

.ip-swipe-item {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 16px;
}

.swipe-actions {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 132px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(212, 175, 55, 0.12);
  background: linear-gradient(180deg, rgba(246, 244, 255, 0.98) 0%, rgba(234, 205, 163, 0.28) 100%);
}

.swipe-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--accent-purple-dark);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background var(--transition-fast), transform var(--transition-fast);
}

.swipe-action-btn .el-icon {
  font-size: 16px;
}

.swipe-action-btn.edit {
  border-bottom: 1px solid rgba(212, 175, 55, 0.12);
}

.swipe-action-btn.sync {
  color: var(--accent-purple-dark);
  border-bottom: 1px solid rgba(162, 155, 254, 0.18);
}

.swipe-action-btn.delete {
  color: #e5484d;
}

.swipe-action-btn.sync {
  color: var(--accent-purple-dark);
  border-bottom: 1px solid rgba(162, 155, 254, 0.18);
}

.swipe-action-btn:active {
  background: rgba(162, 155, 254, 0.12);
}

.swipe-action-btn.delete:active {
  background: rgba(245, 108, 108, 0.08);
}

/* ==================== BGM 增量同步弹窗补充样式 ==================== */
.bgm-sync-alert {
  margin-bottom: 12px;
}

.bgm-sync-notice {
  margin-bottom: 12px;
}

.bgm-sync-list .bgm-sync-item {
  align-items: center;
  gap: 12px;
}

.bgm-sync-item.action-matched {
  opacity: 0.6;
}

.bgm-sync-item.action-local_only {
  opacity: 0.55;
  background: rgba(0, 0, 0, 0.02);
}

.bgm-sync-item.action-skipped_duplicate {
  opacity: 0.55;
}

.bgm-sync-item:not(.selectable) {
  cursor: default;
}

.bgm-sync-item .sync-fixed-icon {
  width: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #909399);
}

.bgm-sync-item.action-matched .sync-fixed-icon {
  color: var(--el-color-success, #67c23a);
}

.bgm-sync-item.action-skipped_duplicate .sync-fixed-icon {
  color: var(--el-color-warning, #e6a23c);
}

.swipe-content {
  position: relative;
  z-index: 1;
  background: #fff;
  will-change: transform;
  overflow: hidden;
}

.ip-card-item:active {
  transform: scale(0.98);
}

.ip-card-item.is-expanded:active {
  transform: none;
}

.card-main {
  position: relative;
  min-height: 96px;
  padding: 16px 13px 15px 18px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 78px;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.ip-card-spine {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 0;
  width: 4px;
  border-radius: 0 999px 999px 0;
  background: linear-gradient(180deg, var(--primary-gold), var(--accent-purple));
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08);
}

.card-main:focus,
.card-main:active {
  outline: none;
}

.ip-card-item .card-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ip-card-item .name-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.ip-card-item .meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.type-row {
  margin-bottom: 8px;
}

.ip-card-item .name-text {
  margin: 0;
  min-width: 0;
  flex: 1;
  font-size: 16px;
  line-height: 1.28;
  color: var(--text-dark);
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subject-type-pill {
  flex: 0 1 auto;
  max-width: 100%;
  min-height: 22px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(212, 175, 55, 0.18);
  background: rgba(212, 175, 55, 0.1);
  color: var(--primary-gold-dark);
  font-size: 11px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bgm-bound-icon-mobile {
  color: #67c23a;
  margin-left: 6px;
  flex-shrink: 0;
  opacity: 0.85;
}

.card-actions-panel {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.ip-card-item .character-count-chip {
  flex: 0 0 auto;
  min-width: 62px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(162, 155, 254, 0.24);
  background: rgba(162, 155, 254, 0.12);
  color: var(--accent-purple-dark);
  box-shadow: 0 5px 14px -12px rgba(162, 155, 254, 0.9);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.character-count-chip .count-value {
  font-size: 13px;
  line-height: 1;
  font-weight: 800;
}

.character-count-chip .count-label {
  font-size: 10px;
  line-height: 1;
  font-weight: 800;
  color: rgba(90, 75, 255, 0.72);
}

.card-control-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.ip-card-item .keyword-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  max-height: 48px;
  overflow: hidden;
}

.ip-card-item .mini-tag {
  font-size: 11px;
  line-height: 1.25;
  background: rgba(162, 155, 254, 0.1);
  color: var(--accent-purple-dark);
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(162, 155, 254, 0.2);
  font-weight: 700;
}

.ip-card-item .no-tag {
  font-size: 12px;
  color: var(--text-lighter);
  font-style: italic;
}

.card-arrow {
  color: #c0c4cc;
  transition: transform 0.3s;
}

.card-arrow .rotated {
  transform: rotate(90deg);
}

.drag-handle,
.card-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  cursor: grab;
  user-select: none;
}

.drag-handle {
  width: 100%;
  padding: 6px 0;
}

.drag-handle:hover,
.card-drag-handle:hover {
  color: #606266;
}

.drag-handle svg,
.card-drag-handle svg {
  pointer-events: none;
}

.card-drag-handle {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  border-radius: 999px;
  background: rgba(162, 155, 254, 0.06);
  border: 1px solid rgba(162, 155, 254, 0.18);
  color: rgba(90, 75, 255, 0.72);
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}

.mobile-drag-handle {
  touch-action: none;
}

.mobile-expand-indicator {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(212, 175, 55, 0.1);
  color: var(--primary-gold-dark);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-fast), background var(--transition-fast);
}

.card-drag-handle:active {
  background: rgba(162, 155, 254, 0.12);
  border-color: rgba(162, 155, 254, 0.3);
  color: var(--accent-purple-dark);
}

.mobile-expand-indicator:active {
  background: rgba(212, 175, 55, 0.18);
}

.ip-card-item.is-expanded .mobile-expand-indicator {
  transform: rotate(90deg);
  background: rgba(212, 175, 55, 0.16);
}

/* 角色列表展开区域（移动端） */
.character-list {
  padding: 12px 14px 14px 18px;
  background:
    linear-gradient(180deg, rgba(245, 245, 247, 0.74), rgba(255, 255, 255, 0.92));
  border-top: 1px solid rgba(212, 175, 55, 0.12);
  border-radius: 0 0 16px 16px;
}

.character-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-dark);
}

.mobile-expand-enter-active,
.mobile-expand-leave-active {
  overflow: hidden;
  transition: opacity 0.22s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), max-height 0.26s ease;
  max-height: 420px;
}

.mobile-expand-enter-from,
.mobile-expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
}

@media (max-width: 768px) {
  .character-grid--mobile {
    gap: 8px;
  }
  .character-tile {
    padding: 9px 10px;
    border-radius: 12px;
    border-color: rgba(212, 175, 55, 0.1);
    box-shadow: 0 6px 14px -12px rgba(17, 24, 39, 0.26);
  }
  .character-name-compact {
    font-size: 13px;
  }
}

.character-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid #f2f6fc;
}

.character-card .char-info {
  flex: 1;
}

.name-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
}

.char-actions-mobile {
  display: flex;
  gap: 4px;
}

/* 卡片操作底部 */
.card-footer {
  display: flex;
  border-top: 1px solid #f2f6fc;
  background: #fafbfc;
}

.footer-action {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  color: #606266;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.footer-action .el-icon {
  font-size: 18px;
}

.footer-action:focus,
.footer-action:active {
  outline: none;
}

.footer-action:not(:last-child) {
  border-right: 1px solid #f2f6fc;
}

.footer-action.delete {
  color: #f56c6c;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .desktop-view {
    display: none;
  }
  .mobile-view {
    display: flex;
  }
  .hidden-xs-only {
    display: none !important;
  }
  .header-section {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 40px;
    align-items: start;
    gap: 10px;
    margin-bottom: 12px;
  }

  .desktop-create-actions {
    display: none !important;
  }

  .mobile-create-actions {
    display: flex;
    justify-content: flex-end;
  }

  .page-title {
    font-size: 18px;
    line-height: 1.2;
  }

  .sub-title {
    display: block;
    margin-top: 4px;
    max-width: 260px;
    font-size: 12px;
    line-height: 1.35;
  }

  .search-card {
    margin-bottom: 12px;
    border-radius: 14px;
    box-shadow: 0 8px 18px -18px rgba(17, 24, 39, 0.24);
  }

  .search-filter-container {
    display: grid;
    gap: 8px;
  }

  .search-card :deep(.el-card__body) {
    padding: 12px;
  }

  .search-flex {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
  }

  .filter-flex {
    display: block;
    grid-row: 2;
  }

  .filter-select {
    width: 100% !important;
  }

  .custom-search :deep(.el-input__wrapper),
  .filter-select :deep(.el-select__wrapper) {
    min-height: 34px;
    border-radius: 9px;
  }

  /* 移动端：搜索按钮圆润化，与输入框风格统一 */
  .search-btn {
    min-width: 72px;
    border-radius: 9px !important;
    height: 34px;
    padding: 0 12px !important;
    font-size: 13px;
    white-space: nowrap;
    background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%) !important;
    border: none !important;
    color: #fff !important;
    box-shadow: 0 2px 8px rgba(142, 125, 255, 0.25) !important;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .search-btn:active {
    transform: scale(0.96);
    box-shadow: 0 1px 4px rgba(142, 125, 255, 0.18) !important;
  }
}

@media (max-width: 380px) {
  .card-main {
    grid-template-columns: minmax(0, 1fr) 70px;
    gap: 10px;
    padding-right: 11px;
  }

  .ip-card-item .character-count-chip {
    min-width: 56px;
    padding-inline: 7px;
  }

  .card-control-row {
    gap: 6px;
  }

  .card-drag-handle,
  .mobile-expand-indicator {
    width: 28px;
    height: 28px;
    flex-basis: 28px;
  }
}

/* 弹窗与关键词管理 */
.keyword-manager-box {
  background: #f8f9fc;
  padding: 12px;
  border-radius: 8px;
  border: 1px dashed #dcdfe6;
}

.input-inline {
  margin-bottom: 12px;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.custom-dialog :deep(.el-dialog__header) {
  margin-right: 0;
  padding-bottom: 20px;
  border-bottom: 1px solid #f2f6fc;
}

.custom-dialog :deep(.el-dialog__body) {
  padding-top: 20px;
}

/* 角色表单布局 */
.form-layout {
  display: flex;
  gap: 24px;
}

.avatar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.info-col {
  flex: 1;
}

.avatar-uploader {
  width: 120px;
  height: 120px;
  border: 1px dashed #dcdfe6;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  background: #f8f9fc;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.uploader-icon {
  font-size: 28px;
  color: #8c939d;
}

.upload-label {
  position: absolute;
  bottom: 0;
  width: 100%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 11px;
  text-align: center;
  padding: 4px 0;
}

/* 头像输入模式切换 */
.avatar-mode-switch {
  margin-bottom: 12px;
  width: 100%;
  display: flex;
  justify-content: center;
}

.mode-radio-group {
  width: 100%;
}

.mode-radio-group :deep(.el-radio-button) {
  flex: 1;
}

.mode-radio-group :deep(.el-radio-button__inner) {
  width: 100%;
  border-radius: 8px !important;
}

.mode-radio-group :deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.mode-radio-group :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}

/* URL输入模式 */
.avatar-url-input {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.url-preview {
  width: 120px;
  height: 120px;
  border: 1px dashed #dcdfe6;
  border-radius: 12px;
  overflow: hidden;
  background: #f8f9fc;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.url-preview .preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.custom-radio :deep(.el-radio-button__inner) {
  border-radius: 8px !important;
  margin-right: 8px;
  border: 1px solid #dcdfe6 !important;
}

@media (max-width: 768px) {
  .form-layout {
    flex-direction: column;
    align-items: center;
  }
}

/* BGM导入/更新对话框样式 */
.bgm-dialog :deep(.el-dialog) {
  padding: 0;
  overflow: hidden;
  border-radius: 30px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.985), rgba(249, 247, 255, 0.97));
  box-shadow:
    0 28px 70px rgba(41, 34, 24, 0.18),
    0 10px 24px rgba(41, 34, 24, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.bgm-dialog :deep(.el-dialog__header) {
  margin-right: 0;
  padding: 28px 30px 18px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.1);
  background: rgba(255, 255, 255, 0.96);
}

.bgm-dialog :deep(.el-dialog__headerbtn) {
  top: 22px;
  right: 24px;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  transition: background-color var(--transition-fast), transform var(--transition-fast);
}

.bgm-dialog :deep(.el-dialog__headerbtn:hover) {
  background: rgba(162, 155, 254, 0.14);
  transform: rotate(90deg);
}

.bgm-dialog :deep(.el-dialog__headerbtn .el-dialog__close) {
  color: #7d7892;
  font-size: 16px;
}

.bgm-dialog :deep(.el-dialog__body) {
  padding: 24px 30px 0;
  min-height: 420px;
}

.bgm-dialog :deep(.el-dialog__footer) {
  padding: 18px 30px 24px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: inset 0 18px 24px -28px rgba(212, 175, 55, 0.28);
}

.bgm-dialog-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 560px;
}

.bgm-dialog-kicker {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(162, 155, 254, 0.12);
  color: #7c6fda;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.bgm-dialog-title {
  margin: 0;
  font-size: 30px;
  line-height: 1.12;
  font-weight: 700;
  color: #2f2a20;
}

.bgm-dialog-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #7a748c;
}

.bgm-import-container {
  width: 100%;
}

.bgm-flow-panel,
.bgm-results-shell,
.bgm-summary-card {
  border: 1px solid rgba(212, 175, 55, 0.1);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.88)),
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.1), transparent 32%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.bgm-flow-panel,
.bgm-results-shell {
  padding: 22px 22px 20px;
}

.bgm-summary-card {
  padding: 18px 20px;
}

.bgm-search-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bgm-search-form :deep(.el-form-item__content) {
  min-width: 0;
}

.bgm-search-form :deep(.el-form-item) {
  margin-bottom: 0;
  align-items: center;
}

.bgm-search-form :deep(.el-form-item__label) {
  color: #5f5874;
  display: inline-flex;
  align-items: center;
  font-weight: 700;
  line-height: 1.2;
  min-height: 40px;
  padding-right: 18px;
  white-space: nowrap;
}

.bgm-search-form :deep(.el-input__wrapper),
.bgm-search-form :deep(.el-select__wrapper),
.results-filter-input :deep(.el-input__wrapper) {
  border-radius: 14px;
  border: 1px solid rgba(212, 175, 55, 0.1);
  background: rgba(255, 255, 255, 0.84);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 8px 24px rgba(162, 155, 254, 0.06);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background-color var(--transition-fast);
}

.bgm-search-form :deep(.el-input__wrapper),
.results-filter-input :deep(.el-input__wrapper) {
  padding: 6px 12px;
}

.bgm-search-form :deep(.el-input__wrapper:hover),
.bgm-search-form :deep(.el-select__wrapper:hover),
.results-filter-input :deep(.el-input__wrapper:hover) {
  border-color: rgba(162, 155, 254, 0.24);
}

.bgm-search-form :deep(.el-input__wrapper.is-focus),
.bgm-search-form :deep(.el-select__wrapper.is-focused),
.results-filter-input :deep(.el-input__wrapper.is-focus) {
  border-color: rgba(162, 155, 254, 0.46);
  box-shadow:
    0 0 0 3px rgba(196, 181, 253, 0.2),
    0 12px 28px rgba(162, 155, 254, 0.1);
  background: rgba(255, 255, 255, 0.96);
}

.bgm-search-form :deep(.el-input__inner::placeholder),
.results-filter-input :deep(.el-input__inner::placeholder) {
  color: #b1adbf;
}

.bgm-step-search,
.bgm-step-results,
.bgm-step-subjects {
  padding: 6px 0 2px;
}

.bgm-search-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
  padding-left: 136px;
}

.bgm-step-searching,
.bgm-step-importing,
.bgm-step-imported {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  padding: 28px 18px;
}

.searching-content,
.importing-content,
.imported-content {
  width: min(100%, 520px);
  text-align: center;
}

.searching-icon,
.importing-icon,
.success-icon {
  font-size: 64px;
  margin-bottom: 18px;
}

.searching-icon,
.importing-icon {
  color: #8f82eb;
  animation: rotate 2s linear infinite;
}

.success-icon {
  color: #67c23a;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.searching-content h3,
.importing-content h3,
.imported-content h3 {
  margin: 0 0 10px;
  font-size: 22px;
  color: #2f2a20;
}

.searching-content p,
.importing-content p,
.results-subtitle,
.detail-status {
  color: #8f899f;
}

.searching-content p,
.importing-content p {
  font-size: 14px;
  line-height: 1.7;
  margin: 0 0 24px;
}

.searching-progress,
.importing-progress {
  width: 100%;
}

.searching-content :deep(.el-progress-bar__outer),
.importing-content :deep(.el-progress-bar__outer) {
  background: rgba(162, 155, 254, 0.12);
}

.searching-content :deep(.el-progress-bar__inner),
.importing-content :deep(.el-progress-bar__inner) {
  background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%);
}

.results-header {
  margin-bottom: 18px;
}

.results-header h3 {
  margin: 0 0 8px;
  font-size: 22px;
  line-height: 1.2;
  color: #2f2a20;
}

.results-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
}

.results-actions-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.1);
}

.results-actions-top :deep(.el-button) {
  border-radius: 999px;
  border-color: rgba(162, 155, 254, 0.18);
  color: #6a6578;
  background: rgba(255, 255, 255, 0.78);
}

.results-filter {
  margin-bottom: 14px;
}

.results-filter-input :deep(.el-input__wrapper) {
  border-radius: 999px;
}

.selected-count {
  margin-left: auto;
  color: #6f6982;
  font-size: 13px;
  font-weight: 600;
}

.character-list-container {
  max-height: 420px;
  overflow-y: auto;
  padding-right: 8px;
}

.bgm-character-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 14px 14px 12px;
  border: 1px solid rgba(212, 175, 55, 0.1);
  border-radius: 18px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast), background-color var(--transition-fast);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.88)),
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.08), transparent 34%);
}

.bgm-character-item:hover {
  transform: translateY(-1px);
  border-color: rgba(162, 155, 254, 0.28);
  box-shadow: 0 12px 26px rgba(162, 155, 254, 0.1);
}

.bgm-character-item.selected {
  border-color: rgba(162, 155, 254, 0.48);
  background:
    linear-gradient(135deg, rgba(246, 244, 255, 0.98), rgba(239, 234, 255, 0.96)),
    radial-gradient(circle at right top, rgba(162, 155, 254, 0.15), transparent 34%);
  box-shadow:
    0 16px 28px rgba(162, 155, 254, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.bgm-character-item :deep(.el-checkbox) {
  margin-right: 2px;
}

.bgm-character-item :deep(.el-checkbox__inner) {
  border-color: rgba(162, 155, 254, 0.36);
}

.bgm-character-item :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #8f82eb;
  border-color: #8f82eb;
}

.bgm-character-item .char-avatar {
  border-radius: 16px;
  box-shadow: 0 10px 20px -14px rgba(41, 34, 24, 0.35);
}

.bgm-character-item .char-info {
  flex: 1;
  min-width: 0;
}

.bgm-character-item .char-name {
  margin-bottom: 4px;
  font-size: 15px;
  font-weight: 700;
  color: #322c21;
}

.bgm-character-item .char-relation {
  font-size: 12px;
  line-height: 1.6;
  color: #8f899f;
}

.empty-results {
  padding: 34px 0 8px;
}

.bgm-summary-card {
  margin-bottom: 20px;
}

.import-summary p {
  margin: 8px 0;
  font-size: 15px;
  color: #5f5874;
}

.import-summary strong {
  color: #8f82eb;
  font-size: 18px;
}

.import-details {
  text-align: left;
  margin-top: 20px;
}

.import-details :deep(.el-collapse) {
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.1);
  background: rgba(255, 255, 255, 0.82);
}

.import-details :deep(.el-collapse-item__header) {
  padding: 0 16px;
  font-weight: 700;
  color: #5f5874;
  background: rgba(249, 247, 255, 0.82);
}

.import-details :deep(.el-collapse-item__wrap) {
  background: rgba(255, 255, 255, 0.94);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  font-size: 14px;
}

.detail-item .el-icon {
  font-size: 16px;
}

.detail-item.created .el-icon {
  color: #67c23a;
}

.detail-item.already_exists .el-icon {
  color: #e6a23c;
}

.detail-item.error .el-icon {
  color: #f56c6c;
}

.detail-text {
  flex: 1;
  color: #5f5874;
}

.detail-status {
  font-size: 12px;
}

.bgm-sync-alert-card {
  margin-bottom: 18px;
}

.bgm-sync-alert-card :deep(.el-alert) {
  border-radius: 16px;
  border: 1px solid rgba(162, 155, 254, 0.18);
  background: linear-gradient(135deg, rgba(248, 246, 255, 0.96), rgba(243, 239, 255, 0.94));
  padding: 12px 14px;
}

.bgm-sync-alert-card :deep(.el-alert__title) {
  line-height: 1.6;
  color: #5f5874;
}

/* 作品列表样式 */
.bgm-subjects-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  overflow-y: auto;
  max-height: 500px;
  padding: 4px 4px 12px;
}

.bgm-subject-item {
  display: flex;
  height: 116px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  border-radius: 18px;
  border: 1px solid rgba(212, 175, 55, 0.1);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.88)),
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.08), transparent 32%);
  box-shadow: 0 10px 26px -22px rgba(41, 34, 24, 0.28);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
}

.bgm-subject-item:hover {
  transform: translateY(-2px);
  border-color: rgba(162, 155, 254, 0.26);
  box-shadow: 0 18px 30px -22px rgba(162, 155, 254, 0.28);
  z-index: 1;
}

.bgm-subject-cover {
  width: 84px;
  height: 100%;
  flex-shrink: 0;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid rgba(212, 175, 55, 0.08);
}

.bgm-subject-cover :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.bgm-subject-item:hover .bgm-subject-cover :deep(img) {
  transform: scale(1.05);
}

.bgm-subject-cover .image-slot {
  font-size: 24px;
  color: #909399;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.bgm-subject-info {
  flex: 1;
  min-width: 0;
  padding: 14px 14px 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.subject-name {
  margin: 0 0 8px;
  font-size: 15px;
  line-height: 1.4;
  font-weight: 700;
  color: #322c21;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subject-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.subject-meta :deep(.el-tag) {
  border-radius: 999px;
  border-color: rgba(162, 155, 254, 0.18);
  color: #6f63d5;
  background: rgba(162, 155, 254, 0.08);
}

.subject-cn {
  font-size: 12px;
  color: #8f899f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.bgm-subject-arrow {
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c7c1d9;
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.bgm-subject-item:hover .bgm-subject-arrow {
  color: #8f82eb;
  transform: translateX(-2px);
}

.bgm-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.bgm-dialog-cancel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border-color: rgba(162, 155, 254, 0.18);
  color: #6a6578;
  background: rgba(255, 255, 255, 0.78);
  min-height: 40px;
  padding: 10px 18px;
}

.bgm-dialog-submit {
  min-width: 112px;
  box-shadow: 0 12px 24px rgba(162, 155, 254, 0.18);
}

/* 响应式适配 */
@media (max-width: 768px) {
  .bgm-dialog :deep(.el-dialog) {
    width: 95% !important;
  }

  .bgm-subjects-list {
    grid-template-columns: 1fr;
  }

  /* 移动端列表高度自动适配 */
  .bgm-subjects-list {
    max-height: 60vh;
  }

  .results-actions-top {
    flex-wrap: wrap;
  }

  .selected-count {
    margin-left: 0;
    width: 100%;
  }

  .character-list-container {
    max-height: 300px;
  }

  .refresh-fab {
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    font-size: 24px;
  }
}

@media (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .ip-character-management-container {
    padding: 16px;
  }

  .desktop-view {
    display: none !important;
  }

  .mobile-view {
    display: flex !important;
  }

  .hidden-xs-only {
    display: none !important;
  }

  .header-section {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 40px;
    align-items: start;
    gap: 10px;
    margin-bottom: 12px;
  }

  .desktop-create-actions {
    display: none !important;
  }

  .mobile-create-actions {
    display: flex;
    justify-content: flex-end;
  }

  .page-title {
    font-size: 18px;
    line-height: 1.2;
  }

  .sub-title {
    display: block;
    margin-top: 4px;
    max-width: 260px;
    font-size: 12px;
    line-height: 1.35;
  }

  .search-card {
    margin-bottom: 12px;
    border-radius: 14px;
    box-shadow: 0 8px 18px -18px rgba(17, 24, 39, 0.24);
  }

  .search-filter-container {
    display: grid;
    gap: 8px;
  }

  .search-card :deep(.el-card__body) {
    padding: 12px;
  }

  .search-flex {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
  }

  .filter-flex {
    display: block;
    grid-row: 2;
  }

  .filter-select {
    width: 100% !important;
  }

  .custom-search :deep(.el-input__wrapper),
  .filter-select :deep(.el-select__wrapper) {
    min-height: 34px;
    border-radius: 9px;
  }

  .search-btn {
    min-width: 72px;
    border-radius: 9px !important;
    height: 34px;
    padding: 0 12px !important;
    font-size: 13px;
    white-space: nowrap;
    background: linear-gradient(135deg, #a396ff 0%, #8e7dff 100%) !important;
    border: none !important;
    color: #fff !important;
    box-shadow: 0 2px 8px rgba(142, 125, 255, 0.25) !important;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .search-btn:active {
    transform: scale(0.96);
    box-shadow: 0 1px 4px rgba(142, 125, 255, 0.18) !important;
  }

  .character-grid--mobile {
    gap: 8px;
  }

  .character-tile {
    padding: 9px 10px;
    border-radius: 12px;
    border-color: rgba(212, 175, 55, 0.1);
    box-shadow: 0 6px 14px -12px rgba(17, 24, 39, 0.26);
  }

  .character-name-compact {
    font-size: 13px;
  }

  .form-layout {
    flex-direction: column;
    align-items: center;
  }

  .bgm-dialog :deep(.el-dialog) {
    width: 95% !important;
  }

  .bgm-subjects-list {
    grid-template-columns: 1fr;
    max-height: 60dvh;
  }

  .results-actions-top {
    flex-wrap: wrap;
  }

  .selected-count {
    margin-left: 0;
    width: 100%;
  }

  .character-list-container {
    max-height: 300px;
  }

  .refresh-fab {
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    font-size: 24px;
  }
}
</style>
