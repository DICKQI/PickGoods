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
