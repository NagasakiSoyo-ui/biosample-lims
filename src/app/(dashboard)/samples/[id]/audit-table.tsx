import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

export type AuditRow = {
  id: string;
  createdAt: Date;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: unknown;
};

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
        暂无审计记录
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>时间</TableHead>
            <TableHead>用户</TableHead>
            <TableHead>动作</TableHead>
            <TableHead>实体</TableHead>
            <TableHead>变更详情</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs text-muted-foreground">
                {formatDateTime(r.createdAt)}
              </TableCell>
              <TableCell>{r.userName ?? "（已删除用户）"}</TableCell>
              <TableCell className="font-mono text-xs">{r.action}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.entityType}
              </TableCell>
              <TableCell>
                {r.changes ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      展开
                    </summary>
                    <pre className="mt-1 max-w-[480px] overflow-x-auto rounded bg-muted/40 p-2 text-[11px]">
                      {JSON.stringify(r.changes, null, 2)}
                    </pre>
                  </details>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
