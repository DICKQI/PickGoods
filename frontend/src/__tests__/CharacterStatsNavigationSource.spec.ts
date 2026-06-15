import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/Layout.vue'), 'utf8')
const mobileBottomNavSource = readFileSync(resolve(process.cwd(), 'src/components/MobileBottomNav.vue'), 'utf8')

describe('character stats navigation source highlighting', () => {
  it('highlights showcase when character stats was opened from the stats dashboard', () => {
    expect(layoutSource).toContain('isCharacterStatsFromShowcase')
    expect(layoutSource).toContain("currentPath.startsWith('/characters/') && isCharacterStatsFromShowcase.value")
    expect(layoutSource).toContain("returnTo.startsWith('/showcase')")

    expect(mobileBottomNavSource).toContain('isCharacterStatsFromShowcase')
    expect(mobileBottomNavSource).toContain("currentPath.startsWith('/characters/') && isCharacterStatsFromShowcase.value")
    expect(mobileBottomNavSource).toContain("returnTo.startsWith('/showcase')")
  })

  it('keeps character stats under IP and role when there is no showcase source', () => {
    expect(layoutSource).toContain("currentPath.startsWith('/character') && !isCharacterStatsFromShowcase.value")
    expect(mobileBottomNavSource).toContain("currentPath.startsWith('/character') && !isCharacterStatsFromShowcase.value")
  })
})
