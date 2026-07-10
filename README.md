# 拾谷 PickGoods

面向谷子、动漫和游戏周边收藏者的个人资产管理系统。项目采用 Vue 3 单页应用与 Django REST API 前后端分离架构，同时提供 Android 原生壳、订单 OCR、Bangumi 数据同步、云展柜和谷子手帐等能力。

当前版本：`v1.2.4post1`

## 项目能力

### 收藏管理

- 记录谷子名称、IP、角色、品类、工艺、主题、价格、数量、状态和入手日期。
- 支持主图、附加图片、图片裁剪、图片品类识别和订单截图 OCR 批量录入。
- 新建时检测疑似重复记录，由用户选择新建或合并。
- 支持草稿、官谷/同人、在柜/在途/已售等业务状态。

### 检索与统计

- 按关键词、IP、角色、品类、主题、状态、位置等条件组合检索。
- IP、角色、品类和统计筛选支持中文及拼音首字母检索。
- 提供资产概览、状态分布、官谷/同人分布、IP/角色/品类统计。
- 支持角色厨力统计和相似谷子随机浏览。

### 展柜与手帐

- 创建公开或私有云展柜，维护封面、说明和谷子排序。
- 按品类展示木质吧唧展架、纸制品收纳册和普通收藏列表。
- 移动端提供沉浸式全屏展柜和图片预览。
- 手帐支持多本管理、自由画布、贴图、文字、形状、手绘、图层、版本恢复、公开分享和 PNG 导出。

### 位置与元数据

- 使用树形位置描述房间、柜子、层板、抽屉等收纳空间。
- 通过位置工作台维护节点、移动谷子并处理未分配谷子。
- 管理 IP、角色、品类、主题、谷子工艺和主题模板。
- 从 Bangumi 搜索作品与角色，支持增量同步、自动同步和任务审计。

### 管理与安全

- 使用自实现 HS256 JWT 完成无状态认证。
- 用户资产、主题、展柜、手帐和位置数据按用户隔离。
- 管理员可维护用户、角色、谷子工艺和 Bangumi 自动同步任务。
- 检索、OCR 和公开手帐接口配置了独立限流。

## 技术架构

```text
Vue 3 + TypeScript + Vite
          |
          | REST API / JWT
          v
Django 6 + Django REST Framework
          |
          +-- SQLite
          +-- 本地媒体文件
          +-- Bangumi Open API
          +-- PaddleOCR
```

| 层级 | 主要技术 |
| --- | --- |
| 前端 | Vue 3.5、TypeScript 5.9、Vite 7、Element Plus、Pinia、Vue Router |
| 可视化与交互 | ECharts、Konva、SortableJS、vue-picture-cropper、pinyin-pro |
| 移动端 | Capacitor 8、Android、相机与网络插件 |
| 后端 | Python、Django 6、Django REST Framework、django-filter |
| 数据与媒体 | SQLite、Pillow、OpenCV、NumPy |
| OCR 与匹配 | PaddleOCR 3、jieba、RapidFuzz |
| 外部集成 | Bangumi API、APScheduler |
| API 文档 | drf-spectacular、Swagger UI、Redoc |

## 目录结构

```text
PickGoods/
├─ frontend/                 # Vue 3 前端和 Capacitor 移动端
│  ├─ src/
│  │  ├─ api/               # API 请求与共享类型
│  │  ├─ components/        # 通用、展柜、手帐和统计组件
│  │  ├─ router/            # 页面路由和鉴权守卫
│  │  ├─ stores/            # Pinia 状态管理
│  │  ├─ utils/             # 请求、树结构、手帐等工具
│  │  └─ views/             # 页面级组件
│  ├─ docs/                 # 前端专题文档
│  └─ package.json
├─ backend/                  # Django REST API
│  ├─ ShiGu/                # Django 配置与根路由
│  ├─ apps/
│  │  ├─ users/             # 用户、角色和认证
│  │  ├─ goods/             # 谷子、元数据、展柜、手帐和 BGM
│  │  ├─ location/          # 树形收纳位置
│  │  ├─ ocr/               # 订单 OCR
│  │  └─ admin_api/         # 管理员 REST API
│  ├─ core/                 # JWT、认证和权限
│  ├─ api.md                # 业务 API 文档
│  └─ requirements.txt
├─ docs/                    # 项目级文档
├─ CHANGELOG.md             # 版本记录
└─ README.md
```

## 快速开始

仓库没有根目录编排脚本，前后端需要分别安装和启动。

### 1. 启动后端

建议使用满足 Django 6.0 与 PaddlePaddle 3.0 要求的 Python 环境。

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt django-extensions drf-spectacular
Copy-Item .env.example .env
```

编辑 `backend/.env`，至少设置：

```env
DJANGO_SECRET_KEY=请替换为随机密钥
# JWT_SECRET=可选的独立 JWT 密钥
# BGM_ACCESS_TOKEN=可选的 Bangumi Access Token
```

初始化并启动：

```powershell
python manage.py migrate
python manage.py seed_users --admin-username admin --admin-password "请替换为强密码"
python manage.py runserver
```

后端默认地址为 `http://127.0.0.1:8000`。

### 2. 启动前端

前端要求 Node.js `^20.19.0 || >=22.12.0`，包管理器使用 pnpm 9。

```powershell
cd frontend
npx pnpm@9.15.4 install
npx pnpm@9.15.4 dev
```

Vite 通常运行在 `http://localhost:5173`，开发代理会将 `/api` 转发到 `http://127.0.0.1:8000`。

前端确定后端地址的优先级为：

1. 设置页保存的 `localStorage.pickgoods_api_base_url`
2. 兼容旧版本的 `localStorage.shigu_api_base_url`
3. 构建变量 `VITE_API_BASE_URL`
4. 当前页面主机的 `8000` 端口

## 常用命令

### 前端

```powershell
cd frontend
npx pnpm@9.15.4 dev
npx pnpm@9.15.4 type-check
npx pnpm@9.15.4 test:unit
npx pnpm@9.15.4 lint
npx pnpm@9.15.4 build
```

### 后端

```powershell
cd backend
python manage.py migrate
python manage.py test
python manage.py seed_all_test_data
python manage.py seed_category_shape_types
python manage.py rebalance_goods_order
python manage.py download_ocr_models
```

## 主要入口

| 入口 | 地址或路由 |
| --- | --- |
| 前端主界面 | `/showcase` |
| 新增谷子 | `/goods/new` |
| 草稿箱 | `/goods/drafts` |
| 位置工作台 | `/location` |
| IP 与角色 | `/ipcharacter` |
| 品类管理 | `/category` |
| 主题管理 | `/theme` |
| 管理后台 | `/admin/*` |
| Django Admin | `/admin/` |
| Swagger UI | `/api/schema/swagger-ui/` |
| Redoc | `/api/schema/redoc/` |

## API 模块

- `/api/auth/`：注册、登录、当前用户和登出。
- `/api/goods/`：谷子 CRUD、检索、统计、图片、排序和品类识别。
- `/api/ips/`、`/api/characters/`、`/api/categories/`、`/api/themes/`：公共元数据。
- `/api/showcases/`：展柜、展柜谷子和公开/私有列表。
- `/api/journals/`、`/api/journal-pages/`：手帐本、页面、版本和公开分享。
- `/api/location/`：位置树、摘要、节点移动和谷子归位。
- `/api/bgm/`：Bangumi 搜索与角色同步。
- `/api/ocr/recognize/`：订单截图 OCR。
- `/api/admin/`：管理员用户、工艺和 BGM 同步管理。

完整接口说明参见 [backend/api.md](backend/api.md) 和 [backend/admin_api.md](backend/admin_api.md)。

## 配置与部署注意事项

- 当前 `backend/ShiGu/settings.py` 默认使用 SQLite，并固定开启 `DEBUG`、全部主机和全部 CORS 来源，仅适合开发环境。
- 生产部署前必须调整 `DEBUG`、`ALLOWED_HOSTS`、CORS、数据库、静态文件和媒体文件配置。
- `frontend/deploy.cjs` 是本地 SFTP 部署脚本，可能包含服务器配置，禁止提交真实凭据。
- 移动端真机不能用 `localhost` 访问电脑上的后端，应配置局域网或线上 API 地址。
- BGM Access Token、Django 密钥和 JWT 密钥必须放入环境变量或 `.env`，不要写入源码。

## 文档

- [前端 README](frontend/README.md)
- [后端 README](backend/README.md)
- [版本记录](CHANGELOG.md)
- [前端功能说明](frontend/docs/FEATURES.md)
- [前端开发指南](frontend/docs/DEVELOPMENT.md)
- [前端 API 封装](frontend/docs/API.md)
- [前端部署说明](frontend/docs/DEPLOYMENT.md)
- [移动端开发](frontend/docs/MOBILE_DEVELOPMENT.md)
- [后端业务 API](backend/api.md)
- [管理员 API](backend/admin_api.md)

## 许可证

当前仓库未包含独立的 `LICENSE` 文件。公开发布或分发前，请补充明确的许可证文本。
