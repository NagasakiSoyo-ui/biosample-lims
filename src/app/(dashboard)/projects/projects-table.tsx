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
import { toggleProjectActiveAction } from "@/server/actions/projects";
import {
  ProjectFormDialog,
  type ProjectForEdit,
} from "./project-form-dialog";

export type ProjectRow = {
  id: string;
  name: string;
  code: string;
  purpose: "RESEARCH" | "CLINICAL_INFUSION";
  description: string | null;
  sampleCount: number;
  isActive: boolean;
  createdAt: Date;
};

const PURPOSE_LABEL: Record<ProjectRow["purpose"], string> = {
  RESEARCH: "研究",
  CLINICAL_INFUSION: "临床回输",
};

export function ProjectsTable({ data }: { data: ProjectRow[] }) {
  const [purposeFilter, setPurposeFilter] = React.useState<
    "ALL" | ProjectRow["purpose"]
  >("ALL");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProjectForEdit | null>(null);
  const [confirm, setConfirm] = React.useState<{ row: ProjectRow } | null>(
    null,
  );
  const [pending, setPending] = React.useState(false);

  const filtered = React.useMemo(
    () =>
      purposeFilter === "ALL"
        ? data
        : data.filter((d) => d.purpose === purposeFilter),
    [data, purposeFilter],
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: ProjectRow) {
    setEditing({
      id: row.id,
      name: row.name,
      code: row.code,
      purpose: row.purpose,
      description: row.description,
    });
    setFormOpen(true);
  }

  async function doToggle() {
    if (!confirm) return;
    setPending(true);
    const result = await toggleProjectActiveAction(confirm.row.id);
    setPending(false);
    if (result.success) {
      toast.success(confirm.row.isActive ? "已禁用" : "已启用");
      setConfirm(null);
    } else {
      toast.error(result.error);
    }
  }

  const columns: ColumnDef<ProjectRow, unknown>[] = [
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
      accessorKey: "purpose",
      header: "类型",
      cell: ({ row }) =>
        row.original.purpose === "RESEARCH" ? (
          <Badge variant="secondary">研究</Badge>
        ) : (
          <Badge>临床回输</Badge>
        ),
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
        data={filtered}
        columns={columns}
        searchPlaceholder="搜索名称或缩写..."
        toolbarSlot={
          <>
            <Select
              value={purposeFilter}
              onValueChange={(v) => setPurposeFilter(v as typeof purposeFilter)}
              items={{
                ALL: "全部类型",
                RESEARCH: "研究",
                CLINICAL_INFUSION: "临床回输",
              }}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="按类型筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部类型</SelectItem>
                <SelectItem value="RESEARCH">研究</SelectItem>
                <SelectItem value="CLINICAL_INFUSION">临床回输</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="ml-auto" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              新增项目
            </Button>
          </>
        }
        emptyMessage="暂无项目"
      />

      <ProjectFormDialog
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
            ? `禁用项目「${confirm.row.name}」后，新建样本时将无法选择该项目。已存在的样本不受影响。`
            : `重新启用项目「${confirm?.row.name}」。`
        }
        destructive={confirm?.row.isActive}
        loading={pending}
        confirmLabel={confirm?.row.isActive ? "禁用" : "启用"}
        onConfirm={doToggle}
      />
    </>
  );
}
