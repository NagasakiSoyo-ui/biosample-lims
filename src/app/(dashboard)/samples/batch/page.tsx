import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { getLocationPath } from "@/server/services/locations";
import type { PickerLocation } from "@/components/shared/location-picker";
import { BatchWizard } from "./batch-wizard";

export const metadata = { title: "批量分装 · BioSample LIMS" };

export default async function BatchPage() {
  const [parentRows, projects, sampleTypes, locations, occSamples] =
    await Promise.all([
      prisma.sample.findMany({
        where: {
          status: { notIn: ["DISCARDED", "VOIDED", "DEPLETED"] },
        },
        include: {
          type: { select: { name: true } },
          project: { select: { code: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.project.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
      prisma.sampleType.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" },
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

  const parents = await Promise.all(
    parentRows.map(async (s) => ({
      id: s.id,
      sampleCode: s.sampleCode,
      typeId: s.typeId,
      typeName: s.type.name,
      projectId: s.projectId,
      projectCode: s.project.code,
      status: s.status,
      locationPath: s.locationId
        ? await getLocationPath(prisma, s.locationId)
        : "",
      volume: s.volume,
      volumeUnit: s.volumeUnit,
      collectedAt: s.collectedAt,
      frozenAt: s.frozenAt,
      customFields: s.customFields,
    })),
  );

  const occupancy: Record<string, number> = {};
  for (const o of occSamples) {
    if (o.locationId) {
      occupancy[o.locationId] = (occupancy[o.locationId] ?? 0) + 1;
    }
  }
  const pickerLocations: PickerLocation[] = locations.map((l) => ({
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
          { label: "批量分装" },
        ]}
        title="批量分装"
        description="将一管母样本分装为多管子样本，子样本继承母样本的项目 / 类型 / 来源 / 供者。"
      />
      <BatchWizard
        parents={parents}
        projects={projects}
        sampleTypes={sampleTypes}
        locations={pickerLocations}
        occupancy={occupancy}
      />
    </div>
  );
}
