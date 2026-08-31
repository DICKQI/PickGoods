<template>
  <section v-loading="loading" class="profile-page">
    <div class="section-title">
      <div>
        <p class="section-title__eyebrow">CLUB PROFILE</p>
        <h2>社团资料</h2>
        <p>公开资料会展示在社团主页，申请理由仅管理员可见。</p>
      </div>
      <el-button type="primary" :loading="saving" class="save-button" @click="save">
        <el-icon><Check /></el-icon>
        保存资料
      </el-button>
    </div>

    <el-form :model="form" label-position="top" class="profile-form">
      <div class="avatar-field">
        <el-avatar :size="96" :src="form.avatar || undefined" :alt="`${form.name || '社团'}头像`">
          {{ form.name.slice(0, 1) || '社' }}
        </el-avatar>
        <div class="avatar-field__copy">
          <strong>社团头像</strong>
          <span>建议上传清晰的方形图片，审批通过后即可更新。</span>
          <el-upload accept="image/*" :show-file-list="false" :before-upload="uploadAvatar" :disabled="avatarUploading">
            <el-button plain class="outline-button" :loading="avatarUploading" :disabled="avatarUploading">
              <el-icon><Upload /></el-icon>
              上传头像
            </el-button>
          </el-upload>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section__heading">
          <h3>基础资料</h3>
          <span>让访客快速了解你的社团</span>
        </div>
        <el-form-item label="社团名称">
          <el-input v-model="form.name" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="1000" show-word-limit />
        </el-form-item>
        <el-form-item label="公告">
          <el-input v-model="form.announcement" type="textarea" :rows="3" maxlength="1000" show-word-limit />
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="form-section__heading">
          <h3>联系信息</h3>
          <span>至少填写一种方便访客联系的方式</span>
        </div>
        <div class="contact-grid">
          <el-form-item label="联系人">
            <el-input v-model="form.contact_name" />
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input v-model="form.contact_phone" />
          </el-form-item>
          <el-form-item label="联系邮箱">
            <el-input v-model="form.contact_email" />
          </el-form-item>
          <el-form-item label="营业时间">
            <el-input v-model="form.business_hours" />
          </el-form-item>
        </div>
        <el-form-item label="地址">
          <el-input v-model="form.address" />
        </el-form-item>
      </div>

      <div class="form-section">
        <div class="form-section__heading">
          <h3>平台入口</h3>
          <span>填写后会在社团主页显示对应平台 logo</span>
        </div>
        <div class="platform-grid">
          <div v-for="platform in platforms" :key="platform.key" class="platform-card">
            <div class="platform-card__identity">
              <span class="platform-card__logo"><img :src="platform.logo" :alt="`${platform.label} logo`" /></span>
              <strong>{{ platform.label }}</strong>
            </div>
            <el-input
              v-model="form[platform.key]"
              clearable
              :placeholder="`https://${platform.host}/...`"
              :aria-label="`${platform.label}链接`"
            />
          </div>
        </div>
        <el-form-item label="其他入口（每行：标签 | URL）" class="other-links-field">
          <el-input
            v-model="storeLinksText"
            type="textarea"
            :rows="3"
            placeholder="例如：官方网店 | https://example.com"
          />
          <p class="field-help">旧版自定义链接会继续保留，不会自动归类到上述平台。</p>
        </el-form-item>
      </div>
    </el-form>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Upload } from '@element-plus/icons-vue'
import { getMyClub, updateMyClub, uploadMyClubAvatar } from '@/api/clubs'
import { useAuthStore } from '@/stores/auth'
import type { Club } from '@/api/types'

type PlatformKey = 'taobao_url' | 'xiaohongshu_url' | 'weidian_url'

const platforms: Array<{ key: PlatformKey; label: string; host: string; logo: string }> = [
  { key: 'taobao_url', label: '淘宝', host: 'shop.taobao.com', logo: '/brand/taobao.png' },
  { key: 'xiaohongshu_url', label: '小红书', host: 'xiaohongshu.com', logo: '/brand/xiaohongshu.png' },
  { key: 'weidian_url', label: '微店', host: 'weidian.com', logo: '/brand/weidian.png' },
]

const loading = ref(false)
const saving = ref(false)
const avatarUploading = ref(false)
const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const authStore = useAuthStore()
const form = reactive<Club>({
  id: 0,
  name: '',
  avatar: null,
  description: '',
  announcement: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  taobao_url: null,
  xiaohongshu_url: null,
  weidian_url: null,
  store_links: [],
  address: '',
  business_hours: '',
  goods_count: 0,
  created_at: '',
  updated_at: '',
})
const storeLinksText = ref('')

function hydrate(data: Club) {
  Object.assign(form, data)
  storeLinksText.value = (data.store_links || []).map(item => `${item.label} | ${item.url}`).join('\n')
}

function syncWorkspaceClub(data: Club) {
  if (!authStore.user) return
  authStore.user = {
    ...authStore.user,
    club: {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
    },
  }
}

function parseStoreLinks() {
  return storeLinksText.value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [label, ...url] = line.split('|')
      return { label: label?.trim() || '其他入口', url: url.join('|').trim() || label?.trim() || '' }
    })
    .filter(item => item.url)
}

async function load() {
  loading.value = true
  try {
    hydrate(await getMyClub())
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.error('请输入社团名称')
    return
  }
  if (form.contact_email && !/^\S+@\S+\.\S+$/.test(form.contact_email.trim())) {
    ElMessage.error('请输入有效的联系邮箱')
    return
  }
  saving.value = true
  try {
    const updated = await updateMyClub({
      name: form.name,
      description: form.description,
      announcement: form.announcement,
      contact_name: form.contact_name,
      contact_phone: form.contact_phone,
      contact_email: form.contact_email,
      taobao_url: form.taobao_url?.trim() || null,
      xiaohongshu_url: form.xiaohongshu_url?.trim() || null,
      weidian_url: form.weidian_url?.trim() || null,
      store_links: parseStoreLinks(),
      address: form.address,
      business_hours: form.business_hours,
    })
    hydrate(updated)
    syncWorkspaceClub(updated)
    ElMessage.success('社团资料已保存')
  } finally {
    saving.value = false
  }
}

async function uploadAvatar(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return false
  }
  if (file.size > MAX_AVATAR_SIZE) {
    ElMessage.error('头像文件不能超过 5MB')
    return false
  }
  avatarUploading.value = true
  try {
    const updated = await uploadMyClubAvatar(file)
    hydrate(updated)
    syncWorkspaceClub(updated)
    ElMessage.success('头像已更新')
  } catch {
    // request interceptor already shows the failure message
  } finally {
    avatarUploading.value = false
  }
  return false
}

onMounted(load)
</script>

<style scoped>
.profile-page {
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--border-color);
  border-radius: var(--card-radius);
  background: var(--bg-white);
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.16);
}

.section-title__eyebrow,
.form-section__heading span,
.field-help {
  color: var(--text-light);
  font-size: var(--font-small);
}

.section-title__eyebrow {
  margin: 0 0 6px;
  color: var(--primary-gold-dark);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.section-title h2 {
  margin: 0;
  color: var(--text-dark);
  font-size: var(--font-title-lg);
}

.section-title p:last-child {
  margin: 7px 0 0;
  color: var(--text-light);
  font-size: var(--font-caption);
}

.save-button,
.outline-button {
  border-radius: var(--button-radius);
}

.profile-form {
  max-width: 960px;
}

.avatar-field {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 30px;
}

.avatar-field :deep(.el-avatar) {
  flex: none;
  border: 2px solid var(--primary-gold-light);
  background: var(--secondary-gray);
  color: var(--accent-purple-dark);
  box-shadow: 0 0 0 4px rgba(234, 205, 163, 0.18);
}

.avatar-field__copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.avatar-field__copy strong {
  color: var(--text-dark);
  font-size: var(--font-body);
}

.avatar-field__copy span {
  color: var(--text-light);
  font-size: var(--font-caption);
  line-height: 1.45;
}

.avatar-field__copy .el-upload {
  margin-top: 5px;
}

.form-section + .form-section {
  margin-top: 30px;
  padding-top: 26px;
  border-top: 1px solid rgba(212, 175, 55, 0.14);
}

.form-section__heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 16px;
}

.form-section__heading h3 {
  margin: 0;
  color: var(--text-dark);
  font-size: var(--font-section);
}

.form-section__heading span {
  line-height: 1.4;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--space-lg);
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.platform-card {
  display: grid;
  min-width: 0;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: var(--card-radius-sm);
  background: rgba(255, 252, 244, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.platform-card__identity {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.platform-card__identity strong {
  overflow: hidden;
  color: var(--text-dark);
  font-size: var(--font-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-card__logo {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bg-white);
}

.platform-card__logo img {
  display: block;
  width: 100%;
  height: 100%;
}

.other-links-field {
  margin-bottom: 0;
}

.field-help {
  margin: 6px 0 0;
  line-height: 1.4;
}

:deep(.el-form-item__label) {
  color: var(--text-regular);
  font-size: var(--font-caption);
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner) {
  border-radius: var(--button-radius);
}

:deep(.el-textarea__inner) {
  resize: vertical;
  min-height: 84px;
}

@media (max-width: 900px) {
  .platform-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .profile-page {
    padding: 18px 16px calc(32px + env(safe-area-inset-bottom));
  }

  .section-title {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
  }

  .save-button {
    align-self: flex-start;
  }

  .contact-grid,
  .platform-grid {
    grid-template-columns: 1fr;
  }

  .avatar-field {
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .platform-card,
  .save-button,
  .outline-button {
    transition: none;
  }
}
</style>
