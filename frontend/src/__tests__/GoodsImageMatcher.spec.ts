import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import GoodsImageMatcher from '@/components/GoodsImageMatcher.vue'
import type { GoodsImageMatchResult, GoodsListItem } from '@/api/types'

const matchGoodsImageMock = vi.hoisted(() => vi.fn())
const submitFeedbackMock = vi.hoisted(() => vi.fn())
const componentSource = readFileSync(
  resolve(process.cwd(), 'src/components/GoodsImageMatcher.vue'),
  'utf8',
)

vi.mock('@/api/goods', () => ({
  matchGoodsImage: matchGoodsImageMock,
  submitGoodsImageMatchFeedback: submitFeedbackMock,
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}))

vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: vi.fn(),
  },
  CameraSource: {
    Camera: 'camera',
    Photos: 'photos',
  },
  CameraResultType: {
    Uri: 'uri',
  },
}))

const sampleGoods: GoodsListItem = {
  id: 'goods-1',
  name: '流萤纪念吧唧',
  main_photo: '/media/goods/main/sample.jpg',
  is_official: true,
  quantity: 1,
  ip: { id: 1, name: '崩坏：星穹铁道' },
  characters: [
    {
      id: 1,
      name: '流萤',
      ip: { id: 1, name: '崩坏：星穹铁道' },
      gender: 'female',
    },
  ],
  category: {
    id: 1,
    name: '吧唧',
    parent: null,
    path_name: '周边/吧唧',
    color_tag: '#D4AF37',
    order: 1,
  },
  location_path: 'A 柜',
  status: 'in_cabinet',
}

const makeResult = (
  decision: GoodsImageMatchResult['decision'],
): GoodsImageMatchResult => ({
  decision,
  match:
    decision === 'matched'
      ? { goods: sampleGoods, score: 0.96, confidence: 'high' }
      : null,
  candidates:
    decision === 'matched'
      ? []
      : [{ goods: sampleGoods, score: 0.9, confidence: 'medium' }],
  attempt_id: 'attempt-1',
  algorithm_version: 'dinov2-small-int8-v1',
})

const mountMatcher = () =>
  mount(GoodsImageMatcher, {
    props: {
      modelValue: true,
    },
    global: {
      stubs: {
        ElDialog: {
          props: ['modelValue', 'title'],
          template: '<div role="dialog"><h2>{{ title }}</h2><slot /></div>',
        },
        'el-icon': { template: '<i><slot /></i>' },
        'el-button': {
          props: ['loading'],
          template: '<button :disabled="loading"><slot /></button>',
        },
        Transition: false,
      },
    },
  })

const selectFile = async (wrapper: ReturnType<typeof mountMatcher>) => {
  const input = wrapper.get('input[type="file"]')
  const file = new File(['image-bytes'], 'photo.jpg', { type: 'image/jpeg' })
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [file],
  })
  await input.trigger('change')
  await flushPromises()
  return file
}

describe('GoodsImageMatcher', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })
    URL.createObjectURL = vi.fn(() => 'blob:goods-match-preview')
    URL.revokeObjectURL = vi.fn()
    matchGoodsImageMock.mockReset()
    submitFeedbackMock.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders candidates and emits the selected goods id', async () => {
    matchGoodsImageMock.mockResolvedValue(makeResult('candidates'))
    const wrapper = mountMatcher()

    const file = await selectFile(wrapper)

    expect(matchGoodsImageMock).toHaveBeenCalledWith(file, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('找到几个相似谷子啦')
    expect(wrapper.text()).toContain(sampleGoods.name)

    await wrapper.get('.goods-image-match-card').trigger('click')
    expect(wrapper.emitted('openGoods')?.[0]).toEqual([sampleGoods.id])
  })

  it('renders the direct match and records confirmation feedback', async () => {
    matchGoodsImageMock.mockResolvedValue(makeResult('matched'))
    submitFeedbackMock.mockResolvedValue({
      detail: '反馈已记录',
      feedback: 'confirmed',
      goods_id: sampleGoods.id,
    })
    const wrapper = mountMatcher()
    await selectFile(wrapper)

    expect(wrapper.text()).toContain('好像已经在谷仓里啦')
    await wrapper.get('.goods-image-match-card__confirm').trigger('click')
    await flushPromises()

    expect(submitFeedbackMock).toHaveBeenCalledWith({
      attempt_id: 'attempt-1',
      outcome: 'confirmed',
      goods_id: sampleGoods.id,
    })
    expect(wrapper.text()).toContain('已记下啦，谢谢确认')
    expect(wrapper.text()).toContain('就是它啦')
  })

  it('keeps retry and close available when no match is found', async () => {
    matchGoodsImageMock.mockResolvedValue(makeResult('not_found'))
    const wrapper = mountMatcher()
    await selectFile(wrapper)

    expect(wrapper.text()).toContain('没找到能确定的那一款')
    expect(wrapper.text()).toContain('换一张')
    expect(wrapper.text()).toContain('关闭')
  })

  it('aborts the in-flight request and revokes the preview on close', async () => {
    let requestSignal: AbortSignal | undefined
    matchGoodsImageMock.mockImplementation((_file: File, signal: AbortSignal) => {
      requestSignal = signal
      return new Promise(() => {})
    })
    const wrapper = mountMatcher()
    await selectFile(wrapper)

    expect(wrapper.text()).toContain('正在谷仓里帮你找同款')
    expect(wrapper.text()).toContain('几秒钟就好')

    await wrapper.setProps({ modelValue: false })
    await flushPromises()

    expect(requestSignal?.aborted).toBe(true)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:goods-match-preview')
  })

  it('keeps mobile result actions on one flexible row', () => {
    const mobileRules = componentSource.split('@media (max-width: 768px)')[1] ?? ''
    const actionsRule = mobileRules.match(
      /\.goods-image-matcher__actions\s*\{[\s\S]*?\}/,
    )?.[0] ?? ''
    const buttonRule = mobileRules.match(
      /\.goods-image-matcher__actions :deep\(\.el-button\)\s*\{[\s\S]*?\}/,
    )?.[0] ?? ''

    expect(actionsRule).toContain('display: flex;')
    expect(buttonRule).toContain('flex: 1 1 0;')
    expect(buttonRule).toContain('white-space: nowrap;')
  })
})
