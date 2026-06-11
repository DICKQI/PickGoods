import { describe, it, expect } from 'vitest'
import { buildTree, getPathById } from '@/utils/tree'
import type { StorageNode } from '@/api/types'

const makeNode = (id: number, name: string, parent: number | null = null, order = 0): StorageNode => ({
  id,
  name,
  parent,
  path_name: '',
  order,
  image: null,
  description: null,
} as StorageNode)

describe('buildTree', () => {
  it('空数组返回空树', () => {
    expect(buildTree([])).toEqual([])
  })

  it('单个根节点', () => {
    const nodes = [makeNode(1, '房间')]
    const tree = buildTree(nodes)
    expect(tree).toHaveLength(1)
    expect(tree[0]!.label).toBe('房间')
    expect(tree[0]!.children).toEqual([])
  })

  it('父子关系正确建立', () => {
    const nodes = [
      makeNode(1, '房间', null),
      makeNode(2, '柜子', 1),
      makeNode(3, '层1', 2),
    ]
    const tree = buildTree(nodes)
    expect(tree).toHaveLength(1)
    expect(tree[0]!.children).toHaveLength(1)
    expect(tree[0]!.children![0]!.children).toHaveLength(1)
    expect(tree[0]!.children![0]!.children![0]!.label).toBe('层1')
  })

  it('多个根节点', () => {
    const nodes = [
      makeNode(1, '房间A', null),
      makeNode(2, '房间B', null),
    ]
    const tree = buildTree(nodes)
    expect(tree).toHaveLength(2)
  })

  it('按 order 字段排序', () => {
    const nodes = [
      makeNode(1, 'B', null, 2000),
      makeNode(2, 'A', null, 1000),
    ]
    const tree = buildTree(nodes)
    expect(tree[0]!.label).toBe('A')
    expect(tree[1]!.label).toBe('B')
  })

  it('子节点也按 order 排序', () => {
    const nodes = [
      makeNode(1, '父', null),
      makeNode(2, 'B', 1, 2000),
      makeNode(3, 'A', 1, 1000),
    ]
    const tree = buildTree(nodes)
    expect(tree[0]!.children![0]!.label).toBe('A')
    expect(tree[0]!.children![1]!.label).toBe('B')
  })

  it('data 字段保存原始节点', () => {
    const node = makeNode(1, '房间', null)
    const tree = buildTree([node])
    expect(tree[0]!.data).toBe(node)
  })
})

describe('getPathById', () => {
  const nodes: StorageNode[] = [
    makeNode(1, '房间', null),
    makeNode(2, '柜子', 1),
    makeNode(3, '层1', 2),
    makeNode(4, '抽屉', 3),
  ]

  it('根节点返回自身名称', () => {
    expect(getPathById(nodes, 1)).toBe('房间')
  })

  it('二级节点路径', () => {
    expect(getPathById(nodes, 2)).toBe('房间 > 柜子')
  })

  it('深层节点路径', () => {
    expect(getPathById(nodes, 4)).toBe('房间 > 柜子 > 层1 > 抽屉')
  })

  it('不存在的 id 返回空字符串或自身', () => {
    const result = getPathById(nodes, 999)
    expect(typeof result).toBe('string')
  })
})
