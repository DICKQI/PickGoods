# 拾谷 PickGoods

> 面向谷子、动漫和游戏周边收藏者的个人资产管理系统。

**当前版本：`v1.5.1`**

**Vue 3 · Django 6 · Django REST Framework · Capacitor 8 · Android**

拾谷把收藏从“堆在柜子里的东西”整理成可检索、可统计、可展示的数字档案：录入谷子、整理位置、记录预购、查看角色厨力、制作云展柜和手帐，再通过移动端随时浏览。

[界面预览](#preview) · [核心能力](#features) · [架构与技术栈](#architecture) · [快速开始](#quick-start) · [文档导航](#docs)

<a id="preview"></a>
## 界面预览

| PC 端 | 移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-barn.png" width="720" alt="拾谷谷仓 PC 界面"> | <img src="docs/images/readme/mobile-barn.png" width="220" alt="拾谷谷仓移动端界面"> |

<a id="features"></a>
## 收藏全流程

```text
资产录入 → 详情归档 → 检索整理 → 资产统计 → 角色厨力 → 云展柜 / 手帐 → 分享展示
                         ↘ 预购提醒      ↘ 社团浏览
```

从单件谷子的图片、价格、状态和收纳位置，到 IP、角色、品类和主题的长期积累，拾谷覆盖收藏管理的完整生命周期。

---

## 谷仓与谷子详情

按关键词、IP、角色、品类、主题、状态、位置和官谷属性组合检索。卡片列表支持标准视图与融合主图指纹的相似浏览；打开详情后可查看主图、附加图片、购买信息、收纳位置、备注和同主题收藏。

| PC 端 | 移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-barn.png" width="720" alt="谷仓 PC 界面"> | <img src="docs/images/readme/mobile-barn.png" width="220" alt="谷仓移动端界面"> |

| 谷子详情 PC 端 | 谷子详情移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-goods-detail.png" width="720" alt="谷子详情 PC 界面"> | <img src="docs/images/readme/mobile-goods-detail.png" width="220" alt="谷子详情移动端界面"> |

- 支持主图、附加图片、图片裁剪、图片标签和图片品类识别。
- 支持订单截图 OCR 批量录入，识别商品名、价格、店铺和下单日期。
- 支持拍图找同款，通过视觉匹配快速定位已有收藏。
- 新建时检测疑似重复记录，由用户选择继续新建或合并。

## 云展柜

创建公开或私有展柜，维护封面、说明和谷子顺序。按品类展示木质吧唧展架、纸制品收纳册和普通收藏列表，移动端提供沉浸式全屏浏览。

| PC 端 | 移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-showcase.png" width="720" alt="云展柜 PC 界面"> | <img src="docs/images/readme/mobile-showcase.png" width="220" alt="云展柜移动端界面"> |

## 手帐工作台

手帐支持多本管理、自由画布、贴图、文字、形状、手绘、图层、版本恢复、公开分享和 PNG/长图导出。PC 端适合精细编辑，移动端提供沉浸式画布、双指缩放和平移。

| PC 端 | 移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-journal.png" width="720" alt="手帐工作台 PC 界面"> | <img src="docs/images/readme/mobile-journal.png" width="220" alt="手帐列表移动端界面"> |

## 统计看板

资产概览包含谷子件数、总数量、估算总金额、状态分布、官谷/同人、作品类型、IP TopN 和品类 TopN。筛选条件支持 TopN、官谷属性、状态、IP、品类、入手日期和录入日期。

| PC 端 | 移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-stats.png" width="720" alt="统计看板 PC 界面"> | <img src="docs/images/readme/mobile-stats.png" width="220" alt="统计看板移动端界面"> |

## 角色厨力

统计看板支持按角色直达厨力档案，查看厨力分数、等级、全站排名、估算投入、谷子件数、总数量和品类广度，并展示状态、官谷/同人、消费趋势、品类 Top 和全站厨力排行。

| 流萤厨力档案 PC 端 | 流萤厨力档案移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-character-stats-liuying.png" width="720" alt="流萤角色厨力 PC 界面"> | <img src="docs/images/readme/mobile-character-stats-liuying.png" width="220" alt="流萤角色厨力移动端界面"> |

## 预购与尾款提醒

记录手办、周边和其他外部平台预购，跟踪定金、尾款、补款时间、订单截图和转化关系。临近补款、已到补款期、补款取消和预购转正都会生成站内通知。

| PC 端 | 移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-preorders.png" width="720" alt="预购管理 PC 界面"> | <img src="docs/images/readme/mobile-preorders.png" width="220" alt="预购管理移动端界面"> |

## 社团目录与详情

社团目录支持关键词搜索、平台店铺入口、社团谷子预览和个性化推荐。社团详情页展示社团资料、公开谷子、筛选排序、收藏状态和加入谷仓入口；社团账号使用独立工作台管理上架谷子、主题、人气和资料。

| 社团目录 PC 端 | 社团目录移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-clubs.png" width="720" alt="社团目录 PC 界面"> | <img src="docs/images/readme/mobile-clubs.png" width="220" alt="社团目录移动端界面"> |

| 社团详情 PC 端 | 社团详情移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-club-detail.png" width="720" alt="社团详情 PC 界面"> | <img src="docs/images/readme/mobile-club-detail.png" width="220" alt="社团详情移动端界面"> |

## 位置与整理

使用树形位置描述房间、柜子、层板、抽屉等收纳空间。位置作业台支持节点维护、谷子移动、未分配谷子处理和位置摘要，让每件收藏都能找到自己的位置。

| PC 端 | 移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-location.png" width="720" alt="位置作业台 PC 界面"> | <img src="docs/images/readme/mobile-location.png" width="220" alt="位置作业台移动端界面"> |

## 资料库

统一维护 IP、角色、关键词、角色头像、树形品类、颜色、形状类型、主题和主题图片池。支持中文与拼音首字母检索，也能从 Bangumi 搜索作品和角色并进行增量同步。

| PC 端 | 移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-metadata.png" width="720" alt="IP 与角色 PC 界面"> | <img src="docs/images/readme/mobile-metadata.png" width="220" alt="IP 与角色移动端界面"> |

## 资产录入与识别

完整表单覆盖 IP、角色、品类、主题、状态、位置、数量、购入价格、入手日期、工艺、备注和图片。桌面端信息密度更高，移动端采用分步式表单，并提供草稿、历史裁剪、OCR 和图片匹配能力。

| PC 端 | 移动端 |
| --- | --- |
| <img src="docs/images/readme/pc-goods-form.png" width="720" alt="新增谷子 PC 界面"> | <img src="docs/images/readme/mobile-goods-form.png" width="220" alt="新增谷子移动端界面"> |

---

<a id="architecture"></a>
## 架构与技术栈

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
          +-- DINOv2-small + pHash
```

| 层级 | 主要技术 |
| --- | --- |
| 前端 | Vue 3.5、TypeScript 5.9、Vite 7、Element Plus、Pinia、Vue Router |
| 交互与可视化 | ECharts、Konva、SortableJS、vue-picture-cropper、pinyin-pro |
| 移动端 | Capacitor 8、Android、相机、网络和状态栏插件 |
| 后端 | Python、Django 6、Django REST Framework、django-filter |
| 数据与媒体 | SQLite、Pillow、OpenCV、NumPy |
| OCR 与匹配 | PaddleOCR 3、PaddlePaddle 3、jieba、RapidFuzz、ONNX Runtime |
| 外部集成 | Bangumi API、APScheduler |
| API 文档 | drf-spectacular、Swagger UI、Redoc |

### 目录结构

```text
PickGoods/
├─ frontend/                 # Vue 3 前端和 Capacitor 移动端
│  ├─ src/api/               # API 请求与共享类型
│  ├─ src/components/        # 通用、展柜、手帐和统计组件
│  ├─ src/router/            # 页面路由和鉴权守卫
│  ├─ src/stores/            # Pinia 状态管理
│  ├─ src/views/             # 页面级组件
│  └─ docs/                  # 前端专题文档
├─ backend/                  # Django REST API
│  ├─ ShiGu/                 # Django 配置与根路由
│  ├─ apps/goods/            # 谷子、元数据、展柜、手帐和 BGM
│  ├─ apps/location/         # 树形收纳位置
│  ├─ apps/ocr/              # 订单 OCR
│  ├─ apps/admin_api/        # 管理员 REST API
│  └─ core/                  # JWT、认证和权限
├─ docs/
│  └─ images/readme/         # README 双端界面截图
├─ CHANGELOG.md
└─ README.md
```

### 安全与数据边界

- 使用自定义 HS256 JWT，Token 默认有效期 7 天。
- 谷子、主题、展柜、手帐和位置数据按用户隔离。
- IP、角色、品类等公共元数据由管理员维护。
- 检索、OCR 和公开手帐接口配置独立限流。
- SQLite 是当前代码的默认数据库，可通过 `PICKGOODS_DB_PATH` 指定数据库文件。

<a id="quick-start"></a>
## 快速开始

仓库没有根目录编排脚本，前后端需要分别安装和启动。

### 1. 启动后端

建议使用 Python 3.12 或更高版本，并确认当前平台能够安装 PaddlePaddle 3.0。

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
# PICKGOODS_DB_PATH=可选的 SQLite 数据库文件路径
```

初始化并启动：

```powershell
python manage.py migrate
python manage.py seed_users --admin-username admin --admin-password "请替换为强密码"
python manage.py runserver
```

后端默认地址为 `http://127.0.0.1:8000`。

### 2. 启动前端

前端要求 Node.js `^20.19.0 || >=22.12.0`，建议使用 pnpm 9。

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

### 3. Android APK

```powershell
cd frontend
pnpm build
pnpm exec cap sync android
cd android
.\gradlew.bat assembleDebug
```

详细流程和原生注意事项参见 [移动端开发说明](frontend/docs/MOBILE_DEVELOPMENT.md)。

---

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
python manage.py download_goods_match_model
python manage.py rebuild_goods_image_index
python manage.py prune_goods_match_attempts
```

## 主要入口

| 入口 | 地址或路由 |
| --- | --- |
| 云展柜首页 | `/showcase` |
| 社团目录与详情 | `/clubs`、`/clubs/:id` |
| 社团工作台 | `/club/*` |
| 新增和编辑谷子 | `/goods/new`、`/goods/:id/edit` |
| 草稿箱 | `/goods/drafts` |
| 位置作业台 | `/location` |
| IP 与角色 | `/ipcharacter` |
| 角色厨力 | `/characters/:id/stats` |
| 品类管理 | `/category` |
| 主题管理 | `/theme` |
| 预购管理 | `/preorders` |
| 个人中心 | `/profile/*` |
| 管理后台 | `/admin/*` |
| Django Admin | `/admin/` |
| Swagger UI | `/api/schema/swagger-ui/` |
| Redoc | `/api/schema/redoc/` |

## API 模块

- `/api/auth/`：验证码、注册、登录、当前用户、头像和登出。
- `/api/goods/`：谷子 CRUD、检索、统计、图片、排序、品类识别和拍图匹配。
- `/api/ips/`、`/api/characters/`、`/api/categories/`、`/api/themes/`：公共元数据与角色统计。
- `/api/showcases/`：展柜、展柜谷子和公开/私有列表。
- `/api/journals/`、`/api/journal-pages/`：手帐本、页面、版本和公开分享。
- `/api/location/`：位置树、摘要、节点移动和谷子归位。
- `/api/clubs/`：社团目录、详情、公开谷子、收藏和社团工作台。
- `/api/preorders/`：预购、提醒、延期和转库存。
- `/api/bgm/`：Bangumi 搜索与角色同步。
- `/api/ocr/recognize/`：订单截图 OCR。
- `/api/admin/`：管理员用户、工艺和 BGM 同步管理。

完整接口说明参见 [backend/api.md](backend/api.md) 和 [backend/admin_api.md](backend/admin_api.md)。

## 配置与部署注意事项

- 当前 `backend/ShiGu/settings.py` 默认使用 SQLite，并固定开启 `DEBUG`、全部主机和全部 CORS 来源，仅适合开发环境。
- 生产部署前必须调整 `DEBUG`、`ALLOWED_HOSTS`、CORS、静态文件和媒体文件配置。
- `frontend/deploy.cjs` 是本地 SFTP 部署脚本，可能包含服务器配置，禁止提交真实凭据。
- 移动端真机不能用 `localhost` 访问电脑上的后端，应配置局域网或线上 API 地址。
- BGM Access Token、Django 密钥和 JWT 密钥必须放入环境变量或 `.env`，不要写入源码。
- Java/Android 构建环境和 Capacitor 版本要求参见前端移动端文档。

<a id="docs"></a>
## 文档导航

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
