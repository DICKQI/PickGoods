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
import { Key, Refresh, SwitchButton, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const refreshing = ref(false)

const roleLabel = computed(() => authStore.isAdmin ? '管理员' : '普通用户')
const accountTypeLabel = computed(() => authStore.isClub ? '社团' : '吃谷人')
async function refreshUser() {
  refreshing.value = true
  try {
    if (await authStore.fetchCurrentUser()) ElMessage.success('已刷新')
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
.account-tip { display: flex; gap: 8px; align-items: flex-start; margin: 18px 0 0; color: var(--text-regular); font-size: var(--font-caption); line-height: 1.6; }
.account-tip .el-icon { flex: none; margin-top: 2px; color: var(--primary-gold-dark); }
.account-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.account-actions :deep(.el-button) { margin: 0; border-radius: var(--button-radius); }

@media (max-width: 480px) {
  .account-page { padding: 18px 16px; }
  .account-row { grid-template-columns: 1fr; gap: 4px; }
  .account-actions { display: grid; grid-template-columns: 1fr; }
  .account-actions :deep(.el-button) { width: 100%; }
}
</style>
