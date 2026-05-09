"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Power, PowerOff, Plus } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDateTime } from "@/lib/format";
import { toggleSampleTypeActiveAction } from "@/server/actions/sample-types";
import {
  SampleTypeFormDialog,
  type SampleTypeForEdit,
} from "./sample-type-form-dialog";

export type SampleTypeRow = {
  id: string;
  name: string;
  code: string;
  icon: string | null;
  description: string | null;
  fieldCount: number;
  customFieldsSchema: unknown;
  isActive: boolean;
  createdAt: Date;
};

export function SampleTypesTable({ data }: { data: SampleTypeRow[] }) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SampleTypeForEdit | null>(null);
  const [confirm, setConfirm] = React.useState<{
    row: SampleTypeRow;
  } | null>(null);
  const [pending, setPending] = React.useState(false);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: SampleTypeRow) {
    setEditing({
      id: row.id,
      name: row.name,
      code: row.code,
      icon: row.icon,
      description: row.description,
      customFieldsSchema: row.customFieldsSchema,
    });
    setFormOpen(true);
  }

  async function doToggle() {
    if (!confirm) return;
    setPending(true);
    const result = await toggleSampleTypeActiveAction(confirm.row.id);
    setPending(false);
    if (result.success) {
      toast.success(confirm.row.isActive ? "已禁用" : "已启用");
      setConfirm(null);
    } else {
      toast.error(result.error);
    }
  }

  const columns: ColumnDef<SampleTypeRow, unknown>[] = [
    {
      id: "icon",
      header: "图标",
      cell: ({ row }) => (
        <span className="text-lg">{row.original.icon || "—"}</span>
      ),
      enableSorting: false,
    },
    { accessorKey: "name", header: "名称" },
    {
      accessorKey: "code",
      header: "缩写",
      cell: ({ row }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {row.original.code}
        </code>
      ),
    },
    {
      id: "fieldCount",
      header: "字段数",
      cell: ({ row }) => row.original.fieldCount,
      enableSorting: false,
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
      accessorKey: "createdAt",
      header: "创建时间",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
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
        data={data}
        columns={columns}
        searchPlaceholder="搜索名称或缩写..."
        toolbarSlot={
          <Button size="sm" className="ml-auto" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            新增样本类型
          </Button>
        }
        emptyMessage="暂无样本类型"
      />

      <SampleTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm?.row.isActive ? "确认禁用" : "确认启用"}
        description={
          confirm?.row.isActive
            ? `禁用样本类型「${confirm.row.name}」后，新建样本时将无法选择该类型。已存在的样本不受影响。`
            : `重新启用样本类型「${confirm?.row.name}」。`
        }
        destructive={confirm?.row.isActive}
        loading={pending}
        confirmLabel={confirm?.row.isActive ? "禁用" : "启用"}
        onConfirm={doToggle}
      />
    </>
  );
}
