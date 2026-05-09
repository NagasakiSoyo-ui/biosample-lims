# BioSample LIMS — Project Context

## 项目概要
为细胞治疗与生物医药研究公司构建的内部样本信息管理系统（LIMS）。
- 用户：1-3 人实验室同事
- 部署：云端（Vercel + Supabase）
- GMP 合规：中等等级（保留全量审计日志，不强制电子签名）
- 样本标签：手写（**不**做二维码扫码功能）

## 技术栈（已锁定，不可替换）
- Next.js **15.5.x**（**不是 16**；App Router 在 16 有 breaking change）
- TypeScript + `src/` 目录
- Prisma **6.19.x**（**不是 v7**；v7 改了 datasource url 配置）
- Tailwind CSS v4 + shadcn/ui（new-york style，slate base）
- NextAuth.js v5 (Auth.js)，Credentials Provider
- Zod + react-hook-form + @tanstack/react-table
- sonner 做 toast
- 数据操作一律用 **Server Actions**，不用 API Routes
  - 唯一例外：NextAuth 的 `app/api/auth/[...nextauth]/route.ts`
- 数据库：开发 SQLite（`prisma/dev.db`），生产 PostgreSQL（Supabase）

## 语言规范
- **所有面向用户的文案必须是简体中文**：菜单、按钮、表单 label、placeholder、
  错误提示、toast、表头、Dialog 标题、确认提示、空状态、加载文案、面包屑。
- 代码层面（变量名、函数名、注释、commit message）保持英文。
- Zod 错误信息用中文（`.message("...")` 或全局 errorMap）。
- 日期格式 `YYYY-MM-DD HH:mm`，不用美式 `MM/DD/YYYY`。

## 核心设计决策
1. **动态样本类型**：`SampleType` 表 + `customFieldsSchema` (JSON) 配置专属字段。
   新增"类器官""iPSC""上清"等无需改代码。
2. **样本谱系**：`Sample.parentSampleId` 自关联，支持母-子-孙样本树。
3. **4 层存储位置树**：`TANK`(罐/冰箱) → `CANISTER`(提筒) → `BOX`(盒) → `SLOT`(孔位)，
   自关联实现，应用层校验父子层级合法性。
4. **样本编号项目内唯一**（不是全局唯一）。
   默认格式 `{project.code}-{type.code}-{YYMMDD}-{当日序号2位}`，
   例：`GBM-TIL-250509-01`。允许手动改。
5. **用户角色**：仅 `ADMIN` / `USER` 两种，不做复杂 RBAC。
6. **审计日志全量记录**：所有写操作都要写一条 `AuditLog`
   (`userId`, `action`, `entityType`, `entityId`, `changes` JSON, `timestamp`)。
7. **删除策略**：核心实体（`SampleType`、`Project`、`Donor` 等）只能切 `isActive`，
   不允许真删。`Sample` 走状态流转（`DEPLETED` / `DISCARDED`），同样不真删。

## 代码规范

### Server Actions —— 强制流水线
- 位置：`src/server/actions/`，按实体分文件。
- 业务逻辑（复用计算、谱系遍历、编号生成等）：`src/server/services/`。
- 每个写操作必须按以下顺序，**无例外**：
  1. `await auth()` 校验登录，未登录直接返回失败
  2. Zod 校验入参（中文 message）
  3. `prisma.$transaction([主操作, 写 AuditLog])` —— 主操作和审计日志必须同事务
  4. `revalidatePath(...)` 触发列表刷新
  5. 返回 `{ success: boolean; data?: T; error?: string }`，**不向客户端 throw**

哪怕只是切一个 `isActive` 也要走完整流水线，不许走捷径。

### UI 规范
- 表单错误用 sonner toast 中文提示。
- 删除 / 禁用 / 销毁前必须 `AlertDialog` 二次确认（中文文案）。
- 列表统一用 `@tanstack/react-table`，分页 20/页。
- 移动端适配：< md 屏幕侧边栏变 `Sheet` 抽屉，关键 `Dialog` 全屏化。

## 开发进度
- [x] **Phase 1**：项目初始化、依赖、目录结构、shadcn 组件、Prisma + NextAuth 框架（无业务逻辑）
- [ ] **Phase 2**：Prisma schema 完整建模 + seed 数据
- [ ] **Phase 3**：登录认证 + 仪表盘骨架
- [ ] **Phase 4**：5 个字典管理页面（样本类型、项目、来源单位、位置、供者）
- [ ] **Phase 5**：样本登记、出入库、批量分装、Excel 导入、谱系树
- [ ] **Phase 6**：仪表盘看板、操作日志、用户管理、收尾打磨

**阶段边界严格遵守**：当前阶段未完成前不做下一阶段的事；明显跨界的工作先指出，不要默默实现。

## 已知偏离与决策记录
- create-next-app 默认装 Next 16，已降级到 **15.5.18**（App Router 在 16 有 breaking change，先稳）。
- Prisma 默认装 v7，已降级到 **6.19.3**（v7 schema datasource url 配置变了）。
- shadcn `input` 组件会带入 `input-group.tsx`，已接受这个额外文件。

## 默认账号（开发环境，Phase 2 seed 时建立）
- email: `admin@reshen.local`
- password: `admin123`
- role: `ADMIN`
