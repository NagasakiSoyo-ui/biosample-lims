import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import type { PickerLocation } from "@/components/shared/location-picker";
import { SampleForm } from "../sample-form";

export const metadata = { title: "登记样本 · BioSample LIMS" };

export default async function NewSamplePage() {
  const [projects, sampleTypes, sourceOrgs, donors, allSamples, locations, samples] =
    await Promise.all([
      prisma.project.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
      prisma.sampleType.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          icon: true,
          customFieldsSchema: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.sourceOrg.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.donor.findMany({
        where: { isActive: true },
        select: { id: true, code: true, diagnosis: true },
        orderBy: { code: "asc" },
      }),
      // parent sample candidates: not discarded/voided/depleted, capped at 200 most recent
      prisma.sample.findMany({
        where: { status: { notIn: ["DISCARDED", "VOIDED"] } },
        select: {
          id: true,
          sampleCode: true,
          type: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
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

  const occupancy: Record<string, number> = {};
  for (const s of samples) {
    if (s.locationId) {
      occupancy[s.locationId] = (occupancy[s.locationId] ?? 0) + 1;
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
          { label: "登记样本" },
        ]}
        title="登记新样本"
        description="单条登记。批量分装与 Excel 导入请使用对应入口。"
      />
      <SampleForm
        mode="create"
        projects={projects}
        sampleTypes={sampleTypes}
        sourceOrgs={sourceOrgs}
        donors={donors}
        parentSamples={allSamples.map((s) => ({
          id: s.id,
          sampleCode: s.sampleCode,
          typeName: s.type.name,
        }))}
        locations={pickerLocations}
        occupancy={occupancy}
      />
    </div>
  );
}
