import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import type {
  ClubGoodsFacets,
  ClubGoodsImportedFilter,
  ClubGoodsOrdering,
  ClubGoodsQuery,
} from '@/api/types'

export interface ClubPublicGoodsFilterState {
  search: string
  ip?: number
  character?: number
  category?: number
  theme?: number
  price_min: string
  price_max: string
  imported: ClubGoodsImportedFilter
  ordering: ClubGoodsOrdering
}

export const createDefaultClubGoodsFilters = (): ClubPublicGoodsFilterState => ({
  search: '',
  ip: undefined,
  character: undefined,
  category: undefined,
  theme: undefined,
  price_min: '',
  price_max: '',
  imported: 'all',
  ordering: 'default',
})

type OptionalQueryValue = LocationQuery[string] | undefined

const firstQueryValue = (value: OptionalQueryValue) => (
  Array.isArray(value) ? value[0] : value
)

const positiveInteger = (value: OptionalQueryValue) => {
  const raw = firstQueryValue(value)
  if (!raw || !/^\d+$/.test(raw)) return undefined
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

const priceValue = (value: OptionalQueryValue) => {
  const raw = firstQueryValue(value)?.trim()
  if (!raw || !/^\d+(?:\.\d{0,2})?$/.test(raw)) return ''
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? raw : ''
}

const importedValues: ClubGoodsImportedFilter[] = ['all', 'imported', 'unimported']
const orderingValues: ClubGoodsOrdering[] = ['default', 'newest', 'oldest', 'price_asc', 'price_desc']

export function parseClubGoodsFilters(query?: LocationQuery): ClubPublicGoodsFilterState {
  const source = query || {}
  const imported = firstQueryValue(source.imported)
  const ordering = firstQueryValue(source.ordering)
  return {
    search: firstQueryValue(source.search)?.trim() || '',
    ip: positiveInteger(source.ip),
    character: positiveInteger(source.character),
    category: positiveInteger(source.category),
    theme: positiveInteger(source.theme),
    price_min: priceValue(source.price_min),
    price_max: priceValue(source.price_max),
    imported: importedValues.includes(imported as ClubGoodsImportedFilter)
      ? imported as ClubGoodsImportedFilter
      : 'all',
    ordering: orderingValues.includes(ordering as ClubGoodsOrdering)
      ? ordering as ClubGoodsOrdering
      : 'default',
  }
}

export function normalizeClubGoodsFilters(
  filters: ClubPublicGoodsFilterState,
  facets: ClubGoodsFacets,
  canFilterImported: boolean,
): ClubPublicGoodsFilterState {
  const next = { ...filters }
  if (!facets.ips.some(option => option.id === next.ip)) next.ip = undefined
  const selectedCharacter = facets.characters.find(option => option.id === next.character)
  if (!next.ip || !selectedCharacter || selectedCharacter.ip_id !== next.ip) next.character = undefined
  if (!facets.categories.some(option => option.id === next.category)) next.category = undefined
  if (!facets.themes.some(option => option.id === next.theme)) next.theme = undefined
  if (!canFilterImported || !facets.imported_counts) next.imported = 'all'
  if (next.price_min && next.price_max && Number(next.price_min) > Number(next.price_max)) {
    next.price_min = ''
    next.price_max = ''
  }
  return next
}

export function clubGoodsFiltersToQuery(
  filters: ClubPublicGoodsFilterState,
  page: number,
): LocationQueryRaw {
  return {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.ip ? { ip: String(filters.ip) } : {}),
    ...(filters.character ? { character: String(filters.character) } : {}),
    ...(filters.category ? { category: String(filters.category) } : {}),
    ...(filters.theme ? { theme: String(filters.theme) } : {}),
    ...(filters.price_min ? { price_min: filters.price_min } : {}),
    ...(filters.price_max ? { price_max: filters.price_max } : {}),
    ...(filters.imported !== 'all' ? { imported: filters.imported } : {}),
    ...(filters.ordering !== 'default' ? { ordering: filters.ordering } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  }
}

export function clubGoodsFiltersToApi(
  filters: ClubPublicGoodsFilterState,
  page: number,
  pageSize: number,
): ClubGoodsQuery {
  return {
    page,
    page_size: pageSize,
    search: filters.search || undefined,
    ip: filters.ip,
    character: filters.character,
    category: filters.category,
    theme: filters.theme,
    price_min: filters.price_min || undefined,
    price_max: filters.price_max || undefined,
    imported: filters.imported === 'all' ? undefined : filters.imported,
    ordering: filters.ordering === 'default' ? undefined : filters.ordering,
  }
}

export function clubGoodsFilterCount(filters: ClubPublicGoodsFilterState) {
  return [
    filters.ip,
    filters.character,
    filters.category,
    filters.theme,
    filters.price_min || filters.price_max ? 'price' : undefined,
    filters.imported !== 'all' ? filters.imported : undefined,
  ].filter(Boolean).length
}
