# Repository Guidelines

## Project Structure & Module Organization

This two-project monorepo has no root orchestration. Run commands from each project directory.

- `frontend/`: Vue 3 + Vite + TypeScript app with Element Plus and Pinia.
- `frontend/src/`: app code in `api/`, `components/`, `router/`, `stores/`, `utils/`, and `views/`.
- `frontend/src/__tests__/`: Vitest tests.
- `backend/`: Django 6.x + DRF project.
- `backend/apps/`: apps for `goods`, `location`, `users`, `admin_api`, and `ocr`.
- `docs/` and README files: mostly Chinese project and API docs.

## Build, Test, and Development Commands

Use pnpm only for frontend work; `frontend/package.json` requires pnpm 9+.

| Task | Command | Directory |
| --- | --- | --- |
| Install frontend deps | `pnpm install` | `frontend/` |
| Frontend dev server | `pnpm dev` | `frontend/` |
| Type-check | `pnpm type-check` | `frontend/` |
| Lint with auto-fix | `pnpm lint` | `frontend/` |
| Unit tests | `pnpm test:unit` | `frontend/` |
| Build | `pnpm build` | `frontend/` |
| Install backend deps | `pip install -r requirements.txt` | `backend/` |
| Migrate database | `python manage.py migrate` | `backend/` |
| Backend dev server | `python manage.py runserver` | `backend/` |
| Backend tests | `python manage.py test` | `backend/` |

The Vite dev proxy sends `/api` to `http://127.0.0.1:8000`, so run Django alongside Vite.

## Coding Style & Naming Conventions

Vue components use PascalCase filenames, `<script setup>`, and scoped styles. Add API types in `frontend/src/api/types.ts`, wrap calls in `frontend/src/api/*.ts`, and consume them from stores or views. ESLint uses `frontend/eslint.config.ts`.

Do not edit `frontend/tsconfig.json` directly. Update `tsconfig.app.json`, `tsconfig.node.json`, or `tsconfig.vitest.json`.

Backend code follows Django/DRF conventions. Auth uses custom JWT via `core.authentication.JWTAuthentication`, not `djangorestframework-simplejwt`.

## Testing Guidelines

Frontend tests use Vitest with jsdom. Place specs under `frontend/src/__tests__/` or near the feature. Run `pnpm test:unit` and `pnpm type-check`.

Backend tests use Django's runner. Add tests in the relevant app when changing API, model, auth, or OCR behavior.

## Commit & Pull Request Guidelines

Recent commits use short conventional prefixes, often with Chinese descriptions, such as `feat: ...`, `fix: ...`, and `release: v1.2.3`.

Pull requests should include a summary, verification commands, linked issue or context, and screenshots for UI changes.

## Security & Configuration Tips

`deploy.cjs` is gitignored because it contains SFTP credentials; do not commit local secrets. Backend uses SQLite by default and PostgreSQL in production. CORS is wide open in development; review settings before release.

## Element Plus 抽屉（el-drawer）与移动端滚动锁踩坑

- el-drawer 内部 DOM（`.el-overlay`/`.el-drawer`/`.el-drawer__body`）不携带组件的 scoped 属性，SFC 里 `:deep(.el-drawer__body)` 永远命中不了，body 会保持 EP 默认 `padding:20px; overflow:auto`（多出滚动条、布局塌陷）。必须用 `:global(.组件专属类名 .el-drawer__body)` 覆盖（ClubDetail/LocationManagement 已是此模式；GoodsDrawer 仍是失效的 `:deep` 写法，待迁移）。
- 移动端打开抽屉锁 body 滚动时，不要用 `transform: translateY(-scrollTop)` 保留滚动位置：transform 会把 body 变成 fixed 后代（el-overlay 遮罩、抽屉）的包含块，遮罩和抽屉会随页面滚动整体偏移、无法贴住视口。应改用 `position: fixed; top: -scrollTop px`。

## 移动端滚动收缩标题（JournalLibrary / 预购页）

- 手帐列表的“我的手帐”标题使用 `position: sticky`；预购页使用“标题区固定 + 列表独立滚动”的 flex 布局，标题必须放在滚动容器之外，列表不能进入标题下面。两种实现都固定保留约 6px 的顶部标签间距，展开态和收缩态不要切换不同的 `top`，否则顶部会产生跳动。
- 预购页列表必须使用独立滚动容器，并把 `useMobilePullRefresh` 的 `getScrollTop` 指向该容器。无限滚动 `IntersectionObserver` 的 `root` 也必须指向同一容器，不能继续依赖 `window` 滚动。
- 预购页标题收缩会同时增大列表视口。列表末尾必须同步补足与展开区等高的透明滚动缓冲；否则浏览器会把 `scrollTop` 钳制到 0，误触发展开并形成反复抖动。
- 独立滚动容器会在顶边裁切部分卡片，视觉上容易被误判为标题遮挡。预购页普通态保持约 12px 间距，紧凑态保留约 80px 顶部缓冲，避免标题收缩时首张卡片边框被裁掉。
- 手帐 sticky 方案使用标题前的 1px 哨兵元素判断收缩；不要直接用 `window.scrollY` 判断并同时播放高度动画，否则高度动画会改变文档布局和滚动位置，形成反馈抖动。预购页因标题不在滚动容器内，可以直接读取列表容器的 `scrollTop`。
- 进入收缩态：手帐由哨兵到达顶部标签栏底部触发，预购由列表容器滚动超过 `64px` 触发。恢复展开：只有实际回到滚动顶部 `scrollTop <= 2` 时才触发，不能在中间滚动位置恢复。
- 滚动监听使用 `requestAnimationFrame` 合并更新；标题设置 `overflow-anchor: none`，避免浏览器滚动锚定介入高度动画。
- 动画只改变 `min-height`、`padding`、`margin`、`opacity` 和字号；保留 `prefers-reduced-motion` 分支。
- 手帐列表紧凑态保留标题和手帐数量；预购页紧凑态只保留页面标题和当前状态筛选名，隐藏的展开内容需设置 `aria-hidden` 并保持组件内部状态不丢失。
- `JournalLibrary.spec.ts` 与 `PreorderManagementMobile.spec.ts` 必须覆盖向下滚动后收缩、中间位置保持收缩、回到顶部后展开、筛选名同步和哨兵判定的滞回行为。

## Android APK 构建流程与坑

- 文档流程：`pnpm build` → `npx cap sync android` → `android/gradlew.bat assembleDebug`，产物在 `android/app/build/outputs/apk/debug/app-debug.apk`。
- `@capacitor-community/http@1.4.1` 缺少 AGP 8 必需的 namespace，靠 `package.json` 里 `pnpm.patchedDependencies`（patches/@capacitor-community__http@1.4.1.patch）修复。注意：
  - 文件名是 pnpm 原生补丁格式（`__` 双下划线），`npx patch-package` 不认识（报 Unrecognized patch file），必须用 `pnpm install` 应用；补丁未生效时 `CI=true pnpm install` 会重建 node_modules 并打上补丁。
- pnpm 打补丁后插件目录会变成 `.pnpm/@capacitor-community+http@1.4.1_patch_hash=xxx/`，`android/capacitor.settings.gradle` 里的旧路径失效（Gradle 报 "No variants exist"）。所以 **pnpm install 之后必须重新 `npx cap sync android`** 再跑 Gradle。
- Android WebView 在页面顶部或底部会对整个 WebView 应用 stretch overscroll，导致固定的移动端底部 Tab 也跟着拉伸。除 Web 层保留 `overscroll-behavior: none` 外，必须在 `frontend/android/app/src/main/java/com/pickgoods/app/MainActivity.java` 的 `onCreate` 中，在 `super.onCreate(savedInstanceState)` 之后执行 `getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER)`，并导入 `android.view.View`。
- `frontend/android/` 当前被 `.gitignore` 忽略。如果新环境中该目录不存在，先执行 `pnpm build` 和 `pnpm exec cap add android`，再检查并重新应用上述 `MainActivity` 原生设置；`npx cap sync android` 不应覆盖这项自定义设置。仅修改 Vue/CSS 不能替代该原生设置。
