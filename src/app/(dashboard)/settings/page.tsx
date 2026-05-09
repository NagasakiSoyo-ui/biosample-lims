import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "个人设置 · BioSample LIMS" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, role: true },
  });
  if (!me) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "个人设置" }]}
        title="个人设置"
        description="修改自己的密码。其他信息由管理员维护。"
      />
      <SettingsForm profile={{ email: me.email, name: me.name, role: me.role }} />
    </div>
  );
}
