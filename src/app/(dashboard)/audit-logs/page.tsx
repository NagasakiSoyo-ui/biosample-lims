import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { AuditLogsClient, type AuditRow } from "./audit-logs-client";

export const metadata = { title: "操作日志 · BioSample LIMS" };

export default async function AuditLogsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/");
  }

  const [logs, users, distinctActions] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 2000,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: { _all: true },
      orderBy: { _count: { action: "desc" } },
    }),
  ]);

  const rows: AuditRow[] = logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt,
    userId: l.userId,
    userName: l.user?.name ?? null,
    userEmail: l.user?.email ?? null,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    changes: l.changes,
    ipAddress: l.ipAddress,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "操作日志" }]}
        title="操作日志"
        description="GMP 合规审计追踪。仅管理员可见，记录不可编辑、不可删除。"
      />
      <AuditLogsClient
        rows={rows}
        users={users}
        actions={distinctActions.map((a) => a.action)}
      />
    </div>
  );
}
