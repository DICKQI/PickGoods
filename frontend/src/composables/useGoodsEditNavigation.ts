import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useGoodsDetailStore } from '@/stores/goodsDetail'

export type GoodsEditRouteName = 'GoodsEdit' | 'AdminGoodsEdit'

let goodsEditComponentPromise: Promise<unknown> | null = null

const prefetchGoodsEditComponent = () => {
  if (!goodsEditComponentPromise) {
    goodsEditComponentPromise = import('@/views/GoodsForm.vue').catch((error) => {
      goodsEditComponentPromise = null
      throw error
    })
  }
  return goodsEditComponentPromise
}

export function useGoodsEditNavigation() {
  const router = useRouter()
  const detailStore = useGoodsDetailStore()
  const preparingIds = ref<Set<string>>(new Set())
  let navigationSequence = 0

  const isPreparing = (id: string | null | undefined) =>
    Boolean(id && preparingIds.value.has(id))

  const setPreparing = (id: string, preparing: boolean) => {
    const next = new Set(preparingIds.value)
    if (preparing) next.add(id)
    else next.delete(id)
    preparingIds.value = next
  }

  const prefetchGoodsEdit = (id: string | null | undefined) => {
    void prefetchGoodsEditComponent().catch(() => undefined)
    if (!id || detailStore.isGoodsDetailFresh(id)) return
    void detailStore.prefetchGoodsDetail(id).catch(() => undefined)
  }

  const openGoodsEdit = async (
    id: string | null | undefined,
    routeName: GoodsEditRouteName = 'GoodsEdit',
  ) => {
    if (!id || isPreparing(id)) return false

    const sequence = ++navigationSequence
    setPreparing(id, true)
    try {
      void prefetchGoodsEditComponent().catch(() => undefined)
      await detailStore.ensureGoodsDetail(id, { silent: true })
      if (sequence !== navigationSequence) return false
      await router.push({ name: routeName, params: { id } })
      return true
    } catch (err: any) {
      ElMessage.error(err?.response?.data?.detail || err?.message || '加载谷子详情失败，请重试')
      return false
    } finally {
      setPreparing(id, false)
    }
  }

  onUnmounted(() => {
    navigationSequence += 1
  })

  return {
    isPreparing,
    prefetchGoodsEdit,
    openGoodsEdit,
  }
}
