"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { formatDateTime } from "@/lib/format";
import {
  actionLabel,
  AUDIT_ENTITY_LABEL,
  AUDIT_ENTITY_TYPES,
} from "@/lib/audit-action-labels";
import {
  exportAuditLogsAction,
  type AuditExportRow,
} from "@/server/actions/audit-logs";

export type AuditRow = {
  id: string;
  createdAt: Date;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: unknown;
  ipAddress: string | null;
};

function entityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  if (entityType === "Sample") return `/samples/${entityId}`;
  const m: Record<string, string> = {
    SampleType: "/sample-types",
    Project: "/projects",
    SourceOrg: "/source-orgs",
    Donor: "/donors",
    Location: "/locations",
    User: "/users",
  };
  return m[entityType] ?? null;
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr.buffer as ArrayBuffer], { type: mime });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

export function AuditLogsClient({
  rows,
  users,
  actions,
}: {
  rows: AuditRow[];
  users: Array<{ id: string; name: string; email: string }>;
  actions: string[];
}) {
  const [userId, setUserId] = React.useState("ALL");
  const [actionFilter, setActionFilter] = React.useState("ALL");
  const [entityType, setEntityType] = React.useState("ALL");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [diff, setDiff] = React.useState<AuditRow | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (userId !== "ALL" && r.userId !== userId) return false;
      if (actionFilter !== "ALL" && r.action !== actionFilter) return false;
      if (entityType !== "ALL" && r.entityType !== entityType) return false;
      if (from) {
        const d = new Date(from);
        if (r.createdAt < d) return false;
      }
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        if (r.createdAt > d) return false;
      }
      return true;
    });
  }, [rows, userId, actionFilter, entityType, from, to]);

  function reset() {
    setUserId("ALL");
    setActionFilter("ALL");
    setEntityType("ALL");
    setFrom("");
    setTo("");
  }

  async function exportXlsx() {
    setExporting(true);
    const exportRows: AuditExportRow[] = filtered.map((r) => ({
      createdAt: r.createdAt,
      userName: r.userName,
      userEmail: r.userEmail,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      ipAddress: r.ipAddress,
      changes: r.changes,
    }));
    const result = await exportAuditLogsAction(exportRows);
    setExporting(false);
    if (result.success && result.data) {
      const blob = base64ToBlob(
        result.data.base64,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      triggerDownload(blob, result.data.filename);
      toast.success("已导出");
    } else if (!result.success) {
      toast.error(result.error);
    }
  }

  const columns: ColumnDef<AuditRow, unknown>[] = [
    {
      accessorKey: "createdAt",
      header: "时间",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: "userName",
      header: "用户",
      cell: ({ row }) => (
        <div>
          <div className="text-sm">
            {row.original.userName ?? "（已删除）"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {row.original.userEmail ?? ""}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "动作",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {actionLabel(row.original.action)}
        </Badge>
      ),
    },
    {
      accessorKey: "entityType",
      header: "实体",
      cell: ({ row }) => {
        const href = entityHref(row.original.entityType, row.original.entityId);
        const label = AUDIT_ENTITY_LABEL[row.original.entityType] ?? row.original.entityType;
        const idShort = row.original.entityId
          ? row.original.entityId.slice(-8)
          : "—";
        const content = (
          <span className="font-mono text-xs">
            {label} · {idShort}
          </span>
        );
        return href ? (
          <Link href={href} className="text-primary hover:underline">
            {content}
          </Link>
        ) : (
          <span className="text-muted-foreground">{content}</span>
        );
      },
    },
    {
      id: "changes",
      header: "变更详情",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.changes ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDiff(row.original)}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            查看
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "ipAddress",
      header: "IP",
      cell: ({ row }) => (
        <span className="text-[10px] text-muted-foreground">
          {row.original.ipAddress ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">用户</Label>
            <Select
              value={userId}
              onValueChange={(v) => setUserId(v ?? "ALL")}
              items={{
                ALL: "全部用户",
                ...Object.fromEntries(
                  users.map((u) => [u.id, `${u.name}（${u.email}）`]),
                ),
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部用户</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}（{u.email}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">动作</Label>
            <Select
              value={actionFilter}
              onValueChange={(v) => setActionFilter(v ?? "ALL")}
              items={{
                ALL: "全部动作",
                ...Object.fromEntries(
                  actions.map((a) => [a, actionLabel(a)]),
                ),
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部动作</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {actionLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">实体类型</Label>
            <Select
              value={entityType}
              onValueChange={(v) => setEntityType(v ?? "ALL")}
              items={{
                ALL: "全部实体",
                ...Object.fromEntries(
                  AUDIT_ENTITY_TYPES.map((e) => [e, AUDIT_ENTITY_LABEL[e]]),
                ),
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部实体</SelectItem>
                {AUDIT_ENTITY_TYPES.map((e) => (
                  <SelectItem key={e} value={e}>
                    {AUDIT_ENTITY_LABEL[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">时间起 / 止</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                className="h-9"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Input
                type="date"
                className="h-9"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <Button variant="ghost" size="sm" onClick={reset}>
              重置筛选
            </Button>
            <span className="text-xs text-muted-foreground">
              共 {filtered.length} 条
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={exportXlsx}
              disabled={exporting || filtered.length === 0}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              {exporting ? "导出中..." : "导出 Excel"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        data={filtered}
        columns={columns}
        showSearch={false}
        emptyMessage="暂无审计记录"
      />

      <DiffDialog open={!!diff} onOpenChange={(v) => !v && setDiff(null)} row={diff} />
    </div>
  );
}

function DiffDialog({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: AuditRow | null;
}) {
  const diff = React.useMemo(() => {
    if (!row?.changes) return [];
    const changes = row.changes as { before?: unknown; after?: unknown };
    return computeFieldDiff(changes.before, changes.after);
  }, [row]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>变更详情</DialogTitle>
          <DialogDescription>
            {row ? `${actionLabel(row.action)} · ${formatDateTime(row.createdAt)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {diff.length === 0 ? (
          <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">
            没有可比对的字段（或 changes 不是 before/after 结构）
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">字段</th>
                  <th className="p-2 text-left text-rose-700">变更前</th>
                  <th className="p-2 text-left text-emerald-700">变更后</th>
                </tr>
              </thead>
              <tbody>
                {diff.map((d) => (
                  <tr key={d.key} className="border-t">
                    <td className="p-2 font-mono">{d.key}</td>
                    <td className="p-2 align-top">
                      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-rose-700">
                        {d.before}
                      </pre>
                    </td>
                    <td className="p-2 align-top">
                      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-emerald-700">
                        {d.after}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            原始 JSON
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted/30 p-2 text-[11px]">
            {row?.changes ? JSON.stringify(row.changes, null, 2) : "—"}
          </pre>
        </details>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fmt(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
  return JSON.stringify(v);
}

function computeFieldDiff(
  before: unknown,
  after: unknown,
): Array<{ key: string; before: string; after: string }> {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  if (!isObj(before) && !isObj(after)) {
    if (before === undefined && after === undefined) return [];
    return [{ key: "(value)", before: fmt(before), after: fmt(after) }];
  }
  const a = isObj(before) ? before : {};
  const b = isObj(after) ? after : {};
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  const out: Array<{ key: string; before: string; after: string }> = [];
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (JSON.stringify(av) === JSON.stringify(bv)) continue;
    out.push({ key: k, before: fmt(av), after: fmt(bv) });
  }
  return out;
}
