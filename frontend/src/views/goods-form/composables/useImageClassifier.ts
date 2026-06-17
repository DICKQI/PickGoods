import { ref } from 'vue'
import { classifyGoodsImage } from '@/api/goods'
import type { ClassifyResult } from '@/api/types'

export function useImageClassifier() {
  const classifying = ref(false)
  const classifyResult = ref<ClassifyResult | null>(null)
  const classifyError = ref<string | null>(null)

  const runClassification = async (file: File) => {
    classifying.value = true
    classifyError.value = null
    classifyResult.value = null

    try {
      const result = await classifyGoodsImage(file)
      classifyResult.value = result
    } catch (err: any) {
      if (err?.response?.status === 422) {
        classifyResult.value = err.response.data ?? null
      } else {
        classifyError.value = err?.message || '分类请求失败'
      }
    } finally {
      classifying.value = false
    }
  }

  const dismissSuggestions = () => {
    classifyResult.value = null
    classifyError.value = null
  }

  return {
    classifying,
    classifyResult,
    classifyError,
    runClassification,
    dismissSuggestions,
  }
}
