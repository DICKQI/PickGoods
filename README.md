# 拾谷 · PickGoods

<div align="center">

> 面向「吃谷人」的个人谷子资产管理与检索系统

[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)](frontend/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](frontend/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](backend/)
[![Django](https://img.shields.io/badge/Django-5.2+-green.svg)](backend/)
[![DRF](https://img.shields.io/badge/DRF-3.14+-red.svg)](backend/)

</div>

---

## 项目结构

```
PickGoods/
├── frontend/          # Vue 3 + TypeScript + Vite 前端
│   ├── src/
│   ├── package.json
│   └── README.md
├── backend/           # Django 5.2 + DRF 后端
│   ├── apps/
│   ├── manage.py
│   └── README.md
└── README.md
```

## 快速开始

### 后端

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

后端开发服务器默认运行在 `http://127.0.0.1:8000`。

### 前端

```bash
cd frontend
pnpm install
pnpm dev
```

前端开发服务器默认运行在 `http://localhost:5173`，Vite 已配置将 `/api` 代理到 `http://127.0.0.1:8000`。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Element Plus + Pinia | SPA 应用，支持 Capacitor 移动端 |
| 后端 | Django 5.2 + DRF | RESTful API，JWT 认证 |
| 数据库 | SQLite（开发）/ PostgreSQL（生产） | 多用户数据隔离 |

## 文档

- [前端 README](frontend/README.md)
- [后端 README](backend/README.md)
- [后端 API 文档](backend/api.md)
- [前端开发指南](frontend/docs/DEVELOPMENT.md)

## 许可证

MIT
