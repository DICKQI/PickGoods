/* Isolated browser QA: every API call is fulfilled locally; no business data writes. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const output = path.resolve(process.env.MOBILE_QA_OUTPUT || 'artifacts/mobile-navigation')
const base = process.env.MOBILE_QA_URL || 'http://localhost:5173'
const category = { id: 1, name: '徽章', path_name: '徽章', parent: null, order: 1, color_tag: '#d4af37' }
const ip = { id: 1, name: '星光旅途' }
const goods = Array.from({ length: 14 }, (_, i) => ({
  id: `qa-${i}`, name: ['春日限定徽章', '星光纪念票', '旅行立牌'][i % 3], main_photo: '',
  is_official: i % 2 === 0, quantity: 1, ip, characters: [], category, location_path: '展示柜', status: 'in_cabinet',
}))
const club = { id: 1, name: '星光手作社', slug: 'qa', avatar: '', description: '收藏每一份小小的喜爱。', goods_count: 0, favorite_count: 0, is_favorited: false, store_links: [] }
const envelope = results => ({ count: results.length, results, next: null, previous: null, page: 1, page_size: 20 })
async function fixture(context, identity) {
  await context.addInitScript(({ identity }) => {
    if (identity !== 'anonymous') localStorage.setItem('pickgoods_access_token', 'isolated-ui-fixture')
  }, { identity })
  await context.route('**/api/**', async route => {
    const p = new URL(route.request().url()).pathname
    if (!p.startsWith('/api/')) return route.continue()
    let data = envelope([])
    if (p === '/api/auth/me/') data = { id: 91001, username: '界面验收', role: identity === 'admin' ? 'Admin' : 'User', account_type: identity === 'club' ? 'club' : 'collector', approval_status: 'approved', club: identity === 'club' ? club : null }
    else if (p === '/api/goods/') data = envelope(goods)
    else if (p === '/api/clubs/' ) data = envelope([club])
    else if (p === '/api/clubs/me/' || p === '/api/clubs/1/') data = club
    else if (p.includes('unread-count')) data = { count: 0, unread_count: 0 }
    else if (p.includes('/popularity')) data = { items: [], summary: { total: 0, listed: 0, intended_user_count: 0, acquired_user_count: 0 } }
    else if (p.includes('/preorders/stats')) data = { pending_count: 0, due_this_month: 0, overdue_count: 0, total_deposit: '0', total_balance: '0' }
    else if (p.includes('/goods/stats')) data = {
      meta: { top: 5, group_by: 'month', purchase_start: null, purchase_end: null, created_start: null, created_end: null },
      overview: { goods_count: goods.length, quantity_sum: goods.length, value_sum: '0.00', with_price_count: 0, missing_price_count: 0, with_purchase_date_count: 0, missing_purchase_date_count: 0, with_location_count: 0, missing_location_count: 0, with_main_photo_count: 0, missing_main_photo_count: 0 },
      distributions: {
        status: [{ status: 'in_cabinet', label: '在馆', goods_count: goods.length, quantity_sum: goods.length }],
        is_official: [{ is_official: true, label: '官谷', goods_count: goods.length, quantity_sum: goods.length }],
        ip_subject_type: [{ ip__subject_type: 1, label: '动画', goods_count: goods.length, quantity_sum: goods.length }],
        ip_top: [], category_top: [], craft_top: [], character_top: [], monthly_trend: [],
      },
    }
    else if (p.includes('/categories')) data = [category]
    else if (p.includes('/ips')) data = [ip]
    else if (p.includes('/characters') || p.includes('/themes') || p.includes('/location/tree') || p.includes('/location/nodes') || p.includes('/goods-crafts')) data = []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
}

async function run() {
  await fs.mkdir(output, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const report = []
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
      recordVideo: { dir: output, size: { width: 390, height: 844 } },
      reducedMotion: 'no-preference',
    })
    await fixture(context, 'collector')
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/showcase?tab=barn`)
    await page.waitForTimeout(1500)
    await page.locator('.goods-grid article').first().waitFor()
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 })
      await page.waitForTimeout(200)
      const geometry = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect()
        const header = rect('.mobile-page-header'), search = rect('.barn-discovery'), card = rect('.goods-grid article'), paper = rect('.note-paper.is-selected')
        return { width: innerWidth, headerHeight: header.height, overflow: document.documentElement.scrollWidth > innerWidth, topGap: search.top - header.bottom, bottomGap: card.top - search.bottom, paperGap: header.bottom - paper.bottom }
      })
      assert.equal(geometry.overflow, false)
      assert.equal(geometry.headerHeight, 44)
      assert.ok(Math.abs(geometry.topGap - 12) < 1, JSON.stringify(geometry))
      assert.ok(Math.abs(geometry.bottomGap - 12) < 1, JSON.stringify(geometry))
      assert.ok(Math.abs(geometry.paperGap) < 1, JSON.stringify(geometry))
      report.push(geometry)
      await page.screenshot({ path: path.join(output, `showcase-${width}.png`) })
    }
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(150)
    assert.equal(await page.locator('.mobile-bottom-nav.is-scroll-hidden').count(), 1)
    await page.waitForTimeout(700)
    assert.equal(await page.locator('.mobile-bottom-nav.is-scroll-hidden').count(), 0)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForTimeout(700)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: '打开快捷操作' }).click()
    await page.getByRole('menuitem', { name: '草稿箱' }).waitFor()
    await page.screenshot({ path: path.join(output, 'quick-actions.png') })
    await page.getByRole('button', { name: '关闭快捷操作' }).click()
    await page.getByRole('button', { name: '搜索', exact: true }).click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(output, 'search-expanded.png') })
    await page.getByRole('link', { name: '整理', exact: true }).click()
    await page.getByRole('navigation', { name: '页面导航' }).waitFor()
    await page.getByRole('link', { name: '品类', exact: true }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(output, 'organize.png') })
    await page.getByRole('link', { name: '主题', exact: true }).click()
    await page.waitForTimeout(120)
    await page.getByRole('link', { name: '品类', exact: true }).click()
    await page.waitForTimeout(400)
    // 手势切页：越过阈值立即切换，页面不跟手，也没有任何轨道元素。
    // 用真实触摸序列（CDP Input.dispatchTouchEvent），鼠标拖拽会触发图片原生拖放而中断手势。
    const touchClient = await context.newCDPSession(page)
    const gestureAt = async (from, to, steps = 6) => {
      const point = (x, y) => [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }]
      await touchClient.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from.x, from.y) })
      for (let step = 1; step <= steps; step += 1) {
        await touchClient.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: point(from.x + (to.x - from.x) * step / steps, from.y + (to.y - from.y) * step / steps),
        })
        await page.waitForTimeout(16)
      }
      await touchClient.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(500)
    }
    const gesture = async (fromRatio, toRatio) => {
      const box = await page.locator('.main-content').boundingBox()
      const y = box.y + Math.min(200, box.height / 3)
      const startX = box.x + box.width * fromRatio
      const endX = box.x + box.width * toRatio
      await gestureAt({ x: startX, y }, { x: endX, y })
    }
    // 左滑 = 下一个标签（品类 → 主题）
    await gesture(0.85, 0.15)
    assert.equal(new URL(page.url()).pathname, '/theme')
    assert.equal((await page.locator('.note-paper.is-selected').textContent()).trim(), '主题')
    assert.equal(await page.locator('.mobile-swipe-viewport, .mobile-swipe-track, .mobile-swipe-layer').count(), 0)
    // 右滑 = 上一个标签（主题 → 品类）
    await gesture(0.15, 0.85)
    assert.equal(new URL(page.url()).pathname, '/category')
    assert.equal((await page.locator('.note-paper.is-selected').textContent()).trim(), '品类')
    await page.goto(`${base}/showcase?tab=showcase`)
    await page.locator('.main-content').waitFor()
    await page.waitForTimeout(400)
    await gesture(0.15, 0.85)
    assert.equal(new URL(page.url()).pathname, '/clubs')
    // 统计看板：手指落在图表 canvas（卡片主体）上同样要能切页，只有自管手势的元素才让路
    await page.goto(`${base}/showcase?tab=stats`)
    await page.locator('.chart-container canvas').first().waitFor()
    await page.waitForTimeout(900)
    const chartBox = await page.locator('.chart-container canvas').first().boundingBox()
    await gestureAt({ x: Math.round(chartBox.x + chartBox.width * 0.8), y: Math.round(chartBox.y + chartBox.height * 0.5) }, { x: Math.round(chartBox.x + chartBox.width * 0.1), y: Math.round(chartBox.y + chartBox.height * 0.5) })
    // 统计是云展柜大区最后一个标签，下一个是整理大区的「位置」
    assert.equal(new URL(page.url()).pathname, '/location')
    report.push({ gesture: { withinRegion: '/category -> /theme -> /category', crossRegion: '/showcase -> /clubs', onChartCanvas: '/showcase?tab=stats -> /location' } })
    // 预购页：标题 + 看板 + 状态筛选用 fixed 钉在标签栏下方，滚动时纹丝不动；
    // 下拉刷新提示条固定挂在看板下方（而不是盖在看板上方）。
    await page.goto(`${base}/preorders`)
    await page.locator('.preorder-mobile-sticky').waitFor()
    await page.waitForTimeout(500)
    const preorderHeader = await page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector)
        if (!element) return null
        const box = element.getBoundingClientRect()
        return { top: Math.round(box.top), bottom: Math.round(box.bottom), height: Math.round(box.height) }
      }
      return { sticky: rect('.preorder-mobile-sticky'), spacer: rect('.preorder-mobile-sticky-spacer'), indicator: rect('.mobile-pull-indicator') }
    })
    assert.ok(preorderHeader.sticky && preorderHeader.spacer && preorderHeader.indicator, JSON.stringify(preorderHeader))
    assert.equal(preorderHeader.sticky.height, preorderHeader.spacer.height)
    assert.equal(preorderHeader.indicator.top, preorderHeader.sticky.bottom)
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(400)
    const stickyAfterScroll = await page.locator('.preorder-mobile-sticky').evaluate(el => Math.round(el.getBoundingClientRect().top))
    assert.equal(stickyAfterScroll, preorderHeader.sticky.top)
    assert.ok(await page.locator('.mobile-pull-indicator').count() === 1)
    report.push({ preorderHeader: { ...preorderHeader, stickyAfterScroll } })
    await page.getByRole('link', { name: '我的', exact: true }).click()
    await page.locator('.account-page').waitFor()
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(output, 'profile.png') })
    await page.getByRole('link', { name: '设置', exact: true }).click()
    await page.getByRole('link', { name: 'GitHub · 项目主页' }).waitFor()
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(output, 'settings.png') })
    // 预购属于云展柜大区，底栏「云展柜」回到该大区最后访问的标签（即当前页），不是固定回谷仓
    const cloudModuleHref = await page.getByRole('link', { name: '云展柜', exact: true }).first().getAttribute('href')
    assert.equal(cloudModuleHref, '/preorders')
    report.push({ bottomNavModuleMemory: cloudModuleHref })
    await page.goto(`${base}/showcase?tab=barn`)
    await page.locator('.goods-grid article').first().waitFor()
    assert.equal(new URL(page.url()).searchParams.get('tab'), 'barn')
    await page.goto(`${base}/goods/new`)
    await page.locator('.goods-form').waitFor()
    assert.equal(await page.locator('.mobile-bottom-nav').count(), 0)
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(output, 'editor.png') })
    await page.goto(`${base}/clubs`)
    await page.locator('.directory-search').waitFor()
    assert.equal(await page.locator('.mobile-page-header').count(), 0)
    const clubSearch = await page.evaluate(() => { const r = document.querySelector('.directory-search').getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: innerWidth } })
    assert.ok(clubSearch.left <= 16 && clubSearch.right >= clubSearch.width - 16, JSON.stringify(clubSearch))
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.locator('.navbar').waitFor()
    assert.equal(await page.locator('.mobile-page-header').count(), 0)
    await page.screenshot({ path: path.join(output, 'desktop.png') })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('link', { name: '我的', exact: true }).click()
    assert.equal(await page.locator('.nav-selection-pill').evaluate(el => getComputedStyle(el).transitionDuration), '0s')
    report.push({ identity: 'collector', errors })
    assert.deepEqual(errors, [])
    await context.close()
    await page.video().saveAs(path.join(output, 'navigation-demo.webm'))
    for (const identity of ['club', 'anonymous', 'admin']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
      await fixture(ctx, identity)
      const p = await ctx.newPage()
      const roleErrors = []
      p.on('pageerror', error => roleErrors.push(error.message))
      await p.goto(`${base}${identity === 'club' ? '/club/goods' : identity === 'anonymous' ? '/settings' : '/profile/account'}`)
      await p.locator('.mobile-bottom-nav').waitFor()
      assert.equal(await p.locator('.mobile-bottom-nav a').count(), identity === 'club' ? 3 : 4)
      if (identity === 'club') {
        assert.equal(await p.getByRole('button', { name: '通知中心' }).count(), 0)
        await p.getByRole('link', { name: '主题', exact: true }).click()
        await p.waitForTimeout(400)
      }
      if (identity === 'anonymous') await p.getByRole('link', { name: '登录账号' }).waitFor()
      if (identity === 'admin') {
        await p.getByRole('button', { name: '进入管理后台' }).waitFor()
        for (const route of ['/ipcharacter', '/category']) {
          for (const width of [320, 390]) {
          await p.setViewportSize({ width, height: 844 })
          await p.goto(`${base}${route}`)
          await p.locator('.mobile-inline-create').waitFor()
          await p.waitForTimeout(350)
          const alignment = await p.evaluate(() => {
            const button = document.querySelector('.mobile-inline-create').getBoundingClientRect()
            const card = document.querySelector('.search-card').getBoundingClientRect()
            const header = document.querySelector('.mobile-page-header').getBoundingClientRect()
            const search = document.querySelector('.search-flex .custom-search').getBoundingClientRect()
            return { buttonTop: button.top, cardTop: card.top, buttonBottom: button.bottom, cardBottom: card.bottom, gap: card.top - header.bottom, centerDelta: Math.abs((button.top + button.bottom - search.top - search.bottom) / 2), overflow: document.documentElement.scrollWidth > innerWidth }
          })
          assert.ok(alignment.buttonTop >= alignment.cardTop && alignment.buttonBottom <= alignment.cardBottom, JSON.stringify(alignment))
          assert.ok(alignment.gap <= 16, JSON.stringify(alignment))
          assert.ok(alignment.centerDelta < 2, JSON.stringify(alignment))
          assert.equal(alignment.overflow, false)
          await p.screenshot({ path: path.join(output, `admin-${route.slice(1)}-${width}.png`) })
          }
        }
      }
      await p.waitForTimeout(400)
      await p.screenshot({ path: path.join(output, `${identity}.png`) })
      assert.deepEqual(roleErrors, [])
      report.push({ identity, errors: roleErrors })
      await ctx.close()
    }
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
