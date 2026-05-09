import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import type { PickerLocation } from "@/components/shared/location-picker";
import { SampleForm, type SampleFormValues } from "../../sample-form";

export const metadata = { title: "编辑样本 · BioSample LIMS" };

function dateToInput(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default async function EditSamplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sample = await prisma.sample.findUnique({ where: { id } });
  if (!sample) notFound();

  const [projects, sampleTypes, sourceOrgs, donors, parents, locations, occSamples] =
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
      prisma.sample.findMany({
        where: {
          id: { not: id },
          status: { notIn: ["DISCARDED", "VOIDED"] },
        },
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
          status: { notIn: ["DEPLETED", "DISCARDED", "VOIDED", "RELEASED"] },
        },
        select: { locationId: true },
      }),
    ]);

  const occupancy: Record<string, number> = {};
  for (const s of occSamples) {
    if (s.locationId) {
      occupancy[s.locationId] = (occupancy[s.locationId] ?? 0) + 1;
    }
  }

  const cf = (sample.customFields ?? {}) as Record<string, unknown>;

  const initial: Partial<SampleFormValues> = {
    projectId: sample.projectId,
    typeId: sample.typeId,
    purpose: sample.purpose,
    sourceOrgId: sample.sourceOrgId ?? "",
    donorId: sample.donorId ?? "",
    sampleCode: sample.sampleCode,
    parentSampleId: sample.parentSampleId ?? "",
    volume: sample.volume != null ? String(sample.volume) : "",
    volumeUnit: sample.volumeUnit ?? "",
    collectedAt: dateToInput(sample.collectedAt),
    frozenAt: dateToInput(sample.frozenAt),
    expireAt: dateToInput(sample.expireAt),
    locationId: sample.locationId ?? "",
    noLocation: !sample.locationId,
    notes: sample.notes ?? "",
    customFields: cf,
  };

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
          { label: sample.sampleCode, href: `/samples/${id}` },
          { label: "编辑" },
        ]}
        title="编辑样本"
        description="样本编号和母样本一旦创建不可修改。如需更正请新建并将原样本作废。"
      />
      <SampleForm
        mode="edit"
        editingId={id}
        initial={initial}
        projects={projects}
        sampleTypes={sampleTypes}
        sourceOrgs={sourceOrgs}
        donors={donors}
        parentSamples={parents.map((s) => ({
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
