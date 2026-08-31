import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useClubImportQueueStore, type ClubImportQueueItem } from '@/stores/clubImportQueue'

const makeItem = (goodsId: string, name = goodsId): ClubImportQueueItem => ({
  goodsId,
  clubId: 2,
  clubName: '星屑社团',
  name,
  mainPhoto: null,
  ipName: '测试 IP',
  categoryName: '徽章',
  imported: false,
  importedQuantity: null,
  importedGoodsId: null,
  status: 'pending',
})

describe('clubImportQueue store', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('persists a queue and hydrates it for a new route session', () => {
    const queue = useClubImportQueueStore()
    const queueId = queue.start([makeItem('goods-1'), makeItem('goods-2')])
    queue.markProcessing('goods-1')

    expect(JSON.parse(window.sessionStorage.getItem('pickgoods:club-import-queue') || '{}')).toMatchObject({
      id: queueId,
      items: [{ goodsId: 'goods-1', status: 'processing' }, { goodsId: 'goods-2', status: 'pending' }],
    })

    setActivePinia(createPinia())
    const restored = useClubImportQueueStore()
    expect(restored.queueId).toBe(queueId)
    expect(restored.items.map(item => item.status)).toEqual(['pending', 'pending'])
    expect(restored.nextPending()?.goodsId).toBe('goods-1')
    expect(restored.currentItem?.goodsId).toBe('goods-1')
  })

  it('tracks completion, skipped and failed outcomes in order', () => {
    const queue = useClubImportQueueStore()
    queue.start([makeItem('goods-1'), makeItem('goods-2'), makeItem('goods-3')])

    queue.markCompleted('goods-1', 'personal-1', '已创建个人库存')
    queue.markSkipped('goods-2', '用户取消重复导入')
    queue.markFailed('goods-3', '模板加载失败')

    expect(queue.completedItems.map(item => item.goodsId)).toEqual(['goods-1'])
    expect(queue.unresolvedItems.map(item => item.goodsId)).toEqual(['goods-3'])
    expect(queue.isComplete).toBe(false)
    expect(queue.nextPending()).toBeNull()
    expect(queue.find('goods-2')).toMatchObject({ status: 'skipped', resultMessage: '用户取消重复导入' })

    queue.markCompleted('goods-3')
    expect(queue.isComplete).toBe(true)
    expect(queue.unresolvedItems).toEqual([])
  })

  it('clears completed queues and removes the session record', () => {
    const queue = useClubImportQueueStore()
    queue.start([makeItem('goods-1')])
    queue.markCompleted('goods-1')

    queue.clear()

    expect(queue.queueId).toBeNull()
    expect(queue.items).toEqual([])
    expect(window.sessionStorage.getItem('pickgoods:club-import-queue')).toBeNull()
  })
})
