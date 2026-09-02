<template>
  <div class="settings-container">
    <div class="header-section">
      <div class="title-wrapper">
        <h2 class="page-title">设置</h2>
        <span class="sub-title">把拾谷调成最顺手的样子吧~</span>
      </div>
    </div>

    <el-card class="settings-card" shadow="never">
      <template #header>
        <div class="card-header">
          <el-icon class="header-icon"><Setting /></el-icon>
          <span>后端服务配置</span>
        </div>
      </template>

      <el-form :model="formData" :rules="formRules" ref="formRef" label-position="top" class="settings-form">
        <el-form-item label="后端 API 地址" prop="apiBaseURL">
          <el-input
            v-model="formData.apiBaseURL"
            placeholder="请输入后端 API 地址，例如：http://127.0.0.1:8000"
            clearable
            class="api-input"
          >
            <template #prefix><el-icon><Link /></el-icon></template>
          </el-input>
          <div class="form-tip">
            <el-icon class="tip-icon"><InfoFilled /></el-icon>
            <span>所有 API 请求均使用此地址，修改后立即生效</span>
          </div>
        </el-form-item>

        <el-form-item>
          <div class="form-actions">
            <el-button @click="handleReset" :disabled="isDefault">恢复默认</el-button>
            <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
          </div>
        </el-form-item>
      </el-form>

      <el-divider />

      <div class="current-info">
        <div class="info-item">
          <span class="info-label">当前后端地址：</span>
          <span class="info-value">{{ currentBaseURL }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">默认后端地址：</span>
          <span class="info-value default-value">{{ defaultBaseURL }}</span>
        </div>
      </div>
    </el-card>

    <el-card v-if="authStore.isCollector" class="settings-card mobile-nav-settings-card" shadow="never">
      <template #header>
        <div class="card-header">
          <el-icon class="header-icon"><Menu /></el-icon>
          <span>底部导航设置</span>
        </div>
      </template>

      <div class="mobile-nav-settings">
        <div
          v-for="item in COLLECTOR_NAV_ITEMS"
          :key="item.key"
          class="mobile-nav-option"
          :class="{ 'is-selected': mobileNavStore.isSelected(item.key) }"
        >
          <el-checkbox
            :model-value="mobileNavStore.isSelected(item.key)"
            :disabled="mobileNavStore.isOnlySelected(item.key)"
            :aria-label="`${item.label}底部导航`"
            @change="toggleMobileNavItem(item.key, $event)"
          >
            <span class="mobile-nav-option-label">
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
            </span>
          </el-checkbox>
        </div>
        <el-button class="mobile-nav-reset" :disabled="isMobileNavDefault" @click="resetMobileNav">
          恢复默认
        </el-button>
      </div>
    </el-card>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Setting, Link, InfoFilled, Menu } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { updateBaseURL, getCurrentBaseURL, resetBaseURL } from '@/utils/request'
import { useMetadataStore } from '@/stores/metadata'
import { useAuthStore } from '@/stores/auth'
import {
  COLLECTOR_DEFAULT_NAV_KEYS,
  COLLECTOR_NAV_ITEMS,
  useMobileNavStore,
  type CollectorNavKey,
} from '@/stores/mobileNav'

const metadataStore = useMetadataStore()
const authStore = useAuthStore()
const mobileNavStore = useMobileNavStore()

const formRef = ref<FormInstance>()
const saving = ref(false)
const formData = ref({
  apiBaseURL: ''
})

// 获取默认地址（与 request.ts 中的逻辑保持一致）
const getDefaultBaseURL = (): string => {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000`
  }
  return 'http://127.0.0.1:8000'
}

const defaultBaseURL = ref(getDefaultBaseURL())
const currentBaseURL = ref('')

// URL 验证规则
const validateURL = (rule: any, value: string, callback: any) => {
  if (!value || value.trim() === '') {
    callback(new Error('后端地址不能为空'))
    return
  }

  try {
    const url = new URL(value.trim())
    // 只允许 http 和 https 协议
    if (!['http:', 'https:'].includes(url.protocol)) {
      callback(new Error('只支持 http:// 或 https:// 协议'))
      return
    }
    callback()
  } catch (error) {
    callback(new Error('请输入有效的 URL 地址，例如：http://127.0.0.1:8000'))
  }
}

const formRules: FormRules = {
  apiBaseURL: [
    { required: true, validator: validateURL, trigger: 'blur' }
  ]
}

const isDefault = computed(() => {
  return formData.value.apiBaseURL === defaultBaseURL.value || formData.value.apiBaseURL === ''
})

const isMobileNavDefault = computed(() => (
  mobileNavStore.selectedKeys.length === COLLECTOR_DEFAULT_NAV_KEYS.length &&
  COLLECTOR_DEFAULT_NAV_KEYS.every(key => mobileNavStore.selectedKeys.includes(key))
))

const loadCurrentSettings = () => {
  currentBaseURL.value = getCurrentBaseURL()
  formData.value.apiBaseURL = currentBaseURL.value
}

const handleSave = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    saving.value = true
    try {
      const url = formData.value.apiBaseURL.trim()
      updateBaseURL(url)
      currentBaseURL.value = url
      metadataStore.clearCache() // 清除元数据缓存
      ElMessage.success('后端地址已保存')
    } catch (error: any) {
      ElMessage.error(error.message || '保存失败')
    } finally {
      saving.value = false
    }
  })
}

const handleReset = () => {
  resetBaseURL()
  formData.value.apiBaseURL = defaultBaseURL.value
  currentBaseURL.value = defaultBaseURL.value
  metadataStore.clearCache() // 清除元数据缓存
  ElMessage.success('已恢复为默认地址')
}

const toggleMobileNavItem = (key: CollectorNavKey, checked: boolean | string | number) => {
  const next = checked
    ? [...mobileNavStore.selectedKeys, key]
    : mobileNavStore.selectedKeys.filter(item => item !== key)
  mobileNavStore.setSelectedKeys(next)
}

const resetMobileNav = () => {
  mobileNavStore.resetToDefault()
  ElMessage.success('底部导航已恢复默认')
}

onMounted(() => {
  loadCurrentSettings()
})
</script>

<style scoped>
.settings-container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
}

.header-section {
  margin-bottom: 20px;
}

.title-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.settings-card {
  border-radius: 12px;
  border: none;
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}

.header-icon {
  font-size: 18px;
  color: #8e7dff;
}

.settings-form {
  margin-top: 20px;
}

.api-input {
  width: 100%;
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.form-tip span {
  min-width: 0;
  white-space: nowrap;
}

.tip-icon {
  font-size: 14px;
  color: #409eff;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.current-info {
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #606266;
  min-width: 120px;
  font-weight: 500;
}

.info-value {
  color: #303133;
  font-family: monospace;
  word-break: break-all;
}

.info-value.default-value {
  color: #909399;
}

.mobile-nav-settings {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.mobile-nav-option {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fff;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.mobile-nav-option.is-selected {
  border-color: rgba(142, 125, 255, 0.45);
  background: rgba(142, 125, 255, 0.06);
}

.mobile-nav-option :deep(.el-checkbox) {
  width: 100%;
}

.mobile-nav-option-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #303133;
}

.mobile-nav-option-label .el-icon {
  color: #d4af37;
}

.mobile-nav-reset {
  width: fit-content;
}

@media (max-width: 768px) {
  .settings-container {
    padding: 16px;
  }

  .page-title {
    font-size: 20px;
  }

  .form-actions {
    display: flex;
    flex-direction: row;
    gap: 12px;
  }

  .form-actions :deep(.el-button) {
    flex: 1;
    margin: 0;
  }

  .mobile-nav-settings {
    grid-template-columns: 1fr;
  }

  .mobile-nav-reset {
    width: 100%;
  }

}

@media (max-width: 359px) {
  .form-tip span {
    white-space: normal;
  }
}
</style>
