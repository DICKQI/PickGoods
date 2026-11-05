import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const loginSource = readFileSync(resolve(process.cwd(), 'src/views/Login.vue'), 'utf8')

describe('Login club registration layout', () => {
  it('keeps the club form at the same width as the login card', () => {
    expect(loginSource).toContain('max-width: 400px;')
    expect(loginSource).not.toContain('max-width: 860px;')
    expect(loginSource).not.toContain('padding-right: 36px;')
    expect(loginSource).not.toContain('padding-left: 36px;')
  })

  it('splits club registration into application and basic-information steps', () => {
    expect(loginSource).toContain('clubRegistrationStep')
    expect(loginSource).toContain('第 1 步 · 社团申请信息')
    expect(loginSource).toContain('第 2 步 · 基础信息')
    expect(loginSource).toContain('下一步：填写基础信息')
    expect(loginSource).toContain('backToClubApplication')
    expect(loginSource).toContain("clubRegistrationStep === 2")
  })

  it('keeps captcha validation from shifting the submit button', () => {
    expect(loginSource).not.toMatch(/^\s+label="图形验证码"$/m)
    expect(loginSource).toContain('aria-label="图形验证码"')
    expect(loginSource).toContain('.captcha-form-item :deep(.el-form-item__error)')
    expect(loginSource).toContain('position: absolute;')
  })

  it('keeps the login page scrollbar unobtrusive and resizes for step changes', () => {
    expect(loginSource).toContain('scrollbar-width: none;')
    expect(loginSource).toContain('.login-container::-webkit-scrollbar')
    expect(loginSource).toContain('watch([mode, () => formData.accountType, clubRegistrationStep], triggerCardResize)')
  })

  it('does not render a server-settings entry in the login page header', () => {
    // 顶部右上角的“服务设置”入口已移除；卡片底部的“服务器设置”入口保留
    expect(loginSource).not.toContain('login-service-settings')
    expect(loginSource).not.toContain('服务设置')
    expect(loginSource).not.toMatch(/<RouterLink[^>]*to="\/settings"/)
    expect(loginSource).toContain('服务器设置')
  })

  it('opens the server settings page through an explicit router push', () => {
    // 不再依赖 <a href> 的默认跳转：部分 WebView 会把链接交给宿主处理，导致点击无响应
    expect(loginSource).not.toContain('<router-link to="/settings"')
    expect(loginSource).toContain('data-test="login-server-settings"')
    expect(loginSource).toContain('@click="openServerSettings"')
    expect(loginSource).toContain("void router.push('/settings')")
    expect(loginSource).toContain('cursor: pointer;')
  })
})
