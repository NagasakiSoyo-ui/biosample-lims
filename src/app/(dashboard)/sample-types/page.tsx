import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { SampleTypesTable, type SampleTypeRow } from "./sample-types-table";

export const metadata = { title: "样本类型 · BioSample LIMS" };

export default async function SampleTypesPage() {
  const rows = await prisma.sampleType.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  const data: SampleTypeRow[] = rows.map((r) => {
    const schema = Array.isArray(r.customFieldsSchema)
      ? (r.customFieldsSchema as unknown[])
      : [];
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      icon: r.icon,
      description: r.description,
      fieldCount: schema.length,
      customFieldsSchema: r.customFieldsSchema,
      isActive: r.isActive,
      createdAt: r.createdAt,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "首页", href: "/" }, { label: "样本类型" }]}
        title="样本类型"
        description="管理样本类型及其专属字段配置；新增样本类型无需修改代码。"
      />
      <SampleTypesTable data={data} />
    </div>
  );
}
