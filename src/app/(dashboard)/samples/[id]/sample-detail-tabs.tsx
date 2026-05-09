"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpFromLine,
  ArrowLeftRight,
  Snowflake,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SampleStatusBadge } from "@/components/shared/sample-status-badge";
import {
  SAMPLE_PURPOSE_LABEL,
  type LineageNode,
} from "@/server/services/samples";
import { formatDateTime, formatDate } from "@/lib/format";
import type { PickerLocation } from "@/components/shared/location-picker";
import { OutboundDialog } from "../dialogs/outbound-dialog";
import { TransferDialog } from "../dialogs/transfer-dialog";
import { FreezeThawDialog } from "../dialogs/freeze-thaw-dialog";
import { DiscardDialog } from "../dialogs/discard-dialog";
import { LineageTree } from "./lineage-tree";
import {
  TransactionsTimeline,
  type TimelineRow,
} from "./transactions-timeline";
import { AuditTable, type AuditRow } from "./audit-table";

export type DetailFieldRender = {
  label: string;
  value: string | null | undefined;
};

export type SampleDetail = {
  id: string;
  sampleCode: string;
  status: import("@prisma/client").SampleStatus;
  purpose: "RESEARCH" | "CLINICAL_INFUSION";
  typeName: string;
  typeIcon: string | null;
  projectName: string;
  projectCode: string;
  sourceOrgName: string | null;
  donorCode: string | null;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  volume: number | null;
  volumeUnit: string | null;
  collectedAt: Date | null;
  frozenAt: Date | null;
  expireAt: Date | null;
  freezeThawCount: number;
  locationId: string | null;
  locationPath: string;
  notes: string | null;
  customFieldsRendered: Array<{ label: string; value: string }>;
};

export function SampleDetailTabs({
  sample,
  lineage,
  lineageCurrentId,
  transactions,
  auditLogs,
  pickerLocations,
  occupancy,
}: {
  sample: SampleDetail;
  lineage: LineageNode | null;
  lineageCurrentId: string;
  transactions: TimelineRow[];
  auditLogs: AuditRow[];
  pickerLocations: PickerLocation[];
  occupancy: Record<string, number>;
}) {
  const [outOpen, setOutOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [freezeOpen, setFreezeOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);

  const isDead =
    sample.status === "DISCARDED" || sample.status === "VOIDED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">
              {sample.sampleCode}
            </h1>
            <SampleStatusBadge status={sample.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Badge variant="outline" className="mr-2">
              {sample.projectCode}
            </Badge>
            <span>{sample.typeIcon}</span>
            <span className="ml-1">{sample.typeName}</span>
            <span className="ml-2 text-xs">
              · {SAMPLE_PURPOSE_LABEL[sample.purpose]}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/samples/${sample.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            编辑
          </Link>
          <Button
            variant="outline"
            size="sm"
            disabled={isDead}
            onClick={() => setOutOpen(true)}
          >
            <ArrowUpFromLine className="mr-1 h-3.5 w-3.5" />
            出库
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isDead || !sample.locationId}
            onClick={() => setTransferOpen(true)}
          >
            <ArrowLeftRight className="mr-1 h-3.5 w-3.5" />
            转移
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isDead}
            onClick={() => setFreezeOpen(true)}
          >
            <Snowflake className="mr-1 h-3.5 w-3.5" />
            冻融
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isDead}
            onClick={() => setDiscardOpen(true)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5 text-rose-600" />
            <span className="text-rose-600">销毁</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="lineage">谱系</TabsTrigger>
          <TabsTrigger value="transactions">出入库记录</TabsTrigger>
          <TabsTrigger value="audit">审计日志</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <Field label="样本类型" value={`${sample.typeIcon ?? ""} ${sample.typeName}`} />
              <Field
                label="项目"
                value={`${sample.projectCode} · ${sample.projectName}`}
              />
              <Field
                label="用途"
                value={SAMPLE_PURPOSE_LABEL[sample.purpose]}
              />
              <Field label="来源单位" value={sample.sourceOrgName} />
              <Field label="供者" value={sample.donorCode} />
              <Field label="登记人" value={sample.createdByName} />
              <Field
                label="创建时间"
                value={formatDateTime(sample.createdAt)}
              />
              <Field
                label="更新时间"
                value={formatDateTime(sample.updatedAt)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">量与时间</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <Field
                label="体积 / 数量"
                value={
                  sample.volume != null
                    ? `${sample.volume} ${sample.volumeUnit ?? ""}`
                    : null
                }
              />
              <Field
                label="冻融次数"
                value={String(sample.freezeThawCount)}
              />
              <Field label="采集日期" value={formatDate(sample.collectedAt)} />
              <Field label="冻存日期" value={formatDate(sample.frozenAt)} />
              <Field label="有效期" value={formatDate(sample.expireAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">存储位置</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {sample.locationPath ? (
                <span className="font-medium">{sample.locationPath}</span>
              ) : (
                <span className="text-muted-foreground">未放入存储</span>
              )}
            </CardContent>
          </Card>

          {sample.customFieldsRendered.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">专属字段</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {sample.customFieldsRendered.map((f) => (
                  <Field key={f.label} label={f.label} value={f.value} />
                ))}
              </CardContent>
            </Card>
          )}

          {sample.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">备注</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm">
                {sample.notes}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lineage" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">样本谱系</CardTitle>
            </CardHeader>
            <CardContent>
              <LineageTree root={lineage} currentId={lineageCurrentId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">出入库记录</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionsTimeline rows={transactions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">审计日志</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTable rows={auditLogs} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />

      <OutboundDialog
        open={outOpen}
        onOpenChange={setOutOpen}
        sampleId={sample.id}
        sampleCode={sample.sampleCode}
      />
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        sampleId={sample.id}
        sampleCode={sample.sampleCode}
        locations={pickerLocations}
        occupancy={occupancy}
      />
      <FreezeThawDialog
        open={freezeOpen}
        onOpenChange={setFreezeOpen}
        sampleId={sample.id}
        sampleCode={sample.sampleCode}
        currentCount={sample.freezeThawCount}
      />
      <DiscardDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        sampleId={sample.id}
        sampleCode={sample.sampleCode}
      />
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1">{value || "—"}</span>
    </div>
  );
}
