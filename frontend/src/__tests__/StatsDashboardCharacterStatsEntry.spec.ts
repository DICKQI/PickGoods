import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const statsDashboardSource = readFileSync(resolve(process.cwd(), 'src/components/StatsDashboard.vue'), 'utf8')
const statsFilterControlsSource = readFileSync(resolve(process.cwd(), 'src/components/StatsFilterControls.vue'), 'utf8')
const ipCharacterSource = readFileSync(resolve(process.cwd(), 'src/views/IPCharacterManagement.vue'), 'utf8')

describe('StatsDashboard character stats entry', () => {
  it('renders a searchable character stats entry in the stats filter controls', () => {
    expect(statsFilterControlsSource).toContain('<label>角色厨力</label>')
    expect(statsFilterControlsSource).toContain('placeholder="搜索角色名"')
    expect(statsFilterControlsSource).toContain('remote')
    expect(statsFilterControlsSource).toContain(':remote-method="searchCharacterStatsOptions"')
    expect(statsFilterControlsSource).toContain(':loading="characterStatsLoading"')
    expect(statsFilterControlsSource).toContain(':disabled="!characterStatsTargetId"')
    expect(statsFilterControlsSource).toContain('@click="$emit(\'openCharacterStats\')"')
    expect(statsFilterControlsSource).toContain('查看厨力')
  })

  it('searches characters with the applied IP filter and navigates by named route', () => {
    expect(statsDashboardSource).toContain("import { useRouter } from 'vue-router'")
    expect(statsDashboardSource).toContain("import { getIPList, getCategoryTree, getCharacterList } from '@/api/metadata'")
    expect(statsDashboardSource).toContain('const characterStatsTargetId = ref<number | undefined>()')
    expect(statsDashboardSource).toContain('const characterStatsOptions = ref<Character[]>([])')
    expect(statsDashboardSource).toContain('const characterStatsLoading = ref(false)')
    expect(statsDashboardSource).toContain('const searchCharacterStatsOptions = async (keyword: string) => {')
    expect(statsDashboardSource).toContain('getCharacterList({ search: trimmed, ip: filters.ip })')
    expect(statsDashboardSource).toContain("router.push({ name: 'CharacterStats', params: { id: characterStatsTargetId.value } })")
    expect(statsDashboardSource).not.toContain('character: characterStatsTargetId')
  })

  it('keeps the character management page free of the old stats shortcut', () => {
    expect(ipCharacterSource).not.toContain('goToCharacterStats')
    expect(ipCharacterSource).not.toContain('title="查看厨力统计"')
    expect(ipCharacterSource).not.toContain('tile-stats-btn')
  })
})
