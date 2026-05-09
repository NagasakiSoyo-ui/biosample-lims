import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { SourceOrgsTable, type SourceOrgRow } from "./source-orgs-table";

export const metadata = { title: "来源单位 · BioSample LIMS" };

export default async function SourceOrgsPage() {
  const rows = await prisma.sourceOrg.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { samples: true } } },
  });

  const data: SourceOrgRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    contactPerson: r.contactPerson,
    contactPhone: r.contactPhone,
    address: r.address,
    notes: r.notes,
    sampleCount: r._count.samples,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));

  const types = Array.from(
    new Set(data.map((d) => d.type).filter(Boolean) as string[]),
  ).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "来源单位" }]}
        title="来源单位"
        description="管理样本提供方（医院、高校、合作机构、内部等）。"
      />
      <SourceOrgsTable data={data} types={types} />
    </div>
  );
}
