import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubProfile from '@/views/club/ClubProfile.vue'
import type { Club } from '@/api/types'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/api/clubs', () => ({
  getMyClub: vi.fn(),
  updateMyClub: vi.fn(),
  uploadMyClubAvatar: vi.fn(),
}))

import * as clubApi from '@/api/clubs'

const source = readFileSync(resolve(process.cwd(), 'src/views/club/ClubProfile.vue'), 'utf8')

const club: Club = {
  id: 1,
  name: '星光社团',
  avatar: null,
  description: '',
  announcement: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  taobao_url: null,
  xiaohongshu_url: null,
  weidian_url: null,
  store_links: [{ label: '其他入口', url: 'https://example.com' }],
  address: '',
  business_hours: '',
  goods_count: 0,
  created_at: '',
  updated_at: '',
}

const ButtonStub = {
  props: { loading: Boolean },
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>',
}

const InputStub = {
  inheritAttrs: false,
  props: { modelValue: { type: [String, null], default: '' } },
  emits: ['update:modelValue'],
  template: '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const passthrough = (tag = 'div') => ({ template: `<${tag}><slot /></${tag}>` })

async function mountPage() {
  vi.mocked(clubApi.getMyClub).mockResolvedValue(club)
  vi.mocked(clubApi.updateMyClub).mockResolvedValue(club)
  const wrapper = mount(ClubProfile, {
    global: {
      directives: { loading: {} },
      stubs: {
        ElAvatar: passthrough(),
        ElButton: ButtonStub,
        ElForm: passthrough('form'),
        ElFormItem: passthrough(),
        ElIcon: passthrough('span'),
        ElInput: InputStub,
        ElUpload: passthrough(),
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('ClubProfile 平台入口', () => {
  beforeEach(() => vi.clearAllMocks())

  it('展示三个固定平台输入项和本地 logo，并保留其他入口', () => {
    expect(source).toContain('平台入口')
    expect(source).toContain('/brand/taobao.png')
    expect(source).toContain('/brand/xiaohongshu.png')
    expect(source).toContain('/brand/weidian.png')
    expect(source).toContain('其他入口（每行：标签 | URL）')
    expect(source).toContain('v-model="form[platform.key]"')
  })

  it('保存时提交三个平台字段和兼容的自定义链接', async () => {
    const wrapper = await mountPage()
    const vm = wrapper.vm as unknown as {
      form: Club
      save: () => Promise<void>
      storeLinksText: string
    }
    vm.form.taobao_url = 'https://shop.taobao.com/demo'
    vm.form.xiaohongshu_url = 'https://www.xiaohongshu.com/demo'
    vm.form.weidian_url = null
    vm.storeLinksText = '官方网店 | https://example.com/shop'
    await vm.save()

    expect(clubApi.updateMyClub).toHaveBeenCalledWith(expect.objectContaining({
      taobao_url: 'https://shop.taobao.com/demo',
      xiaohongshu_url: 'https://www.xiaohongshu.com/demo',
      weidian_url: null,
      store_links: [{ label: '官方网店', url: 'https://example.com/shop' }],
    }))
  })
})
