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
import { formatDate } from "@/lib/format";
import { toggleDonorActiveAction } from "@/server/actions/donors";
import { DonorFormDialog, type DonorForEdit } from "./donor-form-dialog";

export type DonorRow = {
  id: string;
  code: string;
  gender: string | null;
  ageAtCollection: number | null;
  diagnosis: string | null;
  collectionDate: Date | null;
  projectId: string | null;
  projectName: string | null;
  sourceOrgId: string | null;
  sourceOrgName: string | null;
  notes: string | null;
  sampleCount: number;
  isActive: boolean;
};

const GENDER_LABEL: Record<string, string> = {
  M: "男",
  F: "女",
  Unknown: "未知",
};

export function DonorsTable({
  data,
  projects,
  sourceOrgs,
}: {
  data: DonorRow[];
  projects: Array<{ id: string; name: string }>;
  sourceOrgs: Array<{ id: string; name: string }>;
}) {
  const [projectFilter, setProjectFilter] = React.useState<string>("ALL");
  const [sourceOrgFilter, setSourceOrgFilter] = React.useState<string>("ALL");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DonorForEdit | null>(null);
  const [confirm, setConfirm] = React.useState<{ row: DonorRow } | null>(null);
  const [pending, setPending] = React.useState(false);

  const filtered = React.useMemo(() => {
    return data.filter((d) => {
      if (projectFilter !== "ALL" && d.projectId !== projectFilter) return false;
      if (sourceOrgFilter !== "ALL" && d.sourceOrgId !== sourceOrgFilter)
        return false;
      return true;
    });
  }, [data, projectFilter, sourceOrgFilter]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: DonorRow) {
    setEditing({
      id: row.id,
      code: row.code,
      gender: row.gender,
      ageAtCollection: row.ageAtCollection,
      diagnosis: row.diagnosis,
      collectionDate: row.collectionDate,
      projectId: row.projectId,
      sourceOrgId: row.sourceOrgId,
      notes: row.notes,
    });
    setFormOpen(true);
  }

  async function doToggle() {
    if (!confirm) return;
    setPending(true);
    const result = await toggleDonorActiveAction(confirm.row.id);
    setPending(false);
    if (result.success) {
      toast.success(confirm.row.isActive ? "已禁用" : "已启用");
      setConfirm(null);
    } else {
      toast.error(result.error);
    }
  }

  const columns: ColumnDef<DonorRow, unknown>[] = [
    {
      accessorKey: "code",
      header: "脱敏 ID",
      cell: ({ row }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {row.original.code}
        </code>
      ),
    },
    {
      accessorKey: "gender",
      header: "性别",
      cell: ({ row }) =>
        row.original.gender ? GENDER_LABEL[row.original.gender] ?? row.original.gender : "—",
    },
    {
      accessorKey: "ageAtCollection",
      header: "采集年龄",
      cell: ({ row }) => row.original.ageAtCollection ?? "—",
    },
    {
      accessorKey: "diagnosis",
      header: "诊断",
      cell: ({ row }) => row.original.diagnosis ?? "—",
    },
    {
      id: "projectName",
      header: "项目",
      accessorFn: (r) => r.projectName ?? "",
      cell: ({ row }) => row.original.projectName ?? "—",
    },
    {
      id: "sourceOrgName",
      header: "来源单位",
      accessorFn: (r) => r.sourceOrgName ?? "",
      cell: ({ row }) => row.original.sourceOrgName ?? "—",
    },
    {
      accessorKey: "collectionDate",
      header: "采集日期",
      cell: ({ row }) => formatDate(row.original.collectionDate),
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
        searchPlaceholder="搜索脱敏 ID 或诊断..."
        toolbarSlot={
          <>
            <Select
              value={projectFilter}
              onValueChange={(v) => setProjectFilter(v ?? "ALL")}
              items={{
                ALL: "全部项目",
                ...Object.fromEntries(projects.map((p) => [p.id, p.name])),
              }}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="按项目筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部项目</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sourceOrgFilter}
              onValueChange={(v) => setSourceOrgFilter(v ?? "ALL")}
              items={{
                ALL: "全部来源",
                ...Object.fromEntries(sourceOrgs.map((s) => [s.id, s.name])),
              }}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="按来源单位筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部来源</SelectItem>
                {sourceOrgs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="ml-auto" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              新增供者
            </Button>
          </>
        }
        emptyMessage="暂无供者"
      />

      <DonorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        projects={projects}
        sourceOrgs={sourceOrgs}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm?.row.isActive ? "确认禁用" : "确认启用"}
        description={
          confirm?.row.isActive
            ? `禁用供者「${confirm.row.code}」后，新建样本时将无法选择该供者。已存在的样本不受影响。`
            : `重新启用供者「${confirm?.row.code}」。`
        }
        destructive={confirm?.row.isActive}
        loading={pending}
        confirmLabel={confirm?.row.isActive ? "禁用" : "启用"}
        onConfirm={doToggle}
      />
    </>
  );
}
