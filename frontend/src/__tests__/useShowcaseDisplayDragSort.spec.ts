import { describe, expect, it } from 'vitest'
import { buildShowcaseMovePayload } from '@/components/showcase/useShowcaseDisplayDragSort'
import type { GoodsListItem, ShowcaseGoods } from '@/api/types'

const makeItem = (n: number): ShowcaseGoods => ({
  id: `showcase-${n}`,
  goods: {
    id: `goods-${n}`,
    name: `纸品 ${n}`,
    ip: { id: 1, name: '测试 IP' },
    characters: [],
    category: {
      id: n,
      name: '方卡',
      parent: null,
      path_name: '纸制品/方卡',
      shape_type: 'rectangle',
      color_tag: null,
      order: n,
    } satisfies GoodsListItem['category'],
    location_path: '卧室/A柜',
    main_photo: null,
    status: 'in_cabinet',
    quantity: 1,
    is_official: true,
  },
  category: null,
  order: n,
})

describe('buildShowcaseMovePayload', () => {
  it('uses the previous item as an after anchor after cross-page reordering', () => {
    const items = Array.from({ length: 10 }, (_, i) => makeItem(i + 1))
    const reordered = [...items.slice(1, 9), items[0]!, items[9]!]

    expect(buildShowcaseMovePayload(reordered, 'showcase-1')).toEqual({
      goods_id: 'goods-1',
      anchor_goods_id: 'goods-9',
      position: 'after',
    })
  })

  it('uses the next item as a before anchor when moving to the first position', () => {
    const items = Array.from({ length: 4 }, (_, i) => makeItem(i + 1))
    const reordered = [items[3]!, items[0]!, items[1]!, items[2]!]

    expect(buildShowcaseMovePayload(reordered, 'showcase-4')).toEqual({
      goods_id: 'goods-4',
      anchor_goods_id: 'goods-1',
      position: 'before',
    })
  })
})
