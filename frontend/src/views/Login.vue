<template>
  <div class="login-container">
    <!-- Decorative background shapes (Laser & Gold) -->
    <div class="bg-shape shape-1"></div>
    <div class="bg-shape shape-2"></div>

    <div ref="cardWrapperRef" class="login-card-wrapper">
      <el-card :class="['login-card', cardStateClass, { 'is-resizing': cardResizing }]" :style="cardStyle" :body-style="{ padding: '0' }">
        <div class="login-content">
          <div class="card-header">
            <div class="logo-container">
              <div class="logo-icon">PG</div>
            </div>
            <h2 class="login-title">拾谷 PickGoods</h2>
            <p class="login-subtitle">欢迎回到拾谷</p>
          </div>

          <div class="auth-workspace">
            <!-- Custom Tabs Header -->
            <div class="custom-tabs">
              <div
                class="tab-item"
                :class="{ active: mode === 'login' }"
                @click="switchMode('login')"
              >
                登录
              </div>
              <div
                class="tab-item"
                :class="{ active: mode === 'register' }"
                @click="switchMode('register')"
              >
                注册
              </div>
              <!-- Animated Bottom Bar -->
              <div class="tab-bar" :style="tabBarStyle"></div>
            </div>

            <transition name="auth-panel" mode="out-in" @after-enter="handlePanelAfterEnter">
              <!-- Registration starts with an identity choice. The actual form is shown only after a choice. -->
              <section v-if="mode === 'register' && !formData.accountType" key="identity" class="identity-step" aria-labelledby="identity-step-title">
                <div class="identity-step__heading">
                  <span class="form-kicker">注册第一步</span>
                  <h3 id="identity-step-title">你是什么身份？</h3>
                  <p>选好身份后，就为你准备对应的注册表单啦~</p>
                </div>
                <el-radio-group v-model="formData.accountType" class="identity-options" aria-label="选择账号身份">
                  <el-radio-button value="collector" class="identity-option">
                    <span class="identity-option__icon"><el-icon><User /></el-icon></span>
                    <span class="identity-option__copy"><strong>吃谷人</strong><small>把喜欢的谷子好好收藏起来吧~</small></span>
                  </el-radio-button>
                  <el-radio-button value="club" class="identity-option">
                    <span class="identity-option__icon"><el-icon><Shop /></el-icon></span>
                    <span class="identity-option__copy"><strong>社团</strong><small>申请开通后，就能发布社团谷子啦~</small></span>
                  </el-radio-button>
                </el-radio-group>
              </section>

              <!-- Login form and the selected registration form share validation/submission logic. -->
              <el-form
                v-else
                :key="`form-${mode}-${formData.accountType || 'none'}`"
                ref="formRef"
                :model="formData"
                :rules="currentRules"
                label-position="top"
                :class="['login-form', { 'login-form--club': mode === 'register' && formData.accountType === 'club' }]"
                @submit.prevent="handleSubmit"
                size="large"
                hide-required-asterisk
              >
                <div v-if="mode === 'register'" class="selected-identity">
                  <div>
                    <span class="form-kicker">注册身份</span>
                    <strong>{{ formData.accountType === 'club' ? '社团' : '吃谷人' }}</strong>
                  </div>
                  <el-button text type="primary" class="change-identity-btn" @click="changeIdentity">重新选择</el-button>
                </div>

                <template v-if="mode === 'register' && formData.accountType === 'club'">
                  <div class="register-sections">
                    <section class="register-form-section">
                      <div class="register-form-section__heading">
                        <span class="form-kicker">基础信息</span>
                        <p>这是进入社团工作区的通行证哦~</p>
                      </div>
                      <el-form-item label="登录用户名" prop="username">
                        <el-input v-model="formData.username" placeholder="请输入用户名" clearable :prefix-icon="User" maxlength="150" />
                      </el-form-item>
                      <div class="register-field-grid">
                        <el-form-item label="登录密码" prop="password">
                          <el-input v-model="formData.password" type="password" placeholder="至少 6 位" show-password clearable :prefix-icon="Lock" />
                        </el-form-item>
                        <el-form-item label="确认密码" prop="confirmPassword">
                          <el-input v-model="formData.confirmPassword" type="password" placeholder="再次输入密码" show-password clearable :prefix-icon="Lock" @keyup.enter="handleSubmit" />
                        </el-form-item>
                      </div>
                    </section>

                    <section class="register-form-section register-form-section--application">
                      <div class="register-form-section__heading">
                        <span class="form-kicker">社团申请</span>
                        <p>管理员审批通过后，就能发布社团谷子啦~</p>
                      </div>
                      <el-form-item label="社团名称" prop="clubName">
                        <el-input v-model="formData.clubName" placeholder="请输入社团名称" maxlength="200" show-word-limit />
                      </el-form-item>
                      <el-form-item label="申请理由" prop="applicationReason">
                        <el-input v-model="formData.applicationReason" type="textarea" :rows="4" placeholder="请介绍社团以及申请入驻的理由" maxlength="1000" show-word-limit />
                      </el-form-item>
                    </section>
                  </div>
                </template>

                <template v-else>
                  <el-form-item prop="username">
                    <el-input v-model="formData.username" placeholder="用户名" clearable :prefix-icon="User" maxlength="150" />
                  </el-form-item>
                  <el-form-item prop="password">
                    <el-input v-model="formData.password" type="password" :placeholder="mode === 'register' ? '密码（至少 6 位）' : '密码'" show-password clearable :prefix-icon="Lock" @keyup.enter="handleEnterKey" />
                  </el-form-item>
                  <el-form-item v-if="mode === 'register'" prop="confirmPassword" class="confirm-password-item">
                    <el-input v-model="formData.confirmPassword" type="password" placeholder="确认密码" show-password clearable :prefix-icon="Lock" @keyup.enter="handleSubmit" />
                  </el-form-item>
                </template>

                <el-form-item
                  v-if="mode === 'register' && captchaEnabled !== false"
                  label="图形验证码"
                  prop="captchaCode"
                  class="captcha-form-item"
                >
                  <div class="captcha-control">
                    <button
                      type="button"
                      class="captcha-image-shell"
                      :disabled="captchaLoading"
                      aria-label="点击更换验证码"
                      title="点击更换验证码"
                      @click="loadCaptcha"
                    >
                      <img v-if="captchaImageUrl" :src="captchaImageUrl" alt="图形验证码" class="captcha-image" />
                      <span v-else class="captcha-image-placeholder">{{ captchaLoading ? '加载中' : '暂不可用' }}</span>
                    </button>
                    <el-input
                      v-model="formData.captchaCode"
                      placeholder="输入图片中的字符"
                      maxlength="32"
                      clearable
                      :disabled="captchaLoading || !captchaKey"
                      @keyup.enter="handleSubmit"
                    />
                  </div>
                  <p v-if="captchaLoadError" class="captcha-load-error">{{ captchaLoadError }}</p>
                </el-form-item>

                <div class="form-actions">
                  <el-button
                    type="primary"
                    class="submit-btn"
                    :loading="authStore.loading"
                    :disabled="registerCaptchaUnavailable"
                    @click="handleSubmit"
                    round
                  >
                    <span class="btn-text">{{ mode === 'login' ? '登 录' : (formData.accountType === 'club' ? '提交社团申请' : '注册并自动登录') }}</span>
                  </el-button>
                </div>
              </el-form>
            </transition>

            <transition name="fade">
              <el-alert
                v-if="errorMessage"
                :title="errorMessage"
                type="error"
                show-icon
                closable
                class="error-alert"
              />
            </transition>
            <transition name="fade">
              <el-alert
                v-if="infoMessage"
                :title="infoMessage"
                type="success"
                show-icon
                closable
                class="error-alert"
              />
            </transition>

            <div class="footer-links">
              <router-link to="/settings" class="link">
                <el-icon class="link-icon"><Tools /></el-icon>
                <span>服务器设置</span>
              </router-link>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { User, Lock, Tools, Shop } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import * as authApi from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { getCurrentBaseURL } from '@/utils/request'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// State
const mode = ref<'login' | 'register'>('login')
const errorMessage = ref('')
const infoMessage = ref('')
const formRef = ref<FormInstance>()
const cardWrapperRef = ref<HTMLElement>()
const cardResizing = ref(false)
const cardHeight = ref<number | null>(null)
let cardResizeTimer: ReturnType<typeof setTimeout> | undefined
let cardHeightTimer: ReturnType<typeof setTimeout> | undefined
let cardHeightFrame: number | undefined
let captchaRequestVersion = 0

// Data
const formData = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  accountType: '' as '' | 'collector' | 'club',
  clubName: '',
  applicationReason: '',
  captchaCode: '',
})

const captchaEnabled = ref<boolean | null>(null)
const captchaKey = ref('')
const captchaImagePath = ref('')
const captchaLoading = ref(false)
const captchaLoadError = ref('')

const captchaImageUrl = computed(() => {
  if (!captchaImagePath.value) return ''
  try {
    return new URL(captchaImagePath.value, getCurrentBaseURL()).toString()
  } catch {
    return ''
  }
})

const registerCaptchaUnavailable = computed(() => (
  mode.value === 'register'
  && captchaEnabled.value !== false
  && (captchaLoading.value || !captchaKey.value || Boolean(captchaLoadError.value))
))

// Validation
const validateConfirmPassword = (_rule: any, value: string, callback: (err?: Error) => void) => {
  if (mode.value === 'register' && value !== formData.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const loginRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const registerRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
  accountType: [{ required: true, message: '请选择账号类型', trigger: 'change' }],
  clubName: [{ validator: (_rule: any, value: string, callback: (err?: Error) => void) => {
    if (mode.value === 'register' && formData.accountType === 'club' && !value.trim()) callback(new Error('请输入社团名称'))
    else callback()
  }, trigger: 'blur' }],
  applicationReason: [{ validator: (_rule: any, value: string, callback: (err?: Error) => void) => {
    if (mode.value === 'register' && formData.accountType === 'club' && !value.trim()) callback(new Error('请填写申请理由'))
    else callback()
  }, trigger: 'blur' }],
  captchaCode: [{ validator: (_rule: any, value: string, callback: (err?: Error) => void) => {
    if (mode.value !== 'register' || captchaEnabled.value === false) callback()
    else if (!captchaKey.value || captchaLoadError.value) callback(new Error('请先获取验证码'))
    else if (!value.trim()) callback(new Error('请输入验证码'))
    else callback()
  }, trigger: 'blur' }],
}

const currentRules = computed(() => mode.value === 'login' ? loginRules : registerRules)

// Tab Bar Animation
const tabBarStyle = computed(() => {
  return {
    transform: mode.value === 'login' ? 'translateX(0)' : 'translateX(100%)',
  }
})

const cardStateClass = computed(() => {
  if (mode.value === 'login') return 'login-card--login'
  if (!formData.accountType) return 'login-card--identity'
  return formData.accountType === 'club' ? 'login-card--club' : 'login-card--collector'
})

const cardStyle = computed(() => {
  if (cardHeight.value === null) return undefined
  return { height: `${cardHeight.value}px` }
})

function getCardElement(): HTMLElement | null | undefined {
  return cardWrapperRef.value?.querySelector<HTMLElement>('.login-card')
}

function readCardHeight(): number | undefined {
  const card = getCardElement()
  if (!card) return undefined
  return Math.ceil(card.getBoundingClientRect().height)
}

function readNaturalCardHeight(): number | undefined {
  const card = getCardElement()
  if (!card) return undefined
  const inlineHeight = card.style.height
  card.style.height = 'auto'
  const naturalHeight = Math.ceil(card.getBoundingClientRect().height)
  card.style.height = inlineHeight
  return naturalHeight
}

function handlePanelAfterEnter() {
  const targetHeight = readNaturalCardHeight()
  if (!targetHeight) return
  if (cardHeightFrame !== undefined) cancelAnimationFrame(cardHeightFrame)
  cardHeightFrame = requestAnimationFrame(() => {
    cardHeightFrame = undefined
    cardHeight.value = targetHeight
    if (cardHeightTimer) clearTimeout(cardHeightTimer)
    cardHeightTimer = setTimeout(() => {
      cardHeight.value = null
    }, 340)
  })
}

function triggerCardResize() {
  const currentHeight = readCardHeight()
  if (currentHeight) cardHeight.value = currentHeight
  if (cardHeightTimer) clearTimeout(cardHeightTimer)
  if (cardHeightFrame !== undefined) {
    cancelAnimationFrame(cardHeightFrame)
    cardHeightFrame = undefined
  }

  cardResizing.value = false
  nextTick(() => {
    cardResizing.value = true
    if (cardResizeTimer) clearTimeout(cardResizeTimer)
    cardResizeTimer = setTimeout(() => {
      cardResizing.value = false
    }, 420)
  })
}

watch([mode, () => formData.accountType], triggerCardResize)

watch([mode, () => formData.accountType], ([nextMode, nextAccountType]) => {
  if (nextMode === 'register' && nextAccountType) {
    void loadCaptcha()
    return
  }
  captchaRequestVersion += 1
  captchaEnabled.value = null
  captchaKey.value = ''
  captchaImagePath.value = ''
  captchaLoadError.value = ''
  formData.captchaCode = ''
})

async function loadCaptcha() {
  const requestVersion = ++captchaRequestVersion
  captchaLoading.value = true
  captchaLoadError.value = ''
  formData.captchaCode = ''
  try {
    const challenge = await authApi.getCaptcha()
    if (requestVersion !== captchaRequestVersion) return
    captchaEnabled.value = challenge.enabled
    captchaKey.value = challenge.key || ''
    captchaImagePath.value = challenge.image || ''
  } catch {
    if (requestVersion !== captchaRequestVersion) return
    captchaEnabled.value = null
    captchaKey.value = ''
    captchaImagePath.value = ''
    captchaLoadError.value = '验证码加载失败，请稍后重试'
  } finally {
    if (requestVersion === captchaRequestVersion) captchaLoading.value = false
  }
}

function firstValidationMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstValidationMessage(item)
      if (message) return message
    }
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const message = firstValidationMessage(item)
      if (message) return message
    }
  }
  return undefined
}

function readErrorMessage(err: any, fallback: string): string {
  const data = err.response?.data
  if (typeof data?.detail === 'string') return data.detail
  for (const key of ['captcha_code', 'captcha_key', 'username', 'club_profile', 'application_reason']) {
    const message = firstValidationMessage(data?.[key])
    if (message) return message
  }
  return err.message || fallback
}

// Actions
function switchMode(newMode: 'login' | 'register') {
  if (mode.value === newMode) return
  mode.value = newMode
  if (newMode === 'register') {
    formData.accountType = ''
  }
  errorMessage.value = ''
  infoMessage.value = ''

  // Clear validation state when switching, but keep input values (UX choice)
  // except confirmPassword which is hidden/shown
  nextTick(() => {
    formRef.value?.clearValidate()
  })
}

function changeIdentity() {
  formData.accountType = ''
  errorMessage.value = ''
  infoMessage.value = ''
  nextTick(() => formRef.value?.clearValidate())
}

function getRedirectPath(): string {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect && redirect !== '/login') {
    return redirect
  }
  return '/showcase'
}

async function handleSubmit() {
  errorMessage.value = ''
  infoMessage.value = ''
  if (mode.value === 'register' && !formData.accountType) return
  await formRef.value?.validate(async (valid) => {
    if (!valid) return
    try {
      if (mode.value === 'login') {
        await authStore.login(formData.username.trim(), formData.password)
        ElMessage.success('登录成功')
      } else {
        const accountType = formData.accountType as 'collector' | 'club'
        const pending = await authStore.registerAccount({
          username: formData.username.trim(),
          password: formData.password,
          account_type: accountType,
          application_reason: formData.applicationReason.trim(),
          club_profile: { name: formData.clubName.trim() },
          ...(captchaEnabled.value === true ? {
            captcha_key: captchaKey.value,
            captcha_code: formData.captchaCode.trim(),
          } : {}),
        })
        if (pending) {
          ElMessage.success('社团申请已提交，请等待管理员审批')
          mode.value = 'login'
          formData.accountType = ''
          infoMessage.value = '申请已提交，审批通过后即可登录'
          return
        }
        ElMessage.success('注册成功，已自动登录')
      }
      await router.push(getRedirectPath())
    } catch (err: any) {
      errorMessage.value = readErrorMessage(err, mode.value === 'login' ? '登录失败' : '注册失败')
      if (mode.value === 'register' && err.response && err.response.status !== 429) {
        void loadCaptcha()
      }
    }
  })
}

function handleEnterKey() {
  if (mode.value === 'login') {
    handleSubmit()
  }
  // If register, do nothing (let user tab to confirm password)
}

onMounted(() => {
  errorMessage.value = ''
})

onBeforeUnmount(() => {
  if (cardResizeTimer) clearTimeout(cardResizeTimer)
  if (cardHeightTimer) clearTimeout(cardHeightTimer)
  if (cardHeightFrame !== undefined) cancelAnimationFrame(cardHeightFrame)
})
</script>

<style scoped>
/* Color Variables based on PM.txt */
:root {
  --color-brand: #D4AF37;       /* 香槟金 */
  --color-secondary: #F5F5F7;   /* 明亮灰 */
  --color-accent: #A29BFE;      /* 镭射紫 */
  --color-bg: #FFFFFF;          /* 纯白 */
  --color-text-main: #303133;
  --color-text-sub: #909399;
}

/* Base Layout */
.login-container {
  min-height: 100vh;
  height: 100dvh;
  width: 100vw;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20px;
  background-color: #FFFFFF; /* PM 1.2 BG */
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

/* Background Shapes (Simulating Laser Reflection) */
.bg-shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  z-index: 0;
  opacity: 0.4;
}

.shape-1 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #D4AF37 0%, transparent 70%); /* Champagne */
  top: -100px;
  right: -50px;
}

.shape-2 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, #A29BFE 0%, transparent 70%); /* Laser Purple */
  bottom: -50px;
  left: -50px;
}

/* Card Wrapper */
.login-card-wrapper {
  width: 100%;
  max-width: 800px;
  margin: auto;
  z-index: 1;
}

.login-card {
  width: 100%;
  max-width: 400px;
  min-height: 360px;
  margin: 0 auto;
  border-radius: 12px;
  border: 1px solid #D4AF37; /* PM 1.2: 1px 香槟金细边框 */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 24px rgba(212, 175, 55, 0.15); /* Subtle gold shadow */
  overflow: hidden; /* Important for height animation */
  transform-origin: center;
  transition: width var(--transition-normal, 0.3s ease), max-width var(--transition-normal, 0.3s ease), height var(--transition-normal, 0.3s ease), min-height var(--transition-normal, 0.3s ease), transform var(--transition-normal, 0.3s ease), box-shadow var(--transition-normal, 0.3s ease);
}

.login-card--login {
  min-height: 360px;
}

.login-card--identity {
  min-height: 410px;
}

.login-card--collector {
  min-height: 430px;
}

.login-card--club {
  max-width: 760px;
  min-height: 540px;
}

.login-card.is-resizing {
  animation: card-resize-pulse 0.42s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes card-resize-pulse {
  0% {
    transform: scale(0.988);
  }
  55% {
    transform: scale(1.006);
  }
  100% {
    transform: scale(1);
  }
}

.login-card:hover {
  box-shadow: 0 8px 32px rgba(162, 155, 254, 0.2); /* Laser Purple hint on hover */
}

.login-content {
  display: flex;
  flex-direction: column;
  min-height: inherit;
  padding: 40px 48px;
}

/* Header */
.card-header {
  align-self: auto;
  text-align: center;
  margin-bottom: 24px;
}

.auth-workspace {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.logo-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #D4AF37 0%, #FAD961 100%); /* Brand Color */
  border-radius: 12px;
  color: white;
  font-size: 24px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.login-title {
  font-size: 26px;
  font-weight: 700;
  color: #D4AF37; /* PM 1.2: Brand color for important titles */
  margin: 0 0 8px 0;
  letter-spacing: 1px;
}

.login-subtitle {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

/* Custom Tabs */
.custom-tabs {
  position: relative;
  display: flex;
  margin-bottom: 24px;
  border-bottom: 1px solid #f0f0f0;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 16px;
  font-weight: 500;
  color: #606266;
  cursor: pointer;
  transition: color 0.3s ease;
  z-index: 1;
}

.tab-item.active {
  color: #D4AF37;
  font-weight: 600;
}

.tab-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 50%;
  height: 2px;
  background-color: #D4AF37;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.auth-panel-enter-active,
.auth-panel-leave-active {
  transition: opacity var(--transition-fast, 0.2s ease), transform var(--transition-normal, 0.3s ease);
}

.auth-panel-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.auth-panel-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Registration identity step */
.identity-step {
  margin-top: 8px;
}

.identity-step__heading {
  margin-bottom: 18px;
  text-align: center;
}

.form-kicker {
  display: block;
  margin-bottom: 5px;
  color: var(--primary-gold-dark, #B8941F);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.4;
}

.identity-step__heading h3 {
  margin: 0;
  color: var(--text-dark, #333333);
  font-size: 22px;
  line-height: 1.35;
}

.identity-step__heading p {
  margin: 7px 0 0;
  color: var(--text-light, #888888);
  font-size: 13px;
}

.identity-options {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 12px;
}

.identity-options :deep(.el-radio-button) {
  flex: none;
  width: 100%;
  margin: 0;
}

.identity-options :deep(.el-radio-button__inner) {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 76px;
  padding: 14px 16px;
  border: 1px solid rgba(212, 175, 55, 0.18) !important;
  border-radius: var(--card-radius-sm, 12px) !important;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: var(--shadow-sm, 0 2px 10px rgba(0, 0, 0, 0.05)) !important;
  color: var(--text-regular, #606266);
  text-align: left;
  transition: var(--transition-fast, 0.2s ease);
}

.identity-options :deep(.el-radio-button__inner:hover) {
  border-color: rgba(162, 155, 254, 0.55) !important;
  background: rgba(246, 244, 255, 0.9);
}

.identity-options :deep(.el-radio-button.is-active .el-radio-button__inner) {
  border-color: var(--accent-purple, #A29BFE) !important;
  background: var(--accent-purple-soft, #F6F4FF);
  box-shadow: 0 0 0 3px rgba(196, 181, 253, 0.2), var(--shadow-purple-soft, 0 8px 18px rgba(142, 125, 255, 0.24)) !important;
  color: var(--accent-purple-dark, #9980FA);
}

.identity-option__icon {
  display: grid;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: rgba(212, 175, 55, 0.12);
  color: var(--primary-gold-dark, #B8941F);
  font-size: 20px;
}

.identity-options :deep(.is-active .identity-option__icon) {
  background: rgba(162, 155, 254, 0.16);
  color: var(--accent-purple-dark, #9980FA);
}

.identity-option__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.identity-option__copy strong {
  color: var(--text-dark, #333333);
  font-size: 15px;
  line-height: 1.3;
}

.identity-option__copy small {
  overflow: hidden;
  color: var(--text-light, #888888);
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Form */
.login-form {
  margin-top: 10px;
}

.login-form--club {
  margin-top: 0;
}

.selected-identity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(162, 155, 254, 0.18);
  border-radius: var(--card-radius-sm, 12px);
  background: rgba(246, 244, 255, 0.7);
}

.selected-identity .form-kicker {
  margin-bottom: 2px;
  color: var(--text-light, #888888);
  letter-spacing: 0;
}

.selected-identity strong {
  color: var(--accent-purple-dark, #9980FA);
  font-size: 14px;
}

.change-identity-btn {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 5px 8px;
  border-radius: var(--button-radius, 8px);
}

.register-sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: stretch;
}

.register-form-section {
  height: 100%;
  margin-bottom: 0;
  padding: 16px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  border-radius: var(--card-radius-sm, 12px);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.86)),
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.11), transparent 38%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 10px 28px -24px rgba(17, 24, 39, 0.5);
}

.register-form-section:last-of-type {
  margin-bottom: 0;
}

.register-form-section__heading {
  margin-bottom: 12px;
}

.register-form-section__heading .form-kicker {
  margin-bottom: 2px;
  color: var(--text-dark, #333333);
  font-size: 14px;
  letter-spacing: 0;
}

.register-form-section__heading p {
  margin: 0;
  color: var(--text-light, #888888);
  font-size: 12px;
  line-height: 1.45;
}

.login-form--club .register-form-section :deep(.el-form-item) {
  margin-bottom: 14px;
}

.login-form--club .register-form-section :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.login-form--club .register-form-section :deep(.el-form-item__label) {
  margin-bottom: 6px;
  color: #5f5874;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}

.login-form--club .register-form-section :deep(.el-input__wrapper) {
  min-height: 42px;
  border: 1px solid rgba(212, 175, 55, 0.1);
  border-radius: var(--button-radius, 8px);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 8px 24px rgba(142, 125, 255, 0.06);
}

.login-form--club .register-form-section :deep(.el-input__wrapper:hover) {
  border-color: rgba(142, 125, 255, 0.24);
}

.login-form--club .register-form-section :deep(.el-input__wrapper.is-focus) {
  border-color: rgba(142, 125, 255, 0.48);
  box-shadow: 0 0 0 3px rgba(196, 181, 253, 0.2), 0 12px 28px rgba(142, 125, 255, 0.1);
  background: rgba(255, 255, 255, 0.96);
}

.login-form :deep(.el-form-item__error) {
  position: static;
  margin-top: 5px;
  padding-top: 0;
  line-height: 1.35;
}

.login-form--club .register-form-section--application :deep(.el-textarea__inner) {
  height: 94px !important;
  min-height: 94px !important;
  max-height: 94px !important;
  resize: none;
  overflow-y: auto;
}

.register-field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.login-form--club .register-field-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.login-form :deep(.el-input__wrapper) {
  box-shadow: none;
  background-color: #F5F5F7; /* PM 1.2: Secondary color for input bg */
  border-radius: 8px;
  padding: 8px 16px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  background-color: #fff;
  border-color: #D4AF37; /* Brand color focus */
  box-shadow: 0 0 0 1px #D4AF37 inset;
}

.login-form :deep(.el-input__inner) {
  height: 44px;
  font-size: 15px;
  color: #303133;
}

.captcha-control {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  width: 100%;
}

.captcha-image-shell {
  position: relative;
  display: block;
  width: 132px;
  height: 52px;
  padding: 0;
  overflow: hidden;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #f5f5f7;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.captcha-image-shell:hover:not(:disabled),
.captcha-image-shell:focus-visible {
  border-color: #d4af37;
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.16);
  outline: none;
}

.captcha-image-shell:disabled {
  cursor: wait;
}

.captcha-image,
.captcha-image-placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  object-fit: contain;
  color: #909399;
  font-size: 13px;
}

.captcha-load-error {
  width: 100%;
  margin: 6px 0 0;
  color: #f56c6c;
  font-size: 12px;
  line-height: 1.4;
}

/* Expand Animation Wrapper */
.expand-wrapper {
  overflow: hidden;
  /* Hardware acceleration for smoother animation */
  will-change: height, opacity;
}

/* Custom Transition: Expand */
.expand-enter-active,
.expand-leave-active {
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
}

/* Slide effect for the inner item */
.confirm-password-item {
  margin-bottom: 18px; /* Standard el-form-item margin */
  /* Ensure transform origin is top for natural feel */
  transform-origin: top;
  animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.form-actions {
  margin-top: 24px;
  /* Smooth transition for when button is pushed down */
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.submit-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
  background: #A29BFE; /* PM 1.2: Accent for Primary Button */
  border: none;
  box-shadow: 0 4px 14px rgba(162, 155, 254, 0.4);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* Laser/Holographic hover effect */
.submit-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    120deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  transition: 0.5s;
}

.submit-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(162, 155, 254, 0.5);
}

.submit-btn:hover::before {
  left: 100%;
}

.submit-btn:active {
  transform: translateY(1px);
}

/* Alert */
.error-alert {
  margin-top: 16px;
  border-radius: 8px;
}

/* Footer */
.footer-links {
  margin-top: auto;
  padding-top: 24px;
  text-align: center;
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #909399;
  text-decoration: none;
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 20px;
  transition: all 0.3s ease;
  background: transparent;
  border: 1px solid transparent;
}

.link:hover {
  color: #D4AF37;
  border-color: #D4AF37;
  background: rgba(212, 175, 55, 0.05);
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .login-container {
    overflow-y: auto;
  }

  .login-card-wrapper {
    max-width: 520px;
    margin: 16px 0;
  }

  .login-card,
  .login-card--login,
  .login-card--identity,
  .login-card--collector,
  .login-card--club {
    max-width: 100%;
    min-height: auto;
  }

  .login-content {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 36px 32px;
  }

  .card-header {
    align-self: auto;
    text-align: center;
    margin-bottom: 24px;
  }

  .logo-container {
    justify-content: center;
  }

  .identity-options,
  .register-sections {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .identity-options :deep(.el-radio-button) {
    flex: none;
  }

  .footer-links {
    text-align: center;
  }
}

/* Mobile Optimizations */
@media (max-width: 480px) {
  .login-container {
    padding: 0;
    background: #FFFFFF;
  }

  .bg-shape {
    opacity: 0.2; /* Lighter on mobile */
  }

  .login-card-wrapper {
    height: auto;
    min-height: 100%;
    max-width: none;
  }

  .login-card {
    height: auto;
    min-height: 100vh;
    border-radius: 0;
    border: none;
    box-shadow: none;
    background: transparent;
    overflow: visible;
  }

  .login-content {
    padding: 32px 24px;
    min-height: 100vh;
    height: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .login-form--club {
    margin-top: 0;
  }

  .register-field-grid,
  .login-form--club .register-field-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .captcha-control {
    grid-template-columns: 112px minmax(0, 1fr);
  }

  .captcha-image-shell {
    width: 112px;
  }

  .identity-option__copy small {
    white-space: normal;
  }

  .card-header {
    margin-bottom: 32px;
  }

  .logo-icon {
    width: 72px;
    height: 72px;
    font-size: 28px;
    margin-bottom: 12px;
  }

  .login-title {
    font-size: 28px;
  }

  .footer-links {
    margin-top: auto;
    padding-bottom: 20px;
  }
}
</style>
