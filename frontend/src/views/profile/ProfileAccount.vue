<template>
  <section class="account-page" aria-labelledby="account-title">
    <div class="account-heading">
      <div>
        <p class="section-eyebrow">ACCOUNT</p>
        <h2 id="account-title">账号信息</h2>
      </div>
      <el-icon class="account-mark" aria-hidden="true"><User /></el-icon>
    </div>

    <dl class="account-list">
      <div class="account-row"><dt>用户名</dt><dd>{{ authStore.user?.username || '—' }}</dd></div>
      <div class="account-row"><dt>账号类型</dt><dd>{{ accountTypeLabel }}</dd></div>
      <div class="account-row"><dt>系统角色</dt><dd>{{ roleLabel }}</dd></div>
      <div class="account-row"><dt>用户 ID</dt><dd>{{ authStore.user?.id || '—' }}</dd></div>
    </dl>

    <section v-if="canManageCredentials" class="credentials-section" data-test="account-management">
      <div class="credentials-heading">
        <div>
          <h3>{{ credentialsTitle }}</h3>
          <p>{{ credentialsDescription }}</p>
        </div>
        <el-icon aria-hidden="true"><Lock /></el-icon>
      </div>
      <el-form :model="accountForm" label-position="top" class="credentials-form">
        <div class="credentials-grid">
          <el-form-item label="登录用户名">
            <el-input v-model="accountForm.username" maxlength="150" autocomplete="username" />
          </el-form-item>
          <el-form-item label="当前密码">
            <el-input v-model="accountForm.current_password" type="password" show-password autocomplete="current-password" placeholder="验证当前密码" />
          </el-form-item>
          <el-form-item label="新密码">
            <el-input v-model="accountForm.new_password" type="password" show-password autocomplete="new-password" placeholder="不修改可留空" />
          </el-form-item>
          <el-form-item label="确认新密码">
            <el-input v-model="accountForm.confirm_password" type="password" show-password autocomplete="new-password" placeholder="再次输入新密码" />
          </el-form-item>
        </div>
        <div class="credentials-footer">
          <p>修改后，下次登录请使用新的用户名或密码。</p>
          <el-button type="primary" :loading="accountSaving" @click="updateAccount">
            <el-icon><Lock /></el-icon><span>更新登录信息</span>
          </el-button>
        </div>
      </el-form>
    </section>

    <div class="account-actions">
      <el-button v-if="authStore.isAdmin" type="primary" @click="goToAdmin">
        <el-icon><Key /></el-icon><span>进入管理后台</span>
      </el-button>
      <el-button :loading="refreshing" @click="refreshUser">
        <el-icon><Refresh /></el-icon><span>刷新信息</span>
      </el-button>
      <el-button type="danger" plain @click="logout">
        <el-icon><SwitchButton /></el-icon><span>退出登录</span>
      </el-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Key, Lock, Refresh, SwitchButton, User } from '@element-plus/icons-vue'
import { updateCurrentAccount } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const refreshing = ref(false)
const accountSaving = ref(false)
const accountForm = ref({
  username: authStore.user?.username || '',
  current_password: '',
  new_password: '',
  confirm_password: '',
})

const roleLabel = computed(() => authStore.isAdmin ? '管理员' : '普通用户')
const accountTypeLabel = computed(() => authStore.isClub ? '社团' : '吃谷人')
const canManageCredentials = computed(() => authStore.isCollector || authStore.isClub)
const credentialsTitle = computed(() => authStore.isClub ? '社团登录信息' : '登录信息')
const credentialsDescription = computed(() => authStore.isClub ? '修改社团帐号的登录用户名或设置新密码' : '修改登录用户名或设置新密码')

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
    ElMessage.success('登录信息已更新')
  } catch (error) {
    ElMessage.error(accountErrorMessage(error))
  } finally {
    accountSaving.value = false
  }
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
  padding: 24px;
  border: 1px solid var(--border-color);
  border-radius: var(--card-radius);
  background: var(--bg-white);
  box-shadow: var(--shadow-sm);
}

.account-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  padding-bottom: 18px;
  border-bottom: 1px solid var(--secondary-gray-dark);
}

.section-eyebrow {
  margin: 0 0 5px;
  color: var(--primary-gold-dark);
  font-size: var(--font-small);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.account-heading h2 { margin: 0; font-size: var(--font-title-lg); }
.account-heading p:last-child { margin: 7px 0 0; color: var(--text-light); font-size: var(--font-caption); }
.account-mark { color: var(--primary-gold); font-size: 28px; }
.account-list { margin: 20px 0 0; }
.account-row { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 16px; padding: 13px 0; border-bottom: 1px solid var(--secondary-gray-dark); }
.account-row dt { color: var(--text-light); font-size: var(--font-caption); }
.account-row dd { margin: 0; color: var(--text-dark); font-size: var(--font-body); word-break: break-word; }
.credentials-section { margin-top: 26px; padding-top: 24px; border-top: 1px solid rgba(212,175,55,.2); }
.credentials-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.credentials-heading h3 { margin: 0; color: var(--text-dark); font-size: var(--font-section); }
.credentials-heading p, .credentials-footer p { margin: 5px 0 0; color: var(--text-light); font-size: var(--font-small); line-height: 1.5; }
.credentials-heading > .el-icon { flex: none; color: var(--primary-gold); font-size: 22px; }
.credentials-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 20px; }
.credentials-form :deep(.el-form-item) { margin-bottom: 18px; }
.credentials-form :deep(.el-form-item__label) { color: var(--text-regular); font-size: var(--font-caption); font-weight: 600; }
.credentials-form :deep(.el-input__wrapper) { border-radius: var(--button-radius); }
.credentials-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.credentials-footer p { margin: 0; }
.credentials-footer :deep(.el-button) { flex: none; margin: 0; border-radius: var(--button-radius); }
.account-tip { display: flex; gap: 8px; align-items: flex-start; margin: 18px 0 0; color: var(--text-regular); font-size: var(--font-caption); line-height: 1.6; }
.account-tip .el-icon { flex: none; margin-top: 2px; color: var(--primary-gold-dark); }
.account-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.account-actions :deep(.el-button) { margin: 0; border-radius: var(--button-radius); }

@media (max-width: 480px) {
  .account-page { padding: 18px 16px; }
  .account-row { grid-template-columns: 1fr; gap: 4px; }
  .credentials-grid { grid-template-columns: 1fr; }
  .credentials-footer { align-items: stretch; flex-direction: column; }
  .credentials-footer :deep(.el-button) { width: 100%; }
  .account-actions { display: grid; grid-template-columns: 1fr; }
  .account-actions :deep(.el-button) { width: 100%; }
}
</style>
