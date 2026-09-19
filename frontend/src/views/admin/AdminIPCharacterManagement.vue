<template>
  <div class="admin-page">
    <AdminPageHeader title="IP 与角色" subtitle="维护作品关键词、BGM 关联和角色档案。">
      <el-button :loading="exporting" @click="handleExport">
        <el-icon><Download /></el-icon>
        导出
      </el-button>
      <el-button type="primary" @click="activeTab === 'ips' ? openIPDialog() : openCharacterDialog()">
        <el-icon><Plus /></el-icon>
        {{ activeTab === 'ips' ? '新增 IP' : '新增角色' }}
      </el-button>
    </AdminPageHeader>

    <el-tabs v-model="activeTab" class="admin-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="IP 作品" name="ips">
        <el-card class="admin-search-card" shadow="never">
          <div class="admin-search-flex">
            <el-input
              v-model="ipFilters.search"
              class="search-input"
              clearable
              placeholder="搜索作品名或关键词"
              @clear="handleIPSearch"
              @keyup.enter="handleIPSearch"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-select v-model="ipFilters.subject_type" clearable placeholder="作品类型" @change="handleIPSearch">
              <el-option
                v-for="item in subjectTypes"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select v-model="ipFilters.is_bgm_bound" clearable placeholder="BGM 关联" @change="handleIPSearch">
              <el-option label="已绑定" :value="true" />
              <el-option label="未绑定" :value="false" />
            </el-select>
            <el-select v-model="ipFilters.has_characters" clearable placeholder="角色状态" @change="handleIPSearch">
              <el-option label="有角色" :value="true" />
              <el-option label="无角色" :value="false" />
            </el-select>
            <el-button type="primary" @click="handleIPSearch">查询</el-button>
            <el-button @click="resetIPFilters">重置</el-button>
          </div>
        </el-card>

        <div v-loading="ipLoading" class="content-body">
          <div class="admin-table-wrapper">
            <el-table :data="ipList" row-key="id" @sort-change="handleIPSort">
              <el-table-column prop="name" label="作品名" min-width="200" sortable="custom">
                <template #default="{ row }">
                  <strong>{{ row.name }}</strong>
                  <div class="tag-line">
                    <el-tag
                      v-for="keyword in row.keywords?.slice(0, 4)"
                      :key="keyword.id"
                      size="small"
                      effect="plain"
                    >
                      {{ keyword.value }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="类型" width="120">
                <template #default="{ row }">{{ subjectTypeLabel(row.subject_type) }}</template>
              </el-table-column>
              <el-table-column prop="character_count" label="角色数" width="90" align="center" sortable="custom" />
              <el-table-column prop="goods_count" label="谷子数" width="90" align="center" sortable="custom" />
              <el-table-column label="BGM" min-width="150">
                <template #default="{ row }">
                  <el-tag v-if="row.bgm_subject_id" type="success" effect="plain" size="small">
                    #{{ row.bgm_subject_id }}
                  </el-tag>
                  <span v-else class="admin-muted">未绑定</span>
                </template>
              </el-table-column>
              <el-table-column label="最近同步" width="180">
                <template #default="{ row }">{{ formatDateTime(row.last_synced_at) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="220" fixed="right" align="right">
                <template #default="{ row }">
                  <div class="admin-action-inline">
                    <el-button link type="primary" @click="openIPDetail(row)">详情</el-button>
                    <el-button link type="primary" @click="openIPDialog(row)">编辑</el-button>
                    <el-button link type="success" @click="startBGMSync(row)">BGM 同步</el-button>
                    <el-button link type="danger" @click="removeIP(row)">删除</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div class="admin-pagination">
            <el-pagination
              v-model:current-page="ipPage"
              v-model:page-size="ipPageSize"
              :page-sizes="[20, 50, 100]"
              :total="ipTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleIPSize"
              @current-change="loadIPs"
            />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="角色" name="characters">
        <el-card class="admin-search-card" shadow="never">
          <div class="admin-search-flex">
            <el-input
              v-model="characterFilters.search"
              class="search-input"
              clearable
              placeholder="搜索角色名或 IP"
              @clear="handleCharacterSearch"
              @keyup.enter="handleCharacterSearch"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-select
              v-model="characterFilters.ip"
              clearable
              filterable
              remote
              :remote-method="searchIPOptions"
              placeholder="所属 IP"
              @change="handleCharacterSearch"
            >
              <el-option
                v-for="ip in ipOptions"
                :key="ip.id"
                :label="ip.name"
                :value="ip.id"
              />
            </el-select>
            <el-select v-model="characterFilters.gender" clearable placeholder="性别" @change="handleCharacterSearch">
              <el-option label="男" value="male" />
              <el-option label="女" value="female" />
              <el-option label="其他" value="other" />
            </el-select>
            <el-select v-model="characterFilters.is_bgm_bound" clearable placeholder="BGM 关联" @change="handleCharacterSearch">
              <el-option label="已绑定" :value="true" />
              <el-option label="未绑定" :value="false" />
            </el-select>
            <el-button type="primary" @click="handleCharacterSearch">查询</el-button>
            <el-button @click="resetCharacterFilters">重置</el-button>
          </div>
        </el-card>

        <div v-loading="characterLoading" class="content-body">
          <div class="admin-table-wrapper">
            <el-table :data="characterList" row-key="id" @sort-change="handleCharacterSort">
              <el-table-column label="角色" min-width="200">
                <template #default="{ row }">
                  <div class="character-cell">
                    <el-avatar :size="36" :src="row.avatar || undefined" shape="square">
                      {{ row.name.slice(0, 1) }}
                    </el-avatar>
                    <div>
                      <strong>{{ row.name }}</strong>
                      <small>ID {{ row.id }}</small>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="所属 IP" min-width="180">
                <template #default="{ row }">{{ row.ip?.name }}</template>
              </el-table-column>
              <el-table-column label="性别" width="90">
                <template #default="{ row }">{{ genderLabel(row.gender) }}</template>
              </el-table-column>
              <el-table-column label="BGM 角色" width="140">
                <template #default="{ row }">
                  <code v-if="row.bgm_character_id">#{{ row.bgm_character_id }}</code>
                  <span v-else class="admin-muted">未绑定</span>
                </template>
              </el-table-column>
              <el-table-column prop="created_at" label="创建时间" width="180" sortable="custom">
                <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="150" fixed="right" align="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openCharacterDialog(row)">编辑</el-button>
                  <el-button link type="danger" @click="removeCharacter(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div class="admin-pagination">
            <el-pagination
              v-model:current-page="characterPage"
              v-model:page-size="characterPageSize"
              :page-sizes="[20, 50, 100]"
              :total="characterTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleCharacterSize"
              @current-change="loadCharacters"
            />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="ipDialogVisible" :title="ipForm.id ? '编辑 IP' : '新增 IP'" width="min(92vw, 520px)">
      <el-form ref="ipFormRef" :model="ipForm" :rules="ipRules" label-position="top">
        <el-form-item label="作品名称" prop="name">
          <el-input v-model="ipForm.name" maxlength="100" />
        </el-form-item>
        <el-form-item label="作品类型">
          <el-select v-model="ipForm.subject_type" clearable style="width: 100%">
            <el-option v-for="item in subjectTypes" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-select
            v-model="ipForm.keywords"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入后回车添加"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="排序值">
          <el-input-number v-model="ipForm.order" :step="10" controls-position="right" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ipDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveIP">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="characterDialogVisible"
      :title="characterForm.id ? '编辑角色' : '新增角色'"
      width="min(92vw, 520px)"
    >
      <el-form ref="characterFormRef" :model="characterForm" :rules="characterRules" label-position="top">
        <el-form-item label="角色名" prop="name">
          <el-input v-model="characterForm.name" maxlength="100" />
        </el-form-item>
        <el-form-item label="所属 IP" prop="ip_id">
          <el-select
            v-model="characterForm.ip_id"
            filterable
            remote
            :remote-method="searchIPOptions"
            placeholder="搜索并选择 IP"
            style="width: 100%"
          >
            <el-option v-for="ip in ipOptions" :key="ip.id" :label="ip.name" :value="ip.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="characterForm.gender">
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
            <el-radio value="other">其他</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="头像">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept="image/*"
            :on-change="handleAvatarChange"
            :on-remove="() => (avatarFile = null)"
          >
            <el-button>选择图片</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="characterDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveCharacter">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="ipDetailVisible"
      class="admin-detail-drawer"
      title="IP 详情"
      size="min(92vw, 560px)"
      destroy-on-close
    >
      <div v-if="selectedIP" class="ip-detail">
        <h3>{{ selectedIP.name }}</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="作品类型">{{ subjectTypeLabel(selectedIP.subject_type) }}</el-descriptions-item>
          <el-descriptions-item label="关键词">
            {{ selectedIP.keywords?.map((item) => item.value).join('、') || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="BGM ID">{{ selectedIP.bgm_subject_id || '未绑定' }}</el-descriptions-item>
          <el-descriptions-item label="最近同步">{{ formatDateTime(selectedIP.last_synced_at) }}</el-descriptions-item>
        </el-descriptions>
        <section class="ip-detail__characters">
          <h4>角色列表（{{ ipCharacters.length }}）</h4>
          <div class="character-chip-grid">
            <span v-for="character in ipCharacters" :key="character.id">
              {{ character.name }}
            </span>
          </div>
        </section>
      </div>
    </el-drawer>

    <el-dialog v-model="bgmDialogVisible" title="从 BGM 同步角色" width="min(94vw, 760px)">
      <el-steps :active="bgmStep" simple>
        <el-step title="绑定作品" />
        <el-step title="预览差异" />
        <el-step title="应用更新" />
      </el-steps>
      <div class="bgm-panel">
        <template v-if="!bgmPreview">
          <p class="bgm-copy">
            当前 IP：<strong>{{ bgmIP?.name }}</strong>
            <span v-if="bgmIP?.bgm_subject_id">（BGM #{{ bgmIP.bgm_subject_id }}）</span>
          </p>
          <el-form label-position="top">
            <el-form-item label="搜索 Bangumi 作品">
              <el-input v-model="bgmKeyword" placeholder="输入作品名后搜索" @keyup.enter="searchSubjects">
                <template #append>
                  <el-button :loading="bgmLoading" @click="searchSubjects">搜索</el-button>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item v-if="bgmSubjects.length" label="选择作品">
              <el-select v-model="bgmSubjectId" filterable style="width: 100%">
                <el-option
                  v-for="subject in bgmSubjects"
                  :key="subject.id"
                  :label="`${subject.name} · ${subjectTypeLabel(subject.type)}`"
                  :value="subject.id"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <el-button
            type="primary"
            :disabled="!bgmIP?.bgm_subject_id && !bgmSubjectId"
            :loading="bgmLoading"
            @click="previewSync"
          >
            预览差异
          </el-button>
        </template>

        <template v-else>
          <div class="bgm-summary">
            <span>新增 <strong>{{ bgmPreview.summary.new || 0 }}</strong></span>
            <span>回填 <strong>{{ bgmPreview.summary.link_by_name || 0 }}</strong></span>
            <span>已关联 <strong>{{ bgmPreview.summary.matched || 0 }}</strong></span>
            <span>本地独有 <strong>{{ bgmPreview.summary.local_only || 0 }}</strong></span>
          </div>
          <el-table :data="bgmPreview.items" max-height="360">
            <el-table-column prop="name" label="角色" min-width="160" />
            <el-table-column label="动作" width="120">
              <template #default="{ row }">{{ bgmActionLabel(row.action) }}</template>
            </el-table-column>
            <el-table-column prop="relation" label="关系" min-width="140" />
          </el-table>
        </template>
      </div>
      <template #footer>
        <el-button @click="closeBGMDialog">取消</el-button>
        <el-button
          v-if="bgmPreview"
          type="primary"
          :loading="bgmApplying"
          @click="applySync"
        >
          应用更新
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { FormInstance, FormRules, UploadFile } from 'element-plus'
import { Download, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  exportAdminResource,
  getAdminCharacters,
  getAdminIPs,
  type AdminCharacterListParams,
  type AdminIPListParams,
} from '@/api/admin'
import {
  applyBGMSync,
  createCharacter,
  createIP,
  deleteCharacter,
  deleteIP,
  getIPCharacters,
  getIPDetail,
  previewBGMSync,
  searchBGMSubjects,
  updateCharacter,
  updateIP,
} from '@/api/metadata'
import type {
  AdminCharacterListItem,
  AdminIPListItem,
  BGMSyncApplyItem,
  BGMSyncPreviewResponse,
  BGMSubject,
  CharacterGender,
  IP,
} from '@/api/types'
import { downloadBlob } from '@/utils/download'
import { formatDateTime } from '@/utils/datetime'
import { createLatestRequestGuard } from '@/composables/useLatestRequest'
import AdminPageHeader from './components/AdminPageHeader.vue'

const route = useRoute()
const activeTab = ref<'ips' | 'characters'>(
  route.query.tab === 'characters' ? 'characters' : 'ips',
)
const exporting = ref(false)
const submitting = ref(false)
const ipLoading = ref(false)
const characterLoading = ref(false)
const ipList = ref<AdminIPListItem[]>([])
const characterList = ref<AdminCharacterListItem[]>([])
const ipListRequests = createLatestRequestGuard()
const characterListRequests = createLatestRequestGuard()
const ipOptions = ref<AdminIPListItem[]>([])
const ipTotal = ref(0)
const characterTotal = ref(0)
const ipPage = ref(1)
const characterPage = ref(1)
const ipPageSize = ref(20)
const characterPageSize = ref(20)
const ipOrdering = ref<string>()
const characterOrdering = ref<string>()
const ipDialogVisible = ref(false)
const characterDialogVisible = ref(false)
const ipDetailVisible = ref(false)
const selectedIP = ref<IP | null>(null)
const ipCharacters = ref<AdminCharacterListItem[]>([])
const ipFormRef = ref<FormInstance>()
const characterFormRef = ref<FormInstance>()
const avatarFile = ref<File | null>(null)
const bgmDialogVisible = ref(false)
const bgmIP = ref<AdminIPListItem | null>(null)
const bgmKeyword = ref('')
const bgmSubjectId = ref<number | null>(null)
const bgmSubjects = ref<BGMSubject[]>([])
const bgmPreview = ref<BGMSyncPreviewResponse | null>(null)
const bgmLoading = ref(false)
const bgmApplying = ref(false)
const bgmStep = computed(() =>
  bgmPreview.value ? 2 : bgmSubjectId.value ? 1 : 0,
)

const subjectTypes = [
  { value: 1, label: '书籍' },
  { value: 2, label: '动画' },
  { value: 3, label: '音乐' },
  { value: 4, label: '游戏' },
  { value: 6, label: '三次元/特摄' },
]

const ipFilters = reactive<AdminIPListParams>({
  search: '',
  subject_type: undefined,
  is_bgm_bound: undefined,
  has_characters: undefined,
})
const characterFilters = reactive<AdminCharacterListParams>({
  search: '',
  ip: undefined,
  gender: undefined,
  is_bgm_bound: undefined,
})
const ipForm = reactive<{
  id?: number
  name: string
  subject_type: number | null
  keywords: string[]
  order: number
}>({ name: '', subject_type: null, keywords: [], order: 0 })
const characterForm = reactive<{
  id?: number
  name: string
  ip_id: number | null
  gender: CharacterGender
}>({ name: '', ip_id: null, gender: 'other' })
const ipRules: FormRules = {
  name: [{ required: true, message: '请输入作品名称', trigger: 'blur' }],
}
const characterRules: FormRules = {
  name: [{ required: true, message: '请输入角色名', trigger: 'blur' }],
  ip_id: [{ required: true, message: '请选择所属 IP', trigger: 'change' }],
}

async function loadIPs() {
  const requestSequence = ipListRequests.next()
  ipLoading.value = true
  try {
    const response = await getAdminIPs({
      ...ipFilters,
      page: ipPage.value,
      page_size: ipPageSize.value,
      ordering: ipOrdering.value,
      search: ipFilters.search || undefined,
    })
    if (!ipListRequests.isLatest(requestSequence)) return
    ipList.value = response.results
    ipTotal.value = response.count
  } finally {
    if (ipListRequests.isLatest(requestSequence)) ipLoading.value = false
  }
}

async function loadCharacters() {
  const requestSequence = characterListRequests.next()
  characterLoading.value = true
  try {
    const response = await getAdminCharacters({
      ...characterFilters,
      page: characterPage.value,
      page_size: characterPageSize.value,
      ordering: characterOrdering.value,
      search: characterFilters.search || undefined,
    })
    if (!characterListRequests.isLatest(requestSequence)) return
    characterList.value = response.results
    characterTotal.value = response.count
  } finally {
    if (characterListRequests.isLatest(requestSequence)) {
      characterLoading.value = false
    }
  }
}

async function searchIPOptions(query: string) {
  ipOptions.value = (
    await getAdminIPs({ search: query || undefined, page_size: 50 })
  ).results
}

function handleIPSearch() {
  ipPage.value = 1
  void loadIPs()
}

function handleCharacterSearch() {
  characterPage.value = 1
  void loadCharacters()
}

function handleIPSize() {
  ipPage.value = 1
  void loadIPs()
}

function handleCharacterSize() {
  characterPage.value = 1
  void loadCharacters()
}

function handleIPSort({ prop, order }: { prop: string; order: string | null }) {
  ipOrdering.value = order ? `${order === 'ascending' ? '' : '-'}${prop}` : undefined
  handleIPSearch()
}

function handleCharacterSort({ prop, order }: { prop: string; order: string | null }) {
  characterOrdering.value = order ? `${order === 'ascending' ? '' : '-'}${prop}` : undefined
  handleCharacterSearch()
}

function handleTabChange() {
  if (activeTab.value === 'ips' && ipList.value.length === 0) void loadIPs()
  if (activeTab.value === 'characters' && characterList.value.length === 0) void loadCharacters()
}

function resetIPFilters() {
  Object.assign(ipFilters, {
    search: '',
    subject_type: undefined,
    is_bgm_bound: undefined,
    has_characters: undefined,
  })
  handleIPSearch()
}

function resetCharacterFilters() {
  Object.assign(characterFilters, {
    search: '',
    ip: undefined,
    gender: undefined,
    is_bgm_bound: undefined,
  })
  handleCharacterSearch()
}

async function openIPDialog(row?: AdminIPListItem) {
  if (row) {
    const detail = await getIPDetail(row.id)
    Object.assign(ipForm, {
      id: detail.id,
      name: detail.name,
      subject_type: detail.subject_type ?? null,
      keywords: detail.keywords?.map((item) => item.value) || [],
      order: detail.order || 0,
    })
  } else {
    Object.assign(ipForm, {
      id: undefined,
      name: '',
      subject_type: null,
      keywords: [],
      order: 0,
    })
  }
  ipDialogVisible.value = true
}

function openCharacterDialog(row?: AdminCharacterListItem) {
  Object.assign(characterForm, row
    ? {
        id: row.id,
        name: row.name,
        ip_id: row.ip.id,
        gender: row.gender,
      }
    : {
        id: undefined,
        name: '',
        ip_id: null,
        gender: 'other',
      })
  avatarFile.value = null
  characterDialogVisible.value = true
}

async function saveIP() {
  const valid = await ipFormRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload = {
      name: ipForm.name.trim(),
      subject_type: ipForm.subject_type,
      keywords: ipForm.keywords,
      order: ipForm.order,
    }
    if (ipForm.id) await updateIP(ipForm.id, payload)
    else await createIP(payload)
    ipDialogVisible.value = false
    ElMessage.success('IP 已保存')
    await Promise.all([loadIPs(), searchIPOptions('')])
  } finally {
    submitting.value = false
  }
}

async function saveCharacter() {
  const valid = await characterFormRef.value?.validate().catch(() => false)
  if (!valid || !characterForm.ip_id) return
  submitting.value = true
  try {
    const data = new FormData()
    data.append('name', characterForm.name.trim())
    data.append('ip_id', String(characterForm.ip_id))
    data.append('gender', characterForm.gender)
    if (avatarFile.value) data.append('avatar', avatarFile.value)
    if (characterForm.id) await updateCharacter(characterForm.id, data)
    else await createCharacter(data)
    characterDialogVisible.value = false
    ElMessage.success('角色已保存')
    await loadCharacters()
  } finally {
    submitting.value = false
  }
}

function handleAvatarChange(file: UploadFile) {
  avatarFile.value = file.raw || null
}

async function openIPDetail(row: AdminIPListItem) {
  selectedIP.value = await getIPDetail(row.id)
  ipCharacters.value = (await getIPCharacters(row.id)) as AdminCharacterListItem[]
  ipDetailVisible.value = true
}

async function removeIP(row: AdminIPListItem) {
  await ElMessageBox.confirm(
    `删除 IP “${row.name}”会受关联谷子和角色保护，确认继续？`,
    '删除 IP',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
  )
  await deleteIP(row.id)
  ElMessage.success('IP 已删除')
  await loadIPs()
}

async function removeCharacter(row: AdminCharacterListItem) {
  await ElMessageBox.confirm(`确认删除角色“${row.name}”吗？`, '删除角色', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
  await deleteCharacter(row.id)
  ElMessage.success('角色已删除')
  await loadCharacters()
}

function startBGMSync(row: AdminIPListItem) {
  bgmIP.value = row
  bgmKeyword.value = row.name
  bgmSubjectId.value = row.bgm_subject_id || null
  bgmSubjects.value = []
  bgmPreview.value = null
  bgmDialogVisible.value = true
}

async function searchSubjects() {
  if (!bgmKeyword.value.trim()) return
  bgmLoading.value = true
  try {
    const response = await searchBGMSubjects(
      bgmKeyword.value.trim(),
      bgmIP.value?.subject_type || undefined,
    )
    bgmSubjects.value = response.subjects
  } finally {
    bgmLoading.value = false
  }
}

async function previewSync() {
  if (!bgmIP.value) return
  bgmLoading.value = true
  try {
    bgmPreview.value = await previewBGMSync(
      bgmIP.value.id,
      bgmSubjectId.value,
    )
  } finally {
    bgmLoading.value = false
  }
}

async function applySync() {
  if (!bgmIP.value || !bgmPreview.value) return
  bgmApplying.value = true
  try {
    const items: BGMSyncApplyItem[] = bgmPreview.value.items
      .filter((item) => item.action === 'new' || item.action === 'link_by_name')
      .map((item) => ({
        action: item.action as 'new' | 'link_by_name',
        bgm_character_id: item.bgm_character_id,
        name: item.name,
        avatar: item.avatar,
        local_character_id: item.local_character_id,
      }))
    await applyBGMSync(bgmIP.value.id, items, {
      subjectId: bgmSubjectId.value,
      updateSubjectType: bgmPreview.value.subject_type_will_update,
    })
    ElMessage.success('BGM 角色已同步')
    closeBGMDialog()
    await Promise.all([loadIPs(), loadCharacters()])
  } finally {
    bgmApplying.value = false
  }
}

function closeBGMDialog() {
  bgmDialogVisible.value = false
  bgmPreview.value = null
}

async function handleExport() {
  exporting.value = true
  try {
    const blob = await exportAdminResource(
      activeTab.value === 'ips' ? 'ips' : 'characters',
      activeTab.value === 'ips'
        ? {
            ...ipFilters,
            search: ipFilters.search || undefined,
            ordering: ipOrdering.value,
          }
        : {
            ...characterFilters,
            search: characterFilters.search || undefined,
            ordering: characterOrdering.value,
          },
    )
    downloadBlob(blob, `admin-${activeTab.value}-${Date.now()}.csv`)
    ElMessage.success('导出已开始')
  } finally {
    exporting.value = false
  }
}

function subjectTypeLabel(value?: number | null) {
  return subjectTypes.find((item) => item.value === value)?.label || '未设置'
}

function genderLabel(value: CharacterGender) {
  return { male: '男', female: '女', other: '其他' }[value]
}

function bgmActionLabel(value: string) {
  return {
    new: '新增',
    link_by_name: '按名称回填',
    matched: '已关联',
    local_only: '本地独有',
    skipped_duplicate: '重复跳过',
  }[value] || value
}

onMounted(() => {
  const initialLoad = activeTab.value === 'characters'
    ? Promise.all([loadCharacters(), searchIPOptions('')])
    : Promise.all([loadIPs(), searchIPOptions('')])
  void initialLoad
})

watch(
  () => route.query.tab,
  (tab) => {
    const nextTab = tab === 'characters' ? 'characters' : 'ips'
    if (activeTab.value === nextTab) return
    activeTab.value = nextTab
    if (nextTab === 'characters' && characterList.value.length === 0) {
      void loadCharacters()
    } else if (nextTab === 'ips' && ipList.value.length === 0) {
      void loadIPs()
    }
  },
)
</script>

<style scoped>
.search-input {
  width: min(280px, 100%);
}

.admin-search-flex :deep(.el-select) {
  width: 150px;
}

.content-body {
  min-height: 320px;
}

.tag-line {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.character-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.character-cell > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.character-cell small {
  color: #9099a6;
  font-size: 11px;
}

.ip-detail {
  padding: 20px;
}

.ip-detail h3 {
  margin: 0 0 16px;
  font-size: 20px;
}

.ip-detail__characters {
  margin-top: 20px;
}

.ip-detail__characters h4 {
  margin: 0 0 10px;
  font-size: 14px;
}

.character-chip-grid {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}

.character-chip-grid span {
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fafbfc;
  color: #4b5563;
  font-size: 12px;
  padding: 5px 9px;
}

.bgm-panel {
  min-height: 260px;
  padding-top: 20px;
}

.bgm-copy {
  margin: 0 0 16px;
  color: #606a78;
}

.bgm-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}

.bgm-summary span {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafbfc;
  color: #606a78;
  font-size: 12px;
  padding: 10px;
  text-align: center;
}

.bgm-summary strong {
  color: #303846;
}

@media (max-width: 768px) {
  .admin-search-flex :deep(.el-select),
  .search-input {
    width: 100%;
  }

  .bgm-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
