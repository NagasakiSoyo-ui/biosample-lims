"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Power, PowerOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDateTime } from "@/lib/format";
import { toggleUserActiveAction } from "@/server/actions/users";
import { UserFormDialog, type UserForEdit } from "./user-form-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
  createdAt: Date;
};

export function UsersTable({ data }: { data: UserRow[] }) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserForEdit | null>(null);
  const [resetTarget, setResetTarget] = React.useState<UserRow | null>(null);
  const [confirm, setConfirm] = React.useState<{ row: UserRow } | null>(null);
  const [pending, setPending] = React.useState(false);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: UserRow) {
    setEditing({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
    });
    setFormOpen(true);
  }

  async function doToggle() {
    if (!confirm) return;
    setPending(true);
    const result = await toggleUserActiveAction(confirm.row.id);
    setPending(false);
    if (result.success) {
      toast.success(confirm.row.isActive ? "已停用" : "已启用");
      setConfirm(null);
    } else {
      toast.error(result.error);
    }
  }

  const columns: ColumnDef<UserRow, unknown>[] = [
    { accessorKey: "email", header: "邮箱" },
    { accessorKey: "name", header: "姓名" },
    {
      accessorKey: "role",
      header: "角色",
      cell: ({ row }) =>
        row.original.role === "ADMIN" ? (
          <Badge>管理员</Badge>
        ) : (
          <Badge variant="secondary">普通用户</Badge>
        ),
    },
    {
      accessorKey: "isActive",
      header: "状态",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge>启用</Badge>
        ) : (
          <Badge variant="secondary">已停用</Badge>
        ),
    },
    {
      accessorKey: "createdAt",
      header: "创建时间",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "操作",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
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
            onClick={() => setResetTarget(row.original)}
          >
            <KeyRound className="mr-1 h-3.5 w-3.5" />
            重置密码
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirm({ row: row.original })}
          >
            {row.original.isActive ? (
              <>
                <PowerOff className="mr-1 h-3.5 w-3.5" />
                停用
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
        searchPlaceholder="搜索邮箱或姓名..."
        toolbarSlot={
          <Button size="sm" className="ml-auto" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            新增用户
          </Button>
        }
        emptyMessage="暂无用户"
      />

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />
      <ResetPasswordDialog
        open={!!resetTarget}
        onOpenChange={(v) => !v && setResetTarget(null)}
        userId={resetTarget?.id ?? null}
        userEmail={resetTarget?.email ?? null}
      />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm?.row.isActive ? "确认停用" : "确认启用"}
        description={
          confirm?.row.isActive
            ? `「${confirm.row.email}」将无法登录系统。已有的审计记录会保留。`
            : `重新启用「${confirm?.row.email}」。`
        }
        destructive={confirm?.row.isActive}
        loading={pending}
        confirmLabel={confirm?.row.isActive ? "停用" : "启用"}
        onConfirm={doToggle}
      />
    </>
  );
}
