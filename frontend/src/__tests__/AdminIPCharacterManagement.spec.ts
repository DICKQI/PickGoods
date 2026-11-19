import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'src/views/admin/AdminIPCharacterManagement.vue'),
  'utf-8',
).replace(/\r\n/g, '\n')

describe('管理后台 IP 与角色：个人作品只读', () => {
  it('shows the owner column so personal rows are distinguishable', () => {
    expect(source).toContain('label="归属"')
    expect(source).toContain('{{ row.user.username }}')
    expect(source).toContain('>官方</span>')
  })

  it('keeps personal IP rows read-only', () => {
    // 编辑/删除走 /api/ips/，对他人个人 IP 已收敛为 404，后台只展示「只读」
    expect(source).toContain('<div v-if="row.user" class="admin-action-inline">')
    expect(source).toContain('用户自建的个人作品，前台仅归属者可见')
    expect(source).toContain('<div v-else class="admin-action-inline">')
  })

  it('keeps personal characters read-only', () => {
    expect(source).toContain('v-if="row.ip?.user_id"')
    expect(source).toContain('该角色属于用户的个人作品，前台仅归属者可见，后台只读')
  })

  it('offers only official IPs when attaching a character', () => {
    expect(source).toContain('const creatableIpOptions = ref<AdminIPListItem[]>([])')
    expect(source).toContain('creatableIpOptions.value = results.filter((ip) => !ip.user_id)')
    expect(source).toContain('v-for="ip in creatableIpOptions"')
  })
})
