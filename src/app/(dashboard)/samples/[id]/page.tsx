import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import {
  getSampleLineage,
  parseCustomFieldsSchema,
  SAMPLE_STATUS_LABEL,
} from "@/server/services/samples";
import { getLocationPath } from "@/server/services/locations";
import type { PickerLocation } from "@/components/shared/location-picker";
import {
  SampleDetailTabs,
  type SampleDetail,
} from "./sample-detail-tabs";
import type { TimelineRow } from "./transactions-timeline";
import type { AuditRow } from "./audit-table";

export const metadata = { title: "样本详情 · BioSample LIMS" };

export default async function SampleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sample = await prisma.sample.findUnique({
    where: { id },
    include: {
      type: { select: { name: true, icon: true, customFieldsSchema: true } },
      project: { select: { code: true, name: true } },
      sourceOrg: { select: { name: true } },
      donor: { select: { code: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!sample) notFound();

  const [
    locationPath,
    lineage,
    transactions,
    auditLogs,
    allLocations,
    occupancySamples,
  ] = await Promise.all([
    sample.locationId
      ? getLocationPath(prisma, sample.locationId)
      : Promise.resolve(""),
    prisma.$transaction(async (tx) => getSampleLineage(tx, id)),
    prisma.sampleTransaction.findMany({
      where: { sampleId: id },
      orderBy: { createdAt: "desc" },
      include: {
        operator: { select: { name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "Sample", entityId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
      take: 200,
    }),
    prisma.location.findMany({
      select: {
        id: true,
        name: true,
        level: true,
        parentId: true,
        capacity: true,
        gridRows: true,
        gridCols: true,
        position: true,
        isActive: true,
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    }),
    prisma.sample.findMany({
      where: {
        locationId: { not: null },
        status: {
          notIn: ["DEPLETED", "DISCARDED", "VOIDED", "RELEASED"],
        },
      },
      select: { locationId: true },
    }),
  ]);

  // Resolve from/to location paths for each transaction.
  const txLocIds = new Set<string>();
  for (const t of transactions) {
    if (t.fromLocationId) txLocIds.add(t.fromLocationId);
    if (t.toLocationId) txLocIds.add(t.toLocationId);
  }
  const txPathByLocId = new Map<string, string>();
  await Promise.all(
    Array.from(txLocIds).map(async (lid) => {
      txPathByLocId.set(lid, await getLocationPath(prisma, lid));
    }),
  );

  const timeline: TimelineRow[] = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    createdAt: t.createdAt,
    operatorName: t.operator.name,
    fromLocationPath: t.fromLocationId
      ? (txPathByLocId.get(t.fromLocationId) ?? "（已删除位置）")
      : null,
    toLocationPath: t.toLocationId
      ? (txPathByLocId.get(t.toLocationId) ?? "（已删除位置）")
      : null,
    previousStatus: t.previousStatus,
    newStatus: t.newStatus,
    reason: t.reason,
    operatorNote: t.operatorNote,
    quantityChange: t.quantityChange,
  }));

  const audit: AuditRow[] = auditLogs.map((a) => ({
    id: a.id,
    createdAt: a.createdAt,
    userName: a.user?.name ?? null,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    changes: a.changes,
  }));

  // Render custom fields for the overview tab.
  const customSchema = parseCustomFieldsSchema(sample.type.customFieldsSchema);
  const cfValues = (sample.customFields ?? {}) as Record<string, unknown>;
  const customFieldsRendered = customSchema.map((f) => {
    let v: string;
    const raw = cfValues[f.key];
    if (raw === undefined || raw === null || raw === "") v = "—";
    else if (f.type === "boolean") v = raw === true ? "是" : "否";
    else v = String(raw);
    return { label: f.label, value: v };
  });

  const detail: SampleDetail = {
    id: sample.id,
    sampleCode: sample.sampleCode,
    status: sample.status,
    purpose: sample.purpose,
    typeName: sample.type.name,
    typeIcon: sample.type.icon,
    projectName: sample.project.name,
    projectCode: sample.project.code,
    sourceOrgName: sample.sourceOrg?.name ?? null,
    donorCode: sample.donor?.code ?? null,
    createdByName: sample.createdBy.name,
    createdAt: sample.createdAt,
    updatedAt: sample.updatedAt,
    volume: sample.volume,
    volumeUnit: sample.volumeUnit,
    collectedAt: sample.collectedAt,
    frozenAt: sample.frozenAt,
    expireAt: sample.expireAt,
    freezeThawCount: sample.freezeThawCount,
    locationId: sample.locationId,
    locationPath,
    notes: sample.notes,
    customFieldsRendered,
  };

  const occupancy: Record<string, number> = {};
  for (const s of occupancySamples) {
    if (s.locationId) {
      occupancy[s.locationId] = (occupancy[s.locationId] ?? 0) + 1;
    }
  }
  const pickerLocations: PickerLocation[] = allLocations.map((l) => ({
    id: l.id,
    name: l.name,
    level: l.level,
    parentId: l.parentId,
    capacity: l.capacity,
    gridRows: l.gridRows,
    gridCols: l.gridCols,
    position: l.position,
    isActive: l.isActive,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[
          { label: "首页", href: "/" },
          { label: "样本", href: "/samples" },
          { label: sample.sampleCode },
        ]}
        title=""
        // 标题留空，由 SampleDetailTabs 自渲染大标题；page-header 仍提供面包屑
      />
      <SampleDetailTabs
        sample={detail}
        lineage={lineage.root}
        lineageCurrentId={lineage.currentId}
        transactions={timeline}
        auditLogs={audit}
        pickerLocations={pickerLocations}
        occupancy={occupancy}
      />
      <span className="sr-only">{SAMPLE_STATUS_LABEL[sample.status]}</span>
    </div>
  );
}
