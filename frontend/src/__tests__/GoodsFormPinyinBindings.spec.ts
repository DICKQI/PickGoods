import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const goodsFormSource = readFileSync(resolve(process.cwd(), 'src/views/GoodsForm.vue'), 'utf8')

describe('GoodsForm 拼音搜索绑定', () => {
  it('为 IP、角色、品类和主题接入自定义拼音过滤', () => {
    expect(goodsFormSource).toContain(':filter-method="handleIpFilter"')
    expect(goodsFormSource).toContain('v-for="ip in filteredIpOptions"')
    expect(goodsFormSource).toContain(':filter-method="handleCharacterFilter"')
    expect(goodsFormSource).toContain(':filter-node-method="filterCategoryNode"')
    expect(goodsFormSource).toContain(':filter-method="handleThemeFilter"')
    expect(goodsFormSource).toContain('v-for="theme in filteredThemeOptions"')
  })

  it('主题字段移除 default-first-option，保留 allow-create 行为', () => {
    expect(goodsFormSource).toContain('allow-create')
    expect(goodsFormSource).not.toContain('default-first-option')
  })
})
