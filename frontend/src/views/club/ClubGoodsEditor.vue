<template>
  <div v-loading="loading" class="editor-page" :class="{ 'editor-page--create-wizard': useCreateWizard }">
    <header class="editor-header">
      <div class="editor-title-block">
        <el-button text class="editor-back" @click="router.push('/club/goods')"><el-icon><ArrowLeft /></el-icon>返回社团谷子</el-button>
        <h2>{{ isEdit ? '编辑社团谷子' : '新增社团谷子' }}</h2>
        <p>名称、图片和上架状态，都在这里好好整理吧~</p>
        <div v-if="useCreateWizard" class="editor-wizard-heading">
          <span>{{ currentWizardStep.title }}</span>
          <strong>{{ wizardProgressText }}</strong>
        </div>
      </div>
    </header>

    <div v-if="useCreateWizard" class="editor-wizard-progress" aria-label="创建进度">
      <div
        v-for="(step, index) in createWizardSteps"
        :key="step.key"
        class="editor-wizard-progress__item"
        :class="{ 'is-active': index === currentWizardStepIndex, 'is-done': index < currentWizardStepIndex }"
      >
        <span class="editor-wizard-progress__dot">{{ index + 1 }}</span>
        <span class="editor-wizard-progress__label">{{ step.title }}</span>
      </div>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="editor-form">
      <div class="editor-workbench">
        <div class="editor-main-column">
          <Transition name="editor-wizard-section" appear>
          <section v-show="shouldShowFormSection('basic')" class="form-section form-section--basic editor-wizard-stage" :aria-hidden="useCreateWizard && currentWizardStep.key !== 'basic'">
            <div class="form-section-header">
              <span class="form-section-header-bar" aria-hidden="true"></span>
              <div><h3>基础信息</h3><p>IP、角色与品类，都来认识一下吧~</p></div>
            </div>
            <el-row :gutter="20">
              <el-col :xs="24" :sm="12">
                <el-form-item label="谷子名称" prop="name"><el-input v-model="form.name" maxlength="200" placeholder="请输入谷子名称" /></el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="IP作品" prop="ip_id">
                  <el-select v-model="form.ip_id" filterable placeholder="选择 IP" style="width: 100%" @change="loadCharacters">
                    <el-option v-for="ip in metadata.ips" :key="ip.id" :label="ip.name" :value="ip.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="角色" prop="character_ids">
                  <el-select v-model="form.character_ids" filterable multiple placeholder="选择角色（可多选）" style="width: 100%" :disabled="!form.ip_id">
                    <el-option v-for="character in characters" :key="character.id" :label="character.name" :value="character.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="品类" prop="category_id">
                  <el-select v-model="form.category_id" filterable placeholder="选择品类" style="width: 100%">
                    <el-option v-for="category in metadata.categories" :key="category.id" :label="category.path_name || category.name" :value="category.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="主题"><el-select v-model="form.theme_id" filterable clearable :placeholder="metadata.themes.length ? '选择主题' : '请先在主题管理中创建主题'" style="width: 100%">
                  <el-option v-for="theme in metadata.themes" :key="theme.id" :label="theme.name" :value="theme.id" />
                </el-select></el-form-item>
              </el-col>
            </el-row>
          </section>
          </Transition>

          <Transition name="editor-wizard-section" appear>
          <section v-show="shouldShowFormSection('publish')" class="form-section form-section--publish editor-wizard-stage" :aria-hidden="useCreateWizard && currentWizardStep.key !== 'publish'">
            <div class="form-section-header">
              <span class="form-section-header-bar" aria-hidden="true"></span>
              <div><h3>发布设置</h3><p>设置发布状态、价格和上架时间</p></div>
            </div>
            <div class="publish-settings-grid">
              <el-form-item label="状态" prop="publication_status">
                <el-radio-group v-model="form.publication_status" class="status-segmented">
                  <el-radio-button value="draft">草稿</el-radio-button>
                  <el-radio-button value="listed">上架</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="价格">
                <el-input v-model="form.public_price" placeholder="可选" />
              </el-form-item>
              <el-form-item label="定时上架" class="publish-schedule-field">
                <el-date-picker
                  v-model="publishAtLocal"
                  class="publish-date-picker"
                  type="datetime"
                  format="YYYY-MM-DD HH:mm"
                  value-format="YYYY-MM-DDTHH:mm"
                  placeholder="选择上架时间"
                  popper-class="club-publish-datetime-popper"
                  :disabled="form.publication_status !== 'draft'"
                  :disabled-date="disablePastPublishDate"
                  :editable="false"
                  clearable
                  @change="handlePublishDateChange"
                />
                <p class="field-help">仅草稿可设置，按北京时间执行</p>
                <p v-if="form.publish_error" class="publish-error">上次定时上架失败：{{ form.publish_error }}（请重新设置时间）</p>
              </el-form-item>
            </div>
          </section>
          </Transition>

          <Transition name="editor-wizard-section" appear>
          <section v-show="shouldShowFormSection('publish')" class="form-section form-section--notes editor-wizard-stage" :aria-hidden="useCreateWizard && currentWizardStep.key !== 'publish'">
            <div class="form-section-header">
              <span class="form-section-header-bar" aria-hidden="true"></span>
              <div><h3>公开说明</h3><p>给来访的小伙伴留下一点补充说明吧~</p></div>
            </div>
            <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="5" maxlength="2000" show-word-limit placeholder="请输入公开说明" /></el-form-item>
          </section>
          </Transition>
        </div>

        <aside class="editor-side-column" aria-label="图片与表单操作">
          <Transition name="editor-wizard-section" appear>
          <section v-show="shouldShowFormSection('images')" class="form-section form-section--images editor-wizard-stage" :aria-hidden="useCreateWizard && currentWizardStep.key !== 'images'">
            <div class="form-section-header">
              <span class="form-section-header-bar" aria-hidden="true"></span>
              <div><h3>图片</h3></div>
            </div>
            <el-form-item label="主图">
              <el-upload v-model:file-list="mainPhotoList" list-type="picture-card" :auto-upload="false" :limit="1" accept="image/*" class="main-photo-uploader" :on-change="handleMainPhotoChange" :on-exceed="handleMainPhotoExceed" :on-remove="handleMainPhotoRemove"><el-icon><Plus /></el-icon></el-upload>
            </el-form-item>
            <el-form-item label="附加图片">
              <el-upload v-model:file-list="additionalPhotoList" list-type="picture-card" :auto-upload="false" multiple accept="image/*" class="additional-photo-uploader" :on-change="handleAdditionalPhotoChange" :on-remove="handleAdditionalPhotoRemove"><el-icon><Plus /></el-icon></el-upload>
            </el-form-item>
          </section>
          </Transition>
          <div class="desktop-action-footer" aria-label="桌面端表单操作">
            <el-button class="desktop-action-button desktop-action-button--back" @click="router.push('/club/goods')"><el-icon><ArrowLeft /></el-icon>取消</el-button>
            <el-button type="primary" class="desktop-action-button desktop-action-button--save" @click="save(form.publication_status)"><el-icon><Check /></el-icon>{{ form.publication_status === 'draft' ? '保存草稿' : '保存并上架' }}</el-button>
          </div>
        </aside>
      </div>
    </el-form>

    <div class="mobile-form-dock-wrap" :class="{ 'mobile-form-dock-wrap--wizard': useCreateWizard }" aria-label="移动端表单操作">
      <div class="mobile-form-dock-stack">
        <div class="mobile-form-dock-fade" aria-hidden="true"></div>
        <div class="mobile-form-dock-actions">
          <template v-if="useCreateWizard">
            <el-button v-if="!isFirstWizardStep" class="mobile-form-dock-btn mobile-form-dock-btn--back" @click="goPreviousWizardStep">上一步</el-button>
            <el-button
              type="primary"
              class="mobile-form-dock-btn mobile-form-dock-btn--publish"
              :class="{ 'mobile-form-dock-btn--subtle': !isLastWizardStep }"
              @click="handleWizardPrimaryAction"
            >{{ isLastWizardStep ? saveActionLabel : '下一步' }}</el-button>
          </template>
          <template v-else>
            <el-button class="mobile-form-dock-btn mobile-form-dock-btn--back" @click="router.push('/club/goods')">取消</el-button>
            <el-button type="primary" class="mobile-form-dock-btn mobile-form-dock-btn--publish" @click="save(form.publication_status)">{{ saveActionLabel }}</el-button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMobileWorkspaceStore } from '@/stores/mobileWorkspace'
import { nextTick, onMounted, onUnmounted, reactive, ref, computed, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules, UploadFile, UploadRawFile } from 'element-plus'
import { ArrowLeft, Check, Plus } from '@element-plus/icons-vue'
import {
  createClubGoods,
  deleteClubGoodsAdditionalPhoto,
  getMyClubGoodsDetail,
  updateClubGoods,
  uploadClubGoodsAdditionalPhotos,
  uploadClubGoodsMainPhoto,
} from '@/api/clubs'
import { useMetadataStore } from '@/stores/metadata'
import { useResponsiveDevice } from '@/composables/useResponsiveDevice'
import type { ClubCatalogInput, ClubPublicationStatus } from '@/api/types'

type ClubEditorPublicationStatus = Exclude<ClubPublicationStatus, 'unlisted'>
type CreateWizardStepKey = 'basic' | 'images' | 'publish'
interface CreateWizardStep {
  key: CreateWizardStepKey
  title: string
  validationFields: string[]
}

const route = useRoute()
const router = useRouter()
const metadata = useMetadataStore()
const { isMobile } = useResponsiveDevice()
const formRef = ref<FormInstance>()
const loading = ref(false)
const isEdit = computed(() => Boolean(route.params.id))
const characters = ref<{ id: number; name: string }[]>([])
const form = reactive({
  name: '', description: '', ip_id: undefined as number | undefined, category_id: undefined as number | undefined,
  character_ids: [] as number[], theme_id: null as number | null, public_price: '',
  publication_status: 'draft' as ClubEditorPublicationStatus,
  publish_error: null as string | null,
})
const mainPhotoFile = ref<File | null>(null)
const mainPhotoList = ref<UploadFile[]>([])
const additionalPhotoFiles = ref<File[]>([])
const additionalPhotoList = ref<UploadFile[]>([])
const removedAdditionalPhotoIds = ref<number[]>([])
const publishAtLocal = ref('')
const isDirty = ref(false)
const createWizardSteps: CreateWizardStep[] = [
  { key: 'basic', title: '基础信息', validationFields: ['name', 'ip_id', 'character_ids', 'category_id'] },
  { key: 'images', title: '图片', validationFields: [] },
  { key: 'publish', title: '说明与发布', validationFields: [] },
]
const currentWizardStepIndex = ref(0)
const useCreateWizard = computed(() => isMobile.value && !isEdit.value)
const currentWizardStep = computed(() => createWizardSteps[currentWizardStepIndex.value] ?? createWizardSteps[0]!)
const wizardProgressText = computed(() => `${currentWizardStepIndex.value + 1}/${createWizardSteps.length}`)
const isFirstWizardStep = computed(() => currentWizardStepIndex.value === 0)
const isLastWizardStep = computed(() => currentWizardStepIndex.value === createWizardSteps.length - 1)
const saveActionLabel = computed(() => form.publication_status === 'draft' ? '保存草稿' : '保存并上架')
const shouldShowFormSection = (section: CreateWizardStepKey) => !useCreateWizard.value || currentWizardStep.value.key === section

const rules: FormRules = {
  name: [{ required: true, message: '请输入谷子名称', trigger: 'blur' }],
  ip_id: [{ required: true, message: '请选择 IP', trigger: 'change' }],
  category_id: [{ required: true, message: '请选择品类', trigger: 'change' }],
  character_ids: [{ validator: (_rule, value, callback) => {
    if (form.publication_status === 'listed' && (!Array.isArray(value) || value.length === 0)) callback(new Error('上架时至少选择一个角色'))
    else callback()
  }, trigger: 'change' }],
}

function toDateTimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value
    return result
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`
}

function fromDateTimeLocal(value: string): string | null {
  if (!value) return null
  return `${value}:00+08:00`
}

async function loadCharacters() {
  characters.value = form.ip_id ? await metadata.fetchIPCharacters(form.ip_id) : []
  if (!isEdit.value) form.character_ids = []
}

async function load() {
  loading.value = true
  try {
    await metadata.fetchAll()
    if (!isEdit.value) return
    const item = await getMyClubGoodsDetail(String(route.params.id))
    Object.assign(form, {
      name: item.name, description: item.description || '', ip_id: item.ip.id, category_id: item.category.id,
      character_ids: item.characters.map(character => character.id), theme_id: item.theme?.id ?? null,
      public_price: item.public_price || '', publication_status: item.publication_status === 'listed' ? 'listed' : 'draft',
      publish_error: item.publish_error || null,
    })
    publishAtLocal.value = item.publish_at ? toDateTimeLocal(new Date(item.publish_at)) : ''
    characters.value = await metadata.fetchIPCharacters(item.ip.id)
    if (item.main_photo) mainPhotoList.value = [{ name: '主图', url: item.main_photo, status: 'success', uid: -1 }]
    additionalPhotoList.value = item.additional_photos.map(photo => ({ name: photo.label || '附加图片', url: photo.image, status: 'success', uid: photo.id }))
  } finally { loading.value = false; isDirty.value = false }
}

function handleMainPhotoChange(file: UploadFile) { if (file.raw) mainPhotoFile.value = file.raw }
function handleMainPhotoExceed(files: File[]) {
  const file = files[0]; if (!file) return
  const previous = mainPhotoList.value[0]
  if (previous?.url?.startsWith('blob:')) URL.revokeObjectURL(previous.url)
  mainPhotoFile.value = file
  mainPhotoList.value = [{ name: file.name, url: URL.createObjectURL(file), status: 'ready', uid: Date.now(), raw: file as UploadRawFile }]
}
function handleMainPhotoRemove() { const url = mainPhotoList.value[0]?.url; if (url?.startsWith('blob:')) URL.revokeObjectURL(url); mainPhotoFile.value = null; mainPhotoList.value = [] }
function handleAdditionalPhotoChange(file: UploadFile) { if (file.raw && !additionalPhotoFiles.value.includes(file.raw)) additionalPhotoFiles.value.push(file.raw) }
function handleAdditionalPhotoRemove(file: UploadFile) {
  if (file.raw) additionalPhotoFiles.value = additionalPhotoFiles.value.filter(item => item !== file.raw)
  else { const id = Number(file.uid); if (Number.isInteger(id) && id > 0 && !removedAdditionalPhotoIds.value.includes(id)) removedAdditionalPhotoIds.value.push(id) }
}

function disablePastPublishDate(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

function handlePublishDateChange() {
  form.publish_error = null
  isDirty.value = true
}

function scrollWizardToTop() {
  nextTick(() => {
    const header = document.querySelector<HTMLElement>('.editor-header')
    if (!header) return
    const navbar = document.querySelector<HTMLElement>('.navbar')
    const navbarHeight = navbar?.getBoundingClientRect().height ?? 0
    const targetTop = Math.max(0, header.getBoundingClientRect().top + window.scrollY - navbarHeight - 10)
    try {
      window.scrollTo({ top: targetTop, behavior: 'smooth' })
    } catch {
      window.scrollTo(0, targetTop)
    }
  })
}

async function validateCurrentWizardStep() {
  const fields = currentWizardStep.value.validationFields
  if (!formRef.value || fields.length === 0) return true
  try {
    await formRef.value.validateField(fields)
    return true
  } catch {
    return false
  }
}

function goPreviousWizardStep() {
  if (!useCreateWizard.value || isFirstWizardStep.value) return
  currentWizardStepIndex.value -= 1
  scrollWizardToTop()
}

async function goNextWizardStep() {
  if (!useCreateWizard.value || isLastWizardStep.value) return
  if (!await validateCurrentWizardStep()) return
  currentWizardStepIndex.value += 1
  scrollWizardToTop()
}

async function handleWizardPrimaryAction() {
  if (isLastWizardStep.value) {
    await save(form.publication_status)
    return
  }
  await goNextWizardStep()
}

async function save(publicationStatus: ClubEditorPublicationStatus) {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (publicationStatus === 'draft' && publishAtLocal.value) {
    const timestamp = fromDateTimeLocal(publishAtLocal.value)
    if (!timestamp || new Date(timestamp).getTime() <= Date.now()) {
      ElMessage.error('定时上架时间必须晚于当前时间')
      return
    }
  }
  loading.value = true
  try {
    const data: ClubCatalogInput = {
      name: form.name, description: form.description, ip_id: form.ip_id!, category_id: form.category_id!,
      character_ids: form.character_ids, theme_id: form.theme_id, public_price: form.public_price || null,
      publication_status: publicationStatus,
      publish_at: publicationStatus === 'draft' ? fromDateTimeLocal(publishAtLocal.value) : null,
      main_photo: mainPhotoFile.value,
    }
    const item = isEdit.value ? await updateClubGoods(String(route.params.id), data) : await createClubGoods(data)
    const id = String(item.id)
    if (mainPhotoFile.value) await uploadClubGoodsMainPhoto(id, mainPhotoFile.value)
    if (additionalPhotoFiles.value.length) await uploadClubGoodsAdditionalPhotos(id, additionalPhotoFiles.value)
    for (const photoId of removedAdditionalPhotoIds.value) await deleteClubGoodsAdditionalPhoto(id, photoId)
    ElMessage.success(publicationStatus === 'draft' ? '草稿已保存' : '社团谷子已保存')
    isDirty.value = false
    useMobileWorkspaceStore().clubGoodsChanged = true
    router.push('/club/goods')
  } finally { loading.value = false }
}

onMounted(load)
watch(form, () => { if (!loading.value) isDirty.value = true }, { deep: true })
watch(publishAtLocal, () => { if (!loading.value) isDirty.value = true })
onBeforeRouteLeave(() => {
  if (isDirty.value && !window.confirm('当前页面有未保存的修改，确定离开吗？')) return false
  return true
})
onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onUnmounted(() => { const url = mainPhotoList.value[0]?.url; if (url?.startsWith('blob:')) URL.revokeObjectURL(url); window.removeEventListener('beforeunload', handleBeforeUnload) })

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
</script>

<style scoped>
.editor-page { max-width: 1320px; margin: 0 auto; padding: 20px 24px 36px; }
.editor-header { margin-bottom: 16px; }
.editor-title-block { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.editor-back { padding: 2px 0; color: var(--text-regular); font-size: 14px; }
.editor-back:hover { color: var(--primary-gold-dark); }
.editor-header h2 { margin: 4px 0 0; color: var(--primary-gold); font-size: 22px; font-weight: 700; line-height: 1.25; }
.editor-header p { margin: 0; color: var(--text-light); font-size: 13px; line-height: 1.45; }
.editor-wizard-heading { display: flex; align-items: center; gap: 8px; min-width: 0; margin-top: 2px; color: #909399; font-size: 12px; line-height: 1.2; }
.editor-wizard-heading span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.editor-wizard-heading strong { flex: none; padding: 2px 7px; border-radius: 999px; color: var(--primary-gold-dark); background: rgba(212,175,55,.1); font-weight: 700; }
.editor-wizard-progress { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 0 0 12px; padding: 8px; border: 1px solid rgba(212,175,55,.14); border-radius: 14px; background: rgba(255,255,255,.96); box-shadow: var(--shadow-sm); }
.editor-wizard-progress__item { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; color: #a8abb2; }
.editor-wizard-progress__item:not(:last-child)::after { position: absolute; top: 12px; left: calc(50% + 13px); width: calc(100% - 20px); height: 1px; content: ''; background: #e8eaf2; }
.editor-wizard-progress__item.is-done:not(:last-child)::after, .editor-wizard-progress__item.is-active:not(:last-child)::after { background: rgba(212,175,55,.38); }
.editor-wizard-progress__dot { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; color: #9ca3af; background: #f3f4f8; font-size: 12px; font-weight: 800; }
.editor-wizard-progress__label { max-width: 100%; overflow: hidden; font-size: 11px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.editor-wizard-progress__item.is-active .editor-wizard-progress__dot { color: #fff; background: linear-gradient(135deg, var(--primary-gold), var(--primary-gold-light)); box-shadow: 0 4px 12px rgba(212,175,55,.26); }
.editor-wizard-progress__item.is-active .editor-wizard-progress__label { color: var(--primary-gold-dark); font-weight: 700; }
.editor-wizard-progress__item.is-done .editor-wizard-progress__dot { color: var(--primary-gold-dark); background: rgba(212,175,55,.14); }
.editor-form { width: 100%; margin-top: 4px; }
.editor-workbench { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; }
.editor-main-column, .editor-side-column { display: flex; min-width: 0; flex-direction: column; gap: 16px; }
.form-section { margin: 0; padding: 16px 18px 18px; border: 1px solid rgba(17,24,39,.06); border-radius: 14px; background: #fff; box-shadow: 0 3px 14px rgba(15,23,42,.04); }
.form-section-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 16px; }
.form-section-header-bar { flex: 0 0 3px; width: 3px; height: 20px; margin-top: 2px; border-radius: 999px; background: linear-gradient(180deg, var(--primary-gold), #d9c18a); }
.form-section-header h3 { margin: 0; color: #303133; font-size: 18px; font-weight: 700; line-height: 1.25; }
.form-section-header p { margin: 3px 0 0; color: #909399; font-size: 12px; line-height: 1.45; }
.editor-page :deep(.el-form-item) { margin-bottom: 20px; }
.form-section :deep(.el-form-item:last-child) { margin-bottom: 0; }
.editor-page :deep(.el-form-item__label) { height: auto; padding-bottom: 6px; color: #606266; font-size: 13px; font-weight: 600; line-height: 1.35; }
.editor-page :deep(.el-form-item__error) { position: static; margin-top: 4px; padding-top: 0; line-height: 1.35; white-space: normal; }
.editor-page :deep(.el-input__wrapper), .editor-page :deep(.el-textarea__inner), .editor-page :deep(.el-select .el-input__wrapper) { border-radius: 10px; border-color: #e5e5e5; background: #fff; transition: border-color .16s ease, box-shadow .16s ease; }
.editor-page :deep(.el-input__wrapper:hover), .editor-page :deep(.el-textarea__inner:hover), .editor-page :deep(.el-select .el-input__wrapper:hover) { border-color: #d0d0d7; box-shadow: 0 0 0 1px rgba(208,208,215,.3); }
.editor-page :deep(.el-input.is-focus .el-input__wrapper), .editor-page :deep(.el-select .el-input.is-focus .el-input__wrapper), .editor-page :deep(.el-textarea__inner:focus) { border-color: var(--primary-gold); box-shadow: 0 0 0 1px rgba(195,160,80,.35), 0 8px 18px rgba(0,0,0,.05); }
.editor-page :deep(.el-button) { border-radius: 10px; }
.status-segmented { display: flex; flex-wrap: wrap; gap: 8px; }
.status-segmented :deep(.el-radio-button__inner) { border-radius: 999px !important; border: 1px solid #e5e7ef; box-shadow: none; padding: 8px 14px; color: #606266; background: #fff; }
.status-segmented :deep(.el-radio-button__orig-radio:checked + .el-radio-button__inner) { color: #fff; border-color: var(--primary-gold); background: var(--primary-gold); box-shadow: 0 6px 14px rgba(212,175,55,.22); }
.status-segmented :deep(.el-radio-button__inner:hover) { color: var(--primary-gold-dark); }
.publish-settings-grid { display: grid; grid-template-columns: minmax(150px, .85fr) minmax(140px, .7fr) minmax(280px, 1.45fr); align-items: start; gap: 20px; }
.publish-settings-grid :deep(.el-form-item) { margin-bottom: 0; }
.field-help { color: var(--text-light); font-size: 12px; line-height: 1.45; }
.publish-date-picker { width: 100% !important; }
.publish-date-picker :deep(.el-input__wrapper) { min-height: 34px; border: 1px solid #e5e5e5; border-radius: 10px; background: #fffdf8; box-shadow: none; }
.publish-date-picker :deep(.el-input__wrapper:hover) { border-color: rgba(195,160,80,.6); box-shadow: 0 0 0 1px rgba(195,160,80,.12); }
.publish-date-picker :deep(.el-input__wrapper.is-focus) { border-color: var(--primary-gold); box-shadow: 0 0 0 2px rgba(195,160,80,.15); }
.publish-date-picker :deep(.el-input__prefix) { color: var(--primary-gold-dark); }
.field-help { margin: 6px 0 0; }
.publish-error { margin: 5px 0 0; color: var(--el-color-danger); font-size: 12px; line-height: 1.45; }
:global(.club-publish-datetime-popper) { --el-color-primary: var(--primary-gold); --el-datepicker-active-color: var(--primary-gold); --el-datepicker-hover-text-color: var(--primary-gold-dark); border-radius: 12px; box-shadow: 0 14px 34px rgba(35,31,24,.16); }
:global(.club-publish-datetime-popper .el-picker-panel) { border-radius: 12px; overflow: hidden; }
:global(.club-publish-datetime-popper .el-date-table td.today .el-date-table-cell__text) { color: var(--primary-gold-dark); font-weight: 700; }
:global(.club-publish-datetime-popper .el-date-table td.current:not(.disabled) .el-date-table-cell__text) { color: #fff; background: var(--primary-gold); }
.form-section--images { background: linear-gradient(180deg, #fff 0%, #fbfbff 100%); }
.main-photo-uploader { display: block; width: min(220px, 100%); }
.main-photo-uploader :deep(.el-upload-list--picture-card) { display: flex; flex-wrap: wrap; width: 100%; }
.main-photo-uploader :deep(.el-upload--picture-card), .main-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item) { width: 100%; height: auto; aspect-ratio: 1; box-sizing: border-box; margin: 0; border-radius: 16px; border: 1px dashed #e0e3f0; background: #fafbff; }
.main-photo-uploader :deep(.el-upload-list__item-thumbnail) { object-fit: contain; background: #fff; }
.main-photo-uploader :deep(.el-icon), .additional-photo-uploader :deep(.el-icon) { color: #b1b5c6; font-size: 26px; }
.additional-photo-uploader { width: 100%; }
.additional-photo-uploader :deep(.el-upload--picture-card), .additional-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item) { width: 120px; height: 120px; margin: 0 12px 12px 0; border-radius: 12px; border: 1px dashed #e0e3f0; background: #fbfbff; }
.desktop-action-footer { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 12px 14px 14px; border: 1px solid rgba(17,24,39,.06); border-radius: 14px; background: #fff; box-shadow: 0 3px 14px rgba(15,23,42,.04); }
.desktop-action-button { width: 100%; min-height: 38px; margin: 0; font-weight: 600; }
.desktop-action-button--back { color: #606266; background: rgba(255,255,255,.72); border-color: #e5e7ef; }
.desktop-action-button--save {
  --el-button-bg-color: var(--primary-gold);
  --el-button-border-color: var(--primary-gold);
  --el-button-hover-bg-color: var(--primary-gold-dark);
  --el-button-hover-border-color: var(--primary-gold-dark);
  --el-button-active-bg-color: var(--primary-gold-dark);
  --el-button-active-border-color: var(--primary-gold-dark);
  color: #fff !important;
  background-color: var(--primary-gold) !important;
  border-color: var(--primary-gold) !important;
}
.desktop-action-button--save:hover,
.desktop-action-button--save:focus {
  color: #fff !important;
  background-color: var(--primary-gold-dark) !important;
  border-color: var(--primary-gold-dark) !important;
}
.mobile-form-dock-wrap { display: none; }
@media (min-width: 1100px) {
  .editor-workbench { grid-template-columns: minmax(0, 1fr) minmax(360px, 420px); gap: 20px; align-items: start; }
  .editor-side-column { position: sticky; top: 84px; max-height: calc(100vh - 108px); overflow-y: auto; padding-right: 4px; }
}
@media (min-width: 1440px) { .editor-workbench { grid-template-columns: minmax(0, 1fr) minmax(380px, 440px); } }
@media (max-width: 768px) {
  .editor-page { padding: 12px 16px calc(108px + env(safe-area-inset-bottom, 0px)); }
  .editor-header { margin-bottom: 12px; }
  .editor-header h2 { font-size: 20px; }
  .form-section { padding: 15px 16px 17px; border-radius: 12px; }
  .form-section-header { margin-bottom: 14px; }
  .form-section-header h3 { font-size: 17px; }
  .editor-page :deep(.el-form-item) { margin-bottom: 18px; }
  .editor-workbench { gap: 12px; }
  .editor-main-column, .editor-side-column { gap: 12px; }
  .publish-settings-grid { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .main-photo-uploader :deep(.el-upload--picture-card), .main-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item) { width: min(220px, 100%); }
  .desktop-action-footer { display: none; }
  .mobile-form-dock-wrap { position: fixed; right: 0; bottom: 0; left: 0; z-index: 999; display: block; pointer-events: none; }
  .mobile-form-dock-stack { position: relative; isolation: isolate; display: flex; flex-direction: column; width: 100%; margin: 0 auto; padding: 0 16px calc(12px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; }
  .mobile-form-dock-fade { position: absolute; z-index: 0; right: 0; bottom: 0; left: 0; height: min(180px, 36vh); min-height: 126px; pointer-events: none; background: linear-gradient(to top, var(--secondary-gray) 0%, rgba(245,245,247,.92) 30%, rgba(245,245,247,.55) 58%, rgba(255,255,255,0) 100%); }
  .mobile-form-dock-actions { position: relative; z-index: 1; display: flex; align-items: stretch; gap: 8px; width: 100%; pointer-events: auto; }
  .mobile-form-dock-btn { flex: 1; min-width: 0; min-height: 48px; margin: 0; border-radius: 999px !important; font-size: 14px; font-weight: 600; }
  .editor-page :deep(.mobile-form-dock-btn.el-button) { border-radius: 999px !important; }
  .mobile-form-dock-btn--back { flex: 3; color: #606266 !important; background: #fff !important; border: 1px solid #e6e8ef !important; box-shadow: none !important; }
  .mobile-form-dock-btn--back:hover, .mobile-form-dock-btn--back:focus { color: var(--primary-gold-dark) !important; background: #fffaf0 !important; border-color: rgba(212,175,55,.4) !important; }
  .mobile-form-dock-btn--publish { flex: 6; --el-button-bg-color: var(--primary-gold); --el-button-border-color: var(--primary-gold); --el-button-hover-bg-color: var(--primary-gold-dark); --el-button-hover-border-color: var(--primary-gold-dark); --el-button-active-bg-color: var(--primary-gold-dark); --el-button-active-border-color: var(--primary-gold-dark); color: #fff !important; background-color: var(--primary-gold) !important; border-color: var(--primary-gold) !important; }
  .mobile-form-dock-btn--publish:hover, .mobile-form-dock-btn--publish:focus { color: #fff !important; background-color: var(--primary-gold-dark) !important; border-color: var(--primary-gold-dark) !important; }
  .mobile-form-dock-btn--subtle { color: var(--primary-gold-dark) !important; background: linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(251,247,238,.9) 100%) !important; border: 1px solid rgba(212,175,55,.38) !important; box-shadow: 0 8px 20px rgba(31,41,55,.08), inset 0 1px 0 rgba(255,255,255,.72) !important; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
  .mobile-form-dock-btn--subtle:hover, .mobile-form-dock-btn--subtle:focus { color: var(--primary-gold-dark) !important; background: linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(249,241,221,.94) 100%) !important; border-color: rgba(212,175,55,.48) !important; }
  .editor-page--create-wizard .editor-workbench { position: relative; }
  .editor-page--create-wizard .editor-main-column, .editor-page--create-wizard .editor-side-column { position: relative; }
  .editor-page--create-wizard .editor-wizard-stage { transform-origin: top center; will-change: opacity, transform; }
  .editor-page--create-wizard .editor-wizard-section-enter-active { transition: opacity .22s ease, transform .28s cubic-bezier(.22,1,.36,1); }
  .editor-page--create-wizard .editor-wizard-section-enter-from { opacity: 0; transform: translate3d(12px,8px,0) scale(.99); }
  .editor-page--create-wizard .editor-wizard-section-leave-active { position: absolute; width: 100%; opacity: 0; pointer-events: none; transition: none; }
  .editor-page--create-wizard .editor-wizard-section-leave-to { opacity: 0; }
}
@media (max-width: 430px) {
  .editor-wizard-progress { gap: 4px; padding: 8px 6px; }
  .editor-wizard-progress__label { font-size: 10px; }
  .editor-wizard-progress__dot { width: 22px; height: 22px; font-size: 11px; }
  .editor-wizard-progress__item:not(:last-child)::after { top: 11px; left: calc(50% + 12px); }
  .mobile-form-dock-btn { min-height: 46px; font-size: 13px; }
}
@media (prefers-reduced-motion: reduce) {
  .editor-page--create-wizard .editor-wizard-section-enter-active { transition: opacity .12s ease; }
  .editor-page--create-wizard .editor-wizard-section-enter-from, .editor-page--create-wizard .editor-wizard-section-leave-to { transform: none; }
}
</style>
