/// <reference types="vite/client" />

// 由 vite.config.ts 的 define 注入的应用版本号（来源：package.json 的 version 字段）
declare const __APP_VERSION__: string

declare module 'element-plus/dist/locale/zh-cn.mjs' {
  const zhCn: any
  export default zhCn
}

declare module 'lodash-es' {
  export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: any
  ): T & { cancel: () => void; flush: () => void }
}

declare module 'sortablejs' {
  const Sortable: any
  export default Sortable
}
