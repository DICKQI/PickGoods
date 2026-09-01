import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const loginSource = readFileSync(resolve(process.cwd(), 'src/views/Login.vue'), 'utf8')

describe('Login club registration layout', () => {
  it('widens the club form while keeping compact horizontal padding', () => {
    expect(loginSource).toContain('max-width: 860px;')
    expect(loginSource).toContain('.login-card--club .login-content')
    expect(loginSource).toContain('padding-right: 36px;')
    expect(loginSource).toContain('padding-left: 36px;')
  })

  it('keeps the two registration panels equal in height without a fixed height', () => {
    expect(loginSource).toContain('align-items: stretch;')
    expect(loginSource).not.toContain('.register-form-section {\n  height: 100%;')
  })

  it('keeps captcha validation from shifting the submit button', () => {
    expect(loginSource).not.toMatch(/^\s+label="图形验证码"$/m)
    expect(loginSource).toContain('aria-label="图形验证码"')
    expect(loginSource).toContain('.captcha-form-item :deep(.el-form-item__error)')
    expect(loginSource).toContain('position: absolute;')
  })
})
