import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf-8')

const pageSource = read('src/views/admin/AdminAuditLogs.vue')
const apiSource = read('src/api/admin.ts')
const typesSource = read('src/api/types.ts')

describe('admin audit log completeness', () => {
  it('exposes type, outcome, related resource, and actor filters', () => {
    expect(pageSource).toContain('filters.related_resource')
    expect(pageSource).toContain('filters.log_type')
    expect(pageSource).toContain('filters.outcome')
    expect(pageSource).toContain('filters.actor')
    expect(pageSource).toContain('placeholder="资源 ID（含批量）"')
    expect(pageSource).toContain('<el-option label="业务操作" value="business" />')
    expect(pageSource).toContain('<el-option label="安全事件" value="security" />')
  })

  it('sends the new filters to the API', () => {
    for (const key of [
      'related_resource:',
      'log_type:',
      'outcome:',
      'actor:',
    ]) {
      expect(pageSource).toContain(key)
    }
    expect(apiSource).toContain('related_resource?: string')
    expect(apiSource).toContain("log_type?: 'business' | 'security'")
    expect(apiSource).toContain("outcome?: 'success' | 'failure'")
    expect(apiSource).toContain('subject_user?: number')
  })

  it('renders the new columns and highlights failures', () => {
    expect(pageSource).toContain(':row-class-name="auditRowClassName"')
    expect(pageSource).toContain('audit-row--failure')
    expect(pageSource).toContain('label="类型"')
    expect(pageSource).toContain('label="结果"')
    expect(pageSource).toContain('label="归属用户"')
    expect(pageSource).toContain('label="状态码"')
  })

  it('shows request context in the detail drawer', () => {
    expect(pageSource).toContain('请求 ID')
    expect(pageSource).toContain('User-Agent')
    expect(pageSource).toContain('selectedLog.resource_ids')
    expect(pageSource).toContain('requestLine(selectedLog)')
  })

  it('labels every audited resource type', () => {
    for (const label of [
      'ip:',
      'category:',
      'character:',
      'theme:',
      'location:',
      'journal:',
      'showcase:',
      'preorder:',
      'auth:',
      'django_admin:',
    ]) {
      expect(pageSource).toContain(label)
    }
  })

  it('types the new audit log fields', () => {
    expect(typesSource).toContain("export type AdminAuditLogType = 'business' | 'security'")
    expect(typesSource).toContain("export type AdminAuditOutcome = 'success' | 'failure'")
    for (const field of [
      'display_actor: string',
      'actor_username: string',
      'resource_ids: string',
      'http_method: string',
      'status_code: number | null',
      'request_id: string',
      'user_agent: string',
      'subject_username: string | null',
    ]) {
      expect(typesSource).toContain(field)
    }
  })
})
