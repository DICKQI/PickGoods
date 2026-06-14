import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')
const ipCharacterSource = readFileSync(resolve(process.cwd(), 'src/views/IPCharacterManagement.vue'), 'utf8')

describe('character stats routing and entrypoint', () => {
  it('registers the standalone character stats route', () => {
    expect(routerSource).toContain("path: '/characters/:id/stats'")
    expect(routerSource).toContain("name: 'CharacterStats'")
    expect(routerSource).toContain("component: () => import('@/views/CharacterStats.vue')")
    expect(routerSource).toContain("title: '角色厨力统计'")
  })

  it('removes the old statistics entry from IP character tiles without replacing edit/delete actions', () => {
    expect(ipCharacterSource).not.toContain('const goToCharacterStats = (character: Character)')
    expect(ipCharacterSource).not.toContain("router.push(`/characters/${character.id}/stats`)")
    expect(ipCharacterSource).not.toContain('title="查看厨力统计"')
    expect(ipCharacterSource).not.toContain('@click.stop="goToCharacterStats(char)"')
    expect(ipCharacterSource).toContain('@click="authStore.isAdmin && handleEditCharacter(char)"')
    expect(ipCharacterSource).toContain('@click.stop="handleDeleteCharacter(char)"')
  })
})
