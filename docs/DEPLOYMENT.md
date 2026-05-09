# 部署指南：Vercel + Supabase

适用于 BioSample LIMS 生产部署。预计耗时 30-60 分钟。

## 前置准备

- GitHub 账号（代码托管）
- Vercel 账号（应用托管，免费 Hobby 计划即可）
- Supabase 账号（PostgreSQL 数据库，免费 Free 计划即可）
- 本地装好 Node.js 20+ 和 npm

---

## Step 1：创建 Supabase 项目

1. 访问 https://supabase.com → 登录 → New Project
2. **Name**: `biosample-lims`（或自取）
3. **Database Password**: 用密码生成器造一个强密码，**记录到密码管理器**
4. **Region**: 大陆访问选 `Singapore (Southeast Asia)` 或 `Tokyo (Northeast Asia)`
5. **Pricing Plan**: Free
6. 等待 1-2 分钟初始化完成

进入项目后，**Settings → Database → Connection String**，找到两个 URL：

- **Connection pooling (Transaction mode)** —— 用作 `DATABASE_URL`
  - 在末尾追加 `?pgbouncer=true&connection_limit=1`
  - 示例：`postgresql://postgres.xxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
- **Direct connection** —— 用作 `DIRECT_URL`（仅用于 `prisma db push` / migrate）
  - 示例：`postgresql://postgres.xxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`

把数据库密码填进 `[YOUR-PASSWORD]` 占位。

---

## Step 2：本地切换到 PostgreSQL 并初始化

修改 `prisma/schema.prisma` 的 datasource 块：

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

临时修改 `.env`，把 Supabase 的两个 URL 填进去：

```bash
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://..."
NEXTAUTH_SECRET="<本地随便填一个，不上线>"
NEXTAUTH_URL="http://localhost:3000"
```

跑数据库初始化：

```bash
npx prisma db push   # 把 schema 推到 Supabase
npm run db:seed      # 写入默认 admin + 6 类型 + 7 项目 + 3 来源单位 + 位置树
```

到 Supabase **Table Editor** 看一下，应该能看到 9 张表（`User`、`Sample`、`Project` 等）和初始数据。

> **回切到本地 SQLite 继续开发**：把 `provider` 改回 `sqlite`，删除 `directUrl` 行，
> `.env` 中 `DATABASE_URL` 改回 `"file:./dev.db"`。`prisma generate` 一次刷新 client。

---

## Step 3：推到 GitHub

```bash
git init
git add .
git commit -m "initial commit"
gh repo create biosample-lims --private --source=. --push
```

或手动到 GitHub 建仓库再 push。

确认 `.gitignore` 排除以下：
- `node_modules/`
- `.env` / `.env.local`（含敏感凭据）
- `prisma/*.db` / `*.db-journal`（本地 SQLite 文件）
- `.next/`

---

## Step 4：部署到 Vercel

1. https://vercel.com → New Project → Import 你的 GitHub repo
2. **Framework Preset**: Next.js（自动识别）
3. **Root Directory**: `./`（默认即可）
4. **Build Command** 改为：

   ```
   prisma generate && next build
   ```

   （否则 Vercel 构建时不会重新生成 Prisma Client，导致 runtime 报错）

5. **Environment Variables** 添加：

   | Name              | Value                                                                                |
   |-------------------|--------------------------------------------------------------------------------------|
   | `DATABASE_URL`    | Supabase pooling URL（含 `?pgbouncer=true&connection_limit=1`）                        |
   | `DIRECT_URL`      | Supabase direct URL                                                                  |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` 生成的 32+ 字节随机串（**与本地 dev 不同**）                  |
   | `NEXTAUTH_URL`    | 部署后的 Vercel URL，如 `https://biosample-lims.vercel.app`（首次部署不知道，先填占位） |

6. 点击 **Deploy**，等 2-3 分钟构建完成

7. 部署成功后，回到 **Environment Variables**，把 `NEXTAUTH_URL` 改成实际 URL，**Redeploy**

---

## Step 5：部署后初始化

如果 Step 2 已经在 Supabase 跑过 seed，**默认账号已经在数据库里了**：

- email: `admin@reshen.local`
- password: `admin123`

直接打开 Vercel URL → 用上面账号登录 → **立刻去 `/settings` 改密码**。

如果忘记跑 seed，本地保持 `.env` 指向 Supabase，再跑一次 `npm run db:seed`。

---

## 后续维护

### Schema 变更（加表 / 加列）

**开发期**（本地 SQLite）：

```bash
# 改完 prisma/schema.prisma
npx prisma db push
```

**生产同步**（Supabase）：

```bash
# 临时把 .env 指向 Supabase（DATABASE_URL + DIRECT_URL）
npx prisma db push
# 改回本地 SQLite
```

> 严肃做法是用 `prisma migrate dev` 生成 migration 文件，然后 `prisma migrate deploy`。
> Phase 6 之前一直用 `db push`（schema-driven），上线后想做迁移版本管理可以切换。

### 备份

Supabase Free 计划：每日自动备份保留 7 天。**Settings → Backups** 可下载或还原。

如果要更频繁的备份，Supabase Pro 起支持 PITR（point-in-time recovery）。

### 监控

- **Vercel**: Deployments → 各次构建日志；Functions → 各 Server Action 调用日志
- **Supabase**: Database → Logs；Reports → 慢查询、连接数

### 升级 Next / Prisma 等依赖

锁定的版本（详见 CLAUDE.md）：

- Next 15.5.x（不要升 16，App Router 有 breaking change）
- Prisma 6.19.x（不要升 7，schema datasource 配置变了）

升 minor 版本（如 15.5.18 → 15.5.20）通常安全。
升 major 前**必须**在 dev 分支验证全套功能。

---

## 故障排除

**Vercel 构建失败：`prisma generate` 报错**
→ 确认 Build Command 是 `prisma generate && next build`，不是默认 `next build`。

**部署后登录不上 / 报「邮箱或密码错误」**
→ 检查 `DATABASE_URL` 是否指向同一个数据库，且 seed 跑过。Supabase Table Editor 看 `User` 表里有没有 `admin@reshen.local`。

**500 错误 + Vercel 函数日志显示「prepared statement already exists」**
→ Pooling URL 漏了 `?pgbouncer=true&connection_limit=1`。补上后 redeploy。

**「too many connections」错误**
→ 同上，PgBouncer 参数没配好。Supabase Free 计划共享池有上限。

**修改 schema 后部署没生效**
→ Vercel 构建已经包含 `prisma generate`，但 schema 变更还需要在数据库跑 `prisma db push`（见上面「Schema 变更」章节）。Vercel 不会自动跑 push。
