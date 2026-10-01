import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function confirmSnippet(relativePath: string, messageFragment: string) {
  const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8')
  const messageIndex = source.indexOf(messageFragment)
  expect(messageIndex, `${relativePath} should contain ${messageFragment}`).toBeGreaterThanOrEqual(0)
  const callStart = source.lastIndexOf('ElMessageBox.confirm', messageIndex)
  expect(callStart, `${relativePath} should use ElMessageBox near ${messageFragment}`).toBeGreaterThanOrEqual(0)
  return source.slice(callStart, messageIndex + 500)
}

describe('confirmation dialog semantics', () => {
  it.each([
    ['src/views/CategoryManagement.vue', '确定删除品类'],
    ['src/components/journal/JournalWorkspace.vue', '确认删除《'],
    ['src/views/CloudShowcase.vue', '确认删除「'],
    ['src/components/ShowcaseManager.vue', '确认删除该展柜'],
    ['src/views/admin/AdminGamification.vue', '会同时删除其成就规则'],
    ['src/views/admin/AdminIPCharacterManagement.vue', '确认删除角色'],
    ['src/views/admin/AdminThemeManagement.vue', '删除主题'],
    ['src/views/admin/GoodsCraftManagement.vue', '确认删除工艺'],
    ['src/views/admin/GoodsManagement.vue', '确定删除谷子'],
    ['src/views/admin/UserManagement.vue', '拒绝后会直接删除账号'],
    ['src/views/club/ClubGamification.vue', '确认删除奖励'],
    ['src/views/goods-form/components/ImageCropper.vue', '放弃本次修改'],
    ['src/views/goods-form/composables/useAdditionalPhotos.ts', '删除这张图片'],
    ['src/views/goods-form/composables/useGoodsForm.ts', '重置表单吗'],
    ['src/views/IPCharacterManagement.vue', '删除作品'],
    ['src/views/LocationManagement.vue', '确认删除'],
    ['src/views/PreorderManagement.vue', '标记为已补款'],
    ['src/views/profile/ProfileAccount.vue', '恢复为默认首字母头像'],
    ['src/views/ThemeManagement.vue', '确定删除主题'],
    ['src/views/club/ClubGoodsEditor.vue', '当前页面有未保存的修改'],
  ])('%s marks destructive confirmation as danger', (relativePath, messageFragment) => {
    expect(confirmSnippet(relativePath, messageFragment)).toContain("confirmButtonType: 'danger'")
  })

  it('keeps reversible batch delete-or-unlist dynamic semantics', () => {
    const snippet = confirmSnippet('src/views/club/ClubGoods.vue', '条社团谷子吗')
    expect(snippet).toContain("confirmButtonType: action === 'delete' ? 'danger' : 'primary'")
  })

  it.each([
    ['src/views/admin/BGMSyncManagement.vue', '可能需要较长时间'],
    ['src/views/CloudShowcase.vue', '退出多选后将清空选择'],
    ['src/views/GoodsForm.vue', '是否将数量加 1'],
  ])('%s does not mark reversible confirmation as danger', (relativePath, messageFragment) => {
    expect(confirmSnippet(relativePath, messageFragment)).not.toContain("confirmButtonType: 'danger'")
  })
})
