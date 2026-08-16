import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as reminderApi from '@/api/reminder'
import { useMetadataStore } from '@/stores/metadata'
import type { Category, GoodsStatus, Preorder, PreorderConvertInput } from '@/api/types'

const buildCategoryTree = (list: Category[]) => {
  const map = new Map<number, Category & { children: Category[] }>()
  list.forEach((item) => map.set(item.id, { ...item, children: [] }))
  const roots: Category[] = []
  map.forEach((node) => {
    if (node.parent !== null && map.has(node.parent)) {
      map.get(node.parent)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortTree = (nodes: Category[]) => {
    nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
    nodes.forEach((n) => n.children && sortTree(n.children))
  }
  sortTree(roots)
  return roots
}

/** 转正为谷子表单逻辑；成功返回 true，由视图负责关闭弹层与刷新 */
export function usePreorderConvert() {
  const metadataStore = useMetadataStore()
  const convertRef = ref()
  const convertTarget = ref<Preorder | null>(null)
  const convertSubmitting = ref(false)
  const convertForm = reactive({
    name: '',
    ip: undefined as number | undefined,
    category: undefined as number | undefined,
    characters: [] as number[],
    status: 'draft' as GoodsStatus,
    theme: null as number | null,
    notes: '',
  })

  const convertRules = {
    name: [{ required: true, message: '请输入谷子名称', trigger: 'blur' }],
    ip: [{ required: true, message: '请选择IP作品', trigger: 'change' }],
    category: [{ required: true, message: '请选择品类', trigger: 'change' }],
  }

  const ipOptions = computed(() => metadataStore.ips)
  const themeOptions = computed(() => metadataStore.themes)
  const ipCharacters = computed(() =>
    convertForm.ip ? metadataStore.charactersByIP[convertForm.ip] || [] : []
  )
  const categoryTreeOptions = computed(() => buildCategoryTree(metadataStore.categories))

  const openConvert = async (item: Preorder) => {
    convertTarget.value = item
    convertForm.name = item.name
    convertForm.ip = undefined
    convertForm.category = undefined
    convertForm.characters = []
    convertForm.status = 'draft'
    convertForm.theme = null
    convertForm.notes = item.notes || ''
    nextTick(() => convertRef.value?.clearValidate())
    // 确保元数据可用
    await Promise.allSettled([
      metadataStore.fetchIPs(),
      metadataStore.fetchCategories(),
      metadataStore.fetchThemes(),
    ])
  }

  const handleConvertIpChange = () => {
    convertForm.characters = []
    if (convertForm.ip) {
      metadataStore.fetchIPCharacters(convertForm.ip)
    }
  }

  const submitConvert = async (): Promise<boolean> => {
    try {
      await convertRef.value.validate()
    } catch {
      return false
    }
    if (convertForm.status !== 'draft' && convertForm.characters.length === 0) {
      ElMessage.warning('非草稿状态至少需要关联一个角色')
      return false
    }
    if (!convertTarget.value) return false
    convertSubmitting.value = true
    try {
      const payload: PreorderConvertInput = {
        name: convertForm.name,
        ip: convertForm.ip!,
        category: convertForm.category!,
        characters: convertForm.characters,
        theme: convertForm.theme ?? null,
        status: convertForm.status,
        notes: convertForm.notes || null,
      }
      await reminderApi.convertPreorderToGoods(convertTarget.value.id, payload)
      ElMessage.success('已转正为谷子，可在谷子编辑页补充图片等信息')
      return true
    } catch {
      // 400 / 409 错误已由拦截器或全局提示展示
      return false
    } finally {
      convertSubmitting.value = false
    }
  }

  return {
    convertRef,
    convertTarget,
    convertForm,
    convertRules,
    convertSubmitting,
    ipOptions,
    themeOptions,
    ipCharacters,
    categoryTreeOptions,
    openConvert,
    handleConvertIpChange,
    submitConvert,
  }
}
