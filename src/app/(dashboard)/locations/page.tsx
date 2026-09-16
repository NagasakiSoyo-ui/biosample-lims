import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { LocationsShell, type LocationNode } from "./locations-shell";
import { redirect } from "next/navigation";
import { getActor, sampleWhere } from "@/server/services/auth-guard";
import { SAMPLE_STATUS_LABEL } from "@/server/services/samples";

export const metadata = { title: "存储位置 · BioSample LIMS" };

export default async function LocationsPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const rows = await prisma.location.findMany({
    orderBy: [{ level: "asc" }, { name: "asc" }],
    include: {
      samples: {
        where: {
          ...sampleWhere(actor),
          status: { notIn: ["DEPLETED", "DISCARDED", "VOIDED", "RELEASED"] },
        },
        select: {
          id: true,
          sampleCode: true,
          status: true,
          volume: true,
          volumeUnit: true,
          collectedAt: true,
          notes: true,
          type: { select: { name: true } },
          donor: { select: { name: true, code: true } },
          sourceOrg: { select: { name: true } },
        },
      },
      _count: { select: { children: true } },
    },
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
    sampleCount: r.samples.length,
    childCount: r._count.children,
    samples: r.samples.map((sample) => ({
      id: sample.id,
      sampleCode: sample.sampleCode,
      typeName: sample.type.name,
      patientName: sample.donor?.name ?? null,
      patientCode: sample.donor?.code ?? null,
      volume: sample.volume,
      volumeUnit: sample.volumeUnit,
      statusLabel: SAMPLE_STATUS_LABEL[sample.status],
      collectedAt: sample.collectedAt?.toISOString().slice(0, 10) ?? null,
      sourceOrgName: sample.sourceOrg?.name ?? null,
      notes: sample.notes,
    })),
  }));

  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    if (item.level !== "SLOT" || item.sampleCount === 0) continue;
    let parentId = item.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      parent.sampleCount += item.sampleCount;
      parentId = parent.parentId;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "存储位置" }]}
        title="存储位置"
        description="罐/冰箱 → 提筒 → 冻存盒 → 孔位 四层结构。点击树节点查看详情、新增子节点。"
      />
      <LocationsShell items={items} canManage={actor.role === "ADMIN"} />
    </div>
  );
}
