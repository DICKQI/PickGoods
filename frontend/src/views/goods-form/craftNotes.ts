export const DEFAULT_CRAFT_NOTES_TEMPLATE = '店铺：\n工艺：\n画师：\n主题：'

const CRAFT_LINE_PATTERN = /^\s*工艺\s*[：:]/

export function applyCraftToNotes(notes: string | null | undefined, craftName: string) {
  const name = craftName.trim()
  const source = notes?.trim() ? notes : DEFAULT_CRAFT_NOTES_TEMPLATE
  const lines = source.split(/\r?\n/)
  const craftLine = `工艺：${name}`
  const craftIndex = lines.findIndex(line => CRAFT_LINE_PATTERN.test(line))

  if (craftIndex >= 0) {
    lines[craftIndex] = craftLine
    return lines.join('\n')
  }

  return [...lines, craftLine].join('\n')
}
