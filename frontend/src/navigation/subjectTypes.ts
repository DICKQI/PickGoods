/**
 * 作品类型（Bangumi subject_type）的展示与筛选选项。
 *
 * Bangumi 的类型码是固定的，IP 作品库的桌面筛选胶囊、移动端下拉与
 * 详情展示都从这里取，避免各处重复维护同一张映射表。
 */
export interface SubjectTypeOption {
  /** Bangumi subject_type 取值 */
  value: number
  /** 中文展示名 */
  label: string
}

export const SUBJECT_TYPE_OPTIONS: SubjectTypeOption[] = [
  { value: 1, label: '书籍' },
  { value: 2, label: '动画' },
  { value: 3, label: '音乐' },
  { value: 4, label: '游戏' },
  { value: 6, label: '三次元/特摄' },
]

const SUBJECT_TYPE_LABELS: Record<number, string> = SUBJECT_TYPE_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {},
)

/** 取类型中文名；未设置返回空串，未知类型返回「未知」 */
export function subjectTypeLabel(value: number | null | undefined): string {
  if (!value) return ''
  return SUBJECT_TYPE_LABELS[value] ?? '未知'
}

/** 取该类型的标签色语义（与 IP 卡片、移动端类型胶囊的配色保持一致） */
export function subjectTypeTone(
  value: number | null | undefined,
): 'book' | 'anime' | 'music' | 'game' | 'real' | 'plain' {
  switch (value) {
    case 1:
      return 'book'
    case 2:
      return 'anime'
    case 3:
      return 'music'
    case 4:
      return 'game'
    case 6:
      return 'real'
    default:
      return 'plain'
  }
}
