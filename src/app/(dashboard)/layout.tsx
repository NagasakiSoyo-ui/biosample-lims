import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { getActor } from "@/server/services/auth-guard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        user={{
          name: actor.name || "用户",
          role: actor.role,
        }}
      />
      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
