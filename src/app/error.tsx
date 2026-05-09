"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">出错了</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        系统遇到了未预期的错误。请稍后重试，或返回仪表盘继续操作。
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          错误编号：{error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>重试</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          返回仪表盘
        </Link>
      </div>
    </div>
  );
}
