# AGENTS.md

## Overview

Two-project monorepo: Vue 3 frontend + Django/DRF backend. No orchestration tool — run each from its own directory.

## Quick reference

| Task | Command | Working Dir |
|------|---------|-------------|
| Install deps | `pnpm install` | `frontend/` |
| Dev server | `pnpm dev` | `frontend/` |
| Type-check | `pnpm type-check` | `frontend/` |
| Lint (auto-fix) | `pnpm lint` | `frontend/` |
| Unit tests | `pnpm test:unit` | `frontend/` |
| Production build | `pnpm build` | `frontend/` |
| Install deps | `pip install -r requirements.txt` | `backend/` |
| Dev server | `python manage.py runserver` | `backend/` |
| Migrations | `python manage.py migrate` | `backend/` |
| Tests | `python manage.py test` | `backend/` |

## Toolchain must-knows

- **pnpm only.** `package.json` declares `"packageManager": "pnpm@9.0.0"` and engines `pnpm >=9.0.0`. npm/yarn will error.
- **pnpm patches.** `@capacitor-community/http@1.4.1` has a pnpm patch in `frontend/patches/`. pnpm applies it automatically on install (no postinstall script needed).
- **ESLint flat config** at `frontend/eslint.config.ts`. No `.eslintrc.*` files.
- **Vite dev proxy:** `/api` → `http://127.0.0.1:8000`. Run the Django dev server alongside the Vite dev server.
- **TypeScript project references:** `tsconfig.json` references 3 sub-configs (`tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.vitest.json`). Do not modify `tsconfig.json` directly; edit the sub-configs.
- **Python 3.11+** required. Only one requirements file (`backend/requirements.txt`); no dev/prod split.
- **Django settings:** `DJANGO_SETTINGS_MODULE=ShiGu.settings`. SQLite by default; PostgreSQL in prod.
- **No CI/CD** configured. Verify locally: lint + type-check + test before changes.
- **`deploy.cjs`** is gitignored (contains SFTP credentials). The `pnpm deploy` script expects it to exist locally but it won't be in the repo.

## Architecture

```
frontend/  — Vue 3 + Vite + TypeScript + Element Plus + Pinia
backend/   — Django 6.x + DRF + custom JWT auth (HS256)
```

- Auth is custom JWT (`core/jwt.py`, `core/authentication.py`), **not** `djangorestframework-simplejwt`.
- Frontend stores token in localStorage; Axios injects it via interceptors (`src/utils/request.ts`).
- Backend URL resolution priority (in `src/utils/request.ts`): settings page override → env var `VITE_API_BASE_URL` → current origin port 8000.
- Backend apps live under `backend/apps/`: `goods`, `location`, `users`, `admin_api`, `ocr`.
- Custom management commands: `rebalance_goods_order`, `download_ocr_models`, `seed_users`.

## Testing notes

- Frontend: Vitest + jsdom. Tests in `src/__tests__/`. Only one spec exists (`App.spec.ts`).
- Backend: Django's built-in test runner. No test files found yet — tests may not be written.
- `pnpm build` runs type-check and build **in parallel** (via `run-p`). For sequential CI, use `pnpm type-check && pnpm build-only`.

## Conventions

- Vue components: PascalCase filenames, `<script setup>`, `<style scoped>`.
- New API calls: add types in `src/api/types.ts`, wrap in `src/api/*.ts`, consume in store/view.
- Backend: custom JWT auth class at `core.authentication.JWTAuthentication`; default permission is `IsAuthenticated`.
- DRF schema: `drf-spectacular` (Swagger at `/api/schema/swagger-ui/`, Redoc at `/api/schema/redoc/`).
- CORS: wide open in dev (`CORS_ALLOW_ALL_ORIGINS = True`).

## Documentation

Most docs are in Chinese and are reasonably thorough:

- `README.md` — root overview (366 lines)
- `backend/README.md` — backend architecture + API reference (926 lines)
- `backend/api.md` — full API doc (4299 lines)
- `frontend/README.md` — frontend overview
- `frontend/docs/DEVELOPMENT.md` — dev guide, routing table, conventions
- `frontend/docs/API.md` — frontend API integration notes
- `frontend/PM.txt` — product requirements (visual design spec)
