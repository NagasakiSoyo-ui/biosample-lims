"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-xl font-semibold">页面加载失败</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        加载该页面时遇到错误，可能是数据查询失败或网络问题。
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          错误编号：{error.digest}
        </p>
      )}
      <Button onClick={reset}>重试</Button>
    </div>
  );
}
