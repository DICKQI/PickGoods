import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyGoodsImage } from '@/api/goods'
import { useImageClassifier } from '@/views/goods-form/composables/useImageClassifier'

vi.mock('@/api/goods', () => ({
  classifyGoodsImage: vi.fn(),
}))

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const result = (name: string, shape_type: 'round' | 'square' | 'rectangle' | 'unknown') => ({
  shape_type,
  confidence: 0.9,
  suggestions: [{ id: name === 'first' ? 1 : 2, name, path_name: name }],
})

describe('useImageClassifier', () => {
  beforeEach(() => vi.mocked(classifyGoodsImage).mockReset())

  it('does not let a stale request overwrite the latest image result', async () => {
    const first = deferred<ReturnType<typeof result>>()
    const second = deferred<ReturnType<typeof result>>()
    vi.mocked(classifyGoodsImage)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const classifier = useImageClassifier()
    const firstRun = classifier.runClassification(new File(['first'], 'first.jpg'))
    const secondRun = classifier.runClassification(new File(['second'], 'second.jpg'))

    second.resolve(result('second', 'square'))
    await secondRun
    first.resolve(result('first', 'round'))
    await firstRun

    expect(classifier.classifyResult.value?.shape_type).toBe('square')
    expect(classifier.classifyResult.value?.suggestions[0]?.name).toBe('second')
    expect(classifier.classifying.value).toBe(false)
  })

  it('invalidates an in-flight request when suggestions are dismissed', async () => {
    const pending = deferred<ReturnType<typeof result>>()
    vi.mocked(classifyGoodsImage).mockReturnValueOnce(pending.promise)

    const classifier = useImageClassifier()
    const run = classifier.runClassification(new File(['image'], 'image.jpg'))
    classifier.dismissSuggestions()
    pending.resolve(result('late', 'round'))
    await run

    expect(classifier.classifyResult.value).toBeNull()
    expect(classifier.classifyError.value).toBeNull()
    expect(classifier.classifying.value).toBe(false)
  })
})
