"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  ChevronDown,
  Eye,
  Pencil,
  ArrowUpFromLine,
  ArrowLeftRight,
  Snowflake,
  Trash2,
  GitBranch,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/data-table";
import { SampleStatusBadge } from "@/components/shared/sample-status-badge";
import { formatDateTime } from "@/lib/format";
import {
  SAMPLE_PURPOSE_LABEL,
  SAMPLE_STATUS_LABEL,
} from "@/server/services/samples";
import type { SampleStatus } from "@prisma/client";
import type { PickerLocation } from "@/components/shared/location-picker";
import { OutboundDialog } from "./dialogs/outbound-dialog";
import { TransferDialog } from "./dialogs/transfer-dialog";
import { FreezeThawDialog } from "./dialogs/freeze-thaw-dialog";
import { DiscardDialog } from "./dialogs/discard-dialog";

export type UrlFilter = { label: string };

export type SampleRow = {
  id: string;
  sampleCode: string;
  typeName: string;
  typeIcon: string | null;
  projectCode: string;
  projectName: string;
  donorCode: string | null;
  status: SampleStatus;
  purpose: "RESEARCH" | "CLINICAL_INFUSION";
  locationId: string | null;
  locationPath: string;
  freezeThawCount: number;
  notes: string | null;
  createdAt: Date;
};

type DialogState =
  | { kind: "out"; sample: SampleRow }
  | { kind: "transfer"; sample: SampleRow }
  | { kind: "freeze"; sample: SampleRow }
  | { kind: "discard"; sample: SampleRow }
  | null;

export function SamplesListClient({
  data,
  projects,
  sampleTypes,
  locations,
  occupancy,
  urlFilters = [],
}: {
  data: SampleRow[];
  projects: Array<{ id: string; code: string; name: string }>;
  sampleTypes: Array<{ id: string; code: string; name: string }>;
  locations: PickerLocation[];
  occupancy: Record<string, number>;
  urlFilters?: UrlFilter[];
}) {
  const [filtersOpen, setFiltersOpen] = React.useState(true);
  const [projectId, setProjectId] = React.useState<string>("ALL");
  const [typeId, setTypeId] = React.useState<string>("ALL");
  const [status, setStatus] = React.useState<string>("ALL");
  const [purpose, setPurpose] = React.useState<string>("ALL");
  const [includeDeadStates, setIncludeDeadStates] = React.useState(false);
  const [from, setFrom] = React.useState<string>("");
  const [to, setTo] = React.useState<string>("");

  const [dialog, setDialog] = React.useState<DialogState>(null);

  const filtered = React.useMemo(() => {
    return data.filter((d) => {
      if (
        !includeDeadStates &&
        (d.status === "DISCARDED" || d.status === "VOIDED")
      )
        return false;
      if (projectId !== "ALL" && d.projectCode !== projectId) return false;
      if (typeId !== "ALL" && d.typeName !== typeId) return false;
      if (status !== "ALL" && d.status !== status) return false;
      if (purpose !== "ALL" && d.purpose !== purpose) return false;
      if (from) {
        const fromD = new Date(from);
        if (d.createdAt < fromD) return false;
      }
      if (to) {
        const toD = new Date(to);
        // include the whole "to" day
        toD.setHours(23, 59, 59, 999);
        if (d.createdAt > toD) return false;
      }
      return true;
    });
  }, [data, projectId, typeId, status, purpose, includeDeadStates, from, to]);

  function resetFilters() {
    setProjectId("ALL");
    setTypeId("ALL");
    setStatus("ALL");
    setPurpose("ALL");
    setIncludeDeadStates(false);
    setFrom("");
    setTo("");
  }

  const columns: ColumnDef<SampleRow, unknown>[] = [
    {
      accessorKey: "sampleCode",
      header: "样本编号",
      cell: ({ row }) => (
        <Link
          href={`/samples/${row.original.id}`}
          className="font-mono text-sm font-medium text-primary hover:underline"
        >
          {row.original.sampleCode}
        </Link>
      ),
    },
    {
      accessorKey: "typeName",
      header: "类型",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>{row.original.typeIcon ?? ""}</span>
          {row.original.typeName}
        </span>
      ),
    },
    {
      accessorKey: "projectCode",
      header: "项目",
      cell: ({ row }) => (
        <Badge variant="outline" title={row.original.projectName}>
          {row.original.projectCode}
        </Badge>
      ),
    },
    {
      accessorKey: "donorCode",
      header: "供者",
      cell: ({ row }) => row.original.donorCode ?? "—",
    },
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ row }) => <SampleStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "purpose",
      header: "用途",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.purpose === "CLINICAL_INFUSION" ? "default" : "secondary"
          }
        >
          {SAMPLE_PURPOSE_LABEL[row.original.purpose]}
        </Badge>
      ),
    },
    {
      accessorKey: "locationPath",
      header: "位置",
      cell: ({ row }) => (
        <span
          className="block max-w-[280px] truncate text-xs text-muted-foreground"
          title={row.original.locationPath || undefined}
        >
          {row.original.locationPath || "—"}
        </span>
      ),
    },
    {
      accessorKey: "freezeThawCount",
      header: "冻融",
      cell: ({ row }) => {
        const n = row.original.freezeThawCount;
        const cls =
          n > 5 ? "text-rose-600" : n > 3 ? "text-yellow-600" : "text-foreground";
        return <span className={cn("tabular-nums", cls)}>{n}</span>;
      },
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
      cell: ({ row }) => <RowActions row={row.original} setDialog={setDialog} />,
    },
  ];

  return (
    <div className="space-y-4">
      {urlFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <span className="text-xs">来自仪表盘的筛选：</span>
          {urlFilters.map((f, i) => (
            <Badge key={i} variant="outline" className="bg-white">
              {f.label}
            </Badge>
          ))}
          <Link
            href="/samples"
            className="ml-auto text-xs text-blue-700 hover:underline"
          >
            清除
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <Filter className="mr-1 h-4 w-4" />
          {filtersOpen ? "收起筛选" : "展开筛选"}
        </Button>
        <div className="flex items-center gap-2">
          <Checkbox
            id="dead-states"
            checked={includeDeadStates}
            onCheckedChange={(v) => setIncludeDeadStates(v === true)}
          />
          <Label htmlFor="dead-states" className="text-sm font-normal">
            显示已销毁 / 作废
          </Label>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  新建
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                render={<Link href="/samples/new">单条新建</Link>}
              />
              <DropdownMenuItem
                render={<Link href="/samples/batch">批量分装</Link>}
              />
              <DropdownMenuItem
                render={<Link href="/samples/import">Excel 导入</Link>}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filtersOpen && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">项目</Label>
              <Select
                value={projectId}
                onValueChange={(v) => setProjectId(v ?? "ALL")}
                items={{
                  ALL: "全部项目",
                  ...Object.fromEntries(
                    projects.map((p) => [p.code, `${p.code} · ${p.name}`]),
                  ),
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部项目</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.code}>
                      {p.code} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">样本类型</Label>
              <Select
                value={typeId}
                onValueChange={(v) => setTypeId(v ?? "ALL")}
                items={{
                  ALL: "全部类型",
                  ...Object.fromEntries(
                    sampleTypes.map((t) => [t.name, t.name]),
                  ),
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部类型</SelectItem>
                  {sampleTypes.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">状态</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v ?? "ALL")}
                items={{ ALL: "全部状态", ...SAMPLE_STATUS_LABEL }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部状态</SelectItem>
                  {(
                    Object.keys(SAMPLE_STATUS_LABEL) as SampleStatus[]
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SAMPLE_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">用途</Label>
              <Select
                value={purpose}
                onValueChange={(v) => setPurpose(v ?? "ALL")}
                items={{
                  ALL: "全部用途",
                  RESEARCH: "研究",
                  CLINICAL_INFUSION: "临床回输",
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部用途</SelectItem>
                  <SelectItem value="RESEARCH">研究</SelectItem>
                  <SelectItem value="CLINICAL_INFUSION">临床回输</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">创建时间起</Label>
              <Input
                type="date"
                className="h-9"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">创建时间止</Label>
              <Input
                type="date"
                className="h-9"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                重置筛选
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable
          data={filtered}
          columns={columns}
          searchPlaceholder="搜索样本编号、供者、备注..."
          emptyMessage="暂无样本"
        />
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
            暂无样本
          </p>
        ) : (
          filtered.map((row) => (
            <Card key={row.id}>
              <CardContent className="space-y-2 pt-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/samples/${row.id}`}
                    className="font-mono text-sm font-medium text-primary"
                  >
                    {row.sampleCode}
                  </Link>
                  <SampleStatusBadge status={row.status} />
                </div>
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <Badge variant="outline">{row.projectCode}</Badge>
                  <span>{row.typeIcon}</span>
                  <span>{row.typeName}</span>
                  {row.donorCode && <span>· {row.donorCode}</span>}
                </div>
                <div
                  className="truncate text-xs text-muted-foreground"
                  title={row.locationPath}
                >
                  {row.locationPath || "—"}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>冻融 {row.freezeThawCount}</span>
                  <span>{formatDateTime(row.createdAt)}</span>
                </div>
                <div className="pt-1">
                  <RowActions row={row} setDialog={setDialog} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <OutboundDialog
        open={dialog?.kind === "out"}
        onOpenChange={(v) => !v && setDialog(null)}
        sampleId={dialog?.kind === "out" ? dialog.sample.id : null}
        sampleCode={dialog?.kind === "out" ? dialog.sample.sampleCode : null}
      />
      <TransferDialog
        open={dialog?.kind === "transfer"}
        onOpenChange={(v) => !v && setDialog(null)}
        sampleId={dialog?.kind === "transfer" ? dialog.sample.id : null}
        sampleCode={dialog?.kind === "transfer" ? dialog.sample.sampleCode : null}
        locations={locations}
        occupancy={occupancy}
      />
      <FreezeThawDialog
        open={dialog?.kind === "freeze"}
        onOpenChange={(v) => !v && setDialog(null)}
        sampleId={dialog?.kind === "freeze" ? dialog.sample.id : null}
        sampleCode={dialog?.kind === "freeze" ? dialog.sample.sampleCode : null}
        currentCount={
          dialog?.kind === "freeze" ? dialog.sample.freezeThawCount : 0
        }
      />
      <DiscardDialog
        open={dialog?.kind === "discard"}
        onOpenChange={(v) => !v && setDialog(null)}
        sampleId={dialog?.kind === "discard" ? dialog.sample.id : null}
        sampleCode={
          dialog?.kind === "discard" ? dialog.sample.sampleCode : null
        }
      />
    </div>
  );
}

function RowActions({
  row,
  setDialog,
}: {
  row: SampleRow;
  setDialog: (s: DialogState) => void;
}) {
  const isDead = row.status === "DISCARDED" || row.status === "VOIDED";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm">
            操作 <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          render={
            <Link href={`/samples/${row.id}`}>
              <Eye className="mr-2 h-3.5 w-3.5" />
              详情
            </Link>
          }
        />
        <DropdownMenuItem
          render={
            <Link href={`/samples/${row.id}/edit`}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              编辑
            </Link>
          }
        />
        <DropdownMenuItem
          render={
            <Link href={`/samples/${row.id}#lineage`}>
              <GitBranch className="mr-2 h-3.5 w-3.5" />
              谱系
            </Link>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isDead}
          onClick={() => setDialog({ kind: "out", sample: row })}
        >
          <ArrowUpFromLine className="mr-2 h-3.5 w-3.5" />
          出库
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isDead || !row.locationId}
          onClick={() => setDialog({ kind: "transfer", sample: row })}
        >
          <ArrowLeftRight className="mr-2 h-3.5 w-3.5" />
          转移位置
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isDead}
          onClick={() => setDialog({ kind: "freeze", sample: row })}
        >
          <Snowflake className="mr-2 h-3.5 w-3.5" />
          记录冻融
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isDead}
          onClick={() => setDialog({ kind: "discard", sample: row })}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5 text-rose-600" />
          <span className="text-rose-600">销毁</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
