<template>
  <div v-loading="loading" class="editor-page">
    <header class="editor-header">
      <div class="editor-title-block">
        <el-button text class="editor-back" @click="router.push('/club/goods')"><el-icon><ArrowLeft /></el-icon>返回社团谷子</el-button>
        <h2>{{ isEdit ? '编辑社团谷子' : '新增社团谷子' }}</h2>
        <p>名称、图片和上架状态，都在这里好好整理吧~</p>
      </div>
    </header>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="editor-form">
      <div class="editor-workbench">
        <div class="editor-main-column">
          <section class="form-section form-section--basic">
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
                <el-form-item label="主题"><el-select v-model="form.theme_id" filterable clearable placeholder="选择或创建主题" style="width: 100%">
                  <el-option v-for="theme in metadata.themes" :key="theme.id" :label="theme.name" :value="theme.id" />
                </el-select></el-form-item>
              </el-col>
            </el-row>
          </section>

          <section class="form-section form-section--publish">
            <div class="form-section-header">
              <span class="form-section-header-bar" aria-hidden="true"></span>
              <div><h3>发布设置</h3><p>决定谁能看见它，再定好公开价格吧~</p></div>
            </div>
            <el-row :gutter="20">
              <el-col :xs="24" :sm="14">
                <el-form-item label="状态" prop="publication_status">
                  <el-radio-group v-model="form.publication_status" class="status-segmented">
                    <el-radio-button value="draft">草稿</el-radio-button>
                    <el-radio-button value="listed">已上架</el-radio-button>
                    <el-radio-button value="unlisted">已下架</el-radio-button>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="10"><el-form-item label="公开价格"><el-input v-model="form.public_price" placeholder="可选" /></el-form-item></el-col>
            </el-row>
            <div class="publish-schedule">
              <div class="publish-schedule__heading"><h4>定时上架</h4><span>仅草稿可设置，按北京时间执行一次</span></div>
              <el-form-item label="上架时间">
                <div class="schedule-control">
                  <input v-model="publishAtLocal" class="datetime-input" type="datetime-local" :min="minimumPublishAt" :disabled="form.publication_status !== 'draft'" @change="isDirty = true" />
                  <el-button v-if="publishAtLocal || form.publish_error" class="cancel-schedule" link type="warning" :disabled="form.publication_status !== 'draft'" @click="cancelPublishSchedule">取消计划</el-button>
                </div>
                <p class="field-help">到点后会自动从草稿变成已上架哦~ 手动改为上架或下架时，原来的计划会被清除</p>
              </el-form-item>
              <p v-if="form.publish_error" class="publish-error">上次定时上架失败：{{ form.publish_error }}（请重新设置时间）</p>
            </div>
          </section>

          <section class="form-section form-section--notes">
            <div class="form-section-header">
              <span class="form-section-header-bar" aria-hidden="true"></span>
              <div><h3>公开说明</h3><p>给来访的小伙伴留下一点补充说明吧~</p></div>
            </div>
            <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="5" maxlength="2000" show-word-limit placeholder="请输入公开说明" /></el-form-item>
          </section>
        </div>

        <aside class="editor-side-column" aria-label="图片与表单操作">
          <section class="form-section form-section--images">
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
          <div class="desktop-action-footer" aria-label="桌面端表单操作">
            <el-button class="desktop-action-button desktop-action-button--back" @click="router.push('/club/goods')"><el-icon><ArrowLeft /></el-icon>取消</el-button>
            <div class="desktop-action-primary">
              <el-button class="desktop-action-button desktop-action-button--draft" @click="save('draft')">保存草稿</el-button>
              <el-button type="primary" class="desktop-action-button desktop-action-button--publish" @click="savePrimary"><el-icon><Check /></el-icon>{{ form.publication_status === 'draft' ? '保存并上架' : '保存' }}</el-button>
            </div>
          </div>
        </aside>
      </div>
    </el-form>

    <div class="mobile-action-footer" aria-label="移动端表单操作">
      <el-button class="mobile-action-button mobile-action-button--draft" @click="save('draft')">保存草稿</el-button>
      <el-button type="primary" class="mobile-action-button mobile-action-button--publish" @click="savePrimary"><el-icon><Check /></el-icon>{{ form.publication_status === 'draft' ? '保存并上架' : '保存' }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, computed, watch } from 'vue'
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
import type { ClubCatalogInput, ClubPublicationStatus } from '@/api/types'

const route = useRoute()
const router = useRouter()
const metadata = useMetadataStore()
const formRef = ref<FormInstance>()
const loading = ref(false)
const isEdit = computed(() => Boolean(route.params.id))
const characters = ref<{ id: number; name: string }[]>([])
const form = reactive({
  name: '', description: '', ip_id: undefined as number | undefined, category_id: undefined as number | undefined,
  character_ids: [] as number[], theme_id: null as number | null, public_price: '',
  publication_status: 'draft' as ClubPublicationStatus,
  publish_error: null as string | null,
})
const mainPhotoFile = ref<File | null>(null)
const mainPhotoList = ref<UploadFile[]>([])
const additionalPhotoFiles = ref<File[]>([])
const additionalPhotoList = ref<UploadFile[]>([])
const removedAdditionalPhotoIds = ref<number[]>([])
const publishAtLocal = ref('')
const isDirty = ref(false)
const minimumPublishAt = computed(() => toDateTimeLocal(new Date(Date.now() + 60 * 1000)))

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
      public_price: item.public_price || '', publication_status: item.publication_status,
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

async function savePrimary() { await save(form.publication_status === 'draft' ? 'listed' : form.publication_status) }

function cancelPublishSchedule() {
  publishAtLocal.value = ''
  form.publish_error = null
  isDirty.value = true
}

async function save(publicationStatus: ClubPublicationStatus) {
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
.publish-schedule { margin-top: 2px; padding: 14px 14px 2px; border: 1px solid rgba(212,175,55,.2); border-radius: 12px; background: rgba(255,250,240,.58); }
.publish-schedule__heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px 10px; margin-bottom: 12px; }
.publish-schedule__heading h4 { margin: 0; color: #303133; font-size: 16px; line-height: 1.3; }
.publish-schedule__heading span, .field-help { color: var(--text-light); font-size: 12px; line-height: 1.45; }
.schedule-control { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.datetime-input { width: min(100%, 320px); height: 34px; box-sizing: border-box; padding: 0 10px; border: 1px solid #e5e5e5; border-radius: 10px; color: var(--text-regular); background: #fff; font: inherit; }
.datetime-input:focus { outline: none; border-color: var(--primary-gold); box-shadow: 0 0 0 1px rgba(195,160,80,.35); }
.field-help { margin: 6px 0 0; }
.publish-error { margin: -4px 0 14px; color: var(--el-color-danger); font-size: 12px; line-height: 1.45; }
.cancel-schedule { margin-left: 0; }
.form-section--images { background: linear-gradient(180deg, #fff 0%, #fbfbff 100%); }
.main-photo-uploader { display: block; width: min(220px, 100%); }
.main-photo-uploader :deep(.el-upload-list--picture-card) { display: flex; flex-wrap: wrap; width: 100%; }
.main-photo-uploader :deep(.el-upload--picture-card), .main-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item) { width: 100%; height: auto; aspect-ratio: 1; box-sizing: border-box; margin: 0; border-radius: 16px; border: 1px dashed #e0e3f0; background: #fafbff; }
.main-photo-uploader :deep(.el-upload-list__item-thumbnail) { object-fit: contain; background: #fff; }
.main-photo-uploader :deep(.el-icon), .additional-photo-uploader :deep(.el-icon) { color: #b1b5c6; font-size: 26px; }
.additional-photo-uploader { width: 100%; }
.additional-photo-uploader :deep(.el-upload--picture-card), .additional-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item) { width: 120px; height: 120px; margin: 0 12px 12px 0; border-radius: 12px; border: 1px dashed #e0e3f0; background: #fbfbff; }
.desktop-action-footer { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px 14px; border: 1px solid rgba(17,24,39,.06); border-radius: 14px; background: #fff; box-shadow: 0 3px 14px rgba(15,23,42,.04); }
.desktop-action-button { width: 100%; min-height: 38px; margin: 0; font-weight: 600; }
.desktop-action-button--back { color: #606266; background: rgba(255,255,255,.72); border-color: #e5e7ef; }
.desktop-action-primary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.desktop-action-button--draft { color: var(--primary-gold-dark); background: #fffaf0; border-color: rgba(212,175,55,.32); }
.desktop-action-button--publish {
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
.desktop-action-button--publish:hover,
.desktop-action-button--publish:focus {
  color: #fff !important;
  background-color: var(--primary-gold-dark) !important;
  border-color: var(--primary-gold-dark) !important;
}
.mobile-action-footer { display: none; }
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
  .main-photo-uploader :deep(.el-upload--picture-card), .main-photo-uploader :deep(.el-upload-list--picture-card .el-upload-list__item) { width: min(220px, 100%); }
  .desktop-action-footer { display: none; }
  .mobile-action-footer { position: fixed; right: 0; bottom: 0; left: 0; z-index: 999; display: flex; gap: 10px; padding: 0 16px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 0; background: transparent; box-shadow: none; pointer-events: none; }
  .mobile-action-footer::before { position: absolute; right: 0; bottom: 0; left: 0; z-index: -1; height: min(180px, 32vh); content: ''; pointer-events: none; background: linear-gradient(to top, var(--secondary-gray) 0%, rgba(245,245,247,.92) 30%, rgba(245,245,247,.55) 58%, rgba(255,255,255,0) 100%); }
  .mobile-action-button { flex: 1; min-width: 0; min-height: 44px; margin: 0; font-size: 14px; font-weight: 700; }
  .mobile-action-button { pointer-events: auto; border-radius: 999px !important; }
  .mobile-action-button--draft { color: var(--primary-gold-dark); background: #fffaf0; border-color: rgba(212,175,55,.32); }
  .mobile-action-button--publish {
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
  .mobile-action-button--publish:hover,
  .mobile-action-button--publish:focus {
    color: #fff !important;
    background-color: var(--primary-gold-dark) !important;
    border-color: var(--primary-gold-dark) !important;
  }
}
</style>
