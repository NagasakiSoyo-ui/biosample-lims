import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/shared/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        user={{
          name: session.user.name ?? "用户",
          role: session.user.role,
        }}
      />
      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
