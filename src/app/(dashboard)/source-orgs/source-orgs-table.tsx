"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDateTime } from "@/lib/format";
import { toggleSourceOrgActiveAction } from "@/server/actions/source-orgs";
import {
  SourceOrgFormDialog,
  type SourceOrgForEdit,
} from "./source-org-form-dialog";

export type SourceOrgRow = {
  id: string;
  name: string;
  type: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  sampleCount: number;
  isActive: boolean;
  createdAt: Date;
};

export function SourceOrgsTable({
  data,
  types,
}: {
  data: SourceOrgRow[];
  types: string[];
}) {
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SourceOrgForEdit | null>(null);
  const [confirm, setConfirm] = React.useState<{ row: SourceOrgRow } | null>(
    null,
  );
  const [pending, setPending] = React.useState(false);

  const filtered = React.useMemo(
    () =>
      typeFilter === "ALL" ? data : data.filter((d) => d.type === typeFilter),
    [data, typeFilter],
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: SourceOrgRow) {
    setEditing({
      id: row.id,
      name: row.name,
      type: row.type,
      contactPerson: row.contactPerson,
      contactPhone: row.contactPhone,
      address: row.address,
      notes: row.notes,
    });
    setFormOpen(true);
  }

  async function doToggle() {
    if (!confirm) return;
    setPending(true);
    const result = await toggleSourceOrgActiveAction(confirm.row.id);
    setPending(false);
    if (result.success) {
      toast.success(confirm.row.isActive ? "已禁用" : "已启用");
      setConfirm(null);
    } else {
      toast.error(result.error);
    }
  }

  const columns: ColumnDef<SourceOrgRow, unknown>[] = [
    { accessorKey: "name", header: "名称" },
    {
      accessorKey: "type",
      header: "类型",
      cell: ({ row }) =>
        row.original.type ? (
          <Badge variant="outline">{row.original.type}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "contactPerson",
      header: "联系人",
      cell: ({ row }) => row.original.contactPerson ?? "—",
    },
    {
      accessorKey: "contactPhone",
      header: "电话",
      cell: ({ row }) => row.original.contactPhone ?? "—",
    },
    {
      accessorKey: "sampleCount",
      header: "样本数",
      cell: ({ row }) => row.original.sampleCount,
    },
    {
      accessorKey: "isActive",
      header: "状态",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge>启用</Badge>
        ) : (
          <Badge variant="secondary">已禁用</Badge>
        ),
    },
    {
      id: "actions",
      header: "操作",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEdit(row.original)}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirm({ row: row.original })}
          >
            {row.original.isActive ? (
              <>
                <PowerOff className="mr-1 h-3.5 w-3.5" />
                禁用
              </>
            ) : (
              <>
                <Power className="mr-1 h-3.5 w-3.5" />
                启用
              </>
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="搜索名称或联系人..."
        toolbarSlot={
          <>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v ?? "ALL")}
              items={{
                ALL: "全部类型",
                ...Object.fromEntries(types.map((t) => [t, t])),
              }}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="按类型筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部类型</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="ml-auto" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              新增来源单位
            </Button>
          </>
        }
        emptyMessage="暂无来源单位"
      />

      <SourceOrgFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        existingTypes={types}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm?.row.isActive ? "确认禁用" : "确认启用"}
        description={
          confirm?.row.isActive
            ? `禁用「${confirm.row.name}」后，新建样本时将无法选择该来源单位。已存在的样本不受影响。`
            : `重新启用「${confirm?.row.name}」。`
        }
        destructive={confirm?.row.isActive}
        loading={pending}
        confirmLabel={confirm?.row.isActive ? "禁用" : "启用"}
        onConfirm={doToggle}
      />
    </>
  );
}
