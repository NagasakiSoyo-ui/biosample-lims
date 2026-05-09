import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        您访问的页面不存在或已被移除。
      </p>
      <Link href="/" className={buttonVariants({ variant: "default" })}>
        返回仪表盘
      </Link>
    </div>
  );
}
