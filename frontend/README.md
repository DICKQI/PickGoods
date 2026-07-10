# 拾谷 PickGoods 前端

拾谷前端是基于 Vue 3、TypeScript 和 Vite 构建的收藏管理应用，覆盖谷仓检索、云展柜、手帐、统计看板、位置工作台、元数据维护和管理员功能，并通过 Capacitor 提供 Android 原生壳。

当前版本：`1.2.4post1`

## 功能模块

### 云展柜首页

`/showcase` 是登录后的主要工作区，包含四个页签：

| 页签 | 主要能力 |
| --- | --- |
| 展柜 | 创建公开/私有展柜、封面维护、谷子添加与排序、木质展架、纸制品收纳册、移动端全屏浏览 |
| 谷仓 | 谷子搜索、筛选、分页、详情、编辑、删除、相似随机浏览和批量图片操作 |
| 手帐 | 手帐本与页面管理、自由画布、图层、文字、形状、手绘、素材、版本恢复、公开分享和图片导出 |
| 统计看板 | 资产概览、状态、官谷/同人、作品类型、IP、角色和品类统计 |

### 资产录入

- `/goods/new`：新增谷子。
- `/goods/:id/edit`：编辑谷子。
- `/goods/drafts`：管理未完成草稿。
- 支持主题模板自动填充、角色与品类拼音检索、谷子工艺备注、主图和附加图片。
- 支持图片裁剪、历史撤销、品类识别、订单 OCR 和疑似重复记录确认。
- 移动端使用分步式表单，桌面端使用信息密度更高的完整表单。

### 位置与元数据

- `/location`：树形位置、位置工作台、节点摘要、谷子移动和未分配谷子管理。
- `/ipcharacter`：IP、角色、关键词、头像、Bangumi 关联与增量同步。
- `/category`：树形品类、颜色、形状类型、数量统计和拖拽排序。
- `/theme`：主题、主题图片池和主题模板。
- `/characters/:id/stats`：角色厨力统计。

### 管理后台

`/admin/*` 仅管理员可访问：

- `/admin/users`：用户和角色管理。
- `/admin/goods`：全站谷子管理。
- `/admin/ip`：IP 与角色管理。
- `/admin/categories`：品类管理。
- `/admin/themes`：主题管理。
- `/admin/goods-crafts`：谷子工艺管理。
- `/admin/bgm-sync`：Bangumi 自动同步设置、手动执行和任务审计。

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 框架 | Vue 3.5、Composition API、`<script setup>` |
| 类型与构建 | TypeScript 5.9、Vite 7、vue-tsc |
| UI | Element Plus、`@element-plus/icons-vue` |
| 状态与路由 | Pinia 3、Vue Router 4 |
| 请求 | Axios，自定义请求拦截器和 JWT 注入 |
| 图表 | ECharts 6 |
| 手帐画布 | Konva 10、vue-konva |
| 交互 | SortableJS、vue-picture-cropper、pinyin-pro |
| 移动端 | Capacitor 8、Camera、Network、Status Bar |
| 测试 | Vitest 4、Vue Test Utils、jsdom |

## 环境要求

- Node.js：`^20.19.0 || >=22.12.0`
- pnpm：`>=9.0.0`
- 推荐执行器：`npx pnpm@9.15.4`

仓库同时存在 `package-lock.json` 和 `pnpm-lock.yaml`，但项目声明的包管理器是 pnpm。请避免混用 npm、yarn 和不同主版本的 pnpm，以免重写锁文件或触发补丁依赖异常。

## 安装与启动

```powershell
cd frontend
npx pnpm@9.15.4 install
npx pnpm@9.15.4 dev
```

Vite 通常运行在 `http://localhost:5173`。开发环境中，`/api` 会代理到 `http://127.0.0.1:8000`。

## 后端地址

所有 API 文件使用包含 `/api/...` 的完整业务路径，请将基础地址配置为协议、主机和端口，不要额外追加 `/api`。

后端基础地址优先级：

1. `localStorage.pickgoods_api_base_url`
2. 旧版本兼容键 `localStorage.shigu_api_base_url`
3. `VITE_API_BASE_URL`
4. `${当前页面协议}//${当前页面主机}:8000`

可在 `.env` 中配置：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

也可以在应用设置页运行时修改。请求层会在每次请求前重新读取地址，无需重新构建。

## 开发命令

```powershell
npx pnpm@9.15.4 dev
npx pnpm@9.15.4 type-check
npx pnpm@9.15.4 test:unit
npx pnpm@9.15.4 lint
npx pnpm@9.15.4 build
npx pnpm@9.15.4 preview
```

说明：

- `build` 会先执行 `type-check`，再执行 Vite 生产构建。
- `lint` 带有 `--fix`，会直接修改可自动修复的文件。
- `test:unit` 默认进入 Vitest 监听模式；CI 或一次性验证可追加 `--run`。
- `deploy` 会先构建，再执行本地 `deploy.cjs` SFTP 上传脚本。

## 项目结构

```text
frontend/
├─ src/
│  ├─ api/                  # auth、goods、metadata、location、showcase、journal、admin
│  ├─ components/
│  │  ├─ journal/          # 手帐工作区、画布、素材选择
│  │  └─ showcase/         # 展柜列表、详情、展架和收纳册
│  ├─ router/               # 路由定义和鉴权守卫
│  ├─ stores/               # auth、guzi、metadata、location、showcase、journal
│  ├─ styles/               # 全局主题和组件样式
│  ├─ utils/                # 请求、树结构、手帐内容、移动端等工具
│  ├─ views/
│  │  ├─ admin/            # 管理后台页面
│  │  └─ goods-form/       # 谷子表单组件、组合函数和图片工具
│  └─ __tests__/            # Vitest 单元测试
├─ docs/                    # 前端专题文档
├─ patches/                 # patch-package 补丁
├─ public/                  # 静态资源
├─ screenshot/              # 项目截图
├─ capacitor.config.ts      # Capacitor 配置
├─ deploy.cjs               # 本地 SFTP 部署脚本
├─ package.json
└─ vite.config.ts
```

## 数据与状态流

```text
页面或组件
   |
   v
Pinia Store
   |
   v
src/api/*.ts
   |
   v
src/utils/request.ts
   |
   v
Django REST API
```

- `src/api/types.ts` 保存前后端共享的数据结构。
- `src/api/*.ts` 按业务域封装接口，不在页面中直接拼接请求。
- `src/utils/request.ts` 动态设置 Base URL、注入 Bearer Token 并统一处理 401、403、409 和 429。
- `src/stores/*` 负责缓存、加载状态、错误状态和跨组件业务操作。

## 路由与权限

- 需要登录的路由使用 `meta.requiresAuth`。
- 管理员路由使用 `meta.requiresAdmin`。
- 未登录访问受保护页面会跳转到 `/login?redirect=...`。
- 已登录用户访问登录页会返回目标页或 `/showcase`。
- 普通用户访问管理员路由会跳转到 `/settings`。

## 移动端

Capacitor 配置：

- App ID：`com.pickgoods.app`
- App Name：`拾谷`
- Web 目录：`dist`
- Android Scheme：`http`
- 允许明文请求，便于局域网调试

构建前端资源后同步到 Android 工程：

```powershell
npx pnpm@9.15.4 build
npx cap sync android
npx cap open android
```

真机中的 `localhost` 指向手机自身，应在设置页或 `VITE_API_BASE_URL` 中填写电脑局域网地址或线上地址。

## 文档

- [功能说明](docs/FEATURES.md)
- [开发指南](docs/DEVELOPMENT.md)
- [API 封装](docs/API.md)
- [部署说明](docs/DEPLOYMENT.md)
- [移动端开发](docs/MOBILE_DEVELOPMENT.md)
- [样式规范](docs/STYLING.md)
- [常见问题](docs/TROUBLESHOOTING.md)

## 安全提示

- JWT 保存在浏览器 `localStorage`，不要在日志或截图中暴露 Token。
- `deploy.cjs` 可能包含本地服务器信息和凭据，不应提交真实配置。
- Capacitor 的明文 HTTP 配置只适合开发或可信局域网，生产版本应使用 HTTPS。

## 许可证

当前仓库未包含独立的 `LICENSE` 文件。公开发布或分发前，请补充明确的许可证文本。
