# 拾谷 PickGoods 后端

拾谷后端是基于 Django 6 和 Django REST Framework 构建的收藏资产管理 API，负责用户认证、谷子数据、树形位置、展柜、手帐、Bangumi 同步、订单 OCR 和管理员能力。

## 核心能力

### 用户与权限

- 自实现 HS256 JWT，不依赖 Simple JWT。
- Token 默认有效期为 7 天。
- 默认 API 权限为登录可用，认证接口和公开手帐接口单独放行。
- 谷子、主题、展柜、手帐和位置数据按用户过滤。
- IP、角色、品类等公共元数据由管理员维护。

### 谷子资产

- 关联 IP、多个角色、树形品类、主题、工艺和收纳位置。
- 记录数量、单价、状态、官谷/同人、入手日期、备注和图片。
- 支持主图、附加图片、图片标签和自动压缩。
- 支持组合筛选、全文搜索、分页、统计和相似随机查询。
- 创建时检测疑似重复记录，返回 `409 Conflict` 供前端确认新建或合并。
- 使用稀疏排序值和移动接口维护谷子顺序。

### 展柜

- 公开和私有展柜。
- 展柜封面、描述和分类。
- 展柜与谷子使用中间表维护顺序。
- 提供独立的公开列表、私有列表、添加、移除和移动接口。

### 手帐

- 多本手帐、封面和页面排序。
- 页面内容以结构化 JSON 保存，支持画布尺寸、背景和预览图。
- 自动保存页面版本，可查看、恢复和删除历史版本。
- 页面可生成公开分享 Token，匿名访问受独立限流保护。

### 位置

- `StorageNode` 自关联形成任意层级的收纳树。
- 自动维护完整路径和同级排序。
- 提供位置摘要、子树谷子查询、节点移动、谷子批量归位和未分配谷子接口。
- 位置摘要相关字段已建立索引以优化工作台查询。

### Bangumi 同步

- 搜索 Bangumi 作品并获取角色。
- 支持 IP 绑定、预览差异和增量应用。
- 管理员可配置 APScheduler 进程内自动同步。
- `BGMSyncJob` 与 `BGMSyncJobItem` 记录任务和单个 IP 的同步结果。
- 支持僵尸任务回收，避免异常中断后长期阻塞。

### OCR 与图片识别

- PaddleOCR 3 识别订单截图。
- jieba 和 RapidFuzz 用于文本解析与候选匹配。
- OpenCV、NumPy 和 Pillow 用于图片预处理。
- OCR 接口和谷子检索接口配置独立限流。
- 谷子图片可调用品类分类逻辑，结合品类形状种子推荐品类。

## 技术栈

| 分类 | 技术 |
| --- | --- |
| Web | Django 6、Django REST Framework |
| 查询 | django-filter、DRF SearchFilter |
| 认证 | 自实现 JWT HS256 |
| 数据库 | SQLite |
| API 文档 | drf-spectacular、Swagger UI、Redoc |
| 图片 | Pillow、OpenCV、NumPy |
| OCR | PaddlePaddle 3、PaddleOCR 3 |
| 文本匹配 | jieba、RapidFuzz |
| 调度 | APScheduler 3 |
| 部署 | Gunicorn、Nginx |

## 项目结构

```text
backend/
├─ ShiGu/
│  ├─ settings.py           # Django、DRF、JWT、CORS、静态文件配置
│  ├─ urls.py               # 根路由和 DRF Router
│  └─ wsgi.py
├─ apps/
│  ├─ users/                # User、Role、Permission 和认证接口
│  ├─ goods/
│  │  ├─ models/            # 按目录、主题、谷子、展柜、手帐、BGM 领域拆分
│  │  ├─ serializers/       # 按业务拆分的序列化器
│  │  ├─ views/             # 按业务拆分的 ViewSet 和接口
│  │  ├─ tests/             # goods 领域测试
│  │  ├─ bgm_*.py           # Bangumi 服务、同步和调度
│  │  └─ management/        # 初始化、测试数据和排序命令
│  ├─ location/             # 位置模型、服务、接口和测试
│  ├─ ocr/                  # OCR 识别、解析和模型下载命令
│  └─ admin_api/            # 管理员 REST API
├─ core/
│  ├─ jwt.py                # JWT 编码和解码
│  ├─ authentication.py     # DRF JWTAuthentication
│  └─ permissions.py        # 所有权和管理员权限
├─ media/                   # 开发环境上传文件
├─ .env.example             # 环境变量模板
├─ api.md                   # 业务 API 文档
├─ admin_api.md             # 管理员 API 文档
├─ gunicorn_config.py
├─ manage.sh
├─ manage.py
└─ requirements.txt
```

## 环境要求

建议使用 Python 3.12 或更高版本，并确认当前平台能够安装 PaddlePaddle 3.0。

`settings.py` 当前启用了 `django_extensions` 和 `drf_spectacular`。这两个包尚未写入 `requirements.txt`，全新环境安装时需要额外安装：

```powershell
pip install django-extensions drf-spectacular
```

## 本地启动

### 1. 创建环境

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt django-extensions drf-spectacular
```

### 2. 配置环境变量

```powershell
Copy-Item .env.example .env
```

至少设置：

```env
DJANGO_SECRET_KEY=请替换为随机密钥
```

可选配置：

```env
JWT_SECRET=独立的JWT签名密钥
REGISTER_CAPTCHA_ENABLED=true
DRF_NUM_PROXIES=0
BGM_ACCESS_TOKEN=Bangumi访问令牌
BGM_SCHEDULER_DISABLED=1
BGM_ZOMBIE_TIMEOUT_HOURS=2
```

生成 Django 密钥：

```powershell
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 3. 初始化数据库

```powershell
python manage.py migrate
python manage.py seed_users --admin-username admin --admin-password "请替换为强密码"
```

### 4. 启动

```powershell
python manage.py runserver
```

默认地址：

- API：`http://127.0.0.1:8000/api/`
- Django Admin：`http://127.0.0.1:8000/admin/`
- Swagger UI：`http://127.0.0.1:8000/api/schema/swagger-ui/`
- Redoc：`http://127.0.0.1:8000/api/schema/redoc/`

## API 概览

### 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register/` | 注册 |
| POST | `/api/auth/login/` | 登录并获取 JWT |
| GET | `/api/auth/me/` | 当前用户 |
| POST | `/api/auth/logout/` | 无状态登出，由客户端删除 Token |

请求头：

```http
Authorization: Bearer <token>
```

### 业务资源

| 路径 | 说明 |
| --- | --- |
| `/api/goods/` | 谷子 CRUD、检索、统计、图片、排序、去重和分类 |
| `/api/ips/` | IP、关键词、Bangumi 绑定和同步 |
| `/api/characters/` | 角色 CRUD 与筛选 |
| `/api/categories/` | 树形品类、数量和排序 |
| `/api/goods-crafts/` | 可选谷子工艺 |
| `/api/themes/` | 主题、图片池和模板 |
| `/api/showcases/` | 展柜与展柜谷子 |
| `/api/journals/` | 手帐本 |
| `/api/journal-pages/` | 手帐页面、复制、排序、预览和分享 |
| `/api/journal-page-versions/` | 手帐历史版本 |
| `/api/journal-public/<token>/` | 公开手帐页面 |
| `/api/location/` | 位置树、摘要、移动和归位 |
| `/api/bgm/` | Bangumi 搜索与角色导入 |
| `/api/ocr/recognize/` | 订单 OCR |
| `/api/admin/` | 管理员 REST API |

完整请求和响应示例参见 [api.md](api.md) 与 [admin_api.md](admin_api.md)。

## 数据模型

### 用户

- `Role`
- `User`
- `Permission`

### 谷子与元数据

- `IP`、`IPKeyword`
- `Character`
- `Category`
- `Theme`、`ThemeImage`、`ThemeTemplate`
- `GoodsCraft`
- `Goods`、`GuziImage`

### 展柜与手帐

- `Showcase`、`ShowcaseGoods`
- `JournalBook`
- `JournalPage`
- `JournalPageVersion`

### BGM 与位置

- `BGMSyncSettings`
- `BGMSyncJob`
- `BGMSyncJobItem`
- `StorageNode`

## 管理命令

```powershell
# 初始化角色和管理员
python manage.py seed_users --admin-username admin --admin-password "密码"

# 生成一整套本地测试数据
python manage.py seed_all_test_data

# 生成基础谷子测试数据
python manage.py seed_test_data

# 初始化品类形状识别种子
python manage.py seed_category_shape_types

# 重排谷子稀疏排序值
python manage.py rebalance_goods_order

# 下载 OCR 模型
python manage.py download_ocr_models
```

## 测试

```powershell
python manage.py test
```

测试分布：

- `core/tests.py`：JWT 与认证。
- `apps/users/tests.py`：注册、登录、当前用户和登出。
- `apps/goods/tests/`：谷子、品类、工艺、手帐和 BGM。
- `apps/location/tests.py`：位置树和移动逻辑。
- `apps/ocr/tests.py`：OCR 解析。
- `apps/admin_api/tests.py`：管理员接口。

## 生产部署

仓库提供 `gunicorn_config.py` 和 `manage.sh`：

```bash
./manage.sh start
./manage.sh stop
./manage.sh restart
./manage.sh reload
./manage.sh status
./manage.sh logs
```

也可以直接启动：

```bash
gunicorn ShiGu.wsgi:application --config gunicorn_config.py
```

生产环境需要由 Nginx 或同类 Web 服务器托管 `/static/` 和 `/media/`，并反向代理 Django。

## 生产配置风险

当前 `ShiGu/settings.py` 是开发配置，生产部署前必须处理：

- `DEBUG` 当前固定为 `True`。
- `ALLOWED_HOSTS` 当前为 `['*']`。
- `CORS_ALLOW_ALL_ORIGINS` 当前为 `True`。
- 数据库当前固定为 SQLite，没有读取 `DATABASE_URL`。
- `LANGUAGE_CODE` 为 `en-us`，`TIME_ZONE` 为 `UTC`。
- 上传文件位于本地 `media/`，需要备份和容量规划。
- 进程内 APScheduler 在多 Gunicorn Worker 下可能重复启动，生产环境应明确调度进程策略，或设置 `BGM_SCHEDULER_DISABLED=1` 后改用独立调度。
- DRF 限流当前使用进程内 LocMemCache；多 Gunicorn Worker 下每个进程独立计数，实际总请求量可能接近配置值乘以 Worker 数。需要严格限流时应切换到共享 Redis 缓存。
- `DRF_NUM_PROXIES` 默认是 `0`，仅信任直连地址。若由 Nginx 反向代理，应限制 Django 端口只允许代理访问、由代理覆盖 `X-Forwarded-For`，并按实际可信代理层数设置该值（单层代理通常为 `1`）。

## 许可证

当前仓库未包含独立的 `LICENSE` 文件。公开发布或分发前，请补充明确的许可证文本。
