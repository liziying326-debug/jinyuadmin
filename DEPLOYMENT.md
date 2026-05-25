# 服务器部署指南

## 数据库处理方案

### 方案1：自动创建（推荐）
服务器启动时会自动创建数据库和表结构（`database.cjs` 已实现）。

**步骤：**
1. 服务器 `git pull` 拉取最新代码
2. 启动应用 `node server.js`
3. 访问后台管理页面，手动添加数据

---

### 方案2：使用初始数据库（推荐生产环境）
提供一个包含初始数据的 SQLite 数据库文件。

**提供的文件：**
- `data/jinyu.db.init` — 初始数据库（包含表结构和初始数据）
- `data/seed.sql` — SQL 格式的初始数据

**部署步骤：**
1. 将 `jinyu.db.init` 重命名为 `jinyu.db` 放到 `data/` 目录
2. 或者执行 `sqlite3 data/jinyu.db < data/seed.sql`

---

## 部署命令示例

```bash
# 1. 进入项目目录
cd /path/to/jinyu-2026-new/admin

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖（如有更新）
npm install

# 4. 如果使用初始数据库
cp data/jinyu.db.init data/jinyu.db

# 或者：从头创建空数据库（自动创建表）
# 直接启动，数据库会自动创建

# 5. 重启应用（使用 pm2）
pm2 restart jinyu-admin

# 或者：首次启动
pm2 start server.js --name jinyu-admin
pm2 save
```

---

## 注意事项

1. **不要提交 `*.db` 文件到 git** — 已在 `.gitignore` 中排除
2. **服务器上的数据库** 需要定期备份
3. **上传的图片文件** (`about-uploads/`, `case-uploads/`) 也不要提交到 git
4. 如果服务器上已有数据库，**不要覆盖**，只更新代码

---

## 提供的初始数据文件

- ✅ `data/seed.sql` — 表结构和初始数据（2932行）
- ✅ `data/jinyu.db.init` — 二进制数据库文件（可选）

**选择其中一个使用即可。**
