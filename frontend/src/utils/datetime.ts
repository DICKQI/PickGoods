/**
 * 将 ISO 时间字符串格式化为本地化的「年-月-日 时:分」展示文本。
 * 空值统一返回占位符「—」，便于表格 / 详情统一展示。
 */
export function formatDateTime(dt: string | null | undefined): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
