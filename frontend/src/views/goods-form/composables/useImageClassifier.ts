import { ref } from 'vue'
import { classifyGoodsImage } from '@/api/goods'
import type { ClassifyResult } from '@/api/types'

export function useImageClassifier() {
  const classifying = ref(false)
  const classifyResult = ref<ClassifyResult | null>(null)
  let requestSequence = 0

  const runClassification = async (file: File) => {
    const sequence = ++requestSequence
    classifying.value = true
    classifyResult.value = null

    try {
      const result = await classifyGoodsImage(file)
      if (sequence !== requestSequence) return
      classifyResult.value = result
    } catch {
      if (sequence !== requestSequence) return
      classifyResult.value = null
    } finally {
      if (sequence === requestSequence) classifying.value = false
    }
  }

  const dismissSuggestions = () => {
    requestSequence += 1
    classifying.value = false
    classifyResult.value = null
  }

  return {
    classifying,
    classifyResult,
    runClassification,
    dismissSuggestions,
  }
}
