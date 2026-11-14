/**
 * 轻量防抖：把高频输入（如筛选关键字）合并成一次调用。
 *
 * 只覆盖项目里「输入即筛」这一种用法，因此不引入 lodash 之类依赖。
 * `cancel()` 用于组件卸载时清理定时器，避免离开页面后仍触发请求。
 */
export interface DebouncedFn<Args extends unknown[]> {
  (...args: Args): void
  /** 取消尚未执行的调用 */
  cancel: () => void
  /** 立即执行尚未执行的调用（有则执行） */
  flush: () => void
}

export function debounce<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  waitMs = 250,
): DebouncedFn<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingArgs: Args | null = null

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const debounced = ((...args: Args) => {
    pendingArgs = args
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      const argsToUse = pendingArgs
      pendingArgs = null
      if (argsToUse) fn(...argsToUse)
    }, waitMs)
  }) as DebouncedFn<Args>

  debounced.cancel = () => {
    clearTimer()
    pendingArgs = null
  }

  debounced.flush = () => {
    const argsToUse = pendingArgs
    pendingArgs = null
    clearTimer()
    if (argsToUse) fn(...argsToUse)
  }

  return debounced
}
