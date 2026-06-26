import { describe, expect, it } from 'vitest'
import {
  groupShowcaseDisplayGoods,
  isPaperDisplayGoods,
  isRoundDisplayGoods,
} from '@/components/showcase/showcaseDisplayGrouping'
import type { GoodsListItem, ShowcaseGoods } from '@/api/types'

const makeGoods = (
  id: string,
  category: Partial<GoodsListItem['category']>,
): ShowcaseGoods => ({
  id: `showcase-${id}`,
  goods: {
    id: `goods-${id}`,
    name: `测试谷子 ${id}`,
    ip: { id: 1, name: '测试 IP' },
    characters: [],
    category: {
      id: Number(id.replace(/\D/g, '')) || 1,
      name: category.name || '测试品类',
      parent: null,
      path_name: category.path_name || category.name || '测试品类',
      shape_type: category.shape_type ?? null,
      color_tag: category.color_tag ?? null,
      order: 1,
    },
    location_path: '卧室/A柜',
    main_photo: null,
    status: 'in_cabinet',
    quantity: 1,
    is_official: true,
  },
  category: null,
  order: Number(id.replace(/\D/g, '')) || 1,
})

describe('showcase display grouping', () => {
  it('recognizes paper goods from the paper category tree and listed subcategory keywords', () => {
    const treePaper = makeGoods('1', {
      name: '方卡',
      path_name: '纸制品/方卡',
      shape_type: 'rectangle',
    })
    const nestedPaper = makeGoods('2', {
      name: '纸夹相卡',
      path_name: '纸制品/仿胶片卡/纸夹相卡',
      shape_type: null,
    })
    const keywordPaper = makeGoods('3', {
      name: '光栅卡',
      path_name: '光栅卡',
      shape_type: null,
    })
    const bookmark = makeGoods('4', {
      name: '书签',
      path_name: '书签',
      shape_type: null,
    })

    expect(isPaperDisplayGoods(treePaper)).toBe(true)
    expect(isPaperDisplayGoods(nestedPaper)).toBe(true)
    expect(isPaperDisplayGoods(keywordPaper)).toBe(true)
    expect(isPaperDisplayGoods(bookmark)).toBe(true)
  })

  it('keeps non-paper rectangles out and gives round goods priority', () => {
    const stand = makeGoods('5', {
      name: '亚克力立牌',
      path_name: '亚克力/立牌',
      shape_type: 'rectangle',
    })
    const badge = makeGoods('6', {
      name: '吧唧',
      path_name: '纸制品/吧唧',
      shape_type: 'round',
    })

    expect(isPaperDisplayGoods(stand)).toBe(false)
    expect(isRoundDisplayGoods(badge)).toBe(true)
    expect(isPaperDisplayGoods(badge)).toBe(false)

    const groups = groupShowcaseDisplayGoods([stand, badge])
    expect(groups.round).toEqual([badge])
    expect(groups.paper).toEqual([])
    expect(groups.other).toEqual([stand])
  })
})
