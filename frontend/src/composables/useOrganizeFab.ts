/**
 * 整理页（/organize）悬浮按钮的「分栏注册 - 外壳渲染」契约。
 *
 * 三个分栏如果把 AddFab 挂在自己的模板里，`position: fixed` 会被祖先的 transform 捕获：
 * 分栏切换（organize-tab-fade 的 translateY）和进入整理页（Layout 的 page-fade）都会让按钮
 * 短暂跳到页面底部再瞬回。因此按钮统一由 Layout 外壳渲染（与云展柜的 fab-group 同思路），
 * 分栏只把按钮配置与回调注册进来。
 */
import { computed, inject, onBeforeUnmount, onMounted, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { InjectionKey } from 'vue'
import type { AddFabProps } from '@/components/AddFab.vue'
import type { OrganizeTab } from '@/navigation/organize'

/** 外壳转发给 AddFab 的事件回调，键名与 AddFab 的 emit 一致。 */
export interface OrganizeFabHandlers {
  click?: () => void
  command?: (command: string) => void
  refresh?: () => void
}

/** 分栏注册给外壳的一份按钮描述。 */
export interface OrganizeFabSlot {
  props: AddFabProps
  handlers: OrganizeFabHandlers
}

export interface OrganizeFabRegistry {
  /** 当前路由是否由外壳接管悬浮按钮（否则调用方页面自己渲染） */
  accepts: () => boolean
  register: (tab: OrganizeTab, read: () => OrganizeFabSlot) => void
  unregister: (tab: OrganizeTab) => void
}

export const ORGANIZE_FAB_KEY: InjectionKey<OrganizeFabRegistry> = Symbol('organize-fab')

/**
 * 外壳侧注册表工厂。
 *
 * `slotFor` 每次求值都会重新执行注册方的读取函数，所以 `loading` / `authStore.isAdmin`
 * 这类依赖变化能被外壳的 AddFab 感知。
 */
export function createOrganizeFabRegistry(options: { enabled: () => boolean }) {
  const sources = new Map<OrganizeTab, () => OrganizeFabSlot>()
  // Map 本身不是响应式的，用版本号驱动外壳重新取用当前分栏的描述
  const revision = ref(0)

  const registry: OrganizeFabRegistry = {
    accepts: () => options.enabled(),
    register(tab, read) {
      sources.set(tab, read)
      revision.value += 1
    },
    unregister(tab) {
      if (sources.delete(tab)) revision.value += 1
    },
  }

  const slotFor = (tab: MaybeRefOrGetter<OrganizeTab>) => computed(() => {
    void revision.value
    const read = sources.get(toValue(tab))
    return read ? read() : null
  })

  return { registry, slotFor }
}

/**
 * 分栏侧：把按钮交给外壳渲染。
 *
 * 返回的 `hosted` 为 true 时页面不要自己渲染 AddFab；为 false（独立路由、没有外壳）时
 * 页面沿用原来的内联 AddFab 回退。
 */
export function useOrganizeFab(tab: OrganizeTab, read: () => OrganizeFabSlot) {
  const registry = inject(ORGANIZE_FAB_KEY, null)
  if (!registry || !registry.accepts()) return { hosted: false }

  onMounted(() => registry.register(tab, read))
  onBeforeUnmount(() => registry.unregister(tab))

  return { hosted: true }
}
