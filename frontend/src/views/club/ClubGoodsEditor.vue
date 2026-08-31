<template>
  <section v-loading="loading" class="editor-page">
    <header class="editor-header">
      <div>
        <el-button text @click="router.push('/club/goods')"><el-icon><ArrowLeft /></el-icon>返回社团谷子</el-button>
        <h2>{{ isEdit ? '编辑社团谷子' : '新增社团谷子' }}</h2>
        <p>社团谷子只维护公开目录信息和上架状态。</p>
      </div>
      <div class="editor-actions">
        <el-button @click="save('draft')">保存草稿</el-button>
        <el-button type="primary" @click="savePrimary"><el-icon><Check /></el-icon>{{ form.publication_status === 'draft' ? '保存并上架' : '保存' }}</el-button>
      </div>
    </header>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="editor-form">
      <el-form-item label="谷子名称" prop="name"><el-input v-model="form.name" maxlength="200" /></el-form-item>
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12">
          <el-form-item label="IP作品" prop="ip_id">
            <el-select v-model="form.ip_id" filterable placeholder="选择 IP" style="width: 100%" @change="loadCharacters">
              <el-option v-for="ip in metadata.ips" :key="ip.id" :label="ip.name" :value="ip.id" />
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
      </el-row>
      <el-form-item label="角色" prop="character_ids">
        <el-select v-model="form.character_ids" filterable multiple placeholder="选择角色" style="width: 100%" :disabled="!form.ip_id">
          <el-option v-for="character in characters" :key="character.id" :label="character.name" :value="character.id" />
        </el-select>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12">
          <el-form-item label="主题"><el-select v-model="form.theme_id" filterable clearable placeholder="选择主题" style="width: 100%">
            <el-option v-for="theme in metadata.themes" :key="theme.id" :label="theme.name" :value="theme.id" />
          </el-select></el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="发布状态" prop="publication_status"><el-select v-model="form.publication_status" style="width: 100%">
            <el-option label="草稿" value="draft" /><el-option label="上架" value="listed" /><el-option label="下架" value="unlisted" />
          </el-select></el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12"><el-form-item label="公开价格"><el-input v-model="form.public_price" placeholder="可选" /></el-form-item></el-col>
      </el-row>
      <el-form-item label="公开说明"><el-input v-model="form.description" type="textarea" :rows="4" maxlength="2000" show-word-limit /></el-form-item>
      <el-row :gutter="16" class="media-row">
        <el-col :xs="24" :sm="12"><el-form-item label="主图"><el-upload v-model:file-list="mainPhotoList" list-type="picture-card" :auto-upload="false" :limit="1" accept="image/*" :on-change="handleMainPhotoChange" :on-exceed="handleMainPhotoExceed" :on-remove="handleMainPhotoRemove"><el-icon><Plus /></el-icon></el-upload></el-form-item></el-col>
        <el-col :xs="24" :sm="12"><el-form-item label="附加图片"><el-upload v-model:file-list="additionalPhotoList" list-type="picture-card" :auto-upload="false" multiple accept="image/*" :on-change="handleAdditionalPhotoChange" :on-remove="handleAdditionalPhotoRemove"><el-icon><Plus /></el-icon></el-upload></el-form-item></el-col>
      </el-row>
    </el-form>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
})
const mainPhotoFile = ref<File | null>(null)
const mainPhotoList = ref<UploadFile[]>([])
const additionalPhotoFiles = ref<File[]>([])
const additionalPhotoList = ref<UploadFile[]>([])
const removedAdditionalPhotoIds = ref<number[]>([])

const rules: FormRules = {
  name: [{ required: true, message: '请输入谷子名称', trigger: 'blur' }],
  ip_id: [{ required: true, message: '请选择 IP', trigger: 'change' }],
  category_id: [{ required: true, message: '请选择品类', trigger: 'change' }],
  character_ids: [{ validator: (_rule, value, callback) => {
    if (form.publication_status === 'listed' && (!Array.isArray(value) || value.length === 0)) callback(new Error('上架时至少选择一个角色'))
    else callback()
  }, trigger: 'change' }],
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
    })
    characters.value = await metadata.fetchIPCharacters(item.ip.id)
    if (item.main_photo) mainPhotoList.value = [{ name: '主图', url: item.main_photo, status: 'success', uid: -1 }]
    additionalPhotoList.value = item.additional_photos.map(photo => ({ name: photo.label || '附加图片', url: photo.image, status: 'success', uid: photo.id }))
  } finally { loading.value = false }
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

async function save(publicationStatus: ClubPublicationStatus) {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const data: ClubCatalogInput = {
      name: form.name, description: form.description, ip_id: form.ip_id!, category_id: form.category_id!,
      character_ids: form.character_ids, theme_id: form.theme_id, public_price: form.public_price || null,
      publication_status: publicationStatus, main_photo: mainPhotoFile.value,
    }
    const item = isEdit.value ? await updateClubGoods(String(route.params.id), data) : await createClubGoods(data)
    const id = String(item.id)
    if (mainPhotoFile.value) await uploadClubGoodsMainPhoto(id, mainPhotoFile.value)
    if (additionalPhotoFiles.value.length) await uploadClubGoodsAdditionalPhotos(id, additionalPhotoFiles.value)
    for (const photoId of removedAdditionalPhotoIds.value) await deleteClubGoodsAdditionalPhoto(id, photoId)
    ElMessage.success(publicationStatus === 'draft' ? '草稿已保存' : '社团谷子已保存')
    router.push('/club/goods')
  } finally { loading.value = false }
}

onMounted(load)
onUnmounted(() => { const url = mainPhotoList.value[0]?.url; if (url?.startsWith('blob:')) URL.revokeObjectURL(url) })
</script>

<style scoped>
.editor-page { padding: 20px; border: 1px solid var(--border-color); border-radius: var(--card-radius); background: var(--bg-white); }
.editor-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 24px; }
.editor-header h2 { margin: 12px 0 5px; font-size: var(--font-section); }
.editor-header p { margin: 0; color: var(--text-light); font-size: var(--font-caption); }
.editor-actions { display: flex; gap: 8px; }
.editor-form { max-width: 820px; }
.media-row :deep(.el-upload-list--picture-card), .media-row :deep(.el-upload--picture-card) { --el-upload-picture-card-size: 96px; }
@media (max-width: 768px) { .editor-page { padding: 16px; } .editor-header { align-items: stretch; flex-direction: column; } .editor-actions { width: 100%; } .editor-actions .el-button { flex: 1; } }
</style>
