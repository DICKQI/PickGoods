import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')
const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8')

describe('auth guard and wiring', () => {
  it('requiresAdmin 判定前先实时复核角色', () => {
    const adminBlock = routerSource.slice(routerSource.indexOf('if (requiresAdmin'))
    expect(adminBlock).toContain('await authStore.fetchCurrentUser()')
    expect(adminBlock.indexOf('await authStore.fetchCurrentUser()')).toBeLessThan(
      adminBlock.indexOf('authStore.isAdmin')
    )
  })

  it('main.ts 注册 401 会话清理接线', () => {
    expect(mainSource).toContain('setUnauthorizedCleanup')
    expect(mainSource).toContain('useAuthStore().clearSession()')
  })
})
