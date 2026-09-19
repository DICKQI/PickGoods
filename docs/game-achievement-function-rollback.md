# Game achievement function rollback

本文用于回退 PickGoods 游戏化功能上线。该功能通过合并后的 `main` 同时发布后端和前端，因此回退时必须同时处理代码、数据库和前端静态资源。

## 适用范围

本文适用于以下情况：

- 游戏化数据库迁移失败或数据库结构异常。
- 游戏化基线初始化失败、长时间未完成或存在未解决的同步失败。
- 前端出现白屏、关键路由不可用或持续 API 错误。
- 后端出现持续 500、`database is locked`、缺字段或其他无法快速修复的问题。
- 上线后确认需要暂时撤回游戏化功能。

本文不建议通过反向执行数据库迁移来回退。游戏化迁移以新增字段、新增表和索引为主，旧版代码可以忽略这些新增结构。正常回退应保留数据库和上线后产生的数据，只有数据库损坏或必须完整恢复上线前状态时才恢复数据库快照。

## 生产环境

生产目录和路径：

```text
项目仓库：/usr/local/src/pickgoods
后端目录：/usr/local/src/pickgoods/backend
数据库：/usr/local/src/pickgoods/backend/db.sqlite3
环境文件：/usr/local/src/pickgoods/backend/.env
前端目录：/usr/local/src/PickGoods_Frontend
```

上线前的备份目录：

```text
/usr/local/backups/pickgoods/<UTC时间戳>/
```

至少应包含：

```text
backend.commit
backend.env
db.sqlite3
frontend.tgz
media.tgz
repo.bundle
nginx.full.conf
SHA256SUMS
```

上线前必须先停止写入，再建立备份。数据库完整性检查必须返回 `ok`。

```bash
cd /usr/local/src/pickgoods/backend
PATH="$PWD/.venv/bin:$PATH" ./manage.sh stop

BACKUP=/usr/local/backups/pickgoods/<UTC时间戳>
BACKUP_DB="$BACKUP/db.sqlite3" .venv/bin/python - <<'PY'
import os
import sqlite3

conn = sqlite3.connect(os.environ["BACKUP_DB"])
print(conn.execute("PRAGMA integrity_check").fetchone()[0])
conn.close()
PY
```

备份目录不得在上线后立即删除。至少保留 14 天，并确认新版本稳定后再进行清理。

## 回退触发条件

出现以下任一情况时，应停止继续上线并执行回退：

- `manage.py migrate` 失败，或迁移不完整。
- `initialize_gamification` 失败、超过 30 分钟未完成，或未解决 `MetricSyncFailure` 不为 0。
- `manage.py check` 失败。
- 首页、登录、谷子、预购或个人资料等核心页面无法使用。
- 游戏化页面持续白屏或关键接口持续返回 500。
- Gunicorn 日志持续出现 `database is locked`、缺字段或数据库异常。
- 谷子、预购、用户或展柜数量出现异常减少。

## 开始回退前

先停止后端，确保没有请求、调度任务或后台进程继续写入：

```bash
cd /usr/local/src/pickgoods/backend
PATH="$PWD/.venv/bin:$PATH" ./manage.sh stop
pgrep -af "gunicorn ShiGu.wsgi:application" || true
```

确认备份目录和旧提交：

```bash
BACKUP=/usr/local/backups/pickgoods/<UTC时间戳>
OLD_COMMIT=$(cat "$BACKUP/backend.commit")
test -n "$OLD_COMMIT"
test -f "$BACKUP/db.sqlite3"
test -f "$BACKUP/frontend.tgz"
```

记录本次回退原因、时间、执行人、当前提交和使用的备份目录。

## 正常回退：保留上线后数据

正常回退适用于数据库完整，只是需要撤回游戏化代码、前端或功能开关的场景。

正常回退保留：

- 已经执行的新增迁移和新增表字段。
- 上线后产生的用户、谷子、预购和其他业务数据。
- 游戏化表和字段中的已有数据，便于后续重新上线时继续使用。

正常回退不执行：

```text
manage.py migrate <app> <旧迁移号>
```

### 1. 关闭游戏化

在 `backend/.env` 中设置：

```text
GAMIFICATION_ENABLED=false
```

### 2. 恢复后端代码

```bash
BACKUP=/usr/local/backups/pickgoods/<UTC时间戳>
OLD_COMMIT=$(cat "$BACKUP/backend.commit")

cd /usr/local/src/pickgoods
git checkout --detach "$OLD_COMMIT"
git status --short --branch
```

该步骤只切换到旧提交，不删除数据库，也不回滚迁移。

### 3. 恢复前端

先把异常的前端目录移走：

```bash
FAILED_AT=$(date -u +%Y%m%dT%H%M%SZ)
mv /usr/local/src/PickGoods_Frontend \
  "/usr/local/src/PickGoods_Frontend.failed-$FAILED_AT"
```

再恢复上线前备份：

```bash
tar -xzf "$BACKUP/frontend.tgz" -C /usr/local/src
```

恢复后确认：

```bash
test -f /usr/local/src/PickGoods_Frontend/index.html
ls -la /usr/local/src/PickGoods_Frontend
```

### 4. 启动旧后端

```bash
cd /usr/local/src/pickgoods/backend
PATH="$PWD/.venv/bin:$PATH" ./manage.sh start
PATH="$PWD/.venv/bin:$PATH" ./manage.sh status
```

### 5. 记录回退结果

确认服务恢复后，记录：

```text
回退原因：
回退时间：
执行人：
恢复提交：$OLD_COMMIT
备份目录：$BACKUP
核心页面验证：
核心接口验证：
剩余问题：
```

## 紧急回退：恢复数据库快照

只有数据库损坏、迁移无法继续或必须完全恢复上线前状态时，才执行本节操作。

警告：

- 恢复数据库快照会丢失备份时间点之后产生的全部数据。
- 执行前必须再次确认无法通过正常代码回退恢复服务。
- 执行前必须保留当前数据库副本，便于事后分析。

### 1. 停止服务并保存现场

```bash
cd /usr/local/src/pickgoods/backend
PATH="$PWD/.venv/bin:$PATH" ./manage.sh stop

FAILED_AT=$(date -u +%Y%m%dT%H%M%SZ)
cp -a db.sqlite3 "/tmp/db.sqlite3.failed-$FAILED_AT"
```

### 2. 恢复数据库和环境文件

```bash
BACKUP=/usr/local/backups/pickgoods/<UTC时间戳>

rm -f db.sqlite3 db.sqlite3-journal db.sqlite3-wal db.sqlite3-shm
cp -a "$BACKUP/db.sqlite3" db.sqlite3
cp -a "$BACKUP/backend.env" .env
chown root:root db.sqlite3 .env
chmod 644 db.sqlite3
chmod 600 .env
```

数据库恢复后再次检查：

```bash
BACKUP_DB="$PWD/db.sqlite3" .venv/bin/python - <<'PY'
import os
import sqlite3

conn = sqlite3.connect(os.environ["BACKUP_DB"])
print(conn.execute("PRAGMA integrity_check").fetchone()[0])
conn.close()
PY
```

### 3. 恢复旧代码和旧前端

```bash
BACKUP=/usr/local/backups/pickgoods/<UTC时间戳>
OLD_COMMIT=$(cat "$BACKUP/backend.commit")

cd /usr/local/src/pickgoods
git checkout --detach "$OLD_COMMIT"

FAILED_AT=$(date -u +%Y%m%dT%H%M%SZ)
mv /usr/local/src/PickGoods_Frontend \
  "/usr/local/src/PickGoods_Frontend.failed-$FAILED_AT"
tar -xzf "$BACKUP/frontend.tgz" -C /usr/local/src
```

### 4. 恢复媒体文件

只有媒体目录也发生异常时才执行：

```bash
mv /usr/local/src/pickgoods/backend/media \
  "/usr/local/src/pickgoods/backend/media.failed-$(date -u +%Y%m%dT%H%M%SZ)"
tar -xzf "$BACKUP/media.tgz" -C /usr/local/src/pickgoods/backend
```

### 5. 启动并验证

```bash
cd /usr/local/src/pickgoods/backend
PATH="$PWD/.venv/bin:$PATH" ./manage.sh start
PATH="$PWD/.venv/bin:$PATH" ./manage.sh status
```

## 回退后验证

完成正常回退或紧急回退后，逐项检查：

- Gunicorn 正常运行，端口 8000 正常监听。
- 前端首页返回 200。
- 登录、大厅、谷子、预购、个人资料和管理页面正常。
- 旧版后端核心接口可以正常读写。
- 游戏化接口不再启用。
- 谷子、预购、用户和展柜数量没有异常减少。
- Gunicorn 错误日志中不再出现迁移缺字段、数据库锁或持续 500。
- 浏览器控制台没有大量静态资源 404。

可用以下命令进行基础检查：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/goods/
curl -sS -o /dev/null -w '%{http_code}\n' http://192.168.3.150/
tail -n 200 /usr/local/src/pickgoods/backend/logs/gunicorn_error.log
```

## 备份恢复校验

回退前应确保备份至少可以通过以下检查：

```bash
tar -tzf "$BACKUP/frontend.tgz" >/dev/null
tar -tzf "$BACKUP/media.tgz" >/dev/null
git bundle verify "$BACKUP/repo.bundle"
sha256sum -c "$BACKUP/SHA256SUMS"
```

数据库、前端和媒体备份至少保留 14 天。确认新版本稳定前，不得删除正常回退所需的备份。
