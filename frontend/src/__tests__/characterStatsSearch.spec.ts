import { describe, expect, it, vi } from 'vitest'
import { filterCharacterStatsCandidates, searchCharacterStatsCandidates } from '@/utils/characterStatsSearch'
import type { Character, IP } from '@/api/types'

const lyskIp: IP = { id: 1, name: '恋与深空', keywords: [{ id: 101, value: 'LYSK' }] }
const starRailIp: IP = { id: 2, name: '崩坏：星穹铁道', keywords: [{ id: 201, value: 'HSR' }] }
const genshinIp: IP = { id: 3, name: '原神', keywords: [{ id: 301, value: 'YS' }] }

const makeCharacter = (id: number, name: string, ip: IP): Character => ({
  id,
  name,
  ip,
  gender: 'other',
})

describe('searchCharacterStatsCandidates', () => {
  it('可以对已缓存角色列表执行纯前端拼音过滤', () => {
    const result = filterCharacterStatsCandidates('ly', [
      makeCharacter(11, '沈星回', lyskIp),
      makeCharacter(12, '流萤', starRailIp),
    ])

    expect(result.map((character) => character.name)).toEqual(['流萤'])
  })

  it('输入角色拼音时只匹配角色名称，不按 IP 拼音扩展', async () => {
    const searchCharacters = vi.fn().mockResolvedValue([
      makeCharacter(11, '沈星回', lyskIp),
      makeCharacter(12, '流萤', starRailIp),
    ])

    const result = await searchCharacterStatsCandidates('ly', {
      searchCharacters,
    })

    expect(result.map((character) => character.name)).toEqual(['流萤'])
    expect(searchCharacters).toHaveBeenCalledWith({ ip: undefined })
  })

  it('已有 IP 筛选时只在该 IP 的角色内做拼音过滤', async () => {
    const searchCharacters = vi.fn().mockResolvedValue([
      makeCharacter(21, '派蒙', genshinIp),
      makeCharacter(22, '空', genshinIp),
    ])

    const result = await searchCharacterStatsCandidates('pm', {
      scopedIpId: genshinIp.id,
      searchCharacters,
    })

    expect(result.map((character) => character.name)).toEqual(['派蒙'])
    expect(searchCharacters).toHaveBeenCalledWith({ ip: genshinIp.id })
  })
})
