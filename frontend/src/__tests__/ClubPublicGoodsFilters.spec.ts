import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  clubGoodsFilterCount,
  clubGoodsFiltersToApi,
  clubGoodsFiltersToQuery,
  createDefaultClubGoodsFilters,
  normalizeClubGoodsFilters,
  parseClubGoodsFilters,
} from '@/views/club/clubPublicGoodsFilters'
import type { ClubGoodsFacets } from '@/api/types'

const panelSource = readFileSync(resolve(process.cwd(), 'src/views/club/ClubPublicGoodsFilterPanel.vue'), 'utf8')

const facets: ClubGoodsFacets = {
  ips: [{ id: 1, name: '作品', count: 3 }],
  characters: [
    { id: 10, name: '角色 A', ip_id: 1, count: 2 },
    { id: 11, name: '其他作品角色', ip_id: 2, count: 1 },
  ],
  categories: [{ id: 20, name: '吧唧', path_name: '徽章/吧唧', parent: null, count: 3 }],
  themes: [{ id: 30, name: '夏日', count: 1 }],
  price_bounds: { min: '10.00', max: '50.00' },
  imported_counts: { imported: 1, unimported: 2 },
}

describe('社团公开谷子筛选状态', () => {
  it('大屏下将筛选项收拢为单行并为价格区保留更宽空间', () => {
    expect(panelSource).toMatch(/@media \(min-width:\s*1360px\)\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\) minmax\(240px,\s*1\.55fr\);/)
    expect(panelSource).toMatch(/\.public-filter-grid--with-imported\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\) minmax\(240px,\s*1\.55fr\) minmax\(0,\s*1fr\);/)
  })

  it('从 URL 读取有效参数并忽略格式无效的值', () => {
    expect(parseClubGoodsFilters({
      search: '  流萤  ',
      ip: '1',
      character: 'bad',
      category: '-2',
      theme: '30',
      price_min: '12.50',
      price_max: 'NaN',
      imported: 'imported',
      ordering: 'price_desc',
    })).toEqual({
      search: '流萤',
      ip: 1,
      character: undefined,
      category: undefined,
      theme: 30,
      price_min: '12.50',
      price_max: '',
      imported: 'imported',
      ordering: 'price_desc',
    })
  })

  it('根据当前社团 facets 清理失效选项、跨 IP 角色和无权限导入条件', () => {
    const normalized = normalizeClubGoodsFilters({
      ...createDefaultClubGoodsFilters(),
      ip: 1,
      character: 11,
      category: 999,
      theme: 999,
      price_min: '80',
      price_max: '20',
      imported: 'imported',
    }, facets, false)

    expect(normalized).toEqual({
      ...createDefaultClubGoodsFilters(),
      ip: 1,
    })
  })

  it('URL 与 API 参数省略默认值并保留分页和有效条件', () => {
    const filters = {
      ...createDefaultClubGoodsFilters(),
      search: '角色',
      ip: 1,
      character: 10,
      price_min: '10',
      imported: 'unimported' as const,
      ordering: 'newest' as const,
    }
    expect(clubGoodsFiltersToQuery(filters, 2)).toEqual({
      search: '角色',
      ip: '1',
      character: '10',
      price_min: '10',
      imported: 'unimported',
      ordering: 'newest',
      page: '2',
    })
    expect(clubGoodsFiltersToApi(filters, 2, 20)).toEqual({
      page: 2,
      page_size: 20,
      search: '角色',
      ip: 1,
      character: 10,
      category: undefined,
      theme: undefined,
      price_min: '10',
      price_max: undefined,
      imported: 'unimported',
      ordering: 'newest',
    })
  })

  it('保留上架时间最早排序参数', () => {
    const filters = { ...createDefaultClubGoodsFilters(), ordering: 'oldest' as const }
    expect(parseClubGoodsFilters({ ordering: 'oldest' }).ordering).toBe('oldest')
    expect(clubGoodsFiltersToQuery(filters, 1)).toEqual({ ordering: 'oldest' })
    expect(clubGoodsFiltersToApi(filters, 1, 20).ordering).toBe('oldest')
  })

  it('价格区间按一个筛选条件计数', () => {
    expect(clubGoodsFilterCount({
      ...createDefaultClubGoodsFilters(),
      ip: 1,
      price_min: '10',
      price_max: '20',
      imported: 'imported',
    })).toBe(3)
  })
})
