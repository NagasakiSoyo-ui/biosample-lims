# BioSample LIMS

为细胞治疗与生物医药研究公司构建的内部样本信息管理系统（LIMS）。
1-3 人小团队使用，云端部署，覆盖样本登记、出入库、批量分装、谱系追踪、
存储位置管理与全量审计日志。

## 技术栈

- **Next.js 15.5** + TypeScript（App Router，`src/` 目录）
- **Prisma 6** ORM（开发 SQLite，生产 PostgreSQL）
- **Tailwind CSS v4** + **shadcn/ui** (new-york style，slate base)
- **NextAuth v5 (Auth.js)** Credentials Provider + JWT session
- **Zod** + **react-hook-form** + **@tanstack/react-table**
- **sonner** toast / **recharts** 仪表盘饼图 / **date-fns** 相对时间
- **xlsx** + **exceljs** Excel 导入导出
- **bcryptjs** 密码哈希
- 部署：**Vercel** + **Supabase** Postgres

## 核心功能

- **样本动态类型**：`SampleType` + `customFieldsSchema` 配置专属字段，新增样本类型无需改代码
- **样本谱系**：自关联 `parentSampleId`，支持母-子-孙样本树（SVG 可视化）
- **4 层存储位置树**：`TANK`(罐/冰箱) → `CANISTER`(提筒) → `BOX`(冻存盒) → `SLOT`(孔位)
- **BOX 网格视图**：可视化的位置占用，三态显示（空闲/已分配/含样本），点击空格自动创建孔位
- **样本编号项目内唯一**：默认格式 `{project.code}-{type.code}-{YYMMDD}-{NN}`
- **出入库 / 转移 / 冻融 / 销毁**：四种 Dialog 操作，全部记 `SampleTransaction`
- **批量分装**：5 步向导，从一管母样本一次创建 N 个子样本
- **Excel 导入**：模板带数据校验下拉，校验失败的行高亮显示
- **审计日志全量记录**：每个写操作都在 `prisma.$transaction` 里追加 `AuditLog`，仅管理员可查看
- **用户管理**：ADMIN / USER 两级权限；停用账号即时禁止登录；保证至少 1 个启用管理员

## 默认开发账号

```
email:    admin@reshen.local
password: admin123
role:     ADMIN
```

**首次登录后请立即在 `/settings` 修改密码。**

## 本地开发

```bash
# 1. 克隆仓库
git clone <repo-url>
cd biosample-lims

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env

# 4. 生成 NEXTAUTH_SECRET
#    手动替换 .env 中 NEXTAUTH_SECRET 的占位值。任选其一：
#      Linux/Mac:  openssl rand -base64 32
#      Windows:    npx auth secret

# 5. 初始化数据库（开发用 SQLite，文件在 prisma/dev.db）
npx prisma db push
npm run db:seed

# 6. 启动开发服务器
npm run dev
```

打开 http://localhost:3000，用上面默认账号登录。

## 常用脚本

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run start        # 启动生产构建
npm run lint         # ESLint
npm run db:push      # 同步 schema 到数据库
npm run db:generate  # 重新生成 Prisma Client
npm run db:seed      # 跑种子脚本（幂等）
npm run db:studio    # 打开 Prisma Studio 看数据
```

## 项目目录结构

```
src/
├─ app/
│  ├─ (auth)/           # 登录页面组（无 sidebar）
│  ├─ (dashboard)/      # 主功能页面组（需登录）
│  │  ├─ samples/       # 样本核心功能（list/new/[id]/edit/batch/import）
│  │  ├─ projects/      # 项目字典
│  │  ├─ sample-types/  # 样本类型字典（含动态字段编辑器）
│  │  ├─ source-orgs/   # 来源单位字典
│  │  ├─ donors/        # 供者字典
│  │  ├─ locations/     # 存储位置树 + BOX 网格
│  │  ├─ audit-logs/    # 审计日志（仅 ADMIN）
│  │  ├─ users/         # 用户管理（仅 ADMIN）
│  │  ├─ settings/      # 个人设置
│  │  └─ page.tsx       # 仪表盘
│  └─ api/auth/         # NextAuth 路由处理
├─ components/
│  ├─ ui/               # shadcn 组件
│  └─ shared/           # 业务复用组件（DataTable / LocationPicker / 等）
├─ lib/
│  ├─ prisma.ts         # PrismaClient 单例
│  ├─ auth.ts           # NextAuth 配置 + Credentials Provider
│  ├─ auth.config.ts    # Edge-safe NextAuth config
│  ├─ format.ts         # 日期格式化（YYYY-MM-DD HH:mm）
│  └─ audit-action-labels.ts  # AuditLog action 中文化映射
├─ server/
│  ├─ actions/          # Server Actions（按实体分文件）
│  └─ services/         # 业务逻辑层（dashboard / samples / locations / excel / audit）
├─ types/
└─ middleware.ts        # NextAuth 路由保护（边缘 runtime）

prisma/
├─ schema.prisma        # 9 个模型 + 6 个 enum
└─ seed.ts              # 1 admin + 6 sample types + 7 projects + 3 source orgs + 4 locations
```

## 部署

参见 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) 完整步骤（Vercel + Supabase）。

## 常见问题 (FAQ)

**Q: 我不小心停用了唯一的 ADMIN 账号，怎么办？**
A: 系统强制至少保留 1 个启用 ADMIN，正常情况下不会发生。如果直接改了
   数据库导致这种情况，用 Prisma Studio (`npm run db:studio`) 把
   `User.isActive` 改回 true。

**Q: 样本编号生成出现重复怎么办？**
A: 不会出现 —— `Sample` 模型有 `@@unique([projectId, sampleCode])` 约束，
   重复时数据库会拒绝。系统的「自动生成」按钮按当日序号 +1，1-3 用户场景
   下竞态可忽略。

**Q: SQLite 切到 PostgreSQL 时数据怎么迁移？**
A: 开发期数据通常是 seed + 测试样本，可以直接重跑 seed。如需保留真实数据：
   `pg_dump` 不适用（SQLite ≠ Postgres），建议用 Prisma Studio 导出 JSON
   或写一次性迁移脚本。

**Q: Excel 模板下载里的下拉怎么改？**
A: 下拉来自当前数据库的项目和样本类型 —— 修改字典后重新下载模板即可。

**Q: 谁能看 `/audit-logs` 和 `/users`？**
A: 仅 `role=ADMIN` 的用户。普通用户访问会被重定向到仪表盘。
