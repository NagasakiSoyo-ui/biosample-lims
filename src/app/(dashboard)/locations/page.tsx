import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { LocationsShell, type LocationNode } from "./locations-shell";

export const metadata = { title: "存储位置 · BioSample LIMS" };

export default async function LocationsPage() {
  const rows = await prisma.location.findMany({
    orderBy: [{ level: "asc" }, { name: "asc" }],
    include: { _count: { select: { samples: true, children: true } } },
  });

  const items: LocationNode[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    level: r.level,
    parentId: r.parentId,
    capacity: r.capacity,
    gridRows: r.gridRows,
    gridCols: r.gridCols,
    position: r.position,
    notes: r.notes,
    isActive: r.isActive,
    sampleCount: r._count.samples,
    childCount: r._count.children,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "存储位置" }]}
        title="存储位置"
        description="罐/冰箱 → 提筒 → 冻存盒 → 孔位 四层结构。点击树节点查看详情、新增子节点。"
      />
      <LocationsShell items={items} />
    </div>
  );
}
