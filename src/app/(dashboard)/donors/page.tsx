import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { DonorsTable, type DonorRow } from "./donors-table";

export const metadata = { title: "供者 · BioSample LIMS" };

export default async function DonorsPage() {
  const [rows, projects, sourceOrgs] = await Promise.all([
    prisma.donor.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true } },
        sourceOrg: { select: { id: true, name: true } },
        _count: { select: { samples: true } },
      },
    }),
    prisma.project.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.sourceOrg.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const data: DonorRow[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    gender: r.gender,
    ageAtCollection: r.ageAtCollection,
    diagnosis: r.diagnosis,
    collectionDate: r.collectionDate,
    projectId: r.projectId,
    projectName: r.project?.name ?? null,
    sourceOrgId: r.sourceOrgId,
    sourceOrgName: r.sourceOrg?.name ?? null,
    notes: r.notes,
    sampleCount: r._count.samples,
    isActive: r.isActive,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "供者" }]}
        title="供者"
        description="供者 / 患者脱敏档案，关联项目和来源单位。"
      />
      <DonorsTable
        data={data}
        projects={projects}
        sourceOrgs={sourceOrgs}
      />
    </div>
  );
}
