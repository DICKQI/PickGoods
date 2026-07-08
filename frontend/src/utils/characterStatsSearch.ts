import { matchesTextOrPinyin } from '@/utils/pinyinSearch'
import type { Character } from '@/api/types'

type CharacterSearchApi = (params: { ip?: number }) => Promise<Character[]>

export const filterCharacterStatsCandidates = (keyword: string, candidates: Character[]) => {
  const trimmed = keyword.trim()
  if (!trimmed) return []
  return candidates.filter((character) => matchesTextOrPinyin(trimmed, character.name))
}

export const searchCharacterStatsCandidates = async (
  keyword: string,
  options: {
    scopedIpId?: number
    searchCharacters: CharacterSearchApi
  },
) => {
  const trimmed = keyword.trim()
  if (!trimmed) return []

  const candidates = await options.searchCharacters({
    ip: options.scopedIpId,
  })
  return filterCharacterStatsCandidates(trimmed, candidates)
}
