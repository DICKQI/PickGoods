import { match } from 'pinyin-pro'

const normalizeKeyword = (keyword: string) => keyword.trim().toLowerCase()

const matchesSingleCandidate = (keyword: string, candidate?: string | null) => {
  if (!candidate) return false

  const normalizedKeyword = normalizeKeyword(keyword)
  const normalizedCandidate = candidate.toLowerCase()

  if (normalizedCandidate.includes(normalizedKeyword)) {
    return true
  }

  return Boolean(match(candidate, normalizedKeyword, {
    continuous: true,
    insensitive: true,
    v: true,
  }))
}

export const matchesTextOrPinyin = (
  keyword: string,
  candidate: string | string[] | undefined | null,
) => {
  if (!normalizeKeyword(keyword)) {
    return true
  }

  if (Array.isArray(candidate)) {
    return candidate.some((item) => matchesSingleCandidate(keyword, item))
  }

  return matchesSingleCandidate(keyword, candidate)
}
