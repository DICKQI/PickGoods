import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/element-plus-theme.css'), 'utf8')

function cssRuleBlock(source: string, selector: string) {
  const start = source.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = source.indexOf('}', start)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end + 1)
}

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

describe('Element Plus primary button theme', () => {
  it('only fills regular primary buttons and leaves link/text variants transparent', () => {
    const filledPrimarySelector = '.el-button--primary:not(.is-plain):not(.is-link):not(.is-text)'

    expect(themeSource).toContain(`${filledPrimarySelector} {`)
    expect(themeSource).toContain(`${filledPrimarySelector}:hover`)
    expect(themeSource).toContain(`${filledPrimarySelector}:focus`)
    expect(themeSource).not.toContain('.el-button--primary:not(.is-plain) {')
    expect(themeSource).not.toContain('.el-button--primary:not(.is-plain):hover')
    expect(themeSource).not.toContain('.el-button--primary:not(.is-plain):focus')
  })
})

describe('Element Plus MessageBox theme', () => {
  const messageBoxSource = themeSource.slice(themeSource.indexOf('/* MessageBox 视觉统一'))

  it('defines the shared warm card shell and blur overlay', () => {
    const shellRule = cssRuleBlock(messageBoxSource, 'html body .el-message-box')
    const overlayRule = cssRuleBlock(messageBoxSource, 'html body .el-overlay.is-message-box')

    expect(shellRule).toContain('width: min(460px, calc(100vw - 32px));')
    expect(shellRule).toContain('display: inline-flex;')
    expect(shellRule).toContain('border-radius: 26px;')
    expect(shellRule).toContain('linear-gradient(180deg')
    expect(shellRule).toContain('0 30px 80px')
    expect(overlayRule).toContain('background-color: rgba(31, 27, 30, 0.42);')
    expect(overlayRule).toContain('backdrop-filter: blur(3px)')
  })

  it('styles the title, close button, semantic icons, input, and buttons', () => {
    expect(cssRuleBlock(messageBoxSource, 'html body .el-message-box__title')).toContain('font-size: 20px;')
    expect(cssRuleBlock(messageBoxSource, 'html body .el-message-box__headerbtn')).toContain('border-radius: 50%;')
    expect(cssRuleBlock(messageBoxSource, 'html body .el-message-box__status.el-message-box-icon--warning')).toContain(
      'color: var(--dialog-warning-ink);',
    )
    expect(cssRuleBlock(messageBoxSource, 'html body .el-message-box__input .el-input__wrapper')).toContain('min-height: 44px;')
    expect(cssRuleBlock(messageBoxSource, 'html body .el-message-box__btns .el-button')).toContain('height: 42px;')
    expect(cssRuleBlock(messageBoxSource, 'html body .el-message-box__btns .el-button--primary')).toContain(
      'linear-gradient(135deg',
    )
    expect(cssRuleBlock(messageBoxSource, 'html body .el-message-box__btns .el-button--danger')).toContain(
      'linear-gradient(135deg',
    )
  })

  it('keeps button text and semantic icons above accessibility contrast thresholds', () => {
    expect(contrastRatio('#6d5dfc', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#5b4fd6', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#c24141', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#a92f2f', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#a85f00', '#fff8e6')).toBeGreaterThanOrEqual(3)
    expect(contrastRatio('#3f7d2d', '#f0faed')).toBeGreaterThanOrEqual(3)
    expect(contrastRatio('#6656d8', '#f4f2ff')).toBeGreaterThanOrEqual(3)
    expect(contrastRatio('#b33a3a', '#fdf0f0')).toBeGreaterThanOrEqual(3)
  })

  it('keeps the centered dialog responsive on mobile', () => {
    expect(messageBoxSource).toContain('@media screen and (max-width: 768px)')
    expect(messageBoxSource).toContain('width: min(460px, calc(100vw - 24px));')
    expect(messageBoxSource).toContain('max-height: calc(100dvh - 24px);')
    expect(messageBoxSource).toContain('html body .el-message-box__btns .el-button {')
  })
})
