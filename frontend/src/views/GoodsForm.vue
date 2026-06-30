<template>
  <div class="goods-form" :class="{ 'goods-form--mobile-dock': isMobile, 'goods-form--create-wizard': useCreateWizard, 'goods-form--desktop-workbench': !isMobile }">
    <div class="goods-form-header" :class="{ 'goods-form-header--mobile': isMobile }">
      <div class="goods-form-title-block">
        <div class="goods-form-title">{{ formTitle }}</div>
        <div v-if="useCreateWizard" class="create-wizard-heading">
          <span class="create-wizard-heading__step">{{ currentWizardStep.title }}</span>
          <span class="create-wizard-heading__count">{{ wizardProgressText }}</span>
        </div>
      </div>
      <div v-if="isMobile" class="goods-form-header-actions">
        <el-button text type="primary" class="header-drafts-btn" @click="goDrafts">草稿箱</el-button>
        <el-dropdown trigger="click" @command="handleMobileMoreCommand">
          <el-button text class="header-more-btn" :icon="MoreFilled" circle aria-label="更多" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="cancel">取消</el-dropdown-item>
              <el-dropdown-item command="reset">重置</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div v-if="useCreateWizard" class="create-wizard-progress" aria-label="创建进度">
      <div
        v-for="(step, index) in createWizardSteps"
        :key="step.key"
        class="create-wizard-progress__item"
        :class="{
          'is-active': index === currentWizardStepIndex,
          'is-done': index < currentWizardStepIndex,
        }"
      >
        <span class="create-wizard-progress__dot">{{ index + 1 }}</span>
        <span class="create-wizard-progress__label">{{ step.title }}</span>
      </div>
    </div>

    <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px" label-position="top" class="goods-el-form">
      <div class="goods-form-workbench">
        <div class="goods-form-main-column">
      <!-- 基础信息分区 -->
      <Transition name="create-wizard-section" appear>
        <section v-show="shouldShowFormSection('basic')" class="form-section form-section--basic create-wizard-section-stage" :aria-hidden="useCreateWizard && currentWizardStep.key !== 'basic'">
          <div class="form-section-header" :class="{ 'form-section-header--stacked': useCreateWizard }">
            <span class="form-section-header-bar" aria-hidden="true"></span>
            <div class="form-section-header-body">
              <h3 class="form-section-title"><span class="form-section-title-text">基础信息</span></h3>
              <p class="form-section-subtitle form-section-header-copy">IP、角色与品类等核心信息</p>
            </div>
          </div>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12">
              <el-form-item label="谷子名称" prop="name" class="is-required">
                <el-input :model-value="formData.name" placeholder="请输入谷子名称" @update:model-value="handleNameInput" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="IP作品" prop="ip" class="is-required">
                <el-select v-model="formData.ip" placeholder="选择IP" filterable :filter-method="handleIpFilter" @change="handleIpChange" style="width: 100%">
                  <el-option v-for="ip in filteredIpOptions" :key="ip.id" :label="ip.name" :value="ip.id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="角色" prop="characters" class="is-required">
                <el-select v-model="formData.characters" placeholder="选择角色（可多选）" filterable :filter-method="handleCharacterFilter" multiple :disabled="!formData.ip" style="width: 100%">
                  <el-option v-for="char in filteredCharacters" :key="char.id" :label="char.name" :value="char.id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="品类" prop="category" class="is-required">
                <el-tree-select v-model="formData.category" :data="categoryTreeOptions" :props="{ label: 'name', value: 'id', children: 'children' }" placeholder="选择品类" style="width: 100%" clearable filterable :filter-node-method="filterCategoryNode" check-strictly />
                <div v-if="selectedCategory" class="category-chip">
                  <span class="color-dot" v-if="selectedCategory.color_tag" :style="{ backgroundColor: selectedCategory.color_tag || '#a3a3a3' }"></span>
                  <span class="chip-text">{{ selectedCategory.path_name || selectedCategory.name }}</span>
                </div>
                <div v-if="!selectedCategory && classifyResult?.suggestions?.length && classifyResult.shape_type" class="classify-suggestions">
                  <span class="classify-suggestions__label">疑似品类：</span>
                  <el-tag
                    v-for="sug in classifyResult.suggestions"
                    :key="sug.id"
                    class="classify-suggestion-tag"
                    :type="classifyResult.confidence >= 0.7 ? 'primary' : 'info'"
                    effect="plain"
                    @click="selectSuggestedCategory(sug.id)"
                  >
                    {{ sug.path_name || sug.name }}
                  </el-tag>
                  <span class="classify-confidence">{{ Math.round(classifyResult.confidence * 100) }}%</span>
                  <el-button text size="small" class="classify-dismiss-btn" @click="dismissSuggestions">
                    忽略
                  </el-button>
                </div>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="主题">
                <el-select v-model="formData.theme" placeholder="选择或创建主题" filterable :filter-method="handleThemeFilter" allow-create :reserve-keyword="true" @change="handleThemeSelectionChange" @create="handleThemeCreate" style="width: 100%" clearable>
                  <el-option v-for="theme in filteredThemeOptions" :key="theme.id" :label="theme.name" :value="theme.id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="状态" prop="status" class="is-required">
                <el-radio-group v-model="formData.status" class="status-segmented">
                  <el-radio-button label="draft">草稿</el-radio-button>
                  <el-radio-button label="in_cabinet">在馆</el-radio-button>
                  <el-radio-button label="outdoor">出街中</el-radio-button>
                  <el-radio-button label="sold">已售出</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="位置" prop="location">
                <el-tree-select v-model="formData.location" :data="locationStore.treeData" placeholder="选择位置" clearable style="width: 100%" :props="{ label: 'label', value: 'id', children: 'children' }" check-strictly />
              </el-form-item>
            </el-col>
          </el-row>
        </section>
      </Transition>

      <!-- 数量与购入信息分区 -->
      <Transition name="create-wizard-section" appear>
        <section v-show="shouldShowFormSection('meta')" class="form-section form-section--meta create-wizard-section-stage" :aria-hidden="useCreateWizard && currentWizardStep.key !== 'meta'">
          <div class="form-section-header" :class="{ 'form-section-header--stacked': useCreateWizard }">
            <span class="form-section-header-bar" aria-hidden="true"></span>
            <div class="form-section-header-body">
              <h3 class="form-section-title"><span class="form-section-title-text">数量与购入</span></h3>
              <p class="form-section-subtitle form-section-header-copy">记录数量、价格与购买时间</p>
            </div>
          </div>
          <el-row :gutter="20" class="meta-field-grid">
            <el-col :xs="12" :sm="12">
              <el-form-item label="数量" prop="quantity" class="is-required">
                <div class="field-with-icon"><span class="field-icon">📦</span><el-input-number v-model="formData.quantity" :min="1" style="width: 100%" /></div>
              </el-form-item>
            </el-col>
            <el-col :xs="12" :sm="12">
              <el-form-item label="购入价格">
                <div class="field-with-icon"><span class="field-icon">￥</span><el-input-number v-model="formData.price" :precision="2" :min="0" placeholder="请输入价格" style="width: 100%" /></div>
              </el-form-item>
            </el-col>
            <el-col :xs="12" :sm="12">
              <el-form-item label="入手日期">
                <div class="field-with-icon"><span class="field-icon">📅</span><el-date-picker v-model="formData.purchase_date" type="date" placeholder="选择日期" style="width: 100%" value-format="YYYY-MM-DD" /></div>
              </el-form-item>
            </el-col>
            <el-col :xs="12" :sm="12">
              <el-form-item label="是否官谷">
                <el-switch v-model="formData.is_official" active-text="是" inactive-text="否" inline-prompt @change="markIsOfficialTouched" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>
      </Transition>

      <!-- 备注分区 -->
      <Transition name="create-wizard-section" appear>
        <section v-show="shouldShowFormSection('notes')" class="form-section form-section--notes create-wizard-section-stage" :aria-hidden="useCreateWizard && currentWizardStep.key !== 'notes'">
          <div class="form-section-header" :class="{ 'form-section-header--stacked': useCreateWizard }">
            <span class="form-section-header-bar" aria-hidden="true"></span>
            <div class="form-section-header-body">
              <h3 class="form-section-title"><span class="form-section-title-text">备注</span></h3>
              <p class="form-section-subtitle form-section-header-copy">可以记录店铺、工艺、画师等细节</p>
            </div>
          </div>
          <el-row :gutter="20">
            <el-col :xs="24">
              <el-form-item label="备注">
                <el-input v-model="formData.notes" type="textarea" :rows="4" placeholder="请输入备注信息" />
              </el-form-item>
            </el-col>
          </el-row>
        </section>
      </Transition>
        </div>

        <aside class="goods-form-side-column" aria-label="图片与订单识别">
      <!-- 图片分区 -->
      <Transition name="create-wizard-section" appear>
        <section v-show="shouldShowFormSection('images')" class="form-section form-section--images create-wizard-section-stage" :aria-hidden="useCreateWizard && currentWizardStep.key !== 'images'">
        <div class="form-section-header" :class="{ 'form-section-header--stacked': useCreateWizard }">
          <span class="form-section-header-bar" aria-hidden="true"></span>
          <div class="form-section-header-body">
            <h3 class="form-section-title"><span class="form-section-title-text">图片</span></h3>
            <p class="form-section-subtitle form-section-header-copy">主图与细节图会直接影响云展柜观感</p>
          </div>
        </div>
        <div class="goods-form-media-stack">
          <div class="goods-form-main-photo-pane">
            <el-form-item label="主图">
              <div class="main-photo-card-shell">
                <el-upload v-model:file-list="mainPhotoList" list-type="picture-card" :auto-upload="false" :limit="1" :on-change="handleMainPhotoChange" :on-remove="handleMainPhotoRemove" :on-preview="handlePictureCardPreview" :http-request="dummyUpload" :show-file-list="true" class="main-photo-uploader" :class="{ 'hide-upload-trigger': mainPhotoList.length >= 1 }" :open-file-dialog-on-click="!isMobileUploadActionSheet" accept="image/*">
                  <template #trigger>
                    <span v-if="mainPhotoList.length < 1 && isMobileUploadActionSheet" class="main-photo-trigger" @click.stop.prevent="chooseMainPhotoSource"><el-icon><Plus /></el-icon></span>
                    <el-icon v-else-if="mainPhotoList.length < 1"><Plus /></el-icon>
                  </template>
                </el-upload>
              </div>
              <div v-if="formData.main_photo || mainPhotoList.length" class="main-photo-actions">
                <el-button size="small" :icon="Edit" @click="handleReEditMainPhoto">重新编辑主图</el-button>
              </div>
              <input v-if="isH5Mobile" ref="cameraInputRef" type="file" accept="image/*" capture="environment" style="display: none" @change="handleH5MainPhotoPicked" />
              <input v-if="isH5Mobile" ref="albumInputRef" type="file" accept="image/*" style="display: none" @change="handleH5MainPhotoPicked" />
            </el-form-item>
          </div>

          <div class="goods-form-additional-photos-pane">
            <el-form-item label="附件图片">
              <div class="additional-photos-section">
                <div v-if="existingAdditionalPhotos.length > 0" class="existing-photos">
                  <div v-for="(photo, index) in existingAdditionalPhotos" :key="photo.id" class="photo-item">
                    <el-image :src="photo.image" fit="cover" class="photo-preview" :preview-src-list="existingAdditionalPhotos.map(p => p.image)" :initial-index="index">
                      <template #error><div class="image-error"><el-icon><Picture /></el-icon></div></template>
                    </el-image>
                    <div class="photo-actions">
                      <el-input v-model="photo.label" placeholder="图片标签（可选）" size="small" class="photo-label-input" @blur="handlePhotoLabelChange(photo)" />
                      <el-button type="danger" size="small" :icon="Delete" circle @click="handleRemoveExistingPhoto(photo.id)" />
                    </div>
                  </div>
                </div>
                <div v-if="newAdditionalPhotoFiles.length > 0" class="new-photos">
                  <div v-for="(file, index) in newAdditionalPhotoFiles" :key="index" class="photo-item">
                    <el-image :src="file.preview" fit="cover" class="photo-preview" :preview-src-list="newAdditionalPhotoFiles.map(f => f.preview)" :initial-index="index">
                      <template #error><div class="image-error"><el-icon><Picture /></el-icon></div></template>
                    </el-image>
                    <div class="photo-actions">
                      <el-input v-model="file.label" placeholder="图片标签（可选）" size="small" class="photo-label-input" />
                      <el-button type="danger" size="small" :icon="Delete" circle @click="handleRemoveNewPhoto(index)" />
                    </div>
                  </div>
                </div>
                <el-upload ref="additionalUploadRef" v-model:file-list="additionalPhotoList" list-type="picture-card" :auto-upload="false" :on-change="handleAdditionalPhotoChange" :on-remove="handleAdditionalPhotoRemove" :http-request="dummyUpload" :show-file-list="false" accept="image/*" multiple class="additional-photo-upload">
                  <template #trigger><el-icon><Plus /></el-icon></template>
                </el-upload>
              </div>
            </el-form-item>
          </div>
        </div>

        <!-- OCR 订单截图识别 -->
        <el-row :gutter="20" style="margin-top: 16px">
          <el-col :xs="24">
            <el-form-item label="📸 订单截图识别">
              <div class="ocr-upload-area">
                <el-upload
                  ref="ocrUploadRef"
                  :auto-upload="false"
                  :limit="1"
                  :show-file-list="false"
                  :http-request="dummyUpload"
                  :on-change="handleOcrFileChange"
                  accept="image/*"
                  class="ocr-uploader"
                >
                  <template #trigger>
                    <div class="ocr-upload-trigger" :class="{ 'is-loading': ocrUploading }">
                      <el-icon v-if="!ocrUploading" :size="20"><Picture /></el-icon>
                      <el-icon v-else :size="20" class="is-loading"><Loading /></el-icon>
                      <span>{{ ocrUploading ? '识别中...' : '上传淘宝订单截图，自动识别填充' }}</span>
                    </div>
                  </template>
                </el-upload>
                <div class="ocr-threshold-row">
                  <span class="ocr-threshold-label">匹配精度</span>
                  <el-select v-model="confidenceThreshold" size="small" style="width: 120px" :disabled="ocrUploading">
                    <el-option
                      v-for="item in confidencePresets"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
                <p class="ocr-upload-hint">支持淘宝/天猫订单截图，识别商品名、价格、日期等信息</p>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <div v-if="!isMobile" class="desktop-action-footer" aria-label="桌面端表单操作">
          <div class="desktop-action-footer__minor">
            <el-button :icon="Close" class="sticky-btn sticky-btn--secondary desktop-action-btn desktop-action-btn--minor" @click="handleCancel">取消</el-button>
            <el-button :icon="Refresh" class="sticky-btn sticky-btn--secondary desktop-action-btn desktop-action-btn--minor" @click="handleReset">重置</el-button>
            <el-button :icon="FolderOpened" class="sticky-btn sticky-btn--secondary desktop-action-btn desktop-action-btn--minor" @click="goDrafts">草稿箱</el-button>
          </div>
          <div class="desktop-action-footer__primary">
            <el-button :icon="DocumentChecked" class="sticky-btn sticky-btn--secondary desktop-action-btn desktop-action-btn--draft" @click="submitByMode('draft')" :loading="submitting">保存草稿</el-button>
            <el-button :icon="Promotion" type="primary" class="sticky-btn sticky-btn--primary desktop-action-btn desktop-action-btn--publish" @click="submitByMode('publish')" :loading="submitting">{{ isEditMode ? '保存修改' : '发布' }}</el-button>
          </div>
        </div>
        </section>
      </Transition>
        </aside>
      </div>
    </el-form>

    <!-- 移动端：底部渐变遮罩 + 双按钮 -->
    <div v-if="isMobile" class="mobile-form-dock-wrap" :class="{ 'mobile-form-dock-wrap--visible': useCreateWizard || mobileFormDockVisible, 'mobile-form-dock-wrap--wizard': useCreateWizard }" aria-label="表单主操作">
      <div class="mobile-form-dock-stack">
        <div class="mobile-form-dock-fade" aria-hidden="true" />
        <div class="mobile-form-dock-actions">
          <template v-if="useCreateWizard">
            <el-button v-if="!isFirstWizardStep" class="mobile-form-dock-btn mobile-form-dock-btn--back" @click="goPreviousWizardStep">上一步</el-button>
            <el-button v-if="isLastWizardStep" class="mobile-form-dock-btn mobile-form-dock-btn--draft" @click="submitByMode('draft')" :loading="submitting">保存草稿</el-button>
            <el-button type="primary" class="mobile-form-dock-btn mobile-form-dock-btn--publish mobile-form-dock-btn--subtle" @click="handleWizardPrimaryAction" :loading="submitting">{{ isLastWizardStep ? '发布' : '下一步' }}</el-button>
          </template>
          <template v-else>
            <el-button class="mobile-form-dock-btn mobile-form-dock-btn--draft" @click="submitByMode('draft')" :loading="submitting">保存草稿</el-button>
            <el-button type="primary" class="mobile-form-dock-btn mobile-form-dock-btn--publish" @click="submitByMode('publish')" :loading="submitting">{{ isEditMode ? '保存修改' : '发布' }}</el-button>
          </template>
        </div>
      </div>
    </div>

    <!-- 移动端主图选择抽屉 -->
    <el-drawer v-model="photoSourceDrawerVisible" direction="btt" :with-header="false" size="auto" class="photo-source-drawer">
      <div class="action-sheet-content">
        <div class="sheet-header">选择主图</div>
        <div class="sheet-menu">
          <div class="sheet-item" @click="handlePhotoFromCamera"><el-icon><CameraIcon /></el-icon> 拍照</div>
          <div class="sheet-item" @click="handlePhotoFromAlbum"><el-icon><Picture /></el-icon> 相册选择</div>
        </div>
        <div class="sheet-cancel" @click="photoSourceDrawerVisible = false">取消</div>
      </div>
    </el-drawer>

    <!-- 图片裁切组件 -->
    <ImageCropper
      v-if="cropDialogVisible && cropImageFile"
      :key="cropImageSrc"
      :visible="cropDialogVisible"
      :image-src="cropImageSrc"
      :image-file="cropImageFile"
      @confirm="handleCropDialogConfirm"
      @cancel="handleCropDialogCancel"
      @update:visible="onCropDialogVisibleChange"
    />

    <!-- 新建去重弹窗 -->
    <el-dialog v-model="duplicateDialogVisible" width="min(92vw, 644px)" class="duplicate-dialog" :close-on-click-modal="false" @close="setDuplicateSelectedId(null)">
      <template #header><span class="duplicate-dialog-title">检测到库存中已存在相同项目</span></template>
      <p class="duplicate-dialog-desc">以下谷子与当前填写信息可能重复，请选择合并到已有条目或仍然新建一条。</p>
      <div class="duplicate-candidates-list">
        <div v-for="c in duplicateCandidates" :key="c.id" class="duplicate-candidate-card" :class="{ 'is-selected': duplicateSelectedId === c.id }" @click="setDuplicateSelectedId(c.id)">
          <div class="duplicate-candidate-thumb">
            <SquarePaddedImage v-if="c.main_photo_url" :src="c.main_photo_url" :alt="c.name" class="candidate-thumb-img" />
            <span v-else class="candidate-thumb-placeholder">无图</span>
          </div>
          <div class="duplicate-candidate-main">
            <span class="candidate-name">{{ c.name }}</span>
            <span class="candidate-meta">当前库存 {{ c.quantity }}</span>
          </div>
          <div class="duplicate-candidate-time">{{ formatCandidateCreatedAt(c.created_at) }}</div>
        </div>
      </div>
      <template #footer>
        <div class="duplicate-dialog-footer">
          <el-button @click="duplicateDialogVisible = false">取消</el-button>
          <el-button @click="handleDuplicateNew" :loading="submitting">独立新建</el-button>
          <el-button class="duplicate-merge-btn" :disabled="!duplicateSelectedId" :loading="submitting" @click="handleDuplicateMerge">合并到此条(数量+N)</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="themeImagePickerVisible" width="min(92vw, 720px)" class="theme-image-dialog" title="选择主题图片" :close-on-click-modal="false">
      <div class="theme-image-grid">
        <label
          v-for="image in activeThemeImages"
          :key="image.id"
          class="theme-image-card"
          :class="{ 'is-selected': selectedThemeImageIds.includes(image.id) }"
        >
          <input v-model="selectedThemeImageIds" type="checkbox" :value="image.id" class="theme-image-card__checkbox" />
          <img :src="image.image" :alt="image.label || '主题图片'" class="theme-image-card__img" />
          <span class="theme-image-card__label">{{ image.label || '主题图片' }}</span>
        </label>
      </div>
      <template #footer>
        <div class="theme-image-dialog-footer">
          <el-button @click="themeImagePickerVisible = false">取消</el-button>
          <el-button type="primary" :disabled="selectedThemeImageIds.length === 0" @click="applySelectedThemeImages">加入附件图片</el-button>
        </div>
      </template>
    </el-dialog>

    <OcrBatchImportDialog
      v-if="!isEditMode"
      v-model="ocrBatchDialogVisible"
      :ocr-result="ocrResult"
      :ip-options="ipOptions"
      :all-characters="characters"
      :category-options="categoryOptions"
      :defaults="ocrBatchDefaults"
      @imported="handleOcrBatchImported"
    />

    <!-- 编辑模式保留单条填充，避免误创建多条新记录 -->
    <OcrFillDialog
      v-if="isEditMode"
      v-model="ocrFillDialogVisible"
      :ocr-result="ocrResult"
      :ip-options="ipOptions"
      :all-characters="characters"
      :category-options="categoryOptions"
      :loading="ocrUploading"
      @confirm="handleOcrFillConfirm"
    />

    <!-- 图片预览 -->
    <el-image-viewer v-if="previewVisible" :url-list="[previewImage]" @close="previewVisible = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import {
  Plus,
  Delete,
  Picture,
  Camera as CameraIcon,
  Edit,
  MoreFilled,
  Loading,
  Close,
  Refresh,
  FolderOpened,
  DocumentChecked,
  Promotion,
} from '@element-plus/icons-vue'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import { useLocationStore } from '@/stores/location'
import { createGoods, updateGoods, getGoodsDetail, uploadMainPhoto, recognizeOrderImage } from '@/api/goods'
import { copyThemeImagesFromGoods, getThemeTemplate, patchTheme, saveThemeTemplate } from '@/api/metadata'
import type { GoodsCreateResponse, GoodsInput, GoodsStatus, OcrResult, ThemeImage, ThemeTemplatePayload } from '@/api/types'

import ImageCropper from '@/views/goods-form/components/ImageCropper.vue'
import OcrBatchImportDialog from '@/views/goods-form/components/OcrBatchImportDialog.vue'
import OcrFillDialog from '@/views/goods-form/components/OcrFillDialog.vue'
import SquarePaddedImage from '@/components/SquarePaddedImage.vue'
import { useGoodsFormMetadata } from '@/views/goods-form/composables/useGoodsFormMetadata'
import { useAdditionalPhotos } from '@/views/goods-form/composables/useAdditionalPhotos'
import { useDuplicateHandler } from '@/views/goods-form/composables/useDuplicateHandler'
import { useImageClassifier } from '@/views/goods-form/composables/useImageClassifier'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import { getCurrentBaseURL } from '@/utils/request'
const router = useRouter()
const route = useRoute()
const locationStore = useLocationStore()
const { isMobile } = useResponsiveDevice()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const isEditMode = computed(() => Boolean(route.params.id))
const formTitle = computed(() => (route.params.id ? '编辑谷子' : '新增谷子'))

type CreateWizardStepKey = 'basic' | 'meta' | 'images' | 'notes'

interface CreateWizardStep {
  key: CreateWizardStepKey
  title: string
  validationFields: string[]
}

const createWizardSteps: CreateWizardStep[] = [
  { key: 'basic', title: '基础信息', validationFields: ['name', 'ip', 'characters', 'category', 'status'] },
  { key: 'meta', title: '数量与购入', validationFields: ['quantity'] },
  { key: 'images', title: '图片与识别', validationFields: [] },
  { key: 'notes', title: '备注与发布', validationFields: [] },
]

const currentWizardStepIndex = ref(0)
const useCreateWizard = computed(() => isMobile.value && !isEditMode.value)
const currentWizardStep = computed<CreateWizardStep>(() => createWizardSteps[currentWizardStepIndex.value] ?? createWizardSteps[0]!)
const wizardProgressText = computed(() => `${currentWizardStepIndex.value + 1}/${createWizardSteps.length}`)
const isFirstWizardStep = computed(() => currentWizardStepIndex.value === 0)
const isLastWizardStep = computed(() => currentWizardStepIndex.value === createWizardSteps.length - 1)
const shouldShowFormSection = (section: CreateWizardStepKey) => !useCreateWizard.value || currentWizardStep.value.key === section

const formData = ref({
  name: '',
  ip: undefined as number | undefined,
  characters: [] as number[],
  category: undefined as number | undefined,
  theme: undefined as number | string | undefined | null,
  status: 'in_cabinet' as GoodsStatus,
  location: undefined as number | undefined,
  quantity: 1,
  price: undefined as number | undefined,
  purchase_date: '',
  is_official: false,
  notes: '',
  main_photo: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入谷子名称', trigger: 'blur' }],
  ip: [{ required: true, message: '请选择IP', trigger: 'change' }],
  characters: [{ required: true, message: '请至少选择一个角色', trigger: 'change' }, { type: 'array', min: 1, message: '请至少选择一个角色', trigger: 'change' }],
  category: [{ required: true, message: '请选择品类', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

// ── Composables ──

const goodsId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? id[0] : id
})

const metadata = useGoodsFormMetadata(formData)
const {
  ipOptions, filteredIpOptions, characters, categoryOptions, themeOptions, filteredThemeOptions, filteredCharacters,
  categoryTreeOptions, selectedCategory,
  pendingThemeName, handleIpChange, handleIpFilter, handleCharacterFilter, handleThemeFilter, filterCategoryNode,
  handleThemeChange: applyThemeSelection, handleThemeCreate, ensureThemeCreated, loadMetadata,
  wasThemeCreatedInCurrentFlow,
} = metadata

const additionalPhotos = useAdditionalPhotos(goodsId)
const {
  existingAdditionalPhotos, newAdditionalPhotoFiles, additionalPhotoList,
  handleAdditionalPhotoChange, handleAdditionalPhotoRemove,
  handleRemoveNewPhoto, handleRemoveExistingPhoto, handlePhotoLabelChange,
  handleAdditionalPhotosUpload, setExistingPhotos, cleanupNewPhotos, addNewPhotoFile,
} = additionalPhotos

const DEFAULT_NOTES_TEMPLATE = '店铺：\n工艺：\n画师：\n主题：'
const activeThemeTemplatePayload = ref<ThemeTemplatePayload | null>(null)
const themeImagePickerVisible = ref(false)
const selectedThemeImageIds = ref<number[]>([])
const appliedThemeImageIds = ref<Set<number>>(new Set())
const isOfficialTouched = ref(false)
const activeThemeImages = computed<ThemeImage[]>(() => activeThemeTemplatePayload.value?.images ?? [])

const isBlankText = (value: string | null | undefined) => !value || value.trim() === ''

const isBlankTemplateField = (value: unknown) => {
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'string') {
    return isBlankText(value) || value.trim() === DEFAULT_NOTES_TEMPLATE.trim()
  }
  return value === undefined || value === null
}

type GoodsNameSource = 'auto' | 'user' | 'external'

const lastAutoGeneratedName = ref('')
const isSettingGoodsName = ref(false)
const hasUserEditedGoodsName = ref(false)

const setGoodsName = (name: string, source: GoodsNameSource) => {
  isSettingGoodsName.value = true
  formData.value.name = name
  if (source === 'auto') {
    lastAutoGeneratedName.value = name
    hasUserEditedGoodsName.value = false
  } else if (source === 'user') {
    hasUserEditedGoodsName.value = name.trim() !== ''
    if (!hasUserEditedGoodsName.value) lastAutoGeneratedName.value = ''
  } else {
    hasUserEditedGoodsName.value = name.trim() !== ''
    lastAutoGeneratedName.value = ''
  }
  void nextTick(() => {
    isSettingGoodsName.value = false
  })
}

const handleNameInput = (value: string) => {
  setGoodsName(value, 'user')
}

const getSelectedCharacterNameForAutoName = () => {
  if (formData.value.characters.length !== 1) return null
  const character = characters.value.find(item => item.id === formData.value.characters[0])
  return character?.name?.trim() || null
}

const getThemeNameForAutoName = () => {
  if (pendingThemeName.value) return pendingThemeName.value
  const theme = formData.value.theme
  if (typeof theme === 'string') return theme.trim() || null
  if (typeof theme === 'number') {
    return themeOptions.value.find(item => item.id === theme)?.name?.trim() || null
  }
  return null
}

const getTopLevelCategoryNameForAutoName = () => {
  let category = categoryOptions.value.find(item => item.id === formData.value.category)
  if (!category) return null

  const seen = new Set<number>()
  while (category.parent !== null && !seen.has(category.id)) {
    seen.add(category.id)
    const parent = categoryOptions.value.find(item => item.id === category!.parent)
    if (!parent) break
    category = parent
  }

  return category.name?.trim() || null
}

const buildAutoGoodsName = () => {
  const characterName = getSelectedCharacterNameForAutoName()
  const themeName = getThemeNameForAutoName()
  const categoryName = getTopLevelCategoryNameForAutoName()
  if (!characterName || !themeName || !categoryName) return null
  return `${characterName}《${themeName}》${categoryName}`
}

const refreshAutoGoodsName = () => {
  if (hasUserEditedGoodsName.value) return

  const currentName = formData.value.name.trim()
  if (currentName && currentName !== lastAutoGeneratedName.value) {
    hasUserEditedGoodsName.value = true
    return
  }

  const nextName = buildAutoGoodsName()
  if (!nextName) {
    if (currentName && currentName === lastAutoGeneratedName.value) {
      setGoodsName('', 'auto')
    }
    return
  }

  if (formData.value.name !== nextName) {
    setGoodsName(nextName, 'auto')
  }
}

watch(
  () => [
    formData.value.name,
    formData.value.characters.join(','),
    formData.value.category,
    formData.value.theme,
    pendingThemeName.value,
    characters.value,
    categoryOptions.value,
    themeOptions.value,
  ],
  () => {
    if (isSettingGoodsName.value) return
    if (formData.value.name.trim() === '') {
      hasUserEditedGoodsName.value = false
      if (lastAutoGeneratedName.value && formData.value.name !== lastAutoGeneratedName.value) {
        lastAutoGeneratedName.value = ''
      }
    }
    refreshAutoGoodsName()
  },
  { deep: true },
)

const markIsOfficialTouched = () => {
  isOfficialTouched.value = true
}

const applyThemeTemplateDefaults = (payload: ThemeTemplatePayload) => {
  const template = payload.template
  if (!template) return
  const fd = formData.value

  if (isBlankTemplateField(fd.name) && template.name) setGoodsName(template.name, 'external')
  if (isBlankTemplateField(fd.ip) && template.ip?.id) {
    fd.ip = template.ip.id
  }
  if (isBlankTemplateField(fd.characters) && template.characters?.length) {
    fd.characters = template.characters.map(character => character.id)
  }
  if (isBlankTemplateField(fd.purchase_date) && template.purchase_date) {
    fd.purchase_date = template.purchase_date
  }
  if (!isOfficialTouched.value) {
    fd.is_official = template.is_official
  }
  if (isBlankTemplateField(fd.notes) && template.notes) {
    fd.notes = template.notes
  }
}

const askToUseThemeImages = async (images: ThemeImage[]) => {
  if (images.length === 0) return
  const freshImages = images.filter(image => !appliedThemeImageIds.value.has(image.id))
  if (freshImages.length === 0) return

  try {
    await ElMessageBox.confirm('该主题有历史图片，是否从主题图片池中选择附件图？', '使用主题图片', {
      type: 'info',
      confirmButtonText: '选择图片',
      cancelButtonText: '暂不使用',
    })
    selectedThemeImageIds.value = freshImages.map(image => image.id)
    themeImagePickerVisible.value = true
  } catch {
    // 用户取消选择历史图片，不影响主题模板字段填充。
  }
}

const loadAndApplyThemeTemplate = async (themeId: number) => {
  try {
    const payload = await getThemeTemplate(themeId)
    activeThemeTemplatePayload.value = payload
    applyThemeTemplateDefaults(payload)
    await askToUseThemeImages(payload.images)
  } catch (err: any) {
    ElMessage.warning(err?.message || '主题模板加载失败')
  }
}

const handleThemeChange = async (value: number | string | null) => {
  applyThemeSelection(value)
  if (!isEditMode.value && typeof formData.value.theme === 'number') {
    await loadAndApplyThemeTemplate(formData.value.theme)
  } else {
    activeThemeTemplatePayload.value = null
    themeImagePickerVisible.value = false
    selectedThemeImageIds.value = []
  }
}

const handleThemeSelectionChange = handleThemeChange

const buildThemeTemplatePayload = () => ({
  name: formData.value.name,
  ip_id: formData.value.ip!,
  character_ids: [...formData.value.characters],
  purchase_date: formData.value.purchase_date || null,
  is_official: formData.value.is_official,
  notes: formData.value.notes || null,
})

const promptAndCreateThemeTemplate = async (goodsIdValue: string, themeId: number | null | undefined) => {
  if (!themeId || !wasThemeCreatedInCurrentFlow(themeId)) return
  if (!formData.value.ip || formData.value.characters.length === 0 || !formData.value.name.trim()) return

  try {
    await ElMessageBox.confirm('要基于当前填写内容创建主题模板吗？下次选择该主题时会自动填充空白字段。', '创建主题模板', {
      type: 'info',
      confirmButtonText: '创建模板',
      cancelButtonText: '暂不创建',
    })
  } catch {
    return
  }

  await saveThemeTemplate(themeId, buildThemeTemplatePayload())
  await copyThemeImagesFromGoods(themeId, goodsIdValue)
}

const resolveThemeImageUrl = (url: string) => {
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) return url
  return new URL(url, getCurrentBaseURL()).toString()
}

const fileNameFromUrl = (url: string, index: number, mime: string) => {
  const fallbackExt = mime.includes('/') ? mime.split('/')[1] : 'jpg'
  const cleanUrl = url.split('?')[0] || ''
  const lastPart = cleanUrl.split('/').filter(Boolean).pop()
  return lastPart || `theme_image_${Date.now()}_${index}.${fallbackExt}`
}

const applySelectedThemeImages = async () => {
  try {
    const selectedIds = new Set(selectedThemeImageIds.value)
    const images = activeThemeImages.value.filter(image => selectedIds.has(image.id))
    for (const [index, image] of images.entries()) {
      if (appliedThemeImageIds.value.has(image.id)) continue
      const imageUrl = resolveThemeImageUrl(image.image)
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error(`拉取主题图片失败：${response.status}`)
      const blob = await response.blob()
      const mime = blob.type || 'image/jpeg'
      const file = new File([blob], fileNameFromUrl(image.image, index, mime), { type: mime })
      addNewPhotoFile(file, { label: image.label || '', preview: URL.createObjectURL(file) })
      appliedThemeImageIds.value = new Set([...appliedThemeImageIds.value, image.id])
    }
    themeImagePickerVisible.value = false
    selectedThemeImageIds.value = []
  } catch (error) {
    console.error('主题图片加入失败:', error)
    ElMessage.warning('主题图片加入失败')
  }
}

const imageClassifier = useImageClassifier()
const { classifyResult, dismissSuggestions, runClassification } = imageClassifier

const getThemeDescriptionFromNotes = () => {
  const notes = formData.value.notes?.trim() ?? ''
  if (!notes || notes === DEFAULT_NOTES_TEMPLATE.trim()) return null
  return notes
}

const syncNewThemeNotes = async (themeId: number | null | undefined) => {
  if (!themeId || !wasThemeCreatedInCurrentFlow(themeId)) return

  const description = getThemeDescriptionFromNotes()
  if (!description) return

  try {
    await patchTheme(themeId, { description })
  } catch (error) {
    console.error('保存主题备注失败:', error)
    ElMessage.warning('主题备注保存失败')
  }
}

const runNewThemePostSaveFlow = async (
  goodsIdValue: string,
  mode: 'draft' | 'publish',
  themeId: number | null | undefined,
) => {
  await syncNewThemeNotes(themeId)
  if (mode === 'publish') {
    await promptAndCreateThemeTemplate(goodsIdValue, themeId ?? null)
  }
}

const onCreateOrMergeSuccess = async (result: GoodsCreateResponse, mode: 'draft' | 'publish', themeId?: number | null) => {
  const id = result.id
  if (mainPhotoFile.value) {
    await uploadMainPhoto(id, mainPhotoFile.value)
  }
  if (newAdditionalPhotoFiles.value.length > 0) {
    await handleAdditionalPhotosUpload(id)
  }
  if (!result.merged) {
    await runNewThemePostSaveFlow(id, mode, themeId)
  }
  if (result.merged) {
    ElMessage.success('已合并到已有谷子')
  } else if (result.saved_as_draft || mode === 'draft') {
    ElMessage.success('草稿已保存')
  } else {
    ElMessage.success('创建成功')
  }
  router.push({ name: 'CloudShowcase' })
}

const duplicateHandler = useDuplicateHandler({ onSuccess: onCreateOrMergeSuccess })
const {
  duplicateDialogVisible, duplicateCandidates, duplicateSelectedId,
  setDuplicateSelectedId, formatCandidateCreatedAt,
  openDuplicateDialog, handleDuplicateMerge, handleDuplicateNew,
} = duplicateHandler

// ── Main photo state ──

const mainPhotoFile = ref<File | null>(null)
const mainPhotoList = ref<UploadFile[]>([])
const previewVisible = ref(false)
const previewImage = ref('')

const handlePictureCardPreview = (uploadFile: UploadFile) => {
  previewImage.value = uploadFile.url!
  previewVisible.value = true
}

const dummyUpload = () => Promise.resolve()

const setMainPhotoFromFile = (file: File, previewUrl?: string) => {
  const oldFile = mainPhotoList.value[0]
  if (oldFile && oldFile.url && oldFile.url.startsWith('blob:')) {
    URL.revokeObjectURL(oldFile.url)
  }
  mainPhotoFile.value = file
  formData.value.main_photo = ''
  mainPhotoList.value = [{ name: file.name || 'main_photo', url: previewUrl, status: 'success' } as UploadFile]
}

const handleMainPhotoRemove = () => {
  mainPhotoFile.value = null
  mainPhotoList.value = []
  formData.value.main_photo = ''
  dismissSuggestions()
}

// ── Crop dialog state ──

const cropDialogVisible = ref(false)
const cropImageSrc = ref('')
const cropImageFile = ref<File | null>(null)

const openCropDialog = (file: File, previewUrl?: string) => {
  cropImageFile.value = file
  if (previewUrl) {
    cropImageSrc.value = previewUrl
  } else {
    cropImageSrc.value = URL.createObjectURL(file)
  }
  cropDialogVisible.value = true
}

const handleMainPhotoChange = (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (file) {
    openCropDialog(file)
    mainPhotoList.value = []
  }
}

const handleCropDialogConfirm = (file: File, previewUrl: string) => {
  setMainPhotoFromFile(file, previewUrl)
  if (!isEditMode.value && !formData.value.category) {
    void runClassification(file)
  } else {
    dismissSuggestions()
  }
}

const selectSuggestedCategory = (categoryId: number) => {
  formData.value.category = categoryId
  dismissSuggestions()
}

const handleCropDialogCancel = () => { cropDialogVisible.value = false }

const onCropDialogVisibleChange = (v: boolean) => { cropDialogVisible.value = v }

// ── OCR recognition state ──

const confidencePresets = [
  { label: '宽松', value: 0.0 },
  { label: '均衡', value: 0.5 },
  { label: '严格', value: 0.7 },
  { label: '仅精确', value: 0.9 },
]

const ocrUploadRef = ref<any>(null)
const ocrUploading = ref(false)
const ocrResult = ref<OcrResult | null>(null)
const ocrBatchDialogVisible = ref(false)
const ocrFillDialogVisible = ref(false)
const ocrBatchThemeId = ref<number | null>(null)
const confidenceThreshold = ref(0.5)

const ocrBatchDefaults = computed(() => ({
  status: formData.value.status === 'draft' ? 'in_cabinet' as GoodsStatus : formData.value.status,
  location: formData.value.location ?? null,
  theme_id: ocrBatchThemeId.value,
  notes: formData.value.notes || null,
  purchase_date: formData.value.purchase_date || null,
  is_official: formData.value.is_official,
}))

const handleOcrFileChange = async (uploadFile: any) => {
  const file = uploadFile?.raw as File | undefined
  if (!file) return

  ocrUploading.value = true
  ocrResult.value = null
  try {
    const result = await recognizeOrderImage(file, confidenceThreshold.value)
    ocrResult.value = result
    if (isEditMode.value) {
      ocrFillDialogVisible.value = true
    } else {
      ocrBatchThemeId.value = await ensureThemeCreated()
      ocrBatchDialogVisible.value = true
    }
  } catch (err: any) {
    const detail = err?.response?.data?.detail || err?.message || 'OCR 识别失败'
    ElMessage.error(detail)
  } finally {
    ocrUploading.value = false
    ocrUploadRef.value?.clearFiles()
  }
}

const handleOcrBatchImported = () => {
  router.push({ name: 'CloudShowcase' })
}

const handleOcrFillConfirm = (data: {
  name: string
  price: string
  quantity: number
  purchase_date: string
  is_official: boolean
  ipId: number | undefined
  characterIds: number[]
  categoryId: number | undefined
  raw_text: string
}) => {
  const fd = formData.value
  if (!fd.name && data.name) setGoodsName(data.name, 'external')
  if (fd.price === undefined && data.price !== undefined && data.price !== '') {
    const p = parseFloat(data.price)
    if (!isNaN(p)) fd.price = p
  }
  if (fd.quantity <= 1 && data.quantity > 1) fd.quantity = data.quantity
  if (!fd.purchase_date && data.purchase_date) fd.purchase_date = data.purchase_date
  fd.is_official = data.is_official
  if (fd.ip === undefined && data.ipId !== undefined) {
    fd.ip = data.ipId
    fd.characters = []
  }
  if (fd.characters.length === 0 && data.characterIds.length > 0) {
    fd.characters = data.characterIds
  }
  if (fd.category === undefined && data.categoryId !== undefined) {
    fd.category = data.categoryId
  }
  ElMessage.success('已填入识别结果')
}

// ── Re-edit main photo ──

const handleReEditMainPhoto = async () => {
  try {
    const url = (formData.value.main_photo || mainPhotoList.value?.[0]?.url || '').toString()
    if (!url) { ElMessage.warning('当前没有可编辑的主图'); return }

    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`拉取图片失败（HTTP ${resp.status}）`)
    const blob = await resp.blob()
    const mime = blob.type || 'image/jpeg'
    const ext = mime.includes('/') ? mime.split('/')[1] : 'jpg'
    const file = new File([blob], `main_photo_${Date.now()}.${ext}`, { type: mime })
    openCropDialog(file, url)
  } catch (err: any) {
    ElMessage.error('重新编辑主图失败：' + (err?.message || '未知错误'))
  }
}

// ── Mobile / camera helpers ──

const isH5Mobile = computed(() => !Capacitor.isNativePlatform() && isMobile.value)
const isNativeMobile = computed(() => Capacitor.isNativePlatform() && isMobile.value)
const isMobileUploadActionSheet = computed(() => isNativeMobile.value || isH5Mobile.value)

const cameraInputRef = ref<HTMLInputElement | null>(null)
const albumInputRef = ref<HTMLInputElement | null>(null)
const photoSourceDrawerVisible = ref(false)

const chooseMainPhotoSource = () => { photoSourceDrawerVisible.value = true }

const handlePhotoFromCamera = async () => {
  photoSourceDrawerVisible.value = false
  if (isNativeMobile.value) {
    await pickMainPhotoFromNative(CameraSource.Camera)
  } else if (isH5Mobile.value) {
    cameraInputRef.value?.click()
  }
}

const handlePhotoFromAlbum = async () => {
  photoSourceDrawerVisible.value = false
  if (isNativeMobile.value) {
    await pickMainPhotoFromNative(CameraSource.Photos)
  } else if (isH5Mobile.value) {
    albumInputRef.value?.click()
  }
}

const handleH5MainPhotoPicked = (e: Event) => {
  const input = e.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return
  openCropDialog(file)
  if (input) input.value = ''
}

const pickMainPhotoFromNative = async (source: CameraSource) => {
  try {
    const photo = await Camera.getPhoto({ quality: 85, resultType: CameraResultType.Uri, source, correctOrientation: true })
    if (!photo.webPath) throw new Error('未获取到图片路径')
    const resp = await fetch(photo.webPath)
    const blob = await resp.blob()
    const mime = blob.type || 'image/jpeg'
    const ext = mime.includes('/') ? mime.split('/')[1] : 'jpg'
    const file = new File([blob], `main_photo_${Date.now()}.${ext}`, { type: mime })
    openCropDialog(file, photo.webPath)
  } catch (err: any) {
    const msg = err?.message || ''
    if (msg.includes('User cancelled') || msg.includes('canceled') || msg.includes('cancel')) return
    ElMessage.error('获取图片失败：' + (err?.message || '未知错误'))
  }
}

// ── Mobile dock scroll behavior ──

const mobileFormDockVisible = ref(false)
const MOBILE_FORM_DOCK_BOTTOM_THRESHOLD_PX = 100

const checkMobileFormDockScroll = () => {
  if (typeof window === 'undefined') return
  if (!isMobile.value) { mobileFormDockVisible.value = false; return }
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  const windowHeight = window.innerHeight
  const documentHeight = document.documentElement.scrollHeight
  mobileFormDockVisible.value = (documentHeight - (scrollTop + windowHeight)) <= MOBILE_FORM_DOCK_BOTTOM_THRESHOLD_PX
}

const handleViewportChangeForDock = () => {
  void nextTick(() => checkMobileFormDockScroll())
}

// ── Mobile create wizard behavior ──

const scrollWizardToTop = () => {
  if (typeof window === 'undefined') return
  void nextTick(() => {
    const formElement = document.querySelector('.goods-form')
    const elementTop = formElement
      ? formElement.getBoundingClientRect().top + window.scrollY
      : 0
    try {
      window.scrollTo({
        top: Math.max(0, elementTop - 12),
        behavior: 'smooth',
      })
    } catch {
      try {
        window.scrollTo(0, Math.max(0, elementTop - 12))
      } catch {
        // Some embedded WebViews and test environments do not implement scrollTo.
      }
    }
  })
}

const validateCurrentWizardStep = async () => {
  const fields = currentWizardStep.value.validationFields
  if (fields.length === 0 || !formRef.value) return true

  try {
    await formRef.value.validateField(fields)
    return true
  } catch {
    return false
  }
}

const goPreviousWizardStep = () => {
  if (!useCreateWizard.value || isFirstWizardStep.value) return
  currentWizardStepIndex.value -= 1
  scrollWizardToTop()
}

const goNextWizardStep = async () => {
  if (!useCreateWizard.value || isLastWizardStep.value) return
  const valid = await validateCurrentWizardStep()
  if (!valid) return
  currentWizardStepIndex.value += 1
  scrollWizardToTop()
}

const handleWizardPrimaryAction = async () => {
  if (isLastWizardStep.value) {
    await submitByMode('publish')
    return
  }

  await goNextWizardStep()
}

// ── Submit logic ──

const runDraftValidation = () => {
  if (!formData.value.name?.trim()) { ElMessage.warning('草稿至少需要填写谷子名称'); return false }
  if (!formData.value.ip) { ElMessage.warning('草稿至少需要选择IP'); return false }
  if (!formData.value.category) { ElMessage.warning('草稿至少需要选择品类'); return false }
  return true
}

const buildSubmitData = async (mode: 'draft' | 'publish'): Promise<GoodsInput> => {
  const themeId = await ensureThemeCreated()
  const restForm = {
    name: formData.value.name,
    ip: formData.value.ip,
    characters: formData.value.characters,
    category: formData.value.category,
    status: formData.value.status,
    location: formData.value.location,
    quantity: formData.value.quantity,
    price: formData.value.price,
    purchase_date: formData.value.purchase_date,
    is_official: formData.value.is_official,
    notes: formData.value.notes,
  }
  const effectiveStatus: GoodsStatus = mode === 'draft' ? 'draft' : (restForm.status === 'draft' ? 'in_cabinet' : restForm.status)
  const submitData: GoodsInput = {
    ...restForm, status: effectiveStatus,
    price: restForm.price?.toString(),
    ip_id: restForm.ip!, character_ids: restForm.characters,
    category_id: restForm.category!, theme_id: themeId,
  }
  if (!restForm.purchase_date) delete (submitData as any).purchase_date
  return submitData
}

const submitByMode = async (mode: 'draft' | 'publish') => {
  if (!formRef.value) return
  if (mode === 'publish') {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
  } else if (!runDraftValidation()) return

  submitting.value = true
  let submitData: GoodsInput | null = null
  try {
    submitData = await buildSubmitData(mode)

    if (route.params.id) {
      const id = route.params.id as string
      await updateGoods(id, submitData)
      if (mainPhotoFile.value) await uploadMainPhoto(id, mainPhotoFile.value)
      await handleAdditionalPhotosUpload(id)
      await runNewThemePostSaveFlow(id, mode, submitData.theme_id ?? null)
      ElMessage.success(mode === 'draft' ? '草稿已保存' : '更新成功')
      router.push({ name: 'CloudShowcase' })
    } else {
      const createPayload: GoodsInput = mode === 'publish' ? { ...submitData, merge_strategy: 'auto' } : submitData
      const result = await createGoods(createPayload)
      await onCreateOrMergeSuccess(result, mode, createPayload.theme_id ?? null)
    }
  } catch (err: any) {
    if (mode === 'publish' && err.response?.status === 409) {
      const data = err.response?.data
      if (data?.code === 'goods_duplicate' && Array.isArray(data?.candidates) && submitData) {
        openDuplicateDialog(data.candidates, { ...submitData })
      } else {
        ElMessage.error(data?.detail || err.message || '提交失败')
      }
    } else if (err.response?.status === 400) {
      ElMessage.warning(err.response?.data?.detail || err.message || '请求参数错误')
    } else {
      ElMessage.error(err.message || '提交失败')
    }
  } finally {
    submitting.value = false
  }
}

const handleReset = async () => {
  try {
    await ElMessageBox.confirm('确定要重置表单吗？当前填写内容将恢复为进入页面时的状态（未保存的修改会丢失）。', '重置表单', { type: 'warning', confirmButtonText: '重置', cancelButtonText: '取消' })
    formRef.value?.resetFields()
    dismissSuggestions()
    if (useCreateWizard.value) currentWizardStepIndex.value = 0
  } catch { /* user cancelled */ }
}

const handleCancel = async () => {
  try {
    await ElMessageBox.confirm('确定要离开吗？未保存的修改将丢失。', '离开页面', { type: 'warning', confirmButtonText: '离开', cancelButtonText: '留在页面' })
    router.back()
  } catch { /* user cancelled */ }
}

const handleMobileMoreCommand = (command: string) => {
  if (command === 'cancel') void handleCancel()
  else if (command === 'reset') void handleReset()
}

const goDrafts = () => router.push({ name: 'GoodsDrafts' })

// ── Lifecycle ──

onMounted(async () => {
  handleViewportChangeForDock()
  window.addEventListener('resize', handleViewportChangeForDock)
  window.addEventListener('scroll', handleWindowScrollForDock, { passive: true })

  try { await loadMetadata() } catch { ElMessage.error('加载基础数据失败') }
  await locationStore.fetchNodes()

  if (!route.params.id) {
    formData.value.notes = DEFAULT_NOTES_TEMPLATE
  }

  if (route.params.id) {
    try {
      const data = await getGoodsDetail(route.params.id as string)
      formData.value = {
        name: data.name,
        ip: data.ip.id,
        characters: data.characters.map(c => c.id),
        category: data.category.id,
        theme: data.theme?.id || null,
        status: data.status as GoodsStatus,
        location: data.location || undefined,
        quantity: data.quantity,
        price: data.price ? parseFloat(data.price) : undefined,
        purchase_date: data.purchase_date || '',
        is_official: data.is_official,
        notes: data.notes || '',
        main_photo: data.main_photo || '',
      }
      hasUserEditedGoodsName.value = Boolean(data.name?.trim())
      lastAutoGeneratedName.value = ''
      if (data.main_photo) {
        mainPhotoList.value = [{ url: data.main_photo, name: 'main_photo' } as UploadFile]
      }
      if (data.additional_photos && data.additional_photos.length > 0) {
        setExistingPhotos(data.additional_photos)
      }
    } catch { ElMessage.error('加载数据失败') }
  }

  await nextTick()
  checkMobileFormDockScroll()
})

const handleWindowScrollForDock = () => { checkMobileFormDockScroll() }

onUnmounted(() => {
  window.removeEventListener('resize', handleViewportChangeForDock)
  window.removeEventListener('scroll', handleWindowScrollForDock)
  cleanupNewPhotos()
  if (cropImageSrc.value && cropImageSrc.value.startsWith('blob:')) {
    URL.revokeObjectURL(cropImageSrc.value)
  }
  mainPhotoList.value.forEach((file) => {
    if (file.url && file.url.startsWith('blob:')) URL.revokeObjectURL(file.url)
  })
})
</script>

<style scoped>
.goods-form { padding: 24px; max-width: 1200px; margin: 0 auto; }
.goods-form--desktop-workbench { max-width: 1320px; padding: 20px 24px 24px; }
.goods-form--mobile-dock { padding-bottom: calc(100px + env(safe-area-inset-bottom, 0px)); }
.goods-form-header { margin-bottom: 16px; }
.goods-form-header--mobile { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.goods-form-title-block { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.goods-form-header--mobile .goods-form-title-block { flex: 1; }
.goods-form-header-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.header-drafts-btn { padding: 6px 10px; font-size: 14px; }
.header-more-btn { font-size: 20px; }
.goods-form-title { font-size: 20px; font-weight: 600; color: var(--primary-gold); }
.goods-form--desktop-workbench .goods-form-header { margin-bottom: 14px; }
.goods-form-workbench { min-width: 0; }
.goods-form-main-column,
.goods-form-side-column { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.create-wizard-heading { display: flex; align-items: center; gap: 8px; min-width: 0; color: #909399; font-size: 12px; line-height: 1.2; }
.create-wizard-heading__step { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.create-wizard-heading__count { flex-shrink: 0; padding: 2px 7px; border-radius: 999px; background: rgba(212,175,55,0.1); color: var(--primary-gold-dark); font-weight: 700; }
.create-wizard-progress { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 0 0 12px; padding: 8px; border-radius: 14px; background: rgba(255,255,255,0.96); border: 1px solid rgba(212,175,55,0.14); box-shadow: var(--shadow-sm); }
.create-wizard-progress__item { position: relative; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; color: #a8abb2; }
.create-wizard-progress__item:not(:last-child)::after { content: ''; position: absolute; top: 12px; left: calc(50% + 13px); width: calc(100% - 20px); height: 1px; background: #e8eaf2; }
.create-wizard-progress__item.is-done:not(:last-child)::after, .create-wizard-progress__item.is-active:not(:last-child)::after { background: rgba(212,175,55,0.38); }
.create-wizard-progress__dot { position: relative; z-index: 1; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #f3f4f8; color: #9ca3af; font-size: 12px; font-weight: 800; }
.create-wizard-progress__label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; line-height: 1.2; }
.create-wizard-progress__item.is-active .create-wizard-progress__dot { color: #ffffff; background: linear-gradient(135deg, var(--primary-gold), var(--primary-gold-light)); box-shadow: 0 4px 12px rgba(212,175,55,0.26); }
.create-wizard-progress__item.is-active .create-wizard-progress__label { color: var(--primary-gold-dark); font-weight: 700; }
.create-wizard-progress__item.is-done .create-wizard-progress__dot { color: var(--primary-gold-dark); background: rgba(212,175,55,0.14); }
.goods-el-form { margin-top: 4px; }
.sticky-action-bar { margin-top: 12px; padding-bottom: env(safe-area-inset-bottom, 0); }
.sticky-action-inner { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; align-items: center; }
.sticky-action-inner :deep(.el-button) { margin: 0; }
.goods-form--desktop-workbench .desktop-action-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 14px -16px -16px;
  padding: 12px 16px 14px;
  border-top: 1px solid rgba(17,24,39,0.06);
  background: rgba(250,250,252,0.72);
}
.goods-form--desktop-workbench .desktop-action-footer__minor,
.goods-form--desktop-workbench .desktop-action-footer__primary {
  display: grid;
  gap: 8px;
}
.goods-form--desktop-workbench .desktop-action-footer__minor {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.goods-form--desktop-workbench .desktop-action-footer__primary {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.goods-form--desktop-workbench .desktop-action-btn {
  width: 100%;
  min-width: 0;
  margin: 0;
  font-weight: 600;
}
.goods-form--desktop-workbench .desktop-action-btn--minor {
  min-height: 32px;
  padding-right: 8px;
  padding-left: 8px;
  color: #606266;
  background: rgba(255,255,255,0.58);
  border-color: #e5e7ef;
}
.goods-form--desktop-workbench .desktop-action-btn--minor:hover,
.goods-form--desktop-workbench .desktop-action-btn--minor:focus {
  color: var(--primary-gold-dark);
  background: rgba(255,250,240,0.82);
  border-color: rgba(212,175,55,0.34);
}
.goods-form--desktop-workbench .desktop-action-btn--draft,
.goods-form--desktop-workbench .desktop-action-btn--publish {
  min-height: 38px;
}
.goods-form--desktop-workbench .desktop-action-btn--draft {
  color: var(--primary-gold-dark);
  background: #fffaf0;
  border-color: rgba(212,175,55,0.32);
}
.goods-form--desktop-workbench .desktop-action-btn--draft:hover,
.goods-form--desktop-workbench .desktop-action-btn--draft:focus {
  color: var(--primary-gold-dark);
  background: #fff4dc;
  border-color: rgba(212,175,55,0.48);
}
@media (max-width: 768px) {
  .sticky-action-inner { justify-content: center; }
  .sticky-action-inner :deep(.el-button) { padding: 8px 12px; font-size: 12px; }
}
.mobile-form-dock-wrap { position: fixed; left: 0; right: 0; bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 8px); z-index: 999; pointer-events: none; background: transparent; transform: translateY(calc(100% + 24px)); opacity: 0; transition: transform 0.3s ease, opacity 0.3s ease; }
.mobile-form-dock-wrap--visible { transform: translateY(0); opacity: 1; }
.mobile-form-dock-stack { position: relative; display: flex; flex-direction: column; width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 16px 10px; box-sizing: border-box; isolation: isolate; }
.mobile-form-dock-fade { position: absolute; z-index: 0; left: 50%; margin-left: -50vw; bottom: 0; width: 100vw; height: min(200px, 42vh); min-height: 140px; pointer-events: none; background: linear-gradient(to top, var(--secondary-gray) 0%, rgba(245,245,247,0.92) 28%, rgba(245,245,247,0.55) 55%, rgba(255,255,255,0) 100%); }
.mobile-form-dock-actions { position: relative; z-index: 1; display: flex; align-items: stretch; gap: 10px; width: 100%; pointer-events: auto; background: transparent; }
.mobile-form-dock-btn { flex: 1; min-height: 44px; margin: 0; border-radius: 999px !important; font-size: 14px; font-weight: 600; }
.goods-form .mobile-form-dock-wrap :deep(.mobile-form-dock-btn.el-button) { border-radius: 999px !important; }
.mobile-form-dock-btn--back { flex: 3; color: #606266 !important; background: #ffffff !important; border: 1px solid #e6e8ef !important; box-shadow: none !important; }
.mobile-form-dock-btn--back:hover, .mobile-form-dock-btn--back:focus { color: var(--primary-gold-dark) !important; background: #fffaf0 !important; border-color: rgba(212,175,55,0.4) !important; }
.mobile-form-dock-btn--draft { flex: 4; color: #a289ff !important; background: #f7f3ff !important; border: none !important; box-shadow: none !important; }
.mobile-form-dock-btn--draft:hover, .mobile-form-dock-btn--draft:focus { color: #a289ff !important; background: rgba(162,137,255,0.12) !important; border: none !important; }
.mobile-form-dock-btn--publish { flex: 6; --el-button-bg-color: var(--primary-gold); --el-button-border-color: var(--primary-gold); --el-button-hover-bg-color: var(--primary-gold-dark); --el-button-hover-border-color: var(--primary-gold-dark); --el-button-active-bg-color: var(--primary-gold-dark); --el-button-active-border-color: var(--primary-gold-dark); color: #ffffff !important; background-color: var(--primary-gold) !important; border-color: var(--primary-gold) !important; }
.mobile-form-dock-btn--publish:hover, .mobile-form-dock-btn--publish:focus { color: #ffffff !important; background-color: var(--primary-gold-dark) !important; border-color: var(--primary-gold-dark) !important; }
.mobile-form-dock-btn--subtle { color: var(--primary-gold-dark) !important; background: linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(251,247,238,0.9) 100%) !important; border: 1px solid rgba(212,175,55,0.38) !important; box-shadow: 0 8px 20px rgba(31,41,55,0.08), inset 0 1px 0 rgba(255,255,255,0.72) !important; text-shadow: none !important; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.mobile-form-dock-btn--subtle:hover, .mobile-form-dock-btn--subtle:focus { color: var(--primary-gold-dark) !important; background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,241,221,0.94) 100%) !important; border-color: rgba(212,175,55,0.48) !important; box-shadow: 0 9px 22px rgba(31,41,55,0.1), inset 0 1px 0 rgba(255,255,255,0.78) !important; }
.mobile-form-dock-btn--subtle:active { transform: translateY(1px) scale(0.99); box-shadow: 0 5px 14px rgba(31,41,55,0.08), inset 0 1px 0 rgba(255,255,255,0.62) !important; }
.mobile-form-dock-wrap--wizard { bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 6px); }
.mobile-form-dock-wrap--wizard .mobile-form-dock-stack { padding-bottom: 8px; }
.mobile-form-dock-wrap--wizard .mobile-form-dock-fade { height: min(164px, 34vh); min-height: 116px; }
.mobile-form-dock-wrap--wizard .mobile-form-dock-actions { gap: 8px; }
.mobile-form-dock-wrap--wizard .mobile-form-dock-btn { min-height: 48px; }
@supports not (bottom: env(safe-area-inset-bottom)) { .mobile-form-dock-wrap { bottom: 72px; } }
.form-section { margin-bottom: 20px; padding: 16px 18px 18px; border-radius: 16px; background: #ffffff; box-shadow: 0 4px 16px rgba(0,0,0,0.04); border: 1px solid rgba(17,24,39,0.04); }
.goods-form--desktop-workbench .form-section {
  margin-bottom: 0;
  padding: 14px 16px 16px;
  border-radius: 14px;
  border-color: rgba(17,24,39,0.06);
  box-shadow: 0 3px 14px rgba(15,23,42,0.04);
}
.form-section--images { background: radial-gradient(circle at top left, #ffffff, #fafbff); }
.form-section-header { margin-bottom: 12px; display: flex; align-items: flex-start; gap: 10px; }
.form-section-header::before { content: none; }
.form-section-header-bar { flex: 0 0 3px; width: 3px; height: 20px; margin-top: 2px; border-radius: 999px; background: linear-gradient(180deg, var(--primary-gold), #d9c18a); }
.form-section-header-body { min-width: 0; display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; }
.form-section-title { margin: 0; font-size: 18px; line-height: 1.25; font-weight: 600; color: #303133; }
.form-section-title-text { display: block; white-space: nowrap; word-break: keep-all; }
.form-section-subtitle { min-width: 0; margin: 0; font-size: 12px; line-height: 1.45; color: #909399; }
.goods-form--desktop-workbench .form-section-header { margin-bottom: 10px; }
.goods-form--desktop-workbench .form-section-header-bar { height: 18px; }
.goods-form--desktop-workbench .form-section-title { font-size: 17px; }
.form-section-header--stacked .form-section-header-body { flex-direction: column; align-items: flex-start; gap: 4px; }
.goods-form :deep(.el-form-item) { margin-bottom: 26px; }
.goods-form--desktop-workbench :deep(.el-form-item) { margin-bottom: 20px; }
.goods-form--desktop-workbench .form-section :deep(.el-form-item:last-child) { margin-bottom: 0; }
.goods-form--desktop-workbench :deep(.el-form-item__error) {
  position: static;
  margin-top: 4px;
  padding-top: 0;
  line-height: 1.35;
  white-space: normal;
}
.goods-form--desktop-workbench .meta-field-grid {
  row-gap: 18px;
}
.goods-form--desktop-workbench .meta-field-grid :deep(.el-form-item) {
  margin-bottom: 0;
}
.goods-form :deep(.el-input__wrapper), .goods-form :deep(.el-textarea__inner), .goods-form :deep(.el-select .el-input__wrapper), .goods-form :deep(.el-input-number__decrease), .goods-form :deep(.el-input-number__increase), .goods-form :deep(.el-date-editor.el-input__wrapper), .goods-form :deep(.el-date-editor.el-input) { border-radius: 10px; border-color: #e5e5e5; background-color: #ffffff; transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease; }
.goods-form :deep(.el-input__wrapper:hover), .goods-form :deep(.el-textarea__inner:hover), .goods-form :deep(.el-select .el-input__wrapper:hover), .goods-form :deep(.el-date-editor.el-input__wrapper:hover) { border-color: #d0d0d7; box-shadow: 0 0 0 1px rgba(208,208,215,0.3); }
.goods-form :deep(.el-input.is-focus .el-input__wrapper), .goods-form :deep(.el-select .el-input.is-focus .el-input__wrapper), .goods-form :deep(.el-textarea__inner:focus), .goods-form :deep(.el-date-editor.el-input__wrapper.is-active) { border-color: var(--primary-gold); box-shadow: 0 0 0 1px rgba(195,160,80,0.35), 0 10px 18px rgba(0,0,0,0.06); }
.goods-form :deep(.el-button) { border-radius: 10px; }
.goods-form :deep(.el-form-item__label) { color: #606266; font-weight: 500; font-size: 13px; }
.goods-form :deep(.el-form-item__label .el-form-item__required-star) { color: #f56c6c; font-size: 12px; margin-left: 2px; }
.goods-form :deep(.el-form-item.is-required .el-form-item__label) { position: relative; }
.goods-form--desktop-workbench .form-section--images {
  overflow: hidden;
}
.goods-form-media-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.goods-form-main-photo-pane,
.goods-form-additional-photos-pane {
  min-width: 0;
}
.goods-form--desktop-workbench .form-section--images :deep(.el-row) {
  margin-right: 0 !important;
  margin-left: 0 !important;
}
.goods-form--desktop-workbench .form-section--images :deep(.el-col) {
  padding-right: 0 !important;
  padding-left: 0 !important;
}
@media (min-width: 1100px) {
  .goods-form--desktop-workbench .goods-form-workbench {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
    gap: 20px;
    align-items: start;
  }

  .goods-form--desktop-workbench .goods-form-side-column {
    position: sticky;
    top: 84px;
    align-self: start;
    max-height: calc(100vh - 108px);
    overflow-y: auto;
    padding-right: 4px;
  }
}
@media (min-width: 1440px) {
  .goods-form--desktop-workbench .goods-form-workbench {
    grid-template-columns: minmax(0, 1fr) minmax(380px, 440px);
  }
}
.field-with-icon { display: flex; align-items: center; gap: 8px; }
.field-icon { flex-shrink: 0; font-size: 16px; color: #909399; }
.category-chip { margin-top: 6px; display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: #f7f7fb; border: 1px solid #ebeef5; font-size: 12px; color: #606266; }
.color-dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 1px #e0e0e0; }
.chip-text { white-space: nowrap; }
.main-photo-card-shell { display: block; width: 220px; }
.goods-form--desktop-workbench .main-photo-card-shell {
  width: min(220px, 100%);
}
.hide-upload-trigger :deep(.el-upload--picture-card) { display: none; }
.main-photo-trigger { display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.main-photo-actions { width: 220px; margin-top: 14px; display: flex; justify-content: center; }
.goods-form--desktop-workbench .main-photo-actions {
  width: min(220px, 100%);
}
.main-photo-uploader :deep(.el-upload--picture-card) { width: 220px; height: 220px; border-radius: 16px; border: 1px dashed #e0e3f0; border-color: #e0e3f0; background: #fafbff; transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease, transform 0.16s ease; }
.main-photo-uploader :deep(.el-upload--picture-card:hover) { border-color: var(--primary-gold); background: #fdfaf3; box-shadow: 0 8px 18px rgba(0,0,0,0.06); transform: translateY(-1px); }
.main-photo-uploader :deep(.el-upload--picture-card .el-icon) { font-size: 26px; color: #b1b5c6; }
.main-photo-uploader :deep(.el-upload-list--picture-card) { display: block; width: 220px; }
.main-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item) { width: 220px; height: 220px; margin: 0; border-radius: 16px; }
.main-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item) { background: #fff; }
.main-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item-thumbnail) { width: 100%; height: 100%; object-fit: contain; background: #fff; }
.goods-form--desktop-workbench .main-photo-uploader :deep(.el-upload--picture-card),
.goods-form--desktop-workbench .main-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item) {
  width: min(220px, 100%);
  height: auto;
  aspect-ratio: 1;
}
.goods-form--desktop-workbench .main-photo-uploader :deep(.el-upload-list--picture-card) {
  width: min(220px, 100%);
}
.additional-photo-upload :deep(.el-upload--picture-card) { width: 120px; height: 120px; border-radius: 12px; border-style: dashed; border-width: 1px; border-color: #e7e9f4; background-color: #fbfbff; }
.goods-form--desktop-workbench .additional-photo-upload :deep(.el-upload--picture-card) {
  width: 120px;
  height: 120px;
}
:deep(.el-upload--picture-card) { border-color: var(--border-color); }
:deep(.el-upload--picture-card:hover) { border-color: var(--primary-gold); }
.additional-photos-section { width: 100%; }
.existing-photos, .new-photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 16px; margin-bottom: 16px; }
@media (max-width: 768px) { .existing-photos, .new-photos { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; } }
.photo-item { position: relative; display: flex; flex-direction: column; gap: 8px; }
.photo-preview { width: 100%; height: 120px; border-radius: 10px; border: 1px solid var(--border-color); overflow: hidden; }
@media (max-width: 768px) { .photo-preview { height: 100px; } }
.photo-actions { display: flex; gap: 8px; align-items: center; }
.photo-label-input { flex: 1; }
.image-error { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background-color: #f5f7fa; color: #909399; }
.additional-photo-upload { display: inline-block; }
.additional-photo-upload :deep(.el-upload--picture-card) { width: 120px; height: 120px; border-radius: 12px; border-style: dashed; }
.status-segmented { display: inline-flex; gap: 8px; }
.status-segmented :deep(.el-radio-button__inner) { border-radius: 999px !important; border: none; background-color: transparent; box-shadow: none; padding: 8px 14px; font-size: 13px; color: #606266; }
.status-segmented :deep(.el-radio-button:first-child .el-radio-button__inner), .status-segmented :deep(.el-radio-button:last-child .el-radio-button__inner) { border-radius: 999px !important; }
.status-segmented :deep(.el-radio-button__orig-radio:checked + .el-radio-button__inner) { background: linear-gradient(135deg, #a396ff 0%, var(--primary-gold) 100%); color: #ffffff; box-shadow: 0 8px 18px rgba(163,150,255,0.35); }
.status-segmented :deep(.el-radio-button__inner:hover) { background-color: rgba(0,0,0,0.03); }
.action-sheet-content { background: #f8f8f8; padding-bottom: env(safe-area-inset-bottom); }
.sheet-header { padding: 12px; text-align: center; font-size: 12px; color: #909399; background: #fff; border-bottom: 1px solid #f0f0f0; }
.sheet-menu { background: #fff; }
.sheet-item { padding: 16px; text-align: center; font-size: 16px; border-bottom: 1px solid #f5f5f5; color: #333; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
.sheet-item:active { background: #f5f5f5; }
.sheet-cancel { margin-top: 8px; background: #fff; padding: 16px; text-align: center; font-size: 16px; color: #333; cursor: pointer; }
.sheet-cancel:active { background: #f5f5f5; }

.duplicate-dialog :deep(.el-dialog__body) { padding-top: 12px; }
.duplicate-dialog-title { font-weight: 700; font-size: 1.125rem; color: var(--el-text-color-primary); }
.duplicate-dialog-desc { margin: 0 0 16px; font-size: 14px; color: #909399; line-height: 1.5; }
.duplicate-candidates-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.duplicate-candidate-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; border: 2px solid transparent; background: var(--el-fill-color-blank); cursor: pointer; transition: border-color 0.2s, background-color 0.2s; }
.duplicate-candidate-card:hover { background: var(--el-fill-color-light); }
.duplicate-candidate-card.is-selected { border-color: #D4AF37; background: rgba(212,175,55,0.06); }
.duplicate-candidate-thumb { flex-shrink: 0; width: 40px; height: 40px; border-radius: 8px; background: var(--el-fill-color-light); border: 1px solid var(--el-border-color-lighter); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.duplicate-candidate-thumb .candidate-thumb-img { width: 100%; height: 100%; }
.duplicate-candidate-thumb .candidate-thumb-placeholder { font-size: 11px; color: var(--el-text-color-placeholder); }
.duplicate-candidate-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.duplicate-candidate-card .candidate-name { font-size: 16px; font-weight: 500; color: #1a1a1a; }
.duplicate-candidate-card .candidate-meta { font-size: 12px; color: #909399; }
.duplicate-candidate-time { flex-shrink: 0; font-size: 12px; color: #909399; }
.duplicate-dialog-footer { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
.duplicate-dialog-footer .el-button:first-child { color: #606266; border-color: var(--el-border-color); }
.duplicate-dialog-footer .el-button:nth-child(2) { border-color: var(--el-border-color); }
.duplicate-dialog-footer .duplicate-merge-btn { background-color: #E2C04A; border-color: #E2C04A; color: #1a1a1a; }
.duplicate-dialog-footer .duplicate-merge-btn:hover, .duplicate-dialog-footer .duplicate-merge-btn:focus { background-color: #D9B83D; border-color: #D9B83D; color: #1a1a1a; }
.duplicate-dialog-footer .duplicate-merge-btn:disabled { background-color: var(--el-fill-color); border-color: var(--el-border-color-lighter); color: var(--el-text-color-placeholder); }

@media (pointer: coarse) and (orientation: portrait) and (max-width: 1200px) {
  .goods-form {
    padding: 16px;
  }

  .goods-form--mobile-dock {
    padding-bottom: calc(100px + env(safe-area-inset-bottom, 0px));
  }

  .sticky-action-inner {
    justify-content: center;
  }

  .sticky-action-inner :deep(.el-button) {
    padding: 8px 12px;
    font-size: 12px;
  }

  .mobile-form-dock-wrap {
    bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 8px);
  }

  .mobile-form-dock-stack {
    max-width: 1200px;
    padding: 0 16px 10px;
  }

  .existing-photos,
  .new-photos {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .photo-preview {
    height: 100px;
  }
}

.goods-form--create-wizard {
  --mobile-main-photo-size: min(44vw, 168px);
  padding: 12px 16px calc(130px + env(safe-area-inset-bottom, 0px));
}

.goods-form--create-wizard .goods-form-header {
  margin-bottom: 10px;
}

.goods-form--create-wizard .goods-el-form {
  position: relative;
  margin-top: 0;
}

.goods-form--create-wizard .create-wizard-section-stage {
  transform-origin: top center;
  will-change: opacity, transform, filter;
}

.goods-form--create-wizard .create-wizard-section-enter-active,
.goods-form--create-wizard .create-wizard-section-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.3s ease;
}

.goods-form--create-wizard .create-wizard-section-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  pointer-events: none;
}

.goods-form--create-wizard .create-wizard-section-enter-from {
  opacity: 0;
  transform: translate3d(18px, 10px, 0) scale(0.985);
  filter: blur(8px);
}

.goods-form--create-wizard .create-wizard-section-leave-to {
  opacity: 0;
  transform: translate3d(-12px, -8px, 0) scale(0.985);
  filter: blur(6px);
}

@media (prefers-reduced-motion: reduce) {
  .goods-form--create-wizard .create-wizard-section-enter-active,
  .goods-form--create-wizard .create-wizard-section-leave-active {
    transition: opacity 0.12s ease;
  }

  .goods-form--create-wizard .create-wizard-section-enter-from,
  .goods-form--create-wizard .create-wizard-section-leave-to {
    transform: none;
    filter: none;
  }
}

.goods-form--create-wizard .form-section {
  margin-bottom: 12px;
  padding: 16px 18px 20px;
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-sm);
}

.goods-form--create-wizard .form-section-header {
  margin-bottom: 16px;
  align-items: flex-start;
}

.goods-form--create-wizard .form-section-title {
  font-size: 17px;
  line-height: 1.3;
}

.goods-form--create-wizard .form-section-subtitle {
  width: 100%;
  margin-left: 0;
  line-height: 1.45;
}

.goods-form--create-wizard :deep(.el-form-item) {
  margin-bottom: 20px;
}

.goods-form--create-wizard :deep(.el-form-item__error) {
  position: static;
  margin-top: 5px;
  padding-top: 0;
  line-height: 1.35;
  white-space: normal;
}

.goods-form--create-wizard .form-section :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.goods-form--create-wizard .main-photo-card-shell,
.goods-form--create-wizard .main-photo-actions,
.goods-form--create-wizard .main-photo-uploader :deep(.el-upload-list--picture-card) {
  width: var(--mobile-main-photo-size);
}

.goods-form--create-wizard .main-photo-uploader :deep(.el-upload--picture-card),
.goods-form--create-wizard .main-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item) {
  width: var(--mobile-main-photo-size);
  height: var(--mobile-main-photo-size);
  border-radius: 14px;
}

.goods-form--create-wizard .additional-photo-upload :deep(.el-upload--picture-card) {
  width: 104px;
  height: 104px;
}

.goods-form--create-wizard .existing-photos,
.goods-form--create-wizard .new-photos {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.goods-form--create-wizard .photo-preview {
  height: 104px;
}

.goods-form--create-wizard .ocr-upload-trigger {
  min-height: 48px;
  padding: 12px 14px;
}

.goods-form--create-wizard .ocr-upload-trigger span {
  min-width: 0;
  line-height: 1.4;
  white-space: normal;
}

.goods-form--create-wizard .ocr-threshold-row {
  justify-content: space-between;
}

.goods-form--create-wizard .ocr-upload-hint {
  line-height: 1.5;
}

@media (max-width: 430px) {
  .goods-form--create-wizard .create-wizard-progress {
    gap: 4px;
    padding: 8px 6px;
  }

  .goods-form--create-wizard .create-wizard-progress__label {
    font-size: 10px;
  }

  .goods-form--create-wizard .form-section {
    padding: 16px 16px 20px;
  }
}

@media (max-width: 380px) {
  .goods-form--create-wizard {
    padding-right: 14px;
    padding-left: 14px;
  }

  .goods-form--create-wizard .create-wizard-progress__dot {
    width: 22px;
    height: 22px;
    font-size: 11px;
  }

  .goods-form--create-wizard .create-wizard-progress__item:not(:last-child)::after {
    top: 11px;
    left: calc(50% + 12px);
  }

  .goods-form--create-wizard .mobile-form-dock-btn {
    min-height: 46px;
    font-size: 13px;
  }
}

.ocr-upload-area { width: 100%; }
.ocr-threshold-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.ocr-threshold-label { font-size: 12px; color: #909399; white-space: nowrap; }
.ocr-uploader { width: 100%; }
.ocr-upload-trigger { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-radius: 12px; border: 1px dashed #d0d5dd; background: #fafbff; cursor: pointer; color: #606266; font-size: 14px; transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s; }
.ocr-upload-trigger:hover { border-color: var(--primary-gold); background: #fdfaf3; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
.ocr-upload-trigger.is-loading { border-color: var(--primary-gold); background: #fdfaf3; cursor: wait; }
.ocr-upload-trigger .is-loading { animation: rotating 1.2s linear infinite; }
@keyframes rotating { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.ocr-upload-hint { margin: 6px 0 0; font-size: 12px; color: #a8abb2; }

.classify-suggestions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  font-size: 13px;
}

.classify-suggestions__label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-right: 2px;
}

.classify-suggestion-tag {
  cursor: pointer;
}

.classify-confidence {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.classify-dismiss-btn {
  font-size: 12px;
  margin-left: 4px;
}
</style>
