import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectsTable, type ProjectRow } from "./projects-table";

export const metadata = { title: "项目 · BioSample LIMS" };

export default async function ProjectsPage() {
  const rows = await prisma.project.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { samples: true } } },
  });

  const data: ProjectRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    purpose: r.purpose,
    description: r.description,
    sampleCount: r._count.samples,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "项目" }]}
        title="项目"
        description="管理研究和临床回输项目；项目缩写用作样本编号前缀。"
      />
      <ProjectsTable data={data} />
    </div>
  );
}
