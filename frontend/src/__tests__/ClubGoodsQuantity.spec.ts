import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('社团谷子数量语义', () => {
  it('社团对外页不展示发布条目的数量', () => {
    const source = readSource('src/views/ClubDetail.vue')

    expect(source).not.toContain('item.quantity')
    expect(source).not.toContain('selectedDetail.quantity')
    expect(source).not.toContain('公开数量')
  })

  it('社团工作区不提供数量输入或列表数量', () => {
    const editor = readSource('src/views/club/ClubGoodsEditor.vue')
    const list = readSource('src/views/club/ClubGoods.vue')

    expect(editor).not.toContain('form.quantity')
    expect(editor).not.toContain('label="数量"')
    expect(list).not.toContain('item.quantity')
  })

  it('社团工作区使用独立目录模型和发布状态', () => {
    const editor = readSource('src/views/club/ClubGoodsEditor.vue')
    const list = readSource('src/views/club/ClubGoods.vue')

    expect(editor).toContain('publication_status')
    expect(editor).toContain('value="listed"')
    expect(editor).toContain('value="unlisted"')
    expect(editor).not.toContain('in_cabinet')
    expect(editor).not.toContain('outdoor')
    expect(editor).not.toContain('sold')
    expect(list).toContain('getMyClubGoods')
    expect(list).toContain('updateClubGoods')
    expect(list).not.toContain('getGoodsList')
    expect(list).not.toContain('patchGoods')
  })
})
