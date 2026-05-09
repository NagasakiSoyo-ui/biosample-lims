"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TestTubes,
  FolderKanban,
  Tags,
  Building2,
  Boxes,
  Users,
  ScrollText,
  UserCog,
  Menu,
  LogOut,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";

type Role = "ADMIN" | "USER";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/samples", label: "样本", icon: TestTubes },
  { href: "/projects", label: "项目", icon: FolderKanban },
  { href: "/sample-types", label: "样本类型", icon: Tags },
  { href: "/source-orgs", label: "来源单位", icon: Building2 },
  { href: "/locations", label: "存储位置", icon: Boxes },
  { href: "/donors", label: "供者", icon: Users },
  { href: "/audit-logs", label: "操作日志", icon: ScrollText },
  { href: "/users", label: "用户管理", icon: UserCog, adminOnly: true },
];

export function Sidebar({
  user,
}: {
  user: { name: string; role: Role };
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || user.role === "ADMIN");

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 p-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
              active && "bg-accent font-medium",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const UserBlock = () => (
    <div className="border-t p-3">
      <div className="mb-2 flex items-center gap-2 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
          {user.name.slice(0, 1) || "?"}
        </div>
        <div className="min-w-0 text-xs">
          <div className="truncate font-medium text-foreground">
            {user.name}
          </div>
          <div className="truncate text-muted-foreground">
            {user.role === "ADMIN" ? "管理员" : "普通用户"}
          </div>
        </div>
      </div>
      <Link
        href="/settings"
        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-accent"
      >
        <Settings className="h-4 w-4" />
        个人设置
      </Link>
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </Button>
      </form>
    </div>
  );

  return (
    <>
      {/* Mobile top bar + drawer */}
      <header className="flex items-center gap-2 border-b p-3 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="打开菜单" />
            }
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b p-4 text-left">
              <SheetTitle>BioSample LIMS</SheetTitle>
            </SheetHeader>
            <div className="flex h-[calc(100vh-65px)] flex-col">
              <div className="flex-1 overflow-y-auto">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
              </div>
              <UserBlock />
            </div>
          </SheetContent>
        </Sheet>
        <span className="font-semibold">BioSample LIMS</span>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-muted/40 md:flex">
        <div className="border-b p-4">
          <div className="font-semibold">BioSample LIMS</div>
          <div className="text-xs text-muted-foreground">样本信息管理系统</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <UserBlock />
      </aside>
    </>
  );
}
