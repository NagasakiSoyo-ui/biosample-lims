import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable, type UserRow } from "./users-table";

export const metadata = { title: "用户管理 · BioSample LIMS" };

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  const data: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "用户管理" }]}
        title="用户管理"
        description="管理系统账号；停用用户后无法登录但审计记录保留。"
      />
      <UsersTable data={data} />
    </div>
  );
}
