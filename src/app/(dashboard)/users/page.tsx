import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable, type UserRow } from "./users-table";
import { getActor } from "@/server/services/auth-guard";

export const metadata = { title: "用户管理 · BioSample LIMS" };

export default async function UsersPage() {
  const actor = await getActor();
  if (actor?.role !== "ADMIN") {
    redirect("/");
  }

  const [users, projects] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      include: { projectAccess: { select: { projectId: true } } },
    }),
    prisma.project.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const data: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    projectIds: u.projectAccess.map((grant) => grant.projectId),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "用户管理" }]}
        title="用户管理"
        description="管理系统账号；停用用户后无法登录但审计记录保留。"
      />
      <UsersTable data={data} projects={projects} />
    </div>
  );
}
