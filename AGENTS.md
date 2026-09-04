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

## Android APK 构建流程与坑

- 文档流程：`pnpm build` → `npx cap sync android` → `android/gradlew.bat assembleDebug`，产物在 `android/app/build/outputs/apk/debug/app-debug.apk`。
- `@capacitor-community/http@1.4.1` 缺少 AGP 8 必需的 namespace，靠 `package.json` 里 `pnpm.patchedDependencies`（patches/@capacitor-community__http@1.4.1.patch）修复。注意：
  - 文件名是 pnpm 原生补丁格式（`__` 双下划线），`npx patch-package` 不认识（报 Unrecognized patch file），必须用 `pnpm install` 应用；补丁未生效时 `CI=true pnpm install` 会重建 node_modules 并打上补丁。
- pnpm 打补丁后插件目录会变成 `.pnpm/@capacitor-community+http@1.4.1_patch_hash=xxx/`，`android/capacitor.settings.gradle` 里的旧路径失效（Gradle 报 "No variants exist"）。所以 **pnpm install 之后必须重新 `npx cap sync android`** 再跑 Gradle。
- Android WebView 在页面顶部或底部会对整个 WebView 应用 stretch overscroll，导致固定的移动端底部 Tab 也跟着拉伸。除 Web 层保留 `overscroll-behavior: none` 外，必须在 `frontend/android/app/src/main/java/com/pickgoods/app/MainActivity.java` 的 `onCreate` 中，在 `super.onCreate(savedInstanceState)` 之后执行 `getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER)`，并导入 `android.view.View`。
- `frontend/android/` 当前被 `.gitignore` 忽略。如果新环境中该目录不存在，先执行 `pnpm build` 和 `pnpm exec cap add android`，再检查并重新应用上述 `MainActivity` 原生设置；`npx cap sync android` 不应覆盖这项自定义设置。仅修改 Vue/CSS 不能替代该原生设置。
