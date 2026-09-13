<template>
  <section class="account-page" aria-labelledby="account-title">
    <aside class="account-summary" data-test="account-summary">
      <div class="summary-toolbar">
        <button
          v-if="canEditAvatar"
          type="button"
          class="avatar-edit-trigger"
          aria-label="修改头像"
          data-test="avatar-edit-trigger"
          @click="avatarEditorVisible = true"
        >
          <el-avatar :size="72" :src="summaryAvatar || undefined" class="summary-avatar">
            <span v-if="avatarInitial">{{ avatarInitial }}</span>
            <el-icon v-else><User /></el-icon>
          </el-avatar>
          <span class="avatar-camera-badge" aria-hidden="true">
            <el-icon><CameraFilled /></el-icon>
          </span>
        </button>
        <el-avatar v-else :size="72" :src="summaryAvatar || undefined" class="summary-avatar">
          <span v-if="avatarInitial">{{ avatarInitial }}</span>
          <el-icon v-else><User /></el-icon>
        </el-avatar>
        <el-button
          text
          circle
          class="refresh-button"
          :loading="refreshing"
          aria-label="刷新账号信息"
          data-test="refresh-account"
          @click="refreshUser"
        >
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>

      <div class="summary-copy">
        <h2 id="account-title">{{ displayName }}</h2>
        <p v-if="clubName">@{{ authStore.user?.username }}</p>
        <p v-else>@{{ authStore.user?.username || '未登录' }}</p>
      </div>

      <div class="identity-tags">
        <span>{{ accountTypeLabel }}</span>
        <span>{{ roleLabel }}</span>
      </div>

      <dl class="identity-meta">
        <div>
          <dt>用户 ID</dt>
          <dd>{{ authStore.user?.id || '—' }}</dd>
        </div>
      </dl>
    </aside>

    <div class="account-content">
      <section v-if="canManageCredentials" class="account-section account-section--actions" data-test="account-management">
        <header class="section-header">
          <span class="section-icon" aria-hidden="true"><Lock /></span>
          <div>
            <h3>账号与安全</h3>
          </div>
        </header>
        <div class="action-list">
          <button
            type="button"
            class="action-row"
            data-test="account-edit-trigger"
            @click="openAccountEditor"
          >
            <span class="action-icon" aria-hidden="true"><Lock /></span>
            <span class="action-copy">
              <strong>{{ credentialsTitle }}</strong>
              <span>{{ credentialsDescription }}</span>
            </span>
            <span class="action-value">{{ authStore.user?.username || '—' }}</span>
            <el-icon class="action-arrow" aria-hidden="true"><ArrowRight /></el-icon>
          </button>
        </div>
      </section>

      <section class="account-section account-section--actions" aria-labelledby="account-management-title">
        <header class="section-header">
          <span class="section-icon" aria-hidden="true"><Key /></span>
          <div>
            <h3 id="account-management-title">管理与操作</h3>
          </div>
        </header>
        <div class="action-list">
          <button
            v-if="authStore.isAdmin"
            type="button"
            class="action-row"
            data-test="admin-entry"
            @click="goToAdmin"
          >
            <span class="action-icon" aria-hidden="true"><Key /></span>
            <span class="action-copy">
              <strong>进入管理后台</strong>
              <span>管理用户、内容和系统配置</span>
            </span>
            <el-icon class="action-arrow" aria-hidden="true"><ArrowRight /></el-icon>
          </button>

          <button
            type="button"
            class="action-row action-row--danger"
            data-test="logout-account"
            @click="logout"
          >
            <span class="action-icon" aria-hidden="true"><SwitchButton /></span>
            <span class="action-copy">
              <strong>退出登录</strong>
              <span>退出当前设备上的账号</span>
            </span>
            <el-icon class="action-arrow" aria-hidden="true"><ArrowRight /></el-icon>
          </button>
        </div>
      </section>
    </div>

    <el-drawer
      v-model="accountEditorVisible"
      :direction="drawerDirection"
      :size="drawerSize"
      :with-header="false"
      :show-close="false"
      :lock-scroll="!isMobile"
      :close-on-click-modal="false"
      append-to-body
      class="account-editor-drawer"
      @closed="resetAccountEditor"
    >
      <section class="account-editor" aria-labelledby="account-editor-title">
        <header class="editor-header">
          <div>
            <p>ACCOUNT SECURITY</p>
            <h2 id="account-editor-title">{{ credentialsTitle }}</h2>
            <span>{{ credentialsDescription }}</span>
          </div>
          <el-button text circle aria-label="关闭登录信息编辑" @click="closeAccountEditor">
            <el-icon><Close /></el-icon>
          </el-button>
        </header>

        <div class="editor-body">
          <el-form :model="accountForm" label-position="top" class="credentials-form" @submit.prevent="updateAccount">
            <el-form-item label="登录用户名">
              <el-input v-model="accountForm.username" maxlength="150" autocomplete="username" />
            </el-form-item>
            <el-form-item label="当前密码">
              <el-input
                v-model="accountForm.current_password"
                type="password"
                show-password
                autocomplete="current-password"
                placeholder="验证当前密码"
              />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input
                v-model="accountForm.new_password"
                type="password"
                show-password
                autocomplete="new-password"
                placeholder="不修改可留空"
              />
            </el-form-item>
            <el-form-item label="确认新密码">
              <el-input
                v-model="accountForm.confirm_password"
                type="password"
                show-password
                autocomplete="new-password"
                placeholder="再次输入新密码"
              />
            </el-form-item>
            <p class="editor-tip">修改后，下次登录请使用新的用户名或密码。</p>
          </el-form>
        </div>

        <footer class="editor-footer">
          <el-button @click="closeAccountEditor">取消</el-button>
          <el-button type="primary" :loading="accountSaving" @click="updateAccount">保存修改</el-button>
        </footer>
      </section>
    </el-drawer>

    <AvatarEditorDialog
      v-if="canEditAvatar"
      v-model="avatarEditorVisible"
      :current-avatar="userAvatar"
      :fallback-text="avatarInitial"
      :uploading="avatarUploading"
      :removing="avatarRemoving"
      @confirm="updateAvatar"
      @remove="removeAvatar"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowRight, CameraFilled, Close, Key, Lock, Refresh, SwitchButton, User } from '@element-plus/icons-vue'
import {
  removeCurrentUserAvatar,
  updateCurrentAccount,
  uploadCurrentUserAvatar,
} from '@/api/auth'
import AvatarEditorDialog from '@/components/profile/AvatarEditorDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'

const router = useRouter()
const authStore = useAuthStore()
const { isMobile } = useResponsiveDevice()
const refreshing = ref(false)
const accountSaving = ref(false)
const accountEditorVisible = ref(false)
const avatarEditorVisible = ref(false)
const avatarUploading = ref(false)
const avatarRemoving = ref(false)
const accountForm = ref({
  username: authStore.user?.username || '',
  current_password: '',
  new_password: '',
  confirm_password: '',
})

const roleLabel = computed(() => authStore.isAdmin ? '管理员' : '普通用户')
const accountTypeLabel = computed(() => authStore.isClub ? '社团' : '吃谷人')
const canManageCredentials = computed(() => authStore.isCollector || authStore.isClub)
const canEditAvatar = computed(() => authStore.isCollector)
const credentialsTitle = computed(() => authStore.isClub ? '社团登录信息' : '登录信息')
const credentialsDescription = computed(() => authStore.isClub ? '修改社团帐号的登录用户名或设置新密码' : '修改登录用户名或设置新密码')
const clubName = computed(() => authStore.isClub ? authStore.user?.club?.name?.trim() || '' : '')
const clubAvatar = computed(() => authStore.isClub ? authStore.user?.club?.avatar || '' : '')
const userAvatar = computed(() => authStore.user?.avatar || '')
const summaryAvatar = computed(() => authStore.isClub ? clubAvatar.value : userAvatar.value)
const displayName = computed(() => clubName.value || authStore.user?.username || '当前账号')
const avatarInitial = computed(() => displayName.value.trim().slice(0, 1).toUpperCase())
const drawerDirection = computed<'rtl' | 'btt'>(() => isMobile.value ? 'btt' : 'rtl')
const drawerSize = computed(() => isMobile.value ? '88dvh' : '480px')

function accountErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data) return '登录信息更新失败，请稍后重试'
  for (const key of ['username', 'current_password', 'new_password', 'non_field_errors', 'detail']) {
    const value = data[key]
    if (typeof value === 'string' && value) return value
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  }
  return '登录信息更新失败，请检查输入后重试'
}

function avatarErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data) return '头像更新失败，请稍后重试'
  for (const key of ['avatar', 'detail', 'non_field_errors']) {
    const value = data[key]
    if (typeof value === 'string' && value) return value
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  }
  return '头像更新失败，请检查图片后重试'
}

async function updateAccount() {
  const username = accountForm.value.username.trim()
  if (!username) return ElMessage.error('请输入登录用户名')
  if (!accountForm.value.current_password) return ElMessage.error('请输入当前密码')
  if (accountForm.value.new_password && accountForm.value.new_password.length < 6) return ElMessage.error('新密码不能少于 6 个字符')
  if (accountForm.value.new_password !== accountForm.value.confirm_password) return ElMessage.error('两次输入的新密码不一致')
  if (username === authStore.user?.username && !accountForm.value.new_password) return ElMessage.error('没有需要更新的登录信息')

  accountSaving.value = true
  try {
    const updated = await updateCurrentAccount({
      username,
      current_password: accountForm.value.current_password,
      ...(accountForm.value.new_password ? { new_password: accountForm.value.new_password } : {}),
    })
    authStore.user = updated
    accountForm.value.username = updated.username
    accountForm.value.current_password = ''
    accountForm.value.new_password = ''
    accountForm.value.confirm_password = ''
    accountEditorVisible.value = false
    ElMessage.success('登录信息已更新')
  } catch (error) {
    ElMessage.error(accountErrorMessage(error))
  } finally {
    accountSaving.value = false
  }
}

async function updateAvatar(file: File) {
  avatarUploading.value = true
  try {
    authStore.user = await uploadCurrentUserAvatar(file)
    avatarEditorVisible.value = false
    ElMessage.success('头像已更新')
  } catch (error) {
    // Keep the crop dialog open so the user can retry.
    ElMessage.error(avatarErrorMessage(error))
  } finally {
    avatarUploading.value = false
  }
}

async function removeAvatar() {
  try {
    await ElMessageBox.confirm('确定要恢复为默认首字母头像吗？', '恢复默认头像', {
      confirmButtonText: '恢复默认',
      cancelButtonText: '取消',
      type: 'warning',
      lockScroll: true,
    })
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') console.error(error)
    return
  }
  avatarRemoving.value = true
  try {
    authStore.user = await removeCurrentUserAvatar()
    avatarEditorVisible.value = false
    ElMessage.success('已恢复默认头像')
  } catch (error) {
    // Keep the editor open so the user can retry.
    ElMessage.error(avatarErrorMessage(error))
  } finally {
    avatarRemoving.value = false
  }
}

function openAccountEditor() {
  accountForm.value.username = authStore.user?.username || ''
  accountForm.value.current_password = ''
  accountForm.value.new_password = ''
  accountForm.value.confirm_password = ''
  accountEditorVisible.value = true
}

function closeAccountEditor() {
  accountEditorVisible.value = false
}

function resetAccountEditor() {
  accountForm.value.username = authStore.user?.username || ''
  accountForm.value.current_password = ''
  accountForm.value.new_password = ''
  accountForm.value.confirm_password = ''
}

async function refreshUser() {
  refreshing.value = true
  try {
    if (await authStore.fetchCurrentUser()) {
      accountForm.value.username = authStore.user?.username || ''
      ElMessage.success('已刷新')
    }
    else ElMessage.error('刷新失败，请检查网络后重试')
  } finally {
    refreshing.value = false
  }
}

function goToAdmin() {
  void router.push('/admin')
}

async function logout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning', lockScroll: true,
    })
    await authStore.logout()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') console.error(error)
  }
}
</script>

<style scoped>
.account-page {
  display: grid;
  grid-template-columns: minmax(240px, 292px) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
}

.account-summary,
.account-section {
  border: 1px solid rgba(44, 39, 30, 0.08);
  background: var(--bg-white);
  box-shadow: 0 8px 24px rgba(45, 38, 24, 0.045);
}

.account-summary {
  position: sticky;
  top: 84px;
  padding: 22px;
  border-radius: 18px;
}

.summary-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.summary-avatar {
  flex: none;
  color: #fff;
  font-size: 27px;
  font-weight: 700;
  background:
    radial-gradient(circle at 28% 20%, rgba(255, 255, 255, 0.42), transparent 34%),
    linear-gradient(135deg, var(--primary-gold), var(--accent-purple));
  box-shadow: 0 10px 24px rgba(184, 148, 31, 0.22);
}

.avatar-edit-trigger {
  position: relative;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.avatar-edit-trigger .summary-avatar {
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.avatar-edit-trigger:hover .summary-avatar,
.avatar-edit-trigger:focus-visible .summary-avatar {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(142, 125, 255, 0.28);
}

.avatar-edit-trigger:focus-visible {
  outline: 2px solid var(--accent-purple);
  outline-offset: 3px;
}

.avatar-camera-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 2px solid var(--bg-white);
  border-radius: 50%;
  color: #fff;
  background: var(--accent-purple-dark);
  font-size: 12px;
  box-shadow: 0 4px 10px rgba(116, 95, 230, 0.24);
}

.summary-avatar :deep(img) {
  object-fit: cover;
}

.refresh-button {
  min-width: 40px;
  min-height: 40px;
  color: var(--text-light);
}

.refresh-button:hover,
.refresh-button:focus-visible {
  color: var(--accent-purple-dark);
  background: var(--accent-purple-soft);
}

.summary-copy {
  margin-top: 18px;
  min-width: 0;
}

.summary-copy h2 {
  margin: 0;
  color: var(--text-dark);
  font-size: 22px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.summary-copy p {
  margin: 5px 0 0;
  color: var(--text-light);
  font-size: var(--font-caption);
  overflow-wrap: anywhere;
}

.identity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 14px;
}

.identity-tags span {
  padding: 4px 9px;
  border: 1px solid rgba(162, 155, 254, 0.22);
  border-radius: 999px;
  color: var(--accent-purple-dark);
  background: var(--accent-purple-soft);
  font-size: var(--font-small);
  line-height: 1.3;
}

.identity-tags span:first-child {
  border-color: rgba(212, 175, 55, 0.24);
  color: var(--primary-gold-dark);
  background: rgba(212, 175, 55, 0.08);
}

.identity-meta {
  margin: 18px 0 0;
  padding-top: 15px;
  border-top: 1px solid var(--secondary-gray-dark);
}

.identity-meta div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.identity-meta dt {
  color: var(--text-light);
  font-size: var(--font-small);
}

.identity-meta dd {
  margin: 0;
  color: var(--text-regular);
  font-size: var(--font-caption);
  font-variant-numeric: tabular-nums;
}

.account-content {
  display: grid;
  min-width: 0;
  gap: 14px;
}

.account-section {
  overflow: hidden;
  border-radius: 16px;
}

.account-section--actions {
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.account-section--actions .section-header {
  gap: 8px;
  padding: 0 4px 9px;
  border-bottom: 0;
}

.account-section--actions .section-icon {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  color: var(--primary-gold-dark);
  background: rgba(212, 175, 55, 0.1);
  font-size: 14px;
}

.account-section--actions .section-header h3 {
  color: var(--text-regular);
  font-size: var(--font-caption);
  font-weight: 700;
}

.account-section--actions .action-list {
  border: 1px solid rgba(44, 39, 30, 0.08);
  border-radius: 16px;
  background: var(--bg-white);
  box-shadow: 0 8px 24px rgba(45, 38, 24, 0.045);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid rgba(44, 39, 30, 0.065);
}

.section-icon,
.action-icon {
  display: grid;
  flex: none;
  place-items: center;
  color: var(--accent-purple-dark);
  background: var(--accent-purple-soft);
}

.section-icon {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  font-size: 17px;
}

.section-header h3 {
  margin: 0;
  color: var(--text-dark);
  font-size: var(--font-section);
}

.section-header p {
  margin: 3px 0 0;
  color: var(--text-light);
  font-size: var(--font-small);
}

.action-list {
  padding: 6px 8px 8px;
}

.action-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto 18px;
  align-items: center;
  width: 100%;
  min-height: 64px;
  gap: 12px;
  padding: 9px 10px;
  border: 0;
  border-radius: 12px;
  color: var(--text-dark);
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.action-row:hover {
  background: #fafafa;
}

.action-row:focus-visible {
  outline: 2px solid var(--accent-purple);
  outline-offset: -2px;
}

.action-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  font-size: 17px;
}

.action-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.action-copy strong {
  color: inherit;
  font-size: var(--font-body);
  font-weight: 600;
}

.action-copy span {
  color: var(--text-light);
  font-size: var(--font-small);
  line-height: 1.35;
}

.action-value {
  max-width: 160px;
  overflow: hidden;
  color: var(--text-light);
  font-size: var(--font-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-arrow {
  color: var(--text-lighter);
  font-size: 16px;
}

.action-row--danger {
  color: var(--el-color-danger);
}

.action-row--danger .action-icon {
  color: var(--el-color-danger);
  background: rgba(245, 108, 108, 0.08);
}

.action-row--danger:hover {
  background: rgba(245, 108, 108, 0.055);
}

:global(.account-editor-drawer) {
  overflow: hidden;
}

:global(.account-editor-drawer .el-drawer__body) {
  padding: 0;
  overflow: hidden;
}

.account-editor {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--bg-white);
}

.editor-header {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 18px;
  border-bottom: 1px solid rgba(44, 39, 30, 0.07);
}

.editor-header p {
  margin: 0 0 5px;
  color: var(--primary-gold-dark);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.editor-header h2 {
  margin: 0;
  color: var(--text-dark);
  font-size: 21px;
}

.editor-header span {
  display: block;
  margin-top: 6px;
  color: var(--text-light);
  font-size: var(--font-small);
  line-height: 1.5;
}

.editor-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 20px 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.credentials-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.credentials-form :deep(.el-form-item__label) {
  color: var(--text-regular);
  font-size: var(--font-caption);
  font-weight: 600;
}

.credentials-form :deep(.el-input__wrapper) {
  min-height: 42px;
  border-radius: 10px;
}

.editor-tip {
  margin: 2px 0 0;
  color: var(--text-light);
  font-size: var(--font-small);
  line-height: 1.6;
}

.editor-footer {
  display: flex;
  flex: none;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(44, 39, 30, 0.07);
  background: rgba(255, 255, 255, 0.96);
}

.editor-footer :deep(.el-button) {
  min-width: 104px;
  margin: 0;
  border-radius: 10px;
}

@media (max-width: 768px) {
  .account-page {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .account-summary {
    position: static;
    display: grid;
    grid-template-areas:
      "avatar copy refresh"
      "tags tags tags"
      "meta meta meta";
    grid-template-columns: 64px minmax(0, 1fr) 40px;
    align-items: start;
    gap: 0 12px;
    padding: 18px;
    border-radius: 16px;
  }

  .summary-toolbar {
    display: contents;
  }

  .summary-avatar {
    grid-area: avatar;
    width: 64px;
    height: 64px;
    font-size: 24px;
  }

  .avatar-edit-trigger {
    grid-area: avatar;
    justify-self: start;
  }

  .avatar-camera-badge {
    width: 22px;
    height: 22px;
    font-size: 11px;
  }

  .refresh-button {
    grid-area: refresh;
    justify-self: end;
  }

  .summary-copy {
    grid-area: copy;
    align-self: center;
    margin-top: 0;
  }

  .summary-copy h2 {
    font-size: 20px;
  }

  .identity-tags {
    grid-area: tags;
    margin-top: 14px;
  }

  .identity-meta {
    grid-area: meta;
    margin-top: 15px;
  }

  .account-content {
    gap: 12px;
  }

  .account-section {
    border-radius: 14px;
  }

  .section-header {
    padding: 14px;
  }

  .section-icon {
    width: 32px;
    height: 32px;
  }

  .action-list {
    padding: 6px;
  }

  .action-row {
    grid-template-columns: 36px minmax(0, 1fr) 18px;
    gap: 10px;
  }

  .action-value {
    display: none;
  }

  :global(.account-editor-drawer) {
    border-radius: 20px 20px 0 0;
  }

  .editor-header {
    padding: 20px 18px 16px;
  }

  .editor-body {
    padding: 18px;
  }

  .editor-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
  }

  .editor-footer :deep(.el-button) {
    width: 100%;
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-row {
    transition: none;
  }
}
</style>
