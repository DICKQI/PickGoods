# 个人 IP 功能回滚手册

本文用于回退「个人 IP（用户自建、仅本人可见的作品与角色）」以及配套的「个人 Bangumi Access Token」功能。

适用范围：

- 本地试玩后不满意，希望把这个功能整体关掉；
- 前端入口、交互或权限不合适，需要先撤回再改进；
- 个人 IP 与官方资料库的边界（可见性 / 统计 / 搜索）出现预期外的问题；
- 需要把数据库结构也还原到上线前的状态。

三级回滚，按需选择，**从 T0 往上递增，不要跳过可选级别**：

| 级别 | 场景 | 数据影响 | 耗时 |
| --- | --- | --- | --- |
| **T0 开关回滚** | 只想先关掉入口，观察其它功能是否正常 | 无（个人数据保留、仅不可见） | 秒级 |
| **T1 代码回滚** | 彻底回到旧行为，但保留新表结构（推荐做法） | 个人 IP 被清理（谷子可转挂官方 IP） | 分钟级 |
| **T2 完整回滚** | 连 `IP.user` 列与唯一约束都要还原 | 同 T1 + 迁移反向执行 | 分钟级 + 迁移 |

> 与 `docs/game-achievement-function-rollback.md` 一致：本仓库**优先只回滚代码、不回滚迁移**。个人 IP 的迁移只做了「新增 `IP.user` 列 + 把全局唯一改成按归属域唯一」，官方名称唯一性没有放松，所以旧代码在新表结构上运行是安全的。

## 一、实施前基线（回滚时的对照点）

实施个人 IP 功能时已记录：

```text
基线提交：2851bd7（feat: 非默认排序下的IP卡片不允许拖曳）
实施分支：feat/personal-ip
数据库备份：backend/db.sqlite3.pre-personal-ip.<UTC时间戳>
迁移位点：goods 0053 / users 0008（实施后到 goods 0054 / users 0009）
```

本地数据库路径可用 `PICKGOODS_DB_PATH` 覆盖（默认 `backend/db.sqlite3`）；`db.sqlite3` 与备份文件都在 `.gitignore` 里，不会污染仓库。

## 二、T0：开关回滚（推荐先做这一步）

个人 IP 的全部写入口由服务端开关 `PERSONAL_IP_ENABLED` 控制（`backend/ShiGu/settings.py` → `apps/goods/feature_flags.personal_ip_enabled()`）。

```bash
cd backend
PERSONAL_IP_ENABLED=0 python manage.py runserver   # 开发服务器
# gunicorn 部署：在 .env 里写 PERSONAL_IP_ENABLED=0 后重启进程
```

关闭后的行为（**不动任何数据**）：

- 非管理员对 IP / 角色的写操作一律 `403`；
- 所有 IP / 角色查询只返回官方数据（个人 IP 对所有人不可见，管理员也看不到）；
- `/api/bgm/*` 里的导入、以及 `/api/ips/{id}/fetch-cover|bgm-preview|bgm-sync` 对非管理员一律拒绝；
- `GET /api/auth/me/` 返回 `personal_ip_enabled: false`，前端据此隐藏「新增作品」「个人角标」「Bangumi 接入」等全部入口；
- 数据库里 `IP.user` 不为空的行原样保留，把开关改回 `1` 立即恢复。

验证：

```bash
curl -s -H "Authorization: Bearer <用户token>" http://127.0.0.1:8000/api/auth/me/ | grep personal_ip_enabled
curl -s -H "Authorization: Bearer <用户token>" http://127.0.0.1:8000/api/ips/    # 只剩官方 IP
```

## 三、T1：代码回滚（保留新表结构）

**顺序很重要：先清个人数据，再回滚代码。** 旧代码用 `IP.objects.get_or_create(name=...)` 检索 IP，若库里还留着别人的个人 IP，会被当成官方 IP 复用/展示。

### 3.1 清理个人数据

```bash
cd backend
python manage.py purge_personal_ips              # 干跑：列出所有个人 IP 与计划动作
python manage.py purge_personal_ips --apply      # 真正删除（跳过带谷子的个人 IP）
```

带谷子的个人 IP 有两种处理方式：

```bash
# A. 把谷子转挂到某个官方 IP，再删除个人 IP（推荐，谷子不丢）
python manage.py purge_personal_ips --apply --reassign <官方IP id>

# B. 连谷子一起删（危险，需显式开启；默认不会删用户资产）
python manage.py purge_personal_ips --apply --delete-goods
```

命令是幂等的：没有个人 IP 时直接输出「没有个人 IP，无需清理。」并成功退出。
`--reassign` 只接受 `IP.user IS NULL` 的官方 IP，传错会 `CommandError` 退出。

### 3.2 回滚代码

提交按层拆分，每层都能独立跑通（`python manage.py check` / `pnpm type-check`），支持单层回退：

| 提交 | 内容 | 单独回退的影响 |
| --- | --- | --- |
| C1 `feat:` 后端数据模型与归属作用域 | `IP.user` 字段与四条件唯一约束、`0054` 迁移、`feature_flags` / `scoping`、序列化器作用域 | 会连带失去归属能力，需配合 C2 一起退 |
| C2 `feat:` 后端接口权限与个人 Bangumi Token | IP / 角色视图的作用域与权限、`bgm_token` + 服务层 token 注入 + BGM 接口限流、`purge_personal_ips` 命令、`/api/auth/me/bgm-token/` | 接口退回管理员独占（数据仍在） |
| C3 `feat:` 前端个人 IP 入口 | types / api / store、`IPWorkCard`、`IPCharactersDrawer`、IP 页 helper、`ProfileAccount` Bangumi 卡片、`ipLabel` | 前端回到「只有管理员能编辑」，可单独 revert |
| C4 `test:` 用例补齐 | 后端与前端新增用例 | 仅影响测试 |
| C5 `docs:` 文档 | `backend/api.md`、本手册 | 仅影响文档 |

```bash
cd /path/to/PickGoods

# 只回滚前端（后端能力保留，接口仍然可用）
git revert <C3>

# 整体回滚代码（保留新表结构，T1 推荐做法）
git revert --no-commit <C5> <C4> <C3> <C2> <C1>
git commit -m "revert: 回滚个人 IP 功能"
```

回滚后结构上仍保留：

- `IP.user` 列（全为 `NULL`）；
- 四个条件唯一约束（`uniq_ip_name_global` / `uniq_ip_name_per_user` / `uniq_ip_bgm_global` / `uniq_ip_bgm_per_user`）——官方域的唯一性与旧 schema 等价；
- `users.User.bgm_access_token` 列（全为空串）。

验证：

```bash
cd backend && python manage.py test
cd frontend && pnpm test:unit && pnpm type-check
```

再手工回归旧流程：管理员建 IP → BGM 导入 → 建谷子 → 品类/主题/展柜。

## 四、T2：完整回滚（代码 + 迁移 + 数据）

只有在必须恢复旧表结构时才用。**必须先 T1.3.1 的清理，再反向迁移**：反向会把 `unique=True` 加回 `IP.name`，多用户同名行会导致迁移失败。

```bash
cd backend
python manage.py purge_personal_ips --apply --reassign <官方IP id>   # 1. 清个人数据
python manage.py migrate goods 0053                                  # 2. 反向迁移 goods
python manage.py migrate users 0008                                  # 3. 反向迁移 users（丢弃个人 token 列）
python manage.py check                                               # 4. 自检
```

`migrate goods 0053` 会移除 4 个条件唯一约束与 `IP.user` 列，并把 `name` / `bgm_subject_id` 的字段级 `unique=True` 加回来。

随后按 T1.3.2 回滚代码即可。

### 数据库已被玩坏的兜底方案

```bash
cd backend
cp db.sqlite3.pre-personal-ip.<时间戳> db.sqlite3     # 覆盖回实施前快照
cd .. && git switch main                              # 或 git revert
```

## 五、回滚演练记录（实施时已执行）

在数据库副本上（`PICKGOODS_DB_PATH` 指向 `%LOCALAPPDATA%\Temp\pg_rollback_drill.sqlite3`）完整跑过一遍，结果：

```text
setup: personal_ips=1 personal_goods=1
flag default enabled = True
flag off enabled = False (data untouched: personal_ips=1)
--- dry run ---            跳过带谷子的个人 IP，输出 skipped_with_goods=1
--- apply with reassign ---  deleted=1 reassigned_goods=1 deleted_characters=1
after purge: personal_ips=0 goods_on_official=5
--- reverse migrate goods 0053 --- Unapplying goods.0054_ip_user_scope... OK
check after reverse: System check identified no issues (0 silenced).
current goods migration =  [ ] 0054_ip_user_scope
--- forward migrate back ---   Applying goods.0054_ip_user_scope... OK
restored goods migration =  [X] 0054_ip_user_scope
DRILL OK
```

复现演练（本地 SQLite）：

```bash
cd backend
cp db.sqlite3 "$LOCALAPPDATA/Temp/pg_rollback_drill.sqlite3"
export PICKGOODS_DB_PATH="$LOCALAPPDATA/Temp/pg_rollback_drill.sqlite3"
python manage.py shell -c "from apps.users.models import User,Role; from apps.goods.models import IP; r,_=Role.objects.get_or_create(name='User'); u,_=User.objects.get_or_create(username='drill_user',defaults={'role':r}); IP.objects.create(name='drill_personal', user=u); print(IP.objects.filter(user__isnull=False).count())"
python manage.py purge_personal_ips                          # 干跑
python manage.py purge_personal_ips --apply --reassign 1      # 用真实官方 IP id 替换 1
python manage.py migrate goods 0053 && python manage.py check
unset PICKGOODS_DB_PATH                                       # 演练库随后可直接删除
```

## 六、回滚检查清单

- [ ] `python manage.py showmigrations goods | tail -2` 位点符合预期（0054 或 0053）
- [ ] `python manage.py check` 无告警
- [ ] `python manage.py test` 全绿
- [ ] `pnpm test:unit`、`pnpm type-check` 全绿
- [ ] 普通账号登录后看不到「新增作品 / 个人角标 / Bangumi 接入」入口（T0 或 T1 后）
- [ ] 官方 IP 列表、BGM 导入、建谷子、统计页照常
- [ ] 库里 `IP.objects.filter(user__isnull=False).count()` 为 0（T1/T2 后）
- [ ] `/api/auth/me/` 里没有 token 原文（任何级别都不应有）
