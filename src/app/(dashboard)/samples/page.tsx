import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import type { PickerLocation } from "@/components/shared/location-picker";
import {
  SamplesListClient,
  type SampleRow,
  type UrlFilter,
} from "./samples-list-client";

export const metadata = { title: "样本 · BioSample LIMS" };

type LocationLeaf = {
  name: string;
  parent: { name: string; parent: { name: string; parent: { name: string } | null } | null } | null;
};

function buildPath(loc: LocationLeaf | null): string {
  if (!loc) return "";
  const parts: string[] = [];
  let cursor: { name: string; parent: unknown } | null = loc;
  while (cursor) {
    parts.unshift(cursor.name);
    cursor = (cursor as { parent: { name: string; parent: unknown } | null })
      .parent;
  }
  return parts.join(" > ");
}

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const projectId = typeof sp.projectId === "string" ? sp.projectId : null;
  const expireBefore =
    typeof sp.expireBefore === "string" ? sp.expireBefore : null;
  const freezeThawMinRaw =
    typeof sp.freezeThawMin === "string" ? sp.freezeThawMin : null;
  const freezeThawMin = freezeThawMinRaw ? Number(freezeThawMinRaw) : null;
  const parentSampleId =
    typeof sp.parentSampleId === "string" ? sp.parentSampleId : null;

  // Build server-side WHERE clause from URL params (these come from dashboard
  // KPI links; the in-page filter form layers on top, client-side).
  const where: Prisma.SampleWhereInput = {};
  if (projectId) where.projectId = projectId;
  if (parentSampleId) where.parentSampleId = parentSampleId;
  if (expireBefore) {
    const cutoff = new Date(expireBefore);
    if (!isNaN(cutoff.getTime())) {
      // Set to end of the day so e.g. 2025-06-08 includes anything expiring
      // up through 2025-06-08 23:59.
      cutoff.setHours(23, 59, 59, 999);
      where.expireAt = { gte: new Date(), lte: cutoff };
      where.status = { notIn: ["DISCARDED", "VOIDED", "DEPLETED"] };
    }
  }
  if (freezeThawMin && Number.isFinite(freezeThawMin) && freezeThawMin > 0) {
    where.freezeThawCount = { gte: freezeThawMin };
  }

  const [samples, projects, types, locations] = await Promise.all([
    prisma.sample.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        type: { select: { name: true, icon: true } },
        project: { select: { code: true, name: true } },
        donor: { select: { code: true } },
        location: {
          select: {
            id: true,
            name: true,
            parent: {
              select: {
                name: true,
                parent: {
                  select: {
                    name: true,
                    parent: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
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
  ]);

  const data: SampleRow[] = samples.map((s) => ({
    id: s.id,
    sampleCode: s.sampleCode,
    typeName: s.type.name,
    typeIcon: s.type.icon,
    projectCode: s.project.code,
    projectName: s.project.name,
    donorCode: s.donor?.code ?? null,
    status: s.status,
    purpose: s.purpose,
    locationId: s.locationId,
    locationPath: buildPath(s.location as LocationLeaf | null),
    freezeThawCount: s.freezeThawCount,
    notes: s.notes,
    createdAt: s.createdAt,
  }));

  // Pre-compute occupancy across the full Sample table (not the filtered
  // list), so the LocationPicker in dialogs sees the true occupancy.
  const allActiveSamples = await prisma.sample.findMany({
    where: {
      locationId: { not: null },
      status: { notIn: ["DEPLETED", "DISCARDED", "VOIDED", "RELEASED"] },
    },
    select: { locationId: true },
  });
  const occupancy: Record<string, number> = {};
  for (const s of allActiveSamples) {
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

  // Active URL-driven filters (shown as a clearable banner at the top of the
  // client list).
  const urlFilters: UrlFilter[] = [];
  if (projectId) {
    const proj = projects.find((p) => p.id === projectId);
    urlFilters.push({
      label: `项目：${proj ? `${proj.code} · ${proj.name}` : projectId}`,
    });
  }
  if (parentSampleId) {
    urlFilters.push({ label: `母样本：${parentSampleId.slice(-8)}` });
  }
  if (expireBefore) {
    urlFilters.push({ label: `${expireBefore} 前过期` });
  }
  if (freezeThawMin) {
    urlFilters.push({ label: `冻融次数 ≥ ${freezeThawMin}` });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "样本" }]}
        title="样本"
        description="样本登记、出入库、批量分装与谱系管理。"
      />
      <SamplesListClient
        data={data}
        projects={projects}
        sampleTypes={types}
        locations={pickerLocations}
        occupancy={occupancy}
        urlFilters={urlFilters}
      />
    </div>
  );
}
