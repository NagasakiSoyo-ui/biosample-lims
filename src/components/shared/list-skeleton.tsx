import { Skeleton } from "@/components/ui/skeleton";

// Reusable skeleton for list pages: page header bar + filter bar + table.
export function ListSkeleton({ title = "加载中..." }: { title?: string } = {}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3 w-72" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2 rounded-md border p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-6 w-16" />
          </div>
        ))}
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}
