import { prisma } from "@/lib/prisma";
import type { SampleStatus, ProjectPurpose } from "@prisma/client";

// ---------------------------------------------------------------------------
// All queries below favor Prisma groupBy/count/aggregate so they don't pull
// the full sample table into memory.
// ---------------------------------------------------------------------------

export async function getDashboardStats() {
  const cutoff30d = new Date();
  cutoff30d.setDate(cutoff30d.getDate() + 30);
  const now = new Date();

  const [statusCounts, totalActive, purposeCounts, expiringCount, highFTCount] =
    await Promise.all([
      prisma.sample.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.sample.count({ where: { status: { not: "VOIDED" } } }),
      prisma.project.groupBy({
        by: ["purpose"],
        _count: { _all: true },
        where: { isActive: true },
      }),
      prisma.sample.count({
        where: {
          expireAt: { gte: now, lte: cutoff30d },
          status: { notIn: ["DISCARDED", "VOIDED", "DEPLETED"] },
        },
      }),
      prisma.sample.count({
        where: {
          freezeThawCount: { gt: 3 },
          status: { notIn: ["DISCARDED", "VOIDED"] },
        },
      }),
    ]);

  const statusBreakdown: Partial<Record<SampleStatus, number>> = {};
  for (const r of statusCounts)
    statusBreakdown[r.status] = r._count._all;

  const purposeBreakdown: Partial<Record<ProjectPurpose, number>> = {};
  for (const r of purposeCounts)
    purposeBreakdown[r.purpose] = r._count._all;

  const projectTotal =
    (purposeBreakdown.RESEARCH ?? 0) +
    (purposeBreakdown.CLINICAL_INFUSION ?? 0);

  return {
    totalActiveSamples: totalActive,
    statusBreakdown,
    projectTotal,
    purposeBreakdown,
    expiringCount,
    highFreezeThawCount: highFTCount,
    expiringCutoff: cutoff30d.toISOString().slice(0, 10),
  };
}

export type ProjectStat = {
  id: string;
  code: string;
  name: string;
  purpose: ProjectPurpose;
  totalSamples: number;
  availableSamples: number;
  newThisMonth: number;
  typeBreakdown: Array<{
    typeId: string;
    name: string;
    icon: string | null;
    count: number;
  }>;
};

export async function getProjectStats(): Promise<ProjectStat[]> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [projects, types, byProjectType, byProjectStatus, byProjectMonth] =
    await Promise.all([
      prisma.project.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, purpose: true },
        orderBy: { code: "asc" },
      }),
      prisma.sampleType.findMany({
        select: { id: true, name: true, icon: true },
      }),
      prisma.sample.groupBy({
        by: ["projectId", "typeId"],
        _count: { _all: true },
      }),
      prisma.sample.groupBy({
        by: ["projectId", "status"],
        _count: { _all: true },
      }),
      prisma.sample.groupBy({
        by: ["projectId"],
        _count: { _all: true },
        where: { createdAt: { gte: monthStart } },
      }),
    ]);

  const typeById = new Map(types.map((t) => [t.id, t]));
  const monthByProject = new Map(
    byProjectMonth.map((r) => [r.projectId, r._count._all]),
  );

  return projects
    .map((p) => {
      const typeRows = byProjectType.filter((r) => r.projectId === p.id);
      const statusRows = byProjectStatus.filter((r) => r.projectId === p.id);
      const totalSamples = typeRows.reduce((acc, r) => acc + r._count._all, 0);
      const availableSamples =
        statusRows.find((r) => r.status === "AVAILABLE")?._count._all ?? 0;
      const typeBreakdown = typeRows
        .map((r) => ({
          typeId: r.typeId,
          name: typeById.get(r.typeId)?.name ?? "?",
          icon: typeById.get(r.typeId)?.icon ?? null,
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count);

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        purpose: p.purpose,
        totalSamples,
        availableSamples,
        newThisMonth: monthByProject.get(p.id) ?? 0,
        typeBreakdown,
      };
    })
    .sort((a, b) => b.totalSamples - a.totalSamples);
}

export async function getTypeDistribution() {
  const [types, byType, byStatus] = await Promise.all([
    prisma.sampleType.findMany({
      select: { id: true, name: true, icon: true },
    }),
    prisma.sample.groupBy({
      by: ["typeId"],
      _count: { _all: true },
    }),
    prisma.sample.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);
  const tById = new Map(types.map((t) => [t.id, t]));
  return {
    typeData: byType
      .map((r) => ({
        typeId: r.typeId,
        name: tById.get(r.typeId)?.name ?? "?",
        icon: tById.get(r.typeId)?.icon ?? null,
        count: r._count._all,
      }))
      .filter((x) => x.count > 0),
    statusData: byStatus.map((r) => ({
      status: r.status as SampleStatus,
      count: r._count._all,
    })),
  };
}

export async function getRecentAudits(limit = 20) {
  return prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
}
