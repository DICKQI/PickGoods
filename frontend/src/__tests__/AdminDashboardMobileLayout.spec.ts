import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dashboardSource = readFileSync(join(process.cwd(), 'src/views/admin/AdminDashboard.vue'), 'utf-8')
const sharedAdminSource = readFileSync(join(process.cwd(), 'src/styles/admin.css'), 'utf-8')

describe('Admin mobile layout', () => {
  it('allows the dashboard flex content to shrink to the viewport', () => {
    expect(dashboardSource).toMatch(/\.admin-main\s*\{[\s\S]*?min-width:\s*0;/)
    expect(dashboardSource).toMatch(/\.admin-content\s*\{[\s\S]*?min-width:\s*0;/)
    expect(sharedAdminSource).toContain('box-sizing: border-box;')
    expect(sharedAdminSource).toContain('width: 100%;')
    expect(sharedAdminSource).toContain('min-width: 0;')
  })

  it('keeps wide admin tables scrollable inside the narrowed content area', () => {
    expect(sharedAdminSource).toContain('.admin-table-wrapper {')
    expect(sharedAdminSource).toContain('overflow-x: auto;')
    expect(dashboardSource).toContain('@media (max-width: 768px), (pointer: coarse)')
  })
})
